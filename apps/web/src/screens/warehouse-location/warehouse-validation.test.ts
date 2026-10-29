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
  warehouseTypeCode: 'MATERIAL',
  managementLevelCode: 'CELL',
};

describe('validateWarehouse', () => {
  it('채워진 값은 통과한다', () => {
    expect(validateWarehouse(filled, 'edit')).toEqual({});
    expect(validateWarehouse(filled, 'create')).toEqual({});
  });

  it('창고코드가 비면 필수 오류다', () => {
    expect(validateWarehouse({ ...filled, warehouseCode: '' }, 'edit').warehouseCode).toBe(
      '필수 입력 항목입니다.',
    );
  });

  it('창고코드가 공백만이면 별도 오류를 낸다 — 「비었다」와 구분해야 고칠 방법을 안다', () => {
    expect(validateWarehouse({ ...filled, warehouseCode: '   ' }, 'edit').warehouseCode).toBe(
      '코드는 공백만으로 지정할 수 없습니다.',
    );
  });

  it('창고명·창고유형이 비면 필수 오류다', () => {
    const errors = validateWarehouse(
      { ...filled, warehouseName: '  ', warehouseTypeCode: '' },
      'edit',
    );

    expect(errors.warehouseName).toBe('필수 입력 항목입니다.');
    expect(errors.warehouseTypeCode).toBe('필수 입력 항목입니다.');
  });

  it('외부창고를 켜도 거래처를 묻지 않는다', () => {
    expect(validateWarehouse({ ...filled, isExternal: true }, 'edit')).toEqual({});
  });

  it('신규 등록에서 공장이 비면 필수 오류다', () => {
    expect(validateWarehouse({ ...filled, plantId: '' }, 'create').plantId).toBe(
      '필수 입력 항목입니다.',
    );
  });

  it('수정에서는 공장을 보지 않는다 — 등록 후 바꿀 수 없어 요청에 실리지 않는다', () => {
    expect(validateWarehouse({ ...filled, plantId: '' }, 'edit').plantId).toBeUndefined();
  });

  it('사업부는 두 모드 모두 필수다 — 수정 요청에도 실린다', () => {
    expect(validateWarehouse({ ...filled, businessUnitId: '' }, 'edit').businessUnitId).toBe(
      '필수 입력 항목입니다.',
    );
    expect(validateWarehouse({ ...filled, businessUnitId: '' }, 'create').businessUnitId).toBe(
      '필수 입력 항목입니다.',
    );
  });
});

describe('WAREHOUSE_FORM_FIELDS', () => {
  it('폼이 소유한 입력칸 이름을 전부 담는다 — 서버 오류를 인라인으로 낼 기준이다', () => {
    /* 관리 수준은 화면에 칸이 없어(이행용 값만 싣는다) 그 오류는 배너로 간다. */
    for (const field of Object.keys(emptyWarehouseFormValues())) {
      if (field === 'managementLevelCode') continue;
      expect(WAREHOUSE_FORM_FIELDS).toContain(field);
    }
  });
});
