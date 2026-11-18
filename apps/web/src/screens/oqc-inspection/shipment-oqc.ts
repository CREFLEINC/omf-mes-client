import type {
  ApiError,
  components,
  InspectionLotForward,
  InspectionResultSummaryForward,
} from '@omf-mes/api-client';

import { lotJudgmentsOf } from '../parts-iqc-inspection/lot-judgment';

/**
 * 출하 OQC 새 흐름(피처 010 · omf-all-around#305 · research R-5 · decisions #47) — W-04-03 · P-04-06 이 함께 쓰는 셈.
 *
 * - 대상이 출하 지시서(`SHIPMENT_REQUEST`)이고 LOT 이 없는 OQC 의뢰가 새 흐름이다. 의뢰 = 지시서 × 품목(묶음).
 * - 결과는 IQC W-01-01 처럼 피킹 LOT 을 1개 이상 매칭하고 판정 하나만 남긴다. 수량은 서버가 매칭 LOT 피킹 합으로 채운다.
 * - LOT 판정 = 그 LOT 을 매칭한 결과 중 순번이 가장 큰 결과의 판정. 매칭 결과가 없으면 미검사, 생략된 의뢰면 생략(통과).
 * - 결과는 작성중(DRAFT)으로만 쌓이고 POP 출하 완료(P-04-07) 때 한꺼번에 확정된다 — 확정 단추 · `:confirm` 이 없다.
 *
 * 서버가 정본이다 — 화면 셈은 보이기 위한 것이다.
 */

type InspectionResultCreate = components['schemas']['InspectionResultCreate'];
type InspectionResultUpdate = components['schemas']['InspectionResultUpdate'];
type SerialInput = components['schemas']['InspectionSerialJudgmentInput'];
type LotJudgmentSummary = NonNullable<
  components['schemas']['InspectionRequest']['lotJudgmentSummary']
>;

/** 열린 의뢰 — 결과를 더할 수 있다. */
export const OPEN_STATUSES: readonly string[] = ['REQUESTED', 'IN_PROGRESS'];

export const isShipmentOqc = (request: {
  targetTypeCode: string;
  lotId?: number | null;
}): boolean => request.targetTypeCode === 'SHIPMENT_REQUEST' && (request.lotId ?? null) === null;

/** LOT 판정 배지 — 미검사 · 합격 · 불합격 · 보류 · 생략(통과). */
export type PickedLotJudgment = 'ACCEPTED' | 'REJECTED' | 'HELD' | 'NOT_INSPECTED' | 'SKIPPED';

export interface PickedLotView {
  lot: InspectionLotForward;
  judgmentCode: PickedLotJudgment;
  /** 판정을 낸 결과의 순번 — 미검사 · 생략이면 `null`. */
  appliedSeqNo: number | null;
}

const toJudgment = (code: string | null): PickedLotJudgment =>
  code === 'ACCEPTED' || code === 'REJECTED' || code === 'HELD' ? code : 'NOT_INSPECTED';

/**
 * 피킹 LOT 을 판정 대상(살아 있는 LOT)과 교체된 LOT(이력)으로 가른다(US3-5). 판정은 서버 `lotJudgments` 를 그대로 쓰고,
 * 없으면 결과 목록으로 같은 규칙을 셈한다(`lotJudgmentsOf` — IQC 와 같은 함수).
 */
export const pickedLotViewsOf = (request: {
  statusCode: string;
  lots?: readonly InspectionLotForward[];
  results?: readonly InspectionResultSummaryForward[];
  lotJudgments?: components['schemas']['InspectionRequestLotJudgment'][];
}): { active: PickedLotView[]; replaced: InspectionLotForward[] } => {
  const lots = request.lots ?? [];
  const judgments = lotJudgmentsOf(request);
  const skipped = request.statusCode === 'SKIPPED';

  return {
    active: lots
      .filter((lot) => lot.pickStatusCode !== 'REPLACED')
      .map((lot) => {
        const judgment = judgments.find((each) => each.lotId === lot.lotId) ?? null;
        if (judgment === null || judgment.resultSeqNo === null) {
          return { lot, judgmentCode: skipped ? 'SKIPPED' : 'NOT_INSPECTED', appliedSeqNo: null };
        }
        return {
          lot,
          judgmentCode: toJudgment(judgment.judgmentCode),
          appliedSeqNo: judgment.resultSeqNo,
        };
      }),
    replaced: lots.filter((lot) => lot.pickStatusCode === 'REPLACED'),
  };
};

/** 새 결과를 열 때 미리 고르는 LOT — 아직 미검사인 것만(시안 P0406 C). */
export const defaultMatchOf = (views: readonly PickedLotView[]): number[] =>
  views.filter((view) => view.judgmentCode === 'NOT_INSPECTED').map((view) => view.lot.lotId);

/** LOT 판정 요약 칩 — 출하 완료 관문과 같은 말(가장 나쁜 것 하나와 그 수). */
export type LotOverview =
  | { kind: 'skipped' }
  | { kind: 'none' }
  | { kind: 'rejected'; count: number }
  | { kind: 'held'; count: number }
  | { kind: 'notInspected'; count: number }
  | { kind: 'allAccepted' };

const overviewOfCounts = (
  statusCode: string,
  picked: number,
  summary: LotJudgmentSummary,
): LotOverview => {
  if (statusCode === 'SKIPPED') return { kind: 'skipped' };
  if (picked === 0) return { kind: 'none' };
  if (summary.rejected > 0) return { kind: 'rejected', count: summary.rejected };
  if (summary.held > 0) return { kind: 'held', count: summary.held };
  if (summary.notInspected > 0) return { kind: 'notInspected', count: summary.notInspected };
  return { kind: 'allAccepted' };
};

