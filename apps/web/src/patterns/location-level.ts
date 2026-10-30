import type { components } from '@omf-mes/api-client';

import { isPutawayStaging } from './system-location';

type Location = components['schemas']['Location'];

/**
 * 위치 단계(장부 P-154 · 서버 #885) — 창고 › 구역 › 랙 › 층 › 셀. 서버가 상위를 보고 정한다(건너뛰기 없음).
 * 「창고 전체」·「적치 대기」는 구역이다. 넷보다 깊던 옛 위치만 null.
 */
export type LocationLevelCode = NonNullable<Location['locationLevelCode']>;

export const LOCATION_LEVEL_CODES = [
  'ZONE',
  'RACK',
  'LEVEL',
  'CELL',
] as const satisfies readonly LocationLevelCode[];

/**
 * 재고를 둘 수 있는 위치 — 활성 · 적치 대기 아님 · 켜진 하위 없음(`isLeaf`). 서버가 도착 위치를 고르는 기준과
 * 같다(P-153).
 */
export const isStockableLocation = (
  location: Pick<Location, 'isActive' | 'isLeaf' | 'systemRoleCode'>,
): boolean => location.isActive && !isPutawayStaging(location) && location.isLeaf;
