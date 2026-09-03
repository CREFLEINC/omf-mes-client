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
 * 이 화면의 조회와 캐시 키. 무효화 범위를 한 곳에서 읽을 수 있게 모아 둔다.
 *
 * 이 화면이 소유한다 — **같은 계약을 소비하는 다른 슬라이스의 키를 참조하지도, 그 키를
 * 쓰지도 않는다.** 뿌리를 나눠 두면 한 화면의 무효화가 다른 화면의 캐시를 건드리지 않고,
 * 두 화면이 서로 다른 조건으로 같은 리소스를 보는 동안 서로를 밀어내지 않는다.
 */

export interface RequestListResponse {
  items: ApprovalRequest[];
  page: PageMeta;
}

export const iqcSkipApprovalKeys = {
  /**
   * 이 슬라이스의 조회 전부를 덮는 뿌리 키. 결재가 붙는 회차에 **모든 쓰기가 성공 뒤 이 하나를
   * 무효화한다** — 목록·상세가 함께 갱신돼야 「승인했는데 승인 버튼이 살아 있는」 상태가
   * 생기지 않는다.
   */
  all: ['iqc-skip-approval'] as const,
  list: (query: RequestListQuery) => ['iqc-skip-approval', 'list', query] as const,
  /**
   * 고른 요청의 상세. **고르지 않았으면 `null`이 열쇠에 든다** — 번호를 지어내 열쇠를 만들면
   * 서로 다른 두 상태(「고르지 않음」과 「0번 요청」)가 한 칸을 나눠 쓰게 된다.
   */
  detail: (approvalRequestId: number | null) =>
    ['iqc-skip-approval', 'detail', approvalRequestId] as const,
};

/**
 * 잠금 토큰을 꺼내는 자리 — **늘 상세 경로다.**
 *
 * 토큰 보관소는 **응답이 온 URL 경로**를 열쇠로 쓴다(`packages/api-client/src/client.ts`).
 * 이 리소스에서 `ETag`를 주는 응답은 **상세 200 하나뿐**이라(목록에는 없다) 결재가 붙는
 * 회차의 쓰기 둘이 여기서 토큰을 꺼낸다. 액션 경로(`…:approve`)로 꺼내면 언제나 비어 있고,
 * 그때 훅은 요청을 보내지 않고 멈춘다 — 「눌러도 아무 일이 없다」가 그 증상이다.
 *
 * **목록 행에서 바로 결재하지 않는 이유도 이것이다** — 목록 200에 토큰이 없어 상세를 거치지
 * 않은 쓰기는 보낼 토큰이 없다.
 */
export const requestDetailPath = (approvalRequestId: number): string =>
  `/app/approval-requests/${String(approvalRequestId)}`;

/**
 * 승인 요청 목록. 조건은 서버로 보낸다 — 클라이언트에서 거르면 서버가 자른 뒤의 결과만 걸러진다.
 *
 * 쿼리 구성 규칙(고정 축을 붙이는 것 · 빈 조건과 기본값을 싣지 않는 것 · 상신일을 날짜 그대로
 * 싣는 것)은 `filters.ts`가 갖는다. 이 훅은 **받은 쿼리를 그대로 보낼 뿐** 아무것도 더하지 않는다.
 *
 * **목록 200에는 잠금 토큰이 없다**(계약·목 실측 — 상세 200에만 있다). 그래서 뒤 회차의 결재는
 * 목록 행에서 바로 나갈 수 없고 상세를 거친다. 그 사실을 여기 적어 두는 이유는, 목록에 결재
 * 버튼을 붙이려는 생각이 드는 자리가 바로 이 파일이기 때문이다.
 */
export const useRequestList = (query: RequestListQuery): UseQueryResult<RequestListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: iqcSkipApprovalKeys.list(query),
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/approval-requests', {
          params: { query: query as ApprovalRequestQuery },
        }),
      ),
  });
};

/**
 * 고르기 전의 경로 조각.
 *
 * **이 값이 실제로 나가는 일은 없어야 한다.** 상세 조회는 `enabled`로만 성립하고, 그 규칙이
 * 지워지면 이 번호가 경로에 실려 `/app/approval-requests/0`으로 요청이 나간다 —
 * **그것이 시험에 잡히는 것이 이 상수의 목적이다**(경로 전체를 세는 감지기).
 *
 * 여기서 던져 막지 않는 이유가 그것이다. 던지면 규칙이 지워져도 요청이 나가지 않아
 * 「부르지 않았다」를 재는 감지기가 아무것도 잡지 못하고, 그 감지기는 없는 것과 같아진다.
 */
const NO_SELECTION_PATH_ID = 0;

/**
 * 고른 요청의 상세 — **결재 진행과 대상까지 이 하나로 온다.**
 *
 * 계약이 응답에 `steps`를 실어 주며 「화면이 두 번 부르지 않는다」고 적었다. 단계 전용 조회를
 * 만들지 않는 이유가 그것이다 — 두 번 부르면 두 응답이 서로 다른 시점을 보게 되고, 그 어긋남이
 * 「진행은 3단계인데 단계 목록은 2단계까지」로 나타난다.
 *
 * **고르기 전에는 성립하지 않는다.** 번호가 없으면 부를 대상이 없다 — 열어 두면 번호 없는
 * 경로로 요청이 나가 헛돈다. 「목록에 없는 선택」을 바깥에서 거르지 않고 **이 조회가
 * 판정한다**: 목록은 지금 보는 쪽·조건에 걸린 일부라, 없는 번호라고 지우면 확인칸을 켜 둔
 * 사용자에게서 끝난 요청의 선택을 빼앗는다.
 *
 * **목록 행에 같은 필드가 실려 와도 상세를 따로 부른다.** 고른 요청이 지금 보는 쪽에 없을 수
 * 있고(주소로 들어온 경우), 결재에 쓸 **잠금 토큰이 이 응답으로만 온다.**
 */
export const useRequestDetail = (
  approvalRequestId: number | null,
): UseQueryResult<ApprovalRequestDetail> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: iqcSkipApprovalKeys.detail(approvalRequestId),
    enabled: approvalRequestId !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/approval-requests/{approvalRequestId}', {
          params: { path: { approvalRequestId: approvalRequestId ?? NO_SELECTION_PATH_ID } },
        }),
      ),
  });
};
