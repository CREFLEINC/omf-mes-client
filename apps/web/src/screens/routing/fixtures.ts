import type { Item, Routing } from './types';

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
    lotControlTypeCode: 'LOT',
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
    lotControlTypeCode: 'LOT',
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
    lotControlTypeCode: 'NONE',
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
  },
  {
    routingId: 7002,
    itemId: 5001,
    routingCode: 'STANDARD',
    routingVersion: 2,
    statusCode: 'CONFIRMED',
    effectiveFrom: '2026-02-01',
    effectiveTo: '2026-02-28',
  },
  {
    routingId: 7001,
    itemId: 5001,
    routingCode: 'STANDARD',
    routingVersion: 1,
    statusCode: 'OBSOLETE',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-01-31',
  },
];
