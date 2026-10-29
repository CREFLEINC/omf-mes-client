import { isPutawayStaging, type SystemLocationFields } from './system-location';

/**
 * 위치 단계(장부 P-154 · 서버 #885) — 창고 › 구역 › 랙 › 층 › 셀. 서버가 상위를 보고 정한다(건너뛰기 없음).
 * 「창고 전체」·「적치 대기」는 구역이다. 넷보다 깊던 옛 위치만 null.
 *
 * ⚠ `locationLevelCode` · `isLeaf` 는 계약 사본에 아직 없다 — 사본이 갱신되면 이 넓힘을 걷는다.
 */
export const LOCATION_LEVEL_CODES = ['ZONE', 'RACK', 'LEVEL', 'CELL'] as const;

export type LocationLevelCode = (typeof LOCATION_LEVEL_CODES)[number];

export interface LocationLevelFields {
  locationLevelCode?: LocationLevelCode | null;
  /** 켜진 하위가 없다 — 재고는 이런 위치에만 둔다. */
  isLeaf?: boolean;
}

/**
 * 재고를 둘 수 있는 위치 — 활성 · 적치 대기 아님 · 켜진 하위 없음. 서버가 도착 위치를 고르는 기준과 같다(P-153).
 * `isLeaf` 를 싣지 않는 옛 서버의 위치는 맨 아래로 본다.
 */
export const isStockableLocation = (
  location: { isActive: boolean } & LocationLevelFields & SystemLocationFields,
): boolean => location.isActive && !isPutawayStaging(location) && location.isLeaf !== false;
