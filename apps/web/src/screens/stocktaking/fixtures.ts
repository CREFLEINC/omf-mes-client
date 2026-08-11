import type { components } from '@omf-mes/api-client';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다. 이 화면은 실사번호·창고·코드처럼 **실제로 보일 법한
 * 값**을 그리는 자리라, 한눈에 예시임이 보이는 접두(`SAMPLE-`·`SAMPLE_`)와 지어낸 번호 대역
 * (`IC-2026-9…`·`WH-9…`)만 쓴다. 실 운영 코드·창고명·품목코드를 넣지 않는다(공개 저장소 경계).
 *
 * **계약의 `@example` 값을 쓰지 않는다**(`CYCLE`·`MISPLACED`·`IN_PROGRESS`). 예시를 픽스처에
 * 쓰면 나중에 「확정 값」으로 읽힌다 — 값 목록은 아직 확정되지 않았다.
 *
 * **내부 번호(FK)는 서로 겹치지 않는 대역으로 나눈다** — 9000대(실사 전표) · 9100대(창고) ·
 * 9300대(품목) · 9400대(실사 라인) · 9500대(단위) · 9600대(자재 LOT) · 9700대(위치).
 * 「표 어디에도 내부 번호가 렌더되지 않는다」를 검사할 때 건수·수량 같은 정상 숫자와 헷갈리지
 * 않게 하기 위해서다. 업무 번호에 내부 번호가 **부분 문자열로 들어가지 않도록** 대역을 갈라
 * 두었다 — 실사번호를 `IC-2026-9000…`으로 둔 것이 그 때문이다.
 */

type InventoryCountResponse = components['schemas']['InventoryCount'];
type InventoryCountSummaryResponse = components['schemas']['InventoryCountSummary'];
type InventoryCountLineResponse = components['schemas']['InventoryCountLine'];

const BASE_COUNT: InventoryCountResponse = {
  inventoryCountId: 9001,
  inventoryCountNo: 'IC-2026-900011',
  countTypeCode: 'SAMPLE_COUNT_TYPE_A',
  warehouseId: 9101,
  plannedDate: '2026-08-06',
  blindCount: false,
  statusCode: 'SAMPLE_COUNT_STATUS_A',
};

/** 한 항목만 다른 건을 만든다. 무엇을 검사하는 테스트인지 그 인자만 보고 읽히게 한다. */
export const countResponse = (
  overrides: Partial<InventoryCountResponse> = {},
): InventoryCountResponse => ({ ...BASE_COUNT, ...overrides });

/**
 * 화면 수준 테스트가 목록 응답으로 쓰는 세 건. 화면이 다뤄야 하는 까다로운 입력을 일부러 담는다.
 *
 * - 9001 — 값이 전부 채워져 있고 **블라인드가 아니다**. 상세·라인 픽스처가 이 실사의 것이다
 * - 9002 — **블라인드 실사**이고 **창고 번호가 참조 목록에 없다**(「목록에 없음」 갈래)
 * - 9003 — 계획일과 실사 유형이 다르고 **상태 코드가 9001과 같다** — 코드가 접히는지 드러난다
 */
export const countFixtures: InventoryCountResponse[] = [
  countResponse(),
  countResponse({
    inventoryCountId: 9002,
    inventoryCountNo: 'IC-2026-900012',
    warehouseId: 9102,
    blindCount: true,
    statusCode: 'SAMPLE_COUNT_STATUS_B',
  }),
  countResponse({
    inventoryCountId: 9003,
    inventoryCountNo: 'IC-2026-900013',
    countTypeCode: 'SAMPLE_COUNT_TYPE_B',
    plannedDate: '2026-08-07',
  }),
];

/**
 * 실사 진행 요약. **서버가 계산해 상세 응답에 함께 온다.**
 *
 * 기본값은 「미실사도 차이도 남은」 상태다 — 마감 조건을 못 채운 진행 중 실사가 이 화면의
 * 보통 상태이고, 마감 활성 전환은 PR ④가 요약 네 벌로 검사한다.
 */
const BASE_SUMMARY: InventoryCountSummaryResponse = {
  plannedCount: 40,
  countedCount: 25,
  uncountedCount: 15,
  varianceCount: 6,
};

