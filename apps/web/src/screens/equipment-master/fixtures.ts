import type { components } from '@omf-mes/api-client';

import type { EquipmentGroup } from './types';

/**
 * 시험용 합성 자료. **실 운영 값을 쓰지 않는다** — 공장명·코드는 전부 지어낸 것이다.
 * V3 워크플로의 공개 저장소 경계가 테스트 픽스처에도 그대로 적용된다.
 */

type PageMeta = components['schemas']['PageMeta'];
type Plant = components['schemas']['Plant'];

export const pageOf = (items: unknown[], total = items.length): PageMeta => ({
  page: 1,
  size: 20,
  total,
});

export const plantItems: Plant[] = [
  {
    plantId: 11,
    legalEntityId: 1,
    businessUnitId: 1,
    plantCode: 'PL-1',
    plantName: '제1공장',
    timezoneCode: 'UTC',
    isActive: true,
  },
  {
    plantId: 12,
    legalEntityId: 1,
    businessUnitId: 1,
    plantCode: 'PL-2',
    plantName: '제2공장',
    timezoneCode: 'UTC',
    isActive: true,
  },
];

export const plantsResponse = (items: Plant[] = plantItems) => ({
  items,
  page: pageOf(items),
});

type Process = components['schemas']['Process'];

export const processItems: Process[] = [
  {
    processId: 21,
    processCode: 'PRC-1',
    processName: '프레스',
    processTypeCode: 'PENDING',
    isActive: true,
  },
];

export const processesResponse = (items: Process[] = processItems) => ({
  items,
  page: pageOf(items),
});

export const makeGroup = (
  equipmentGroupId: number,
  groupCode: string,
  overrides: Partial<EquipmentGroup> = {},
): EquipmentGroup => ({
  equipmentGroupId,
  plantId: 11,
  groupCode,
  groupName: `${groupCode} 그룹`,
  groupTypeCode: 'LINE',
  parentGroupId: null,
  isActive: true,
  ...overrides,
});

/** 2층 계층 하나 + 최상위 하나. 형제 정렬과 들여쓰기를 함께 잰다. */
export const groupItems: EquipmentGroup[] = [
  makeGroup(101, 'GRP-A'),
  makeGroup(112, 'GRP-A-02', { parentGroupId: 101 }),
  makeGroup(111, 'GRP-A-01', { parentGroupId: 101 }),
  makeGroup(102, 'GRP-B', { plantId: 12 }),
];

export const groupsResponse = (items: EquipmentGroup[] = groupItems) => ({
  items,
  page: pageOf(items),
});

type Editability = components['schemas']['Editability'];
type EquipmentGroupDetailResponse = components['schemas']['EquipmentGroupDetailResponse'];

export const editableCode: Editability = {
  codeEditable: true,
  reason: 'EDITABLE',
  referenceCount: 0,
};

export const lockedCode: Editability = {
  codeEditable: false,
  reason: 'REFERENCED',
  referenceCount: 3,
};

export const groupDetail = (
  group: EquipmentGroup,
  overrides: Partial<EquipmentGroupDetailResponse> = {},
): EquipmentGroupDetailResponse => ({
  equipmentGroup: group,
  editability: editableCode,
  memberEquipmentCount: 0,
  ...overrides,
});

/** 식별자로 픽스처 그룹을 찾는다. 상세 스텁이 늘 같은 건을 돌려주지 않게 한다. */
export const groupById = (equipmentGroupId: number): EquipmentGroup | undefined =>
  groupItems.find((item) => item.equipmentGroupId === equipmentGroupId);

type Equipment = components['schemas']['Equipment'];

export const makeEquipment = (
  equipmentId: number,
  equipmentCode: string,
  overrides: Partial<Equipment> = {},
): Equipment => ({
  equipmentId,
  plantId: 11,
  equipmentCode,
  equipmentName: `${equipmentCode} 설비`,
  equipmentTypeCode: 'PENDING',
  productionLineId: 101,
  statusCode: 'IN_SERVICE',
  calibrationRequired: false,
  isActive: true,
  ...overrides,
});

/**
 * ⚠ 두 축이 다르다 — `statusCode`(자산 수명주기)와 `isActive`(사용 여부).
 * 계약이 「ACTIVE 라는 낱말을 쓰지 않는다」고 못박은 이유가 그것이다(omf-mes#185).
 */
export const equipmentItems: Equipment[] = [
  makeEquipment(2001, 'EQ-01'),
  makeEquipment(2002, 'EQ-02', { calibrationRequired: true, statusCode: 'DISPOSED' }),
];

export const equipmentsResponse = (items: Equipment[] = equipmentItems) => ({
  items,
  page: pageOf(items),
});

type EquipmentDetailResponse = components['schemas']['EquipmentDetailResponse'];

export const equipmentDetail = (
  equipment: Equipment,
  overrides: Partial<EquipmentDetailResponse> = {},
): EquipmentDetailResponse => ({
  equipment,
  editability: editableCode,
  hierarchy: {
    plantName: '제1공장',
    groupNames: ['GRP-A 그룹'],
    equipmentName: equipment.equipmentName,
    groupAssigned: equipment.productionLineId !== null,
  },
  ...overrides,
});

type CodeValue = components['schemas']['CodeValue'];

/** 설계가 확정한 자산 상태 두 값(omf-mes#185). 차례는 `displayOrder` 가 정한다. */
export const statusCodeValues: CodeValue[] = [
  {
    codeValueId: 9001,
    codeGroupId: 900,
    code: 'IN_SERVICE',
    codeName: '운용',
    displayOrder: 1,
    isActive: true,
  },
  {
    codeValueId: 9002,
    codeGroupId: 900,
    code: 'DISPOSED',
    codeName: '폐기',
    displayOrder: 2,
    isActive: true,
  },
];

