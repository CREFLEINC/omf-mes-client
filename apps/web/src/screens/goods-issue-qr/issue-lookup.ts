/**
 * 출고번호로 전표를 찾는다 — **셸 메뉴로 들어온 작업자가 여기서 시작한다**(U3).
 *
 * ⭐ **왜 필요한가.** 이 화면은 주소의 `?goodsIssueId=` 로만 열렸는데, POP 머리줄 [화면 이동]은
 *    전표를 싣지 않는다. 그 길로 들어오면 「출고 전표를 고른 뒤 들어오세요」만 서고 **전표를
 *    고를 자리가 화면에 없었다** — 작업자가 갈 데가 없다(ISSUE-QR-01 G2 ③).
 *
 * ⛔ **부분 일치로 아무거나 고르지 않는다.** 계약이 이 자리에 정확 일치 축을 두지 않아
 *    `q`(부분 검색)로 묻고 **번호가 똑같은 한 건**만 받아들인다. 비슷한 번호를 화면이 대신
 *    고르면, 되돌릴 수 없는 발행이 **작업자가 고르지 않은 전표**에 남는다.
 *
 * ⚠ 자재 LOT QR 과 달리 여기 들어오는 값은 **사람이 읽는 출고번호**다(스캔 칸이 아니라 전표
 *   번호 칸이다). 출고 QR 페이로드(`OMF-GIL|…`)를 읽는 것은 모바일 M-01-09 쪽 일이다.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

import { goodsIssueQrKeys } from './queries';
import type { GoodsIssue } from './types';

/**
 * 한 번에 받아 둘 최대 건수.
 *
 * ⚠ **일치 건이 뒤쪽에 있으면 못 찾는다** — 그때 화면은 「없다」고 말하는데 실제로는 있다.
 *   모바일이 같은 자리에서 같은 수(200)를 쓴다(`shopfloor-receipt/queries.ts`).
 */
const SEARCH_SIZE = 200;

export type IssueLookupOutcome =
  | { kind: 'found'; issue: GoodsIssue }
  /** 번호가 똑같은 건이 없다. 「찾는 중」과 다른 사실이다. */
  | { kind: 'notFound' };

export const useGoodsIssueByNo = (
  goodsIssueNo: string | null,
): UseQueryResult<IssueLookupOutcome> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: goodsIssueQrKeys.issueByNo(goodsIssueNo ?? ''),
    enabled: goodsIssueNo !== null && goodsIssueNo !== '',
    /* 찾은 뒤 바로 주소로 옮겨 가므로 다시 물을 일이 없다. */
    gcTime: 0,
    queryFn: async (): Promise<IssueLookupOutcome> => {
      const found = await runRequest(() =>
        client.GET('/logistics/goods-issues', {
          params: { query: { q: goodsIssueNo as string, size: SEARCH_SIZE } },
        }),
      );

      const issue = found.items.find((each) => each.goodsIssueNo === goodsIssueNo);

      return issue === undefined ? { kind: 'notFound' } : { kind: 'found', issue };
    },
  });
};
