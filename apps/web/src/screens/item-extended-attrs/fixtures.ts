import type { components } from '@omf-mes/api-client';

import type { Item } from './types';

type Uom = components['schemas']['Uom'];
type BusinessUnit = components['schemas']['BusinessUnit'];
type ItemBuItemMap = components['schemas']['ItemBuItemMap'];
type ItemUomConversion = components['schemas']['ItemUomConversion'];
type Partner = components['schemas']['Partner'];
type ItemExternalCode = components['schemas']['ItemExternalCode'];
type Bom = components['schemas']['Bom'];
type BomComponent = components['schemas']['BomComponent'];
type Routing = components['schemas']['Routing'];
type RoutingOperation = components['schemas']['RoutingOperation'];
type Process = components['schemas']['Process'];

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
    lotControlled: true,
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
    lotControlled: true,
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
    lotControlled: false,
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
    externalSystemCode: 'UNIERP',
    partnerId: 6001,
    externalItemCode: 'SYN-EXT-ITEM-01',
  },
  {
    itemExternalCodeId: 5502,
    itemId: 1001,
    externalSystemCode: 'TRACKING_SYSTEM',
    partnerId: null,
    externalItemCode: 'SYN-EXT-ITEM-02',
  },
];

/**
 * 자재 명세서 헤더 2건. 한 품목에 Rev가 여럿인 형태다.
 *
 * - 2001 — **기본이 아니다.** 기본 지정 액션이 열려 있는 줄
 * - 2002 — **기본이다.** 지정 액션이 사유 붙은 비활성이 되는 줄 · 유효 종료가 **널**이다(무기한)
 *
 * 둘 다 `statusCode`가 값 목록 미정 코드라 화면이 이름을 지어내지 않고 그대로 낸다.
 */
export const bomFixtures: Bom[] = [
  {
    bomId: 2001,
    parentItemId: 1001,
    bomCode: 'SYN-BOM-01',
    bomVersion: 1,
    statusCode: 'SYN-BOM-STATUS-A',
    isDefault: false,
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    baseQty: 100,
    baseUomId: 7001,
  },
  {
    bomId: 2002,
    parentItemId: 1001,
    bomCode: 'SYN-BOM-02',
    bomVersion: 2,
    statusCode: 'SYN-BOM-STATUS-B',
    isDefault: true,
    effectiveFrom: '2026-03-01',
    effectiveTo: null,
    baseQty: 250,
    baseUomId: 9999,
  },
];

/**
 * 구성품 3건. **원본 열 여섯과 확장 열 넷이 한 행에 섞여 있는** 계약 표현 그대로다.
 *
 * - 7001 — 확장 넷이 모두 채워졌다. 스크랩률이 **0.05**라 퍼센트 환산 여부가 눈에 보인다 ·
 *   등록 공정이 **채번 순서 20 · 목록 내 위치 2**라 둘을 구분해 볼 수 있다
 * - 7002 — 확장 공정 둘이 **널**이고 확장 표시 둘이 꺼져 있다 · 스크랩률이 **0**이다
 *   (계약 기본값 · 「0%」가 아니라 「0」이어야 한다) · 구성품 번호가 품목 목록에 **없다**(9001)
 * - 7003 — 스크랩률이 **1**이다(계약 상한 · 「100%」가 아니다) · 등록 공정이 **옛 Rev**의 줄이라
 *   최신 Rev만 평탄화하면 이름을 잃는다(M32)
 */
export const bomComponentFixtures: BomComponent[] = [
  {
    bomComponentId: 7001,
    bomId: 2001,
    componentItemId: 1002,
    routingOperationId: 8002,
    actualUseProcessId: 3001,
    requiredQty: 2,
    uomId: 7001,
    scrapRate: 0.05,
    isMandatory: true,
    lotTraceRequired: true,
    backflushAllowed: true,
    sequenceNo: 1,
  },
  {
    bomComponentId: 7002,
    bomId: 2001,
    componentItemId: 9001,
    routingOperationId: null,
    actualUseProcessId: null,
    requiredQty: 10,
    uomId: 7003,
    scrapRate: 0,
    isMandatory: false,
    lotTraceRequired: false,
    backflushAllowed: false,
    sequenceNo: 2,
  },
  {
    bomComponentId: 7003,
    bomId: 2001,
    componentItemId: 1003,
    routingOperationId: 8003,
    actualUseProcessId: 3002,
    requiredQty: 1,
    uomId: 7001,
    scrapRate: 1,
    isMandatory: true,
    lotTraceRequired: false,
    backflushAllowed: true,
    sequenceNo: 3,
  },
];

/**
 * Routing Rev 2건. 계약이 `routingVersion` 내림차순(최신이 위)으로 준다.
 * **둘 다 있어야 「최신 Rev만 쓰지 않는다」를 실제로 잴 수 있다**(M32).
 */
export const routingFixtures: Routing[] = [
  {
    routingId: 9002,
    itemId: 1001,
    routingCode: 'SYN-ROUTING-01',
    routingVersion: 2,
    statusCode: 'SYN-ROUTING-STATUS-A',
    effectiveFrom: '2026-03-01',
    effectiveTo: null,
    isDefault: true,
  },
  {
    routingId: 9001,
    itemId: 1001,
    routingCode: 'SYN-ROUTING-01',
    routingVersion: 1,
    statusCode: 'SYN-ROUTING-STATUS-B',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-02-28',
    isDefault: false,
  },
];

const routingOperation = (overrides: Partial<RoutingOperation>): RoutingOperation => ({
  routingOperationId: 8001,
  routingId: 9002,
  operationSeq: 10,
  processId: 3001,
  operationName: '합성 공정 A',
  mesManaged: true,
  materialInputManaged: false,
  productionResultManaged: true,
  inspectionManaged: false,
  isOutsourced: false,
  outputLotRequired: false,
  equipmentRequired: false,
  moldRequired: false,
  standardCycleTimeSec: null,
  standardYieldRate: null,
  ...overrides,
});

/**
 * Rev별 공정 라인. **서버 채번 순서(`operationSeq`)가 10·20처럼 띄어 있다** —
 * 화면은 그 값을 그대로 내지 않고 목록 내 위치로 1부터 센다(계약).
 */
export const routingOperationFixtures: Record<number, RoutingOperation[]> = {
  9002: [
    routingOperation({ routingOperationId: 8001, operationSeq: 10, operationName: '합성 공정 A' }),
    routingOperation({ routingOperationId: 8002, operationSeq: 20, operationName: '합성 공정 B' }),
  ],
  9001: [
    routingOperation({
      routingOperationId: 8003,
      routingId: 9001,
      operationSeq: 10,
      operationName: '합성 공정 C',
    }),
  ],
};

/**
 * 공정 마스터 2건 — 구성품의 「실사용 공정」. 등록 공정과 **다른 자원이다.**
 * 둘째는 **미사용**이라 선택지에서 걸러지되 지금 고른 값이면 표식이 붙는다.
 */
export const processFixtures: Process[] = [
  {
    processId: 3001,
    processCode: 'SYN-PROC-01',
    processName: '합성 공정 가',
    processTypeCode: 'SYN-PROC-TYPE-A',
    isActive: true,
  },
  {
    processId: 3002,
    processCode: 'SYN-PROC-02',
    processName: '합성 공정 나',
    processTypeCode: 'SYN-PROC-TYPE-A',
    isActive: false,
  },
];
