import type { components } from '@omf-mes/api-client';

import { defectsFromMeasured, numberOf, type PartsIqcForm } from './form-state';
import { judgeDimension, kindOf, type ItemJudgment, type JudgmentInput } from './judgment';
import { isManualDimension } from './measurement-table';

type ItemSpec = components['schemas']['InspectionItemSpec'];
type MeasurementInput = components['schemas']['InspectionMeasurementInput'];

/**
 * IQC 결과 양식(`inspection-detail.tsx`)과 출하 OQC 결과 서랍(`oqc-inspection/shipment-result-drawer.tsx`)이 함께 쓰는 셈 —
 * 저장된 측정치 되살리기 · 자동 판정 입력 · 보낼 측정치(omf-all-around#356). 두 화면이 다른 몫은 인자로 받는다.
 */

/** 저장된 측정치 한 줄 — 되살릴 때 보는 값만. */
export interface MeasuredRow {
  inspectionItemSpecId: number;
  sampleNo: number;
  numericValue?: number | null;
  booleanValue?: boolean | null;
  textValue?: string | null;
  judgmentCode?: string | null;
}

/** 양식의 두 갈래 항목 — 치수 측정 · 기타 검사 항목. */
export interface FormItems {
  dimensions: readonly ItemSpec[];
  checkItems: readonly ItemSpec[];
}

export interface RestoreOptions {
  /** AQL 기준 — 기타 항목의 불량 시료 줄 수를 찾은 불량 수로 되살린다(IQC · omf-all-around#264). */
  aqlDefects: boolean;
  /**
   * 한 항목에 줄이 여럿이면 불합격 줄이 하나라도 있으면 NG, 적은 글은 처음 것을 둔다(출하 OQC).
   * 끄면 뒤 줄이 앞 줄을 덮는다(IQC 종전 그대로).
   */
  keepRejected: boolean;
}

/**
 * 저장된 측정치를 양식 값으로 되살린다 — 수치는 시료 칸(자동 판정이 꺼진 항목은 고른 판정도), 그 밖은 OK/NG · 적은 글.
 * 받은 양식을 고쳐 그대로 돌려준다.
 */
export const restoreMeasured = (
  form: PartsIqcForm,
  specs: readonly ItemSpec[],
  measured: readonly MeasuredRow[],
  { aqlDefects, keepRejected }: RestoreOptions,
): PartsIqcForm => {
  const settle = (id: number, judgment: ItemJudgment): void => {
    if (judgment === null || (keepRejected && form.checks[id] === 'REJECTED')) return;
    form.checks[id] = judgment;
  };
  for (const m of measured) {
    const spec = specs.find((each) => each.inspectionItemSpecId === m.inspectionItemSpecId);
    if (spec === undefined) continue;
    const id = spec.inspectionItemSpecId;
    const picked: ItemJudgment =
      m.judgmentCode === 'ACCEPTED' || m.judgmentCode === 'REJECTED' ? m.judgmentCode : null;
    if (kindOf(spec) === 'dimension') {
      if (m.numericValue == null) continue;
      const row = [...(form.values[id] ?? [])];
      row[m.sampleNo - 1] = String(m.numericValue);
      form.values[id] = row;
      if (isManualDimension(spec)) settle(id, picked);
      continue;
    }
    /* 텍스트 항목은 적은 글과 판정으로 남는다(#247). */
    if (m.textValue != null && (!keepRejected || (form.texts[id] ?? '') === ''))
      form.texts[id] = m.textValue;
    settle(id, m.booleanValue != null ? (m.booleanValue ? 'ACCEPTED' : 'REJECTED') : picked);
    /* AQL 은 찾은 불량 수만큼 불량 시료 줄로 남는다 — 줄 수가 불량 수다(omf-all-around#264). */
    const defects = aqlDefects ? defectsFromMeasured(measured, id) : undefined;
    if (defects !== undefined) form.defects[id] = defects;
  }
  return form;
};

