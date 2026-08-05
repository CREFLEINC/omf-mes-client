import { describe, expect, it } from 'vitest';

import { buildLocationRows } from './location-tree';
import type { Location } from './types';

/** 필수 필드를 채운 팩토리 — 회피 캐스팅(as never) 없이 계약 타입을 그대로 만족시킨다. */
const makeLocation = (
  locationId: number,
  locationCode: string,
  parentLocationId: number | null = null,
): Location => ({
  locationId,
  warehouseId: 1,
  parentLocationId,
  locationCode,
  locationName: `${locationCode} 위치`,
  locationTypeCode: 'PLACEHOLDER',
  allowMixedItem: true,
  allowMixedLot: true,
  isActive: true,
});

const codesOf = (rows: { location: Location }[]): string[] =>
  rows.map((row) => row.location.locationCode);

describe('buildLocationRows', () => {
  it('계층을 깊이 우선으로 평탄화하고 형제를 코드 오름차순으로 정렬한다', () => {
    // B가 A보다 먼저 들어와도 형제 정렬은 코드 오름차순이어야 한다.
    const items = [
      makeLocation(2, 'B'),
      makeLocation(1, 'A'),
      makeLocation(12, 'A-02', 1),
      makeLocation(11, 'A-01', 1),
      makeLocation(111, 'A-01-01', 11),
    ];
    const expanded = new Set([1, 11]);

    const rows = buildLocationRows(items, expanded);

    expect(codesOf(rows)).toEqual(['A', 'A-01', 'A-01-01', 'A-02', 'B']);
    expect(rows.map((row) => row.depth)).toEqual([0, 1, 2, 1, 0]);
  });

  it('접힌 노드의 하위는 결과에 넣지 않되 hasChildren은 참으로 낸다', () => {
    const items = [
      makeLocation(1, 'A'),
      makeLocation(11, 'A-01', 1),
      makeLocation(111, 'A-01-01', 11),
      makeLocation(2, 'B'),
    ];

    const rows = buildLocationRows(items, new Set());

    expect(codesOf(rows)).toEqual(['A', 'B']);

    const rootA = rows[0];
    const rootB = rows[1];
    expect(rootA?.hasChildren).toBe(true);
    expect(rootB?.hasChildren).toBe(false);
  });

  it('고아는 최상위로 올리고 순환이 있어도 모든 항목이 정확히 한 번씩 나온다', () => {
    const orphan = makeLocation(9, 'Z', 404); // 부모 404가 목록에 없다
    const cycleA = makeLocation(5, 'C-1', 6);
    const cycleB = makeLocation(6, 'C-2', 5); // 5 ↔ 6 순환
    const items = [makeLocation(1, 'A'), orphan, cycleA, cycleB];

    const rows = buildLocationRows(items, new Set([1, 5, 6, 9]));

    expect(rows).toHaveLength(items.length);
    expect(new Set(codesOf(rows)).size).toBe(items.length);
    expect(codesOf(rows)).toContain('Z');
    expect(codesOf(rows)).toContain('C-1');
    expect(codesOf(rows)).toContain('C-2');
  });
});