export const summaryResponse = (
  overrides: Partial<InventoryCountSummaryResponse> = {},
): InventoryCountSummaryResponse => ({ ...BASE_SUMMARY, ...overrides });

/** 상세 응답 본문 — 헤더와 요약이 한 벌로 온다. 개시 201 응답도 같은 모양이다. */
export const countDetailBody = (
  countOverrides: Partial<InventoryCountResponse> = {},
  summaryOverrides: Partial<InventoryCountSummaryResponse> = {},
) => ({
  inventoryCount: countResponse(countOverrides),
  summary: summaryResponse(summaryOverrides),
});

/**
 * **개시로 만들어진 실사**의 번호. 목록 픽스처 셋(9001~9003) 어디에도 없다 —
 * 방금 만든 실사가 **지금 조건의 목록에 걸리지 않을 수 있다**는 사실이 이 화면의 전제이고
 * (그래서 단계를 목록 소속이 아니라 상세 200으로 판정한다), 겹치면 그 전제를 검사할 수 없다.
 */
export const OPENED_COUNT_ID = 9004;

export const OPENED_COUNT_NO = 'IC-2026-900014';

/**
 * 개시 201 응답. **요약이 갓 만들어진 실사의 모양이다** — 라인은 서버가 장부에서 만들었고
 * 아직 아무것도 세지 않았다. 9001의 요약(40/25/15/6)과 숫자가 하나도 겹치지 않아,
 * 개시 뒤 아래 구획이 **새 실사의 값**으로 바뀌는지 값으로 가려낼 수 있다.
 */
export const openedCountDetailBody = () =>
  countDetailBody(
    {
      inventoryCountId: OPENED_COUNT_ID,
      inventoryCountNo: OPENED_COUNT_NO,
      countTypeCode: 'SAMPLE_COUNT_TYPE_C',
      warehouseId: 9101,
      plannedDate: '2026-08-12',
      blindCount: true,
      statusCode: 'SAMPLE_COUNT_STATUS_C',
    },
    { plannedCount: 31, countedCount: 0, uncountedCount: 31, varianceCount: 0 },
  );

const BASE_LINE: InventoryCountLineResponse = {
  inventoryCountLineId: 9401,
  inventoryCountId: 9001,
  lineNo: 1,
  locationId: 9701,
  itemId: 9301,
  lotId: 9601,
  systemQty: 100,
  countedQty: 98,
  varianceQty: -2,
  uomId: 9501,
  varianceReasonCode: 'SAMPLE_VARIANCE_REASON_A',
  countedAt: '2026-08-06T09:12:00+09:00',
};

export const countLineResponse = (
  overrides: Partial<InventoryCountLineResponse> = {},
): InventoryCountLineResponse => ({ ...BASE_LINE, ...overrides });

/**
 * **블라인드 실사의 라인 응답을 모사한다** — 장부 수량과 차이 수량이 **아예 오지 않는다**.
 *
 * 계약은 둘 다 `required`로 두지만 `systemQty`의 설명이 「블라인드 실사에서는 내려보내지
 * 않는다」다(계획 결정 4 · 어긋남 1). 타입과 런타임이 어긋나는 자리라 **여기서 한 번만
 * 단언으로 좁힌다** — 이 어긋남을 코드 여기저기서 되풀이해 캐스팅하지 않기 위해서다.
 */
export const blindCountLineResponse = (
  overrides: Partial<InventoryCountLineResponse> = {},
): InventoryCountLineResponse => {
  const { systemQty: _systemQty, varianceQty: _varianceQty, ...withoutQty } = BASE_LINE;

  return { ...withoutQty, ...overrides } as InventoryCountLineResponse;
};

/**
 * 창고 목록. **참조 풀이와 조건 줄 선택지가 같은 목록을 쓴다.**
 *
 * 9102(9002의 창고)는 여기 없다 — 「목록에 없음」 갈래를 만드는 값이다.
 * 9103은 **미사용 창고**이고 어느 실사도 이 번호를 쓰지 않는다 — 「선택지에는 있으나 표에는
 * 없다」를 만들어, 미사용 값을 빼지 않고 표식만 붙인다는 규칙을 검사한다.
 */
