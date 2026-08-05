import { describe, expect, it } from 'vitest';

import { PENDING_CODE_VALUE } from './code-options';
import { warehouseFixtures } from './fixtures';
import {
  emptyWarehouseFormValues,
  isSameWarehouseValues,
  warehouseToFormValues,
} from './mappers';
import type { Warehouse } from './types';

const base: Warehouse = {
  warehouseId: 1001,
  plantId: 11,
  businessUnitId: 21,
  warehouseCode: 'WH-01',
  warehouseName: '1공장 자재창고',
  warehouseTypeCode: 'MATERIAL',
  managementLevelCode: PENDING_CODE_VALUE,
  isExternal: false,
  partnerId: null,
  isActive: true,
};

describe('warehouseToFormValues', () => {
  it('숫자 id를 폼이 다루는 문자열로 바꾼다', () => {
    const values = warehouseToFormValues({ ...base, plantId: 11, businessUnitId: 21 });

    expect(values.plantId).toBe('11');
    expect(values.businessUnitId).toBe('21');
  });

  it('널 거래처는 빈 문자열이 된다 — 선택칸의 「고르지 않음」과 같은 값이다', () => {
    expect(warehouseToFormValues({ ...base, partnerId: null }).partnerId).toBe('');
  });

  it('거래처 필드 자체가 없어도 빈 문자열이 된다', () => {
    const { partnerId: _partnerId, ...withoutPartner } = base;

    expect(warehouseToFormValues(withoutPartner).partnerId).toBe('');
  });

  it('거래처가 있으면 문자열 id가 된다', () => {
    expect(warehouseToFormValues({ ...base, partnerId: 31 }).partnerId).toBe('31');
  });

  it('코드·명칭·스위치 값은 그대로 옮긴다', () => {
    const values = warehouseToFormValues({ ...base, isExternal: true, warehouseName: '외부 보관창고' });

    expect(values.warehouseCode).toBe('WH-01');
    expect(values.warehouseName).toBe('외부 보관창고');
    expect(values.warehouseTypeCode).toBe('MATERIAL');
    expect(values.isExternal).toBe(true);
  });
});

describe('emptyWarehouseFormValues', () => {
  it('신규 등록 폼은 값이 비어 있다', () => {
    const values = emptyWarehouseFormValues();

    expect(values.plantId).toBe('');
    expect(values.warehouseCode).toBe('');
    expect(values.warehouseName).toBe('');
    expect(values.isExternal).toBe(false);
  });

  it('호출할 때마다 새 객체를 준다 — 이전 입력이 남지 않는다', () => {
    expect(emptyWarehouseFormValues()).not.toBe(emptyWarehouseFormValues());
  });
});

describe('isSameWarehouseValues', () => {
  it('모든 값이 같으면 참이다', () => {
    const values = warehouseToFormValues(base);

    expect(isSameWarehouseValues(values, { ...values })).toBe(true);
  });

  it('한 값이라도 다르면 거짓이다', () => {
    const values = warehouseToFormValues(warehouseFixtures[0]!);

    expect(isSameWarehouseValues(values, { ...values, warehouseName: '바뀐 이름' })).toBe(false);
    expect(isSameWarehouseValues(values, { ...values, isExternal: !values.isExternal })).toBe(false);
  });
});
