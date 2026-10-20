import type { ApiClient } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { SalesOrderListQuery } from './filters';
import type { SalesOrder, SalesOrderListResult } from './types';

/**
 * 수주 읽기 — 목록과 한 건의 상세다.
 *
 * **이 화면에는 쓰기가 없다.** 수주는 연계가 채운다 — 계약에 등록·수정 경로가 없다.
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch` 가 경로를 리터럴 타입으로 요구한다.
 */

type Client = ApiClient['client'];

export const salesOrderKeys = {
  all: ['erp-sales-order'] as const,
  list: (query: SalesOrderListQuery) => ['erp-sales-order', 'list', query] as const,
  detail: (salesOrderId: number | null) => ['erp-sales-order', 'detail', salesOrderId] as const,
};

const fetchList = async (
  client: Client,
  query: SalesOrderListQuery,
): Promise<SalesOrderListResult> => {
  const data = await runRequest(() => client.GET('/logistics/sales-orders', { params: { query } }));
  return { items: data.items, page: data.page };
};

export const useSalesOrderList = (
  query: SalesOrderListQuery,
): UseQueryResult<SalesOrderListResult> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: salesOrderKeys.list(query),
    queryFn: () => fetchList(client, query),
  });
};

/** 상세 — 라인을 함께 내린다(계약 설명). **고르기 전에는 부르지 않는다**(`enabled`). */
export const useSalesOrderDetail = (salesOrderId: number | null): UseQueryResult<SalesOrder> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: salesOrderKeys.detail(salesOrderId),
    enabled: salesOrderId !== null,
    queryFn: () => {
      if (salesOrderId === null) {
        throw new Error('수주를 고르기 전에는 상세를 조회하지 않습니다.');
      }
      return runRequest(() =>
        client.GET('/logistics/sales-orders/{salesOrderId}', {
          params: { path: { salesOrderId } },
        }),
      );
    },
  });
};
