import type { ApiClient, components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult, type WriteHeaders } from '../../patterns/master';
import { runRequest, type ApiCallResult } from '../../patterns/request';
import type { CodeValueResponse } from './code-options';
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
 * 이 화면의 요청 — **조회 넷과 쓰기 하나다.**
 *
 * | 언제 | 무엇 |
 * | --- | --- |
 * | 들어오거나 조건·쪽이 바뀌면 | 검사 대상 목록 |
 * | 의뢰를 고르면 | 그 의뢰의 상세 · 그 의뢰의 회차 목록 |
 * | 들어오면 | 종합 판정 코드값 |
 * | 「판정 저장」 | 검사 결과 확정 저장 |
 *
 * ⭐ **쓰기가 하나다.** 원형(W-01-01)은 임시 저장 → 확정의 2단이지만 이 화면은 1단이다 —
 * 액션표에 임시 저장이 없고(「판정 수정」은 두지 않는다로 명시), 계약이 한 경로로 둘 다 받으며,
 * 관리웹에는 오프라인 갈래가 없다. 그래서 `PUT`·`:confirm`·잠금 토큰 취득 조회가 전부 없다.
 *
 * **참조 조회를 두지 않는다.** 품목·LOT·단위는 번호로만 그린다 — 이름 목록을 얹으면 그 조회의
 * 좁힘·잘림·실패 규칙이 이 화면에 함께 따라오고, 목록·상세가 그것 때문에 비어 보일 수 있다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch` 가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type Client = ApiClient['client'];

const t = messages.oqcInspection;

/** 한 의뢰의 회차 수는 작다 — 재검사가 이만큼 쌓이면 자료가 이상한 것이다. */
const ROUNDS_PAGE_SIZE = 100;

/** 한 코드 그룹의 값 수. 판정은 셋이고 늘어도 이 자릿수를 넘지 않는다. */
const CODE_VALUES_PAGE_SIZE = 200;

/** 409 는 상태 코드로만 갈린다 — 몸통 형태는 계약마다 다르다. */
const CONFLICT = 409;

/**
 * 이 자원의 조회를 덮는 뿌리 키.
 *
 * **앞머리를 넷으로 갈라 둔다** — 저장이 바꾸는 것은 회차이지 코드값이 아니다. 하나로 묶으면
 * 저장할 때마다 코드값까지 다시 부른다.
 */
const ALL_KEY = ['oqc-inspection'] as const;

export const oqcInspectionKeys = {
  all: ALL_KEY,
  /**
   * 조건·쪽이 무엇이든 목록 전부. **저장 뒤 무효화가 이 앞머리를 쓴다** — 어느 조건으로 보고
   * 있었는지 쓰기 쪽이 알 이유가 없고, 알려고 들면 화면의 조건이 배선에 새어 든다.
   */
  queues: () => [...ALL_KEY, 'queue'] as const,
  /** 질의가 곧 열쇠다 — 조건이나 쪽이 다르면 다른 결과이므로 캐시도 갈려야 한다. */
  queue: (query: QueueListQuery) => [...ALL_KEY, 'queue', query] as const,
  detail: (inspectionRequestId: number) => [...ALL_KEY, 'detail', inspectionRequestId] as const,
  /** 그 의뢰의 회차 목록. 저장이 바꾸므로 저장 뒤 무효화 대상이다. */
  rounds: (inspectionRequestId: number) => [...ALL_KEY, 'rounds', inspectionRequestId] as const,
  /** 공통코드 값 목록. **그룹 이름이 곧 열쇠다** — 화면이 정수 id 를 알지 않는다. */
  codeValues: (codeGroupCode: string) => [...ALL_KEY, 'code-values', codeGroupCode] as const,
};

const fetchQueue = (client: Client, query: QueueListQuery): Promise<InspectionQueueResult> =>
  runRequest(() => client.GET('/quality/inspection-requests', { params: { query } })).then(
    toInspectionQueueResult,
  );

/**
 * 검사 대상 목록을 부른다.
 *
 * **늘 부른다 — 이 화면에는 「조회가 성립하지 않는」 상태가 없다.** 계약의 질의값이 전부 선택이라
 * 조건 없이도 목록이 나오고, 그것이 이 화면의 기본 상태(대기·진행 전체)다.
 */
export const useInspectionQueue = (
  query: QueueListQuery,
): UseQueryResult<InspectionQueueResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: oqcInspectionKeys.queue(query),
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

/** 고른 의뢰의 상세를 부른다. **고르기 전에는 부르지 않는다** — 부를 대상이 없다. */
export const useInspectionRequestDetail = (
  inspectionRequestId: number | null,
): UseQueryResult<InspectionRequestDetail> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: oqcInspectionKeys.detail(inspectionRequestId ?? 0),
    queryFn: () => fetchDetail(client, inspectionRequestId as number),
    enabled: inspectionRequestId !== null,
  });
};

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
 * 그 의뢰의 회차를 부른다.
 *
 * ⛔ **기간을 보내지 않는다.** 계약이 기간을 **조건부 필수**로 두었는데, 그 조건이
 * 「`inspectionRequestId` 없이 전 이력을 훑을 때」다. 한 의뢰의 회차를 읽는 이 경로에 기간을
 * 실으면 **화면이 없는 기간을 지어내게 된다** — 계약 설명이 그 자리를 그렇게 못박았다.
 *
 * ⭐ **쪽을 넘기지 않는다.** 한 의뢰의 재검사 회차가 한 쪽을 넘길 일이 없다. 넘긴다면 그것은
 * 이 화면이 다룰 상황이 아니라 자료가 이상한 것이므로, 쪽 이동을 만들어 감추지 않는다.
 */
export const useInspectionRounds = (
  inspectionRequestId: number | null,
): UseQueryResult<InspectionResultRound[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: oqcInspectionKeys.rounds(inspectionRequestId ?? 0),
    queryFn: () => fetchRounds(client, inspectionRequestId as number),
    enabled: inspectionRequestId !== null,
  });
};

const fetchCodeValues = (client: Client, codeGroupCode: string): Promise<CodeValueResponse[]> =>
  runRequest(() =>
    client.GET('/mdm/code-values', {
      params: { query: { codeGroupCode, page: 1, size: CODE_VALUES_PAGE_SIZE } },
    }),
  ).then((response) => response.items);

/**
 * 공통코드 값 목록을 부른다 — **그룹을 이름으로 가리킨다.**
 *
 * ⛔ `codeGroupId` 정수를 코드에 박지 않는다: **환경마다 다르다**(omf-mes#179 회신).
 * 계약이 둘 중 «정확히 하나»만 받으므로 이름만 보낸다.
 *
 * ⛔ **목록이 비어도 선택칸을 감추지 않는다**(공유계약 G-2). 시드가 아직 안 들어가 빌 수 있고,
 * 그때는 비활성 + 사유로 둔다 — 감추면 그 자리가 왜 없는지 사용자가 알 수 없다.
 */
export const useCodeValues = (codeGroupCode: string): UseQueryResult<CodeValueResponse[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: oqcInspectionKeys.codeValues(codeGroupCode),
    queryFn: () => fetchCodeValues(client, codeGroupCode),
  });
};

type InspectionResultCreate = components['schemas']['InspectionResultCreate'];
type InspectionResultResponse = components['schemas']['InspectionResult'];

/**
 * 판정 저장이 보내는 값.
 *
 * ⛔ **검사자와 단말을 보내지 않는다.** 검사자는 로그인한 주체에서 서버가 정하는 값이라 화면이
 * 만들 수 없고, 화면이 세션 값을 실으면 품질 감사 기록에 엉뚱한 사람이 남는다(omf-mes#173).
 * 단말도 같다 — 요청을 인증한 것이 단말이므로 서버가 안다.
 *
 * ⛔ **재검사 사유를 보내지 않는다.** 계약이 선택으로 받지만 대응 코드 그룹이 어디에도 없다 —
 * 지어내면 서버가 모르는 값을 받는다.
 */
export interface SaveResultVariables {
  inspectionRequestId: number;
  inspectedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  heldQty: number;
  uomId: number;
  /**
   * 고른 종합 판정. **`statusCode='확정'` 이면 서버가 필수로 강제한다.**
   *
   * ⛔ 싣지 않으면 저장 뒤 회차를 다시 부를 때 서버가 «저장 전» 판정을 돌려주고, 초안 되돌림이
   * 사용자가 고른 값을 그것으로 덮는다 — 이 화면은 확정이 한 번이라 **덮인 값 그대로 LOT 이
   * 풀린다.**
   */
  overallJudgmentCode: string;
  /**
   * 검사한 시각. **호출부가 준다** — 이 파일이 실행 환경의 시각을 스스로 읽지 않는다.
   *
   * ⚠ 호출부는 **한 번 읽은 값을 재시도에도 그대로 쓴다.** 누를 때마다 다시 읽으면 멱등 키의
   * 지문이 매번 달라져 `until-applied` 수명이 무력해진다(아래 훅 주석).
   */
  inspectedAt: string;
  /**
   * 재검사면 **앞 회차**. 아니면 `null`.
   *
   * ⭐ 회차 번호는 **서버가 +1 한다** — 화면이 세지 않는다. 화면이 세면 두 사람이 동시에
   * 재검사를 열었을 때 같은 번호를 만들고, 그 표에는 `UNIQUE(의뢰, 회차)` 가 걸려 있다.
   */
  previousResultId: number | null;
}

/** 계약이 못박은 두 값 중 이 화면이 쓰는 쪽. **임시 저장을 두지 않는다.** */
const CONFIRMED_STATUS = '확정';

/**
 * 아직 고르지 않은 판정은 **키 자체를 싣지 않는다** — 빈 문자열은 코드가 아니고, 보내면
 * 서버가 모르는 값을 받는다. (확정 저장은 판정 미선택이면 화면이 이미 막지만, 보내는 자리에서도
 * 같은 규율을 지킨다 — 두 자리가 다른 규율을 쓰면 언젠가 갈린다.)
 */
const judgmentOf = (code: string): { overallJudgmentCode?: string } =>
  code === '' ? {} : { overallJudgmentCode: code };

/**
 * 재검사면 앞 회차를 가리킨다. 아니면 **키 자체를 싣지 않는다** — `null` 을 실으면 계약이
 * 정수를 기대하는 자리에 빈 값이 가고, 서버가 그것을 「사슬을 끊어라」로 읽을 수 있다.
 */
const previousOf = (previousResultId: number | null): { previousResultId?: number } =>
  previousResultId === null ? {} : { previousResultId };

/**
 * 보낼 몸통을 만든다. **시험이 직접 부를 수 있게 내보낸다** — 판정 키가 실리는가/빠지는가는
 * 화면을 거치지 않고 봐야 하는 판정이다(고르지 않으면 저장 자체가 막혀 화면으로는 못 만든다).
 */
export const toResultCreateBody = (v: SaveResultVariables): InspectionResultCreate => ({
  inspectionRequestId: v.inspectionRequestId,
  inspectedQty: v.inspectedQty,
  acceptedQty: v.acceptedQty,
  rejectedQty: v.rejectedQty,
  heldQty: v.heldQty,
  uomId: v.uomId,
  inspectedAt: v.inspectedAt,
  statusCode: CONFIRMED_STATUS,
  ...judgmentOf(v.overallJudgmentCode),
  ...previousOf(v.previousResultId),
});

/** 이 화면이 소유한 입력칸 — 서버 필드 오류를 인라인으로 낼지 배너로 올릴지 가르는 기준이다. */
export const SAVE_FIELDS = [
  'acceptedQty',
  'rejectedQty',
  'heldQty',
  'overallJudgmentCode',
  'uomId',
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * 판정을 저장한다 — ⛔ **되돌릴 수 없는 쓰기다.**
 *
 * ⭐ **이 순간 Lot Status 가 전이한다** — 합격이면 풀리고, 불합격이면 묶이고, 보류면 검사 대기다.
 * 계약이 독립된 상태 전이 경로를 두지 않았고(결정 10 · 공유계약 B-8) 보류 해제도 이때 기록된다.
 * **두 번 실행되면 되돌릴 수 없다.**
 *
 * ⭐ 그래서 멱등 키 수명을 **`until-applied`** 로 고른다 — 통신이 끊기거나 5xx 가 온 뒤 다시
 * 눌러도 서버가 그것을 다른 쓰기로 보지 않는다. `per-attempt` 로 두면 재시도가 새 키로 나가
 * 서버가 두 번째 회차를 만들려 하고, `UNIQUE(의뢰, 회차)` 에 걸리거나(운이 좋으면) 회차가 둘
 * 생긴다(운이 나쁘면). 어느 쪽이든 사용자는 「눌렀는데 오류가 났다」만 본다.
 *
 * ⛔ **`If-Match` 를 보내지 않는다.** 계약이 이 경로에서 선택으로 두었고, 이 화면은 회차를
 * 고치지 않으므로 잠글 대상이 없다. 빈 `If-Match` 는 계약 위반이라 서버가 400 으로 되돌린다 —
 * 그래서 `etagPath` 를 `null` 로 둔다(훅이 토큰을 찾지 않는다).
 *
 * ⛔ 합계가 맞지 않으면 서버가 400 이다(`ck_inspection_result_qty` · 공유계약 A-3). 화면이
 * 먼저 막되 서버 판정을 신뢰한다 — 화면의 막음은 편의이고 정본은 서버다.
 */
export const useSaveInspectionResult = (
  inspectionRequestId: number | null,
  onSaved: () => void,
): MasterWriteResult<SaveResultVariables> => {
  const { client } = useApiClient();

  return useMasterWrite<SaveResultVariables, InspectionResultResponse>({
    request: async (
      variables,
      headers: WriteHeaders,
    ): Promise<ApiCallResult<InspectionResultResponse>> => {
      const result = await client.POST('/quality/inspection-results', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body: toResultCreateBody(variables),
      });

      /*
       * ⭐ **raw `error` 를 가로채 구조화 필드로 문구를 되말한다.** 공유 정규화기
       * (`packages/api-client/src/errors.ts`)는 `conflictCause` 가 있어야 `kind:'conflict'` 로
       * 분류하는데, 아래 둘은 그 필드를 싣지 않아 `kind:'http'` 로 떨어지며 서버 `message`
       * 원문만 남는다 — 공유 정규화기를 고치지 않고 여기서만 되말한다(선례:
       * `disposition-decision/screen.tsx` · `suspicious-material-hold/hold-execution.tsx`).
       *
       * ⛔ **`VERSION_CONFLICT` 는 건드리지 않는다.** 그쪽은 `conflictCause` 를 실어 오므로
       * 공유 배너가 원인별(사용자·ERP 동기·작업자 점유) 문구를 이미 정확히 낸다 — 되말하면
       * 그 정확한 안내가 뭉개진다.
       *
       * ⛔ **서버 `message` 원문을 파싱하지 않는다** — 계약이 「구조화 필드가 정본」이라 못박았다.
       */
      if (result.response.status !== CONFLICT || !isRecord(result.error)) return result;

      const raw = result.error as Record<string, unknown>;

      if (raw.code === 'DUPLICATE_KEY') {
        return { ...result, error: { ...raw, message: t.save.duplicateRound } };
      }

      if (raw.code === 'INVALID_STATE') {
        return { ...result, error: { ...raw, message: t.save.invalidState } };
      }

      return result;
    },
    /* ⛔ 잠글 대상이 없다 — 회차를 고치는 경로를 두지 않았고 계약도 헤더를 선택으로 둔다. */
    etagPath: null,
    /*
     * 회차가 바뀌고, 서버가 의뢰 상태를 함께 옮길 수 있어 목록·상세도 함께 무효화한다 —
     * 판정한 의뢰가 「대기·진행만 보기」에서 빠지는지는 서버 판단이라 화면이 미리 정하지 않는다.
     *
     * ⛔ **뿌리 키(`ALL_KEY`)를 쓰지 않는다.** 그것을 쓰면 코드값까지 함께 다시 부르게 되어,
     * 앞머리를 넷으로 가른 이유(마스터는 저장이 바꾸지 않는다)가 코드에서 무효가 된다 —
     * 주석은 갈라 두었다고 말하는데 실제로는 하나로 묶인 상태가 가장 읽기 나쁘다.
     */
    invalidateKeys: [
      oqcInspectionKeys.rounds(inspectionRequestId ?? 0),
      oqcInspectionKeys.detail(inspectionRequestId ?? 0),
      oqcInspectionKeys.queues(),
    ],
    knownFields: SAVE_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess: onSaved,
  });
};
