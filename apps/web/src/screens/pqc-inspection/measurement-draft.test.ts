import { describe, expect, it } from 'vitest';

import {
  DATA_TYPES,
  EMPTY_MEASUREMENT_DRAFT,
  hasValueError,
  isAllJudged,
  isValueInvalid,
  judgedCount,
  toMeasurementDrafts,
  toMeasurementInputs,
  type MeasurementDrafts,
} from './measurement-draft';
import type { MeasurementRow } from './measurement-rows';

const MEASURED_AT = '2026-08-27T09:00:00+09:00';

const rowOf = (
  key: string,
  dataTypeCode: string,
  measured: MeasurementRow['measured'] = null,
): MeasurementRow => ({
  key,
  inspectionItemSpecId: Number(key.split('-')[0]),
  displayNo: 1,
  itemName: '항목',
  itemCode: 'ITEM',
  dataTypeCode,
  sampleNo: Number(key.split('-')[1]),
  sampleCount: 1,
  required: true,
  spec: { target: null, lower: 9.9, upper: 10.1 },
  measured,
});

describe('toMeasurementDrafts — 저장된 값을 초안으로', () => {
  it('아직 재지 않은 줄은 빈 초안이다 — 판정을 미리 채우지 않는다', () => {
    const drafts = toMeasurementDrafts([rowOf('1-1', DATA_TYPES.numeric)]);

    expect(drafts['1-1']).toEqual(EMPTY_MEASUREMENT_DRAFT);
  });

  it('저장된 수치와 판정을 옮긴다', () => {
    const drafts = toMeasurementDrafts([
      rowOf('1-1', DATA_TYPES.numeric, {
        numericValue: 10.05,
        textValue: null,
        booleanValue: null,
        judgmentCode: 'ACCEPTED',
        measuredAt: MEASURED_AT,
        inspectionEquipmentId: null,
        calibrationExpired: false,
      }),
    ]);

    expect(drafts['1-1']).toEqual({ judgment: 'ACCEPTED', value: '10.05' });
  });

  /* 거짓을 고른 것과 아직 안 고른 것이 화면에서 달라야 한다. */
  it('불리언 거짓도 값으로 옮긴다 — 빈 칸과 구분된다', () => {
    const drafts = toMeasurementDrafts([
      rowOf('2-1', DATA_TYPES.boolean, {
        numericValue: null,
        textValue: null,
        booleanValue: false,
        judgmentCode: 'REJECTED',
        measuredAt: MEASURED_AT,
        inspectionEquipmentId: null,
        calibrationExpired: false,
      }),
    ]);

    expect(drafts['2-1']).toEqual({ judgment: 'REJECTED', value: 'false' });
  });
});

describe('isValueInvalid — 수치형에만 숫자 규칙을 건다', () => {
  it('수치형에 수치가 아닌 값은 잘못이다', () => {
    expect(isValueInvalid(rowOf('1-1', DATA_TYPES.numeric), { judgment: '', value: 'abc' })).toBe(
      true,
    );
  });

  it('수치형의 빈 칸은 잘못이 아니다 — 판정만으로 성립하는 줄이 있다', () => {
    expect(isValueInvalid(rowOf('1-1', DATA_TYPES.numeric), EMPTY_MEASUREMENT_DRAFT)).toBe(false);
  });

  /* ⛔ 문자 항목에 숫자 규칙을 걸면 정상 입력이 틀렸다고 나온다. */
  it('문자형에는 숫자 규칙을 걸지 않는다', () => {
    expect(isValueInvalid(rowOf('3-1', DATA_TYPES.text), { judgment: '', value: '양호' })).toBe(
      false,
    );
  });

  it('hasValueError 는 한 줄이라도 잘못되면 참이다', () => {
    const rows = [rowOf('1-1', DATA_TYPES.numeric), rowOf('3-1', DATA_TYPES.text)];
    const drafts: MeasurementDrafts = {
      '1-1': { judgment: '', value: 'abc' },
      '3-1': { judgment: '', value: '양호' },
    };

    expect(hasValueError(rows, drafts)).toBe(true);
  });
});

