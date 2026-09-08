/**
 * 창고 관리수준에 따른 Location 입력 개폐.
 *
 * 고정 설계는 `WAREHOUSE`만 위치를 받지 않고 `ZONE`·`RACK`·`CELL`은 Location을 받는다고
 * 확정한다(W-06-14 §5-3). 값의 순서는 계층 깊이이고 이 화면은 저장하지 않고 읽기만 한다.
 */
export const LOCATION_MANAGED_LEVEL_CODES = ['ZONE', 'RACK', 'CELL'] as const;

/** 확인하지 못한 관리수준도 입력을 열 근거가 없으므로 잠근다. */
export const isLocationInputOpen = (managementLevelCode: string | null): boolean =>
  managementLevelCode !== null &&
  LOCATION_MANAGED_LEVEL_CODES.includes(
    managementLevelCode as (typeof LOCATION_MANAGED_LEVEL_CODES)[number],
  );
