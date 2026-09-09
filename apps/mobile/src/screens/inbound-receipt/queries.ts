import { useQuery, type UseQueryResult } from '@tanstack/react-query';

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

export const receiptKeys = {
  orders: (itemId: number | null) => ['inbound-purchase-orders', itemId] as const,
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
 * 스캔한 번호가 가리키는 품목.
 *
 * 번호 앞 아홉 자리가 제품코드다. 그것으로 품목을 찾으면 미마감 ERP W/O 를 그 품목이 있는
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
