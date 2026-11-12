import type {
  ApiError,
  InspectionLotForward,
  InspectionLotJudgmentForward,
  InspectionResultSummaryForward,
} from '@omf-mes/api-client';

/**
 * 005 판정 규칙(2026-11-12 · FR-021 · FR-023 · FR-023a · 계약 「판정 규칙 변경」) — 화면이 미리 계산하는 몫.
 *
 * - 자재 관리 LOT 마다 그 LOT 을 매칭한 결과 중 **순번이 가장 큰** 결과의 판정이 그 LOT 의 판정이다(확정 차수 · 결과 상태와 상관없음).
 * - 종합 판정은 LOT 별 판정 중 가장 나쁜 것(불합격 > 보류 > 합격) — 서버가 `previewJudgmentCode` 로 준다.
 * - 어떤 LOT 의 판정을 불합격 → 보류 · 합격, 보류 → 합격으로 바꾸는 결과(추가 · 수정)는 재검 사유가 필수다.
 *
 * 서버가 정본이다 — 화면 계산은 드로어가 사유 칸을 미리 보이려는 것이고, 어긋나면 서버 400 `REINSPECTION_REASON_REQUIRED` 를 문구로 보인다.
 */

/** 나쁜 정도 — 불합격 2 · 보류 1 · 합격 0, 그 밖(판정 없음)은 −1. */
export const judgmentRank = (code: string | null | undefined): number =>
  code === 'REJECTED' ? 2 : code === 'HELD' ? 1 : code === 'ACCEPTED' ? 0 : -1;

/** 앞 판정을 더 나은 판정으로 덮는가 — 불합격 → 보류 · 합격, 보류 → 합격. */
export const isOverride = (before: string | null | undefined, after: string | null): boolean =>
  judgmentRank(before) >= 1 && judgmentRank(after) >= 0 && judgmentRank(after) < judgmentRank(before);

/** 재검 사유가 필요한 LOT 하나 — 「LOT 0001: 결과 1 불합격 → 이 결과 합격」. */
export interface OverriddenLot {
  lotId: number;
  /** 덮이는 앞 결과(그 LOT 의 바로 앞 결과). */
  previousSeqNo: number;
  previousJudgmentCode: string;
}

/**
 * 이 결과를 저장하면 재검 사유가 필요한 LOT 들(FR-023a). 각 매칭 LOT 의 **바로 앞 결과**(이 결과를 뺀, 이 결과 순번보다 작은 것 중
 * 가장 큰 순번)의 판정을 이 결과의 판정이 더 낫게 덮으면 그 LOT 이 든다. 판정을 아직 고르지 않았으면 빈 배열.
 */
export const overriddenLotsOf = ({
  results,
  editingResultId,
  seqNo,
  matchedLotIds,
  judgmentCode,
}: {
  results: readonly InspectionResultSummaryForward[];
  /** 고치는 결과 — 새로 더하면 `null`. */
  editingResultId: number | null;
  /** 이 결과의 순번(새로 더하면 다음 순번). */
  seqNo: number;
  matchedLotIds: readonly number[];
  judgmentCode: string | null;
}): OverriddenLot[] => {
  if (judgmentRank(judgmentCode) < 0) return [];

  return matchedLotIds.flatMap((lotId): OverriddenLot[] => {
    const previous = results
      .filter(
        (result) =>
          result.inspectionResultId !== editingResultId &&
          result.seqNo < seqNo &&
          result.matchedLotIds.includes(lotId),
      )
      .reduce<InspectionResultSummaryForward | null>(
        (latest, result) => (latest === null || result.seqNo > latest.seqNo ? result : latest),
        null,
      );

    return previous !== null && isOverride(previous.overallJudgmentCode, judgmentCode)
      ? [
          {
            lotId,
            previousSeqNo: previous.seqNo,
            previousJudgmentCode: previous.overallJudgmentCode ?? '',
          },
        ]
      : [];
  });
};

/**
 * LOT 별 판정 — 서버 `lotJudgments[]` 가 있으면 그대로, 없으면(서버 T134 전) 결과 목록으로 같은 규칙을 계산한다.
 * LOT 표 순서(`lots[]`)를 따르고, 매칭한 결과가 없는 LOT 은 뺀다.
 */
export const lotJudgmentsOf = (inspection: {
  lots?: readonly InspectionLotForward[];
  results?: readonly InspectionResultSummaryForward[];
  lotJudgments?: readonly InspectionLotJudgmentForward[];
}): InspectionLotJudgmentForward[] => {
  const lots = inspection.lots ?? [];
  const results = inspection.results ?? [];
  const order = (lotId: number): number => {
    const index = lots.findIndex((lot) => lot.lotId === lotId);
    return index < 0 ? Number.MAX_SAFE_INTEGER : index;
  };

  if (inspection.lotJudgments !== undefined) {
    return [...inspection.lotJudgments].sort((a, b) => order(a.lotId) - order(b.lotId));
  }

  return lots.flatMap((lot): InspectionLotJudgmentForward[] => {
    const matched = results
      .filter((result) => result.matchedLotIds.includes(lot.lotId))
      .sort((a, b) => a.seqNo - b.seqNo);
    const last = matched.at(-1);
    if (last === undefined) return [];

    return [
      {
        lotId: lot.lotId,
        lotNo: lot.lotNo,
        judgmentCode: last.overallJudgmentCode,
        resultId: last.inspectionResultId,
        resultSeqNo: last.seqNo,
        superseded: matched.slice(0, -1).map((result) => ({
          resultId: result.inspectionResultId,
          resultSeqNo: result.seqNo,
          judgmentCode: result.overallJudgmentCode,
        })),
        reinspectionReasonCode: last.reinspectionReasonCode ?? null,
        reinspectionReasonName: last.reinspectionReasonName ?? null,
      },
    ];
  });
};

/** 판정 규칙의 서버 400 코드(계약 §8 · 2026-11-12). */
export type JudgmentRuleCode = 'MATCHED_LOT_REQUIRED' | 'REINSPECTION_REASON_REQUIRED';

const RULE_CODES: readonly string[] = ['MATCHED_LOT_REQUIRED', 'REINSPECTION_REASON_REQUIRED'];

const isRuleCode = (code: string | undefined): code is JudgmentRuleCode =>
  code !== undefined && RULE_CODES.includes(code);

/**
 * 저장 오류에서 판정 규칙 코드를 떼어 낸다 — 코드는 드로어가 제 문구(ko · vi)로 보이고, 나머지만 저장 오류 띠로 간다.
 * 400 봉투(`errors[].code`)와 맨 위 `code` 둘 다 읽는다.
 */
export const splitRuleErrors = (
  error: ApiError | null,
): { codes: JudgmentRuleCode[]; rest: ApiError | null } => {
  if (error === null) return { codes: [], rest: null };
  if (error.kind === 'http') {
    return isRuleCode(error.code) ? { codes: [error.code], rest: null } : { codes: [], rest: error };
  }
  if (error.kind !== 'validation') return { codes: [], rest: error };

  const codes = [...new Set(error.errors.map((item) => item.code).filter(isRuleCode))];
  const others = error.errors.filter((item) => !isRuleCode(item.code));

  return {
    codes,
    rest: others.length === 0 ? null : { ...error, errors: others },
  };
};
