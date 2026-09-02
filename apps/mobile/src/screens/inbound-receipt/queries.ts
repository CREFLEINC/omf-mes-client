import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { PurchaseOrder, PurchaseOrderLine } from './receipt';

/**
 * 공통코드 그룹 코드.
 *
 * 값 목록은 서버가 내려준다. 채번 식별자를 하드코딩하지 않는다 - 환경마다 다르다.
 */
export const SUBSTITUTE_LOT_REASON = 'SUBSTITUTE_LOT_REASON';

export const receiptKeys = {
  orders: () => ['inbound-purchase-orders'] as const,
  lines: (purchaseOrderId: number | null) => ['inbound-po-lines', purchaseOrderId] as const,
};

/**
 * 미마감 발주.
 *
 * 상태 코드로 거르지 않는다 - 값 목록이 확정 전이라 지어내 실으면 값이 달라지는 날 목록이
 * 조용히 빈다. 아직 입하가 끝나지 않았는가는 전용 축이 따로 있다.
 */
export const useOpenPurchaseOrders = (): UseQueryResult<PurchaseOrder[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: receiptKeys.orders(),
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/logistics/purchase-orders', {
          params: { query: { openOnly: true, size: 100 } },
        }),
      );

      return data.items;
    },
  });
};

/** 고른 발주의 라인. 예정 수량과 허용치가 여기 있고, 그것으로 화면이 세 갈래를 판정한다. */
export const usePurchaseOrderLines = (
  purchaseOrderId: number | null,
): UseQueryResult<PurchaseOrderLine[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: receiptKeys.lines(purchaseOrderId),
    enabled: purchaseOrderId !== null,
    queryFn: async () => {
      if (purchaseOrderId === null) {
        throw new Error('발주를 고르기 전에는 라인을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/logistics/purchase-orders/{purchaseOrderId}/lines', {
          params: { path: { purchaseOrderId } },
        }),
      );

      return data.items;
    },
  });
};
