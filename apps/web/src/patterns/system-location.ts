import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { locationOptionLabel, type LocationLabelSource } from './location-label';

type Location = components['schemas']['Location'];

/**
 * 서버가 창고마다 스스로 두는 위치(장부 P-145 · 서버 #875). 사람이 등록하지 않는다.
 *
 * - 모든 창고: 「적치 대기」 — 입고는 됐고 아직 놓지 않은 자리. 끌 수 없다.
 * - 사람이 만든 위치가 없는 창고: 「창고 전체」.
 *
 * 둘 다 코드·이름은 서버 것이고 MES 는 별칭(`aliasName`)만 고친다(사용자 결정 2026-10-29).
 */
export const SYSTEM_LOCATION_ROLE = {
  putawayStaging: 'PUTAWAY_STAGING',
  warehouseWhole: 'WAREHOUSE_WHOLE',
} as const satisfies Record<string, NonNullable<Location['systemRoleCode']>>;

/** 서버가 만든 위치인가 — 사람이 만든 위치는 역할이 null 이다. */
export const isSystemLocation = (location: Pick<Location, 'systemRoleCode'>): boolean =>
  location.systemRoleCode !== null;

export const isPutawayStaging = (location: Pick<Location, 'systemRoleCode'>): boolean =>
  location.systemRoleCode === SYSTEM_LOCATION_ROLE.putawayStaging;

const SYSTEM_ROLE_NAMES = messages.warehouseLocation.values.systemRoles;

/**
 * 위치 한 개를 목록 · 상세 글로(omf-all-around#268) — 서버가 둔 위치(적치 대기 · 창고 전체)는 코드(`SYS-…`) 대신
 * 역할 이름, 사람이 만든 위치는 `locationOptionLabel`(「코드 · 별칭」 · 「코드 · 이름」 · 코드).
 * 역할을 모르는(응답에 없는) 자리는 `locationOptionLabel` 과 같다.
 */
export const locationLabelWithRole = (
  location: LocationLabelSource & { systemRoleCode?: string | null },
): string => {
  if (location.systemRoleCode === SYSTEM_LOCATION_ROLE.putawayStaging) {
    return SYSTEM_ROLE_NAMES.PUTAWAY_STAGING;
  }
  if (location.systemRoleCode === SYSTEM_LOCATION_ROLE.warehouseWhole) {
    return SYSTEM_ROLE_NAMES.WAREHOUSE_WHOLE;
  }
  return locationOptionLabel(location);
};

/**
 * 출고 요청의 입고지 글(W-02-11 · W-02-12, omf-all-around#268). 서버가 코드를 싣지 않은 응답(옛 서버)은
 * 지금처럼 이름(없으면 번호)으로 보인다.
 */
export const destinationLocationLabel = (request: {
  destinationLocationId: number;
  destinationLocationName?: string;
  destinationLocationCode?: string;
  destinationLocationAliasName?: string | null;
  destinationLocationSystemRoleCode?: string | null;
}): string =>
  request.destinationLocationCode === undefined
    ? (request.destinationLocationName ?? String(request.destinationLocationId))
    : locationLabelWithRole({
        locationCode: request.destinationLocationCode,
        locationName: request.destinationLocationName ?? null,
        aliasName: request.destinationLocationAliasName ?? null,
        systemRoleCode: request.destinationLocationSystemRoleCode ?? null,
      });
