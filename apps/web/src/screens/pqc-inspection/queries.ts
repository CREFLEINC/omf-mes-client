import type { ApiClient, components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult, type WriteHeaders } from '../../patterns/master';
import { runRequest, type ApiCallResult } from '../../patterns/request';
import type { CodeValueResponse } from './code-options';
import type { CoverageDraft } from './coverage';
import type { InspectionMeasurementInput } from './measurement-draft';
import { toCoverageBody } from './coverage';
import type { InspectionItemSpecResponse, InspectionMeasurementResponse } from './measurement-rows';
import {
  toInspectionRequestDetail,
  toInspectionResultRound,
  type InspectionRequestDetail,
  type InspectionResultRound,
} from './types';

/**
 * P-02-13 이 부르는 요청들.
 *
 * **참조 조회를 두지 않는다.** 품목·LOT·작업지시는 번호로만 그린다 — 이름 목록을 얹으면 그
 * 조회의 좁힘·잘림·실패 규칙이 이 표에 함께 따라오고, 대기 큐가 그것 때문에 비어 보일 수 있다.
 *
 * **오프라인은 이 파일이 다루지 않는다.** 계약이 「오프라인일 때는 셸의 outbox 가 들고 있다가
 * 연결되면 보낸다 · 미확정 표식은 셸이 붙인다」로 셸 소관을 못박았고, 이 저장소도
 * `networkMode: 'always'` 로 「닿는지는 보내 봐야 안다」를 이미 정했다. 화면이 지는 의무는
 * **멱등 키를 싣는 것**과 되돌릴 수 없는 쓰기의 **키 수명**뿐이다(공유계약 C-1·C-7·C-9).
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch` 가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type Client = ApiClient['client'];

/** 한 의뢰의 회차 수는 작다 — 재검사가 이만큼 쌓이면 자료가 이상한 것이다. */
const ROUNDS_PAGE_SIZE = 100;

/** 한 회차의 측정치 수 상한. 항목 × 샘플이라 커질 수 있으나 한 화면이 담을 범위다. */
const MEASUREMENTS_PAGE_SIZE = 500;

/** 한 코드 그룹의 값 수. 판정은 셋이고 다른 그룹도 이 자릿수를 넘지 않는다. */
const CODE_VALUES_PAGE_SIZE = 200;

const ALL_KEY = ['pqc-inspection'] as const;

export const pqcInspectionKeys = {
  all: ALL_KEY,
  /** 고른 의뢰의 상세. **목록과 앞머리를 갈라 둔다** — 저장 뒤 한쪽만 갱신할 수 있게. */
  detail: (inspectionRequestId: number) => [...ALL_KEY, 'detail', inspectionRequestId] as const,
  /** 공통코드 값 목록. **그룹 이름이 곧 열쇠다** — 화면이 정수 id 를 알지 않는다. */
  codeValues: (codeGroupCode: string) => [...ALL_KEY, 'code-values', codeGroupCode] as const,
  /** 검사기준 버전의 항목 규격. 마스터라 저장이 바꾸지 않으므로 갈라 둔다. */
  itemSpecs: (inspectionPlanVersionId: number) =>
    [...ALL_KEY, 'item-specs', inspectionPlanVersionId] as const,
  /** 그 회차의 측정치. 회차 저장이 바꾸므로 저장 뒤 무효화 대상이다. */
  measurements: (inspectionResultId: number) =>
    [...ALL_KEY, 'measurements', inspectionResultId] as const,
  /** 그 의뢰의 회차 목록. 상세와도 갈라 둔다 — 저장이 바꾸는 것은 회차이지 의뢰가 아니다. */
  rounds: (inspectionRequestId: number) => [...ALL_KEY, 'rounds', inspectionRequestId] as const,
  /** 회차 한 건. **목록과 갈라 두는 이유가 내용이 아니라 잠금 토큰이다** — 아래 훅 주석 참조. */
  round: (inspectionResultId: number) => [...ALL_KEY, 'round', inspectionResultId] as const,
};

/** 회차 한 건의 경로. 잠금 토큰이 이 경로를 열쇠로 보관되므로 **한 자리에서만 만든다.** */
export const roundPath = (inspectionResultId: number): string =>
  `/quality/inspection-results/${inspectionResultId}`;

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
    queryKey: pqcInspectionKeys.detail(inspectionRequestId ?? 0),
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
 * ⛔ **기간을 보내지 않는다.** 계약이 기간을 **조건부 필수**로 두었는데 그 조건이
 * 「의뢰 없이 전 이력을 훑을 때」다. 한 의뢰의 회차를 읽는 이 경로에 기간을 실으면
 * **화면이 없는 기간을 지어내게 된다.**
 *
 * ⭐ **쪽을 넘기지 않는다.** 한 의뢰의 재검사 회차가 한 쪽을 넘길 일이 없다. 넘긴다면 그것은
 * 자료가 이상한 것이므로 쪽 이동을 만들어 감추지 않는다.
 */
