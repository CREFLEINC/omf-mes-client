import type { ApiClient } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { ReceiptFilterQuery } from './filters';
import { toReceiptView, type ReceiptListResult } from './types';

/**
 * 이 화면의 요청 — **이 회차에는 읽기 둘이다.**
 *
 * | 언제 | 무엇 |
 * | --- | --- |
 * | 첫 진입 | 폐기 대상 입고 전표 목록 · **창고 목록**(`lookups.ts`) |
 * | 전표를 고르면 | 그 전표의 상세 — **뒤 회차에서 생긴다** |
 * | 「품의 등록」·「상신」·「기타출고 처리」 | 쓰기 셋 — **뒤 회차에서 생긴다** |
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type Client = ApiClient['client'];

/**
 * 목록 조회의 쿼리 전체. **채운 조건만 키가 실린다** —
 * 요청 URL이 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있다.
 */
export type ReceiptListQuery = ReceiptFilterQuery & {
  /** 첫 쪽이면 싣지 않는다 — 서버 기본값이 1이다. */
  page?: number;
};

/**
 * 캐시 키.
 *
 * **목록의 앞머리를 따로 둔다** — 뒤 회차에서 생길 상세·잔액·이력과 앞머리를 나눠야
 * 목록만 다시 부르려 할 때 상세까지 함께 무효화되지 않는다. 함께 무효화되면 그때 상세 응답이
 * 새 참조로 오면서 **치던 값이 사라진다**(`omf-mes#43`의 형태). 그 위험은 초안이 생기는
 * 회차에서 실제 피해가 되지만, 갈라 두는 것은 지금 한다.
 */
const RECEIPT_LIST_KEY = ['disposal-issue-goods-receipts', 'list'] as const;

export const receiptKeys = {
  list: (query: ReceiptListQuery) => [...RECEIPT_LIST_KEY, query] as const,
};

const fetchGoodsReceipts = async (
  client: Client,
  query: ReceiptListQuery,
): Promise<ReceiptListResult> => {
  const data = await runRequest(() =>
    client.GET('/logistics/goods-receipts', { params: { query } }),
  );

  return { items: data.items.map(toReceiptView), page: data.page };
};

/**
 * 폐기 대상이 될 수 있는 입고 전표 목록.
 *
 * **조건이 하나도 없어도 조회한다.** 화면에 들어오면 곧바로 폐기할 수 있는 입고가 보여야
 * 사용자가 무엇을 고를 수 있는지 안다 — 빈 화면으로 시작하면 조건을 먼저 정해야 하는 줄 안다.
 *
 * **기본 기간을 심지 않는다** — 첫 요청에 날짜 조건이 실리지 않는다.
 *
 * **창고를 화면이 골라 싣지 않는다.** 「불량창고」를 가리는 값 목록이 확정되지 않아 화면이
 * 그 판정을 할 수 없다(계획 결정 2) — 창고 조건은 **사용자가 고른 값**으로만 실린다.
 *
 * **이미 폐기된 전표를 가려내지 않는다.** 계약에 그 조건이 없고 상태 코드로 거르는 것은
 * 공유계약이 금지한다 — 화면이 값을 해석하면 값이 정해질 때 조용히 틀린다.
 */
export const useGoodsReceipts = (query: ReceiptListQuery): UseQueryResult<ReceiptListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: receiptKeys.list(query),
    queryFn: () => fetchGoodsReceipts(client, query),
  });
};
