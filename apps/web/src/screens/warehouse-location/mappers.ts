import { PENDING_CODE_VALUE } from './code-options';
import type { Location, LocationFormValues, Warehouse, WarehouseFormValues } from './types';

/**
 * 계약 표현과 폼 표현 사이의 변환.
 *
 * 폼 값이 전부 문자열인 이유는 DS 입력·선택이 문자열을 다루기 때문이고,
 * 계약은 id를 숫자로, 선택 필드를 널로 표현한다. 그 경계를 여기 한 곳에서 넘는다.
 */

/** 널·없음을 모두 빈 문자열로 모은다 — 선택칸의 「고르지 않음」이 하나의 값이어야 한다. */
const optionalIdToText = (id: number | null | undefined): string =>
  id === null || id === undefined ? '' : String(id);

export const warehouseToFormValues = (warehouse: Warehouse): WarehouseFormValues => ({
  plantId: String(warehouse.plantId),
  businessUnitId: String(warehouse.businessUnitId),
  warehouseCode: warehouse.warehouseCode,
  warehouseName: warehouse.warehouseName,
  warehouseTypeCode: warehouse.warehouseTypeCode,
  managementLevelCode: warehouse.managementLevelCode,
  isExternal: warehouse.isExternal,
  partnerId: optionalIdToText(warehouse.partnerId),
});

/**
 * 신규 등록 폼의 초기값. 관리수준만 자리표시자 값을 쓴다 —
 * 공통코드 목록이 확정되지 않아 고를 수 있는 값이 그것뿐이다.
 */
export const emptyWarehouseFormValues = (): WarehouseFormValues => ({
  plantId: '',
  businessUnitId: '',
  warehouseCode: '',
  warehouseName: '',
  warehouseTypeCode: '',
  managementLevelCode: PENDING_CODE_VALUE,
  isExternal: false,
  partnerId: '',
});

/** 널·없음을 빈 문자열로 모은다. 선택 코드도 「고르지 않음」이 하나의 값이어야 한다. */
const optionalTextToText = (value: string | null | undefined): string => value ?? '';

export const locationToFormValues = (location: Location): LocationFormValues => ({
  locationCode: location.locationCode,
  locationName: location.locationName,
  locationTypeCode: location.locationTypeCode,
  qualityZoneCode: optionalTextToText(location.qualityZoneCode),
  storageConditionCode: optionalTextToText(location.storageConditionCode),
  allowMixedItem: location.allowMixedItem,
  allowMixedLot: location.allowMixedLot,
  capacityQty:
    location.capacityQty === null || location.capacityQty === undefined
      ? ''
      : String(location.capacityQty),
  capacityUomId: optionalIdToText(location.capacityUomId),
});

/** 신규 Location 폼의 초기값. 값 목록이 확정되지 않은 코드만 자리표시자를 쓴다. */
export const emptyLocationFormValues = (): LocationFormValues => ({
  locationCode: '',
  locationName: '',
  locationTypeCode: PENDING_CODE_VALUE,
  qualityZoneCode: PENDING_CODE_VALUE,
  storageConditionCode: PENDING_CODE_VALUE,
  allowMixedItem: true,
  allowMixedLot: true,
  capacityQty: '',
  capacityUomId: '',
});

/** 기준값과 현재 값의 비교. 「고친 것이 있는가」의 판정 근거다. */
export const isSameWarehouseValues = (a: WarehouseFormValues, b: WarehouseFormValues): boolean =>
  a.plantId === b.plantId &&
  a.businessUnitId === b.businessUnitId &&
  a.warehouseCode === b.warehouseCode &&
  a.warehouseName === b.warehouseName &&
  a.warehouseTypeCode === b.warehouseTypeCode &&
  a.managementLevelCode === b.managementLevelCode &&
  a.isExternal === b.isExternal &&
  a.partnerId === b.partnerId;
