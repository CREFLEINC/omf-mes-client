import type { BalanceView } from './types';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다. 이 화면은 창고·품목·LOT·거래처처럼 **실제로 보일 법한
 * 값**을 그리는 자리라, 한눈에 예시임이 보이는 접두(`SAMPLE-`·`SAMPLE_`)와 「합성 …」만 쓴다.
 * 실 운영 코드·거래처명·품목코드·LOT 번호를 넣지 않는다(공개 저장소 경계).
 *
 * **내부 번호(FK)는 서로 겹치지 않는 대역으로 나눈다** — 9100대(창고) · 9200대(위치) ·
 * 9300대(품목) · 9400대(LOT) · 9500대(단위) · 9600대(거래처). 「표 어디에도 내부 번호가
 * 렌더되지 않는다」를 검사할 때 수량 같은 정상 숫자와 헷갈리지 않게 하기 위해서다.
 * 수량은 전부 세 자리 이하로 두어 네 자리 번호와 섞이지 않는다.
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
