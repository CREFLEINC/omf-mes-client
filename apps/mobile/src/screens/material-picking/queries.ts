import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import {
  OPEN_ORDER_STATUS,
  type MaterialIssueRequest,
  type PickingLine,
  type PickingOrder,
} from './picking';

export const pickingKeys = {
  orders: () => ['picking-orders'] as const,
  order: (pickingOrderId: number | null) => ['picking-order', pickingOrderId] as const,
  request: (materialIssueRequestId: number | null) =>
    ['picking-issue-request', materialIssueRequestId] as const,
};

/** 피킹 지시의 원천이 자재 출고 요청일 때만 도착 위치가 있다. 출하 요청은 다른 화면 몫이다. */
export const MATERIAL_ISSUE_REQUEST = 'MATERIAL_ISSUE_REQUEST';

const PAGE_SIZE = 100;

/**
 * 이 단말이 집을 수 있는 피킹 지시.
 *
 * ⛔ 담당자로 좁히지 않는다. 좁히면 담당이 빈 지시가 아무에게도 보이지 않고, 다른 공장 사람이
 * 배정된 지시도 현장에서 사라진다 - 둘 다 실기에서 만났다. 단말 토큰의 공장 밖은 서버가
 * 거절하므로 화면이 더 좁힐 까닭이 없다.
 *
 * 아직 출고할 수 있는 것만 받는다. 전기된 지시가 목록에 남으면 작업자가 그것을 다시 열고,
 * 라인의 집은 양이 출고 뒤에도 그대로라 같은 수량이 한 번 더 나간다.
 *
 * 쪽을 이어 받는다. 한 쪽만 받으면 뒤쪽 지시가 통째로 빠지는데, 화면은 그것을 받은 지시가
 * 없다고 말한다 - 모자랐다는 신호 없이 사실과 반대되는 문장이 작업자에게 간다.
 */
export const usePickingOrders = (): UseQueryResult<PickingOrder[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: pickingKeys.orders(),
    queryFn: async () => {
      const orders: PickingOrder[] = [];

      for (let page = 1; ; page += 1) {
        const data = await runRequest(() =>
          client.GET('/logistics/picking-orders', {
            params: { query: { statusCode: OPEN_ORDER_STATUS, page, size: PAGE_SIZE } },
          }),
        );

        orders.push(...data.items);

        /* 빈 쪽도 끝으로 본다. 전체 건수만 믿으면 그 값이 틀렸을 때 영원히 돈다. */
        if (data.items.length === 0 || orders.length >= data.page.total) {
          return orders;
        }
      }
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

/**
 * 이 피킹이 나온 자재 출고 요청.
 *
 * 집은 것을 어디로 가져가는지가 여기에만 있다 - 피킹 지시에는 도착 위치가 없다. 화면이
 * 말하지 않으면 어디에 두는지가 사람의 기억에만 남는다.
 */
export const useIssueRequest = (
  materialIssueRequestId: number | null,
): UseQueryResult<MaterialIssueRequest> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: pickingKeys.request(materialIssueRequestId),
    enabled: materialIssueRequestId !== null,
    queryFn: async () => {
      if (materialIssueRequestId === null) {
        throw new Error('지시를 고르기 전에는 출고 요청을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/logistics/material-issue-requests/{materialIssueRequestId}', {
          params: { path: { materialIssueRequestId } },
        }),
      );

      return data.materialIssueRequest;
    },
  });
};