/** 목록 줄의 요약 — 새 흐름 줄만(서버가 `lotJudgmentSummary` 를 싣는다). 옛 흐름 줄은 `null`. */
export const lotOverviewOf = (row: {
  statusCode: string;
  pickedLotCount?: number;
  lotJudgmentSummary?: LotJudgmentSummary;
}): LotOverview | null => {
  if (row.statusCode === 'SKIPPED' && row.pickedLotCount !== undefined) return { kind: 'skipped' };
  if (row.lotJudgmentSummary === undefined) return null;
  return overviewOfCounts(row.statusCode, row.pickedLotCount ?? 0, row.lotJudgmentSummary);
};

/** 상세의 요약 — 살아 있는 피킹 LOT 판정으로 센다. */
export const overviewOfViews = (
  statusCode: string,
  views: readonly PickedLotView[],
): LotOverview => {
  const count = (code: PickedLotJudgment) =>
    views.filter((view) => view.judgmentCode === code).length;

  return overviewOfCounts(statusCode, views.length, {
    notInspected: count('NOT_INSPECTED'),
    accepted: count('ACCEPTED'),
    rejected: count('REJECTED'),
    held: count('HELD'),
  });
};

/** 칩 색 — 불합격 빨강 · 보류 · 생략 노랑 · 합격 초록 · 미검사 · 없음 회색. */
export const overviewStatus = (overview: LotOverview): 'error' | 'warning' | 'success' | 'idle' =>
  overview.kind === 'rejected'
    ? 'error'
    : overview.kind === 'held' || overview.kind === 'skipped'
      ? 'warning'
      : overview.kind === 'allAccepted'
        ? 'success'
        : 'idle';

export const lotJudgmentStatus = (
  code: PickedLotJudgment,
): 'error' | 'warning' | 'success' | 'idle' =>
  code === 'REJECTED'
    ? 'error'
    : code === 'HELD' || code === 'SKIPPED'
      ? 'warning'
      : code === 'ACCEPTED'
        ? 'success'
        : 'idle';

/**
 * POP 「판정 완료」 탭(2026-11-18 결정) — 열린 의뢰 중 피킹 LOT 이 있고 모두 판정을 가진 것. 미검사가 있거나 피킹 LOT 이 없으면
 * 「판정 대기」다.
 */
export const isJudgedOpen = (row: {
  statusCode: string;
  pickedLotCount?: number;
  lotJudgmentSummary?: LotJudgmentSummary;
}): boolean =>
  OPEN_STATUSES.includes(row.statusCode) &&
  (row.pickedLotCount ?? 0) > 0 &&
  row.lotJudgmentSummary !== undefined &&
  row.lotJudgmentSummary.notInspected === 0;

export interface ShipmentResultInput {
  judgmentCode: string;
  matchedLotIds: readonly number[];
  reinspectionReasonCode: string | null;
}

/**
 * 결과 추가 몸통(US3-4) — 판정 · 매칭 · (재검 사유) · (시리얼)만. 수량 칸은 계약상 필수라 0 으로 채우지만 서버가 무시하고
 * 매칭 LOT 피킹 합으로 다시 채운다. 늘 작성중(DRAFT) — 확정 저장은 409 `CONFIRMED_BY_SHIPMENT_COMPLETION` 이다.
 */
export const toShipmentResultBody = (
  input: ShipmentResultInput & {
    inspectionRequestId: number;
    uomId: number;
    inspectedAt: string;
    serials: readonly SerialInput[];
  },
): InspectionResultCreate => ({
  inspectionRequestId: input.inspectionRequestId,
  inspectedQty: 0,
  acceptedQty: 0,
  rejectedQty: 0,
  heldQty: 0,
  uomId: input.uomId,
  overallJudgmentCode: input.judgmentCode,
  inspectedAt: input.inspectedAt,
  statusCode: 'DRAFT',
  matchedLotIds: [...input.matchedLotIds],
  ...(input.reinspectionReasonCode === null
    ? {}
    : { reinspectionReasonCode: input.reinspectionReasonCode }),
  ...(input.serials.length === 0 ? {} : { serials: [...input.serials] }),
});

/** 결과 고침 몸통 — 작성중만, 매칭 · 판정 · 사유(수량은 서버가 매칭으로 다시 채운다). */
export const toShipmentResultUpdateBody = (input: ShipmentResultInput): InspectionResultUpdate => ({
  overallJudgmentCode: input.judgmentCode,
  matchedLotIds: [...input.matchedLotIds],
  ...(input.reinspectionReasonCode === null
    ? {}
    : { reinspectionReasonCode: input.reinspectionReasonCode }),
});

/** 판정 규칙 · 흐름 오류 코드 — 문구는 화면이 ko · vi 로 낸다. */
export type ShipmentRuleCode =
  'MATCHED_LOT_REQUIRED' | 'REINSPECTION_REASON_REQUIRED' | 'CONFIRMED_BY_SHIPMENT_COMPLETION';

/** 저장 오류에서 판정 규칙 코드를 읽는다 — 400 봉투(`errors[].code`)와 맨 위 `code` 둘 다. */
export const ruleCodeOf = (error: ApiError | null): ShipmentRuleCode | null => {
  if (error === null) return null;
  const codes: (string | undefined)[] =
    error.kind === 'validation'
      ? error.errors.map((item) => item.code)
      : 'code' in error
        ? [error.code as string | undefined]
        : [];
  const known: ShipmentRuleCode[] = [
    'MATCHED_LOT_REQUIRED',
    'REINSPECTION_REASON_REQUIRED',
    'CONFIRMED_BY_SHIPMENT_COMPLETION',
  ];
  return known.find((code) => codes.includes(code)) ?? null;
};
