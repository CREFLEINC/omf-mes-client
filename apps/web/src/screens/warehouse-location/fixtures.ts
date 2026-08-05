import { messages } from '@omf-mes/i18n';

import { PENDING_CODE_VALUE } from './code-options';
import type {
  Location,
  LocationFormValues,
  LookupOptions,
  Warehouse,
  WarehouseFilters,
  WarehouseFormValues,
} from './types';

/**
 * 레이아웃 확인용 예시 데이터.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다. 실제 사번·품목코드·LOT 번호·거래처 코드·
 * 고객사명·공장 위치를 넣지 않는다(공개 저장소 경계). Phase 2 테스트가 이 fixture를 재사용한다.
 */

export const warehouseFixtures: Warehouse[] = [
  {
    warehouseId: 1001,
    plantId: 11,
    businessUnitId: 21,
    warehouseCode: 'WH-01',
    warehouseName: '1공장 자재창고',
    warehouseTypeCode: 'MATERIAL',
    managementLevelCode: PENDING_CODE_VALUE,
    isExternal: false,
    partnerId: null,
    isActive: true,
  },
  {
    warehouseId: 1002,
    plantId: 11,
    businessUnitId: 21,
    warehouseCode: 'WH-02',
    warehouseName: '1공장 제품창고',
    warehouseTypeCode: 'PRODUCT',
    managementLevelCode: PENDING_CODE_VALUE,
    isExternal: false,
    partnerId: null,
    isActive: true,
  },
  {
    warehouseId: 1003,
    plantId: 12,
    businessUnitId: 22,
    warehouseCode: 'WH-03',
    warehouseName: '외부 보관창고',
    warehouseTypeCode: 'MERCHANDISE',
    managementLevelCode: PENDING_CODE_VALUE,
    isExternal: true,
    partnerId: 31,
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
    locationTypeCode: PENDING_CODE_VALUE,
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
    locationTypeCode: PENDING_CODE_VALUE,
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
    locationTypeCode: PENDING_CODE_VALUE,
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
    locationTypeCode: PENDING_CODE_VALUE,
    qualityZoneCode: null,
    storageConditionCode: null,
    allowMixedItem: true,
    allowMixedLot: true,
    capacityQty: null,
    capacityUomId: null,
    isActive: true,
  },
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
  partners: [
    { value: '31', label: '(주)대한부품' },
    { value: '32', label: '(주)한빛소재' },
  ],
  uoms: [
    { value: '41', label: 'EA' },
    { value: '42', label: 'BOX' },
    { value: '43', label: 'PLT' },
  ],
};

export const defaultWarehouseFilters: WarehouseFilters = {
  q: '',
  warehouseTypeCode: '',
  includeInactive: false,
};

export const warehouseFormInitialValues: WarehouseFormValues = {
  plantId: '11',
  businessUnitId: '21',
  warehouseCode: 'WH-01',
  warehouseName: '1공장 자재창고',
  warehouseTypeCode: 'MATERIAL',
  managementLevelCode: PENDING_CODE_VALUE,
  isExternal: false,
  partnerId: '',
};

export const locationFormInitialValues: LocationFormValues = {
  locationCode: '',
  locationName: '',
  locationTypeCode: PENDING_CODE_VALUE,
  qualityZoneCode: PENDING_CODE_VALUE,
  storageConditionCode: PENDING_CODE_VALUE,
  allowMixedItem: true,
  allowMixedLot: true,
  capacityQty: '',
  capacityUomId: '',
};

/** 입력 오류 표시 확인용 — Phase 1은 검증 함수를 만들지 않고 오류 값을 주입한다. */
export const warehouseFieldErrorFixtures: Record<string, string> = {
  warehouseCode: messages.warehouseLocation.validation.codeDuplicated,
  partnerId: messages.warehouseLocation.validation.partnerRequiredForExternal,
};

export const locationFieldErrorFixtures: Record<string, string> = {
  locationCode: messages.warehouseLocation.validation.required,
  capacityQty: messages.warehouseLocation.validation.capacityNeedsUom,
};
