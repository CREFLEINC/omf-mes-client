import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { RequestListQuery } from './filters';
import type { ApprovalRequest, PageMeta } from './types';

/**
 * 결재함의 조회와 캐시 키. 무효화 범위를 한 곳에서 읽을 수 있게 모아 둔다.
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 키 모듈을 참조하지 않는다.
 */

export interface RequestListResponse {
  items: ApprovalRequest[];
  page: PageMeta;
}

export const inboxKeys = {
  /**
   * 이 슬라이스의 조회 전부를 덮는 뿌리 키. 결재가 붙는 회차에 **모든 쓰기가 성공 뒤 이 하나를
   * 무효화한다** — 목록·건수·상세가 함께 갱신돼야 「승인했는데 승인 버튼이 살아 있는」 상태가
   * 생기지 않는다.
   */
  all: ['approval-requests'] as const,
  list: (query: RequestListQuery) => ['approval-requests', 'list', query] as const,
  pendingCount: () => ['approval-requests', 'pending-count'] as const,
};

/**
 * 대기 건수 조회가 받아 오는 건수.
 *
 * **목록 조회와 달리 크기를 명시한다.** 필요한 것이 `page.total` 하나뿐이라 본문을 받을
 * 이유가 없다 — 목록 크기(서버 기본값)로 부르면 쓰지 않을 요청 50건을 왕복시킨다.
 * 계약이 `size`에 상·하한을 두지 않았다.
 */
export const PENDING_COUNT_SIZE = 1;

/**
 * 승인 요청 목록. 조건은 서버로 보낸다 — 클라이언트에서 거르면 서버가 자른 뒤의 결과만 걸러진다.
 *
 * 쿼리 구성 규칙(빈 조건과 기본값을 싣지 않는 것 · 상신일을 날짜 그대로 싣는 것)은
 * `filters.ts`가 갖고, 탭이 싣는 축은 `tabs.ts`가 갖는다.
 */
export const useRequestList = (query: RequestListQuery): UseQueryResult<RequestListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: inboxKeys.list(query),
    queryFn: () => runRequest(() => client.GET('/app/approval-requests', { params: { query } })),
  });
};

/**
 * 대기 건수 — **전용 조회 하나가 갖는다.**
 *
 * 계약에 집계 오퍼레이션이 없다. 후보 셋 중 이것을 고른 이유:
 *
 * | 후보 | 문제 |
 * | --- | --- |
 * | 지금 보이는 목록의 행 수 | **쪽 안의 수만 센다.** 51건이 있어도 「50」이 된다 |
 * | 활성 탭이 대기 탭일 때 그 응답의 `page.total` | 다른 탭에서는 건수가 **사라진다** — 뱃지의 목적이 「지금 보지 않는 곳의 대기」를 알리는 것이다 |
 * | **전용 조회**(이것) | 탭·조건·쪽과 무관하게 늘 같은 값이다 |
 *
 * **조건은 `myTurnOnly` 하나다.** 계약이 그 파라미터를 「상단 대기 건수의 근거」라고 적었다 —
 * 탭이 쓰는 조합(`assignedToMe`+`pendingOnly`)과 다른 값이며, 두 수가 갈릴 수 있다는 사실을
 * 화면이 감추지 않는다(뱃지의 접근 이름이 「대기 N건」이라고 밝힌다).
 */
export const usePendingCount = (): UseQueryResult<RequestListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: inboxKeys.pendingCount(),
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/approval-requests', {
          params: { query: { myTurnOnly: true, size: PENDING_COUNT_SIZE } },
        }),
      ),
  });
};
