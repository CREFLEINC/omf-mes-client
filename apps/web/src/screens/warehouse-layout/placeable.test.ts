import { describe, expect, it } from 'vitest';

import type { LayoutDraft } from './layout-draft';
import { highlightTarget, isPlaceable, splitPlaceable } from './placeable';
import { locationSeed } from './test-harness';

/**
 * 배치 대상 — 도면에는 구역 · 랙만 둔다(피처 006 2차 · FR-015 · FR-016 · R2-1 · R2-3).
 *
 * ⭐ 이 판정이 틀리면 조용하다. 셀을 대상으로 잘못 치면 편집 창이 셀 표식을 다시 그리고 저장 본문에 실어 보낸다 — 빠졌어야
 * 할 표식이 서버에 남는다. 목록에 없는 위치를 셀로 잘못 치면 중지된 위치의 표식이 말없이 지워진다.
 */

const SHAPE = { width: 0.1, height: 0.05, rotation: 0 };
const marker = (locationId: number) => ({ locationId, x: 0.5, y: 0.5, ...SHAPE });

const ZONE = locationSeed(1, 'Z01', { isLeaf: false });
const RACK = locationSeed(2, 'Z01-R001', {
  parentLocationId: 1,
  locationLevelCode: 'RACK',
  isLeaf: false,
});
const LEVEL = locationSeed(3, 'Z01-R001-L01', {
  parentLocationId: 2,
  locationLevelCode: 'LEVEL',
  isLeaf: false,
});
const CELL = locationSeed(4, 'Z01-R001-L01-C01', {
  parentLocationId: 3,
  locationLevelCode: 'CELL',
});
const STAGING = locationSeed(5, 'SYS-STAGING', { systemRoleCode: 'PUTAWAY_STAGING' });
const LOCATIONS = [ZONE, RACK, LEVEL, CELL, STAGING];

describe('isPlaceable', () => {
  it('US1-6 ⭐ 구역 · 랙은 배치 대상이고 층 · 셀은 아니다', () => {
    expect(isPlaceable(ZONE)).toBe(true);
    expect(isPlaceable(RACK)).toBe(true);
    expect(isPlaceable(LEVEL)).toBe(false);
    expect(isPlaceable(CELL)).toBe(false);
  });

  it('US1-6 서버가 만든 자리(적치 대기 · 창고 전체)는 구역 단계라 대상이다', () => {
    expect(isPlaceable(STAGING)).toBe(true);
  });
});

describe('splitPlaceable', () => {
  it('US1-6 ⭐ 층 · 셀 표식은 빠지고 그 수를 돌려준다', () => {
    const result = splitPlaceable([marker(1), marker(2), marker(3), marker(4)], LOCATIONS);

    expect(result.kept.map((item) => item.locationId)).toEqual([1, 2]);
    expect(result.dropped).toBe(2);
  });

  it('US1-6 ⭐ 목록에 없는 위치 id(중지 · 삭제 — 단계를 모름)는 남긴다', () => {
    const result = splitPlaceable([marker(99), marker(4)], LOCATIONS);

    expect(result.kept.map((item) => item.locationId)).toEqual([99]);
    expect(result.dropped).toBe(1);
  });

  it('US1-6 빠질 것이 없으면 받은 배열을 그대로 돌려준다 — 편집 상태가 「서버 배치가 새로 왔다」로 오인하지 않는다', () => {
    const markers: LayoutDraft = [marker(1), marker(2)];

    expect(splitPlaceable(markers, LOCATIONS).kept).toBe(markers);
  });
});

describe('highlightTarget', () => {
  it('US2-2 ⭐ 배치된 위치를 고르면 자기 자신이다', () => {
    expect(highlightTarget(2, [marker(1), marker(2)], LOCATIONS)).toBe(2);
  });

  it('US2-2 ⭐ 셀을 고르면 가장 가까운 배치된 조상(랙)이다', () => {
    expect(highlightTarget(4, [marker(1), marker(2)], LOCATIONS)).toBe(2);
  });

  it('US2-2 랙이 배치돼 있지 않으면 구역까지 올라간다', () => {
    expect(highlightTarget(4, [marker(1)], LOCATIONS)).toBe(1);
  });

  it('US2-2 배치된 조상이 없거나 고르지 않았으면 `null` 이다', () => {
    expect(highlightTarget(4, [], LOCATIONS)).toBeNull();
    expect(highlightTarget(null, [marker(1)], LOCATIONS)).toBeNull();
  });

  it('US2-2 부모가 서로를 가리켜도 멈춘다', () => {
    const loopA = locationSeed(21, 'LOOP-A', { parentLocationId: 22, locationLevelCode: 'CELL' });
    const loopB = locationSeed(22, 'LOOP-B', { parentLocationId: 21, locationLevelCode: 'CELL' });

    expect(highlightTarget(21, [], [loopA, loopB])).toBeNull();
  });
});
