import type { components } from '@omf-mes/api-client';

import { isSystemLocation } from '../../patterns/system-location';
import type { Location, LocationFormValues, Warehouse, WarehouseFormValues } from './types';

type WarehouseCreate = components['schemas']['WarehouseCreate'];
type WarehouseUpdate = components['schemas']['WarehouseUpdate'];
/* 별칭(`aliasName`)은 계약 사본에 아직 없다 — 서버 #875 가 받는다. */
type LocationCreate = components['schemas']['LocationCreate'] & { aliasName: string | null };
type LocationUpdate = components['schemas']['LocationUpdate'] & { aliasName: string | null };

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
});

/**
 * 신규 등록 폼의 초기값. 공통코드 선택은 서버가 준 목록에서 사용자가 직접 고른다.
 */
/**
 * 창고 관리 수준은 화면에서 없앴다(사용자 결정 2026-10-29 — 위치 계층은 위치가 정한다). 계약 사본이 아직 필수로
 * 두어 등록에 값을 실어야 하는데, 서버는 이 값을 검사도 판단도 하지 않는다(서버 위치 계층 계약 ①). 가장 깊은 값을
 * 실어 이행 전 서버에서도 위치를 막지 않게 한다. 계약이 바뀌면 걷는다.
 */
const TRANSITIONAL_MANAGEMENT_LEVEL = 'CELL';

export const emptyWarehouseFormValues = (): WarehouseFormValues => ({
  plantId: '',
  businessUnitId: '',
  warehouseCode: '',
  warehouseName: '',
  warehouseTypeCode: '',
  managementLevelCode: TRANSITIONAL_MANAGEMENT_LEVEL,
  isExternal: false,
  /* 신규 창고는 불량창고가 아니다 — 그렇게 정하는 자리가 화면에 없으므로 꺼진 값으로 낸다. */
  isDefect: false,
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
});

/**
 * 창고 등록 요청 본문. 계약상 수정 본문에 plantId만 더한 형태이며,
 * isActive는 받지 않는다 — 신규는 항상 사용 중이다.
 */
export const toWarehouseCreate = (values: WarehouseFormValues): WarehouseCreate => ({
  ...toWarehouseUpdate(values),
  plantId: Number(values.plantId),
});

export const locationToFormValues = (location: Location): LocationFormValues => ({
  parentLocationId: optionalIdToText(location.parentLocationId),
  locationCode: location.locationCode,
  aliasName: location.aliasName ?? '',
  locationTypeCode: location.locationTypeCode,
  allowMixedItem: location.allowMixedItem,
  allowMixedLot: location.allowMixedLot,
});

/** 신규 Location 폼의 초기값. 선택값을 추측하지 않는다. 코드는 여는 쪽이 발행해 채운다. */
export const emptyLocationFormValues = (): LocationFormValues => ({
  parentLocationId: '',
  locationCode: '',
  aliasName: '',
  locationTypeCode: '',
  allowMixedItem: true,
  allowMixedLot: true,
});

/** 위치를 사람에게 부르는 이름 — 별칭이 이름이다(사용자 지시 2026-10-29). 별칭이 없으면 저장된 위치명. */
export const locationShownName = (location: Pick<Location, 'locationName' | 'aliasName'>): string =>
  location.aliasName?.trim() || location.locationName;

/** 고르는 자리의 라벨 — 「코드 · 이름」. */
export const locationOptionLabel = (
  location: Pick<Location, 'locationCode' | 'locationName' | 'aliasName'>,
): string => `${location.locationCode} · ${locationShownName(location)}`;

const trimmedAlias = (values: LocationFormValues): string | null =>
  values.aliasName.trim() === '' ? null : values.aliasName.trim();

/**
 * 수용량 · 수용 단위 · 품질구역 · 보관조건은 싣지 않는다(사용자 지시 2026-10-29). 서버는 빠진 키를 건드리지 않는다.
 * warehouseId는 등록 후 바꿀 수 없어 수정 본문에 실리지 않는다.
 */
const locationBody = (values: LocationFormValues, locationName: string): LocationUpdate => ({
  parentLocationId: textToOptionalId(values.parentLocationId),
  locationCode: values.locationCode.trim(),
  locationName,
  /* 빈 글은 「별칭 없음」이다 — 서버도 빈 글을 없음으로 받지만 null 로 보내 뜻을 하나로 둔다. */
  aliasName: trimmedAlias(values),
  locationTypeCode: values.locationTypeCode,
  allowMixedItem: values.allowMixedItem,
  allowMixedLot: values.allowMixedLot,
});

/**
 * Location 수정 요청 본문. 위치명은 저장된 값을 그대로 두고, 별칭을 고쳤을 때만 별칭(없으면 코드)으로 맞춘다.
 * 서버가 만든 위치는 이름이 잠겨 있어(#875) 별칭을 고쳐도 위치명을 바꾸지 않는다.
 *
 * ⚠ 위치명을 싣는 것은 서버가 아직 필수로 받기 때문이다 — 서버가 위치명을 선택으로 바꾸면 걷는다.
 */
export const toLocationUpdate = (
  values: LocationFormValues,
  stored: Pick<Location, 'locationName' | 'aliasName' | 'systemRoleCode'>,
): LocationUpdate => {
  const aliasChanged = trimmedAlias(values) !== (stored.aliasName?.trim() || null);
  const locationName =
    aliasChanged && !isSystemLocation(stored)
      ? (trimmedAlias(values) ?? values.locationCode.trim())
      : stored.locationName;
  return locationBody(values, locationName);
};

/**
 * Location 등록 요청 본문. 위치명은 별칭, 별칭이 없으면 발행한 코드다.
 *
 * ⚠ 서버가 위치명을 선택으로 바꾸면 위치명을 싣지 않는다.
 */
export const toLocationCreate = (
  values: LocationFormValues,
  warehouseId: number,
): LocationCreate => ({
  ...locationBody(values, trimmedAlias(values) ?? values.locationCode.trim()),
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
  a.isDefect === b.isDefect;
