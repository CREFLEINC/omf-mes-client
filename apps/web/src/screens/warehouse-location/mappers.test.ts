import { describe, expect, it } from 'vitest';

import { PENDING_CODE_VALUE } from './code-options';
import { locationFixtures, warehouseFixtures } from './fixtures';
import {
  emptyLocationFormValues,
  emptyWarehouseFormValues,
  isSameWarehouseValues,
  locationToFormValues,
  toWarehouseUpdate,
  warehouseToFormValues,
} from './mappers';
import type { Location, Warehouse } from './types';

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

describe('toWarehouseUpdate', () => {
  const values = warehouseToFormValues({ ...base, businessUnitId: 21, partnerId: 31 });

  it('문자열 id를 계약이 요구하는 숫자로 되돌린다', () => {
    expect(toWarehouseUpdate(values).businessUnitId).toBe(21);
    expect(toWarehouseUpdate(values).partnerId).toBe(31);
  });

  it('고르지 않은 거래처는 널로 보낸다 — 0은 유효한 id가 아니다', () => {
    expect(toWarehouseUpdate({ ...values, partnerId: '' }).partnerId).toBeNull();
  });

  it('공장은 요청에 실리지 않는다 — 등록 후 바꿀 수 없다', () => {
    expect(toWarehouseUpdate(values)).not.toHaveProperty('plantId');
  });

  it('코드·명칭의 앞뒤 공백을 걷어낸다 — 눈에 안 보이는 다른 값이 저장되면 안 된다', () => {
    const padded = toWarehouseUpdate({
      ...values,
      warehouseCode: '  WH-01  ',
      warehouseName: ' 자재창고 ',
    });

    expect(padded.warehouseCode).toBe('WH-01');
    expect(padded.warehouseName).toBe('자재창고');
  });
});

describe('locationToFormValues', () => {
  const location: Location = locationFixtures[2]!;

  it('수용량과 단위를 문자열로 옮긴다', () => {
    const values = locationToFormValues(location);

    expect(values.capacityQty).toBe('500');
    expect(values.capacityUomId).toBe('41');
  });

  it('널 수용량·단위는 빈 문자열이 된다 — 짝 제약을 「둘 다 비었다」로 읽을 수 있어야 한다', () => {
    const values = locationToFormValues({ ...location, capacityQty: null, capacityUomId: null });

    expect(values.capacityQty).toBe('');
    expect(values.capacityUomId).toBe('');
  });

  it('널 품질구역·보관조건은 빈 문자열이 된다', () => {
    const values = locationToFormValues({
      ...location,
      qualityZoneCode: null,
      storageConditionCode: null,
    });

    expect(values.qualityZoneCode).toBe('');
    expect(values.storageConditionCode).toBe('');
  });

  it('코드·명칭·혼적 허용은 그대로 옮긴다', () => {
    const values = locationToFormValues(location);

    expect(values.locationCode).toBe('A-01-01-01');
    expect(values.locationName).toBe('A구역 01열 01단');
    expect(values.allowMixedItem).toBe(false);
    expect(values.allowMixedLot).toBe(false);
  });
});

describe('emptyLocationFormValues', () => {
  it('신규 등록 폼은 코드·명칭·수용량이 비어 있다', () => {
    const values = emptyLocationFormValues();

    expect(values.locationCode).toBe('');
    expect(values.locationName).toBe('');
    expect(values.capacityQty).toBe('');
    expect(values.capacityUomId).toBe('');
  });

  it('호출할 때마다 새 객체를 준다', () => {
    expect(emptyLocationFormValues()).not.toBe(emptyLocationFormValues());
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
