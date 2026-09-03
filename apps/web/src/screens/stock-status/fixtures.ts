import type { components } from '@omf-mes/api-client';

import { EXPIRY_SOON_DAYS } from './expiry';
import type { BalanceView, LotDetailView, TransactionDetailView, TransactionView } from './types';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다. 이 화면은 창고·품목·LOT·거래처처럼 **실제로 보일 법한
 * 값**을 그리는 자리라, 한눈에 예시임이 보이는 접두(`SAMPLE-`·`SAMPLE_`)와 「합성 …」만 쓴다.
 * 실 운영 코드·거래처명·품목코드·LOT 번호를 넣지 않는다(공개 저장소 경계).
 *
 * **내부 번호(FK)는 서로 겹치지 않는 대역으로 나눈다.** 「표 어디에도 내부 번호가 렌더되지
 * 않는다」를 검사할 때 수량 같은 정상 숫자와 헷갈리지 않게 하기 위해서다.
 * 수량은 전부 세 자리 이하로 두어 네 자리 번호와 섞이지 않는다.
 *
 * | 대역 | 무엇 |
 * | ---: | --- |
 * | 9000 | **화면이 옮기지 않는 계약 필드** — 공장(9001) · 원천 전표(9021·9022) · 핸들링 유닛(9041) |
 * | 9100 · 9200 · 9300 | 창고 · 위치 · 품목 |
 * | 9400 · 9500 · 9600 | LOT · 단위 · 거래처 |
 * | 9700 · 9800 | 보류 · 외부 식별자 |
 * | 9900 · 9950 | 수불 거래 · 거래 라인 |
 *
 * **9000대는 화면 타입으로 옮기지 않는 값만 담는다** — 계약 모양 픽스처에만 있고, 「응답에
 * 실려 왔지만 화면에 서지 않는다」를 검사하는 쪽이 그 번호들을 찾는다. 다른 대역과 겹치면
 * 그 단언이 무엇을 잡았는지 알 수 없게 된다.
 */

const BASE_BALANCE: BalanceView = {
  groupBy: 'ITEM',
  inventoryBalanceId: null,
  warehouseId: 9101,
  locationId: null,
  itemId: 9301,
  lotId: null,
  qualityStatusCode: 'SAMPLE_Q_A',
  inventoryStatusCode: 'SAMPLE_I_A',
  ownershipTypeCode: 'SAMPLE_OWN_A',
  ownerPartnerId: null,
  onHandQty: 120,
  reservedQty: 20,
  pickedQty: 5,
  blockedQty: 10,
  /*
   * **보유−예약−피킹−보류(85)와 일부러 다르게 둔다.** 화면이 가용을 다시 계산하면
   * 이 값이 85로 바뀌어 단언이 깨진다 — 「가용 수량을 화면이 빼지 마세요」를 값으로 고정한다.
   */
  availableQty: 77,
  uomId: 9501,
  heldLotCount: 0,
  lastTransactionAt: '2026-08-06T09:12:00+09:00',
};

/** 한 항목만 다른 줄을 만든다. 무엇을 검사하는 테스트인지 그 인자만 보고 읽히게 한다. */
export const balance = (overrides: Partial<BalanceView> = {}): BalanceView => ({
  ...BASE_BALANCE,
  ...overrides,
});

/**
 * 품목별 보기의 잔액 세 줄. 화면이 다뤄야 하는 까다로운 입력을 일부러 담는다.
 *
 * - 9301 — **LOT·위치·소유처가 전부 `null`**(품목별 보기의 정상 형태). 보류 LOT 수가 0이다
 * - 9302 — **보유가 음수**이고 소유처가 **있다**. 보류 LOT 수가 2다.
 *   품목 번호가 **참조 목록에 없다** — 「알 수 없음」 갈래를 값으로 만든다
 * - 9303 — **보유가 0**이고 `heldLotCount` **필드 자체가 없다**(`null`).
 *   `lastTransactionAt`이 `null`이다
 *
 * 품질 상태는 9301·9303이 **같은 값**이다 — 선택지를 뽑을 때 중복이 접히는지 여기서 드러난다.
 */
