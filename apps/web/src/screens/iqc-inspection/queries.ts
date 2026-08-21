import type { ApiClient, components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult, type WriteHeaders } from '../../patterns/master';
import { runRequest, type ApiCallResult } from '../../patterns/request';
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
  /**
   * 회차 한 건. **목록과 갈라 두는 이유가 내용이 아니라 잠금 토큰이다** — 아래 훅 주석 참조.
   */
  round: (inspectionResultId: number) => [...ALL_KEY, 'round', inspectionResultId] as const,
};

/** 회차 한 건의 경로. 잠금 토큰이 이 경로를 열쇠로 보관되므로 **한 자리에서만 만든다.** */
export const roundPath = (inspectionResultId: number): string =>
  `/quality/inspection-results/${inspectionResultId}`;

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

const fetchRound = (client: Client, inspectionResultId: number): Promise<InspectionResultRound> =>
  runRequest(() =>
    client.GET('/quality/inspection-results/{inspectionResultId}', {
      params: { path: { inspectionResultId } },
    }),
  ).then(toInspectionResultRound);

/**
 * 회차 한 건을 부른다 — ⭐ **잠금 토큰을 얻기 위해서다.**
 *
 * 목록(`useInspectionRounds`)이 같은 내용을 이미 주는데도 이 조회를 따로 두는 이유는
 * **목록 200 에 `ETag` 가 없기 때문**이다(계약 실측 — 단건 200 에만 있다). 그리고 토큰
 * 보관소가 **응답이 온 URL 경로**를 열쇠로 쓰므로, 목록 경로로 꺼내면 언제나 비어 있다.
 *
 * ⛔ 토큰이 없으면 `PUT` 의 `If-Match` 를 채울 수 없고, 빈 `If-Match` 는 계약 위반이라
 * 서버가 400 으로 되돌린다. 그래서 **고칠 회차가 있을 때만** 부른다.
 *
 * 전례가 같은 형태를 적어 두었다 — `document-progress/queries.ts` 「상세를 둘 부른다 —
 * 역할이 다르다」.
 */
export const useInspectionRoundLock = (
  inspectionResultId: number | null,
): UseQueryResult<InspectionResultRound> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: iqcInspectionKeys.round(inspectionResultId ?? 0),
    queryFn: () => fetchRound(client, inspectionResultId as number),
    enabled: inspectionResultId !== null,
  });
};

type InspectionResultCreate = components['schemas']['InspectionResultCreate'];
type InspectionResultUpdate = components['schemas']['InspectionResultUpdate'];
type InspectionResultResponse = components['schemas']['InspectionResult'];

/**
 * 임시 저장이 보내는 값.
 *
 * ⛔ **검사자와 단말을 보내지 않는다.** 계약에서 사라졌다 — 검사자는 로그인한 주체에서
 * 서버가 정하는 값이라 화면이 만들 수 없고, 화면이 세션 값을 실으면 품질 감사 기록에
 * 엉뚱한 사람이 남는다(omf-mes#173). 단말도 같다 — 요청을 인증한 것이 단말이므로 서버가 안다.
 */
export interface SaveDraftVariables {
  inspectionRequestId: number;
  inspectedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  heldQty: number;
  uomId: number;
  /** 검사한 시각. **호출부가 준다** — 이 파일이 실행 환경의 시각을 스스로 읽지 않는다 */
  inspectedAt: string;
}

/** 계약이 못박은 두 값 중 임시 저장이 쓰는 쪽. 확정은 다음 회차가 다룬다. */
const DRAFT_STATUS = '작성중';

/**
 * 검사 결과를 임시 저장한다 — **고칠 회차가 있으면 고치고, 없으면 만든다.**
 *
 * ⭐ **임시 저장은 상태를 바꾸지 않는다**(스펙 §5-2). LOT 상태를 옮기는 것은 확정뿐이다.
 * 다만 서버는 **첫 임시 저장을 「검사 시작」으로 읽어** 의뢰 상태를 진행으로 옮긴다 —
 * 그래서 ⛔ **「검사 시작」 단추를 만들지 않는다**(omf-mes#170 회신 · 스펙 §3 에도 없다).
 *
 * 잠금 토큰은 **고칠 때만** 필요하다. 새로 만들 때는 되돌릴 대상이 없어 계약도 `If-Match` 를
 * 선택으로 둔다.
 */
export const useSaveDraft = (
  inspectionRequestId: number | null,
  editingResultId: number | null,
  onSaved: () => void,
): MasterWriteResult<SaveDraftVariables> => {
  const { client } = useApiClient();

  return useMasterWrite<SaveDraftVariables, InspectionResultResponse>({
    request: (
      variables,
      headers: WriteHeaders,
    ): Promise<ApiCallResult<InspectionResultResponse>> =>
      editingResultId === null
        ? client.POST('/quality/inspection-results', {
            params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
            body: toCreateBody(variables),
          })
        : client.PUT('/quality/inspection-results/{inspectionResultId}', {
            params: {
              path: { inspectionResultId: editingResultId },
              header: {
                'Idempotency-Key': headers['Idempotency-Key'],
                /* etagPath 를 준 회차라 여기 도달했으면 훅이 토큰을 이미 확보했다. */
                'If-Match': headers['If-Match'] ?? '',
              },
            },
            body: toUpdateBody(variables),
          }),
    etagPath: editingResultId === null ? null : roundPath(editingResultId),
    invalidateKeys: [
      iqcInspectionKeys.rounds(inspectionRequestId ?? 0),
      iqcInspectionKeys.round(editingResultId ?? 0),
      ALL_KEY,
    ],
    knownFields: SAVE_FIELDS,
    onSuccess: onSaved,
  });
};

/** 이 화면이 소유한 입력칸 — 서버 필드 오류를 인라인으로 낼지 배너로 올릴지 가르는 기준이다. */
export const SAVE_FIELDS = ['acceptedQty', 'rejectedQty', 'heldQty'] as const;

const toCreateBody = (v: SaveDraftVariables): InspectionResultCreate => ({
  inspectionRequestId: v.inspectionRequestId,
  inspectedQty: v.inspectedQty,
  acceptedQty: v.acceptedQty,
  rejectedQty: v.rejectedQty,
  heldQty: v.heldQty,
  uomId: v.uomId,
  inspectedAt: v.inspectedAt,
  statusCode: DRAFT_STATUS,
});

const toUpdateBody = (v: SaveDraftVariables): InspectionResultUpdate => ({
  acceptedQty: v.acceptedQty,
  rejectedQty: v.rejectedQty,
  heldQty: v.heldQty,
  inspectedAt: v.inspectedAt,
});
