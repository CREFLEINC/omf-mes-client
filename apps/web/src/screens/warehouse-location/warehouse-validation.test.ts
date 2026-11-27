import { describe, expect, it } from 'vitest';

import { emptyWarehouseFormValues } from './mappers';
import type { WarehouseFormValues } from './types';
import { WAREHOUSE_FORM_FIELDS, validateWarehouse } from './warehouse-validation';

const filled: WarehouseFormValues = {
  ...emptyWarehouseFormValues(),
  plantId: '11',
  businessUnitId: '21',
  warehouseCode: 'WH-01',
  warehouseName: '1공장 자재창고',
  locationPrefix: 'K7PM',
  warehouseTypeCode: 'MATERIAL',
};

describe('validateWarehouse', () => {
  it('채워진 값은 통과한다', () => {
    expect(validateWarehouse(filled)).toEqual({});
  });

  it('창고코드가 비면 필수 오류다', () => {
    expect(validateWarehouse({ ...filled, warehouseCode: '' }).warehouseCode).toBe(
      '필수 입력 항목입니다.',
    );
  });

  it('창고코드가 공백만이면 별도 오류를 낸다 — 「비었다」와 구분해야 고칠 방법을 안다', () => {
    expect(validateWarehouse({ ...filled, warehouseCode: '   ' }).warehouseCode).toBe(
      '코드는 공백만으로 지정할 수 없습니다.',
    );
  });

  it('창고명·창고유형·사업부가 비면 필수 오류다', () => {
    const errors = validateWarehouse({
      ...filled,
      warehouseName: '  ',
      warehouseTypeCode: '',
      businessUnitId: '',
    });

    expect(errors.warehouseName).toBe('필수 입력 항목입니다.');
    expect(errors.warehouseTypeCode).toBe('필수 입력 항목입니다.');
    expect(errors.businessUnitId).toBe('필수 입력 항목입니다.');
  });

  it('공장 · 창고 위치 코드는 보지 않는다 — 바꿀 수 없어 수정 요청에 실리지 않는다', () => {
    expect(validateWarehouse({ ...filled, plantId: '', locationPrefix: '' })).toEqual({});
  });
});

describe('WAREHOUSE_FORM_FIELDS', () => {
  it('수정 요청에 실리는 칸을 전부 담고, 실리지 않는 공장 · 창고 위치 코드는 뺀다', () => {
    for (const field of Object.keys(emptyWarehouseFormValues())) {
      if (field === 'plantId' || field === 'locationPrefix') {
        expect(WAREHOUSE_FORM_FIELDS).not.toContain(field);
      } else {
        expect(WAREHOUSE_FORM_FIELDS).toContain(field);
      }
    }
  });
});
