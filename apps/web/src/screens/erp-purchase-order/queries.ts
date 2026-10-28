import type { ApiClient } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { PurchaseOrderListQuery } from './filters';
import type { PurchaseOrderDetail, PurchaseOrderListResult } from './types';

/**
 * 구매발주(P/O) 읽기 — 목록과 한 건의 상세(헤더+라인)다.
 *
 * **이 화면에는 쓰기가 없다.** ERP 에서 온 P/O 는 서버가 수정을 거절하므로, 수정 경로를 두면
 * 누를 때마다 실패하는 단추가 된다. 고치는 곳은 ERP 다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch` 가 경로를 리터럴 타입으로 요구한다.
 */

type Client = ApiClient['client'];

export const purchaseOrderKeys = {
  all: ['erp-purchase-order'] as const,
  list: (query: PurchaseOrderListQuery) => ['erp-purchase-order', 'list', query] as const,
  detail: (purchaseOrderId: number | null) =>
    ['erp-purchase-order', 'detail', purchaseOrderId] as const,
};

const fetchList = async (
  client: Client,
  query: PurchaseOrderListQuery,
): Promise<PurchaseOrderListResult> => {
  /*
   * `progress` 는 계약 사본에 아직 없다(서버에 요청 2026-10-28) — 리터럴로 넘기면 타입이 막아 변수로 넘긴다. 서버는
   * 계약에 없는 조건을 막지 않고 무시하므로, 서버가 넣기 전에는 거르지 않은 목록이 온다. 계약에 실리면 이 우회를 걷는다.
   */
  const data = await runRequest(() =>
    client.GET('/logistics/purchase-orders', { params: { query } }),
  );
  return { items: data.items, page: data.page };
};

export const usePurchaseOrderList = (
  query: PurchaseOrderListQuery,
): UseQueryResult<PurchaseOrderListResult> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: purchaseOrderKeys.list(query),
    queryFn: () => fetchList(client, query),
  });
};

/**
 * 상세는 헤더와 라인을 **함께** 내린다(계약 설명) — 라인 전용 경로를 따로 부르지 않는다.
 * 같은 사실을 두 요청으로 받으면 둘 사이에 ERP 동기화가 끼어 헤더와 라인이 어긋날 수 있다.
 * **고르기 전에는 부르지 않는다**(`enabled`).
 */
export const usePurchaseOrderDetail = (
  purchaseOrderId: number | null,
): UseQueryResult<PurchaseOrderDetail> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: purchaseOrderKeys.detail(purchaseOrderId),
    enabled: purchaseOrderId !== null,
    queryFn: () => {
      if (purchaseOrderId === null) {
        throw new Error('P/O 를 고르기 전에는 상세를 조회하지 않습니다.');
      }
      return runRequest(() =>
        client.GET('/logistics/purchase-orders/{purchaseOrderId}', {
          params: { path: { purchaseOrderId } },
        }),
      );
    },
  });
};
