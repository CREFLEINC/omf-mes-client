import type { components } from '@omf-mes/api-client';

import type { BalanceView, LotDetailView } from './types';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 — 참조하면 예시 값이
 * 배포 번들에 들어간다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다. 한눈에 예시임이 보이는 접두(`SAMPLE-`·`SAMPLE_`)와
 * 「합성 …」만 쓴다. 실 운영 코드·거래처명·품목코드·LOT 번호를 넣지 않는다(공개 저장소 경계).
 *
 * **내부 번호(FK)는 서로 겹치지 않는 대역으로 나눈다** — 표 어디에도 내부 번호가 렌더되지
 * 않는지 검사할 때 정상 숫자(수량)와 헷갈리지 않게 하기 위해서다. 수량은 두 자리 이하로 둔다.
 *
 * | 대역 | 무엇 |
 * | ---: | --- |
 * | 9100 · 9200 · 9300 | 창고 · 위치 · 품목 |
 * | 9400 | LOT |
 * | 9700 | 보류 |
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
  onHandQty: 40,
  /* 보유(40)와 일부러 다르게 둔다 — 화면이 가용을 다시 계산하면 이 값이 바뀌어 단언이 깨진다. */
  availableQty: 25,
  blockedQty: 5,
  heldLotCount: 0,
};

/** 한 항목만 다른 줄을 만든다. 무엇을 검사하는 테스트인지 그 인자만 보고 읽히게 한다. */
export const balance = (overrides: Partial<BalanceView> = {}): BalanceView => ({
  ...BASE_BALANCE,
  ...overrides,
});

/**
 * 품목별 보기의 잔액 세 줄.
 *
 * - 9301 — 정상 형태(위치·LOT이 `null`). 보류 LOT 수가 0이다
 * - 9302 — **보유가 음수**다. 품목 번호가 **참조 목록에 없다** — 「알 수 없음」 갈래를 만든다.
 *   보류 LOT 수가 2다
 * - 9303 — **보유가 0**이고 `heldLotCount` 필드 자체가 없다(`null`)
 */
export const itemViewFixtures: BalanceView[] = [
  balance(),
  balance({
    itemId: 9302,
    onHandQty: -3,
    availableQty: -3,
    blockedQty: 0,
    heldLotCount: 2,
  }),
  balance({
    itemId: 9303,
    onHandQty: 0,
    availableQty: 0,
    blockedQty: 0,
    heldLotCount: null,
  }),
];

/**
 * LOT별 보기의 잔액 세 줄. **같은 품목의 줄 둘과 다른 품목의 줄 하나**다 — 그룹 헤더가
 * 둘 나오는지(셋이 아니라) 판정하는 값이다.
 *
 * - 9401·9402 — 품목 9301에 딸린 두 LOT
 * - 9403 — 품목 9302의 LOT. LOT 번호가 **참조 목록에 없다**
 */
export const lotViewFixtures: BalanceView[] = [
  balance({ groupBy: 'LOT', lotId: 9401 }),
  balance({ groupBy: 'LOT', lotId: 9402, onHandQty: 12, availableQty: 12, blockedQty: 0 }),
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
    onHandQty: 9,
    availableQty: 9,
    blockedQty: 0,
  }),
  balance({
    groupBy: 'LOCATION',
    locationId: 9202,
    onHandQty: 15,
    availableQty: 15,
    blockedQty: 0,
  }),
];

/**
 * 참조 목록의 응답 본문. **화면이 읽는 필드만 담는다.** 목록에 없는 번호를 가진 줄이
 * 위 픽스처에 함께 있다(품목 9302 · LOT 9403 · 위치 9202) — 「목록에 없음」 갈래를 실제
 * 값으로 만들어 내는 유일한 방법이다.
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
  { locationId: 9201, locationCode: 'SAMPLE-LOC-01', locationName: '합성 위치 가', isActive: true },
];

export const itemFixtures = [
  { itemId: 9301, itemCode: 'SAMPLE-ITEM-01', itemName: '합성 품목 가', isActive: true },
  /* 미사용 품목. 조회 화면은 이것도 선택지에 낸다 — 과거 재고가 참조하기 때문이다. */
  { itemId: 9309, itemCode: 'SAMPLE-ITEM-09', itemName: '합성 품목 자', isActive: false },
];

