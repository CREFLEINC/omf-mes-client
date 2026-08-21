import { describe, expect, it } from 'vitest';

import { PENDING_CODE_VALUE } from './code-options';
import { makeEquipment, makeGroup } from './fixtures';
import {
  carriedFrom,
  emptyCarriedValues,
  emptyEquipmentFormValues,
  emptyGroupFormValues,
  equipmentToFormValues,
  groupToFormValues,
  isSameEquipmentValues,
  isSameGroupValues,
  toEquipmentCreate,
  toEquipmentUpdate,
  toGroupCreate,
  toGroupUpdate,
} from './mappers';

describe('groupToFormValues', () => {
  it('식별자를 문자열로 옮긴다 — 선택칸이 문자열을 다룬다', () => {
    const values = groupToFormValues(
      makeGroup(101, 'GRP-A', { plantId: 11, parentGroupId: 99, groupTypeCode: 'LINE' }),
    );

    expect(values).toEqual({
      plantId: '11',
      groupCode: 'GRP-A',
      groupName: 'GRP-A 그룹',
      groupTypeCode: 'LINE',
      parentGroupId: '99',
    });
  });

  /* 널과 없음을 다른 모양으로 두면 「고르지 않음」이 두 값이 되어 비교가 어긋난다. */
  it('상위그룹이 비었으면 빈 문자열 하나로 모은다', () => {
    expect(groupToFormValues(makeGroup(101, 'GRP-A')).parentGroupId).toBe('');
    expect(
      groupToFormValues(makeGroup(101, 'GRP-A', { parentGroupId: undefined })).parentGroupId,
    ).toBe('');
  });
});

describe('emptyGroupFormValues', () => {
  it('그룹유형만 자리표시 값으로 두고 나머지는 비운다', () => {
    expect(emptyGroupFormValues()).toEqual({
      plantId: '',
      groupCode: '',
      groupName: '',
      groupTypeCode: PENDING_CODE_VALUE,
      parentGroupId: '',
    });
  });
});

describe('toGroupUpdate', () => {
  const values = {
    plantId: '11',
    groupCode: '  GRP-A  ',
    groupName: '  프레스 구역  ',
    groupTypeCode: 'LINE',
    parentGroupId: '99',
  };

  it('코드와 이름의 앞뒤 공백을 떼고 보낸다', () => {
    const body = toGroupUpdate(values, true);

    expect(body.groupCode).toBe('GRP-A');
    expect(body.groupName).toBe('프레스 구역');
  });

  /*
   * ⭐ 계약이 「groupCode 는 참조가 0일 때만 보낼 수 있다」로 정했다.
   * 잠긴 코드를 되돌려 보내면 값이 같아도 서버가 거절할 수 있고, 화면은 사용자가
   * 건드리지도 않은 칸 때문에 저장이 막힌 이유를 설명하지 못한다.
   */
  it('코드가 잠겨 있으면 groupCode 키 자체를 싣지 않는다', () => {
    const body = toGroupUpdate(values, false);

    expect('groupCode' in body).toBe(false);
    expect(body.groupName).toBe('프레스 구역');
  });

  it('코드가 열려 있으면 groupCode 를 싣는다', () => {
    expect('groupCode' in toGroupUpdate(values, true)).toBe(true);
  });

  /* 공장은 등록으로만 정하고, 사용 여부는 별도 경로가 받는다 — 수정 본문에 자리가 없다. */
  it('공장과 사용 여부를 수정 본문에 싣지 않는다', () => {
    const body = toGroupUpdate(values, true);

    expect('plantId' in body).toBe(false);
    expect('isActive' in body).toBe(false);
  });

  it('상위그룹이 비었으면 널로 되돌린다', () => {
    expect(toGroupUpdate({ ...values, parentGroupId: '' }, true).parentGroupId).toBeNull();
  });

  it('상위그룹이 있으면 숫자로 보낸다', () => {
    expect(toGroupUpdate(values, true).parentGroupId).toBe(99);
  });
});

describe('toGroupCreate', () => {
  const values = {
    plantId: '11',
    groupCode: 'GRP-A',
    groupName: '프레스 구역',
    groupTypeCode: 'LINE',
    parentGroupId: '',
  };

  it('수정 본문에 공장을 더한 형태이고 공장은 숫자다', () => {
    expect(toGroupCreate(values)).toEqual({
      plantId: 11,
      groupCode: 'GRP-A',
      groupName: '프레스 구역',
      groupTypeCode: 'LINE',
      parentGroupId: null,
    });
  });

  /* 신규는 참조가 있을 수 없어 코드가 언제나 열려 있다 — 계약도 필수로 둔다. */
  it('신규 등록은 코드를 반드시 싣는다', () => {
    expect(toGroupCreate(values).groupCode).toBe('GRP-A');
  });
});

describe('isSameGroupValues', () => {
  const base = {
    plantId: '11',
    groupCode: 'GRP-A',
    groupName: '가',
    groupTypeCode: 'LINE',
    parentGroupId: '',
  };

  it('모든 칸이 같으면 참이다', () => {
    expect(isSameGroupValues(base, { ...base })).toBe(true);
  });

  it.each([
    ['plantId', '12'],
    ['groupCode', 'GRP-B'],
    ['groupName', '나'],
    ['groupTypeCode', 'WORK_AREA'],
    ['parentGroupId', '99'],
  ] as const)('%s 가 다르면 거짓이다', (field, value) => {
    expect(isSameGroupValues(base, { ...base, [field]: value })).toBe(false);
  });
});

