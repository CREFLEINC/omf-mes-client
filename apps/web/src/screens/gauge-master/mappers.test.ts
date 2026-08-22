import { describe, expect, it } from 'vitest';

import { makeGauge } from './fixtures';
import {
  carriedFrom,
  emptyCarriedValues,
  emptyFormValues,
  formValuesFrom,
  isSameGaugeValues,
  toGaugeCreate,
  toGaugeUpdate,
} from './mappers';
import type { CarriedGaugeValues } from './types';

const gauge = makeGauge(3001, 'GA-01', {
  plantId: 11,
  productionLineId: 501,
  processId: 601,
  calibrationRequired: true,
  calibrationCycleTypeCode: 'MONTH',
  calibrationCycleInterval: 12,
  precisionValue: 0.01,
  precisionUomId: 1001,
});

const carried: CarriedGaugeValues = { productionLineId: 501, processId: 601 };

describe('폼 값 옮기기', () => {
  it('상세를 폼 값으로 옮긴다', () => {
    expect(formValuesFrom(gauge)).toEqual({
      equipmentCode: 'GA-01',
      equipmentName: 'GA-01 계측기',
      equipmentTypeCode: 'PENDING',
      plantId: '11',
      calibrationRequired: true,
      calibrationCycleTypeCode: 'MONTH',
      calibrationCycleInterval: '12',
      precisionValue: '0.01',
      precisionUomId: '1001',
    });
  });

  /* 없는 값과 「0」은 다르다 — 없는 것을 0으로 옮기면 정밀도 0이 저장된다. */
  it('없는 값은 빈 칸으로 옮긴다', () => {
    const bare = makeGauge(3002, 'GA-02');
    const values = formValuesFrom(bare);

    expect(values.calibrationCycleTypeCode).toBe('');
    expect(values.calibrationCycleInterval).toBe('');
    expect(values.precisionValue).toBe('');
    expect(values.precisionUomId).toBe('');
  });

  it('0은 0으로 옮긴다 — 없는 값과 가른다', () => {
    const zero = makeGauge(3003, 'GA-03', { precisionValue: 0, precisionUomId: 1001 });

    expect(formValuesFrom(zero).precisionValue).toBe('0');
  });
});

describe('이 화면이 정하지 않는 값', () => {
  /* ⭐ 형제 화면이 주기·정밀도를 두고 하는 일과 뒤집힌 모양이다. */
  it('소속을 떠 둔다', () => {
    expect(carriedFrom(gauge)).toEqual({ productionLineId: 501, processId: 601 });
  });

  it('없으면 없는 대로 떠 둔다', () => {
    expect(carriedFrom(makeGauge(3004, 'GA-04'))).toEqual({
      productionLineId: null,
      processId: null,
    });
  });

  it('수정 본문이 소속을 그대로 되돌려 보낸다', () => {
    const body = toGaugeUpdate(formValuesFrom(gauge), carried, true);

    expect(body.productionLineId).toBe(501);
    expect(body.processId).toBe(601);
  });

  it('신규에는 떠 둘 소속이 없다', () => {
    expect(emptyCarriedValues()).toEqual({ productionLineId: null, processId: null });
  });
});

