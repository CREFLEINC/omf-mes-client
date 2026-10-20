import type { ApiClient, paths } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type {
  ErpProductionOrder,
  ErpProductionOrderListQuery,
  ErpProductionOrderListResult,
} from './types';

/**
 * ERP W/O 읽기 — 목록과 한 건이다.
 *
 * **이 화면에는 쓰기도, 계획으로 넘어가는 길도 없다.** 같은 경로를 쓰는 MES 작업 화면(W-02-01 ·
 * `production-order`)은 전개·편성으로 이어지지만, 이 화면은 ERP 가 보낸 것을 보이기만 한다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch` 가 경로를 리터럴 타입으로 요구한다.
 */

type Client = ApiClient['client'];
type ContractListQuery = NonNullable<
  paths['/planning/production-orders']['get']['parameters']['query']
>;

export const erpProductionOrderKeys = {
  all: ['erp-production-order'] as const,
  list: (query: ErpProductionOrderListQuery) => ['erp-production-order', 'list', query] as const,
  detail: (productionOrderId: number | null) =>
    ['erp-production-order', 'detail', productionOrderId] as const,
};

const fetchList = async (
  client: Client,
  query: ErpProductionOrderListQuery,
): Promise<ErpProductionOrderListResult> => {
  const data = await runRequest(() =>
    client.GET('/planning/production-orders', {
      // 계획 시작일 범위는 계약 밖 질의다(omf-mes-server#737 · 장부 P-66) — 생성 타입에 없어 넓혀 넘긴다.
      // openapi-fetch 는 받은 키를 모두 직렬화하므로 서버에 그대로 간다.
      params: { query: query as ContractListQuery },
    }),
  );
  // 응답의 계약 밖 칸 넷(P-66·P-67)은 생성 타입에 없다 — 이 화면의 타입으로 읽는다.
  return { items: data.items as ErpProductionOrder[], page: data.page };
};

export const useErpProductionOrderList = (
  query: ErpProductionOrderListQuery,
): UseQueryResult<ErpProductionOrderListResult> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: erpProductionOrderKeys.list(query),
    queryFn: () => fetchList(client, query),
  });
};

/**
 * 한 건. 받은 마지막 ERP 변경(`lastChange`)까지 함께 받는다 — 무엇이 몇에서 몇으로 바뀌었는지도
 * 받은 정보다. 변경을 받은 적이 없으면 켜도 그 칸이 없다. **고르기 전에는 부르지 않는다**(`enabled`).
 */
export const useErpProductionOrderDetail = (
  productionOrderId: number | null,
): UseQueryResult<ErpProductionOrder> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: erpProductionOrderKeys.detail(productionOrderId),
    enabled: productionOrderId !== null,
    queryFn: async () => {
      if (productionOrderId === null) {
        throw new Error('ERP W/O 를 고르기 전에는 상세를 조회하지 않습니다.');
      }
      const data = await runRequest(() =>
        client.GET('/planning/production-orders/{productionOrderId}', {
          params: { path: { productionOrderId }, query: { withLastChange: true } },
        }),
      );
      return data as ErpProductionOrder;
    },
  });
};
