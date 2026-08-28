import { describe, expect, it } from 'vitest';

import { PENDING_CODE_VALUE } from './code-options';
import { locationFixtures, warehouseFixtures } from './fixtures';
import {
  emptyLocationFormValues,
  emptyWarehouseFormValues,
  isSameWarehouseValues,
  locationToFormValues,
  toLocationCreate,
  toLocationUpdate,
  toWarehouseCreate,
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
   * ⛔ **거래처는 채울 수 없다 — 조회 응답에 그 칸이 없다.** 외부창고여도 마찬가지다.
   * 여기서 무언가를 채우면 그것은 화면이 지어낸 값이다.
   */
  it('⛔ 거래처는 비운 채로 온다 — 서버가 조회 응답에 주지 않는다', () => {
    expect(warehouseToFormValues(base).partnerId).toBe('');
  });

  it('⛔ 외부창고여도 거래처를 지어내지 않는다', () => {
    expect(warehouseToFormValues({ ...base, isExternal: true }).partnerId).toBe('');
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
      isExternal: true,
      warehouseName: '외부 보관창고',
    });

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
  /* 거래처는 조회로 채워지지 않으므로 사람이 고른 뒤의 폼을 흉내 낸다. */
  const values = {
    ...warehouseToFormValues({ ...base, businessUnitId: 21 }),
    partnerId: '31',
  };

  it('문자열 id를 계약이 요구하는 숫자로 되돌린다', () => {
    expect(toWarehouseUpdate(values).businessUnitId).toBe(21);
    expect(toWarehouseUpdate(values).partnerId).toBe(31);
  });

  it('고르지 않은 거래처는 널로 보낸다 — 0은 유효한 id가 아니다', () => {
    expect(toWarehouseUpdate({ ...values, partnerId: '' }).partnerId).toBeNull();
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

describe('toWarehouseCreate', () => {
  const values = warehouseToFormValues({ ...base, plantId: 11 });

  it('공장을 숫자로 담는다 — 등록에서만 정할 수 있는 값이다', () => {
    expect(toWarehouseCreate(values).plantId).toBe(11);
  });

  it('수정 본문의 항목을 그대로 갖는다', () => {
    expect(toWarehouseCreate(values)).toMatchObject(toWarehouseUpdate(values));
  });

  it('isActive를 보내지 않는다 — 신규는 항상 사용 중이다', () => {
    expect(toWarehouseCreate(values)).not.toHaveProperty('isActive');
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

describe('toLocationCreate · toLocationUpdate', () => {
  const values = locationToFormValues(locationFixtures[2]!);

  it('등록 본문에는 창고와 상위 위치가 함께 실린다', () => {
    const body = toLocationCreate(values, 1001, 2002);

    expect(body.warehouseId).toBe(1001);
    expect(body.parentLocationId).toBe(2002);
  });

  it('최상위 등록이면 상위 위치가 널이다', () => {
    expect(toLocationCreate(values, 1001, null).parentLocationId).toBeNull();
  });

  it('수정 본문에는 창고가 실리지 않는다 — 등록 후 바꿀 수 없다', () => {
    expect(toLocationUpdate(values, null)).not.toHaveProperty('warehouseId');
  });

  it('수용량을 숫자로 되돌리고 단위를 숫자 id로 보낸다', () => {
    const body = toLocationUpdate(values, null);

    expect(body.capacityQty).toBe(500);
    expect(body.capacityUomId).toBe(41);
  });

  it('수용량과 단위를 비우면 둘 다 널로 보낸다 — 짝 제약을 지킨다', () => {
    const body = toLocationUpdate({ ...values, capacityQty: '', capacityUomId: '' }, null);

    expect(body.capacityQty).toBeNull();
    expect(body.capacityUomId).toBeNull();
  });

  it('고르지 않은 품질구역·보관조건은 널로 보낸다', () => {
    const body = toLocationUpdate(
      { ...values, qualityZoneCode: '', storageConditionCode: '' },
      null,
    );

    expect(body.qualityZoneCode).toBeNull();
    expect(body.storageConditionCode).toBeNull();
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
    expect(isSameWarehouseValues(values, { ...values, isExternal: !values.isExternal })).toBe(
      false,
    );
  });
});
