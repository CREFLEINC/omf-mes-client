import type { components } from '@omf-mes/api-client';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 — 참조하면 예시 값이
 * 배포 번들에 들어간다.
 *
 * 전부 지어낸 합성값이다. 한눈에 예시임이 보이는 접두(`SAMPLE-`)와 「합성 …」만 쓴다.
 * 실 운영 코드·거래처명·품목코드·LOT 번호를 넣지 않는다(공개 저장소 경계).
 *
 * **내부 번호(FK)는 서로 겹치지 않는 대역으로 나눈다** — 표 어디에도 내부 번호가 렌더되지
 * 않는지 검사할 때 정상 숫자(수량)와 헷갈리지 않게 하기 위해서다.
 *
 * | 대역 | 무엇 |
 * | ---: | --- |
 * | 8100 | 지시서(SalesOrder) |
 * | 8200 | 거래처(고객·납품처) |
 * | 8300 | 품목 |
 * | 8400 | 단위 |
 * | 8600 | 지시서 라인 |
 */

type SalesOrderResponse = components['schemas']['SalesOrder'];
type ShipmentRequestResponse = components['schemas']['ShipmentRequest'];

export const salesOrderListFixtures: SalesOrderResponse[] = [
  {
    salesOrderId: 8101,
    salesOrderNo: 'SAMPLE-SO-0001',
    customerId: 8201,
    shipToPartnerId: 8211,
    orderDate: '2026-08-10',
    statusCode: 'SAMPLE_SO_S_A',
  },
  {
    salesOrderId: 8102,
    salesOrderNo: 'SAMPLE-SO-0002',
    customerId: 8202,
    shipToPartnerId: 8212,
    orderDate: '2026-08-11',
    statusCode: 'SAMPLE_SO_S_B',
  },
];

/**
 * 지시서 8101의 상세 — 라인 둘이다.
 * - 8601: 잔여가 있다(주문 100, 출하 20 → 잔여 80) — 편성 라인으로 승계된다
 * - 8602: **이미 다 나갔다**(주문 50, 출하 50 → 잔여 0) — 승계에서 빠진다(완료 조건 C2 인접 규칙)
 */
export const salesOrderDetailFixture: SalesOrderResponse = {
  salesOrderId: 8101,
  salesOrderNo: 'SAMPLE-SO-0001',
  customerId: 8201,
  shipToPartnerId: 8211,
  orderDate: '2026-08-10',
  statusCode: 'SAMPLE_SO_S_A',
  lines: [
    {
      salesOrderLineId: 8601,
      lineNo: 1,
      itemId: 8301,
      orderedQty: 100,
      uomId: 8401,
      shippedQty: 20,
    },
    {
      salesOrderLineId: 8602,
      lineNo: 2,
      itemId: 8302,
      orderedQty: 50,
      uomId: 8401,
      shippedQty: 50,
    },
  ],
};

export const createdShipmentRequestFixture: ShipmentRequestResponse = {
  shipmentRequestId: 8501,
  shipmentRequestNo: 'SAMPLE-SR-0001',
  salesOrderId: 8101,
  customerId: 8201,
  shipToPartnerId: 8211,
  requestedShipDate: '2026-08-20',
  statusCode: 'SAMPLE_SR_S_A',
  shippingInspectionStatusCode: 'NOT_REQUIRED',
  lines: [
    {
      shipmentRequestLineId: 9001,
      lineNo: 1,
      salesOrderLineId: 8601,
      itemId: 8301,
      requestedQty: 80,
      allocatedQty: 80,
      pickedQty: 0,
      shippedQty: 0,
      uomId: 8401,
      shippingInspectionRequired: false,
    },
  ],
};

export const partnerFixtures = [
  { partnerId: 8201, partnerCode: 'SAMPLE-CUST-01', partnerName: '합성 고객 가', isActive: true },
  { partnerId: 8202, partnerCode: 'SAMPLE-CUST-02', partnerName: '합성 고객 나', isActive: true },
  { partnerId: 8211, partnerCode: 'SAMPLE-SHIP-01', partnerName: '합성 납품처 가', isActive: true },
  { partnerId: 8212, partnerCode: 'SAMPLE-SHIP-02', partnerName: '합성 납품처 나', isActive: true },
];

export const itemFixtures = [
  { itemId: 8301, itemCode: 'SAMPLE-ITEM-01', itemName: '합성 품목 가', isActive: true },
  { itemId: 8302, itemCode: 'SAMPLE-ITEM-02', itemName: '합성 품목 나', isActive: true },
];

export const uomFixtures = [
  { uomId: 8401, uomCode: 'SAMPLE-UOM-EA', uomName: '개', isActive: true },
];

/** 가용 수량 조회 응답 — 품목 8301은 부족(가용 60 < 배정 80이 될 수 있다), 8302는 넉넉하다. */
export const availableBalanceFixtures: Record<number, { availableQty: number }[]> = {
  8301: [{ availableQty: 60 }],
  8302: [{ availableQty: 500 }],
};
