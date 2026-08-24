import type {
  CollectionChannel,
  CollectionChannelObservation,
  Equipment,
  InspectionItemSpec,
  InspectionPlan,
  InspectionPlanVersion,
  PageMeta,
} from './types';

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

export const makePlan = (
  inspectionPlanId: number,
  inspectionPlanCode: string,
  inspectionPlanName: string,
): InspectionPlan => ({
  inspectionPlanId,
  inspectionPlanCode,
  inspectionPlanName,
  inspectionTypeCode: 'PQC',
  isActive: true,
});

export const planItems: InspectionPlan[] = [
  makePlan(4001, 'IP-101', '가상 성형 공정 검사기준'),
  makePlan(4002, 'IP-102', '가상 조립 공정 검사기준'),
];

export const planListResponse = (
  items: InspectionPlan[] = planItems,
  total: number = items.length,
) => ({ items, page: pageMeta(total, 200) });

export const makeVersion = (
  inspectionPlanVersionId: number,
  inspectionPlanId: number,
  planVersion: number,
  statusCode = 'CONFIRMED',
): InspectionPlanVersion => ({
  inspectionPlanVersionId,
  inspectionPlanId,
  planVersion,
  effectiveFrom: '2026-01-01',
  samplingMethodCode: 'FULL',
  inspectionFrequencyCode: 'EVERY_LOT',
  statusCode,
});

export const versionItems: InspectionPlanVersion[] = [
  makeVersion(4101, 4001, 2),
  makeVersion(4102, 4001, 1, 'OBSOLETE'),
];

export const versionListResponse = (items: InspectionPlanVersion[] = versionItems) => ({ items });

export const makeSpec = (
  inspectionItemSpecId: number,
  inspectionItemCode: string,
  inspectionItemName: string,
  overrides: Partial<InspectionItemSpec> = {},
): InspectionItemSpec => ({
  inspectionItemSpecId,
  inspectionPlanVersionId: 4101,
  sequenceNo: 1,
  inspectionItemCode,
  inspectionItemName,
  dataTypeCode: 'NUMERIC',
  measurementCount: 1,
  requiredFlag: true,
  automaticJudgment: true,
  ...overrides,
});

export const specItems: InspectionItemSpec[] = [
  makeSpec(5001, 'CYCLE', '사이클 타임', { uomId: 1, sequenceNo: 1 }),
  /** ⭐ 단위가 채널과 «다른» 항목 — 경고가 서는지 보는 자리다. */
  makeSpec(5002, 'BARREL_T', '배럴 온도', { uomId: 2, sequenceNo: 2 }),
  /** 단위를 옮길 수 없는 항목 — 「모른다」가 서는지 보는 자리다. */
  makeSpec(5003, 'NO_UOM', '단위 미지정 항목', { uomId: 999, sequenceNo: 3 }),
  /** 단위가 아예 없는 항목 — 견줄 것이 없다. */
  makeSpec(5004, 'TEXT_ONLY', '텍스트 항목', { dataTypeCode: 'TEXT', sequenceNo: 4 }),
];

export const specListResponse = (items: InspectionItemSpec[] = specItems) => ({ items });

export const uomListResponse = () => ({
  items: [
    { uomId: 1, uomCode: 'SEC', uomName: '초', decimalScale: 2, isActive: true },
    { uomId: 2, uomCode: 'CEL', uomName: '섭씨온도', decimalScale: 1, isActive: true },
    { uomId: 3, uomCode: 'MM', uomName: '밀리미터', decimalScale: 2, isActive: true },
  ],
  page: pageMeta(3),
});

export const makeObservation = (
  channelKey: string,
  overrides: Partial<CollectionChannelObservation> = {},
): CollectionChannelObservation => ({
  channelKey,
  observedAt: '2026-08-20T09:40:00+07:00',
  ...overrides,
});

export const observationItems: CollectionChannelObservation[] = [
  makeObservation('CYCLE_TIME', { lastValue: '12.4', alreadyMapped: true }),
  /** ⭐ 아직 잇지 않은 신호 — 이 창이 있는 이유다. */
  makeObservation('SCREW_RPM', { lastValue: '182.4' }),
  makeObservation('MOLD_TEMP', { lastValue: '58.1', alreadyMapped: false }),
  /** 최근 값이 오지 않는 신호도 있다 — 빈 칸으로 두지 않는다. */
  makeObservation('DOOR_STATE'),
];

export const observationListResponse = (
  items: CollectionChannelObservation[] = observationItems,
  totalCount?: number,
) => (totalCount === undefined ? { items } : { items, totalCount });

/** 조건 축의 선택지 — 품목·공정. 값은 전부 합성이다. */
export const scopeItemsResponse = () => ({
  items: [
    { itemId: 21, itemCode: 'ITM-201', itemName: '가상 하우징', isActive: true },
    { itemId: 22, itemCode: 'ITM-202', itemName: '가상 커버', isActive: true },
  ],
  page: pageMeta(2),
});

export const scopeProcessesResponse = () => ({
  items: [
    { processId: 31, processCode: 'PRC-301', processName: '가상 프레스', isActive: true },
    { processId: 32, processCode: 'PRC-302', processName: '가상 조립', isActive: true },
  ],
  page: pageMeta(2),
});
