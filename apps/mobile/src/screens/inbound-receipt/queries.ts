import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { itemCodeOf } from '../../patterns/material-lot-no';
import { runRequest } from '../../patterns/request';
import type { PurchaseOrder, PurchaseOrderLine } from './receipt';

/**
 * 공통코드 그룹 코드.
 *
 * 값 목록은 서버가 내려준다. 채번 식별자를 하드코딩하지 않는다 - 환경마다 다르다.
 */
export const SUBSTITUTE_LOT_REASON = 'SUBSTITUTE_LOT_REASON';

/** 담는 쪽과 지우는 쪽이 함께 쓴다. 한쪽만 문자열로 적으면 이름이 바뀔 때 조용히 어긋난다. */
const ORDERS_KEY = 'inbound-purchase-orders';

export const receiptKeys = {
  allOrders: [ORDERS_KEY] as const,
  orders: (itemId: number | null) => [ORDERS_KEY, itemId] as const,
  scannedItem: (code: string | null) => ['inbound-scanned-item', code] as const,
  detail: (purchaseOrderId: number | null) => ['inbound-po-detail', purchaseOrderId] as const,
};

/**
 * 미마감 발주.
 *
 * 상태 코드로 거르지 않는다 - 값 목록이 확정 전이라 지어내 실으면 값이 달라지는 날 목록이
 * 조용히 빈다. 아직 입하가 끝나지 않았는가는 전용 축이 따로 있다.
 */
export const useOpenPurchaseOrders = (itemId: number | null): UseQueryResult<PurchaseOrder[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: receiptKeys.orders(itemId),
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/logistics/purchase-orders', {
          params: {
            query:
              itemId === null
                ? { openOnly: true, size: 100 }
                : { openOnly: true, itemId, size: 100 },
          },
        }),
      );

      return data.items;
    },
  });
};

/**
 * 입하가 끝난 자재 P/O(사용자 지시 2026-10-22).
 *
 * 「끝났는가」를 묻는 축은 openOnly 하나라, 끝나지 않은 것도 함께 받아 미마감 목록에 없는 것만
 * 남긴다. 서버는 발주일로만 기간을 거른다 - 납기예정일은 발주일보다 앞서지 않으므로 끝은 그대로,
 * 시작은 리드타임만큼 당겨 받고 납기예정일 기간은 화면이 다시 거른다.
 */
export const RECEIVED_LEAD_DAYS = 90;

export const useReceivedPurchaseOrders = (
  orderDateFrom: string | null,
  orderDateTo: string | null,
  openIds: readonly number[] | undefined,
  enabled: boolean,
): UseQueryResult<PurchaseOrder[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: [ORDERS_KEY, 'received', orderDateFrom, orderDateTo] as const,
    enabled: enabled && openIds !== undefined,
    refetchOnMount: 'always',
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/logistics/purchase-orders', {
          params: {
            query: {
              ...(orderDateFrom === null ? {} : { orderDateFrom }),
              ...(orderDateTo === null ? {} : { orderDateTo }),
              size: 100,
            },
          },
        }),
      );

      return data.items;
    },
    select: (items) => items.filter((each) => !(openIds ?? []).includes(each.purchaseOrderId)),
  });
};

/**
 * 스캔한 번호가 가리키는 품목.
 *
 * 번호 앞 아홉 자리가 제품코드다. 그것으로 품목을 찾으면 미마감 자재 P/O 를 그 품목이 있는
 * 것만으로 좁힐 수 있다. 못 찾으면 좁히지 않는다 - 양식이 다른 번호도 들어오고, 그때
 * 후보를 0건으로 만들면 담당자가 고를 것이 사라진다.
 */
export const useScannedItem = (lotNo: string): UseQueryResult<number | null> => {
  const { client } = useApiClient();
  const code = itemCodeOf(lotNo);

  return useQuery({
    queryKey: receiptKeys.scannedItem(code),
    enabled: code !== null,
    queryFn: async () => {
      if (code === null) {
        return null;
      }

      const data = await runRequest(() =>
        client.GET('/mdm/items', { params: { query: { q: code, size: 20 } } }),
      );

      return data.items.find((item) => item.itemCode === code)?.itemId ?? null;
    },
  });
};

export interface OrderLines {
  /** 하나라도 아직 오는 중인가. */
  pending: boolean;
  fetching: boolean;
  /** 하나라도 받지 못했는가. 받은 것은 그대로 보인다. */
  failed: boolean;
  /** 받은 발주의 라인. 발주와 짝으로 둔다 - 고르면 둘을 함께 싣는다. */
  lines: { order: PurchaseOrder; line: PurchaseOrderLine }[];
}

/**
 * 여러 발주의 상세 라인을 한꺼번에. 라벨이 없을 때 한 공급사의 받을 품목을 한 목록으로 늘어놓는다.
 *
 * 한 발주를 고를 때(`usePurchaseOrderLines`)와 같은 열쇠를 써, 그 품목을 고르면 다시 부르지 않는다.
 */
export const usePurchaseOrdersLines = (
  orders: readonly PurchaseOrder[],
  /**
   * 들어올 때마다 새로 받는다 - 받아 둔 것이 있어도. 발주 상세 목록은 들어오면 받는 동안 로딩을
   * 보이고 지금 수량으로 선다(사용자 지시 2026-10-22).
   */
  { fresh = false }: { fresh?: boolean } = {},
): OrderLines => {
  const { client } = useApiClient();

  return useQueries({
    queries: orders.map((order) => ({
      queryKey: receiptKeys.detail(order.purchaseOrderId),
      ...(fresh ? { refetchOnMount: 'always' as const } : {}),
      queryFn: async () => {
        const data = await runRequest(() =>
          client.GET('/logistics/purchase-orders/{purchaseOrderId}', {
            params: { path: { purchaseOrderId: order.purchaseOrderId } },
          }),
        );

        return data.lines;
      },
    })),
    combine: (results) => ({
      pending: results.some((result) => result.isPending),
      /* 받아 둔 것을 다시 받는 중. 그 사이 보이는 행은 조금 전 것이라 목록을 내리고 기다린다. */
      fetching: results.some((result) => result.isFetching),
      failed: results.some((result) => result.isError),
      lines: results.flatMap((result, index) => {
        const order = orders[index];

        return order === undefined || result.data === undefined
          ? []
          : result.data.map((line) => ({ order, line }));
      }),
    }),
  });
};

/**
 * 고른 발주의 상세 라인.
 *
 * 예정·누적·허용치 넷은 목록 응답에 없고 이 상세 응답의 `lines`에만 함께 있다. 화면이
 * 일부 값을 다른 경로에서 조립하면 서로 다른 시점의 값으로 판정할 수 있다.
 */
export const usePurchaseOrderLines = (
  purchaseOrderId: number | null,
): UseQueryResult<PurchaseOrderLine[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: receiptKeys.detail(purchaseOrderId),
    enabled: purchaseOrderId !== null,
    queryFn: async () => {
      if (purchaseOrderId === null) {
        throw new Error('발주를 고르기 전에는 라인을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/logistics/purchase-orders/{purchaseOrderId}', {
          params: { path: { purchaseOrderId } },
        }),
      );

      return data.lines;
    },
  });
};
