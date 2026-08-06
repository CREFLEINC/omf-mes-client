import { describe, expect, it } from 'vitest';

import { validateCode, type CodeHierarchyContext } from './code-validation';
import { hierarchyFixtures, legacyThreeLevelFixtures } from './fixtures';
import type { CodeFormValues } from './types';

/**
 * DF-10(1001)은 하위 둘, DF-90(1006)은 하위 없음, DF-11(1002)은 상세 코드다.
 * `savedParentId`는 서버에 저장돼 있는 상위 값이며, 주지 않으면 대분류로 본다.
 */
const context = (editingId: number | null, savedParentId = ''): CodeHierarchyContext => ({
  items: hierarchyFixtures,
  editingId,
  savedParentId,
});

const values = (patch: Partial<CodeFormValues> = {}): CodeFormValues => ({
  code: 'DF-30',
  name: '신규',
  parentId: '',
  ...patch,
});

describe('validateCode — 필수 입력', () => {
  it('코드가 비어 있으면 막는다', () => {
    expect(validateCode(values({ code: '' }), context(null)).code).toBe('필수 입력 항목입니다.');
  });

  it('코드가 공백만이면 사유를 나눠서 낸다', () => {
    expect(validateCode(values({ code: '   ' }), context(null)).code).toBe(
      '코드는 공백만으로 지정할 수 없습니다.',
    );
  });

  it('명칭이 비었거나 공백만이면 막는다', () => {
    expect(validateCode(values({ name: '' }), context(null)).name).toBe('필수 입력 항목입니다.');
    expect(validateCode(values({ name: '   ' }), context(null)).name).toBe('필수 입력 항목입니다.');
  });

  it('필수 입력이 갖춰지고 상위가 비어 있으면 통과한다 — 대분류 등록', () => {
    expect(validateCode(values(), context(null))).toEqual({});
  });
});

describe('validateCode — 차단 R1 자기참조', () => {
  it('자기 자신을 상위로 지정할 수 없다', () => {
    expect(validateCode(values({ parentId: '1001' }), context(1001)).parentId).toBe(
      '자기 자신을 상위로 지정할 수 없습니다.',
    );
  });

  it('다른 대분류를 고르면 통과한다', () => {
    expect(validateCode(values({ parentId: '1004' }), context(1002))).toEqual({});
  });
});

describe('validateCode — 차단 R2 3계층 금지', () => {
  it('상세 코드를 상위로 지정할 수 없다', () => {
    expect(validateCode(values({ parentId: '1002' }), context(null)).parentId).toBe(
      '상위는 대분류만 지정할 수 있습니다. 계층은 2단계까지입니다.',
    );
  });

  it('대분류를 상위로 지정하면 통과한다', () => {
    expect(validateCode(values({ parentId: '1001' }), context(null))).toEqual({});
  });

  /*
   * 전체 목록이 잘리면 계층을 판정할 수 없다. 여기서 막아 버리면 고칠 길이 사라지므로
   * 서버 400에 맡기고 그 오류를 상위 선택칸 옆에 낸다.
   */
  it('목록에 없는 상위는 화면에서 막지 않는다', () => {
    expect(validateCode(values({ parentId: '9999' }), context(null))).toEqual({});
  });

  it('미사용 대분류를 상위로 고르는 것은 막지 않는다', () => {
    expect(validateCode(values({ parentId: '1006' }), context(null))).toEqual({});
  });
});

describe('validateCode — 차단 R3 하위가 있는 코드', () => {
  it('하위가 있는 코드에 상위를 새로 지정할 수 없다', () => {
    expect(validateCode(values({ parentId: '1004' }), context(1001)).parentId).toBe(
      '하위 코드가 있어 상위를 지정할 수 없습니다. 계층은 2단계까지입니다.',
    );
  });

  it('하위가 있어도 상위를 비워 두는 것은 막지 않는다', () => {
    expect(validateCode(values({ parentId: '' }), context(1001))).toEqual({});
  });

  it('하위가 없으면 상위를 지정할 수 있다', () => {
    expect(validateCode(values({ parentId: '1001' }), context(1006))).toEqual({});
  });

  it('자기참조가 더 정확한 사유이면 그쪽을 먼저 낸다', () => {
    expect(validateCode(values({ parentId: '1001' }), context(1001)).parentId).toBe(
      '자기 자신을 상위로 지정할 수 없습니다.',
    );
  });
});

/*
 * 이미 3계층인 기존 데이터의 중간 노드(DF-41 · 4002)는 상위와 하위를 동시에 갖는다.
 * R3가 「상위 값이 비어 있지 않다」만 보면 명칭조차 고칠 수 없고, 1차 방어가 상위 선택칸을
 * 잠그고 있어 빠져나갈 길도 없다. 그래서 R3는 **상위를 바꾸려 할 때만** 발동한다.
 */
describe('validateCode — R3는 상위를 바꾸려 할 때만 발동한다', () => {
  const legacyContext = (savedParentId: string): CodeHierarchyContext => ({
    items: legacyThreeLevelFixtures,
    editingId: 4002,
    savedParentId,
  });

  it('상위를 그대로 둔 채 명칭만 고치는 것은 막지 않는다', () => {
    const errors = validateCode(
      { code: 'DF-41', name: '체결 불량', parentId: '4001' },
      legacyContext('4001'),
    );

    expect(errors).toEqual({});
  });

  it('상위를 다른 값으로 바꾸려 하면 막는다', () => {
    const errors = validateCode(
      { code: 'DF-41', name: '체결', parentId: '4003' },
      legacyContext('4001'),
    );

    expect(errors.parentId).toBe('하위 코드가 있어 상위를 지정할 수 없습니다. 계층은 2단계까지입니다.');
  });

  it('상위를 비우는 것은 막지 않는다 — 계층이 얕아지는 방향이다', () => {
    expect(
      validateCode({ code: 'DF-41', name: '체결', parentId: '' }, legacyContext('4001')),
    ).toEqual({});
  });

  it('저장된 상위가 없던 코드에 상위를 새로 붙이면 여전히 막힌다', () => {
    const errors = validateCode(
      { code: 'DF-40', name: '조립', parentId: '4003' },
      { items: legacyThreeLevelFixtures, editingId: 4001, savedParentId: '' },
    );

    expect(errors.parentId).toBe('하위 코드가 있어 상위를 지정할 수 없습니다. 계층은 2단계까지입니다.');
  });

  it('상위를 그대로 둬도 자기참조이면 막는다 — R1이 먼저다', () => {
    const errors = validateCode(
      { code: 'DF-41', name: '체결', parentId: '4002' },
      legacyContext('4002'),
    );

    expect(errors.parentId).toBe('자기 자신을 상위로 지정할 수 없습니다.');
  });
});

describe('validateCode — 여러 오류', () => {
  it('입력 오류와 계층 차단을 함께 낸다', () => {
    const errors = validateCode(values({ code: '', name: '  ', parentId: '1002' }), context(null));

    expect(errors.code).toBe('필수 입력 항목입니다.');
    expect(errors.name).toBe('필수 입력 항목입니다.');
    expect(errors.parentId).toBe('상위는 대분류만 지정할 수 있습니다. 계층은 2단계까지입니다.');
  });
});
