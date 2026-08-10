import type { PoLineView, PoView } from './types';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다. 이 화면은 발주번호·거래처·품목처럼
 * **실제로 보일 법한 값**을 그리는 자리라, 한눈에 예시임이 보이는 접두(`SAMPLE-`·`SAMPLE_`)와
 * 지어낸 발주번호 대역(`PO-2026-9…`)만 쓴다. 실 운영 코드·거래처명·품목코드를 넣지 않는다
 * (공개 저장소 경계).
 *
 * **내부 번호(FK)는 서로 겹치지 않는 대역으로 나눈다** — 9000대(발주) · 9400대(발주 라인) ·
 * 9100~9500대(참조). 「표 어디에도 내부 번호가 렌더되지 않는다」를 검사할 때
 * 줄번호·수량 같은 정상 숫자와 헷갈리지 않게 하기 위해서다.
 */

const BASE_PO: PoView = {
  purchaseOrderId: 9001,
  purchaseOrderNo: 'PO-2026-900001',
  supplierId: 9101,
  plantId: 9201,
  orderDate: '2026-08-03',
  expectedReceiptDate: '2026-08-10',
  statusCode: 'SAMPLE_PO_STATUS_A',
};

/** 한 항목만 다른 건을 만든다. 무엇을 검사하는 테스트인지 그 인자만 보고 읽히게 한다. */
export const purchaseOrder = (overrides: Partial<PoView> = {}): PoView => ({
  ...BASE_PO,
  ...overrides,
});

/**
 * 화면 수준 테스트가 목록 응답으로 쓰는 세 건. 화면이 다뤄야 하는 까다로운 입력을 일부러 담는다.
 *
 * - 9001 — 값이 전부 채워져 있다. 라인 픽스처가 이 발주의 것이다
 * - 9002 — **공급사 번호가 참조 목록에 없고** 입고 예정일이 `null`이다
 * - 9003 — 공장이 9001과 다르다. 상태 코드가 9001과 같아 코드가 접히는지 드러난다
 */
export const purchaseOrderFixtures: PoView[] = [
  purchaseOrder(),
  purchaseOrder({
    purchaseOrderId: 9002,
    purchaseOrderNo: 'PO-2026-900002',
    supplierId: 9102,
    expectedReceiptDate: null,
    statusCode: 'SAMPLE_PO_STATUS_B',
  }),
  purchaseOrder({
    purchaseOrderId: 9003,
    purchaseOrderNo: 'PO-2026-900003',
    plantId: 9202,
    orderDate: '2026-08-05',
    expectedReceiptDate: '2026-08-12',
  }),
];

const BASE_LINE: PoLineView = {
  purchaseOrderLineId: 9401,
  purchaseOrderId: 9001,
  lineNo: 1,
  itemId: 9301,
  orderedQty: 100,
  uomId: 9501,
  receivedQty: 40,
  toleranceOverQty: 5,
};

export const purchaseOrderLine = (overrides: Partial<PoLineView> = {}): PoLineView => ({
  ...BASE_LINE,
  ...overrides,
});

/**
 * 9001의 라인 세 줄. **정량/초과 가르기의 까다로운 자리를 셋이 나눠 갖는다.**
 *
 * - 9401 — 잔량 60 · 허용 5 → **정량 한도 65.** 65는 전부 정량분, 66은 1만 초과분이다
 * - 9402 — 꼭 맞게 받았고 **초과 허용치가 0**이다 → 한도 0. 도착한 전부가 초과분이다.
 *   품목 번호가 **참조 목록에 없다**
 * - 9403 — **누적 입하가 발주를 넘겼다**(45 > 30). 잔량을 음수로 쓰면 한도가 0이 되어
 *   허용치 안쪽 도착까지 초과분으로 갈린다
 */
export const purchaseOrderLineFixtures: PoLineView[] = [
  purchaseOrderLine(),
  purchaseOrderLine({
    purchaseOrderLineId: 9402,
    lineNo: 2,
    itemId: 9302,
    orderedQty: 50,
    receivedQty: 50,
    toleranceOverQty: 0,
  }),
  purchaseOrderLine({
    purchaseOrderLineId: 9403,
    lineNo: 3,
    orderedQty: 30,
    receivedQty: 45,
    toleranceOverQty: 5,
  }),
];

/**
 * 참조 목록의 응답 본문. **화면이 읽는 필드만 담는다** — 스텁 응답은 JSON이라
 * 계약의 모든 필드를 갖출 필요가 없고, 갖추면 무엇을 읽는지가 오히려 가려진다.
 *
 * 목록에 **없는 번호**를 가진 행이 픽스처에 함께 있다(9002의 공급사 · 9402의 품목) —
 * 「목록에 없음」 갈래를 실제 값으로 만들어 내는 유일한 방법이다.
 */
export const partnerFixtures = [
  { partnerId: 9101, partnerCode: 'SAMPLE-SUP-01', partnerName: '합성 공급사 가', isActive: true },
  /*
   * **미사용 거래처.** 선택지에서 빼지 않는다 — 지금은 쓰지 않는 거래처를 참조하는
   * 과거 발주가 있고, 빼면 그 발주를 조건으로 찾을 방법이 사라진다.
   * 어느 발주도 이 번호를 쓰지 않는다 — 「선택지에는 있으나 표에는 없다」를 만드는 값이다.
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