export const useInspectionRounds = (
  inspectionRequestId: number | null,
): UseQueryResult<InspectionResultRound[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: pqcInspectionKeys.rounds(inspectionRequestId ?? 0),
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
 * 목록이 같은 내용을 이미 주는데도 이 조회를 따로 두는 이유는 **목록 200 에 `ETag` 가 없기
 * 때문**이다. 그리고 토큰 보관소가 **응답이 온 URL 경로**를 열쇠로 쓰므로, 목록 경로로 꺼내면
 * 언제나 비어 있다.
 *
 * ⛔ 토큰이 없으면 `If-Match` 를 채울 수 없고, 빈 `If-Match` 는 계약 위반이라 서버가 400 으로
 * 되돌린다. 그래서 **고칠 회차가 있을 때만** 부른다.
 */
export const useInspectionRoundLock = (
  inspectionResultId: number | null,
): UseQueryResult<InspectionResultRound> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: pqcInspectionKeys.round(inspectionResultId ?? 0),
    queryFn: () => fetchRound(client, inspectionResultId as number),
    enabled: inspectionResultId !== null,
  });
};

const fetchItemSpecs = (
  client: Client,
  inspectionPlanVersionId: number,
): Promise<InspectionItemSpecResponse[]> =>
  runRequest(() =>
    client.GET('/quality/inspection-plan-versions/{inspectionPlanVersionId}/items', {
      params: { path: { inspectionPlanVersionId } },
    }),
  ).then((response) => response.items);

/**
 * 검사기준 버전의 항목 규격을 부른다 — **그리드의 줄 수를 정하는 것이 이 목록이다.**
 *
 * ⚠ **검사 시점에 고정된 버전으로 부른다.** 의뢰가 준 `inspectionPlanVersionId` 를 그대로
 * 쓰고 「최신 기준」을 따로 찾지 않는다 — 이후 기준이 바뀌어도 이 검사는 당시 버전으로
 * 남는다. 최신을 부르면 검사자가 재지 않은 항목이 그리드에 나타난다.
 */
export const useInspectionItemSpecs = (
  inspectionPlanVersionId: number | null,
): UseQueryResult<InspectionItemSpecResponse[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: pqcInspectionKeys.itemSpecs(inspectionPlanVersionId ?? 0),
    queryFn: () => fetchItemSpecs(client, inspectionPlanVersionId as number),
    enabled: inspectionPlanVersionId !== null,
  });
};

const fetchMeasurements = (
  client: Client,
  inspectionResultId: number,
): Promise<InspectionMeasurementResponse[]> =>
  runRequest(() =>
    client.GET('/quality/inspection-results/{inspectionResultId}/measurements', {
      params: { path: { inspectionResultId }, query: { page: 1, size: MEASUREMENTS_PAGE_SIZE } },
    }),
  ).then((response) => response.items);

/**
 * 그 회차에 저장된 측정치를 부른다.
 *
 * ⚠ **검사 목록에 붙여 오지 않는다.** 의뢰·결과에 견줘 측정치는 자릿수가 커서 한 표에 담으면
 * 표가 터진다. 「한 화면」이지 「한 표」가 아니다(공유계약 L-1).
 */
export const useMeasurements = (
  inspectionResultId: number | null,
): UseQueryResult<InspectionMeasurementResponse[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: pqcInspectionKeys.measurements(inspectionResultId ?? 0),
    queryFn: () => fetchMeasurements(client, inspectionResultId as number),
    enabled: inspectionResultId !== null,
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
 * ⛔ `codeGroupId` 정수를 코드에 박지 않는다: **환경마다 다르다.**
 *
 * ⛔ **목록이 비어도 화면을 감추지 않는다**(공유계약 G-2). 시드가 아직 안 들어가 빌 수 있고,
 * 그때는 비활성 + 사유로 둔다 — 감추면 그 자리가 왜 없는지 사용자가 알 수 없다.
 */
export const useCodeValues = (codeGroupCode: string): UseQueryResult<CodeValueResponse[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: pqcInspectionKeys.codeValues(codeGroupCode),
    queryFn: () => fetchCodeValues(client, codeGroupCode),
  });
};