describe('수정 본문', () => {
  it('자산 상태와 검교정 일자를 싣지 않는다', () => {
    const body = toGaugeUpdate(formValuesFrom(gauge), carried, true);

    expect(body).not.toHaveProperty('statusCode');
    expect(body).not.toHaveProperty('lastCalibrationDate');
    expect(body).not.toHaveProperty('calibrationDueDate');
  });

  /* 공장을 옮기는 것은 자산을 옮기는 일이라 이 화면의 일이 아니다 — 계약도 받지 않는다. */
  it('공장을 싣지 않는다', () => {
    expect(toGaugeUpdate(formValuesFrom(gauge), carried, true)).not.toHaveProperty('plantId');
  });

  it('코드가 잠겼으면 코드를 싣지 않는다', () => {
    expect(toGaugeUpdate(formValuesFrom(gauge), carried, false)).not.toHaveProperty(
      'equipmentCode',
    );
  });

  it('코드가 열려 있으면 앞뒤 공백을 떼고 싣는다', () => {
    const values = { ...formValuesFrom(gauge), equipmentCode: '  GA-09  ' };

    expect(toGaugeUpdate(values, carried, true).equipmentCode).toBe('GA-09');
  });

  it('이름의 앞뒤 공백을 뗀다', () => {
    const values = { ...formValuesFrom(gauge), equipmentName: '  캘리퍼스  ' };

    expect(toGaugeUpdate(values, carried, true).equipmentName).toBe('캘리퍼스');
  });

  /*
   * ⭐ 대상이 아닌데 주기가 붙어 있으면 서버 자료가 모순 상태가 된다.
   * 폼에는 남겨 두고 **보낼 때 하나에서** 비운다.
   */
  it('검교정 대상이 아니면 주기를 비워 보낸다', () => {
    const values = { ...formValuesFrom(gauge), calibrationRequired: false };
    const body = toGaugeUpdate(values, carried, true);

    expect(body.calibrationCycleTypeCode).toBeNull();
    expect(body.calibrationCycleInterval).toBeNull();
  });

  it('검교정 대상이면 주기를 그대로 싣는다', () => {
    const body = toGaugeUpdate(formValuesFrom(gauge), carried, true);

    expect(body.calibrationCycleTypeCode).toBe('MONTH');
    expect(body.calibrationCycleInterval).toBe(12);
  });

  /* 정밀도는 검교정 대상 여부와 무관하다 — 두 축을 엮지 않는다. */
  it('검교정 대상이 아니어도 정밀도는 남는다', () => {
    const values = { ...formValuesFrom(gauge), calibrationRequired: false };
    const body = toGaugeUpdate(values, carried, true);

    expect(body.precisionValue).toBe(0.01);
    expect(body.precisionUomId).toBe(1001);
  });

  it('빈 정밀도는 없음으로 싣는다', () => {
    const values = { ...formValuesFrom(gauge), precisionValue: '', precisionUomId: '' };
    const body = toGaugeUpdate(values, carried, true);

    expect(body.precisionValue).toBeNull();
    expect(body.precisionUomId).toBeNull();
  });
});

describe('등록 본문', () => {
  it('공장을 싣고 코드도 싣는다', () => {
    const body = toGaugeCreate(emptyFormValues('11'), emptyCarriedValues());

    expect(body.plantId).toBe(11);
    expect(body.equipmentCode).toBe('');
  });

  it('신규 폼의 유형은 자리표시 값이다', () => {
    expect(emptyFormValues('11').equipmentTypeCode).toBe('PENDING');
  });

  it('고른 공장이 없으면 빈 칸으로 연다', () => {
    expect(emptyFormValues('').plantId).toBe('');
  });
});

describe('고친 것이 있는가', () => {
  it('같은 값이면 같다고 본다', () => {
    expect(isSameGaugeValues(formValuesFrom(gauge), formValuesFrom(gauge))).toBe(true);
  });

  it.each([
    ['equipmentCode', 'GA-99'],
    ['equipmentName', '다른 이름'],
    ['equipmentTypeCode', 'OTHER'],
    ['plantId', '12'],
    ['calibrationCycleTypeCode', 'YEAR'],
    ['calibrationCycleInterval', '6'],
    ['precisionValue', '0.02'],
    ['precisionUomId', '1002'],
  ])('%s 이 달라지면 다르다고 본다', (field, next) => {
    const base = formValuesFrom(gauge);

    expect(isSameGaugeValues(base, { ...base, [field]: next })).toBe(false);
  });

  it('검교정 대상 여부가 달라지면 다르다고 본다', () => {
    const base = formValuesFrom(gauge);

    expect(isSameGaugeValues(base, { ...base, calibrationRequired: false })).toBe(false);
  });
});
