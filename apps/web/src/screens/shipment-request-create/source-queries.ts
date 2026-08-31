import type { ApiClient } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { SourceFilterQuery } from './filters';
import {
  toSalesOrderDetailView,
  toSalesOrderView,
  type SalesOrderDetailView,
  type SalesOrderListResult,
} from './types';

/**
 * 좌측 목록의 읽기 — 출하지시서(SalesOrder) 목록과 지시서 한 건의 상세다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해 문자열
 * 변수로 넘기면 타입 검사가 풀린다.
 *
 * **연계가 지시서를 채운다 — 이 화면에 등록 경로가 없다**(계약 설명 「연계가 채운다」). 그래서
 * 이 파일에는 GET 둘뿐이고 쓰기는 `mutations.ts`가 딴 곳에서 진다.
 */

type Client = ApiClient['client'];

export const sourceQueryKeys = {
  /** 목록 전체를 가리키는 앞머리 — 특정 조건을 모른 채 「모든 목록 조회」를 무효화할 때 쓴다. */
  listAll: ['shipment-request-create', 'sales-orders', 'list'] as const,
  list: (query: SourceFilterQuery & { page?: number }) =>
    [...sourceQueryKeys.listAll, query] as const,
  detail: (salesOrderId: number | null) =>
    ['shipment-request-create', 'sales-orders', 'detail', salesOrderId] as const,
};

export type SalesOrderListQuery = SourceFilterQuery & { page?: number };

const fetchSalesOrderList = async (
  client: Client,
  query: SalesOrderListQuery,
): Promise<SalesOrderListResult> => {
  const data = await runRequest(() => client.GET('/logistics/sales-orders', { params: { query } }));

  return { items: data.items.map(toSalesOrderView), page: data.page };
};

export const useSalesOrderList = (
  query: SalesOrderListQuery,
): UseQueryResult<SalesOrderListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: sourceQueryKeys.list(query),
    queryFn: () => fetchSalesOrderList(client, query),
  });
};

const fetchSalesOrderDetail = async (
  client: Client,
  salesOrderId: number,
): Promise<SalesOrderDetailView> => {
  const data = await runRequest(() =>
    client.GET('/logistics/sales-orders/{salesOrderId}', { params: { path: { salesOrderId } } }),
  );

  return toSalesOrderDetailView(data);
};

/**
 * 지시서 상세 — 라인을 함께 내린다(계약 설명). **고르기 전에는 부르지 않는다**(`enabled`).
 */
export const useSalesOrderDetail = (
  salesOrderId: number | null,
): UseQueryResult<SalesOrderDetailView> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: sourceQueryKeys.detail(salesOrderId),
    enabled: salesOrderId !== null,
    queryFn: () => {
      if (salesOrderId === null) {
        throw new Error('지시서를 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return fetchSalesOrderDetail(client, salesOrderId);
    },
  });
};