export const itemViewFixtures: BalanceView[] = [
  balance(),
  balance({
    itemId: 9302,
    qualityStatusCode: 'SAMPLE_Q_B',
    ownerPartnerId: 9601,
    onHandQty: -4,
    availableQty: -4,
    blockedQty: 0,
    heldLotCount: 2,
  }),
  balance({
    itemId: 9303,
    onHandQty: 0,
    reservedQty: 0,
    pickedQty: 0,
    blockedQty: 0,
    availableQty: 0,
    heldLotCount: null,
    lastTransactionAt: null,
  }),
];

/**
 * LOT별 보기의 잔액 세 줄. **같은 품목의 줄 둘과 다른 품목의 줄 하나**다 —
 * 그룹 헤더가 둘 나오는지(셋이 아니라) 판정하는 값이다.
 *
 * - 9401·9402 — 품목 9301에 딸린 두 LOT
 * - 9403 — 품목 9302의 LOT. LOT 번호가 **참조 목록에 없다**
 */
export const lotViewFixtures: BalanceView[] = [
  balance({ groupBy: 'LOT', lotId: 9401 }),
  balance({ groupBy: 'LOT', lotId: 9402, onHandQty: 30, availableQty: 30, blockedQty: 0 }),
  balance({
    groupBy: 'LOT',
    itemId: 9302,
    lotId: 9403,
    onHandQty: 8,
    availableQty: 8,
    blockedQty: 0,
    heldLotCount: null,
  }),
];

/**
 * 위치별 보기의 잔액 세 줄. **같은 위치의 줄 둘과 다른 위치의 줄 하나**다.
 *
 * - 9201 — 품목 9301·9302가 함께 있는 위치
 * - 9202 — 품목 9301만 있는 위치. 위치 번호가 **참조 목록에 없다**
 */
export const locationViewFixtures: BalanceView[] = [
  balance({ groupBy: 'LOCATION', locationId: 9201 }),
  balance({
    groupBy: 'LOCATION',
    locationId: 9201,
    itemId: 9302,
    onHandQty: 12,
    availableQty: 12,
    blockedQty: 0,
  }),
  balance({
    groupBy: 'LOCATION',
    locationId: 9202,
    onHandQty: 40,
    availableQty: 40,
    blockedQty: 0,
  }),
];

/**
 * 참조 목록의 응답 본문. **화면이 읽는 필드만 담는다** — 스텁 응답은 JSON이라
 * 계약의 모든 필드를 갖출 필요가 없고, 갖추면 무엇을 읽는지가 오히려 가려진다.
 *
 * 목록에 **없는 번호**를 가진 줄이 픽스처에 함께 있다(품목 9302 · LOT 9403 · 위치 9202) —
 * 「목록에 없음」 갈래를 실제 값으로 만들어 내는 유일한 방법이다.
 */
export const warehouseFixtures = [
  {
    warehouseId: 9101,
    warehouseCode: 'SAMPLE-WH-01',
    warehouseName: '합성 자재창고 가',
    isActive: true,
  },
  {
    warehouseId: 9102,
    warehouseCode: 'SAMPLE-WH-02',
    warehouseName: '합성 자재창고 나',
    isActive: true,
  },
];

export const locationFixtures = [
  {
    locationId: 9201,
    locationCode: 'SAMPLE-LOC-01',
    locationName: '합성 위치 가',
    isActive: true,
  },
];

export const itemFixtures = [
  { itemId: 9301, itemCode: 'SAMPLE-ITEM-01', itemName: '합성 품목 가', isActive: true },
  /*
   * **미사용 품목.** 조회 화면은 이것도 선택지에 낸다 — 과거 재고가 참조하기 때문이다.
   * 어느 잔액 줄도 이 번호를 쓰지 않는다. 「선택지에는 있으나 표에는 없다」를 만드는 값이다.
   */
  { itemId: 9309, itemCode: 'SAMPLE-ITEM-09', itemName: '합성 품목 자', isActive: false },
];

export const lotFixtures = [
  { lotId: 9401, lotNo: 'SAMPLE-LOT-0001' },
  { lotId: 9402, lotNo: 'SAMPLE-LOT-0002' },
];

export const uomFixtures = [
  { uomId: 9501, uomCode: 'SAMPLE-EA', uomName: '합성 단위 개', isActive: true },
];

