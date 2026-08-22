import type { components } from '@omf-mes/api-client';

import type { EquipmentGroup } from './types';

/**
 * 시험용 합성 자료. **실 운영 값을 쓰지 않는다** — 공장명·코드는 전부 지어낸 것이다.
 * 공개 저장소 경계(루트 `CLAUDE.md`)가 테스트 픽스처에도 그대로 적용된다.
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
  groupTypeCode: 'PENDING',
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
