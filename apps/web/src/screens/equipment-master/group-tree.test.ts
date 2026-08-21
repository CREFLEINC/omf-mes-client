import { describe, expect, it } from 'vitest';

import { buildGroupRows, selfAndDescendantIds } from './group-tree';
import { makeGroup } from './fixtures';
import type { EquipmentGroup } from './types';

const codesOf = (rows: { group: EquipmentGroup }[]): string[] =>
  rows.map((row) => row.group.groupCode);

describe('buildGroupRows', () => {
  it('계층을 깊이 우선으로 평탄화하고 형제를 코드 오름차순으로 정렬한다', () => {
    // B가 A보다 먼저 들어와도 형제 정렬은 코드 오름차순이어야 한다.
    const items = [
      makeGroup(2, 'B'),
      makeGroup(1, 'A'),
      makeGroup(12, 'A-02', { parentGroupId: 1 }),
      makeGroup(11, 'A-01', { parentGroupId: 1 }),
      makeGroup(111, 'A-01-01', { parentGroupId: 11 }),
    ];

    const rows = buildGroupRows(items, new Set([1, 11]));

    expect(codesOf(rows)).toEqual(['A', 'A-01', 'A-01-01', 'A-02', 'B']);
    expect(rows.map((row) => row.depth)).toEqual([0, 1, 2, 1, 0]);
  });

  it('접힌 노드의 하위는 결과에 넣지 않되 hasChildren은 참으로 낸다', () => {
    const items = [
      makeGroup(1, 'A'),
      makeGroup(11, 'A-01', { parentGroupId: 1 }),
      makeGroup(111, 'A-01-01', { parentGroupId: 11 }),
      makeGroup(2, 'B'),
    ];

    const rows = buildGroupRows(items, new Set());

    expect(codesOf(rows)).toEqual(['A', 'B']);
    expect(rows[0]?.hasChildren).toBe(true);
    expect(rows[1]?.hasChildren).toBe(false);
  });

  /*
   * 자기 자신을 부모로 갖는 행은 계층에서 의미가 없다.
   * 그것을 부모-자식으로 세면 하위가 없는데도 접기 버튼이 붙어 누를 것이 없는 컨트롤이 생긴다.
   */
  it('자기 자신을 부모로 갖는 행은 최상위로 두고 하위가 있다고 세지 않는다', () => {
    const items = [makeGroup(1001, 'A-01', { parentGroupId: 1001 }), makeGroup(1002, 'B-01')];

    const rows = buildGroupRows(items, new Set([1001]));

    expect(codesOf(rows)).toEqual(['A-01', 'B-01']);
    expect(rows[0]?.depth).toBe(0);
    expect(rows[0]?.hasChildren).toBe(false);
  });

  it('자기참조 행에도 실제 하위가 있으면 그 하위는 그대로 붙는다', () => {
    const items = [
      makeGroup(1, 'A', { parentGroupId: 1 }),
      makeGroup(11, 'A-01', { parentGroupId: 1 }),
    ];

    const rows = buildGroupRows(items, new Set([1]));

    expect(codesOf(rows)).toEqual(['A', 'A-01']);
    expect(rows[0]?.hasChildren).toBe(true);
    expect(rows[1]?.depth).toBe(1);
  });

  /*
   * ⚠ 데이터베이스가 막는 것은 직계 자기참조뿐이라 A→B→A 는 실제로 들어올 수 있다(스펙 §8-4).
   * 「있을 수 없다」로 두면 화면이 멈추므로 순환에서도 모든 항목이 정확히 한 번씩 나와야 한다.
   */
  it('고아는 최상위로 올리고 순환이 있어도 모든 항목이 정확히 한 번씩 나온다', () => {
    const orphan = makeGroup(9, 'Z', { parentGroupId: 404 }); // 부모 404가 목록에 없다
    const cycleA = makeGroup(5, 'C-1', { parentGroupId: 6 });
    const cycleB = makeGroup(6, 'C-2', { parentGroupId: 5 }); // 5 ↔ 6 순환
    const items = [makeGroup(1, 'A'), orphan, cycleA, cycleB];

    const rows = buildGroupRows(items, new Set([1, 5, 6, 9]));

    expect(rows).toHaveLength(items.length);
    expect(new Set(codesOf(rows)).size).toBe(items.length);
    expect(codesOf(rows)).toContain('Z');
    expect(codesOf(rows)).toContain('C-1');
    expect(codesOf(rows)).toContain('C-2');
  });

  /*
   * 접혀서 안 보이는 하위를 「닿지 못하는 항목」으로 오인해 최상위로 끌어올리면
   * 접기가 아무 일도 하지 않는 것처럼 보인다.
   */
  it('접힌 하위를 추가 최상위로 끌어올리지 않는다', () => {
    const items = [makeGroup(1, 'A'), makeGroup(11, 'A-01', { parentGroupId: 1 })];

    const rows = buildGroupRows(items, new Set());

    expect(codesOf(rows)).toEqual(['A']);
  });
});

describe('selfAndDescendantIds', () => {
  /*
   * 상위 그룹 선택지에서 이 집합을 빼면 순환이 만들어지지 않는다.
   * 데이터베이스는 직계 자기참조만 막으므로 나머지는 화면이 진다(스펙 §8-4).
   */
  it('자기 자신과 모든 후손을 담는다', () => {
    const items = [
      makeGroup(1, 'A'),
      makeGroup(11, 'A-01', { parentGroupId: 1 }),
      makeGroup(111, 'A-01-01', { parentGroupId: 11 }),
      makeGroup(2, 'B'),
    ];

    expect([...selfAndDescendantIds(items, 1)].sort()).toEqual([1, 11, 111]);
  });

  it('후손이 없으면 자기 자신만 담는다', () => {
    const items = [makeGroup(1, 'A'), makeGroup(2, 'B')];

    expect([...selfAndDescendantIds(items, 2)]).toEqual([2]);
  });

  /* 형제와 상위는 상위로 골라도 순환이 생기지 않는다 — 과하게 막으면 고를 것이 사라진다. */
  it('형제와 상위는 담지 않는다', () => {
    const items = [
      makeGroup(1, 'A'),
      makeGroup(11, 'A-01', { parentGroupId: 1 }),
      makeGroup(12, 'A-02', { parentGroupId: 1 }),
    ];

    const blocked = selfAndDescendantIds(items, 11);

    expect(blocked.has(12)).toBe(false);
    expect(blocked.has(1)).toBe(false);
  });

  /* 이미 순환이 든 자료에서 멈추면 폼이 영영 뜨지 않는다. */
  it('이미 순환이 들어 있어도 멈추지 않는다', () => {
    const items = [
      makeGroup(5, 'C-1', { parentGroupId: 6 }),
      makeGroup(6, 'C-2', { parentGroupId: 5 }),
    ];

    expect([...selfAndDescendantIds(items, 5)].sort()).toEqual([5, 6]);
  });

  it('자기참조 행을 자기 후손으로 세지 않는다', () => {
    const items = [makeGroup(1, 'A', { parentGroupId: 1 }), makeGroup(2, 'B')];

    expect([...selfAndDescendantIds(items, 1)]).toEqual([1]);
  });
});
