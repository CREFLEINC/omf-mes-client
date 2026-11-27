import { describe, expect, it } from 'vitest';

import { locationFixtures, warehouseFixtures } from './fixtures';
import {
  emptyLocationFormValues,
  emptyWarehouseFormValues,
  isSameWarehouseValues,
  locationAliasOrCode,
  locationToFormValues,
  toLocationUpdate,
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
  locationPrefix: 'K7PM',
  warehouseTypeCode: 'MATERIAL',
  isExternal: false,
  isDefect: false,
  isActive: true,
};

describe('warehouseToFormValues', () => {
  it('숫자 id를 폼이 다루는 문자열로 바꾼다', () => {
    const values = warehouseToFormValues({ ...base, plantId: 11, businessUnitId: 21 });

    expect(values.plantId).toBe('11');
    expect(values.businessUnitId).toBe('21');
  });

  /*
   * ⛔ **컨트롤이 없는 값이라 더 중요하다.** 여기서 흘리면 저장 때 지어낸 값이 나가고
   * 서버가 갖고 있던 불량창고 여부가 조용히 덮인다.
   */
  it('⛔ 불량창고 여부를 받은 그대로 들고 있는다', () => {
    expect(warehouseToFormValues({ ...base, isDefect: true }).isDefect).toBe(true);
    expect(warehouseToFormValues({ ...base, isDefect: false }).isDefect).toBe(false);
  });

  it('코드·명칭·스위치 값은 그대로 옮긴다', () => {
    const values = warehouseToFormValues({
      ...base,
      warehouseName: '외부 보관창고',
    });

    expect(values.warehouseCode).toBe('WH-01');
    expect(values.warehouseName).toBe('외부 보관창고');
    expect(values.warehouseTypeCode).toBe('MATERIAL');
    expect(values.isExternal).toBe(false);
  });
});

describe('emptyWarehouseFormValues', () => {
  it('신규 등록 폼은 값이 비어 있다', () => {
    const values = emptyWarehouseFormValues();

    expect(values.plantId).toBe('');
    expect(values.warehouseCode).toBe('');
    expect(values.warehouseName).toBe('');
  });

  it('호출할 때마다 새 객체를 준다 — 이전 입력이 남지 않는다', () => {
    expect(emptyWarehouseFormValues()).not.toBe(emptyWarehouseFormValues());
  });
});

