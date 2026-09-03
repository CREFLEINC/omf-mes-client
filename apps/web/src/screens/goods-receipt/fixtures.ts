import type { IrLineView, IrView } from './types';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다. 이 화면은 입하번호·거래처·품목·LOT처럼
 * **실제로 보일 법한 값**을 그리는 자리라, 한눈에 예시임이 보이는 접두(`SAMPLE-`·`SAMPLE_`)와
 * 지어낸 번호 대역(`IR-2026-9…`·`LOT-2026-9…`)만 쓴다. 실 운영 코드·거래처명·품목코드를
 * 넣지 않는다(공개 저장소 경계).
 *
 * **계약의 `@example` 값을 쓰지 않는다**(`PURCHASE`·`INBOUND_RECEIPT`·`RELEASED`·`AVAILABLE`).
 * 예시를 픽스처에 쓰면 나중에 「확정 값」으로 읽힌다.
 *
 * **내부 번호(FK)는 서로 겹치지 않는 대역으로 나눈다** — 9000대(입하 전표) · 9400대(입하 라인) ·
 * 9100~9600대(참조) · 9700대(창고) · 9800대(적치 위치) · 9900대(입고 전표와 그 라인).
 * 「표 어디에도 내부 번호가 렌더되지 않는다」를 검사할 때 줄번호·수량 같은 정상 숫자와
 * 헷갈리지 않게 하기 위해서다. 업무 번호에 내부 번호가 **부분 문자열로 들어가지 않도록**
 * 대역을 갈라 두었다 — 입고번호를 `GR-2026-8…`로 둔 것이 그 때문이다.
 */

const BASE_RECEIPT: IrView = {
  inboundReceiptId: 9001,
  inboundReceiptNo: 'IR-2026-900001',
  supplierId: 9101,
  plantId: 9201,
  receiptDatetime: '2026-08-06T09:12:00+09:00',
  deliveryNoteNo: 'DN-2026-900001',
  statusCode: 'SAMPLE_IR_STATUS_A',
};

/** 한 항목만 다른 건을 만든다. 무엇을 검사하는 테스트인지 그 인자만 보고 읽히게 한다. */
export const inboundReceipt = (overrides: Partial<IrView> = {}): IrView => ({
  ...BASE_RECEIPT,
  ...overrides,
});

/**
 * 화면 수준 테스트가 목록 응답으로 쓰는 세 건. 화면이 다뤄야 하는 까다로운 입력을 일부러 담는다.
 *
 * - 9001 — 값이 전부 채워져 있다. 라인 픽스처가 이 전표의 것이다
 * - 9002 — **공급사 번호가 참조 목록에 없고** 거래명세서번호가 `null`이다
 * - 9003 — 공장이 9001과 다르다. 상태 코드가 9001과 같아 코드가 접히는지 드러난다
 */
export const inboundReceiptFixtures: IrView[] = [
  inboundReceipt(),
  inboundReceipt({
    inboundReceiptId: 9002,
    inboundReceiptNo: 'IR-2026-900002',
    supplierId: 9102,
    deliveryNoteNo: null,
    statusCode: 'SAMPLE_IR_STATUS_B',
  }),
  inboundReceipt({
    inboundReceiptId: 9003,
    inboundReceiptNo: 'IR-2026-900003',
    plantId: 9202,
    receiptDatetime: '2026-08-07T10:05:00+09:00',
  }),
];

const BASE_LINE: IrLineView = {
  inboundReceiptLineId: 9401,
  inboundReceiptId: 9001,
  lineNo: 1,
  itemId: 9301,
  receivedQty: 100,
  uomId: 9501,
  expiryDate: '2027-08-06',
  lotId: 9601,
  inspectionRequired: true,
  statusCode: 'SAMPLE_IR_LINE_STATUS_A',
};

export const inboundReceiptLine = (overrides: Partial<IrLineView> = {}): IrLineView => ({
  ...BASE_LINE,
  ...overrides,
});

