import type { ApiClient } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { QueueListQuery } from './filters';
import {
  toInspectionQueueResult,
  toInspectionRequestDetail,
  toInspectionResultRound,
  type InspectionQueueResult,
  type InspectionRequestDetail,
  type InspectionResultRound,
} from './types';

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

/** 한 의뢰의 회차 수는 작다 — 재검사가 이만큼 쌓이면 자료가 이상한 것이다. */
const ROUNDS_PAGE_SIZE = 100;

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
  /**
   * 고른 의뢰의 상세. **목록과 앞머리를 갈라 둔다** — 하나로 묶으면 목록만 다시 부르려 해도
   * 상세까지 함께 무효화되고, 반대로 저장 뒤 상세만 갱신하려 할 때 목록이 통째로 다시 온다.
   */
  detail: (inspectionRequestId: number) => [...ALL_KEY, 'detail', inspectionRequestId] as const,
  /** 그 의뢰의 회차 목록. 상세와도 갈라 둔다 — 저장이 바꾸는 것은 회차이지 의뢰가 아니다. */
  rounds: (inspectionRequestId: number) => [...ALL_KEY, 'rounds', inspectionRequestId] as const,
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

const fetchDetail = (
  client: Client,
  inspectionRequestId: number,
): Promise<InspectionRequestDetail> =>
  runRequest(() =>
    client.GET('/quality/inspection-requests/{inspectionRequestId}', {
      params: { path: { inspectionRequestId } },
    }),
  ).then(toInspectionRequestDetail);

const fetchRounds = (
  client: Client,
  inspectionRequestId: number,
): Promise<InspectionResultRound[]> =>
  runRequest(() =>
    client.GET('/quality/inspection-results', {
      params: { query: { inspectionRequestId, page: 1, size: ROUNDS_PAGE_SIZE } },
    }),
  ).then((response) => response.items.map(toInspectionResultRound));

/**
 * 고른 의뢰의 상세를 부른다. **고르기 전에는 부르지 않는다** — 부를 대상이 없다.
 */
export const useInspectionRequestDetail = (
  inspectionRequestId: number | null,
): UseQueryResult<InspectionRequestDetail> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: iqcInspectionKeys.detail(inspectionRequestId ?? 0),
    queryFn: () => fetchDetail(client, inspectionRequestId as number),
    enabled: inspectionRequestId !== null,
  });
};

/**
 * 그 의뢰의 회차를 부른다.
 *
 * ⛔ **기간을 보내지 않는다.** 계약이 `inspectedFrom` 을 **조건부 필수**로 두었는데, 그
 * 조건이 「`inspectionRequestId` 없이 전 이력을 훑을 때」다. 한 의뢰의 회차를 읽는 이
 * 경로에 기간을 실으면 **화면이 없는 기간을 지어내게 된다** — 설계가 그 자리를 그렇게
 * 정한 이유이기도 하다(omf-mes#170 회신).
 *
 * ⭐ **쪽을 넘기지 않는다.** 한 의뢰의 재검사 회차가 한 쪽을 넘길 일이 없다. 넘긴다면
 * 그것은 이 화면이 다룰 상황이 아니라 자료가 이상한 것이므로, 쪽 이동을 만들어 감추는
 * 대신 그대로 드러나게 둔다.
 */
export const useInspectionRounds = (
  inspectionRequestId: number | null,
): UseQueryResult<InspectionResultRound[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: iqcInspectionKeys.rounds(inspectionRequestId ?? 0),
    queryFn: () => fetchRounds(client, inspectionRequestId as number),
    enabled: inspectionRequestId !== null,
  });
};