export const codeValuesResponse = (items: CodeValue[] = statusCodeValues) => ({
  items,
  page: pageOf(items),
});

type EquipmentInspectionItem = components['schemas']['EquipmentInspectionItem'];
type InspectionItemAssignment = components['schemas']['InspectionItemAssignment'];

/** 기간 단위 값 목록. ⚠ 검교정 주기와 «한 그룹»을 쓴다(설계 `omf-mes#188`). */
export const cycleCodeValues: CodeValue[] = [
  {
    codeValueId: 9101,
    codeGroupId: 910,
    code: 'DAY',
    codeName: '일',
    displayOrder: 1,
    isActive: true,
  },
  {
    codeValueId: 9102,
    codeGroupId: 910,
    code: 'WEEK',
    codeName: '주',
    displayOrder: 2,
    isActive: true,
  },
  {
    codeValueId: 9103,
    codeGroupId: 910,
    code: 'MONTH',
    codeName: '월',
    displayOrder: 3,
    isActive: true,
  },
];

/**
 * 설비 점검 유형. ⛔ **품질 검사의 유형과 값이 겹치지 않는다** — 그룹을 가른 이유다
 * (설계 `omf-mes#186` · 공유계약 G-32).
 */
export const inspectionTypeCodeValues: CodeValue[] = [
  {
    codeValueId: 9201,
    codeGroupId: 920,
    code: 'DAILY',
    codeName: '일상',
    displayOrder: 1,
    isActive: true,
  },
  {
    codeValueId: 9202,
    codeGroupId: 920,
    code: 'MONTHLY',
    codeName: '정기',
    displayOrder: 2,
    isActive: true,
  },
  {
    codeValueId: 9203,
    codeGroupId: 920,
    code: 'MAINTENANCE',
    codeName: '보전',
    displayOrder: 3,
    isActive: true,
  },
];

export const makeInspectionItem = (
  equipmentInspectionItemId: number,
  itemCode: string,
  itemName: string,
  overrides: Partial<EquipmentInspectionItem> = {},
): EquipmentInspectionItem => ({
  equipmentInspectionItemId,
  plantId: 11,
  itemCode,
  itemName,
  inspectionTypeCode: 'DAILY',
  judgmentMethodCode: 'VISUAL',
  requiredFlag: true,
  sequenceNo: 1,
  isActive: true,
  ...overrides,
});

/** 점검 항목 마스터 표본. 값은 전부 합성이다. */
export const inspectionItems: EquipmentInspectionItem[] = [
  makeInspectionItem(4001, 'INS-01', '벨트 장력'),
  makeInspectionItem(4002, 'INS-02', '오일 레벨', { inspectionTypeCode: 'MONTHLY' }),
  makeInspectionItem(4003, 'INS-03', '체결 토크', {
    judgmentMethodCode: 'MEASUREMENT',
    uomId: 3,
    lowerLimit: 10,
    upperLimit: 20,
  }),
];

export const inspectionItemsResponse = (items: EquipmentInspectionItem[] = inspectionItems) => ({
  items,
  page: pageOf(items),
});

export const makeAssignment = (
  item: EquipmentInspectionItem,
  overrides: Partial<InspectionItemAssignment> = {},
): InspectionItemAssignment => ({
  ...item,
  cycleTypeCode: 'DAY',
  cycleInterval: 3,
  ...overrides,
});

export const assignmentsResponse = (items: InspectionItemAssignment[] = []) => ({ items });

/** 판정 방식 두 값(설계 `omf-mes#186`). ⛔ 이 값을 모르면 짝 제약을 걸 수 없다. */
export const judgmentMethodCodeValues: CodeValue[] = [
  {
    codeValueId: 9301,
    codeGroupId: 930,
    code: 'VISUAL',
    codeName: '육안',
    displayOrder: 1,
    isActive: true,
  },
  {
    codeValueId: 9302,
    codeGroupId: 930,
    code: 'MEASUREMENT',
    codeName: '측정값',
    displayOrder: 2,
    isActive: true,
  },
];

/** 측정 단위 표본. 값은 전부 합성이다. */
export const uomsResponse = () => ({
  items: [
    { uomId: 3, uomCode: 'NM', uomName: '뉴턴미터', decimalScale: 2, isActive: true },
    { uomId: 4, uomCode: 'MM', uomName: '밀리미터', decimalScale: 1, isActive: true },
  ],
  page: pageOf([1, 2], 2),
});

/**
 * 설비 세부유형 3값(설계 확정 `omf-mes#224`). ⛔ 계측기 계열(`INSTRUMENT_TYPE`)과 «다른»
 * 그룹이다 — 한 컬럼에 두 계열이 착지하므로 계열마다 그룹을 가른다.
 */
/** 코드값 하나를 만든다 — 목록에 값을 더해 보는 감지기가 쓴다. */
export const makeCodeValue = (code: string, codeName: string): CodeValue => ({
  codeValueId: 9900,
  codeGroupId: 940,
  code,
  codeName,
  displayOrder: 9,
  isActive: true,
});

export const equipmentTypeCodeValues: CodeValue[] = [
  {
    codeValueId: 9401,
    codeGroupId: 940,
    code: 'INJECTION_MOLDING',
    codeName: '사출기',
    displayOrder: 1,
    isActive: true,
  },
  {
    codeValueId: 9402,
    codeGroupId: 940,
    code: 'PRESS',
    codeName: '프레스',
    displayOrder: 2,
    isActive: true,
  },
  {
    codeValueId: 9403,
    codeGroupId: 940,
    code: 'WATER_HEATER',
    codeName: '온수기',
    displayOrder: 3,
    isActive: true,
  },
];
