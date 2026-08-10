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
 * 9100~9600대(참조). 「표 어디에도 내부 번호가 렌더되지 않는다」를 검사할 때
 * 줄번호·수량 같은 정상 숫자와 헷갈리지 않게 하기 위해서다. 업무 번호(`IR-2026-900001`)에
 * 내부 번호가 **부분 문자열로 들어가지 않도록** 대역을 갈라 두었다.
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
