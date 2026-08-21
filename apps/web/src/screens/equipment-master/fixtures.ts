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
