import type { InspectionSheetJudgment, InspectionSheetStep } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

const t = messages.popInspectionSheet.step;

export type Judgments = Readonly<Record<number, InspectionSheetJudgment>>;

/** 저장된 항목 판정을 입력 시작값으로. */
export const savedJudgments = (step: InspectionSheetStep): Judgments =>
  Object.fromEntries(
    step.items
      .filter((item) => item.judgmentCode !== null)
      .map((item) => [
        item.inspectionSheetTemplateItemId,
        item.judgmentCode as InspectionSheetJudgment,
      ]),
  );

/**
 * 항목이 있는 단계의 1차 판정 — 전수 항목을 모두 판정해야 정해진다(담당자 실검증 2026-10-21 · NG 를 눌러도 남은 전수
 * 항목이 있으면 임시 저장). 정해지면 하나라도 NG(발취 포함)면 NG, 아니면 OK. 항목이 없는 단계는 사람이 고른다(null).
 */
export const firstFromItems = (
  step: InspectionSheetStep,
  judgments: Judgments,
): InspectionSheetJudgment | null => {
  if (step.items.length === 0) return null;
  const full = step.items.filter((item) => item.methodCode === 'FULL');
  if (full.some((item) => judgments[item.inspectionSheetTemplateItemId] === undefined)) return null;
  return step.items.some((item) => judgments[item.inspectionSheetTemplateItemId] === 'NG')
    ? 'NG'
    : 'OK';
};

/** 전수 항목 판정 진행 — 몇 개 중 몇 개를 눌렀나. */
export const fullProgress = (
  step: InspectionSheetStep,
  judgments: Judgments,
): { done: number; total: number } => {
  const full = step.items.filter((item) => item.methodCode === 'FULL');
  return {
    done: full.filter((item) => judgments[item.inspectionSheetTemplateItemId] !== undefined).length,
    total: full.length,
  };
};

/**
 * 저장 방식 — 단계 판정이 정해지면 `final`(단계 저장), 전수 항목이 남았으면 `draft`(항목 판정만 임시 저장).
 * 판정이 이미 기록된 단계는 항목만 따로 저장할 수 없다(서버 400) — 남은 전수 항목을 판정해야 한다.
 */
export type StepSave =
  | { mode: 'final'; first: InspectionSheetJudgment }
  | { mode: 'draft' }
  | { mode: 'blocked'; reason: string };

export const stepSave = (
  step: InspectionSheetStep,
  judgments: Judgments,
  manualFirst: InspectionSheetJudgment | null,
): StepSave => {
  if (step.items.length === 0) {
    return manualFirst === null
      ? { mode: 'blocked', reason: t.blocked.first }
      : { mode: 'final', first: manualFirst };
  }
  const first = firstFromItems(step, judgments);
  if (first !== null) return { mode: 'final', first };
  if (step.result !== null) return { mode: 'blocked', reason: t.blocked.fullItems };
  return { mode: 'draft' };
};

/** 저장값과 입력이 같은가 — 바뀐 것이 없으면 저장 단추를 끈다. */
export const sameJudgments = (a: Judgments, b: Judgments): boolean => {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length && keys.every((key) => a[Number(key)] === b[Number(key)])
  );
};
