import { messages } from '@omf-mes/i18n';

import { LOCATION_LEVEL_CODES, type LocationLevelCode } from '../../patterns/location-level';
import {
  isPutawayStaging,
  isSystemLocation,
  SYSTEM_LOCATION_ROLE,
} from '../../patterns/system-location';
import type { Location } from './types';

/** 창고의 위치 수 — 위치 수 · 단계별 수 · 사용 중지 수 · 서버가 만든 위치. */
export interface LocationSummary {
  /** 받은 위치 전부(서버가 만든 위치 포함). */
  total: number;
  /** 사람이 만든 위치의 단계별 수 — 서버가 만든 위치는 단계가 구역이어도 세지 않는다. */
  levels: Record<LocationLevelCode, number>;
  /** 사용 중지된 위치 수(단계 수와 겹쳐 센다). */
  inactive: number;
  /** 서버가 만든 위치 — 적치 대기가 먼저, 창고 전체가 뒤. */
  system: Location[];
}

const systemOrder = (location: Location): number =>
  isPutawayStaging(location)
    ? 0
    : location.systemRoleCode === SYSTEM_LOCATION_ROLE.warehouseWhole
      ? 1
      : 2;

/** Location 표가 받는 목록(`GET /mdm/locations?warehouseId`, 미사용 포함)으로 센다 — 따로 묻지 않는다. */
export const summarizeLocations = (items: readonly Location[]): LocationSummary => {
  const levels: Record<LocationLevelCode, number> = { ZONE: 0, RACK: 0, LEVEL: 0, CELL: 0 };
  let inactive = 0;
  const system: Location[] = [];

  for (const item of items) {
    if (!item.isActive) inactive += 1;
    if (isSystemLocation(item)) {
      system.push(item);
      continue;
    }
    const level = item.locationLevelCode;
    if (level !== null && level !== undefined) levels[level] += 1;
  }

  return {
    total: items.length,
    levels,
    inactive,
    system: system.sort((a, b) => systemOrder(a) - systemOrder(b)),
  };
};

/**
 * Location 표 위 한 줄(안 B, 사용자 결정 2026-11-24) — 「전체 6 · 구역 1 · 랙 1 · 층 1 · 셀 1」. 없는 단계와 사용 중지 0 은
 * 빼서 줄을 짧게 둔다.
 */
export const locationCountText = (summary: LocationSummary): string => {
  const t = messages.warehouseLocation;
  const parts = [t.warehouseInfo.total(summary.total)];
  for (const level of LOCATION_LEVEL_CODES) {
    const count = summary.levels[level];
    if (count > 0) parts.push(t.warehouseInfo.level(t.values.locationLevels[level], count));
  }
  if (summary.inactive > 0) parts.push(t.warehouseInfo.inactive(summary.inactive));

  return parts.join(' · ');
};
