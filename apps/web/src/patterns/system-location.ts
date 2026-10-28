/**
 * 서버가 창고마다 스스로 두는 위치(장부 P-145 · 서버 #875). 사람이 등록하지 않는다.
 *
 * - 모든 창고: 「적치 대기」 — 입고는 됐고 아직 놓지 않은 자리. 끌 수 없고, 적치 규칙의 위치로 고를 수 없다.
 * - 관리수준 WAREHOUSE 창고: 「창고 전체」.
 *
 * 둘 다 코드·이름은 서버 것이고 MES 는 별칭(`aliasName`)만 고친다(사용자 결정 2026-10-29).
 *
 * ⚠ `systemRoleCode` · `aliasName` 은 계약 사본에 아직 없다 — 사본이 갱신되면 이 넓힘을 걷는다.
 */
export const SYSTEM_LOCATION_ROLE = {
  putawayStaging: 'PUTAWAY_STAGING',
  warehouseWhole: 'WAREHOUSE_WHOLE',
} as const;

export interface SystemLocationFields {
  /** 서버가 만든 위치의 역할. 사람이 만든 위치는 null. */
  systemRoleCode?: string | null;
  /** MES 별칭. 없으면 null. */
  aliasName?: string | null;
}

export const isSystemLocation = (location: SystemLocationFields): boolean =>
  location.systemRoleCode !== null && location.systemRoleCode !== undefined;

export const isPutawayStaging = (location: SystemLocationFields): boolean =>
  location.systemRoleCode === SYSTEM_LOCATION_ROLE.putawayStaging;

/** 위치 이름 — 별칭이 있으면 뒤에 괄호로 함께 보인다. */
export const locationDisplayName = (name: string, location: SystemLocationFields): string => {
  const alias = location.aliasName?.trim() ?? '';
  return alias === '' ? name : `${name} (${alias})`;
};
