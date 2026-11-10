import type { components } from '@omf-mes/api-client';

type ItemSpec = components['schemas']['InspectionItemSpec'];

/** 시드 `INSPECTION_MEASUREMENT_JUDGMENT` · `INSPECTION_RESULT_OVERALL_JUDGMENT` */
export const ACCEPTED = 'ACCEPTED';
export const REJECTED = 'REJECTED';
export const HELD = 'HELD';

export type ItemJudgment = 'ACCEPTED' | 'REJECTED' | null;

/**
 * 부품 IQC 성적서의 항목 갈래 — 검사 유형만 본다(#247 · 설계 변경 2026-11-10).
 *   - 치수 측정: 수치 항목 — 시료마다 값(n1~nN)을 받아 규격으로 판정한다.
 *   - 기타 검사 항목: 선택형 · 텍스트 — OK/NG 를 고르고, 텍스트는 글도 적는다.
 * 외관 불량 수 · XRF 결과로 판정하던 갈래는 없앴다.
 */
export type ItemKind = 'dimension' | 'check';

export const kindOf = (item: ItemSpec): ItemKind =>
  item.dataTypeCode === 'NUMERIC' ? 'dimension' : 'check';

/** 값 하나가 규격 안인가. 값이 없으면 `null`. 하한·상한 중 없는 쪽은 보지 않는다. */
export const judgeValue = (
  value: number | null,
  item: Pick<ItemSpec, 'lowerLimit' | 'upperLimit'>,
): ItemJudgment => {
  if (value === null) return null;
  const { lowerLimit, upperLimit } = item;
  if (lowerLimit !== undefined && lowerLimit !== null && value < lowerLimit) return REJECTED;
  if (upperLimit !== undefined && upperLimit !== null && value > upperLimit) return REJECTED;
  return ACCEPTED;
};

/** 항목의 허용 불량 수(c) — 항목에 없으면 버전의 합격판정개수, 그것도 없으면 0 이다. */
export const acceptanceOf = (
  item: Pick<ItemSpec, 'acceptanceNumber'>,
  versionAcceptance: number | null,
): number => item.acceptanceNumber ?? versionAcceptance ?? 0;

/**
 * 치수 항목 하나의 판정 — 시료를 다 재야 낸다. 규격을 벗어난 시료 수가 c 이하이면 합격이다(「n=5c=1」).
 */
export const judgeDimension = (
  values: readonly (number | null)[],
  item: ItemSpec,
  versionAcceptance: number | null,
): { judgment: ItemJudgment; outCount: number } => {
  const judged = values.map((value) => judgeValue(value, item));
  const outCount = judged.filter((j) => j === REJECTED).length;
  if (judged.some((j) => j === null)) return { judgment: null, outCount };
  return {
    judgment: outCount > acceptanceOf(item, versionAcceptance) ? REJECTED : ACCEPTED,
    outCount,
  };
};

export interface JudgmentInput {
  inspectedQty: number | null;
  dimensions: { judgment: ItemJudgment; outCount: number }[];
  checks: ItemJudgment[];
}

/**
 * 불합격 수량 — 불합격 치수 항목의 벗어난 시료 수 + NG 인 기타 항목(항목당 1).
 * 검사 수량을 넘지 않는다(합격 + 불합격 = 검사 수량).
 */
export const rejectedQtyOf = (input: JudgmentInput): number => {
  const dimension = input.dimensions
    .filter((d) => d.judgment === REJECTED)
    .reduce((sum, d) => sum + d.outCount, 0);
  const total = dimension + input.checks.filter((j) => j === REJECTED).length;
  return input.inspectedQty === null ? total : Math.min(total, input.inspectedQty);
};

/**
 * 제안 판정 — 하나라도 NG 면 불합격, 모두 OK 면 합격. 다 적지 않았으면 `null`(제출할 수 없다).
 */
export const suggestedJudgmentOf = (input: JudgmentInput): 'ACCEPTED' | 'REJECTED' | null => {
  if (input.inspectedQty === null || input.inspectedQty <= 0) return null;
  const parts: ItemJudgment[] = [...input.dimensions.map((d) => d.judgment), ...input.checks];
  if (parts.some((p) => p === REJECTED)) return REJECTED;
  if (parts.some((p) => p === null)) return null;
  return ACCEPTED;
};

/**
 * 서버가 기대하는 판정(`inspection-rules.ts` · omf-all-around#125) — 버전의 합격판정개수가 있을 때만 잰다.
 * 고른 판정이 이것과 다르면 서버가 판정 변경 사유를 요구한다.
 */
export const serverExpectedOf = (
  rejectedQty: number,
  versionAcceptance: number | null,
): 'ACCEPTED' | 'REJECTED' | null => {
  if (versionAcceptance === null) return null;
  return rejectedQty > versionAcceptance ? REJECTED : ACCEPTED;
};