export const warehouseFixtures = [
  {
    warehouseId: 9101,
    warehouseCode: 'SAMPLE-WH-01',
    warehouseName: '합성 창고 가',
    isActive: true,
  },
  {
    warehouseId: 9103,
    warehouseCode: 'SAMPLE-WH-03',
    warehouseName: '합성 창고 다',
    isActive: false,
  },
];

/** 라인 픽스처가 쓰는 위치. 주소의 `loc`와 라인 조회의 `locationId`가 이 값이다. */
export const LOCATION_ID = 9701;

/**
 * 한 위치의 실사 라인 **셋**. 화면이 다뤄야 하는 까다로운 줄을 일부러 담는다.
 *
 * - 9401 — **장부와 실물이 다르다**(100 대 98). 차이 사유가 필수가 되는 줄이다
 * - 9402 — **장부와 실물이 같고 자재 LOT이 `null`**이다. 「빈 값이지 참조 실패가 아니다」의 자리
 * - 9403 — **품목이 참조 목록에 없고**(9303) 저장된 실물이 0이다. 「목록에 없음」 갈래
 *
 * 셋의 저장된 실물 수량이 전부 다르다 — 「친 값이 저장된 값과 다르면 낡음 표식」(완료 조건 C41)을
 * 한 줄만 겨냥해 만들 수 있다.
 */
export const countLineFixtures: InventoryCountLineResponse[] = [
  countLineResponse(),
  countLineResponse({
    inventoryCountLineId: 9402,
    lineNo: 2,
    itemId: 9302,
    lotId: null,
    systemQty: 40,
    countedQty: 40,
    varianceQty: 0,
    varianceReasonCode: null,
  }),
  countLineResponse({
    inventoryCountLineId: 9403,
    lineNo: 3,
    itemId: 9303,
    lotId: 9602,
    systemQty: 7,
    countedQty: 0,
    varianceQty: -7,
    uomId: 9502,
    varianceReasonCode: null,
  }),
];

/**
 * 위치 목록. **실사의 창고로 좁혀 받는다**(계약이 `warehouseId`를 필수로 요구한다).
 *
 * 9702는 **미사용 위치**다 — 창고와 같이 미사용 값을 빼지 않고 표식만 붙인다.
 * 9703은 어느 라인도 쓰지 않는다 — 「선택지에는 있으나 라인이 없는 위치」를 만든다.
 */
export const locationFixtures = [
  {
    locationId: LOCATION_ID,
    warehouseId: 9101,
    locationCode: 'SAMPLE-LOC-01',
    locationName: '합성 위치 가',
    locationTypeCode: 'SAMPLE_LOC_TYPE_A',
    allowMixedItem: true,
    isActive: true,
  },
  {
    locationId: 9702,
    warehouseId: 9101,
    locationCode: 'SAMPLE-LOC-02',
    locationName: '합성 위치 나',
    locationTypeCode: 'SAMPLE_LOC_TYPE_A',
    allowMixedItem: true,
    isActive: false,
  },
  {
    locationId: 9703,
    warehouseId: 9101,
    locationCode: 'SAMPLE-LOC-03',
    locationName: '합성 위치 다',
    locationTypeCode: 'SAMPLE_LOC_TYPE_A',
    allowMixedItem: true,
    isActive: true,
  },
];

/** 품목 목록. **9303은 여기 없다** — 라인 9403이 「목록에 없음」 갈래를 만든다. */
export const itemFixtures = [
  { itemId: 9301, itemCode: 'SAMPLE-ITEM-01', itemName: '합성 품목 가', isActive: true },
  { itemId: 9302, itemCode: 'SAMPLE-ITEM-02', itemName: '합성 품목 나', isActive: true },
];

export const uomFixtures = [
  { uomId: 9501, uomCode: 'SAMPLE-EA', uomName: '합성 단위 개', isActive: true },
  { uomId: 9502, uomCode: 'SAMPLE-BOX', uomName: '합성 단위 상자', isActive: true },
];

/**
 * 자재 LOT 목록. **품목으로 좁혀 받는다** — 번호 여러 개로 한 번에 조회하는 수단이 계약에 없다.
 *
 * 9602(9403의 LOT)는 여기 없다 — 그 줄의 품목(9303)이 참조 목록에 없어 LOT도 못 받는
 * **연쇄를 그대로 재현한다.**
 */
export const lotFixtures = [{ lotId: 9601, lotNo: 'LOT-2026-900010', itemId: 9301 }];
