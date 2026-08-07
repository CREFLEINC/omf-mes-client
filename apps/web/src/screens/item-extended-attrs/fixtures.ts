import type { components } from '@omf-mes/api-client';

import type { Item } from './types';

type Uom = components['schemas']['Uom'];
type BusinessUnit = components['schemas']['BusinessUnit'];
type ItemBuItemMap = components['schemas']['ItemBuItemMap'];
type ItemUomConversion = components['schemas']['ItemUomConversion'];
type Partner = components['schemas']['Partner'];
type ItemExternalCode = components['schemas']['ItemExternalCode'];

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
 * 단위 3건. **1003의 `baseUomId`(9999)는 일부러 여기 없다** —
 * 목록에서 찾지 못한 번호를 화면이 그대로 내지 않고 「알 수 없음」으로 내는지 본다.
 *
 * 둘째는 **미사용**이라 선택지에서 걸러지고, 셋째가 있어야 「변환 전 ≠ 변환 후」를
 * 실제로 만들 수 있다.
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
  {
    uomId: 7003,
    uomCode: 'SYN-UOM-03',
    uomName: '합성 단위 C',
    decimalScale: 3,
    isActive: true,
  },
];

/**
 * 사업부 3건. 셋째는 **미사용**이다 —
 * 지금 고른 값이 미사용이면 선택지에서 빼지 않고 표식을 붙이는지 본다(`selectableOptions`).
 * 사용 중인 것이 둘 있어야 「보내는 ≠ 받는」을 실제로 만들 수 있다.
 */
export const businessUnitFixtures: BusinessUnit[] = [
  {
    businessUnitId: 5001,
    legalEntityId: 4001,
    businessUnitCode: 'SYN-BU-01',
    businessUnitName: '합성 사업부 A',
    isActive: true,
  },
  {
    businessUnitId: 5002,
    legalEntityId: 4001,
    businessUnitCode: 'SYN-BU-02',
    businessUnitName: '합성 사업부 B',
    isActive: true,
  },
  {
    businessUnitId: 5003,
    legalEntityId: 4001,
    businessUnitCode: 'SYN-BU-03',
    businessUnitName: '합성 사업부 C',
    isActive: false,
  },
];

/**
 * 사업부 매핑 2건.
 *
 * - 3001 — 유효 종료가 있다
 * - 3002 — 유효 종료가 **널**이다(무기한) · 보내는 사업부가 **미사용**이다 ·
 *   대상 품목 번호가 품목 목록에 **없다**(9001).
 *   행 단위 이름 조회가 실패했을 때 번호를 그대로 내지 않는지 본다(결정 12)
 */
export const buMapFixtures: ItemBuItemMap[] = [
  {
    itemBuItemMapId: 3001,
    fromBusinessUnitId: 5001,
    fromItemId: 1001,
    toBusinessUnitId: 5002,
    toItemId: 1002,
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
  },
  {
    itemBuItemMapId: 3002,
    fromBusinessUnitId: 5003,
    fromItemId: 1001,
    toBusinessUnitId: 5001,
    toItemId: 9001,
    effectiveFrom: '2026-02-01',
    effectiveTo: null,
  },
];

/**
 * 단위 환산 2건.
 *
 * - 4001 — 유효 종료가 있다
 * - 4002 — 유효 종료가 **널**이고 환산 비율이 **소수점 여덟 자리**다(`numeric(18,8)`).
 *   자릿수를 손대면 사용자가 고치지 않은 줄이 저장할 때 다른 값이 된다
 */
export const uomConversionFixtures: ItemUomConversion[] = [
  {
    itemUomConversionId: 4001,
    itemId: 1001,
    fromUomId: 7001,
    toUomId: 7002,
    conversionRate: 2.5,
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
  },
  {
    itemUomConversionId: 4002,
    itemId: 1001,
    fromUomId: 7002,
    toUomId: 7001,
    conversionRate: 0.00012345,
    effectiveFrom: '2026-02-01',
    effectiveTo: null,
  },
];

/**
 * 거래처 2건. 둘째는 **미사용**이다 —
 * 지금 고른 값이 미사용이면 선택지에서 빼지 않고 표식을 붙이는지 본다.
 */
export const partnerFixtures: Partner[] = [
  {
    partnerId: 6001,
    partnerCode: 'SYN-PARTNER-01',
    partnerName: '합성 거래처 A',
    isActive: true,
  },
  {
    partnerId: 6002,
    partnerCode: 'SYN-PARTNER-02',
    partnerName: '합성 거래처 B',
    isActive: false,
  },
];

/**
 * 외부 코드 2건.
 *
 * - 5501 — 거래처를 고른 줄
 * - 5502 — 거래처가 **널**이다(전체). `COALESCE(partner_id,0)` 접기의 대상이라
 *   거래처를 비운 줄을 하나 더 만들면 서버에게 같은 짝이 된다(A-7)
 */
export const externalCodeFixtures: ItemExternalCode[] = [
  {
    itemExternalCodeId: 5501,
    itemId: 1001,
    externalSystemCode: 'SYN-EXT-01',
    partnerId: 6001,
    externalItemCode: 'SYN-EXT-ITEM-01',
  },
  {
    itemExternalCodeId: 5502,
    itemId: 1001,
    externalSystemCode: 'SYN-EXT-02',
    partnerId: null,
    externalItemCode: 'SYN-EXT-ITEM-02',
  },
];
