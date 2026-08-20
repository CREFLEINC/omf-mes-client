import type { ApiClient } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { QueueListQuery } from './filters';
import { toInspectionQueueResult, type InspectionQueueResult } from './types';

/**
 * 이 회차의 요청 — **읽기 하나다.**
 *
 * | 언제 | 무엇 |
 * | --- | --- |
 * | 화면에 들어오거나 조건·쪽이 바뀌면 | 검사 대기 큐 목록 |
 *
 * 우측 창(의뢰 상세·결과 입력·측정치·판정 확정)의 요청은 다음 회차가 더한다. 이 회차는
 * 좌측 큐 하나만 세운다 — 미완성 부분을 노출하지 않으려고 라우트도 아직 열지 않는다.
 *
 * **참조 조회를 두지 않는다.** 품목·자재 LOT 은 번호로만 그린다 — 이름 목록을 얹으면 그 조회의
 * 좁힘·잘림·실패 규칙이 이 표에 함께 따라오고, 대기 큐가 그것 때문에 비어 보일 수 있다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch` 가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type Client = ApiClient['client'];

/**
 * 이 자원의 조회를 덮는 뿌리 키.
 *
 * **목록의 앞머리를 따로 둔다** — 다음 회차가 상세·측정치 조회를 더할 때 그쪽을 무효화해도
 * 목록까지 함께 다시 부르지 않도록, 지금부터 자리를 갈라 둔다. 나중에 가르려면 무효화하는
 * 쪽을 전부 찾아 고쳐야 한다.
 */
const ALL_KEY = ['iqc-inspection'] as const;

export const iqcInspectionKeys = {
  all: ALL_KEY,
  /** 질의가 곧 열쇠다 — 조건이나 쪽이 다르면 다른 결과이므로 캐시도 갈려야 한다. */
  queue: (query: QueueListQuery) => [...ALL_KEY, 'queue', query] as const,
};

const fetchQueue = (client: Client, query: QueueListQuery): Promise<InspectionQueueResult> =>
  runRequest(() => client.GET('/quality/inspection-requests', { params: { query } })).then(
    toInspectionQueueResult,
  );

/**
 * 검사 대기 큐를 부른다.
 *
 * **늘 부른다 — 이 화면에는 「조회가 성립하지 않는」 상태가 없다.** 계약의 질의값이 전부
 * 선택이라 조건 없이도 목록이 나오고, 그것이 이 화면의 기본 상태(전체 대기)다. 조건을 갖춘
 * 뒤에야 부르는 화면들(`document-progress`·`notification-center`)과 갈리는 자리이며, 그
 * 이유는 `filters.ts` 머리에 적었다.
 */
export const useInspectionQueue = (
  query: QueueListQuery,
): UseQueryResult<InspectionQueueResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: iqcInspectionKeys.queue(query),
    queryFn: () => fetchQueue(client, query),
  });
};
