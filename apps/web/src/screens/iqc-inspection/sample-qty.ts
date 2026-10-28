/**
 * 검사수량 기본값 — 전수면 의뢰수량, 샘플이면 **샘플 개수 또는 비율(%)로 줄인 개수**다(omf-all-around#102 · #201).
 *
 * 서버의 PQC 검사 수량(`work-order-pqc-request.ts` `inspectionQty`)과 같은 규칙이다 —
 * 올림하고, 아무리 작아도 한 개는 검사한다. 두 검사가 같은 기준 버전을 다르게 읽지 않게 한다.
 *
 * ⛔ `samplingRatio` 는 0~1 비율이 아니라 **백분율**(0 초과 100 이하)이다.
 */
export interface SamplingRule {
  samplingMethodCode: string;
  samplingRatio: number | null;
  /** 샘플 개수 — 비율과 둘 중 하나만 있다(omf-all-around#201). 의뢰수량보다 크면 의뢰수량이다. */
  samplingQty?: number | null;
}

const FULL_INSPECTION = 'FULL_INSPECTION';

export const sampleQtyOf = (targetQty: number, rule: SamplingRule | null): number => {
  if (rule === null || rule.samplingMethodCode === FULL_INSPECTION) return targetQty;
  if (rule.samplingQty != null) return Math.min(targetQty, rule.samplingQty);
  if (rule.samplingRatio === null) return targetQty;
  /* 부동소수 오차(1000 × 0.7 ÷ 100 = 7.000…1)가 올림에서 한 개를 더하지 않게 서버 소수 6자리로 자른다. */
  const sampled = Math.ceil(Number(((targetQty * rule.samplingRatio) / 100).toFixed(6)));

  return Math.min(targetQty, Math.max(1, sampled));
};