describe('toWarehouseUpdate', () => {
  /* 거래처는 조회로 채워지지 않으므로 사람이 고른 뒤의 폼을 흉내 낸다. */
  const values = {
    ...warehouseToFormValues({ ...base, businessUnitId: 21 }),
  };

  it('거래처는 싣지 않는다 — 창고는 거래처를 저장하지 않는다(사용자 지시 2026-10-29)', () => {
    expect(toWarehouseUpdate(values)).not.toHaveProperty('partnerId');
  });

  it('문자열 id를 계약이 요구하는 숫자로 되돌린다', () => {
    expect(toWarehouseUpdate(values).businessUnitId).toBe(21);
  });

  /* ⛔ 화면에 컨트롤이 없는 값이다 — 지어내 보내면 서버가 갖고 있던 값이 덮인다. */
  it('⛔ 불량창고 여부를 받은 그대로 되돌려 보낸다', () => {
    expect(toWarehouseUpdate({ ...values, isDefect: true }).isDefect).toBe(true);
    expect(toWarehouseUpdate({ ...values, isDefect: false }).isDefect).toBe(false);
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

describe('toWarehouseUpdate · 바꿀 수 없는 값', () => {
  it('공장 · #292 창고 위치 코드를 싣지 않는다', () => {
    const values = warehouseToFormValues({ ...base, plantId: 11 });

    expect(toWarehouseUpdate(values)).not.toHaveProperty('plantId');
    expect(toWarehouseUpdate(values)).not.toHaveProperty('locationPrefix');
  });
});

describe('locationToFormValues', () => {
  const location: Location = locationFixtures[2]!;

  /* 피처 009 — 「지정 품목만 받기」도 옮긴다(수정 창의 스위치). */
  it('상위 · 코드 · 별칭 · 지정 품목만 받기만 옮긴다 — 위치유형 · 혼적 · 수용량 · 보관조건 칸은 없다', () => {
    const values = locationToFormValues({ ...location, aliasName: '1층' });

    expect(values).toEqual({
      parentLocationId: '2002',
      locationCode: 'A-01-01-01',
      aliasName: '1층',
      itemRestricted: false,
    });
  });

  it('별칭이 없으면 빈 글이 된다', () => {
    expect(locationToFormValues({ ...location, aliasName: null }).aliasName).toBe('');
  });
});

/**
 * 수용량 · 수용 단위 · 품질구역 · 보관조건 · 위치유형 · 혼적 허용 — 위치가 다루지 않아 보내지 않는다(사용자 지시
 * 2026-10-29). 코드는 서버가 발행한다.
 */
const DROPPED_KEYS = [
  'capacityQty',
  'capacityUomId',
  'qualityZoneCode',
  'storageConditionCode',
  'locationTypeCode',
  'allowMixedItem',
  'allowMixedLot',
  'locationCode',
];

describe('toLocationUpdate', () => {
  const stored: Location = { ...locationFixtures[1]!, aliasName: '1번 랙' };
  const values = locationToFormValues(stored);

  it('창고 · 상위 · 코드가 실리지 않는다 — 등록 후 바꿀 수 없다', () => {
    const body = toLocationUpdate(values, stored);

    expect(body).not.toHaveProperty('warehouseId');
    expect(body).not.toHaveProperty('parentLocationId');
    expect(body).not.toHaveProperty('locationCode');
  });

  it('별칭을 고치지 않으면 저장된 위치명을 그대로 보낸다', () => {
    expect(toLocationUpdate(values, stored).locationName).toBe('A구역 01열');
  });

  it('별칭을 고치면 위치명도 별칭으로, 지우면 코드로 맞춘다', () => {
    expect(toLocationUpdate({ ...values, aliasName: ' 2번 랙 ' }, stored)).toMatchObject({
      locationName: '2번 랙',
      aliasName: '2번 랙',
    });
    expect(toLocationUpdate({ ...values, aliasName: '' }, stored)).toMatchObject({
      locationName: 'A-01-01',
      aliasName: null,
    });
  });

  it('서버가 만든 위치는 별칭을 고쳐도 위치명을 바꾸지 않는다', () => {
    const staging: Location = {
      ...stored,
      locationName: '적치 대기',
      systemRoleCode: 'PUTAWAY_STAGING',
    };

    expect(toLocationUpdate({ ...values, aliasName: '입고 대기' }, staging).locationName).toBe(
      '적치 대기',
    );
  });

  it('코드 · 위치유형 · 혼적 · 수용량 · 보관조건 키를 싣지 않는다', () => {
    const body = toLocationUpdate(values, stored);

    for (const key of DROPPED_KEYS) expect(body).not.toHaveProperty(key);
  });
});

describe('emptyLocationFormValues', () => {
  it('신규 등록 폼은 코드 · 별칭이 비어 있다', () => {
    const values = emptyLocationFormValues();

    expect(values.locationCode).toBe('');
    expect(values.aliasName).toBe('');
  });

  it('호출할 때마다 새 객체를 준다', () => {
    expect(emptyLocationFormValues()).not.toBe(emptyLocationFormValues());
  });
});

describe('locationAliasOrCode', () => {
  it('별칭이 있으면 별칭, 없으면 위치 코드 하나만', () => {
    const location = locationFixtures[0]!;

    expect(locationAliasOrCode({ ...location, aliasName: '원자재' })).toBe('원자재');
    expect(locationAliasOrCode({ ...location, aliasName: null })).toBe('A-01');
    expect(locationAliasOrCode({ ...location, aliasName: '  ' })).toBe('A-01');
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
    expect(isSameWarehouseValues(values, { ...values, isDefect: !values.isDefect })).toBe(false);
    expect(isSameWarehouseValues(values, { ...values, isExternal: !values.isExternal })).toBe(
      false,
    );
  });
});
