import { describe, expect, it } from 'vitest';

import {
  appearanceSpec,
  dimensionSpec,
  expiredMeasurement,
  itemSpecs,
  normalMeasurement,
  optionalSpec,
} from './fixtures';
import { isOutOfSpec, toMeasurementRows, type MeasurementRow } from './measurement-rows';

describe('toMeasurementRows', () => {
  it('줄은 「항목 × 샘플」이다 — 검사기준이 세 개를 재라고 하면 세 줄이 선다', () => {
    const rows = toMeasurementRows([dimensionSpec], []);

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.sampleNo)).toEqual([1, 2, 3]);
  });

  it('항목이 여럿이면 각 항목의 샘플을 모두 편다', () => {
    expect(toMeasurementRows(itemSpecs, [])).toHaveLength(
      dimensionSpec.measurementCount +
        appearanceSpec.measurementCount +
        optionalSpec.measurementCount,
    );
  });

  it('채번 값이 아니라 목록 내 위치로 1부터 센다 — 계약이 그렇게 못박았다', () => {
    /* 시퀀스가 5·10·20 이라 그대로 보이면 「5번 항목」이 된다. */
    const rows = toMeasurementRows(itemSpecs, []);

    expect(rows[0]?.displayNo).toBe(1);
    expect(rows[0]?.itemName).toBe(optionalSpec.inspectionItemName);
    expect(new Set(rows.map((row) => row.displayNo))).toEqual(new Set([1, 2, 3]));
  });

  it('계약이 준 차례를 믿지 않고 시퀀스로 다시 정렬한다', () => {
    const rows = toMeasurementRows([dimensionSpec, optionalSpec], []);

    expect(rows[0]?.itemName).toBe(optionalSpec.inspectionItemName);
  });

  it('아직 재지 않은 자리도 줄로 만든다 — 감추면 무엇을 더 재야 하는지 알 수 없다', () => {
    const rows = toMeasurementRows([dimensionSpec], [expiredMeasurement]);

    expect(rows.filter((row) => row.measured === null)).toHaveLength(2);
  });

  it('저장된 측정치를 항목·샘플로 맞춰 붙인다', () => {
    const rows = toMeasurementRows([dimensionSpec], [normalMeasurement]);

    expect(rows[0]?.measured).toBeNull();
    expect(rows[1]?.measured?.numericValue).toBe(9.95);
  });

  it('규격이 없는 항목은 지어내지 않는다', () => {
    const rows = toMeasurementRows([appearanceSpec], []);

    expect(rows[0]?.spec).toEqual({ target: null, lower: null, upper: null });
  });

  it('필수 여부를 그대로 나른다', () => {
    const rows = toMeasurementRows([optionalSpec], []);

    expect(rows[0]?.required).toBe(false);
  });

  it('샘플 수가 0으로 와도 줄이 사라지지 않는다', () => {
    const rows = toMeasurementRows([{ ...appearanceSpec, measurementCount: 0 }], []);

    expect(rows).toHaveLength(1);
  });

  it('미검교정 판정을 서버 값 그대로 나른다 — 화면이 계산하지 않는다', () => {
    const rows = toMeasurementRows([dimensionSpec], [expiredMeasurement, normalMeasurement]);

    expect(rows[0]?.measured?.calibrationExpired).toBe(true);
    expect(rows[1]?.measured?.calibrationExpired).toBe(false);
  });
});

describe('isOutOfSpec — 규격 밖 판정', () => {
  const rowWith = (
    spec: { lower: number | null; upper: number | null },
    numericValue: number | null,
  ): MeasurementRow => ({
    key: '1-1',
    inspectionItemSpecId: 1,
    displayNo: 1,
    itemName: '치수 A',
    itemCode: 'DIM-A',
    dataTypeCode: 'NUMERIC',
    automaticJudgment: false,
    sampleNo: 1,
    sampleCount: 1,
    required: true,
    spec: { target: null, lower: spec.lower, upper: spec.upper },
    measured:
      numericValue === null
        ? null
        : {
            numericValue,
            textValue: null,
            booleanValue: null,
            judgmentCode: 'ACCEPTED',
            measuredAt: '2026-08-27T09:00:00+09:00',
            inspectionEquipmentId: null,
            calibrationExpired: false,
          },
  });

  it('상한만 있는 규격도 견준다 — 둘 다 있을 때만 견주면 흔한 공차가 판정에서 빠진다', () => {
    expect(isOutOfSpec(rowWith({ lower: null, upper: 10 }, 10.5))).toBe(true);
    expect(isOutOfSpec(rowWith({ lower: null, upper: 10 }, 9.5))).toBe(false);
  });

  it('하한만 있는 규격도 견준다', () => {
    expect(isOutOfSpec(rowWith({ lower: 9.9, upper: null }, 9.8))).toBe(true);
    expect(isOutOfSpec(rowWith({ lower: 9.9, upper: null }, 9.9))).toBe(false);
  });

  it('경계값은 규격 안이다 — 상하한이 포함 구간이다', () => {
    expect(isOutOfSpec(rowWith({ lower: 1, upper: 10 }, 1))).toBe(false);
    expect(isOutOfSpec(rowWith({ lower: 1, upper: 10 }, 10))).toBe(false);
  });

  it('아직 재지 않은 줄은 규격 밖이 아니다', () => {
    expect(isOutOfSpec(rowWith({ lower: 1, upper: 10 }, null))).toBe(false);
  });

  it('숫자가 아닌 측정치는 규격 밖이 아니다 — 없는 규격을 어겼다고 말하지 않는다', () => {
    const row = rowWith({ lower: 1, upper: 10 }, 5);
    const textRow: MeasurementRow = {
      ...row,
      measured: { ...row.measured!, numericValue: null, textValue: '양호' },
    };

    expect(isOutOfSpec(textRow)).toBe(false);
  });

  it('규격 밖이어도 판정을 바꾸지 않는다 — 저장된 판정이 그대로 남는다', () => {
    const row = rowWith({ lower: 1, upper: 10 }, 99);

    expect(isOutOfSpec(row)).toBe(true);
    expect(row.measured?.judgmentCode).toBe('ACCEPTED');
  });
});
