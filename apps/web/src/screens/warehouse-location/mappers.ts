import type { components } from '@omf-mes/api-client';

import { isSystemLocation } from '../../patterns/system-location';
import type { Location, LocationFormValues, Warehouse, WarehouseFormValues } from './types';

type WarehouseUpdate = components['schemas']['WarehouseUpdate'];
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
  locationPrefix: warehouse.locationPrefix,
  warehouseTypeCode: warehouse.warehouseTypeCode,
  isExternal: warehouse.isExternal,
  isDefect: warehouse.isDefect,
});

/** 상세를 받기 전 폼의 빈 값 — 수정 창은 상세가 온 뒤에만 열린다. */
export const emptyWarehouseFormValues = (): WarehouseFormValues => ({
  plantId: '',
  businessUnitId: '',
  warehouseCode: '',
  warehouseName: '',
  locationPrefix: '',
  warehouseTypeCode: '',
  isExternal: false,
  isDefect: false,
});

/**
 * 창고 수정 요청 본문. plantId · 창고 위치 코드(#292)는 등록 후 변경할 수 없어 실리지 않고,
 * isActive는 사용 중지 액션으로만 바뀌므로 여기 없다.
 */
export const toWarehouseUpdate = (values: WarehouseFormValues): WarehouseUpdate => ({
  businessUnitId: Number(values.businessUnitId),
  // 앞뒤 공백이 붙은 코드는 눈으로 구분되지 않는 다른 코드가 된다.
  warehouseCode: values.warehouseCode.trim(),
  warehouseName: values.warehouseName.trim(),
  warehouseTypeCode: values.warehouseTypeCode,
  isExternal: values.isExternal,
  /* 화면이 고치지 않은 값을 그대로 되돌려 보낸다 — 여기서 지어내면 서버 값이 덮인다. */
  isDefect: values.isDefect,
});

export const locationToFormValues = (location: Location): LocationFormValues => ({
  parentLocationId: optionalIdToText(location.parentLocationId),
  locationCode: location.locationCode,
  aliasName: location.aliasName ?? '',
  itemRestricted: location.itemRestricted,
});

/** 신규 Location 폼의 초기값. 선택값을 추측하지 않는다. 코드는 여는 쪽이 발행해 채운다. */
export const emptyLocationFormValues = (): LocationFormValues => ({
  parentLocationId: '',
  locationCode: '',
  aliasName: '',
});

/** 상위 위치 표시 — 별칭이 있으면 별칭, 없으면 위치 코드 하나만(사용자 지시 2026-10-29). */
export const locationAliasOrCode = (
  location: Pick<Location, 'locationCode' | 'aliasName'>,
): string => location.aliasName?.trim() || location.locationCode;

const trimmedAlias = (values: LocationFormValues): string | null =>
  values.aliasName.trim() === '' ? null : values.aliasName.trim();

/**
 * 수정 본문은 위치명과 별칭뿐이다 — 상위 · 코드 · 창고는 등록 후 바꿀 수 없다.
 */
const locationBody = (values: LocationFormValues, locationName: string): LocationUpdate => ({
  locationName,
  /* 빈 글은 「별칭 없음」이다 — 서버도 빈 글을 없음으로 받지만 null 로 보내 뜻을 하나로 둔다. */
  aliasName: trimmedAlias(values),
});

/**
 * Location 수정 요청 본문. 위치명은 저장된 값을 그대로 두고, 별칭을 고쳤을 때만 별칭(없으면 코드)으로 맞춘다.
 * 서버가 만든 위치는 이름이 잠겨 있어(#875) 별칭을 고쳐도 위치명을 바꾸지 않는다.
 *
 * ⚠ 위치명을 싣는 것은 서버가 아직 필수로 받기 때문이다 — 서버가 위치명을 선택으로 바꾸면 걷는다.
 */
export const toLocationUpdate = (
  values: LocationFormValues,
  stored: Pick<Location, 'locationName' | 'aliasName' | 'systemRoleCode'> &
    Partial<Pick<Location, 'itemRestricted'>>,
): LocationUpdate => {
  const aliasChanged = trimmedAlias(values) !== (stored.aliasName?.trim() || null);
  const locationName =
    aliasChanged && !isSystemLocation(stored)
      ? (trimmedAlias(values) ?? values.locationCode.trim())
      : stored.locationName;
  /*
   * 「지정 품목만 받기」는 바꿨을 때만 싣는다(피처 009) — 서버는 켤 때마다 조건(지정 · 지정 밖 재고)을 다시 보므로,
   * 그대로 둔 값을 실어 보내면 별칭만 고쳐도 켜기 검사에 걸릴 수 있다. 보내지 않으면 서버가 그대로 둔다.
   */
  const restrictChanged =
    values.itemRestricted !== undefined &&
    values.itemRestricted !== (stored.itemRestricted ?? false);
  return {
    ...locationBody(values, locationName),
    ...(restrictChanged ? { itemRestricted: values.itemRestricted } : {}),
  };
};

/** 기준값과 현재 값의 비교. 「고친 것이 있는가」의 판정 근거다. */
export const isSameWarehouseValues = (a: WarehouseFormValues, b: WarehouseFormValues): boolean =>
  a.plantId === b.plantId &&
  a.businessUnitId === b.businessUnitId &&
  a.warehouseCode === b.warehouseCode &&
  a.warehouseName === b.warehouseName &&
  a.locationPrefix === b.locationPrefix &&
  a.warehouseTypeCode === b.warehouseTypeCode &&
  a.isExternal === b.isExternal &&
  a.isDefect === b.isDefect;

/** 위치 폼의 기준값과 현재 값의 비교 — 수정 창이 「고친 것이 있는가」를 이것과 보관 품목으로 판정한다. */
export const isSameLocationValues = (a: LocationFormValues, b: LocationFormValues): boolean =>
  a.parentLocationId === b.parentLocationId &&
  a.locationCode === b.locationCode &&
  a.aliasName === b.aliasName &&
  (a.itemRestricted ?? false) === (b.itemRestricted ?? false);
