/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다.
 *
 * 전부 지어낸 합성값이다 — 한눈에 예시임이 보이는 접두(`SAMPLE-`·`SAMPLE_`)와 「합성 …」만 쓴다.
 * 실 운영 코드·거래처명·품목코드를 넣지 않는다(공개 저장소 경계).
 *
 * **내부 번호(FK)는 서로 겹치지 않는 대역으로 나눈다** — 9000대(출하작업지시·라인) ·
 * 9100~9200대(거래처 참조).
 */

const BASE_LINE = {
  shipmentRequestLineId: 9701,
  lineNo: 1,
  itemId: 9301,
  requestedQty: 500,
  allocatedQty: 500,
  shippedQty: 500,
  uomId: 9501,
  shippingInspectionRequired: false,
};

const BASE_SHIPMENT_REQUEST = {
  shipmentRequestId: 9001,
  shipmentRequestNo: 'SAMPLE-SR-0001',
  customerId: 9101,
  shipToPartnerId: 9111,
  requestedShipDate: '2026-08-13',
  statusCode: 'SAMPLE_STATUS_A',
  shipmentProgressCode: 'PICKED',
  shippingInspectionStatusCode: 'NOT_REQUIRED',
  lines: [BASE_LINE],
};

/** 한 항목만 다른 건을 만든다. 무엇을 검사하는 테스트인지 그 인자만 보고 읽히게 한다. */
export const shipmentRequest = (overrides: Record<string, unknown> = {}) => ({
  ...BASE_SHIPMENT_REQUEST,
  ...overrides,
});

/** 목록 픽스처. 검사 대기 라인이 있는 건 하나를 섞어 그 배지가 실제로 나오는지 검사할 수 있게 한다. */
export const shipmentRequestFixtures = [
  shipmentRequest(),
  shipmentRequest({
    shipmentRequestId: 9002,
    shipmentRequestNo: 'SAMPLE-SR-0002',
    // 목록에 없는 거래처 번호 — 「목록에 없음」 갈래를 실제 값으로 만든다.
    customerId: 9102,
    shippingInspectionStatusCode: 'PENDING',
    lines: [{ ...BASE_LINE, shipmentRequestLineId: 9702, shippingInspectionRequired: true }],
  }),
];

/**
 * 참조 목록의 응답 본문. 화면이 읽는 필드만 담는다.
 *
 * 미사용 거래처(9112)도 함께 둔다 — 조회 화면은 과거 건이 참조할 수 있어 선택지에서 빼지 않는다.
 */
export const partnerFixtures = [
  { partnerId: 9101, partnerCode: 'SAMPLE-CUS-01', partnerName: '합성 고객 가', isActive: true },
  { partnerId: 9111, partnerCode: 'SAMPLE-SHT-01', partnerName: '합성 납품처 가', isActive: true },
  { partnerId: 9112, partnerCode: 'SAMPLE-SHT-02', partnerName: '합성 납품처 나', isActive: false },
];
