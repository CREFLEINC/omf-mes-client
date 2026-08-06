import { describe, expect, it } from 'vitest';

import { hierarchyFixtures } from './fixtures';
import {
  ORPHAN_GROUP_KEY,
  categoryOptionsFor,
  childCountOf,
  groupKeyOf,
  hasChildren,
  indexById,
  isCategory,
  orderForGrouping,
} from './hierarchy';
import type { HierarchyCode } from './types';

const code = (partial: Partial<HierarchyCode> & Pick<HierarchyCode, 'id' | 'code'>): HierarchyCode =>
  ({
    name: partial.code,
    parentId: null,
    isActive: true,
    ...partial,
  }) satisfies HierarchyCode;

const codesOf = (items: readonly HierarchyCode[]): string[] => items.map((item) => item.code);

describe('isCategory', () => {
  it('상위가 없으면 대분류다', () => {
    expect(isCategory(code({ id: 1, code: 'A' }))).toBe(true);
  });

  it('상위가 있으면 대분류가 아니다', () => {
    expect(isCategory(code({ id: 2, code: 'B', parentId: 1 }))).toBe(false);
  });
});

describe('groupKeyOf', () => {
  const byId = indexById(hierarchyFixtures);

  it('대분류는 자기 자신이 그룹이다', () => {
    expect(groupKeyOf(hierarchyFixtures[0]!, byId)).toBe('1001');
  });

  it('상세 코드는 상위의 그룹에 든다', () => {
    expect(groupKeyOf(hierarchyFixtures[1]!, byId)).toBe('1001');
  });

  it('상위가 목록에 없으면 고아 그룹에 든다 — 사라지지 않는다', () => {
    expect(groupKeyOf(hierarchyFixtures[6]!, byId)).toBe(ORPHAN_GROUP_KEY);
  });

  it('고아 그룹 키는 빈 문자열이 아니다 — 빈 머리글이 그대로 렌더된다', () => {
    expect(ORPHAN_GROUP_KEY).not.toBe('');
  });

  /*
   * 이미 3계층인 기존 데이터. 표시를 위해 계층을 다시 계산하지 않고
   * 가리키는 상위의 그룹에 그대로 넣는다.
   */
  it('상위가 상세 코드여도 그 상위의 그룹에 그대로 넣는다', () => {
    const items = [
      code({ id: 1, code: 'A' }),
      code({ id: 2, code: 'A-1', parentId: 1 }),
      code({ id: 3, code: 'A-1-1', parentId: 2 }),
    ];

    expect(groupKeyOf(items[2]!, indexById(items))).toBe('2');
  });
});

describe('orderForGrouping', () => {
  it('대분류를 코드 오름차순으로 놓고 각 대분류 바로 뒤에 그 상세를 잇는다', () => {
    const ordered = orderForGrouping(hierarchyFixtures, indexById(hierarchyFixtures));

    expect(codesOf(ordered)).toEqual([
      'DF-10',
      'DF-11',
      'DF-12',
      'DF-20',
      'DF-21',
      'DF-90',
      'DF-91',
    ]);
  });

  it('고아 행은 맨 뒤에 모은다', () => {
    const items = [
      code({ id: 9, code: 'Z-1', parentId: 900 }),
      code({ id: 1, code: 'A' }),
      code({ id: 2, code: 'A-1', parentId: 1 }),
    ];

    expect(codesOf(orderForGrouping(items, indexById(items)))).toEqual(['A', 'A-1', 'Z-1']);
  });

  it('상세 코드는 그룹 안에서 코드 오름차순이다 — 받은 순서를 따르지 않는다', () => {
    const items = [
      code({ id: 3, code: 'A-3', parentId: 1 }),
      code({ id: 1, code: 'A' }),
      code({ id: 2, code: 'A-1', parentId: 1 }),
    ];

    expect(codesOf(orderForGrouping(items, indexById(items)))).toEqual(['A', 'A-1', 'A-3']);
  });

  it('입력 배열을 바꾸지 않는다', () => {
    const items = [code({ id: 2, code: 'B' }), code({ id: 1, code: 'A' })];
    orderForGrouping(items, indexById(items));

    expect(codesOf(items)).toEqual(['B', 'A']);
  });

  it('빈 목록은 빈 목록을 낸다', () => {
    expect(orderForGrouping([], indexById([]))).toEqual([]);
  });
});

describe('childCountOf · hasChildren', () => {
  it('하위 건수를 센다', () => {
    expect(childCountOf(hierarchyFixtures, 1001)).toBe(2);
    expect(childCountOf(hierarchyFixtures, 1004)).toBe(1);
    expect(childCountOf(hierarchyFixtures, 1006)).toBe(0);
  });

  it('하위 유무를 판정한다', () => {
    expect(hasChildren(hierarchyFixtures, 1001)).toBe(true);
    expect(hasChildren(hierarchyFixtures, 1006)).toBe(false);
  });

  /* 자기참조는 접힌 뒤이므로 parentId가 null이다 — 자기 자신을 하위로 세지 않는다. */
  it('자기참조를 접은 행은 자기 자신을 하위로 세지 않는다', () => {
    expect(childCountOf([code({ id: 7, code: 'S' })], 7)).toBe(0);
  });
});

describe('categoryOptionsFor', () => {
  it('대분류만 코드 오름차순으로 낸다 — 상세 코드는 상위가 될 수 없다', () => {
    const options = categoryOptionsFor(hierarchyFixtures, null);

    expect(codesOf(options)).toEqual(['DF-10', 'DF-20', 'DF-90']);
  });

  it('편집 중인 코드는 선택지에서 뺀다 — 자기 자신을 상위로 고를 수 없다', () => {
    const options = categoryOptionsFor(hierarchyFixtures, 1001);

    expect(codesOf(options)).toEqual(['DF-20', 'DF-90']);
  });

  it('미사용 대분류도 선택지 후보로 남긴다 — 표시 규칙은 화면이 정한다', () => {
    expect(codesOf(categoryOptionsFor(hierarchyFixtures, null))).toContain('DF-90');
  });
});
