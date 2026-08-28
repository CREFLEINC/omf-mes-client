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

  it('외부창고를 켜면 거래처가 필수다', () => {
    const errors = validateWarehouse({ ...filled, isExternal: true, partnerId: '' }, 'edit');

    expect(errors.partnerId).toBe('외부창고이면 거래처를 지정해야 합니다.');
  });

  it('외부창고가 꺼져 있으면 거래처가 없어도 통과한다', () => {
    expect(validateWarehouse({ ...filled, isExternal: false, partnerId: '' }, 'edit')).toEqual({});
  });

  it('외부창고를 켜고 거래처를 고르면 통과한다', () => {
    expect(validateWarehouse({ ...filled, isExternal: true, partnerId: '31' }, 'edit')).toEqual({});
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

/**
 * ⭐ **입력칸이 없는 값이라 이 목록에 넣지 않는다.** 이 목록은 「서버 오류를 어느 칸 옆에
 * 인라인으로 붙일까」의 기준이다 — 컨트롤이 없는 이름을 넣으면 그 오류가 **아무 데도 붙지
 * 못하고 사라진다.** 목록에 없으면 배너로 올라가 사람 눈에 닿는다.
 *
 * 불량창고 여부는 받은 값을 그대로 되돌려 보내려고 폼이 들고만 있는 값이다(`types.ts` 참고).
 */
const VALUES_WITHOUT_CONTROL: readonly string[] = ['isDefect'];

describe('WAREHOUSE_FORM_FIELDS', () => {
  it('폼이 소유한 입력칸 이름을 전부 담는다 — 서버 오류를 인라인으로 낼 기준이다', () => {
    for (const field of Object.keys(emptyWarehouseFormValues())) {
      if (VALUES_WITHOUT_CONTROL.includes(field)) continue;

      expect(WAREHOUSE_FORM_FIELDS).toContain(field);
    }
  });

  /* ⛔ 붙일 칸이 없는 이름이 섞이면 그 오류는 인라인으로 가려다 사라진다. */
  it('⛔ 입력칸이 없는 값은 담지 않는다 — 붙일 자리가 없는 오류가 되어 사라진다', () => {
    for (const field of VALUES_WITHOUT_CONTROL) {
      expect(WAREHOUSE_FORM_FIELDS).not.toContain(field);
    }
  });
});
