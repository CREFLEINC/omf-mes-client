import { describe, expect, it } from 'vitest';

import { appearanceSpec, dimensionSpec, normalMeasurement, optionalSpec } from './fixtures';
import {
  fillAllAccepted,
  hasMissingRequired,
  overallFromItems,
  isSameMeasureDraft,
  measureDraftOf,
  measureSaveBlockOf,
  toMeasurementInputs,
  withJudgment,
  withValue,
} from './measurement-draft';
import { toMeasurementRows } from './measurement-rows';

const NOW = '2026-11-09T09:00:00.000Z';
const rows = toMeasurementRows([dimensionSpec, appearanceSpec, optionalSpec], []);
const rowOf = (specId: number, sampleNo = 1) => {
  const row = rows.find((r) => r.inspectionItemSpecId === specId && r.sampleNo === sampleNo);
  if (row === undefined) throw new Error('없는 줄');
  return row;
};
const dim1 = rowOf(dimensionSpec.inspectionItemSpecId);
const appear = rowOf(appearanceSpec.inspectionItemSpecId);

/** 검사 기준대로 항목별 측정을 받는다(omf-all-around#247). */
describe('measurement-draft', () => {
  it('자동 판정 · 수치 · 상하한이 있으면 값으로 판정을 채운다 — 규격 밖은 불합격', () => {
    expect(withValue({}, dim1, '10.05')[dim1.key]?.judgment).toBe('ACCEPTED');
    expect(withValue({}, dim1, '10.2')[dim1.key]?.judgment).toBe('REJECTED');
    expect(withValue({}, dim1, '9.8')[dim1.key]?.judgment).toBe('REJECTED');
  });

  it('자동 판정이 꺼진 항목도 값으로 판정을 채운다 — 사람이 고른 판정은 그대로다', () => {
    const [flag] = toMeasurementRows(
      [{ ...appearanceSpec, dataTypeCode: 'BOOLEAN', automaticJudgment: false }],
      [],
    );
    const [limited] = toMeasurementRows([{ ...dimensionSpec, automaticJudgment: false }], []);
    if (flag === undefined || limited === undefined) throw new Error('없는 줄');
    expect(withValue({}, flag, 'true')[flag.key]?.judgment).toBe('ACCEPTED');
    expect(withValue({}, flag, 'false')[flag.key]?.judgment).toBe('REJECTED');
    expect(withValue({}, limited, '11')[limited.key]?.judgment).toBe('REJECTED');
    const picked = withJudgment({}, flag, 'REJECTED');
    expect(withValue(picked, flag, 'true')[flag.key]?.judgment).toBe('REJECTED');
  });

  it('사람이 고른 판정은 값을 고쳐도 덮지 않는다', () => {
    const picked = withJudgment(withValue({}, dim1, '10.2'), dim1, 'ACCEPTED');
    expect(withValue(picked, dim1, '10.3')[dim1.key]?.judgment).toBe('ACCEPTED');
  });

  it('글 항목은 판정을 채우지 않는다 — 사람이 고른다', () => {
    expect(withValue({}, appear, '양호')[appear.key]?.judgment).toBe('');
  });

  it('숫자가 아닌 수치 값 · 반쯤 적은 줄은 저장을 막고, 빈 줄은 막지 않는다', () => {
    expect(measureSaveBlockOf(rows, {})).toBeNull();
    expect(measureSaveBlockOf(rows, withValue({}, dim1, '10.x'))).toBe('invalid');
    expect(measureSaveBlockOf(rows, withValue({}, appear, '양호'))).toBe('incomplete');
  });

  it('필수 항목을 다 재야 확정된다 — 선택 항목은 비어도 된다', () => {
    let draft = {};
    for (const row of rows.filter((r) => r.required)) draft = withValue(draft, row, '10');
    draft = withJudgment(draft, appear, 'ACCEPTED');
    expect(hasMissingRequired(rows, draft)).toBe(false);
    expect(hasMissingRequired(rows, withValue(draft, dim1, ''))).toBe(true);
  });

  it('자료형대로 한 칸만 실어 보내고, 다 적은 줄만 싣는다', () => {
    const draft = withJudgment(
      withValue(withValue({}, dim1, '10.05'), appear, '양호'),
      appear,
      'REJECTED',
    );
    expect(toMeasurementInputs(rows, draft, NOW)).toEqual([
      {
        inspectionItemSpecId: dimensionSpec.inspectionItemSpecId,
        sampleNo: 1,
        numericValue: 10.05,
        judgmentCode: 'ACCEPTED',
        measuredAt: NOW,
      },
      {
        inspectionItemSpecId: appearanceSpec.inspectionItemSpecId,
        sampleNo: 1,
        textValue: '양호',
        judgmentCode: 'REJECTED',
        measuredAt: NOW,
      },
    ]);
  });

  it('저장된 측정치로 시작하고, 고치지 않은 줄은 측정 시각 · 계측기를 그대로 싣는다', () => {
    const saved = toMeasurementRows([dimensionSpec], [normalMeasurement]);
    const draft = measureDraftOf(saved);
    expect(isSameMeasureDraft(draft, measureDraftOf(saved))).toBe(true);
    expect(toMeasurementInputs(saved, draft, NOW)).toEqual([
      {
        inspectionItemSpecId: dimensionSpec.inspectionItemSpecId,
        sampleNo: 2,
        numericValue: 9.95,
        judgmentCode: 'ACCEPTED',
        measuredAt: normalMeasurement.measuredAt,
        inspectionEquipmentId: 6001,
      },
    ]);
  });

  it('자동 판정이 켜진 예/아니오 항목은 양호 → 합격 · 불량 → 불합격으로 채운다', () => {
    const [flag] = toMeasurementRows(
      [{ ...appearanceSpec, dataTypeCode: 'BOOLEAN', automaticJudgment: true }],
      [],
    );
    if (flag === undefined) throw new Error('없는 줄');
    expect(withValue({}, flag, 'true')[flag.key]?.judgment).toBe('ACCEPTED');
    expect(withValue({}, flag, 'false')[flag.key]?.judgment).toBe('REJECTED');
  });

  it('전량 합격이면 빈 줄을 기준값 · 합격으로 채우고, 사람이 고른 판정 · 규격 밖 값은 그대로 둔다', () => {
    const picked = withJudgment({}, appear, 'REJECTED');
    const outOfSpec = withValue(picked, rowOf(dimensionSpec.inspectionItemSpecId, 2), '11');
    const filled = fillAllAccepted(rows, outOfSpec);
    expect(filled[dim1.key]).toMatchObject({ value: '10', judgment: 'ACCEPTED' });
    expect(filled[rowOf(dimensionSpec.inspectionItemSpecId, 2).key]?.judgment).toBe('REJECTED');
    expect(filled[appear.key]?.judgment).toBe('REJECTED');
    expect(filled[rowOf(optionalSpec.inspectionItemSpecId).key]).toMatchObject({
      value: '',
      judgment: 'ACCEPTED',
    });
  });

  it('최종 판정 — 불합격 항목이 있으면 불합격, 필수를 다 판정하고 모두 합격이면 합격, 덜 했으면 채우지 않는다', () => {
    expect(overallFromItems(rows, withValue({}, dim1, '11'))).toBe('REJECTED');
    expect(overallFromItems(rows, withValue({}, dim1, '10'))).toBeNull();
    expect(overallFromItems(rows, fillAllAccepted(rows, {}))).toBe('ACCEPTED');
    /* 자동 판정 항목이 없는 기준이면 최종 판정을 채우지 않는다. */
    const manual = toMeasurementRows([appearanceSpec], []);
    expect(overallFromItems(manual, fillAllAccepted(manual, {}))).toBeNull();
  });

  it('판정만 있는 줄은 값 칸 없이 싣는다', () => {
    const [input] = toMeasurementInputs(rows, withJudgment({}, appear, 'ACCEPTED'), NOW);
    expect(input).toEqual({
      inspectionItemSpecId: appearanceSpec.inspectionItemSpecId,
      sampleNo: 1,
      judgmentCode: 'ACCEPTED',
      measuredAt: NOW,
    });
  });
});
