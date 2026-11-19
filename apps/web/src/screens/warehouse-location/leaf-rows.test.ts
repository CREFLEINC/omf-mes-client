import { describe, expect, it } from 'vitest';

import { buildLeafLocationRows, parentPathOf, readLocationViewMode } from './leaf-rows';
import type { Location } from './types';

const loc = (over: Partial<Location> & Pick<Location, 'locationId' | 'locationCode'>): Location =>
  ({
    warehouseId: 1,
    parentLocationId: null,
    locationName: over.locationCode,
    isActive: true,
    aliasName: null,
    locationLevelCode: null,
    isLeaf: false,
    systemRoleCode: null,
    hasItemRestriction: false,
    itemRestricted: false,
    ...over,
  }) as Location;

const ZONE = loc({
  locationId: 1,
  locationCode: 'Z01',
  locationLevelCode: 'ZONE',
  aliasName: 'A구역',
});
const RACK = loc({
  locationId: 2,
  locationCode: 'Z01-R001',
  locationLevelCode: 'RACK',
  parentLocationId: 1,
  aliasName: '1번 랙',
});
const RACK_EMPTY = loc({
  locationId: 3,
  locationCode: 'Z01-R002',
  locationLevelCode: 'RACK',
  parentLocationId: 1,
  isLeaf: true,
});
const LEVEL_WITH_CELLS = loc({
  locationId: 4,
  locationCode: 'Z01-R001-L01',
  locationLevelCode: 'LEVEL',
  parentLocationId: 2,
});
const CELL = loc({
  locationId: 5,
  locationCode: 'Z01-R001-L01-C01',
  locationLevelCode: 'CELL',
  parentLocationId: 4,
  isLeaf: true,
  aliasName: '1칸',
});
const LEVEL = loc({
  locationId: 6,
  locationCode: 'Z01-R001-L02',
  locationLevelCode: 'LEVEL',
  parentLocationId: 2,
  isLeaf: true,
  aliasName: '2층',
});
const STAGING = loc({
  locationId: 7,
  locationCode: 'SYS-STAGING',
  locationLevelCode: 'ZONE',
  isLeaf: true,
  systemRoleCode: 'PUTAWAY_STAGING',
});
const ALL = [STAGING, LEVEL, CELL, LEVEL_WITH_CELLS, RACK_EMPTY, RACK, ZONE];

describe('목록 보기', () => {
  it('맨 아래 위치(층 · 셀 · 층 없는 랙)만 코드 차례로 한 줄씩 낸다', () => {
    const rows = buildLeafLocationRows(ALL);

    expect(rows.map((row) => row.location.locationCode)).toEqual([
      'Z01-R001-L01-C01',
      'Z01-R001-L02',
      'Z01-R002',
    ]);
    expect(rows.every((row) => row.depth === 0 && !row.hasChildren)).toBe(true);
  });

  /* 서버가 둔 적치 대기 · 층을 가진 랙 · 셀을 가진 층은 놓는 자리가 아니다. 층 없는 랙은 맨 아래다(서버 #1105). */
  it('서버가 둔 위치 · 하위가 있는 랙과 층은 빠진다', () => {
    const codes = buildLeafLocationRows(ALL).map((row) => row.location.locationCode);

    expect(codes).not.toContain('Z01-R001');
    expect(codes).not.toContain('SYS-STAGING');
    expect(codes).not.toContain('Z01-R001-L01');
  });

  it('상위 경로는 랙부터 바로 위까지 — 별칭이 있으면 별칭, 없으면 코드', () => {
    const byId = new Map(ALL.map((item) => [item.locationId, item] as const));

    expect(parentPathOf(CELL, byId)).toBe('1번 랙 › Z01-R001-L01');
    expect(parentPathOf(LEVEL, byId)).toBe('1번 랙');
  });

  it('주소의 보기 값은 leaf 만 적치 위치만이고 나머지는 전체 계층이다', () => {
    expect(readLocationViewMode('leaf')).toBe('leaf');
    expect(readLocationViewMode(null)).toBe('tree');
    expect(readLocationViewMode('x')).toBe('tree');
  });
});
