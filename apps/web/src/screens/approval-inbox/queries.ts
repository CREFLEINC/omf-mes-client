import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { paths } from '@omf-mes/api-client';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { RequestListQuery } from './filters';
import type { ApprovalRequest, ApprovalRequestDetail, PageMeta } from './types';

type ApprovalRequestQuery = NonNullable<
  paths['/app/approval-requests']['get']['parameters']['query']
>;

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
  detail: (approvalRequestId: number) =>
    ['approval-requests', 'detail', approvalRequestId] as const,
};

/**
 * 잠금 토큰을 꺼내는 자리 — **늘 상세 경로다.**
 *
 * 토큰 보관소는 **응답이 온 URL 경로**를 열쇠로 쓴다(`packages/api-client/src/client.ts`).
 * 이 리소스에서 `ETag`를 주는 응답은 **상세 200 하나뿐**이라(목록·건수에는 없다) 결재가
 * 붙는 회차의 쓰기 둘이 여기서 토큰을 꺼낸다. 액션 경로(`…:approve`)로 꺼내면 언제나 비어
 * 있고, 그때 훅은 요청을 보내지 않고 멈춘다 — 「눌러도 아무 일이 없다」가 그 증상이다
 * (전례 W-CO-02·W-06-15).
 *
 * **목록 행에서 바로 결재하지 않는 이유도 이것이다** — 목록 200에 토큰이 없어 상세를 거치지
 * 않은 쓰기는 보낼 토큰이 없다.
 */
export const requestDetailPath = (approvalRequestId: number): string =>
  `/app/approval-requests/${String(approvalRequestId)}`;

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
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/approval-requests', {
          params: { query: query as ApprovalRequestQuery },
        }),
      ),
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

/**
 * 고른 요청의 상세 — **결재 진행과 대상까지 이 하나로 온다.**
 *
 * 계약이 응답에 `steps`를 실어 주며 「화면이 두 번 부르지 않는다」고 적었다. 단계 전용 조회를
 * 만들지 않는 이유가 그것이다 — 두 번 부르면 두 응답이 서로 다른 시점을 보게 되고, 그 어긋남이
 * 「진행은 3단계인데 단계 목록은 2단계까지」로 나타난다.
 *
 * **고르기 전에는 성립하지 않는다.** 번호가 없으면 요청 자체가 만들어질 수 없으므로 조회를
 * 열지 않는다 — 열어 두면 `/app/approval-requests/0` 같은 요청이 나가 헛돈다.
 *
 * **목록 행에 같은 필드가 실려 와도 상세를 따로 부른다.** 고른 요청이 지금 보는 쪽에 없을 수
 * 있고(주소로 들어온 경우), 결재에 쓸 **잠금 토큰이 이 응답으로만 온다.**
 */
export const useRequestDetail = (
  approvalRequestId: number | null,
): UseQueryResult<ApprovalRequestDetail> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: inboxKeys.detail(approvalRequestId ?? 0),
    enabled: approvalRequestId !== null,
    queryFn: () => {
      if (approvalRequestId === null) {
        throw new Error('요청을 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/app/approval-requests/{approvalRequestId}', {
          params: { path: { approvalRequestId } },
        }),
      );
    },
  });
};