/**
 * 9001의 라인 네 줄. **고를 수 있는 줄과 없는 줄이 함께 있어야** 판정이 실제로 검사된다.
 *
 * - 9401 — 전부 채워져 있다. **고를 수 있다**
 * - 9402 — 수량이 **소수**이고 **품목이 참조 목록에 없다**. 유효기한이 `null`이며
 *   수입검사 대상이 아니다. **고를 수 있다**(둘째 줄이 있어야 「한 줄만 고른다」를 검사할 수 있다)
 * - 9403 — **자재 LOT이 없다.** 고를 수 없는 첫째 사유
 * - 9404 — 수량이 **0**이다. 고를 수 없는 둘째 사유이며, **LOT 번호가 참조 목록에 없어**
 *   「목록에 없음」 갈래도 함께 만든다
 */
export const inboundReceiptLineFixtures: IrLineView[] = [
  inboundReceiptLine(),
  inboundReceiptLine({
    inboundReceiptLineId: 9402,
    lineNo: 2,
    itemId: 9302,
    receivedQty: 12.5,
    expiryDate: null,
    lotId: 9602,
    inspectionRequired: false,
  }),
  inboundReceiptLine({
    inboundReceiptLineId: 9403,
    lineNo: 3,
    receivedQty: 40,
    lotId: null,
  }),
  inboundReceiptLine({
    inboundReceiptLineId: 9404,
    lineNo: 4,
    receivedQty: 0,
    lotId: 9603,
  }),
];

/**
 * 참조 목록의 응답 본문. **화면이 읽는 필드만 담는다** — 스텁 응답은 JSON이라
 * 계약의 모든 필드를 갖출 필요가 없고, 갖추면 무엇을 읽는지가 오히려 가려진다.
 *
 * 목록에 **없는 번호**를 가진 행이 픽스처에 함께 있다(9002의 공급사 · 9402의 품목 ·
 * 9404의 LOT) — 「목록에 없음」 갈래를 실제 값으로 만들어 내는 유일한 방법이다.
 */
export const partnerFixtures = [
  { partnerId: 9101, partnerCode: 'SAMPLE-SUP-01', partnerName: '합성 공급사 가', isActive: true },
  /*
   * **미사용 거래처.** 선택지에서 빼지 않는다 — 지금은 쓰지 않는 거래처를 참조하는
   * 과거 입하가 있고, 빼면 그 입하를 조건으로 찾을 방법이 사라진다.
   * 어느 입하도 이 번호를 쓰지 않는다 — 「선택지에는 있으나 표에는 없다」를 만드는 값이다.
   */
  { partnerId: 9103, partnerCode: 'SAMPLE-SUP-03', partnerName: '합성 공급사 다', isActive: false },
];

export const plantFixtures = [
  { plantId: 9201, plantCode: 'SAMPLE-PLT-01', plantName: '합성 공장 가', isActive: true },
  { plantId: 9202, plantCode: 'SAMPLE-PLT-02', plantName: '합성 공장 나', isActive: true },
];

export const itemFixtures = [
  { itemId: 9301, itemCode: 'SAMPLE-ITEM-01', itemName: '합성 품목 가', isActive: true },
];

export const uomFixtures = [
  { uomId: 9501, uomCode: 'SAMPLE-EA', uomName: '합성 단위 개', isActive: true },
];

/**
 * 자재 LOT 목록. **품목으로 좁혀 받는다** — 번호 여러 개로 한 번에 조회하는 수단이 계약에 없다.
 *
 * 9603(9404의 LOT)은 여기 없다 — 「목록에 없음」 갈래를 만드는 값이다.
 */
export const lotFixtures = [
  { lotId: 9601, lotNo: 'LOT-2026-900010', itemId: 9301 },
  { lotId: 9602, lotNo: 'LOT-2026-900011', itemId: 9302 },
];

/**
 * 입고 창고 목록. **두 창고의 공장이 다르다** — 9701은 입하 전표(9001)와 같은 9201이고
 * 9702는 9202다. 「고른 창고의 공장이 전표와 다르면 눈에 보인다」를 실제 값으로 만든다.
 */
export const warehouseFixtures = [
  {
    warehouseId: 9701,
    warehouseCode: 'SAMPLE-WH-01',
    warehouseName: '합성 창고 가',
    plantId: 9201,
  },
  {
    warehouseId: 9702,
    warehouseCode: 'SAMPLE-WH-02',
    warehouseName: '합성 창고 나',
    plantId: 9202,
  },
];

