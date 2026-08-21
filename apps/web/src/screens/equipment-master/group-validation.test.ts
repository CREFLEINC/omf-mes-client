import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { GROUP_FORM_FIELDS, validateGroup } from './group-validation';
import type { GroupFormValues } from './types';

const t = messages.equipmentMaster.validation;

const valid: GroupFormValues = {
  plantId: '11',
  groupCode: 'GRP-A',
  groupName: '프레스 구역',
  groupTypeCode: 'LINE',
  parentGroupId: '',
};

const NONE: ReadonlySet<number> = new Set();

const create = { mode: 'create' as const, cycleBlockedIds: NONE };
const edit = { mode: 'edit' as const, cycleBlockedIds: NONE };

describe('GROUP_FORM_FIELDS', () => {
  /* 목록에 없는 필드명은 인라인 자리를 못 찾아 배너로 간다 — 삼켜지지 않게 폼 칸과 맞춘다. */
  it('폼이 가진 칸을 전부 담는다', () => {
    expect([...GROUP_FORM_FIELDS].sort()).toEqual(
      ['groupCode', 'groupName', 'groupTypeCode', 'parentGroupId', 'plantId'].sort(),
    );
  });
});

describe('validateGroup', () => {
  it('제대로 채운 값에는 오류가 없다', () => {
    expect(validateGroup(valid, create)).toEqual({});
    expect(validateGroup(valid, edit)).toEqual({});
  });

  it('코드·이름·유형이 비면 필수 오류를 낸다', () => {
    const errors = validateGroup(
      { ...valid, groupCode: '', groupName: '', groupTypeCode: '' },
      create,
    );

    expect(errors.groupCode).toBe(t.required);
    expect(errors.groupName).toBe(t.required);
    expect(errors.groupTypeCode).toBe(t.required);
  });

  /* 공백만 있는 코드는 눈으로 빈 칸과 구분되지 않는데 서버에는 다른 값으로 간다. */
  it('공백만 있는 코드는 필수와 다른 사유로 막는다', () => {
    expect(validateGroup({ ...valid, groupCode: '   ' }, create).groupCode).toBe(t.codeBlank);
  });

  it('공백만 있는 이름도 막는다', () => {
    expect(validateGroup({ ...valid, groupName: '   ' }, create).groupName).toBe(t.required);
  });

  /* 공장은 등록 후 바꿀 수 없어 수정 요청에 실리지 않는다 — 수정에서 비어 있어도 막지 않는다. */
  it('공장은 등록에서만 필수다', () => {
    expect(validateGroup({ ...valid, plantId: '' }, create).plantId).toBe(t.required);
    expect(validateGroup({ ...valid, plantId: '' }, edit).plantId).toBeUndefined();
  });

  /*
   * ⭐ 데이터베이스는 직계 자기참조만 막는다 — A→B→A 는 그대로 저장된다(스펙 §8-4).
   * 선택지에서 빼는 것만으로 끝내지 않는 이유는 선택지가 만들어진 뒤 목록이 갱신돼
   * 낡았을 수 있어서다.
   */
  it('상위로 고르면 순환이 생기는 그룹을 막는다', () => {
    const blocked = validateGroup(
      { ...valid, parentGroupId: '101' },
      { mode: 'edit', cycleBlockedIds: new Set([101, 111]) },
    );

    expect(blocked.parentGroupId).toBe(t.parentCycle);
  });

  it('순환을 만들지 않는 상위는 통과시킨다', () => {
    const ok = validateGroup(
      { ...valid, parentGroupId: '202' },
      { mode: 'edit', cycleBlockedIds: new Set([101, 111]) },
    );

    expect(ok.parentGroupId).toBeUndefined();
  });

  it('상위를 고르지 않으면 순환 검사를 하지 않는다', () => {
    const ok = validateGroup(
      { ...valid, parentGroupId: '' },
      { mode: 'edit', cycleBlockedIds: new Set([101]) },
    );

    expect(ok.parentGroupId).toBeUndefined();
  });
});
