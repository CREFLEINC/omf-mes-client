import type { ApiClient, components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { CodeValueResponse } from './code-options';
import type { CoverageDraft } from './coverage';
import type { InspectionMeasurementInput } from './measurement-draft';
import { toCoverageBody } from './coverage';
import type { InspectionItemSpecResponse, InspectionMeasurementResponse } from './measurement-rows';
import { toInspectionRequestDetail, type InspectionRequestDetail } from './types';

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
    queryKey: pqcInspectionKeys.detail(inspectionRequestId ?? 0),
    queryFn: () => fetchDetail(client, inspectionRequestId as number),
    enabled: inspectionRequestId !== null,
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

type InspectionResultCreate = components['schemas']['InspectionResultCreate'];
type InspectionResultResponse = components['schemas']['InspectionResult'];

/**
 * 검사 결과가 보내는 값.
 *
 * ⛔ **검사자와 단말을 보내지 않는다.** 검사자는 사번 귀속 헤더에서 서버가 풀고, 단말은
 * 요청을 인증한 것이 단말 토큰이라 서버가 이미 안다(§4-B).
 *
 * ⛔ **불합격 처분을 보내지 않는다.** 잠정이고 확정은 다른 화면이 한다(§5-8) — 저장하면
 * 정본을 다툰다.
 */
export interface SaveResultVariables {
  inspectionRequestId: number;
  inspectedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  heldQty: number;
  uomId: number;
  overallJudgmentCode: string;
  /** 검사한 시각. **호출부가 준다** — 이 파일이 실행 환경의 시각을 스스로 읽지 않는다 */
  inspectedAt: string;
  /** 이 검사가 대표하는 생산 구간(§5-5). 빈 칸은 키 자체가 실리지 않는다 */
  coverage: CoverageDraft;
  /** 자유 입력. **검사 기준이 없는 갈래**가 쓰는 자리다(§5-2) */
  remarks: string;
  /** 항목별 측정치. ⛔ 자체 쓰기 경로가 없다 — 결과 저장에 함께 실린다(§4-C) */
  measurements: InspectionMeasurementInput[];
  /** `작성중`(임시 저장) 또는 `확정`(검사 확정) */
  statusCode: InspectionResultCreate['statusCode'];
}

/** 계약이 못박은 두 값. 임시 저장과 검사 확정이 **같은 경로**를 쓰고 이 값으로 갈린다. */
export const RESULT_STATUS: {
  draft: InspectionResultCreate['statusCode'];
  confirmed: InspectionResultCreate['statusCode'];
} = {
  draft: '작성중',
  confirmed: '확정',
};

/**
 * 검사 결과 저장의 **본문을 만든다** — 임시 저장과 검사 확정이 한 경로이고(요구서 §3-7)
 * 상태값으로 갈린다.
 *
 * ⛔ **여기서 보내지 않는다.** 스펙 §5-7 이 이 화면을 오프라인 대상으로 못박았으므로 보내는
 * 일은 outbox 가 맡는다(`outbox.ts` · 공유계약 C-1) — 통신을 기다리지 않고 담는 순간
 * 성공이며, 멱등 키는 항목에 붙어 새로고침을 넘긴다.
 *
 * ⛔ **고치는 경로도 확정 전용 경로도 부르지 않는다.** 이 화면이 부르는 경로는 셋뿐이고
 * (진입·항목 목록·결과 저장) 저장은 언제나 새로 만든다.
 */
export const toResultBody = (v: SaveResultVariables): InspectionResultCreate => toCreateBody(v);

/** 이 화면이 소유한 입력칸 — 서버 필드 오류를 인라인으로 낼지 배너로 올릴지 가르는 기준이다. */
export const SAVE_FIELDS = ['acceptedQty', 'rejectedQty', 'heldQty'] as const;

/**
 * 아직 고르지 않은 판정은 **키 자체를 싣지 않는다** — 빈 문자열은 코드가 아니고, 보내면
 * 서버가 모르는 값을 받는다.
 */
const judgmentOf = (code: string): { overallJudgmentCode?: string } =>
  code === '' ? {} : { overallJudgmentCode: code };

/** 빈 자유 입력은 **키 자체를 싣지 않는다** — 빈 문자열을 보내면 「비우라」로 읽힐 수 있다. */
const remarksOf = (remarks: string): { remarks?: string } =>
  remarks.trim() === '' ? {} : { remarks: remarks.trim() };

/**
 * 잰 것이 없으면 **키 자체를 싣지 않는다** — 빈 배열을 보내면 서버가 「측정치를 전부
 * 지워라」로 읽을 수 있다. 검사 기준이 없는 갈래가 이 자리다.
 */
const measurementsOf = (
  measurements: InspectionMeasurementInput[],
): { measurements?: InspectionMeasurementInput[] } =>
  measurements.length === 0 ? {} : { measurements };

const toCreateBody = (v: SaveResultVariables): InspectionResultCreate => ({
  inspectionRequestId: v.inspectionRequestId,
  inspectedQty: v.inspectedQty,
  acceptedQty: v.acceptedQty,
  rejectedQty: v.rejectedQty,
  heldQty: v.heldQty,
  uomId: v.uomId,
  inspectedAt: v.inspectedAt,
  statusCode: v.statusCode,
  ...judgmentOf(v.overallJudgmentCode),
  ...toCoverageBody(v.coverage),
  ...remarksOf(v.remarks),
  ...measurementsOf(v.measurements),
});