type InspectionResultConfirm = components['schemas']['InspectionResultConfirm'];
type InspectionResultCreate = components['schemas']['InspectionResultCreate'];
type InspectionResultUpdate = components['schemas']['InspectionResultUpdate'];
type InspectionResultResponse = components['schemas']['InspectionResult'];

/**
 * 임시 저장이 보내는 값.
 *
 * ⛔ **검사자와 단말을 보내지 않는다.** 검사자는 사번 귀속 헤더에서 서버가 풀고, 단말은
 * 요청을 인증한 것이 단말 토큰이라 서버가 이미 안다(스펙 §4-B). 화면이 세션 값을 실으면
 * 품질 감사 기록에 엉뚱한 사람이 남는다.
 *
 * ⛔ **불합격 처분을 보내지 않는다.** 잠정 선택이고 확정은 불량창고 입고 후 다른 화면이
 * 한다(REQ-PR-0025 · `disposition.ts`).
 */
export interface SaveDraftVariables {
  inspectionRequestId: number;
  inspectedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  heldQty: number;
  uomId: number;
  /**
   * 고른 종합 판정. **임시 저장도 함께 싣는다** — 계약이 「작성중」에는 선택으로 받는다.
   *
   * ⛔ 싣지 않으면 저장 뒤 회차를 다시 부를 때 서버가 «저장 전» 판정을 돌려주고, 초안
   * 되돌림이 사용자가 고른 값을 그것으로 덮는다. 그러고 확정을 누르면 **고른 것과 다른
   * 판정이 나가는데 그 쓰기는 되돌릴 수 없다.**
   */
  overallJudgmentCode: string;
  /** 검사한 시각. **호출부가 준다** — 이 파일이 실행 환경의 시각을 스스로 읽지 않는다 */
  inspectedAt: string;
  /** 이 검사가 대표하는 생산 구간(§5-5). 빈 칸은 키 자체가 실리지 않는다 */
  coverage: CoverageDraft;
  /**
   * 항목별 측정치. ⛔ **자체 쓰기 경로가 없다** — 계약이 「검사 결과 저장에 함께 실린다」고
   * 못박았다. 판정하지 않은 줄은 부르는 쪽이 이미 걸러 낸다.
   */
  measurements: InspectionMeasurementInput[];
  /**
   * 재검사면 **앞 회차**. 아니면 `null`.
   *
   * ⭐ 회차 번호는 **서버가 +1 한다** — 화면이 세면 두 사람이 동시에 재검사를 열었을 때 같은
   * 번호를 만들고, 그 표에는 `UNIQUE(의뢰, 회차)` 가 걸려 있다.
   *
   * ⛔ **갱신에는 싣지 않는다** — 사슬은 회차가 만들어질 때 정해지는 값이다.
   */
  previousResultId: number | null;
}

/** 계약이 못박은 두 값 중 임시 저장이 쓰는 쪽. */
const DRAFT_STATUS = '작성중';

/**
 * 검사 결과를 임시 저장한다 — **고칠 회차가 있으면 고치고, 없으면 만든다.**
 *
 * ⭐ **임시 저장은 판정을 확정하지 않는다.** LOT 상태를 옮기는 것은 확정뿐이다. 다만 서버는
 * **첫 임시 저장을 「검사 시작」으로 읽어** 의뢰 상태를 진행으로 옮긴다 — 그래서
 * ⛔ **「검사 시작」 단추를 만들지 않는다**(스펙 §3 에도 없다).
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
    invalidateKeys:
      editingResultId === null
        ? [pqcInspectionKeys.rounds(inspectionRequestId ?? 0), ALL_KEY]
        : [
            pqcInspectionKeys.rounds(inspectionRequestId ?? 0),
            pqcInspectionKeys.round(editingResultId),
            ALL_KEY,
          ],
    knownFields: SAVE_FIELDS,
    onSuccess: onSaved,
  });
};

/** 이 화면이 소유한 입력칸 — 서버 필드 오류를 인라인으로 낼지 배너로 올릴지 가르는 기준이다. */
export const SAVE_FIELDS = ['acceptedQty', 'rejectedQty', 'heldQty'] as const;

/**
 * 아직 고르지 않은 판정은 **키 자체를 싣지 않는다** — 빈 문자열은 코드가 아니고, 보내면
 * 서버가 모르는 값을 받는다.
 */
const judgmentOf = (code: string): { overallJudgmentCode?: string } =>
  code === '' ? {} : { overallJudgmentCode: code };

/**
 * 재검사면 앞 회차를 가리킨다. 아니면 **키 자체를 싣지 않는다** — `null` 을 실으면 계약이
 * 정수를 기대하는 자리에 빈 값이 가고, 서버가 그것을 「사슬을 끊어라」로 읽을 수 있다.
 *
 * ⛔ **재검사 사유는 아직 싣지 않는다.** 계약이 선택으로 받지만 사유 코드의 값 목록이
 * 정해지지 않았다 — 규칙으로 지어내면 서버가 모르는 값을 받는다.
 */
