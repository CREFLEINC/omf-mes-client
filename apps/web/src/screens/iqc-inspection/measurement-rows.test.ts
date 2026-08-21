import { describe, expect, it } from 'vitest';

import {
  appearanceSpec,
  dimensionSpec,
  expiredMeasurement,
  itemSpecs,
  normalMeasurement,
  optionalSpec,
} from './fixtures';
import { hasCalibrationWarning, toMeasurementRows } from './measurement-rows';

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

describe('hasCalibrationWarning', () => {
  it('미검교정으로 잰 줄이 하나라도 있으면 경고한다', () => {
    expect(hasCalibrationWarning(toMeasurementRows([dimensionSpec], [expiredMeasurement]))).toBe(
      true,
    );
  });

  it('멀쩡한 장비로만 쟀으면 경고하지 않는다', () => {
    expect(hasCalibrationWarning(toMeasurementRows([dimensionSpec], [normalMeasurement]))).toBe(
      false,
    );
  });

  it('아직 아무것도 재지 않았으면 경고하지 않는다 — 잰 적이 없으면 만료도 없다', () => {
    expect(hasCalibrationWarning(toMeasurementRows(itemSpecs, []))).toBe(false);
  });
});