/**
 * 9701의 적치 위치. **계층이 실제로 셋 있다** — 그래야 1단 그룹 접기가 검사된다.
 *
 * - 9801 — 상위가 없다. 평면으로 남고 **다른 둘의 그룹 라벨**이 된다
 * - 9802·9803 — 상위가 9801이다. 한 그룹으로 묶인다
 * - 9804 — 상위가 9802다(**3단 깊이**). 최상위가 아니라 **직속 상위**로 묶인다
 * - 9805 — 상위 번호는 있는데 그 상위가 목록에 없다. 평면으로 남는다
 */
export const locationFixtures = [
  {
    locationId: 9801,
    warehouseId: 9701,
    parentLocationId: null,
    locationCode: 'SAMPLE-LOC-A',
    locationName: '합성 구역 가',
  },
  {
    locationId: 9802,
    warehouseId: 9701,
    parentLocationId: 9801,
    locationCode: 'SAMPLE-LOC-A1',
    locationName: '합성 열 가1',
  },
  {
    locationId: 9803,
    warehouseId: 9701,
    parentLocationId: 9801,
    locationCode: 'SAMPLE-LOC-A2',
    locationName: '합성 열 가2',
  },
  {
    locationId: 9804,
    warehouseId: 9701,
    parentLocationId: 9802,
    locationCode: 'SAMPLE-LOC-A1-1',
    locationName: '합성 단 가1-1',
  },
  {
    locationId: 9805,
    warehouseId: 9701,
    parentLocationId: 9899,
    locationCode: 'SAMPLE-LOC-Z',
    locationName: '합성 구역 하',
  },
];

/** 9702의 위치. 창고를 바꾸면 **다른 목록이 온다**는 것을 실제 값으로 만든다. */
export const otherLocationFixtures = [
  {
    locationId: 9811,
    warehouseId: 9702,
    parentLocationId: null,
    locationCode: 'SAMPLE-LOC-B',
    locationName: '합성 구역 나',
  },
];

/**
 * 입고 처리 응답.
 *
 * **업무 번호를 8000대로 둔다** — 내부 번호 대역(9…)과 겹치면 「결과에 내부 번호가 없다」를
 * 검사할 때 입고번호가 부분 문자열로 걸린다.
 *
 * `erpMessageQueued`를 **일부러 담지 않는다** — 계약이 선택 필드로 두었고(실측) 값이 오지 않는
 * 갈래가 실재한다. 담긴 갈래는 각 테스트가 덮어써서 만든다.
 */
export const goodsReceiptResponse = (
  overrides: Record<string, unknown> = {},
  lineOverrides: Record<string, unknown> = {},
) => ({
  goodsReceipt: {
    goodsReceiptId: 9901,
    goodsReceiptNo: 'GR-2026-800001',
    receiptTypeCode: 'SAMPLE_RECEIPT_TYPE_A',
    plantId: 9201,
    warehouseId: 9701,
    receiptDatetime: '2026-08-06T09:12:00+09:00',
    statusCode: 'SAMPLE_GR_STATUS_A',
    sourceDocumentTypeCode: 'INBOUND_RECEIPT',
    sourceDocumentId: 9001,
    ...overrides,
  },
  lines: [
    {
      goodsReceiptLineId: 9902,
      goodsReceiptId: 9901,
      lineNo: 1,
      inboundReceiptLineId: 9401,
      itemId: 9301,
      lotId: 9601,
      receiptQty: 100,
      uomId: 9501,
      qualityStatusCode: 'SAMPLE_QUALITY_A',
      inventoryStatusCode: 'SAMPLE_INVENTORY_A',
      destinationLocationId: 9802,
      inventoryTransactionLineId: 9903,
      ...lineOverrides,
    },
  ],
});

/**
 * 자재 LOT 상세. **입고 처리 뒤 상태를 다시 읽는 유일한 수단**이다 —
 * 입고 응답에는 LOT 상태가 없다.
 */
export const lotDetailResponse = (statusCode = 'SAMPLE_LOT_STATUS_A') => ({
  lot: {
    lotId: 9601,
    lotNo: 'LOT-2026-900010',
    itemId: 9301,
    lotTypeCode: 'SAMPLE_LOT_TYPE_A',
    plantId: 9201,
    initialQty: 100,
    uomId: 9501,
    sourceTypeCode: 'SAMPLE_SOURCE_TYPE_A',
    sourceId: 9001,
    statusCode,
  },
  externalIdentifiers: [],
  holds: [],
});
