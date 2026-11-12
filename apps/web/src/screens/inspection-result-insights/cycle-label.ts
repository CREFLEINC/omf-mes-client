import { messages } from '@omf-mes/i18n';

import type { InspectionResult } from './queries';

const t = messages.inspectionResultInsights.overview;

/**
 * 005 D-18 — 입하 LOT IQC 결과의 확정 주기(`confirmCycle`)를 「처음」·「재검 n차」로 옮긴다(계약 §8).
 * 1 → 「처음」, 2 이상 → 「재검 {주기 − 1}차」. 판정 확정 취소 · 재작업 재열기 때 요청의 주기가 1 오르고, 그 뒤 기록한 결과가 재검사다.
 * 값이 없으면(옛 IQC · PQC · OQC) `null` — 그 행은 지금처럼 `previousResultId` 사슬 깊이로 보인다.
 */
export const cycleLabelOf = (result: Pick<InspectionResult, 'confirmCycle'>): string | null => {
  const cycle = result.confirmCycle;
  if (cycle === undefined || cycle === null || !Number.isInteger(cycle) || cycle < 1) return null;
  return cycle === 1 ? t.firstCycle : t.reinspectionCycle(cycle - 1);
};