/**
 * 자동 판정 입력 — 치수 항목은 시료 값으로 판정하고(자동 판정이 꺼진 항목은 고른 OK/NG · NG 면 불량 1), 기타 항목은 고른 판정.
 * 검사 수량 · AQL 몫은 화면이 정한다.
 */
export const judgmentInputOf = (
  form: PartsIqcForm,
  { dimensions, checkItems }: FormItems,
  versionAcceptance: number | null,
  rest: Pick<JudgmentInput, 'inspectedQty' | 'checkDefects' | 'aqlAcceptance'>,
): JudgmentInput => ({
  inspectedQty: rest.inspectedQty,
  dimensions: dimensions.map((item) => {
    if (isManualDimension(item)) {
      const picked = form.checks[item.inspectionItemSpecId] ?? null;
      return { judgment: picked, outCount: picked === 'REJECTED' ? 1 : 0 };
    }
    return judgeDimension(
      Array.from({ length: item.measurementCount }, (_, i) =>
        numberOf(form.values[item.inspectionItemSpecId]?.[i]),
      ),
      item,
      versionAcceptance,
    );
  }),
  checks: checkItems.map((item): ItemJudgment => form.checks[item.inspectionItemSpecId] ?? null),
  checkDefects: rest.checkDefects,
  /* 필수 항목만 다 적으면 자동 판정 · 종합 판정이 채워진다(#247 · 사용자 지시 2026-11-10). */
  requiredDimensions: dimensions.map((item) => item.requiredFlag),
  requiredChecks: checkItems.map((item) => item.requiredFlag),
  aqlAcceptance: rest.aqlAcceptance,
});

/**
 * 보낼 측정치 — 수치는 값을 적은 시료마다(자동 판정이 꺼진 항목은 고른 판정을 시료마다), 기타 항목은 판정한 항목마다
 * `checkRows` 줄(기본 한 줄 · IQC AQL 은 찾은 불량 수만큼). 텍스트 항목은 첫 줄에 적은 글을 싣는다 — 글이 없으면 판정만.
 */
export const measurementsOf = (
  form: PartsIqcForm,
  { dimensions, checkItems }: FormItems,
  measuredAt: string,
  checkRows: (item: ItemSpec, judgment: 'ACCEPTED' | 'REJECTED') => number = () => 1,
): MeasurementInput[] => {
  const out: MeasurementInput[] = [];
  dimensions.forEach((item) => {
    const picked = isManualDimension(item)
      ? (form.checks[item.inspectionItemSpecId] ?? null)
      : null;
    for (let i = 0; i < item.measurementCount; i += 1) {
      const value = numberOf(form.values[item.inspectionItemSpecId]?.[i]);
      if (value === null) continue;
      const lower = item.lowerLimit ?? -Infinity;
      const upper = item.upperLimit ?? Infinity;
      out.push({
        inspectionItemSpecId: item.inspectionItemSpecId,
        sampleNo: i + 1,
        numericValue: value,
        judgmentCode: picked ?? (value < lower || value > upper ? 'REJECTED' : 'ACCEPTED'),
        measuredAt,
      });
    }
  });
  checkItems.forEach((item) => {
    const judgment = form.checks[item.inspectionItemSpecId];
    if (judgment == null) return;
    const rows = checkRows(item, judgment);
    for (let sampleNo = 1; sampleNo <= rows; sampleNo += 1) {
      if (item.dataTypeCode !== 'TEXT') {
        out.push({
          inspectionItemSpecId: item.inspectionItemSpecId,
          sampleNo,
          booleanValue: judgment === 'ACCEPTED',
          judgmentCode: judgment,
          measuredAt,
        });
        continue;
      }
      const text = sampleNo === 1 ? (form.texts[item.inspectionItemSpecId] ?? '').trim() : '';
      out.push({
        inspectionItemSpecId: item.inspectionItemSpecId,
        sampleNo,
        ...(text === '' ? {} : { textValue: text }),
        judgmentCode: judgment,
        measuredAt,
      });
    }
  });
  return out;
};
