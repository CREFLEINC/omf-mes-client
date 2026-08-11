import type { ReceiptLineView, ReceiptView } from './types';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다. 이 화면은 입고번호·창고·품목·LOT처럼 **실제로 보일
 * 법한 값**을 그리는 자리라, 한눈에 예시임이 보이는 접두(`SAMPLE-`·`SAMPLE_`)와 지어낸 번호
 * 대역(`GR-2026-9…`·`LOT-2026-9…`)만 쓴다. 실 운영 코드·거래처명·품목코드를 넣지 않는다
 * (공개 저장소 경계).
 *
 * **계약의 `@example` 값을 쓰지 않는다**(`MATERIAL`·`PURCHASE`·`SUPPLIER_RETURN`·`POSTED`·
 * `INBOUND_RECEIPT`). 예시를 픽스처에 쓰면 나중에 「확정 값」으로 읽힌다.
 *
 * **내부 번호(FK)는 서로 겹치지 않는 대역으로 나눈다** — 9000대(입고 전표) · 9300대(품목) ·
 * 9400대(입고 라인) · 9500대(단위) · 9600대(자재 LOT) · 9700대(창고) · 9800대(적치 위치).
 * 「표 어디에도 내부 번호가 렌더되지 않는다」를 검사할 때 수량 같은 정상 숫자와 헷갈리지 않게
 * 하기 위해서다. 업무 번호에 내부 번호가 **부분 문자열로 들어가지 않도록** 대역을 갈라 두었다.
 */

const BASE_RECEIPT: ReceiptView = {
  goodsReceiptId: 9001,
  goodsReceiptNo: 'GR-2026-900001',
  receiptTypeCode: 'SAMPLE_GR_TYPE_A',
  warehouseId: 9701,
  receiptDatetime: '2026-08-06T09:12:00+09:00',
  statusCode: 'SAMPLE_GR_STATUS_A',
};

/** 한 항목만 다른 건을 만든다. 무엇을 검사하는 테스트인지 그 인자만 보고 읽히게 한다. */
export const goodsReceipt = (overrides: Partial<ReceiptView> = {}): ReceiptView => ({
  ...BASE_RECEIPT,
  ...overrides,
});

/**
 * 화면 수준 테스트가 목록 응답으로 쓰는 세 건. 화면이 다뤄야 하는 까다로운 입력을 일부러 담는다.
 *
 * - 9001 — 값이 전부 채워져 있다. 라인 픽스처가 이 전표의 것이다
 * - 9002 — **미사용 창고**로 들어왔고 유형·상태 코드가 9001과 다르다
 * - 9003 — **창고 번호가 참조 목록에 없다.** 「목록에 없음」 갈래를 실제 값으로 만든다
 */
export const goodsReceiptFixtures: ReceiptView[] = [
  goodsReceipt(),
  goodsReceipt({
    goodsReceiptId: 9002,
    goodsReceiptNo: 'GR-2026-900002',
    receiptTypeCode: 'SAMPLE_GR_TYPE_B',
    warehouseId: 9702,
    statusCode: 'SAMPLE_GR_STATUS_B',
  }),
  goodsReceipt({
    goodsReceiptId: 9003,
    goodsReceiptNo: 'GR-2026-900003',
    warehouseId: 9799,
    receiptDatetime: '2026-08-07T10:05:00+09:00',
  }),
];

const BASE_LINE: ReceiptLineView = {
  goodsReceiptLineId: 9401,
  itemId: 9301,
  lotId: 9601,
  receiptQty: 100,
  uomId: 9501,
  destinationLocationId: 9801,
};

export const goodsReceiptLine = (
  overrides: Partial<ReceiptLineView> = {},
): ReceiptLineView => ({
  ...BASE_LINE,
  ...overrides,
});

/**
 * 9001의 라인 세 줄. **참조가 풀리는 줄과 풀리지 않는 줄이 함께 있어야** 표기가 실제로 검사된다.
 *
 * - 9401 — 전부 풀린다. LOT은 **보류가 아니다**
 * - 9402 — **품목이 참조 목록에 없고** LOT이 **보류 중**이다. 수량이 소수다
 * - 9403 — 품목이 9401과 **같다**(요청 중복 제거를 검사한다). **LOT·위치·단위가 목록에 없고**
 *   수량이 **0**이다
 */
export const goodsReceiptLineFixtures: ReceiptLineView[] = [
  goodsReceiptLine(),
  goodsReceiptLine({
    goodsReceiptLineId: 9402,
    itemId: 9302,
    lotId: 9602,
    receiptQty: 12.5,
    destinationLocationId: 9802,
  }),
  goodsReceiptLine({
    goodsReceiptLineId: 9403,
    lotId: 9603,
    receiptQty: 0,
    uomId: 9599,
    destinationLocationId: 9899,
  }),
];

