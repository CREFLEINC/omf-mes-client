import type { BalanceResponse, ReceiptLineView, ReceiptView, WarehouseResponse } from './types';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다. 이 화면은 입고번호·창고처럼 **실제로 보일 법한 값**을
 * 그리는 자리라, 한눈에 예시임이 보이는 접두(`SAMPLE-`·`SAMPLE_`)와 지어낸 번호 대역
 * (`GR-2026-9…`)만 쓴다. 실 운영 코드·거래처명·품목코드를 넣지 않는다(공개 저장소 경계).
 *
 * **계약의 `@example` 값을 쓰지 않는다.** 예시를 픽스처에 쓰면 나중에 「확정 값」으로 읽힌다.
 *
 * **내부 번호(FK)는 서로 겹치지 않는 대역으로 나눈다** — 9000대(입고 전표) · 9100대(공장) ·
 * 9200대(원천 문서) · 9300대(품목) · 9400대(입고 라인) · 9600대(자재 LOT) · 9700대(창고) ·
 * 9800대(단위) · 9900대(위치). 「표 어디에도 내부 번호가 렌더되지 않는다」를 검사할 때
 * 수량 같은 정상 숫자와 헷갈리지 않게 하기 위해서다. 업무 번호에 내부 번호가 **부분 문자열로
 * 들어가지 않도록** 대역을 갈라 두었다.
 */

const BASE_RECEIPT: ReceiptView = {
  goodsReceiptId: 9001,
  goodsReceiptNo: 'GR-2026-900001',
  receiptTypeCode: 'SAMPLE_GR_TYPE_A',
  warehouseId: 9701,
  receiptDatetime: '2026-08-06T09:12:00+09:00',
  statusCode: 'SAMPLE_GR_STATUS_A',
};

/** 한 항목만 다른 건을 만든다. 무엇이 다른지 그 인자만 보고 읽히게 한다. */
const goodsReceipt = (overrides: Partial<ReceiptView> = {}): ReceiptView => ({
  ...BASE_RECEIPT,
  ...overrides,
});

/**
 * 화면 수준 테스트가 목록 응답으로 쓰는 세 건. 화면이 다뤄야 하는 까다로운 입력을 일부러 담는다.
 *
 * - 9001 — 값이 전부 채워져 있다. 폐기 대상 창고(9701)에 들어왔다
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

/**
 * 목록 응답에 실리는 모양. **화면이 버리는 값이 응답에 있어야** 옮기기가 실제로 고르는지 보인다.
 */
interface ReceiptResponseShape extends ReceiptView {
  plantId: number;
  sourceDocumentTypeCode: string;
  sourceDocumentId: number;
}

const toReceiptResponse = (view: ReceiptView): ReceiptResponseShape => ({
  ...view,
  plantId: 9101,
  sourceDocumentTypeCode: 'SAMPLE_SRC_TYPE_A',
  sourceDocumentId: 9201,
});

export const goodsReceiptResponseFixtures = goodsReceiptFixtures.map(toReceiptResponse);

/**
 * 창고 참조 목록의 응답 본문. **화면이 읽는 필드만 담는다** — 스텁 응답은 JSON이라 계약의
 * 모든 필드를 갖출 필요가 없고, 갖추면 무엇을 읽는지가 오히려 가려진다.
 *
 * 목록에 **없는 번호**를 가진 행이 픽스처에 함께 있다(9003의 창고 9799) — 「목록에 없음」
 * 갈래를 실제 값으로 만들어 내는 유일한 방법이다.
 *
 * **유형 코드가 서로 다르다.** 창고 유형의 값 목록이 확정됐을 때 선택지가 실제로 좁혀지는지를
 * 재려면 좁힘에 걸리는 값과 걸리지 않는 값이 함께 있어야 한다.
 */
export const warehouseFixtures: Pick<
  WarehouseResponse,
  'warehouseId' | 'warehouseCode' | 'warehouseName' | 'warehouseTypeCode' | 'isActive'
>[] = [
  {
    warehouseId: 9701,
    warehouseCode: 'SAMPLE-WH-01',
    warehouseName: '합성 폐기창고 가',
    warehouseTypeCode: 'SAMPLE_WH_TYPE_A',
    isActive: true,
  },
  /*
   * **미사용 창고.** 선택지에서 빼지 않는다 — 지금은 쓰지 않는 창고로 들어온 과거 입고가
   * 있고, 빼면 그 입고를 조건으로 찾을 방법이 사라진다.
   */
  {
    warehouseId: 9702,
    warehouseCode: 'SAMPLE-WH-02',
    warehouseName: '합성 자재창고 나',
    warehouseTypeCode: 'SAMPLE_WH_TYPE_B',
    isActive: false,
  },
];

/** 폐기 대상 창고 유형이 확정됐다고 가정할 때 쓰는 합성 코드. **계약 예시값이 아니다.** */
export const SAMPLE_DEFECT_WAREHOUSE_TYPE = 'SAMPLE_WH_TYPE_A';

/**
 * 고른 전표(9001)의 라인 셋. 화면이 다뤄야 하는 까다로운 입력을 일부러 담는다.
 *
 * - 9401 — 값이 전부 채워져 있다. 품목 9301 · LOT 9601
 * - 9402 — **같은 품목(9301)의 다른 LOT.** 잔액을 **품목마다 한 번**만 부르는지 재는 줄이다
 * - 9403 — **다른 품목(9302)이고 단위도 다르다.** 단위가 섞인 합계와 LOT 조회 두 벌을 만든다
 */
