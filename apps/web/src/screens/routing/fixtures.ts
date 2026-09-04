import type { Item, Process, Routing, RoutingOperation } from './types';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다. 실제 사번·품목코드·LOT 번호·거래처 코드·
 * 고객사명·공장 위치를 넣지 않는다(공개 저장소 경계).
 */

export const itemFixtures: Item[] = [
  {
    itemId: 5001,
    itemCode: 'ITM-001',
    itemName: '하우징 커버',
    itemTypeCode: 'PRODUCT',
    baseUomId: 41,
    lotControlled: true,
    serialControlTypeCode: 'NONE',
    shelfLifeDays: null,
    inspectionRequired: true,
    fifoPolicyCode: 'FIFO',
    negativeStockAllowed: false,
    storageConditionCode: null,
    openedShelfLifeHours: null,
    isActive: true,
  },
  {
    itemId: 5002,
    itemCode: 'ITM-002',
    itemName: '브래킷',
    itemTypeCode: 'SEMI_FINISHED',
    baseUomId: 41,
    lotControlled: true,
    serialControlTypeCode: 'NONE',
    shelfLifeDays: null,
    inspectionRequired: false,
    fifoPolicyCode: 'FIFO',
    negativeStockAllowed: false,
    storageConditionCode: null,
    openedShelfLifeHours: null,
    isActive: true,
  },
  {
    itemId: 5003,
    itemCode: 'ITM-003',
    itemName: '고정 핀',
    itemTypeCode: 'MATERIAL',
    baseUomId: 41,
    lotControlled: false,
    serialControlTypeCode: 'NONE',
    shelfLifeDays: null,
    inspectionRequired: false,
    fifoPolicyCode: 'FIFO',
    negativeStockAllowed: false,
    storageConditionCode: null,
    openedShelfLifeHours: null,
    isActive: true,
  },
];

/**
 * 같은 품목의 Rev 3판. 계약이 판 번호 내림차순(최신이 위)으로 준다고 정했으므로
 * 픽스처도 그 순서로 둔다 — 화면은 받은 순서를 그대로 그린다.
 * 상태는 작성중·확정·폐기 셋을 한 벌씩 담아 배지 대비를 볼 수 있게 했다.
 */
export const routingFixtures: Routing[] = [
  {
    routingId: 7003,
    itemId: 5001,
    routingCode: 'STANDARD',
    routingVersion: 3,
    statusCode: 'DRAFT',
    effectiveFrom: '2026-03-01',
    effectiveTo: null,
    isDefault: false,
  },
  {
    routingId: 7002,
    itemId: 5001,
    routingCode: 'STANDARD',
    routingVersion: 2,
    statusCode: 'CONFIRMED',
    effectiveFrom: '2026-02-01',
    effectiveTo: '2026-02-28',
    isDefault: true,
  },
  {
    routingId: 7001,
    itemId: 5001,
    routingCode: 'STANDARD',
    routingVersion: 1,
    statusCode: 'OBSOLETE',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-01-31',
    isDefault: false,
  },
];

/**
 * 한 Rev의 공정 라인 2건.
 *
 * **순서 값을 일부러 10·20으로 둔다.** 서버 채번은 서버 재량이고 화면은 그 값을 보이지 않는다 —
 * 표시 번호가 1·2로 나오는지 확인하는 것이 이 픽스처의 목적이다.
 * 관리 플래그도 한쪽은 켜고 한쪽은 전부 꺼서 「없음」 표시를 함께 볼 수 있게 했다.
 */
export const routingOperationFixtures: RoutingOperation[] = [
  {
    routingOperationId: 8001,
    routingId: 7003,
    operationSeq: 10,
    processId: 9001,
    operationName: '1차 사출',
    mesManaged: true,
    materialInputManaged: false,
    productionResultManaged: true,
    inspectionManaged: true,
    isOutsourced: false,
    outputLotRequired: false,
    equipmentRequired: false,
    moldRequired: false,
    standardCycleTimeSec: 45,
    standardYieldRate: 0.98,
  },
  {
    routingOperationId: 8002,
    routingId: 7003,
    operationSeq: 20,
    processId: 9002,
    operationName: '2차 조립',
    mesManaged: false,
    materialInputManaged: false,
    productionResultManaged: false,
    inspectionManaged: false,
    isOutsourced: false,
    outputLotRequired: false,
    equipmentRequired: false,
    moldRequired: false,
    standardCycleTimeSec: null,
    standardYieldRate: null,
  },
];

/** 9003은 미사용이다 — 미사용 공정이 어떻게 표시되는지 확인하는 데 쓴다. */
export const processFixtures: Process[] = [
  {
    processId: 9001,
    processCode: 'OP-INJ',
    processName: '사출',
    processTypeCode: 'STANDARD',
    isActive: true,
  },
  {
    processId: 9002,
    processCode: 'OP-ASM',
    processName: '조립',
    processTypeCode: 'STANDARD',
    isActive: true,
  },
  {
    processId: 9003,
    processCode: 'OP-PNT',
    processName: '도장',
    processTypeCode: 'STANDARD',
    isActive: false,
  },
];
