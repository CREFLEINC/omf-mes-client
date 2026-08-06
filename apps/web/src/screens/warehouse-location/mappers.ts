import type { components } from '@omf-mes/api-client';

import { PENDING_CODE_VALUE } from './code-options';
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

/** 빈 문자열 코드는 「고르지 않음」이다. 계약은 그것을 널로 표현한다. */
const textToOptionalCode = (value: string): string | null => (value === '' ? null : value);

/**
 * Location 수정 요청 본문. warehouseId는 등록 후 바꿀 수 없어 실리지 않는다.
 * 상위 위치는 화면에 재배치 수단이 없으므로 지금 값을 그대로 되돌려 보낸다.
 */
export const toLocationUpdate = (
  values: LocationFormValues,
  parentLocationId: number | null,
): LocationUpdate => ({
  parentLocationId,
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
  parentLocationId: number | null,
): LocationCreate => ({
  ...toLocationUpdate(values, parentLocationId),
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
  a.partnerId === b.partnerId;