export const receiptLineFixtures: ReceiptLineView[] = [
  {
    goodsReceiptLineId: 9401,
    itemId: 9301,
    lotId: 9601,
    receiptQty: 100,
    uomId: 9801,
    destinationLocationId: 9901,
  },
  {
    goodsReceiptLineId: 9402,
    itemId: 9301,
    lotId: 9602,
    receiptQty: 30,
    uomId: 9801,
    destinationLocationId: 9902,
  },
  {
    goodsReceiptLineId: 9403,
    itemId: 9302,
    lotId: 9603,
    receiptQty: 12,
    uomId: 9802,
    destinationLocationId: 9901,
  },
];

/**
 * 라인 응답에 실리는 모양. **화면이 버리는 값이 응답에 있어야** 옮기기가 실제로 고르는지 보인다.
 *
 * 품질·재고 상태를 실어 두는 것이 특히 중요하다 — 화면이 그 값으로 줄을 가르지 **않는다**는
 * 사실은 값이 실제로 와 있을 때만 재진다.
 */
interface ReceiptLineResponseShape extends ReceiptLineView {
  goodsReceiptId: number;
  lineNo: number;
  qualityStatusCode: string;
  inventoryStatusCode: string;
  inventoryTransactionLineId: number | null;
}

export const receiptLineResponseFixtures: ReceiptLineResponseShape[] = receiptLineFixtures.map(
  (line, index) => ({
    ...line,
    goodsReceiptId: 9001,
    lineNo: index + 1,
    qualityStatusCode: 'SAMPLE_QUALITY_A',
    inventoryStatusCode: 'SAMPLE_INVENTORY_A',
    inventoryTransactionLineId: null,
  }),
);

/** 라인 표가 이름을 푸는 참조 넷. **목록에 없는 번호**(9603 LOT · 9302 품목)를 일부러 남긴다. */
export const itemFixtures = [
  { itemId: 9301, itemCode: 'SAMPLE-ITEM-01', itemName: '합성 자재 가', isActive: true },
  { itemId: 9302, itemCode: 'SAMPLE-ITEM-02', itemName: '합성 자재 나', isActive: false },
];

export const uomFixtures = [
  { uomId: 9801, uomCode: 'SAMPLE-UOM-EA', uomName: '합성 낱개', isActive: true },
  { uomId: 9802, uomCode: 'SAMPLE-UOM-BX', uomName: '합성 상자', isActive: true },
];

/**
 * 자재 LOT은 **품목마다** 받는다. 9301에 둘, 9302에 하나.
 *
 * **보류 표식**을 한 LOT에만 붙여 「보류인데도 고를 수 있다」를 실제 값으로 잰다 —
 * 폐기는 보류·차단된 자재를 덜어 내는 일이라 표식은 알리는 것이고 막는 것이 아니다.
 */
export const lotFixturesByItem: Record<number, { lotId: number; lotNo: string; held?: boolean }[]> =
  {
    9301: [
      { lotId: 9601, lotNo: 'SAMPLE-LOT-0001' },
      { lotId: 9602, lotNo: 'SAMPLE-LOT-0002', held: true },
    ],
    9302: [{ lotId: 9603, lotNo: 'SAMPLE-LOT-0003' }],
  };

export const locationFixtures = [
  { locationId: 9901, locationCode: 'SAMPLE-LOC-01', locationName: '합성 적치 가', isActive: true },
  { locationId: 9902, locationCode: 'SAMPLE-LOC-02', locationName: '합성 적치 나', isActive: true },
];

/**
 * 품목별 잔액 응답. **`onHandQty`와 `availableQty`가 다르다** — 상한이 어느 쪽을 쓰는지
 * 화면 수준에서 갈리게 하려면 두 값이 달라야 한다(감지기 M22).
 *
 * 9602는 **보유가 0**이다(`includeZero=true`가 데려오는 줄) — 「0이라 없다」와 「잘려서 없다」가
 * 갈리는지 재는 자리다.
 */
export const balanceResponseFixturesByItem: Record<number, BalanceResponse[]> = {
  9301: [
    {
      groupBy: 'LOT',
      itemId: 9301,
      lotId: 9601,
      warehouseId: 9701,
      ownershipTypeCode: 'SAMPLE_OWNERSHIP_A',
      onHandQty: 80,
      reservedQty: 10,
      pickedQty: 5,
      blockedQty: 25,
      availableQty: 40,
      uomId: 9801,
    },
    {
      groupBy: 'LOT',
      itemId: 9301,
      lotId: 9602,
      warehouseId: 9701,
      ownershipTypeCode: 'SAMPLE_OWNERSHIP_A',
      onHandQty: 0,
      reservedQty: 0,
      pickedQty: 0,
      blockedQty: 0,
      availableQty: 0,
      uomId: 9801,
    },
  ] as BalanceResponse[],
  9302: [
    {
      groupBy: 'LOT',
      itemId: 9302,
      lotId: 9603,
      warehouseId: 9701,
      ownershipTypeCode: 'SAMPLE_OWNERSHIP_A',
      onHandQty: 12,
      reservedQty: 0,
      pickedQty: 0,
      blockedQty: 6,
      availableQty: 6,
      uomId: 9802,
    },
  ] as BalanceResponse[],
};

/** 화면 어디에도 나와서는 안 되는 내부 번호(FK). 업무 번호와 겹치지 않는 대역이다. */
export const INTERNAL_IDS = [
  '9001',
  '9002',
  '9003',
  '9101',
  '9201',
  '9301',
  '9302',
  '9401',
  '9402',
  '9403',
  '9601',
  '9602',
  '9603',
  '9701',
  '9702',
  '9799',
  '9801',
  '9802',
  '9901',
  '9902',
];
