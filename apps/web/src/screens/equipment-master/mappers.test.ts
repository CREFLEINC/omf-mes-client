import { describe, expect, it } from 'vitest';

import { PENDING_CODE_VALUE } from './code-options';
import { makeGroup } from './fixtures';
import {
  emptyGroupFormValues,
  groupToFormValues,
  isSameGroupValues,
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
