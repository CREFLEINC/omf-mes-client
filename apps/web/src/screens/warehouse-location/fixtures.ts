import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import type {
  Location,
  LocationFormValues,
  LookupOptions,
  Warehouse,
  WarehouseFormValues,
} from './types';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다. 실제 사번·품목코드·LOT 번호·거래처 코드·
 * 고객사명·공장 위치를 넣지 않는다(공개 저장소 경계).
 */

export const warehouseFixtures: Warehouse[] = [
  {
    warehouseId: 1001,
    plantId: 11,
    businessUnitId: 21,
    warehouseCode: 'WH-01',
    warehouseName: '1공장 자재창고',
    warehouseTypeCode: 'MATERIAL',
    managementLevelCode: 'CELL',
    isExternal: false,
    isDefect: false,
    isActive: true,
  },
  {
    warehouseId: 1002,
    plantId: 11,
    businessUnitId: 21,
    warehouseCode: 'WH-02',
    warehouseName: '1공장 제품창고',
    warehouseTypeCode: 'PRODUCT',
    managementLevelCode: 'WAREHOUSE',
    isExternal: false,
    isDefect: false,
    isActive: true,
  },
  {
    warehouseId: 1003,
    plantId: 12,
    businessUnitId: 22,
    warehouseCode: 'WH-03',
    warehouseName: '외부 보관창고',
    warehouseTypeCode: 'GENERAL',
    managementLevelCode: 'RACK',
    isExternal: true,
    isDefect: false,
    isActive: false,
  },
];

/** 3단 계층(A-01 → A-01-01 → A-01-01-01) + 최상위 형제 1건. */
export const locationFixtures: Location[] = [
  {
    locationId: 2001,
    warehouseId: 1001,
    parentLocationId: null,
    locationCode: 'A-01',
    locationName: 'A구역',
    locationTypeCode: 'RACK',
    qualityZoneCode: null,
    storageConditionCode: null,
    allowMixedItem: true,
    allowMixedLot: true,
    capacityQty: null,
    capacityUomId: null,
    isActive: true,
  },
  {
    locationId: 2002,
    warehouseId: 1001,
    parentLocationId: 2001,
    locationCode: 'A-01-01',
    locationName: 'A구역 01열',
    locationTypeCode: 'RACK',
    qualityZoneCode: null,
    storageConditionCode: null,
    allowMixedItem: true,
    allowMixedLot: false,
    capacityQty: null,
    capacityUomId: null,
    isActive: true,
  },
  {
    locationId: 2003,
    warehouseId: 1001,
    parentLocationId: 2002,
    locationCode: 'A-01-01-01',
    locationName: 'A구역 01열 01단',
    locationTypeCode: 'RACK',
    qualityZoneCode: null,
    storageConditionCode: null,
    allowMixedItem: false,
    allowMixedLot: false,
    capacityQty: 500,
    capacityUomId: 41,
    isActive: true,
  },
  {
    locationId: 2004,
    warehouseId: 1001,
    parentLocationId: null,
    locationCode: 'B-01',
    locationName: 'B구역',
    locationTypeCode: 'FLOOR',
    qualityZoneCode: null,
    storageConditionCode: null,
    allowMixedItem: true,
    allowMixedLot: true,
    capacityQty: null,
    capacityUomId: null,
    isActive: true,
  },
];

/** 선택 목록 응답의 계약 표현. 화면이 만드는 선택지와 구분해 둔다. */
export const plantFixtures: components['schemas']['Plant'][] = [
  {
    plantId: 11,
    legalEntityId: 1,
    plantCode: 'PLT-01',
    plantName: '1공장',
    timezoneCode: 'STANDARD',
    isActive: true,
  },
  {
    plantId: 12,
    legalEntityId: 1,
    plantCode: 'PLT-02',
    plantName: '2공장',
    timezoneCode: 'STANDARD',
    isActive: true,
  },
];

export const businessUnitFixtures: components['schemas']['BusinessUnit'][] = [
  {
    businessUnitId: 21,
    legalEntityId: 1,
    businessUnitCode: 'BU-01',
    businessUnitName: '생산본부',
    isActive: true,
  },
  {
    businessUnitId: 22,
    legalEntityId: 1,
    businessUnitCode: 'BU-02',
    businessUnitName: '물류본부',
    isActive: true,
  },
];

export const uomFixtures: components['schemas']['Uom'][] = [
  { uomId: 41, uomCode: 'EA', uomName: '개', decimalScale: 0, isActive: true },
  { uomId: 42, uomCode: 'BOX', uomName: '박스', decimalScale: 0, isActive: true },
];

export const lookupFixtures: LookupOptions = {
  plants: [
    { value: '11', label: '1공장' },
    { value: '12', label: '2공장' },
  ],
  businessUnits: [
    { value: '21', label: '생산본부' },
    { value: '22', label: '물류본부' },
  ],
  warehouseTypes: [
    { value: 'MATERIAL', label: '자재' },
    { value: 'PRODUCT', label: '제품' },
    { value: 'GENERAL', label: '일반' },
  ],
  locationTypes: [
    { value: 'RACK', label: '랙' },
    { value: 'FLOOR', label: '바닥' },
  ],
  reissueReasons: [{ value: 'DAMAGED', label: '라벨 훼손' }],
};

export const warehouseFormInitialValues: WarehouseFormValues = {
  plantId: '11',
  businessUnitId: '21',
  warehouseCode: 'WH-01',
  warehouseName: '1공장 자재창고',
  warehouseTypeCode: 'MATERIAL',
  managementLevelCode: 'CELL',
  isExternal: false,
  isDefect: false,
};

export const locationFormInitialValues: LocationFormValues = {
  parentLocationId: '',
  locationCode: 'Z01',
  aliasName: '',
  locationTypeCode: 'RACK',
  allowMixedItem: true,
  allowMixedLot: true,
};

/** 입력 오류 표시 확인용 — Phase 1은 검증 함수를 만들지 않고 오류 값을 주입한다. */
export const warehouseFieldErrorFixtures: Record<string, string> = {
  warehouseCode: messages.warehouseLocation.validation.codeDuplicated,
};

export const locationFieldErrorFixtures: Record<string, string> = {
  locationCode: messages.warehouseLocation.validation.required,
};
