import type { CollectionChannel, Equipment, PageMeta } from './types';

/** 값은 전부 합성이다. 실 운영 값을 쓰지 않는다. */

export const pageMeta = (total: number, size = 100): PageMeta => ({ page: 1, size, total });

export const makeEquipment = (
  equipmentId: number,
  equipmentCode: string,
  equipmentName: string,
  overrides: Partial<Equipment> = {},
): Equipment => ({
  equipmentId,
  plantId: 11,
  equipmentCode,
  equipmentName,
  equipmentTypeCode: 'PRESS',
  statusCode: 'IN_SERVICE',
  calibrationRequired: false,
  isActive: true,
  ...overrides,
});

export const equipmentItems: Equipment[] = [
  makeEquipment(3001, 'EQ-101', '가상 성형기 1호'),
  makeEquipment(3002, 'EQ-102', '가상 성형기 2호'),
  makeEquipment(3003, 'EQ-103', '가상 검사기 1호', { isActive: false }),
];

export const equipmentListResponse = (
  items: Equipment[] = equipmentItems,
  total: number = items.length,
) => ({ items, page: pageMeta(total) });

export const makeChannel = (
  collectionChannelId: number,
  channelKey: string,
  overrides: Partial<CollectionChannel> = {},
): CollectionChannel => ({
  collectionChannelId,
  equipmentId: 3001,
  equipmentCode: 'EQ-101',
  channelKey,
  isActive: true,
  ...overrides,
});

export const channelItems: CollectionChannel[] = [
  makeChannel(7001, 'CYCLE_TIME', {
    signalName: '사이클 타임',
    unitCode: 'SEC',
    inspectionItemId: 5001,
  }),
  makeChannel(7002, 'DIM_A', { signalName: '외경 A', unitCode: 'MM', inspectionItemId: 5002 }),
  /** ⭐ 이 둘이 이 화면의 이유다 — 받아도 버려지는 채널. */
  makeChannel(7003, 'BARREL_TEMP', { signalName: '배럴 온도', unitCode: 'CEL' }),
  makeChannel(7004, 'PRESS_FORCE', { inspectionItemId: null }),
];

export const channelListResponse = (
  items: CollectionChannel[] = channelItems,
  totalCount?: number,
) => (totalCount === undefined ? { items } : { items, totalCount });

export const plantListResponse = () => ({
  items: [
    { plantId: 11, plantCode: 'P1', plantName: '가상 1공장', isActive: true },
    { plantId: 12, plantCode: 'P2', plantName: '가상 2공장', isActive: true },
  ],
  page: pageMeta(2),
});