export const lotFixtures = [
  { lotId: 9401, lotNo: 'SAMPLE-LOT-0001' },
  { lotId: 9402, lotNo: 'SAMPLE-LOT-0002' },
];

/**
 * LOT 상세 — 이 화면이 실제로 쓰는 형태(`holds[]`만).
 *
 * - 9701 — `releaseCondition`이 있다
 * - 9702 — `releaseCondition`이 없다(대시로 낸다)
 */
export const heldLotDetail: LotDetailView = {
  holds: [
    {
      lotHoldId: 9701,
      reasonCode: 'SAMPLE_HOLD_R_A',
      statusCode: 'SAMPLE_HOLD_S_A',
      heldAt: '2026-08-06T09:12:00+09:00',
      releaseCondition: '합성 해제 조건입니다',
    },
    {
      lotHoldId: 9702,
      reasonCode: 'SAMPLE_HOLD_R_B',
      statusCode: 'SAMPLE_HOLD_S_A',
      heldAt: '2026-08-07T14:30:00+09:00',
      releaseCondition: null,
    },
  ],
};

/** 보류가 없는 LOT. 빈 상태를 만들어 내는 값이다. */
export const plainLotDetail: LotDetailView = { holds: [] };

/**
 * **계약 모양**의 LOT 상세 응답. `lot`·`externalIdentifiers`가 필수라 채우지만 화면은
 * 이 둘을 옮기지 않는다(`types.ts`) — 「응답에 실려 왔지만 화면에 서지 않는다」를
 * 검사하는 쪽이 이 값을 쓴다.
 */
export const heldLotDetailResponse: components['schemas']['LotDetailResponse'] = {
  lot: {
    lotId: 9401,
    lotNo: 'SAMPLE-LOT-0001',
    itemId: 9301,
    lotTypeCode: 'SAMPLE_LOT_T_A',
    plantId: 9001,
    statusCode: 'SAMPLE_LOT_S_A',
    sourceTypeCode: 'INVENTORY_ADJUSTMENT',
    sourceId: 9021,
    initialQty: 60,
    uomId: 9501,
    manufacturedAt: '2026-08-01T09:00:00+09:00',
    expiryDate: null,
    remarks: null,
  },
  externalIdentifiers: [],
  holds: [
    {
      lotHoldId: 9701,
      lotId: 9401,
      reasonCode: 'SAMPLE_HOLD_R_A',
      statusCode: 'SAMPLE_HOLD_S_A',
      heldAt: '2026-08-06T09:12:00+09:00',
      releaseCondition: '합성 해제 조건입니다',
    },
    {
      lotHoldId: 9702,
      lotId: 9401,
      reasonCode: 'SAMPLE_HOLD_R_B',
      statusCode: 'SAMPLE_HOLD_S_A',
      heldAt: '2026-08-07T14:30:00+09:00',
      releaseCondition: null,
    },
  ],
};

export const plainLotDetailResponse: components['schemas']['LotDetailResponse'] = {
  lot: {
    lotId: 9402,
    lotNo: 'SAMPLE-LOT-0002',
    itemId: 9301,
    lotTypeCode: 'SAMPLE_LOT_T_A',
    plantId: 9001,
    statusCode: 'SAMPLE_LOT_S_A',
    sourceTypeCode: 'INVENTORY_ADJUSTMENT',
    sourceId: 9022,
    initialQty: 30,
    uomId: 9501,
    manufacturedAt: '2026-08-01T09:00:00+09:00',
    expiryDate: null,
    remarks: null,
  },
  externalIdentifiers: [],
  holds: [],
};
