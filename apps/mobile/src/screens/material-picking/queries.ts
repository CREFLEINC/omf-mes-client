import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { PickingLine, PickingOrder } from './picking';

export const pickingKeys = {
  orders: (workerId: number | null) => ['picking-orders', workerId] as const,
  order: (pickingOrderId: number | null) => ['picking-order', pickingOrderId] as const,
};

/**
 * 내게 배정된 피킹 지시.
 *
 * 담당자를 실어 묻는다. 비우면 남의 지시까지 오는데, 이 셸에는 계정 로그인이 없어 서버가
 * 본인을 풀 근거가 없다 - 사번으로 얻은 작업자 식별자를 화면이 싣는다.
 */
export const useAssignedPickingOrders = (
  workerId: number | null,
): UseQueryResult<PickingOrder[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: pickingKeys.orders(workerId),
    enabled: workerId !== null,
    queryFn: async () => {
      if (workerId === null) {
        throw new Error('사번을 확인하기 전에는 피킹 지시를 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/logistics/picking-orders', {
          params: { query: { assignedWorkerId: workerId, size: 100 } },
        }),
      );

      return data.items;
    },
  });
};

export interface PickingOrderDetail {
  order: PickingOrder;
  lines: PickingLine[];
}

/**
 * 지시의 라인들.
 *
 * 보류 여부와 선출 순위를 서버가 함께 내려준다 - 화면이 별도 호출로 세지 않고 다시 계산하지도
 * 않는다. 사람이 읽을 값(품목 코드·LOT 번호·위치 코드)도 응답에 들어 있어 마스터를 되짚지
 * 않는다. 오프라인에서는 그 마스터를 갱신할 수 없기 때문이다.
 */
export const usePickingOrder = (
  pickingOrderId: number | null,
): UseQueryResult<PickingOrderDetail> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: pickingKeys.order(pickingOrderId),
    enabled: pickingOrderId !== null,
    /*
     * 열 때마다 서버에 다시 묻는다. 이 값에 담긴 것을 더해 얼마를 집을지 정하고, 그 결과가
     * 되돌릴 수 없는 재고 차감이다 - 목록으로 나가 있는 사이 셸이 큐를 비우면 담긴 것이
     * 셈에서 빠지는데, 낡은 응답이 남아 있으면 화면이 안 집은 것으로 보인다.
     */
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      if (pickingOrderId === null) {
        throw new Error('지시를 고르기 전에는 라인을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/logistics/picking-orders/{pickingOrderId}', {
          params: { path: { pickingOrderId } },
        }),
      );

      return { order: data.pickingOrder, lines: data.lines };
    },
  });
};