/**
 * 참조 목록의 응답 본문. **화면이 읽는 필드만 담는다** — 스텁 응답은 JSON이라 계약의 모든
 * 필드를 갖출 필요가 없고, 갖추면 무엇을 읽는지가 오히려 가려진다.
 *
 * 목록에 **없는 번호**를 가진 행이 픽스처에 함께 있다(9003의 창고 · 9402의 품목 ·
 * 9403의 LOT·단위·위치) — 「목록에 없음」 갈래를 실제 값으로 만들어 내는 유일한 방법이다.
 */
export const warehouseFixtures = [
  {
    warehouseId: 9701,
    warehouseCode: 'SAMPLE-WH-01',
    warehouseName: '합성 창고 가',
    isActive: true,
  },
  /*
   * **미사용 창고.** 선택지에서 빼지 않는다 — 지금은 쓰지 않는 창고로 들어온 과거 입고가
   * 있고, 빼면 그 입고를 조건으로 찾을 방법이 사라진다.
   */
  {
    warehouseId: 9702,
    warehouseCode: 'SAMPLE-WH-02',
    warehouseName: '합성 창고 나',
    isActive: false,
  },
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
 * 9602는 **보류 중**이다 — 반품해도 보류가 유지된다는 사실을 화면이 말하는지 검사하는 값이다.
 * 9603(9403의 LOT)은 여기 없다 — 「목록에 없음」 갈래를 만드는 값이다.
 */
export const lotFixtures = [
  { lotId: 9601, lotNo: 'LOT-2026-900010', itemId: 9301, held: false },
  { lotId: 9602, lotNo: 'LOT-2026-900011', itemId: 9302, held: true },
];

/** 9701의 적치 위치. 9899(9403의 위치)는 여기 없다. */
export const locationFixtures = [
  {
    locationId: 9801,
    warehouseId: 9701,
    locationCode: 'SAMPLE-LOC-A1',
    locationName: '합성 열 가1',
    isActive: true,
  },
  {
    locationId: 9802,
    warehouseId: 9701,
    locationCode: 'SAMPLE-LOC-A2',
    locationName: '합성 열 가2',
    isActive: true,
  },
];

/**
 * 재고 잔액. **`groupBy=LOT`으로 받은 모양**이라 위치 축이 접혀 있다(`locationId`가 없다).
 *
 * 이 화면은 이 응답을 **반품 수량의 상한을 만드는 데만** 쓴다. 픽스처가 담는 까다로운 입력:
 *
 * - **9601이 두 줄이다** — 계약이 「소유 구분은 어떤 축에서도 합치지 않는다」고 적어 한 LOT이
 *   갈려 내려온다. 더하지 않으면 상한이 실제보다 좁아 **정당한 반품이 막힌다**(합계 120)
 * - **`availableQty`가 `onHandQty`와 크게 다르다** — 보류된 자재라 가용이 거의 없다.
 *   상한을 가용으로 바꾸면 **이 화면의 주 용도가 막힌다**는 것을 이 값이 드러낸다(감지기 M32)
 * - **9603이 보유 0이다** — `includeZero=true`라서 온 줄이다. 끄면 이 줄이 아예 오지 않아
 *   「0이라 없다」와 「잘려서 없다」가 뭉개진다
 * - **9602(품목 9302)의 줄이 없다** — 「확인하지 못함」 갈래를 실제 값으로 만든다
 */
export const balanceFixtures = [
  {
    groupBy: 'LOT' as const,
    warehouseId: 9701,
    itemId: 9301,
    lotId: 9601,
    ownershipTypeCode: 'SAMPLE_OWNERSHIP_A',
    onHandQty: 80,
    reservedQty: 60,
    pickedQty: 5,
    blockedQty: 5,
    availableQty: 10,
    uomId: 9501,
  },
  {
    groupBy: 'LOT' as const,
    warehouseId: 9701,
    itemId: 9301,
    lotId: 9601,
    ownershipTypeCode: 'SAMPLE_OWNERSHIP_B',
    onHandQty: 40,
    reservedQty: 35,
    pickedQty: 0,
    blockedQty: 0,
    availableQty: 5,
    uomId: 9501,
  },
  {
    groupBy: 'LOT' as const,
    warehouseId: 9701,
    itemId: 9301,
    lotId: 9603,
    ownershipTypeCode: 'SAMPLE_OWNERSHIP_A',
    onHandQty: 0,
    reservedQty: 0,
    pickedQty: 0,
    blockedQty: 0,
    availableQty: 0,
    /** 9403의 단위와 같다 — 단위 어긋남이 아니라 **보유 0**을 재는 줄이다. */
    uomId: 9599,
  },
];

/** 9601의 두 줄을 더한 상한. 화면 단언이 이 수를 되풀이해 적지 않게 한다. */
export const ON_HAND_9601 = 120;

/** 화면 어디에도 나와서는 안 되는 내부 번호(FK). 업무 번호와 겹치지 않는 대역이다. */
export const INTERNAL_IDS = [
  '9001',
  '9002',
  '9003',
  '9301',
  '9302',
  '9401',
  '9402',
  '9403',
  '9501',
  '9599',
  '9601',
  '9602',
  '9603',
  '9701',
  '9702',
  '9799',
  '9801',
  '9802',
  '9899',
];
