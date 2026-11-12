import { describe, expect, it } from 'vitest';

import { planBulkCreate } from './bulk-create-plan';
import type { Location } from './types';

const loc = (
  locationId: number,
  locationCode: string,
  parentLocationId: number | null,
  level: Location['locationLevelCode'],
  extra: Partial<Location> = {},
): Location => ({
  locationId,
  warehouseId: 1,
  parentLocationId,
  locationCode,
  locationName: locationCode,
  isActive: true,
  aliasName: null,
  locationLevelCode: level,
  isLeaf: false,
  systemRoleCode: null,
  hasItemRestriction: false,
  ...extra,
});

const STAGING = loc(1, 'SYS-STAGING', null, 'ZONE', { systemRoleCode: 'PUTAWAY_STAGING' });

/** Z01(랙 R001~R003) · Z02(구역에 재고) */
const WITH_ZONES: Location[] = [
  STAGING,
  loc(10, 'Z01', null, 'ZONE'),
  loc(11, 'Z01-R001', 10, 'RACK'),
  loc(12, 'Z01-R002', 10, 'RACK'),
  loc(13, 'Z01-R003', 10, 'RACK'),
  loc(20, 'Z02', null, 'ZONE'),
];

const newZones = (zoneCount: number, racks: number, levels: number, cells: number) =>
  ({
    mode: 'newZones',
    zoneCount,
    racksPerZone: racks,
    levelsPerRack: levels,
    cellsPerLevel: cells,
  }) as const;

const existingZones = (zoneIds: number[], racks: number, levels: number, cells: number) =>
  ({
    mode: 'existingZones',
    zoneIds,
    racksPerZone: racks,
    levelsPerRack: levels,
    cellsPerLevel: cells,
  }) as const;

