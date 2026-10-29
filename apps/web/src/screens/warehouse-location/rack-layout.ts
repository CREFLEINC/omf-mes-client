import type { Location } from './types';

/**
 * 랙의 층 · 셀 짜기(사용자 지시 2026-10-29) — 랙 밑에 층 N개, 층마다 셀 M개.
 *
 * 있는 층 · 셀은 그대로 두고 모자란 것만 만든다. 줄이는 것은 여기서 하지 않는다 — 지울 위치는 하나씩 사용 중지한다.
 * 코드는 상위 코드 뒤에 두 자리 번호(`R01-01`, `R01-01-03`)를 붙이고, 창고 안에서 이미 쓰는 코드면 다음 번호로 넘긴다
 * (코드는 창고 안에서 유일 — `uq_location`).
 */

/** 한 번에 짤 수 있는 층 · 셀 수의 위 끝. 잘못 친 큰 수로 수천 건을 만들지 않게. */
export const RACK_LAYOUT_MAX_LEVELS = 20;
export const RACK_LAYOUT_MAX_CELLS = 50;

export interface RackLayoutEntry {
  kind: 'LEVEL' | 'CELL';
  locationCode: string;
  locationName: string;
  /** 이미 있는 상위 — 있으면 이것으로 단다. */
  parentLocationId: number | null;
  /** 같은 계획에서 새로 만드는 층 — 그 층을 먼저 만든 뒤 받은 번호로 단다. */
  parentCode: string | null;
}

export interface RackLayoutCurrent {
  levelCount: number;
  /** 층마다 셀 수 가운데 가장 큰 것 — 셀 수 칸의 처음 값. */
  cellCount: number;
}

const pad = (n: number): string => String(n).padStart(2, '0');

const childrenOf = (items: readonly Location[], parentId: number): Location[] =>
  items
    .filter((item) => item.parentLocationId === parentId && item.locationId !== parentId)
    .sort((a, b) => a.locationCode.localeCompare(b.locationCode));

export const currentRackLayout = (
  rack: Location,
  items: readonly Location[],
): RackLayoutCurrent => {
  const levels = childrenOf(items, rack.locationId);
  return {
    levelCount: levels.length,
    cellCount: Math.max(0, ...levels.map((level) => childrenOf(items, level.locationId).length)),
  };
};

/** 쓰지 않은 코드 — `prefix-NN` 에서 `start` 부터 올라가며 찾는다. 찾은 것은 `used` 에 넣는다. */
const nextCode = (prefix: string, start: number, used: Set<string>): string => {
  let n = start;
  while (used.has(`${prefix}-${pad(n)}`)) n += 1;
  const code = `${prefix}-${pad(n)}`;
  used.add(code);
  return code;
};

/** 만들 층 · 셀 — 층을 먼저, 그 층의 셀을 뒤에 둔다(만드는 순서 그대로). */
export const planRackLayout = (
  rack: Location,
  items: readonly Location[],
  levelCount: number,
  cellCount: number,
): RackLayoutEntry[] => {
  const used = new Set(items.map((item) => item.locationCode));
  const existingLevels = childrenOf(items, rack.locationId);
  const entries: RackLayoutEntry[] = [];

  for (let index = 0; index < Math.max(levelCount, existingLevels.length); index += 1) {
    const existing = existingLevels[index];
    const levelNo = index + 1;
    let levelCode: string;
    let levelName: string;
    let levelId: number | null = null;
    let existingCells = 0;

    if (existing !== undefined) {
      levelCode = existing.locationCode;
      levelName = existing.locationName;
      levelId = existing.locationId;
      existingCells = childrenOf(items, existing.locationId).length;
    } else {
      levelCode = nextCode(rack.locationCode, levelNo, used);
      levelName = `${rack.locationName} ${String(levelNo)}층`;
      entries.push({
        kind: 'LEVEL',
        locationCode: levelCode,
        locationName: levelName,
        parentLocationId: rack.locationId,
        parentCode: null,
      });
    }

    for (let cellNo = existingCells + 1; cellNo <= cellCount; cellNo += 1) {
      entries.push({
        kind: 'CELL',
        locationCode: nextCode(levelCode, cellNo, used),
        locationName: `${levelName} ${String(cellNo)}번`,
        parentLocationId: levelId,
        parentCode: levelId === null ? levelCode : null,
      });
    }
  }

  return entries;
};
