import type { ExcessCandidate, InboundExcess } from './excess-types';
import type { InboundScheduleLine, PurchaseOrderSummary } from './types';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다. 한눈에 예시임이 보이는 접두(`SAMPLE-`)와 「합성 …」만
 * 쓴다. 실 운영 코드·거래처명·품목코드를 넣지 않는다(공개 저장소 경계).
 *
 * **내부 번호(FK)는 서로 겹치지 않는 대역으로 나눈다** — 7100대(발주) · 7300대(발주 라인) ·
 * 8100~8500대(참조). 「표 어디에도 내부 번호가 렌더되지 않는다」를 검사할 때
 * 라인번호·수량 같은 정상 숫자와 헷갈리지 않게 하기 위해서다.
 */

/**
 * `YYYY-MM-DD` 에서 며칠 옮긴다. 「오늘」을 인자로 받는다 — 고정 날짜를 쓰면 지연 표시가
 * 실행 날짜에 따라 뒤집힌다. UTC 로 계산해 실행 환경의 시간대가 끼어들지 않게 한다.
 */
export const shiftDate = (today: string, days: number): string => {
  const [year = 0, month = 1, day = 1] = today.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

const BASE_LINE: InboundScheduleLine = {
  purchaseOrderId: 7101,
  purchaseOrderNo: 'SAMPLE-PO-0001',
  erpPurchaseOrderNo: 'SAMPLE-ERP-0001',
  supplierId: 8101,
  plantId: 8201,
  orderDate: '2026-10-01',
  expectedReceiptDate: '2026-10-10',
  purchaseOrderStatusCode: 'CONFIRMED',
  purchaseOrderLineId: 7301,
  lineNo: 1,
  itemId: 8301,
  uomId: 8501,
  itemCode: 'SAMPLE-ITEM-01',
  itemName: '합성 품목 가',
  supplierCode: 'SAMPLE-SUP-01',
  supplierName: '합성 공급사 가',
  uomCode: 'SAMPLE-EA',
  uomName: '합성 단위 개',
  orderedQty: 100,
  receivedQty: 0,
  remainingQty: 100,
  toleranceOverQty: 0,
  toleranceUnderQty: 0,
  erpStorageLocationCode: 'SAMPLE-SL1',
  cancelledAt: null,
  receiptStatusCode: 'NOT_STARTED',
};

/** 한 항목만 다른 줄을 만든다. 무엇을 검사하는 테스트인지 그 인자만 보고 읽히게 한다. */
export const scheduleLine = (
  overrides: Partial<InboundScheduleLine> = {},
): InboundScheduleLine => ({
  ...BASE_LINE,
  ...overrides,
});

/**
 * 화면 수준 테스트가 목록 응답으로 쓰는 네 줄. 화면이 다뤄야 하는 까다로운 입력을 일부러 담는다.
 *
 * - 7301 — **어제** 납기 · 미착수 · 남은 수량 있음 → **지연**. ERP 발주번호·창고가 있다
 * - 7302 — **오늘** 납기 · 부분 입하 → 지연 아님(당일 미포함). ERP 발주번호·창고가 **null**,
 *   공급사가 **참조 목록에 없고**, 품목이 **없는 품목(404)**이다
 * - 7303 — 어제 납기지만 **라인이 취소됐다**(진행 `CANCELLED` · 남은 수량 0) → 지연 아님, 「취소」
 * - 7304 — 납기 **없음** · 초과 입하로 **입하 완료**(남은 수량 0) · 창고 코드가 **코드 목록에 없다**
 */
export const scheduleFixtures = (today: string): InboundScheduleLine[] => [
  scheduleLine({ expectedReceiptDate: shiftDate(today, -1) }),
  scheduleLine({
    purchaseOrderId: 7102,
    purchaseOrderNo: 'SAMPLE-PO-0002',
    erpPurchaseOrderNo: null,
    supplierId: 8102,
    expectedReceiptDate: today,
    purchaseOrderLineId: 7302,
    lineNo: 2,
    itemId: 8302,
    orderedQty: 50,
    receivedQty: 20,
    remainingQty: 30,
    erpStorageLocationCode: null,
    receiptStatusCode: 'PARTIAL',
  }),
  scheduleLine({
    purchaseOrderId: 7103,
    purchaseOrderNo: 'SAMPLE-PO-0003',
    erpPurchaseOrderNo: 'SAMPLE-ERP-0003',
    expectedReceiptDate: shiftDate(today, -1),
    purchaseOrderLineId: 7303,
    orderedQty: 40,
    /* 서버는 취소된 라인의 남은 수량을 0 으로 준다. */
    remainingQty: 0,
    cancelledAt: '2026-10-05T03:00:00.000Z',
    receiptStatusCode: 'CANCELLED',
  }),
  scheduleLine({
    purchaseOrderId: 7104,
    purchaseOrderNo: 'SAMPLE-PO-0004',
    erpPurchaseOrderNo: null,
    expectedReceiptDate: null,
    purchaseOrderLineId: 7304,
    orderedQty: 10,
    receivedQty: 12,
    remainingQty: 0,
    erpStorageLocationCode: 'SAMPLE-SL9',
    receiptStatusCode: 'COMPLETED',
  }),
];

const BASE_ORDER: PurchaseOrderSummary = {
  purchaseOrderId: 7101,
  purchaseOrderNo: 'SAMPLE-PO-0001',
  erpPurchaseOrderNo: 'SAMPLE-ERP-0001',
  supplierId: 8101,
  plantId: 8201,
  orderDate: '2026-10-01',
  expectedReceiptDate: '2026-10-10',
  statusCode: 'CONFIRMED',
  supplierCode: 'SAMPLE-SUP-01',
  supplierName: '합성 공급사 가',
  lineCount: 2,
  openLineCount: 2,
  matchedLineCount: null,
  uomId: 8501,
  uomCode: 'SAMPLE-EA',
  orderedQtyTotal: 150,
  receivedQtyTotal: 0,
  remainingQtyTotal: 150,
  receiptStatusCode: 'NOT_STARTED',
};

/** 한 항목만 다른 발주 묶음을 만든다. */
export const orderSummary = (
  overrides: Partial<PurchaseOrderSummary> = {},
): PurchaseOrderSummary => ({ ...BASE_ORDER, ...overrides });

/**
 * 왼쪽 표 응답의 네 발주(server #762).
 *
 * - 7101 — **어제** 납기 · 미착수 · 남은 라인 있음 → **지연**
 * - 7102 — **오늘** 납기 · 부분 입하 → 지연 아님(당일 미포함)
 * - 7103 — 어제 납기지만 **모든 라인이 취소됐다**(남은 라인 0) → 지연 아님, 「취소」
 * - 7104 — 납기 **없음** · 입하 완료 · **라인 단위가 섞여** 합계가 null → 「—」
 */
export const orderFixtures = (today: string): PurchaseOrderSummary[] => [
  orderSummary({ expectedReceiptDate: shiftDate(today, -1) }),
  orderSummary({
    purchaseOrderId: 7102,
    purchaseOrderNo: 'SAMPLE-PO-0002',
    erpPurchaseOrderNo: null,
    supplierId: 8103,
    supplierCode: 'SAMPLE-SUP-03',
    supplierName: '합성 공급사 다',
    expectedReceiptDate: today,
    lineCount: 3,
    openLineCount: 1,
    orderedQtyTotal: 50,
    receivedQtyTotal: 20,
    remainingQtyTotal: 30,
    receiptStatusCode: 'PARTIAL',
  }),
  orderSummary({
    purchaseOrderId: 7103,
    purchaseOrderNo: 'SAMPLE-PO-0003',
    expectedReceiptDate: shiftDate(today, -1),
    lineCount: 1,
    openLineCount: 0,
    remainingQtyTotal: 0,
    receiptStatusCode: 'CANCELLED',
  }),
  orderSummary({
    purchaseOrderId: 7104,
    purchaseOrderNo: 'SAMPLE-PO-0004',
    expectedReceiptDate: null,
    openLineCount: 0,
    uomId: null,
    uomCode: null,
    orderedQtyTotal: null,
    receivedQtyTotal: null,
    remainingQtyTotal: null,
    receiptStatusCode: 'COMPLETED',
  }),
];

/**
 * 참조 목록의 응답 본문. **화면이 읽는 필드만 담는다** — 스텁 응답은 JSON이라
 * 계약의 모든 필드를 갖출 필요가 없고, 갖추면 무엇을 읽는지가 오히려 가려진다.
 */
export const partnerFixtures = [
  { partnerId: 8101, partnerCode: 'SAMPLE-SUP-01', partnerName: '합성 공급사 가', isActive: true },
  /* **미사용 거래처.** 조회 화면은 이것도 선택지에 낸다 — 과거 발주가 참조하기 때문이다. */
  { partnerId: 8103, partnerCode: 'SAMPLE-SUP-03', partnerName: '합성 공급사 다', isActive: false },
];

export const plantFixtures = [
  { plantId: 8201, plantCode: 'SAMPLE-PLT-01', plantName: '합성 공장 가', isActive: true },
  { plantId: 8202, plantCode: 'SAMPLE-PLT-02', plantName: '합성 공장 나', isActive: true },
];

/** 품목은 번호로 하나씩 푼다(`GET /mdm/items/{itemId}`) — 상세는 봉투(`{ item }`)로 온다. */
export const itemDetailFixtures: Record<number, { item: Record<string, unknown> }> = {
  8301: { item: { itemId: 8301, itemCode: 'SAMPLE-ITEM-01', itemName: '합성 품목 가' } },
};

/** 공통코드 `SL_TYPE` — 창고 이름. `SAMPLE-SL9` 는 일부러 없다(코드를 그대로 낸다). */
export const storageLocationFixtures = [
  { code: 'SAMPLE-SL1', codeName: '합성 자재창고', isActive: true },
];

/**
 * 잇지 않은 초과분 하나 — 7101 발주의 7301 라인(같은 공장·공급사·품목·단위, 남은 자리 100)에 이을 수 있다.
 * 처음 P/O 는 목록에 없는 다른 발주(SAMPLE-PO-0099)다. 번호는 모두 합성 값이다.
 */
const BASE_EXCESS: InboundExcess = {
  inboundReceiptExcessId: 9501,
  excessQty: 30,
  linkedAt: null,
  linkedOrderLine: null,
  inboundReceiptId: 9401,
  inboundReceiptNo: 'SAMPLE-IR-0001',
  receiptDatetime: '2026-10-20T02:00:00.000Z',
  inboundReceiptLineId: 9411,
  lineNo: 1,
  receivedQty: 130,
  sourceOrderLine: {
    purchaseOrderLineId: 7399,
    purchaseOrderId: 7199,
    purchaseOrderNo: 'SAMPLE-PO-0099',
    erpPurchaseOrderNo: null,
    lineNo: 1,
  },
  plantId: 8201,
  supplierId: 8101,
  supplierCode: 'SAMPLE-SUP-01',
  supplierName: '합성 공급사 가',
  itemId: 8301,
  itemCode: 'SAMPLE-ITEM-01',
  itemName: '합성 품목 가',
  uomId: 8501,
  uomCode: 'SAMPLE-EA',
  lotId: 9601,
  lotNo: 'SAMPLE-LOT-0001',
};

export const excessFixture = (overrides: Partial<InboundExcess> = {}): InboundExcess => ({
  ...BASE_EXCESS,
  ...overrides,
});

/** 같은 초과분이 7301 에 이어진 모양. */
export const linkedExcessFixture = (overrides: Partial<InboundExcess> = {}): InboundExcess =>
  excessFixture({
    linkedAt: '2026-10-21T03:00:00.000Z',
    linkedOrderLine: {
      purchaseOrderLineId: 7301,
      purchaseOrderId: 7101,
      purchaseOrderNo: 'SAMPLE-PO-0001',
      erpPurchaseOrderNo: 'SAMPLE-ERP-0001',
      lineNo: 1,
    },
    ...overrides,
  });

/** 7101 발주 7301 라인 후보 — 남은 수량이 초과분과 다르다. */
export const candidateFixture = (overrides: Partial<ExcessCandidate> = {}): ExcessCandidate => ({
  purchaseOrderLineId: 7301,
  purchaseOrderId: 7101,
  purchaseOrderNo: 'SAMPLE-PO-0001',
  erpPurchaseOrderNo: 'SAMPLE-ERP-0001',
  lineNo: 1,
  orderDate: '2026-10-01',
  expectedReceiptDate: '2026-10-10',
  orderedQty: 100,
  receivedQty: 0,
  roomQty: 100,
  exactMatch: false,
  ...overrides,
});
