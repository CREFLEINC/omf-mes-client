import type { ApiClient } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { PoFilterQuery } from './filters';
import { toPoLineView, toPoView, type PoLineView, type PoListResult } from './types';

/**
 * 이 화면의 읽기 — **오퍼레이션이 둘이다.**
 *
 * 계약에는 발주 상세(`GET /logistics/purchase-orders/{id}`)도 있으나 **부르지 않는다.**
 * 상세가 주는 `{purchaseOrder, lines}` 중 `purchaseOrder`는 목록 응답의 행에 이미 들어 있어,
 * 상세를 부르면 같은 값을 한 번 더 받는다. 한 건을 고르면 라인 경로만 부른다 — 요청 1회다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 *
 * **PR ①에는 쓰기가 없다.** 등록(`POST /logistics/inbound-receipts:split`)은 PR ②에서 붙는다 —
 * 등록을 못 하는 화면을 노출하지 않기 위해 라우트도 그때 함께 열린다.
 */

type Client = ApiClient['client'];

/**
 * 목록 조회의 쿼리 전체. **채운 조건만 키가 실린다** —
 * 요청 URL이 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있다.
 *
 * `size`·`plantId`는 싣지 않는다. 쪽 크기는 서버 기본값을 쓰고, 공장은 이 화면의 조건 축이 아니다.
 */
export type PoListQuery = PoFilterQuery & {
  /** 첫 쪽이면 싣지 않는다 — 서버 기본값이 1이다. */
  page?: number;
};

/**
 * 캐시 키.
 *
 * **목록과 라인의 앞머리를 갈라 둔다** — 하나로 묶으면 목록만 다시 부르려 해도 라인까지
 * 함께 무효화되고, 그때 라인 응답이 새 참조로 오면서 **치던 수량이 사라진다**(#43의 형태).
 */
const PO_LIST_KEY = ['purchase-orders', 'list'] as const;

export const poKeys = {
  lists: PO_LIST_KEY,
  list: (query: PoListQuery) => [...PO_LIST_KEY, query] as const,
  lines: (purchaseOrderId: number | null) =>
    ['purchase-orders', 'lines', purchaseOrderId] as const,
};

const fetchPurchaseOrders = async (
  client: Client,
  query: PoListQuery,
): Promise<PoListResult> => {
  const data = await runRequest(() =>
    client.GET('/logistics/purchase-orders', { params: { query } }),
  );

  return { items: data.items.map(toPoView), page: data.page };
};

/**
 * 대상 발주 목록.
 *
 * **조건이 하나도 없어도 조회한다.** 화면에 들어오면 곧바로 「받을 것이 남은 발주」가 보여야
 * 사용자가 무엇을 고를 수 있는지 안다 — 빈 화면으로 시작하면 조건을 먼저 정해야 하는 줄 안다.
 * 기본 조건(`openOnly`)은 `toFilterQuery`가 채운다.
 */
export const usePurchaseOrders = (query: PoListQuery): UseQueryResult<PoListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: poKeys.list(query),
    queryFn: () => fetchPurchaseOrders(client, query),
  });
};

const fetchPurchaseOrderLines = async (
  client: Client,
  purchaseOrderId: number,
): Promise<PoLineView[]> => {
  const data = await runRequest(() =>
    client.GET('/logistics/purchase-orders/{purchaseOrderId}/lines', {
      params: { path: { purchaseOrderId } },
    }),
  );

  return data.items.map(toPoLineView);
};

/**
 * 고른 발주의 라인.
 *
 * **고르기 전에는 부르지 않는다.** 캐시 키가 고른 번호를 담으므로 같은 발주를 다시 그려도
 * 요청이 한 번을 넘지 않는다 — 렌더마다 부르면 수량을 치는 동안 요청이 계속 나간다.
 *
 * 이 응답의 참조(`data`)가 바뀌는 것이 **초안을 새로 만드는 유일한 신호**다(계획 결정 4).
 */
export const usePurchaseOrderLines = (
  purchaseOrderId: number | null,
): UseQueryResult<PoLineView[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: poKeys.lines(purchaseOrderId),
    enabled: purchaseOrderId !== null,
    queryFn: () => {
      if (purchaseOrderId === null) {
        throw new Error('발주를 고르기 전에는 라인을 조회하지 않습니다.');
      }

      return fetchPurchaseOrderLines(client, purchaseOrderId);
    },
  });
};
