import { compareLocationCodes, type LocationTreeRow } from '../../patterns/location-tree';
import type { Location } from './types';

/** Location 탭의 보기 — 전체 계층(기본) · 적치 위치만. 주소의 `view` 에 싣는다. */
export type LocationViewMode = 'tree' | 'leaf';

export const LOCATION_VIEW_PARAM = 'view';

export const readLocationViewMode = (raw: string | null): LocationViewMode =>
  raw === 'leaf' ? 'leaf' : 'tree';

/**
 * 물건을 놓을 수 있는 단계 — 랙 · 층 · 셀. 구역은 묶음이다. 랙은 층이 없을 때만 맨 아래 위치가 된다(서버 #1105 —
 * 층 0 으로 만든 랙).
 */
const STORABLE_LEVELS = new Set<Location['locationLevelCode']>(['RACK', 'LEVEL', 'CELL']);

/**
 * **목록 보기** — 하위가 없는 맨 아래 위치(층 · 셀, 층 없는 랙)만(사용자 지시 2026-11-19 — 실제로 물건을 놓는 자리만).
 * 계층 없이 한 줄씩, 코드 차례로 낸다. 서버가 둔 위치(적치 대기 · 창고 전체)는 구역 단계라 빠진다.
 */
export const buildLeafLocationRows = (items: readonly Location[]): LocationTreeRow[] =>
  items
    .filter((item) => item.isLeaf && STORABLE_LEVELS.has(item.locationLevelCode))
    .sort((a, b) => compareLocationCodes(a.locationCode, b.locationCode))
    .map((location) => ({ location, depth: 0, hasChildren: false }));

/** 위치를 사람이 알아보는 글 — 별칭이 있으면 별칭, 없으면 코드. */
export const locationShownLabel = (
  location: Pick<Location, 'locationCode' | 'aliasName'>,
): string => location.aliasName?.trim() || location.locationCode;

/**
 * 말단의 상위 경로(랙부터 바로 위까지) — 「1층」 같은 별칭은 랙마다 되풀이되므로 어느 랙의 것인지 함께 보인다.
 * 목록에 없는 상위(검색으로 빠진 것)는 건너뛴다.
 */
export const parentPathOf = (location: Location, byId: ReadonlyMap<number, Location>): string => {
  const path: string[] = [];
  let parentId = location.parentLocationId ?? null;
  const seen = new Set<number>();
  while (parentId !== null && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (parent === undefined) break;
    path.unshift(locationShownLabel(parent));
    if (parent.locationLevelCode === 'RACK') break;
    parentId = parent.parentLocationId ?? null;
  }
  return path.join(' › ');
};
