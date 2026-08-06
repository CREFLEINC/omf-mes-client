import { describe, expect, it } from 'vitest';

import { validateCode, type CodeHierarchyContext } from './code-validation';
import { deepHierarchyFixtures, hierarchyFixtures, legacyThreeLevelFixtures } from './fixtures';
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
 * R3가 「상위 값이 비어 있지 않다」만 보면 명칭조차 고칠 수 없다. 그래서 R3는
 * **상위를 바꾸려 할 때만** 발동한다.
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

/*
 * R2도 같은 기준을 따른다. 규칙이 엄해서가 아니라 **명칭만 고치려는 사람까지 막기** 때문이다.
 * 기존 값을 그대로 되돌려 보내는 것은 서버에 이미 있는 상태라 새 위반을 만들지 않는다.
 *
 * 특히 DF-52(5003)는 **상위가 상세 코드이면서 자기도 하위를 갖는다** — R2와 R3가 동시에 걸린다.
 * 둘 중 하나라도 「값이 비어 있지 않다」만 보면 두 규칙이 서로의 탈출구를 막아 그 행은 영구히 잠긴다.
 */
describe('validateCode — R2도 상위를 바꾸려 할 때만 발동한다', () => {
  const deepContext = (editingId: number, savedParentId: string): CodeHierarchyContext => ({
    items: deepHierarchyFixtures,
    editingId,
    savedParentId,
  });

  it('상위가 상세 코드여도 그대로 둔 채 명칭만 고치는 것은 막지 않는다', () => {
    expect(
      validateCode({ code: 'DF-53', name: '미세 기포 다수', parentId: '5003' }, deepContext(5004, '5003')),
    ).toEqual({});
  });

  it('상위를 다른 상세 코드로 바꾸려 하면 막는다', () => {
    expect(
      validateCode({ code: 'DF-53', name: '미세 기포', parentId: '5002' }, deepContext(5004, '5003'))
        .parentId,
    ).toBe('상위는 대분류만 지정할 수 있습니다. 계층은 2단계까지입니다.');
  });

  it('대분류를 새로 상위로 지정하는 정상 흐름은 통과한다', () => {
    expect(
      validateCode({ code: 'DF-53', name: '미세 기포', parentId: '5001' }, deepContext(5004, '5003')),
    ).toEqual({});
  });

  /** 이번 사고의 그 조합 — R2와 R3가 함께 걸리는 유일한 행이다. */
  it('상위가 상세 코드이면서 하위도 가진 행도 명칭만 고칠 수 있다', () => {
    expect(
      validateCode({ code: 'DF-52', name: '기포 다수', parentId: '5002' }, deepContext(5003, '5002')),
    ).toEqual({});
  });

  it('그 행이 상위를 바꾸려 하면 하위가 있다는 사유로 막힌다', () => {
    expect(
      validateCode({ code: 'DF-52', name: '기포', parentId: '5001' }, deepContext(5003, '5002'))
        .parentId,
    ).toBe('하위 코드가 있어 상위를 지정할 수 없습니다. 계층은 2단계까지입니다.');
  });
});

/*
 * 등록에는 **저장된 상위가 없다.** 폼의 기준값은 「상세 추가」가 심은 씨앗이지 서버 값이 아니다.
 * 호출자가 그 씨앗을 `savedParentId`로 넘겨도 규칙이 그대로 믿으면 3계층이 새로 만들어진다.
 * 규칙 쪽이 정본이라 여기서 막는다 — 호출자가 무엇을 넘기든 뚫리지 않아야 한다.
 */
describe('validateCode — 등록에서는 저장된 상위를 보지 않는다', () => {
  const createContext = (savedParentId: string): CodeHierarchyContext => ({
    items: hierarchyFixtures,
    editingId: null,
    savedParentId,
  });

  it('씨앗이 상세 코드이면 그 값을 그대로 넘겨도 R2가 막는다', () => {
    expect(
      validateCode({ code: 'DF-99', name: '신규', parentId: '1002' }, createContext('1002'))
        .parentId,
    ).toBe('상위는 대분류만 지정할 수 있습니다. 계층은 2단계까지입니다.');
  });

  it('씨앗을 빈 값으로 넘겨도 같은 결과다 — 호출자에 기대지 않는다', () => {
    expect(
      validateCode({ code: 'DF-99', name: '신규', parentId: '1002' }, createContext('')).parentId,
    ).toBe('상위는 대분류만 지정할 수 있습니다. 계층은 2단계까지입니다.');
  });

  it('대분류를 씨앗으로 한 상세 등록은 통과한다', () => {
    expect(
      validateCode({ code: 'DF-99', name: '신규', parentId: '1001' }, createContext('1001')),
    ).toEqual({});
  });

  /* 하위가 있는 대분류 밑에 상세를 하나 더 만드는 것은 2계층 그대로다 — R3의 대상이 아니다. */
  it('씨앗이 하위를 가진 대분류여도 등록은 통과한다', () => {
    expect(
      validateCode({ code: 'DF-13', name: '눌림' , parentId: '1001' }, createContext('1001')),
    ).toEqual({});
  });

  it('상위를 비운 대분류 등록은 그대로 통과한다', () => {
    expect(validateCode({ code: 'DF-99', name: '신규', parentId: '' }, createContext(''))).toEqual(
      {},
    );
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