describe('진행 세기 — 값이 아니라 판정으로 센다', () => {
  const rows = [rowOf('1-1', DATA_TYPES.numeric), rowOf('2-1', DATA_TYPES.boolean)];

  it('판정한 줄만 센다', () => {
    const drafts: MeasurementDrafts = {
      '1-1': { judgment: 'ACCEPTED', value: '' },
      '2-1': EMPTY_MEASUREMENT_DRAFT,
    };

    expect(judgedCount(rows, drafts)).toBe(1);
    expect(isAllJudged(rows, drafts)).toBe(false);
  });

  /*
   * ⛔ 값으로 세면 육안 항목이 영영 안 끝난 것으로 보인다 — 그 항목에는 측정값이 없다.
   */
  it('값이 비어 있어도 판정했으면 끝난 줄이다', () => {
    const drafts: MeasurementDrafts = {
      '1-1': { judgment: 'ACCEPTED', value: '' },
      '2-1': { judgment: 'REJECTED', value: '' },
    };

    expect(isAllJudged(rows, drafts)).toBe(true);
  });
});

describe('toMeasurementInputs — 보내는 값으로 접는다', () => {
  it('판정하지 않은 줄은 싣지 않는다 — 사람이 내리지 않은 판정을 만들지 않는다', () => {
    const rows = [rowOf('1-1', DATA_TYPES.numeric)];

    expect(
      toMeasurementInputs(rows, { '1-1': { judgment: '', value: '10' } }, MEASURED_AT),
    ).toEqual([]);
  });

  it('수치형은 numericValue 한 칸만 채운다', () => {
    const rows = [rowOf('1-1', DATA_TYPES.numeric)];
    const sent = toMeasurementInputs(
      rows,
      { '1-1': { judgment: 'ACCEPTED', value: '10.05' } },
      MEASURED_AT,
    );

    expect(sent).toEqual([
      {
        inspectionItemSpecId: 1,
        sampleNo: 1,
        judgmentCode: 'ACCEPTED',
        measuredAt: MEASURED_AT,
        numericValue: 10.05,
      },
    ]);
    expect(sent[0]).not.toHaveProperty('textValue');
    expect(sent[0]).not.toHaveProperty('booleanValue');
  });

  it('문자형은 textValue 한 칸만 채운다', () => {
    const sent = toMeasurementInputs(
      [rowOf('3-1', DATA_TYPES.text)],
      { '3-1': { judgment: 'ACCEPTED', value: '양호' } },
      MEASURED_AT,
    );

    expect(sent[0]).toMatchObject({ textValue: '양호' });
    expect(sent[0]).not.toHaveProperty('numericValue');
  });

  it('불리언은 booleanValue 한 칸만 채운다', () => {
    const sent = toMeasurementInputs(
      [rowOf('2-1', DATA_TYPES.boolean)],
      { '2-1': { judgment: 'ACCEPTED', value: 'false' } },
      MEASURED_AT,
    );

    expect(sent[0]).toMatchObject({ booleanValue: false });
    expect(sent[0]).not.toHaveProperty('numericValue');
  });

  /* 육안 항목 — 판정만 있고 값이 없다. 세 칸 중 어느 것도 실리지 않아야 한다. */
  it('값이 비면 값 칸을 아예 싣지 않는다', () => {
    const sent = toMeasurementInputs(
      [rowOf('4-1', DATA_TYPES.text)],
      { '4-1': { judgment: 'ACCEPTED', value: '' } },
      MEASURED_AT,
    );

    expect(Object.keys(sent[0] ?? {})).toEqual([
      'inspectionItemSpecId',
      'sampleNo',
      'judgmentCode',
      'measuredAt',
    ]);
  });

  it('수치형에 수치가 아닌 값이 남아 있으면 값 칸을 싣지 않는다', () => {
    const sent = toMeasurementInputs(
      [rowOf('1-1', DATA_TYPES.numeric)],
      { '1-1': { judgment: 'ACCEPTED', value: 'abc' } },
      MEASURED_AT,
    );

    expect(sent[0]).not.toHaveProperty('numericValue');
  });
});
