import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { RequestListQuery } from './filters';
import type { ApprovalRequest, PageMeta } from './types';

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
};

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
    queryFn: () => runRequest(() => client.GET('/app/approval-requests', { params: { query } })),
  });
};