describe('설비 매퍼', () => {
  const equipment = makeEquipment(2001, 'EQ-01', {
    processId: 21,
    productionLineId: 101,
    calibrationCycleTypeCode: 'MONTH',
    calibrationCycleInterval: 12,
    precisionValue: 0.01,
    precisionUomId: 31,
  });

  it('식별자를 문자열로 옮긴다', () => {
    expect(equipmentToFormValues(equipment)).toEqual({
      equipmentCode: 'EQ-01',
      equipmentName: 'EQ-01 설비',
      equipmentTypeCode: 'PENDING',
      productionLineId: '101',
      processId: '21',
      calibrationRequired: false,
    });
  });

  it('소속 그룹·공정이 비었으면 빈 문자열 하나로 모은다', () => {
    const values = equipmentToFormValues(
      makeEquipment(2001, 'EQ-01', { productionLineId: null, processId: undefined }),
    );

    expect(values.productionLineId).toBe('');
    expect(values.processId).toBe('');
  });

  /*
   * ⭐ 이 화면이 소유하지 않는 값. PUT 이 전체 교체라 빼면 계측기 마스터가 정한 것이 지워진다 —
   * 보이지도 고치지도 않지만 지우지도 않는다(공유계약 B-13).
   */
  it('계측기 마스터가 정한 값을 그대로 떠 둔다', () => {
    expect(carriedFrom(equipment)).toEqual({
      calibrationCycleTypeCode: 'MONTH',
      calibrationCycleInterval: 12,
      precisionValue: 0.01,
      precisionUomId: 31,
    });
  });

  it('그 값을 수정 본문에 그대로 되돌려 보낸다', () => {
    const body = toEquipmentUpdate(equipmentToFormValues(equipment), carriedFrom(equipment), true);

    expect(body.calibrationCycleTypeCode).toBe('MONTH');
    expect(body.calibrationCycleInterval).toBe(12);
    expect(body.precisionValue).toBe(0.01);
    expect(body.precisionUomId).toBe(31);
  });

  /* 계약이 「폐기는 :dispose 가, 사용 중지는 :deactivate 가 받는다」고 정했다. */
  it('운용 상태와 검교정 일자를 수정 본문에 싣지 않는다', () => {
    const body = toEquipmentUpdate(equipmentToFormValues(equipment), carriedFrom(equipment), true);

    expect('statusCode' in body).toBe(false);
    expect('lastCalibrationDate' in body).toBe(false);
    expect('calibrationDueDate' in body).toBe(false);
    expect('isActive' in body).toBe(false);
  });

  it('코드가 잠겨 있으면 equipmentCode 키 자체를 싣지 않는다', () => {
    const body = toEquipmentUpdate(equipmentToFormValues(equipment), carriedFrom(equipment), false);

    expect('equipmentCode' in body).toBe(false);
  });

  it('코드와 이름의 앞뒤 공백을 떼고 보낸다', () => {
    const body = toEquipmentUpdate(
      { ...equipmentToFormValues(equipment), equipmentCode: '  EQ-01  ', equipmentName: '  가  ' },
      carriedFrom(equipment),
      true,
    );

    expect(body.equipmentCode).toBe('EQ-01');
    expect(body.equipmentName).toBe('가');
  });

  it('등록 본문은 수정 본문에 공장을 더한 형태다', () => {
    const body = toEquipmentCreate(equipmentToFormValues(equipment), carriedFrom(equipment), 11);

    expect(body.plantId).toBe(11);
    expect(body.equipmentCode).toBe('EQ-01');
  });

  /* 좌측에서 고른 그룹 아래에 등록하는 것이 정상 경로다 — 사용자가 다시 고르게 하지 않는다. */
  it('신규 폼은 고른 그룹을 소속으로 넣어 둔다', () => {
    expect(emptyEquipmentFormValues('101').productionLineId).toBe('101');
    expect(emptyEquipmentFormValues('101').equipmentTypeCode).toBe(PENDING_CODE_VALUE);
  });

  it('신규 설비에는 계측기 마스터가 정한 값이 아직 없다', () => {
    expect(emptyCarriedValues()).toEqual({
      calibrationCycleTypeCode: null,
      calibrationCycleInterval: null,
      precisionValue: null,
      precisionUomId: null,
    });
  });

  it.each([
    ['equipmentCode', 'EQ-02'],
    ['equipmentName', '나'],
    ['equipmentTypeCode', 'OTHER'],
    ['productionLineId', '102'],
    ['processId', '22'],
  ] as const)('%s 가 다르면 고친 것으로 센다', (field, value) => {
    const base = equipmentToFormValues(equipment);

    expect(isSameEquipmentValues(base, { ...base, [field]: value })).toBe(false);
  });

  it('검교정 대상이 다르면 고친 것으로 센다', () => {
    const base = equipmentToFormValues(equipment);

    expect(isSameEquipmentValues(base, { ...base, calibrationRequired: true })).toBe(false);
    expect(isSameEquipmentValues(base, { ...base })).toBe(true);
  });
});