describe('planBulkCreate', () => {
  it('US1-1 ⭐ 빈 창고 2×5×4×10 — 합계 452, 첫 Z01, 마지막 Z02-R005-L04-C10, 호출 12', () => {
    const plan = planBulkCreate(newZones(2, 5, 4, 10), [STAGING], new Set());

    expect(plan.error).toBeUndefined();
    expect(plan.totals).toEqual({ zones: 2, racks: 10, levels: 40, cells: 400, all: 452 });
    expect(plan.firstCode).toBe('Z01');
    expect(plan.lastCode).toBe('Z02-R005-L04-C10');
    expect(plan.steps).toHaveLength(12);
    expect(plan.steps[0]).toEqual({ kind: 'zone', index: 0, code: 'Z01' });
    expect(plan.steps[1]).toEqual({
      kind: 'rack',
      zoneRef: { kind: 'new', index: 0 },
      zoneCode: 'Z01',
      code: 'Z01-R001',
      levelCount: 4,
      cellCountPerLevel: 10,
    });
    expect(plan.steps[6]).toEqual({ kind: 'zone', index: 1, code: 'Z02' });
  });

  it('US1-3 Z01 · Z02 가 있는 창고에 구역 2 — Z03 · Z04 로 이어 붙는다', () => {
    const plan = planBulkCreate(newZones(2, 1, 1, 1), WITH_ZONES, new Set());

    expect(plan.firstCode).toBe('Z03');
    expect(plan.lastCode).toBe('Z04-R001-L01-C01');
    expect(plan.steps.filter((step) => step.kind === 'zone').map((step) => step.code)).toEqual([
      'Z03',
      'Z04',
    ]);
  });

  it('US1-4 층 0 이면 랙까지만(셀 입력은 0 으로 본다), 셀 0 이면 층까지만', () => {
    const rackOnly = planBulkCreate(newZones(1, 3, 0, 7), [], new Set());
    expect(rackOnly.totals).toEqual({ zones: 1, racks: 3, levels: 0, cells: 0, all: 4 });
    expect(rackOnly.lastCode).toBe('Z01-R003');
    expect(rackOnly.steps[1]).toMatchObject({ levelCount: 0, cellCountPerLevel: 0 });

    const levelOnly = planBulkCreate(newZones(1, 2, 3, 0), [], new Set());
    expect(levelOnly.totals).toEqual({ zones: 1, racks: 2, levels: 6, cells: 0, all: 9 });
    expect(levelOnly.lastCode).toBe('Z01-R002-L03');
  });

  it('US1-5 기존 구역 Z01(랙 3)에 랙 2×4×10 — Z01-R004 부터, 구역 단계 없음', () => {
    const plan = planBulkCreate(existingZones([10], 2, 4, 10), WITH_ZONES, new Set());

    expect(plan.error).toBeUndefined();
    expect(plan.totals).toEqual({ zones: 0, racks: 2, levels: 8, cells: 80, all: 90 });
    expect(plan.firstCode).toBe('Z01-R004');
    expect(plan.lastCode).toBe('Z01-R005-L04-C10');
    expect(plan.steps).toEqual([
      {
        kind: 'rack',
        zoneRef: { kind: 'existing', locationId: 10 },
        zoneCode: 'Z01',
        code: 'Z01-R004',
        levelCount: 4,
        cellCountPerLevel: 10,
      },
      {
        kind: 'rack',
        zoneRef: { kind: 'existing', locationId: 10 },
        zoneCode: 'Z01',
        code: 'Z01-R005',
        levelCount: 4,
        cellCountPerLevel: 10,
      },
    ]);
  });

  it('US1-6 막힌 구역은 고른 목록에서 빠진다 — 남는 구역이 없으면 empty', () => {
    const plan = planBulkCreate(existingZones([10, 20], 1, 1, 1), WITH_ZONES, new Set([20]));
    expect(plan.steps.map((step) => (step.kind === 'rack' ? step.zoneCode : null))).toEqual([
      'Z01',
    ]);

    expect(planBulkCreate(existingZones([20], 1, 1, 1), WITH_ZONES, new Set([20])).error).toBe(
      'empty',
    );
    expect(planBulkCreate(existingZones([], 1, 1, 1), WITH_ZONES, new Set()).error).toBe('empty');
  });

  it('EC-limit 셀 1,000 은 되고 1,001 은 overLimit', () => {
    expect(planBulkCreate(newZones(1, 10, 10, 10), [], new Set()).error).toBeUndefined();
    const over = planBulkCreate(newZones(1, 11, 7, 13), [], new Set());
    expect(over.totals.cells).toBe(1001);
    expect(over.error).toBe('overLimit');
  });

  it('EC-limit 셀이 1,000 안이어도 위치 전체가 1,200 을 넘으면 overLimit', () => {
    /* 구역 1 · 랙 100 · 층 1,100 · 셀 0 = 1,201 */
    const plan = planBulkCreate(newZones(1, 100, 11, 0), [], new Set());
    expect(plan.totals.all).toBe(1201);
    expect(plan.error).toBe('overLimit');
    expect(planBulkCreate(newZones(1, 99, 11, 0), [], new Set()).error).toBeUndefined();
  });

  it('범위 밖 입력은 range — 구역 1~99, 랙 1~999, 층 · 셀 0~99, 정수만', () => {
    for (const input of [
      newZones(0, 1, 1, 1),
      newZones(100, 1, 1, 1),
      newZones(1, 0, 1, 1),
      newZones(1, 1000, 0, 0),
      newZones(1, 1, -1, 1),
      newZones(1, 1, 100, 1),
      newZones(1, 1, 1, 100),
      newZones(1.5, 1, 1, 1),
      newZones(Number.NaN, 1, 1, 1),
    ]) {
      expect(planBulkCreate(input, [], new Set()).error).toBe('range');
    }
  });

  it('범위 밖 입력은 range — 기존 구역은 남은 R 번호(999) 안에서만', () => {
    const full = [loc(10, 'Z01', null, 'ZONE'), loc(11, 'Z01-R998', 10, 'RACK')];
    expect(planBulkCreate(existingZones([10], 1, 0, 0), full, new Set()).error).toBeUndefined();
    expect(planBulkCreate(existingZones([10], 2, 0, 0), full, new Set()).error).toBe('range');
  });
});