const previousOf = (previousResultId: number | null): { previousResultId?: number } =>
  previousResultId === null ? {} : { previousResultId };

/**
 * 잰 것이 없으면 **키 자체를 싣지 않는다** — 빈 배열을 보내면 서버가 그것을 「측정치를
 * 전부 지워라」로 읽을 수 있다. 아직 아무것도 재지 않은 상태와 지우려는 뜻은 다르다.
 */
const measurementsOf = (
  measurements: InspectionMeasurementInput[],
): { measurements?: InspectionMeasurementInput[] } =>
  measurements.length === 0 ? {} : { measurements };

const toCreateBody = (v: SaveDraftVariables): InspectionResultCreate => ({
  inspectionRequestId: v.inspectionRequestId,
  inspectedQty: v.inspectedQty,
  acceptedQty: v.acceptedQty,
  rejectedQty: v.rejectedQty,
  heldQty: v.heldQty,
  uomId: v.uomId,
  inspectedAt: v.inspectedAt,
  statusCode: DRAFT_STATUS,
  ...judgmentOf(v.overallJudgmentCode),
  ...previousOf(v.previousResultId),
  ...toCoverageBody(v.coverage),
  ...measurementsOf(v.measurements),
});

const toUpdateBody = (v: SaveDraftVariables): InspectionResultUpdate => ({
  acceptedQty: v.acceptedQty,
  rejectedQty: v.rejectedQty,
  heldQty: v.heldQty,
  inspectedAt: v.inspectedAt,
  ...judgmentOf(v.overallJudgmentCode),
  ...toCoverageBody(v.coverage),
  ...measurementsOf(v.measurements),
});

/** 확정이 보내는 값. ⛔ 처분·비고를 싣지 않는다 — 스펙 §4-B 가 싣지 않은 칸이다. */
export interface ConfirmVariables {
  overallJudgmentCode: string;
}

/**
 * 검사를 확정한다 — ⛔ **되돌릴 수 없는 쓰기다.**
 *
 * ⭐ **이 순간 Lot Status 가 전이한다** — 합격이면 정상, 불합격이면 불량, 보류면 검사 대기다.
 * 계약이 독립된 상태 전이 경로를 두지 않았다(결정 10 「상태 이중 보유 없음」). **두 번
 * 실행되면 되돌릴 수 없다.**
 *
 * ⭐ 그래서 멱등 키 수명을 **`until-applied`** 로 고른다 — 통신이 끊기거나 5xx 가 온 뒤 다시
 * 눌러도 서버가 그것을 다른 쓰기로 보지 않는다. 오프라인 큐가 같은 요청을 늦게 보낼 수 있는
 * 이 화면에서는 그 성질이 특히 중요하다.
 *
 * ⛔ 합계가 맞지 않으면 서버가 400 이다(`ck_inspection_result_qty` · 공유계약 A-3). 화면이
 * 먼저 막되 서버 판정을 신뢰한다 — 화면의 막음은 편의이고 정본은 서버다.
 */
export const useConfirmResult = (
  inspectionRequestId: number | null,
  inspectionResultId: number | null,
  onConfirmed: () => void,
): MasterWriteResult<ConfirmVariables> => {
  const { client } = useApiClient();

  return useMasterWrite<ConfirmVariables, InspectionResultResponse>({
    request: (variables, headers: WriteHeaders): Promise<ApiCallResult<InspectionResultResponse>> =>
      client.POST('/quality/inspection-results/{inspectionResultId}:confirm', {
        params: {
          path: { inspectionResultId: inspectionResultId as number },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body: {
          overallJudgmentCode: variables.overallJudgmentCode,
        } satisfies InspectionResultConfirm,
      }),
    etagPath: inspectionResultId === null ? null : roundPath(inspectionResultId),
    invalidateKeys: [pqcInspectionKeys.rounds(inspectionRequestId ?? 0), ALL_KEY],
    knownFields: CONFIRM_FIELDS,
    /* 되돌릴 수 없는 쓰기다 — 실패 뒤 다시 눌러도 서버가 두 번 실행하지 않게 키를 유지한다. */
    keyLifetime: 'until-applied',
    onSuccess: onConfirmed,
  });
};

/** 확정이 짚어 줄 수 있는 칸. 수량은 임시 저장이 다루므로 여기서는 판정 하나다. */
export const CONFIRM_FIELDS = ['overallJudgmentCode'] as const;