export const partnerFixtures = [
  {
    partnerId: 9601,
    partnerCode: 'SAMPLE-PTR-01',
    partnerName: '합성 거래처 가',
    isActive: true,
  },
];

/**
 * 「오늘」에서 며칠 뒤의 날짜. **고정 날짜를 쓰지 않는다** — 유효기한 표식이 실행 날짜에 따라
 * 뒤집혀, 어느 날 아무것도 고치지 않았는데 테스트가 깨진다.
 */
const shiftDays = (today: Date, days: number): string => {
  const at = new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
  const pad = (value: number): string => String(value).padStart(2, '0');

  return `${String(at.getFullYear())}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
};

const BASE_LOT: LotDetailView['lot'] = {
  lotId: 9401,
  lotNo: 'SAMPLE-LOT-0001',
  itemId: 9301,
  lotTypeCode: 'SAMPLE_LOT_T_A',
  statusCode: 'SAMPLE_LOT_S_A',
  initialQty: 150,
  uomId: 9501,
  manufacturedAt: '2026-08-06T09:12:00+09:00',
  expiryDate: null,
  remarks: null,
};

/**
 * **보류가 걸린 LOT.** 이 화면이 다뤄야 하는 까다로운 입력을 한 벌에 담는다.
 *
 * - 유효기한이 **기준 일수째**다 — 임박 경계 안쪽의 마지막 날이다
 * - 보류 둘 — 9701은 **`holdQty`가 없어 전량 보류**, 9702는 수량과 단위가 있다.
 *   9701에는 해제 조건과 비고가 있고 9702에는 **둘 다 없다**
 * - 외부 식별자 둘 — 9801은 **발급처가 있고**, 9802는 **없다**(우리가 붙인 번호다)
 */
export const heldLotDetail = (today: Date): LotDetailView => ({
  lot: {
    ...BASE_LOT,
    expiryDate: shiftDays(today, EXPIRY_SOON_DAYS),
    remarks: '합성 비고입니다',
  },
  externalIdentifiers: [
    {
      lotExternalIdentifierId: 9801,
      identifierTypeCode: 'SAMPLE_EXT_T_A',
      externalIdentifier: 'SAMPLE-EXT-0001',
      partnerId: 9601,
      externalSystemCode: 'SAMPLE_SYS_A',
    },
    {
      lotExternalIdentifierId: 9802,
      identifierTypeCode: 'SAMPLE_EXT_T_B',
      externalIdentifier: 'SAMPLE-EXT-0002',
      partnerId: null,
      externalSystemCode: null,
    },
  ],
  holds: [
    {
      lotHoldId: 9701,
      reasonCode: 'SAMPLE_HOLD_R_A',
      statusCode: 'SAMPLE_HOLD_S_A',
      heldAt: '2026-08-06T09:12:00+09:00',
      holdQty: null,
      uomId: null,
      releaseCondition: '합성 해제 조건입니다',
      remarks: '합성 보류 비고입니다',
    },
    {
      lotHoldId: 9702,
      reasonCode: 'SAMPLE_HOLD_R_B',
      statusCode: 'SAMPLE_HOLD_S_A',
      heldAt: '2026-08-07T14:30:00+09:00',
      holdQty: 40,
      uomId: 9501,
      releaseCondition: null,
      remarks: null,
    },
  ],
});

/**
 * **보류도 외부 식별자도 없는 LOT.** 빈 상태 둘을 만들어 내는 값이다 —
 * 유효기한도 없어 표식이 하나도 붙지 않는다(짝 방향의 선행 단언에 쓴다).
 */
export const plainLotDetail = (): LotDetailView => ({
  lot: { ...BASE_LOT, lotId: 9402, lotNo: 'SAMPLE-LOT-0002', expiryDate: null, remarks: null },
  externalIdentifiers: [],
  holds: [],
});

/** **유효기한이 지난 LOT.** 표식만 붙고 화면이 보류를 걸지 않음을 이 값으로 확인한다. */
export const expiredLotDetail = (today: Date): LotDetailView => ({
  ...plainLotDetail(),
  lot: {
    ...BASE_LOT,
    lotId: 9402,
    lotNo: 'SAMPLE-LOT-0002',
    expiryDate: shiftDays(today, -1),
  },
});

/**
 * 수불 이력 두 줄. **역처리인 줄과 아닌 줄**을 함께 담는다 —
 * 표식이 값에 따라 붙는지 짝으로 확인할 수 있어야 한다.
 *
 * - 9901 — 보통의 입고 거래. `reversalOfTransactionId`가 없다
 * - 9902 — **역처리 거래.** 영업일이 9901과 다르다 — 상세 경로에 영업일이 함께 실리는지
 *   판정하려면 줄마다 영업일이 달라야 한다(번호만 실어도 통과하는 단언을 막는다)
 */
const RECEIPT_TRANSACTION: TransactionView = {
  inventoryTransactionId: 9901,
  businessDate: '2026-08-06',
  transactionNo: 'SAMPLE-IT-0001',
  transactionTypeCode: 'SAMPLE_TX_T_A',
  sourceDocumentTypeCode: 'GOODS_RECEIPT',
  statusCode: 'SAMPLE_TX_S_A',
  occurredAt: '2026-08-06T09:12:00+09:00',
  isReversal: false,
};

const REVERSAL_TRANSACTION: TransactionView = {
  inventoryTransactionId: 9902,
  businessDate: '2026-08-07',
  transactionNo: 'SAMPLE-IT-0002',
  transactionTypeCode: 'SAMPLE_TX_T_B',
  sourceDocumentTypeCode: 'GOODS_ISSUE',
  statusCode: 'SAMPLE_TX_S_A',
  occurredAt: '2026-08-07T14:30:00+09:00',
  isReversal: true,
};

export const transactionFixtures: TransactionView[] = [RECEIPT_TRANSACTION, REVERSAL_TRANSACTION];

/**
 * **번호가 같고 영업일이 다른 두 줄.** 계약이 원장을 영업일로 나눠 저장하고 영업일을
 * 식별자의 일부로 두므로 실제로 생길 수 있는 형태다 — 행 키가 번호 한 조각이면 두 줄이
 * 같은 행으로 보이고, React가 쪽을 넘길 때 앞 쪽의 행을 남긴다.
 *
 * 위 `transactionFixtures`에 섞지 않는다 — 그쪽은 역처리 표식·시각 표기 같은 다른 단언이
 * 줄을 세고 있어, 줄을 더하면 무엇을 검사하는 픽스처인지 흐려진다.
 */
export const sameNumberTransactionFixtures: TransactionView[] = [
  RECEIPT_TRANSACTION,
  { ...RECEIPT_TRANSACTION, businessDate: '2026-08-07' },
];

/**
 * **계약 모양**의 같은 두 줄. 화면 타입과 키 이름이 달라(`isReversal` ↔
 * `reversalOfTransactionId`) 화면 타입을 그대로 응답 본문으로 줄 수 없다 —
 * 주면 스텁이 계약과 다른 것을 말하고, 변환이 통째로 검사되지 않은 채 통과한다.
 *
 * 위 화면 타입과 짝이 맞는지는 `types.test.ts`가 변환을 돌려 값으로 고정한다.
 */
const RECEIPT_TRANSACTION_RESPONSE: components['schemas']['InventoryTransaction'] = {
  inventoryTransactionId: 9901,
  businessDate: '2026-08-06',
  transactionNo: 'SAMPLE-IT-0001',
  transactionTypeCode: 'SAMPLE_TX_T_A',
  plantId: 9001,
  occurredAt: '2026-08-06T09:12:00+09:00',
  recordedAt: '2026-08-06T09:13:00+09:00',
  sourceDocumentTypeCode: 'GOODS_RECEIPT',
  sourceDocumentId: 9021,
  statusCode: 'SAMPLE_TX_S_A',
};

export const transactionResponseFixtures: components['schemas']['InventoryTransaction'][] = [
  RECEIPT_TRANSACTION_RESPONSE,
  {
    inventoryTransactionId: 9902,
    businessDate: '2026-08-07',
    transactionNo: 'SAMPLE-IT-0002',
    transactionTypeCode: 'SAMPLE_TX_T_B',
    plantId: 9001,
    occurredAt: '2026-08-07T14:30:00+09:00',
    recordedAt: '2026-08-07T14:31:00+09:00',
    sourceDocumentTypeCode: 'GOODS_ISSUE',
    sourceDocumentId: 9022,
    statusCode: 'SAMPLE_TX_S_A',
    /* 역처리 거래 — 화면은 대상 번호를 내지 않고 「역처리」 표식만 낸다. */
    reversalOfTransactionId: 9901,
    reversalOfBusinessDate: '2026-08-06',
  },
];

/**
 * 고른 거래의 라인 셋. 이동 방향 세 갈래를 한 벌에 담는다.
 *
 * - 9951 — **도착지만 있다**(입고). LOT과 단위가 참조 목록에 있다
 * - 9952 — **출발지만 있다**(출고). LOT이 **`null`**이다(LOT 관리 대상이 아닌 품목)
 * - 9953 — **둘 다 있다**(이동). 출발 창고가 **조건 줄에서 고른 창고가 아니다** —
 *   그 창고의 위치는 이름을 풀 수 없다는 사실을 값으로 만든다
 */
export const transactionLineFixtures = (): TransactionDetailView => ({
  transaction: RECEIPT_TRANSACTION,
  lines: [
    {
      inventoryTransactionLineId: 9951,
      lineNo: 1,
      itemId: 9301,
      lotId: 9401,
      qty: 120,
      uomId: 9501,
      fromWarehouseId: null,
      fromLocationId: null,
      toWarehouseId: 9101,
      toLocationId: 9201,
    },
    {
      inventoryTransactionLineId: 9952,
      lineNo: 2,
      itemId: 9301,
      lotId: null,
      qty: 30,
      uomId: 9501,
      fromWarehouseId: 9101,
      fromLocationId: 9201,
      toWarehouseId: null,
      toLocationId: null,
    },
    {
      inventoryTransactionLineId: 9953,
      lineNo: 3,
      itemId: 9301,
      lotId: 9401,
      qty: 15,
      uomId: 9501,
      fromWarehouseId: 9102,
      fromLocationId: 9299,
      toWarehouseId: 9101,
      toLocationId: 9201,
    },
  ],
});

/**
 * **계약 모양**의 같은 거래 상세. 화면 타입과 바깥 키 이름이 다르고
 * (`transaction` ↔ `inventoryTransaction`) 라인에 화면이 옮기지 않는 필드가 더 있다 —
 * 그 필드들이 **화면 어디에도 나오지 않는다**를 값으로 검사할 수 있게 일부러 담는다.
 */
export const transactionDetailResponse =
  (): components['schemas']['InventoryTransactionDetailResponse'] => ({
    inventoryTransaction: RECEIPT_TRANSACTION_RESPONSE,
    lines: [
      {
        inventoryTransactionLineId: 9951,
        inventoryTransactionId: 9901,
        businessDate: '2026-08-06',
        lineNo: 1,
        itemId: 9301,
        lotId: 9401,
        qty: 120,
        uomId: 9501,
        toWarehouseId: 9101,
        toLocationId: 9201,
        toQualityStatusCode: 'SAMPLE_Q_A',
        /* 재고 상태만 합성값이 아니다 — **계약이 값을 넷으로 못박아** 다른 값은 타입이 막는다. */
        toInventoryStatusCode: 'AVAILABLE',
        ownershipTypeCode: 'SAMPLE_OWN_A',
        toQtyAfterTransaction: 120,
      },
      {
        inventoryTransactionLineId: 9952,
        inventoryTransactionId: 9901,
        businessDate: '2026-08-06',
        lineNo: 2,
        itemId: 9301,
        lotId: null,
        qty: 30,
        uomId: 9501,
        fromWarehouseId: 9101,
        fromLocationId: 9201,
        ownershipTypeCode: 'SAMPLE_OWN_A',
        fromQtyAfterTransaction: 90,
      },
      {
        inventoryTransactionLineId: 9953,
        inventoryTransactionId: 9901,
        businessDate: '2026-08-06',
        lineNo: 3,
        itemId: 9301,
        lotId: 9401,
        qty: 15,
        uomId: 9501,
        fromWarehouseId: 9102,
        fromLocationId: 9299,
        toWarehouseId: 9101,
        toLocationId: 9201,
        ownershipTypeCode: 'SAMPLE_OWN_A',
        ownerPartnerId: 9601,
        /* 9000대다 — 화면이 옮기지 않는 필드끼리 모은다(보류의 9700대와 겹치지 않게). */
        handlingUnitId: 9041,
      },
    ],
  });
