import type { ApiClient } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest, toApiError } from '../../patterns/request';
import type { ReceiptFilterQuery } from './filters';
import {
  toReceiptLineView,
  toReceiptView,
  type ReceiptDetailResult,
  type ReceiptListResult,
} from './types';

/**
 * 이 화면의 요청 — **이 회차에는 읽기 둘뿐이다.**
 *
 * | 언제 | 무엇 |
 * | --- | --- |
 * | 첫 진입 | 입고 전표 목록 · **창고 목록**(`lookups.ts`) |
 * | 전표를 고르면 | **그 전표의 상세** — 헤더와 라인이 한 번에 온다 |
 * | 「반품 처리」 확인 | `POST /logistics/goods-issues` — **뒤따르는 회차에서 생긴다** |
 *
 * **라인을 따로 부르지 않는다.** 계약의 입고 상세가 `{goodsReceipt, lines}`를 함께 주고
 * **라인 목록에 쪽 정보가 없다**(실측) — 전건이 온다는 뜻이라 라인 잘림 판정이 이 화면에 없다.
 * 라인 전용 경로가 계약에 있으나 부르면 같은 값을 한 번 더 받는다.
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
 * **목록과 상세의 앞머리를 갈라 둔다** — 하나로 묶으면 목록만 다시 부르려 해도 상세까지
 * 함께 무효화되고, 그때 상세 응답이 새 참조로 오면서 **치던 값이 사라진다**(#43의 형태).
 * 그 위험은 초안이 생기는 다음 회차에서 실제 피해가 되지만, 갈라 두는 것은 지금 한다.
 */
const RECEIPT_LIST_KEY = ['supplier-return-goods-receipts', 'list'] as const;

export const receiptKeys = {
  list: (query: ReceiptListQuery) => [...RECEIPT_LIST_KEY, query] as const,
  detail: (goodsReceiptId: number | null) =>
    ['supplier-return-goods-receipts', 'detail', goodsReceiptId] as const,
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
 * 반품 대상이 될 수 있는 입고 전표 목록.
 *
 * **조건이 하나도 없어도 조회한다.** 화면에 들어오면 곧바로 되돌려 보낼 수 있는 입고가 보여야
 * 사용자가 무엇을 고를 수 있는지 안다 — 빈 화면으로 시작하면 조건을 먼저 정해야 하는 줄 안다.
 *
 * **기본 기간을 심지 않는다** — 첫 요청에 날짜 조건이 실리지 않는다.
 *
 * **이미 반품된 전표를 가려내지 않는다.** 계약에 그 조건이 없고 상태 코드로 거르는 것은
 * 공유계약이 금지한다 — 화면이 값을 해석하면 값이 정해질 때 조용히 틀린다.
 */
export const useGoodsReceipts = (query: ReceiptListQuery): UseQueryResult<ReceiptListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: receiptKeys.list(query),
    queryFn: () => fetchGoodsReceipts(client, query),
  });
};

const fetchGoodsReceiptDetail = async (
  client: Client,
  goodsReceiptId: number,
): Promise<ReceiptDetailResult> => {
  const data = await runRequest(() =>
    client.GET('/logistics/goods-receipts/{goodsReceiptId}', {
      params: { path: { goodsReceiptId } },
    }),
  );

  return {
    receipt: toReceiptView(data.goodsReceipt),
    lines: data.lines.map(toReceiptLineView),
  };
};

/**
 * 고른 입고 전표의 상세 — **헤더와 라인이 한 번에 온다.**
 *
 * **고르기 전에는 부르지 않는다.** 캐시 키가 고른 번호를 담으므로 같은 전표를 다시 그려도
 * 요청이 한 번을 넘지 않는다.
 *
 * **이 조회가 단계 판정의 근거다**(계획 결정 3). 200이면 S1, 404면 S4다 —
 * 목록에 그 전표가 있는지로 판정하지 않는다. `gr`는 경로 조각이라 목록과 무관하게 상세를
 * 부를 수 있고, 목록 소속으로 판정하면 **조건이 좁아 목록에 없는 전표를 고른 상태가 지워진다.**
 */
export const useGoodsReceiptDetail = (
  goodsReceiptId: number | null,
): UseQueryResult<ReceiptDetailResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: receiptKeys.detail(goodsReceiptId),
    enabled: goodsReceiptId !== null,
    queryFn: () => {
      if (goodsReceiptId === null) {
        throw new Error('입고 전표를 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return fetchGoodsReceiptDetail(client, goodsReceiptId);
    },
  });
};

/**
 * 그 입고 전표가 **없는가**(404).
 *
 * 다른 실패와 갈라야 하는 이유는 사용자가 할 조치가 다르기 때문이다 — 없는 전표는 다시
 * 시도해도 나타나지 않으므로 「다시 시도」가 아니라 **주소 정리와 다시 고르기**로 안내한다
 * (계획 결정 3의 S4 · 수명 표 5행).
 *
 * **상세 조회의 실패 갈래는 404뿐이다**(실측 — 이 오퍼레이션의 응답은 200과 404 둘이다).
 * 그래도 다른 갈래를 남겨 둔다: 네트워크 끊김과 게이트웨이 오류는 계약에 적히지 않는다.
 */
export const isReceiptNotFound = (error: unknown): boolean => {
  const apiError = toApiError(error);

  return apiError.kind === 'http' && apiError.status === 404;
};
