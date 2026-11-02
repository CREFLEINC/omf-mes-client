import type { components } from '@omf-mes/api-client';

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

/** 위치 이름 — 별칭이 있으면 뒤에 괄호로 함께 보인다. */
export const locationDisplayName = (
  name: string,
  location: Pick<Location, 'aliasName'>,
): string => {
  const alias = location.aliasName?.trim() ?? '';
  return alias === '' ? name : `${name} (${alias})`;
};
