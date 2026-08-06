import type { Item } from './types';

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
