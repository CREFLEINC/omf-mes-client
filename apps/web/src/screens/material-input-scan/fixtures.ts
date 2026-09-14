import type { components } from '@omf-mes/api-client';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다.
 *
 * 전부 지어낸 합성값이다 — 한눈에 예시임이 보이는 접두(`SAMPLE-`)만 쓴다. 실 운영 코드·품목
 * 코드·LOT 번호를 넣지 않는다(공개 저장소 경계).
 *
 * **내부 번호(FK)는 서로 겹치지 않는 대역으로 나눈다** — 7000대(전표) · 7100대(수령 줄) ·
 * 7200대(품목) · 7300대(LOT) · 7400대(단위).
 */

const BASE_LINE = {
  shopfloorReceiptLineId: 7101,
  shopfloorReceiptId: 7001,
  goodsIssueLineId: 7601,
  itemId: 7201,
  lotId: 7301,
  issuedQty: 100,
  receivedQty: 100,
  varianceQty: 0,
  uomId: 7401,
};

/** 한 항목만 다른 줄을 만든다. 무엇을 검사하는 테스트인지 그 인자만 보고 읽히게 한다. */
export const receiptLine = (overrides: Record<string, unknown> = {}) => ({
  ...BASE_LINE,
  ...overrides,
});

const BASE_RECEIPT = {
  shopfloorReceiptId: 7001,
  shopfloorReceiptNo: 'SAMPLE-SR-0001',
  goodsIssueId: 7501,
  workOrderId: 7801,
  destinationLocationId: 7901,
  receivedAt: '2026-08-13T09:12:00+09:00',
  statusCode: 'SAMPLE_STATUS_A',
};

export const receipt = (overrides: Record<string, unknown> = {}) => ({
  ...BASE_RECEIPT,
  ...overrides,
});

/** 화면이 쓰는 작업지시 번호. 주소에 실려 조회 조건이 된다. */
export const WORK_ORDER_ID = 7801;

/**
 * 세 갈래(수령 완료 · 부족 · 미수령)를 한 벌에 담는다 — 상태 칩이 실제로 갈리는지 한 렌더로 잰다.
 */
export const receiptLineFixtures = [
  receiptLine(),
  receiptLine({
    shopfloorReceiptLineId: 7102,
    itemId: 7202,
    lotId: 7302,
    issuedQty: 200,
    receivedQty: 180,
    varianceQty: 20,
    varianceReasonCode: 'SAMPLE_REASON_A',
  }),
  receiptLine({
    shopfloorReceiptLineId: 7103,
    itemId: 7203,
    lotId: 7303,
    issuedQty: 50,
    receivedQty: 0,
    varianceQty: 50,
  }),
];

type LotResponse = components['schemas']['Lot'];
type MoldResponse = components['schemas']['Mold'];

/**
 * ⚠ **자재LOT·금형은 계약 타입으로 고정한다.** 이 둘은 스텁 응답으로만 쓰이는 것이 아니라
 * 화면 변환 함수에 그대로 들어간다 — 느슨하게 두면 계약이 바뀌어도 픽스처가 조용히 통과하고,
 * 감지기가 **없는 모양의 자료**를 검사하게 된다.
 */
const BASE_LOT: LotResponse = {
  lotId: 7301,
  lotNo: 'SAMPLE-LOT-0001',
  itemId: 7201,
  lotTypeCode: 'SAMPLE_LOT_TYPE',
  plantId: 7701,
  initialQty: 100,
  uomId: 7401,
  sourceTypeCode: 'SAMPLE_SOURCE',
  sourceId: 7801,
  statusCode: 'NORMAL',
  held: false,
};

export const lot = (overrides: Partial<LotResponse> = {}): LotResponse => ({
  ...BASE_LOT,
  ...overrides,
});

const BASE_MOLD: MoldResponse = {
  moldId: 7601,
  plantId: 7701,
  moldCode: 'SAMPLE-MLD-01',
  moldName: '합성 금형 가',
  toolTypeCode: 'MOLD',
  cavityCount: 4,
  currentShotCount: 12450,
  guaranteedShotCount: 50000,
  availableShotCount: 37550,
  pmTriggerTypeCode: 'NONE',
  statusCode: 'IN_SERVICE',
  isActive: true,
};

export const mold = (overrides: Partial<MoldResponse> = {}): MoldResponse => ({
  ...BASE_MOLD,
  ...overrides,
});
