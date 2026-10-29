import { compareLocationCodes, locationCodeAt, maxLocationSequence } from './location-code';
import type { Location } from './types';

/**
 * 랙의 층 · 셀 짜기(사용자 지시 2026-10-29) — 랙 밑에 층 N개, 층마다 셀 M개.
 *
 * 늘리면 모자란 것만 만들고(`planRackLayout`), 줄이면 넘치는 층 · 셀을 지운다(`planRackRemovals`, 서버 위치 ③b).
 * 새 랙은 서버가 한 번에 만든다(POST /mdm/locations:rack).
 * 코드는 서버 발행 규칙(`location-code.ts`)대로 미리 짓는다 — 층 `{랙}-L01`, 셀 `{층}-C01`, 같은 상위 안 가장 큰 번호 + 1.
 * 이름은 짧게 `1층` · `1번`.
 */

/** 층 · 셀 수의 위 끝 — 서버 한도(위치 ③b)와 같다. 셀은 0 이면 층이 맨 아래 위치다. */
export const RACK_LAYOUT_MAX_LEVELS = 99;
export const RACK_LAYOUT_MAX_CELLS = 99;

export interface RackLayoutEntry {
  kind: 'LEVEL' | 'CELL';
  locationCode: string;
  locationName: string;
  /** 이미 있는 상위 — 있으면 이것으로 단다. */
  parentLocationId: number | null;
  /** 같은 계획에서 새로 만드는 층 — 그 층을 먼저 만든 뒤 받은 번호로 단다. */
  parentCode: string | null;
}

const childrenOf = (items: readonly Location[], parentId: number): Location[] =>
  items
    .filter((item) => item.parentLocationId === parentId && item.locationId !== parentId)
    .sort((a, b) => compareLocationCodes(a.locationCode, b.locationCode));

/** 랙의 지금 모양 — 층 수와 층마다 셀 수 가운데 가장 큰 것. 고칠 때 칸의 처음 값이다. */
export const currentRackLayout = (
  rack: Location,
  items: readonly Location[],
): { levelCount: number; cellCount: number } => {
  const levels = childrenOf(items, rack.locationId);
  return {
    levelCount: levels.length,
    cellCount: Math.max(0, ...levels.map((level) => childrenOf(items, level.locationId).length)),
  };
};

/** 만들 층 · 셀 — 층을 먼저, 그 층의 셀을 뒤에 둔다(만드는 순서 그대로). */
export const planRackLayout = (
  rack: Location,
  items: readonly Location[],
  levelCount: number,
  cellCount: number,
): RackLayoutEntry[] => {
  const existingLevels = childrenOf(items, rack.locationId);
  const entries: RackLayoutEntry[] = [];
  let nextLevelNo =
    maxLocationSequence(
      'LEVEL',
      rack.locationCode,
      existingLevels.map((level) => level.locationCode),
    ) + 1;

  for (let index = 0; index < Math.max(levelCount, existingLevels.length); index += 1) {
    const existing = existingLevels[index];
    let levelCode: string;
    let levelId: number | null = null;
    let existingCells: Location[] = [];

    if (existing !== undefined) {
      levelCode = existing.locationCode;
      levelId = existing.locationId;
      existingCells = childrenOf(items, existing.locationId);
    } else {
      levelCode = locationCodeAt('LEVEL', rack.locationCode, nextLevelNo);
      nextLevelNo += 1;
      entries.push({
        kind: 'LEVEL',
        locationCode: levelCode,
        locationName: `${String(index + 1)}층`,
        parentLocationId: rack.locationId,
        parentCode: null,
      });
    }

    let nextCellNo =
      maxLocationSequence(
        'CELL',
        levelCode,
        existingCells.map((cell) => cell.locationCode),
      ) + 1;
    for (let cellNo = existingCells.length + 1; cellNo <= cellCount; cellNo += 1) {
      entries.push({
        kind: 'CELL',
        locationCode: locationCodeAt('CELL', levelCode, nextCellNo),
        locationName: `${String(cellNo)}번`,
        parentLocationId: levelId,
        parentCode: levelId === null ? levelCode : null,
      });
      nextCellNo += 1;
    }
  }

  return entries;
};

/**
 * 줄일 때 지울 위치 — 위층부터 넘치는 층(그 밑의 셀은 서버가 함께 지운다), 남는 층에서는 뒤 번호부터 넘치는 셀.
 * 하나라도 어디서 쓰였으면 서버가 거절한다(400 STATE_LOCKED) — 그때는 사용 중지를 쓴다.
 */
export const planRackRemovals = (
  rack: Location,
  items: readonly Location[],
  levelCount: number,
  cellCount: number,
): Location[] => {
  const levels = childrenOf(items, rack.locationId);
  return [
    ...levels.slice(levelCount).reverse(),
    ...levels
      .slice(0, levelCount)
      .flatMap((level) => childrenOf(items, level.locationId).slice(cellCount).reverse()),
  ];
};

export interface RackGridCell {
  locationCode: string;
  /** 이번에 새로 만든다 — 아니면 이미 있는 셀. */
  isNew: boolean;
  /** 이번에 지운다(줄일 때). */
  isRemoved: boolean;
}

export interface RackGridRow {
  levelNo: number;
  locationCode: string;
  isNew: boolean;
  isRemoved: boolean;
  cells: RackGridCell[];
}

/**
 * 표로 보이는 랙 — 행이 층, 열이 셀(사용자 지시 2026-10-29). 실제 랙처럼 위층을 위에 둔다.
 * 있는 층 · 셀과 이번에 만들 것(`plan`)을 함께 늘어놓는다.
 */
export const rackLayoutGrid = (
  rack: Location,
  items: readonly Location[],
  plan: readonly RackLayoutEntry[],
  removals: readonly Location[] = [],
): RackGridRow[] => {
  const removed = new Set(removals.map((item) => item.locationId));
  const rows: RackGridRow[] = childrenOf(items, rack.locationId).map((level) => ({
    levelNo: 0,
    locationCode: level.locationCode,
    isNew: false,
    isRemoved: removed.has(level.locationId),
    cells: childrenOf(items, level.locationId).map((cell) => ({
      locationCode: cell.locationCode,
      isNew: false,
      isRemoved: removed.has(level.locationId) || removed.has(cell.locationId),
    })),
  }));
  const byCode = new Map(rows.map((row) => [row.locationCode, row]));
  const byId = new Map(
    childrenOf(items, rack.locationId).map((level) => [level.locationId, level.locationCode]),
  );

  for (const entry of plan) {
    if (entry.kind === 'LEVEL') {
      const row: RackGridRow = {
        levelNo: 0,
        locationCode: entry.locationCode,
        isNew: true,
        isRemoved: false,
        cells: [],
      };
      rows.push(row);
      byCode.set(entry.locationCode, row);
      continue;
    }
    const levelCode =
      entry.parentCode ??
      (entry.parentLocationId === null ? undefined : byId.get(entry.parentLocationId));
    byCode
      .get(levelCode ?? '')
      ?.cells.push({ locationCode: entry.locationCode, isNew: true, isRemoved: false });
  }

  return rows.map((row, index) => ({ ...row, levelNo: index + 1 })).reverse();
};
