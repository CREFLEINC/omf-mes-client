import type { ApiClient } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toReceiptView, type ReceiptListResult } from './types';

/**
 * 이 화면의 요청 — 이 슬라이스에서는 **읽기 하나뿐**이다.
 *
 * | 언제 | 무엇 |
 * | --- | --- |
 * | 첫 진입 | 라벨 미발행 입하 건 목록 |
 *
 * ⛔ **미부착(`supplierLotMissing`) 조건을 싣지 않는다.** 계약이 그 값을 입하 **라인**의
 * 속성으로 두고 건 목록에는 필터를 주지 않는다. 화면이 라인을 다 읽어 걸러 내면 쪽 나눔이
 * 어긋나므로(거른 뒤 개수가 쪽 크기와 달라진다) 걸러 내지 않고 **그 사실을 화면이 밝힌다.**
 * 필터가 생겨야 풀린다 — 검토 요청 omf-mes#245 ③.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 */

type Client = ApiClient['client'];

/** 목록 조회의 쿼리 전체. **채운 조건만 키가 실린다** — 요청 URL이 조건을 그대로 드러낸다. */
export interface ReceiptListQuery {
  /** 첫 쪽이면 싣지 않는다 — 서버 기본값이 1이다. */
  page?: number;
}

const RECEIPT_LIST_KEY = ['pop-material-lot-label', 'receipts'] as const;

export const receiptKeys = {
  lists: RECEIPT_LIST_KEY,
  list: (query: ReceiptListQuery) => [...RECEIPT_LIST_KEY, query] as const,
};

const fetchReceipts = async (
  client: Client,
  query: ReceiptListQuery,
): Promise<ReceiptListResult> => {
  const data = await runRequest(() =>
    client.GET('/logistics/inbound-receipts', {
      // 이미 발행된 건은 목록에서 뺀다. 그 건은 재인쇄 경로로 간다.
      params: { query: { ...query, labelIssued: false } },
    }),
  );

  return { items: data.items.map(toReceiptView), page: data.page };
};

/**
 * 발행 대상 입하 건 목록.
 *
 * **조건 없이 곧바로 조회한다.** 화면에 들어오면 무엇을 고를 수 있는지 바로 보여야 한다 —
 * 빈 화면으로 시작하면 조건을 먼저 정해야 하는 줄 안다. 터치 단말에는 조건을 치는 자리가 없다.
 */
export const useReceipts = (query: ReceiptListQuery): UseQueryResult<ReceiptListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: receiptKeys.list(query),
    queryFn: () => fetchReceipts(client, query),
  });
};
