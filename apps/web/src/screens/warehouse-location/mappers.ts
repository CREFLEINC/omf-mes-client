import type { components } from '@omf-mes/api-client';

import type { Location, LocationFormValues, Warehouse, WarehouseFormValues } from './types';

type WarehouseCreate = components['schemas']['WarehouseCreate'];
type WarehouseUpdate = components['schemas']['WarehouseUpdate'];
type LocationCreate = components['schemas']['LocationCreate'];
type LocationUpdate = components['schemas']['LocationUpdate'];

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
  isDefect: warehouse.isDefect,
  partnerId: optionalIdToText(warehouse.partnerId),
});

/**
 * 신규 등록 폼의 초기값. 공통코드 선택은 서버가 준 목록에서 사용자가 직접 고른다.
 */
export const emptyWarehouseFormValues = (): WarehouseFormValues => ({
  plantId: '',
  businessUnitId: '',
  warehouseCode: '',
  warehouseName: '',
  warehouseTypeCode: '',
  managementLevelCode: '',
  isExternal: false,
  /* 신규 창고는 불량창고가 아니다 — 그렇게 정하는 자리가 화면에 없으므로 꺼진 값으로 낸다. */
  isDefect: false,
  partnerId: '',
});

/** 빈 문자열은 「고르지 않음」이므로 널로 되돌린다. 0은 유효한 id가 아니다. */
const textToOptionalId = (value: string): number | null => (value === '' ? null : Number(value));

/**
 * 창고 수정 요청 본문. plantId는 등록 후 변경할 수 없어 실리지 않고,
 * isActive는 사용 중지 액션으로만 바뀌므로 여기 없다.
 */
export const toWarehouseUpdate = (values: WarehouseFormValues): WarehouseUpdate => ({
  businessUnitId: Number(values.businessUnitId),
  // 앞뒤 공백이 붙은 코드는 눈으로 구분되지 않는 다른 코드가 된다.
  warehouseCode: values.warehouseCode.trim(),
  warehouseName: values.warehouseName.trim(),
  warehouseTypeCode: values.warehouseTypeCode,
  managementLevelCode: values.managementLevelCode,
  isExternal: values.isExternal,
  /* 화면이 고치지 않은 값을 그대로 되돌려 보낸다 — 여기서 지어내면 서버 값이 덮인다. */
  isDefect: values.isDefect,
  partnerId: textToOptionalId(values.partnerId),
});

/**
 * 창고 등록 요청 본문. 계약상 수정 본문에 plantId만 더한 형태이며,
 * isActive는 받지 않는다 — 신규는 항상 사용 중이다.
 */
export const toWarehouseCreate = (values: WarehouseFormValues): WarehouseCreate => ({
  ...toWarehouseUpdate(values),
  plantId: Number(values.plantId),
});

/** 널·없음을 빈 문자열로 모은다. 선택 코드도 「고르지 않음」이 하나의 값이어야 한다. */
const optionalTextToText = (value: string | null | undefined): string => value ?? '';

export const locationToFormValues = (location: Location): LocationFormValues => ({
  parentLocationId: optionalIdToText(location.parentLocationId),
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

/** 신규 Location 폼의 초기값. 선택값을 추측하지 않는다. */
export const emptyLocationFormValues = (): LocationFormValues => ({
  parentLocationId: '',
  locationCode: '',
  locationName: '',
  locationTypeCode: '',
  qualityZoneCode: '',
  storageConditionCode: '',
  allowMixedItem: true,
  allowMixedLot: true,
  capacityQty: '',
  capacityUomId: '',
});

/** 빈 문자열 코드는 「고르지 않음」이다. 계약은 그것을 널로 표현한다. */
const textToOptionalCode = (value: string): string | null => (value === '' ? null : value);

/**
 * Location 수정 요청 본문. warehouseId는 등록 후 바꿀 수 없어 실리지 않는다.
 * 상위 위치는 폼에서 고른 값으로 보낸다. 자기 자신과 하위 노드는 선택지에서 제외한다.
 */
export const toLocationUpdate = (values: LocationFormValues): LocationUpdate => ({
  parentLocationId: textToOptionalId(values.parentLocationId),
  locationCode: values.locationCode.trim(),
  locationName: values.locationName.trim(),
  locationTypeCode: values.locationTypeCode,
  qualityZoneCode: textToOptionalCode(values.qualityZoneCode),
  storageConditionCode: textToOptionalCode(values.storageConditionCode),
  allowMixedItem: values.allowMixedItem,
  allowMixedLot: values.allowMixedLot,
  // 수용량과 단위는 함께 있거나 함께 비어야 한다(계약의 짝 제약). 검증이 그것을 먼저 막는다.
  capacityQty: values.capacityQty.trim() === '' ? null : Number(values.capacityQty),
  capacityUomId: textToOptionalId(values.capacityUomId),
});

/** Location 등록 요청 본문. 계약상 수정 본문에 warehouseId만 더한 형태다. */
export const toLocationCreate = (
  values: LocationFormValues,
  warehouseId: number,
): LocationCreate => ({
  ...toLocationUpdate(values),
  warehouseId,
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
  a.isDefect === b.isDefect &&
  a.partnerId === b.partnerId;
