import { isSystemLocation } from '../../patterns/system-location';
import { issueLocationCode, locationCodeAt, maxLocationSequence } from './location-code';
import type { Location } from './types';

/**
 * 위치 일괄 생성 계획(#267 · 계약 §2 · plan R-1 ~ R-4) — 화면 입력 네 수로 서버에 부를 단계를 짓는다. 순수 함수다.
 *
 * 새 구역은 구역 하나 → 그 구역의 랙 j 개 순서, 기존 구역은 고른 구역마다 랙만이다. 랙 한 단계가 그 층 · 셀까지 한 번에
 * 만든다(`POST /mdm/locations:rack`). 코드는 서버가 짓고 화면은 같은 규칙으로 미리 보인다(`location-code.ts`).
 */

export const BULK_LIMITS = {
  zones: { min: 1, max: 99 },
  racks: { min: 1, max: 999 },
  levels: { min: 0, max: 99 },
  cells: { min: 0, max: 99 },
  /** 한 번에 만드는 셀 · 위치 전체(spec 가정, R-4). */
  maxCells: 1000,
  maxAll: 1200,
} as const;

interface Counts {
  racksPerZone: number;
  levelsPerRack: number;
  cellsPerLevel: number;
}

export type BulkCreateInput =
  | ({ mode: 'newZones'; zoneCount: number } & Counts)
  | ({ mode: 'existingZones'; zoneIds: readonly number[] } & Counts);

export type BulkZoneRef = { kind: 'new'; index: number } | { kind: 'existing'; locationId: number };

export type BulkStep =
  | { kind: 'zone'; index: number; code: string }
  | {
      kind: 'rack';
      zoneRef: BulkZoneRef;
      zoneCode: string;
      code: string;
      /** 0 이면 랙만(`POST /mdm/locations`). */
      levelCount: number;
      cellCountPerLevel: number;
    };

export interface BulkTotals {
  zones: number;
  racks: number;
  levels: number;
  cells: number;
  all: number;
}

export type BulkPlanError = 'overLimit' | 'empty' | 'range';

export interface BulkPlan {
  totals: BulkTotals;
  firstCode: string | null;
  lastCode: string | null;
  steps: BulkStep[];
  error?: BulkPlanError;
}

const inRange = (value: number, { min, max }: { min: number; max: number }): boolean =>
  Number.isInteger(value) && value >= min && value <= max;

const EMPTY_TOTALS: BulkTotals = { zones: 0, racks: 0, levels: 0, cells: 0, all: 0 };

/** 랙 코드 하나가 만들 맨 마지막 코드 — 셀 · 층 · 랙 가운데 가장 깊은 것. */
const deepestCode = (rackCode: string, levels: number, cells: number): string => {
  if (levels === 0) return rackCode;
  const level = locationCodeAt('LEVEL', rackCode, levels);
  return cells === 0 ? level : locationCodeAt('CELL', level, cells);
};

/** 기존 구역에서 다음 랙 번호 — 꺼진 것도 센다(서버 규칙). */
const nextRackNo = (zone: Location, items: readonly Location[]): number =>
  maxLocationSequence(
    'RACK',
    zone.locationCode,
    items
      .filter((item) => item.parentLocationId === zone.locationId && !isSystemLocation(item))
      .map((item) => item.locationCode),
  ) + 1;

export const planBulkCreate = (
  input: BulkCreateInput,
  items: readonly Location[],
  blockedZoneIds: ReadonlySet<number>,
): BulkPlan => {
  const levels = input.levelsPerRack;
  /* 층 0 이면 셀 입력은 막히고 0 으로 본다. */
  const cells = levels === 0 ? 0 : input.cellsPerLevel;
  const racks = input.racksPerZone;

  const countsValid =
    inRange(racks, BULK_LIMITS.racks) &&
    inRange(levels, BULK_LIMITS.levels) &&
    inRange(cells, BULK_LIMITS.cells);

  const zones: { ref: BulkZoneRef; code: string; firstRackNo: number }[] = [];
  const steps: BulkStep[] = [];

  if (input.mode === 'newZones') {
    if (!countsValid || !inRange(input.zoneCount, BULK_LIMITS.zones)) {
      return { totals: EMPTY_TOTALS, firstCode: null, lastCode: null, steps, error: 'range' };
    }
    const first = issueLocationCode('ZONE', null, items);
    const firstNo = Number(first.slice(1));
    for (let index = 0; index < input.zoneCount; index += 1) {
      zones.push({
        ref: { kind: 'new', index },
        code: locationCodeAt('ZONE', null, firstNo + index),
        firstRackNo: 1,
      });
    }
  } else {
    for (const zoneId of input.zoneIds) {
      const zone = items.find((item) => item.locationId === zoneId);
      if (zone === undefined || blockedZoneIds.has(zoneId)) continue;
      zones.push({
        ref: { kind: 'existing', locationId: zoneId },
        code: zone.locationCode,
        firstRackNo: nextRackNo(zone, items),
      });
    }
    if (!countsValid) {
      return { totals: EMPTY_TOTALS, firstCode: null, lastCode: null, steps, error: 'range' };
    }
    if (zones.length === 0) {
      return { totals: EMPTY_TOTALS, firstCode: null, lastCode: null, steps, error: 'empty' };
    }
    if (zones.some((zone) => zone.firstRackNo + racks - 1 > BULK_LIMITS.racks.max)) {
      return { totals: EMPTY_TOTALS, firstCode: null, lastCode: null, steps, error: 'range' };
    }
  }

  for (const zone of zones) {
    if (zone.ref.kind === 'new')
      steps.push({ kind: 'zone', index: zone.ref.index, code: zone.code });
    for (let j = 0; j < racks; j += 1) {
      steps.push({
        kind: 'rack',
        zoneRef: zone.ref,
        zoneCode: zone.code,
        code: locationCodeAt('RACK', zone.code, zone.firstRackNo + j),
        levelCount: levels,
        cellCountPerLevel: cells,
      });
    }
  }

  const zoneCount = input.mode === 'newZones' ? zones.length : 0;
  const rackCount = zones.length * racks;
  const totals: BulkTotals = {
    zones: zoneCount,
    racks: rackCount,
    levels: rackCount * levels,
    cells: rackCount * levels * cells,
    all: zoneCount + rackCount + rackCount * levels + rackCount * levels * cells,
  };
  const last = steps[steps.length - 1];
  const plan: BulkPlan = {
    totals,
    firstCode: steps[0]?.code ?? null,
    lastCode:
      last === undefined
        ? null
        : last.kind === 'zone'
          ? last.code
          : deepestCode(last.code, levels, cells),
    steps,
  };
  return totals.cells > BULK_LIMITS.maxCells || totals.all > BULK_LIMITS.maxAll
    ? { ...plan, error: 'overLimit' }
    : plan;
};
