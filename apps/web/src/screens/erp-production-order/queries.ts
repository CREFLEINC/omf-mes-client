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
 * ERP W/O 읽기 — 목록뿐이다(상세를 두지 않아 한 건을 부르지 않는다).
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
