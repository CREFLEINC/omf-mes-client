import type { components } from '@omf-mes/api-client';

import type { Item } from './types';

type Uom = components['schemas']['Uom'];

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다(`SYN-` 계열). 실제 품목코드·단위코드·거래처 코드를
 * 넣지 않는다(공개 저장소 경계).
 *
 * **계약의 `example` 문자열(`"STANDARD"`)을 옮기지 않는다.** 그것은 스키마 예시이지 코드값이 아니며,
 * 픽스처에 넣으면 화면이 값 목록을 아는 것처럼 보인다.
 */

/**
 * 품목 3건. 원본 4열과 확장 속성이 한 객체에 섞인 계약 표현 그대로다.
 *
 * - 1001 — 전 항목이 채워진 기준 행. 유효기한 관리 **ON**(`shelfLifeDays`가 널이 아니다)
 * - 1002 — 선택 항목이 전부 널이고 품목유형이 빈 문자열이다. 「—」 표기를 볼 수 있다
 * - 1003 — **미사용 품목**이다. `isActive`를 되돌려 싣지 않으면 저장하는 순간 되살아난다(결정 3).
 *   더해 `shelfLifeDays`가 **0**이고(계약 `minimum: 0` — 0은 「비었다」가 아니다),
 *   선출 정책이 화면이 모르는 값이며, 기준 단위 번호가 조회 목록에 없다
 */
export const itemFixtures: Item[] = [
  {
    itemId: 1001,
    itemCode: 'SYN-ITEM-01',
    itemName: '합성 품목 A',
    itemTypeCode: 'SYN-TYPE-A',
    baseUomId: 7001,
    lotControlTypeCode: 'SYN-LOT-01',
    serialControlTypeCode: 'NONE',
    shelfLifeDays: 30,
    inspectionRequired: true,
    fifoPolicyCode: 'FIFO',
    negativeStockAllowed: false,
    storageConditionCode: 'SYN-STORAGE-01',
    openedShelfLifeHours: 48,
    isActive: true,
  },
  {
    itemId: 1002,
    itemCode: 'SYN-ITEM-02',
    itemName: '합성 품목 B',
    itemTypeCode: '',
    baseUomId: 7002,
    lotControlTypeCode: 'SYN-LOT-02',
    serialControlTypeCode: 'NONE',
    shelfLifeDays: null,
    inspectionRequired: false,
    fifoPolicyCode: 'FEFO',
    negativeStockAllowed: true,
    storageConditionCode: null,
    openedShelfLifeHours: null,
    isActive: true,
  },
  {
    itemId: 1003,
    itemCode: 'SYN-ITEM-03',
    itemName: '합성 품목 C',
    itemTypeCode: 'SYN-TYPE-B',
    baseUomId: 9999,
    lotControlTypeCode: 'SYN-LOT-03',
    serialControlTypeCode: 'SYN-SERIAL-01',
    shelfLifeDays: 0,
    inspectionRequired: false,
    fifoPolicyCode: 'SYN-POLICY-X',
    negativeStockAllowed: false,
    storageConditionCode: 'SYN-STORAGE-02',
    openedShelfLifeHours: 1,
    isActive: false,
  },
];

/**
 * 단위 2건. **1003의 `baseUomId`(9999)는 일부러 여기 없다** —
 * 목록에서 찾지 못한 번호를 화면이 그대로 내지 않고 「알 수 없음」으로 내는지 본다.
 */
export const uomFixtures: Uom[] = [
  {
    uomId: 7001,
    uomCode: 'SYN-UOM-01',
    uomName: '합성 단위 A',
    decimalScale: 0,
    isActive: true,
  },
  {
    uomId: 7002,
    uomCode: 'SYN-UOM-02',
    uomName: '합성 단위 B',
    decimalScale: 2,
    isActive: false,
  },
];
