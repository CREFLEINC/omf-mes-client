import type { components } from '@omf-mes/api-client';

import { toRuleView, type PutawayRule, type RuleView, type UncoveredItem } from './types';

/**
 * 합성 시험 자료.
 *
 * **실 운영 값을 쓰지 않는다.** 계약의 `@example` 값도 쓰지 않는다 — 그것은 예시이지
 * 확정이 아니고, 시험 자료에 심으면 화면 코드보다 오래 남아 나중에 「이 값이 정본이었다」로
 * 읽힌다. 번호는 9000대 합성 대역, 코드는 `SYN-` 접두, 이름은 「합성…」으로 지어낸다.
 *
 * **놓치기 쉬운 입력을 처음부터 담는다** — 위치를 비운 창고 전체 규칙이 있고, 미사용 규칙이
 * 있으며, 이름 목록에 없는 품목·위치·단위를 가리키는 규칙이 있다. 미사용 위치와 미사용
 * 품목도 하나씩 둔다(그것을 가리키는 규칙이 정상적으로 존재한다).
 */

type Warehouse = components['schemas']['Warehouse'];
type Location = components['schemas']['Location'];
type Item = components['schemas']['Item'];
type Uom = components['schemas']['Uom'];

export const warehouseFixtures: Warehouse[] = [
  {
    warehouseId: 9201,
    plantId: 9001,
    businessUnitId: 9002,
    warehouseCode: 'SYN-WH-01',
    warehouseName: '합성창고 가',
    warehouseTypeCode: 'SYN-WH-TYPE',
    managementLevelCode: 'SYN-LEVEL',
    isExternal: false,
    isActive: true,
  },
  {
    warehouseId: 9202,
    plantId: 9001,
    businessUnitId: 9002,
    warehouseCode: 'SYN-WH-02',
    warehouseName: '합성창고 나',
    warehouseTypeCode: 'SYN-WH-TYPE',
    managementLevelCode: 'SYN-LEVEL',
    isExternal: false,
    /** 미사용 창고 — 선택지에 표식이 붙되 빠지지 않는다. */
    isActive: false,
  },
];

export const WAREHOUSE_LABEL = 'SYN-WH-01 · 합성창고 가';

export const locationFixtures: Location[] = [
  {
    locationId: 9301,
    warehouseId: 9201,
    locationCode: 'SYN-LOC-01',
    locationName: '합성위치 가',
    locationTypeCode: 'SYN-LOC-TYPE',
    allowMixedItem: false,
    allowMixedLot: false,
    isActive: true,
  },
  {
    locationId: 9302,
    warehouseId: 9201,
    locationCode: 'SYN-LOC-02',
    locationName: '합성위치 나',
    locationTypeCode: 'SYN-LOC-TYPE',
    allowMixedItem: false,
    allowMixedLot: false,
    /** 미사용 위치에 남은 규칙을 그대로 다루는 것이 이 마스터의 정상 업무다. */
    isActive: false,
  },
];

export const LOCATION_LABEL = 'SYN-LOC-01 · 합성위치 가';
/** 미사용 위치의 이름. **표기에는 미사용 표식이 붙지 않는다** — 표식은 고르는 자리에만 붙는다. */
export const INACTIVE_LOCATION_LABEL = 'SYN-LOC-02 · 합성위치 나';

export const itemFixtures: Item[] = [
  {
    itemId: 9101,
    itemCode: 'SYN-ITEM-01',
    itemName: '합성품목 가',
    itemTypeCode: 'SYN-ITEM-TYPE',
    baseUomId: 9401,
    lotControlTypeCode: 'SYN-LOT-CTRL',
    serialControlTypeCode: 'SYN-SERIAL-CTRL',
    inspectionRequired: false,
    fifoPolicyCode: 'SYN-FIFO',
    negativeStockAllowed: false,
    isActive: true,
  },
  {
    itemId: 9102,
    itemCode: 'SYN-ITEM-02',
    itemName: '합성품목 나',
    itemTypeCode: 'SYN-ITEM-TYPE',
    baseUomId: 9401,
    lotControlTypeCode: 'SYN-LOT-CTRL',
    serialControlTypeCode: 'SYN-SERIAL-CTRL',
    inspectionRequired: false,
    fifoPolicyCode: 'SYN-FIFO',
    negativeStockAllowed: false,
    isActive: true,
  },
];

export const ITEM_LABEL = 'SYN-ITEM-01 · 합성품목 가';

export const uomFixtures: Uom[] = [
  {
    uomId: 9401,
    uomCode: 'SYN-UOM-01',
    uomName: '합성단위 가',
    decimalScale: 0,
    isActive: true,
  },
  {
    uomId: 9402,
    uomCode: 'SYN-UOM-02',
    uomName: '합성단위 나',
    decimalScale: 2,
    isActive: true,
  },
];

export const UOM_LABEL = 'SYN-UOM-01 · 합성단위 가';

/**
 * 적치 규칙 넷.
 *
 * - **9001** 정상 — 위치가 있고 사용 중이다
 * - **9002** 위치를 비운 **창고 전체 규칙**. 우선순위가 더 크다(늦게 권장된다)
 * - **9003** **미사용** 규칙. 목록에 보이고 다시 켜는 것이 정상 운용이다(이슈 §6)
 * - **9004** 이름 목록에 **없는** 품목·위치·단위를 가리킨다 — 「알 수 없음」 갈래가 실제로 걸린다
 */
export const ruleFixtures: PutawayRule[] = [
  {
    putawayRuleId: 9001,
    itemId: 9101,
    warehouseId: 9201,
    locationId: 9301,
    capacityQty: 500,
    uomId: 9401,
    priorityNo: 10,
    remarks: '합성 비고',
    isActive: true,
  },
  {
    putawayRuleId: 9002,
    itemId: 9102,
    warehouseId: 9201,
    /** 위치를 비운 창고 전체 규칙. 값이 빠진 것이 아니라 확정된 뜻이다. */
    locationId: null,
    capacityQty: 1200,
    uomId: 9402,
    priorityNo: 100,
    remarks: null,
    isActive: true,
  },
  {
    putawayRuleId: 9003,
    itemId: 9101,
    warehouseId: 9201,
    locationId: 9302,
    capacityQty: 80,
    uomId: 9401,
    priorityNo: 200,
    remarks: null,
    isActive: false,
  },
  {
    putawayRuleId: 9004,
    /** 이름 목록에 없는 번호들 — 네 갈래 중 「알 수 없음」이 걸리는 자리다. */
    itemId: 9199,
    warehouseId: 9201,
    locationId: 9399,
    capacityQty: 30,
    uomId: 9499,
    priorityNo: 300,
    remarks: null,
    isActive: true,
  },
];

export const ruleViewFixtures: RuleView[] = ruleFixtures.map(toRuleView);

/**
 * 규칙 없는 품목 둘. **하나는 입고 시각이 없다** — 계약이 그 값을 선택으로 두었고,
 * 없는 것을 「—」로 뭉개면 「받은 적 없다」와 「값이 안 왔다」가 갈리지 않는다.
 */
export const uncoveredItemFixtures: UncoveredItem[] = [
  {
    itemId: 9103,
    itemCode: 'SYN-ITEM-03',
    itemName: '합성품목 다',
    lastReceivedAt: '2026-08-06T09:14:00+09:00',
  },
  {
    itemId: 9104,
    itemCode: 'SYN-ITEM-04',
    itemName: '합성품목 라',
    lastReceivedAt: null,
  },
];
