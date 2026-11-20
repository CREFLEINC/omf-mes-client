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
    lines: [],
  },
  {
    salesOrderId: 8102,
    salesOrderNo: 'SAMPLE-SO-0002',
    customerId: 8202,
    shipToPartnerId: 8212,
    orderDate: '2026-08-11',
    statusCode: 'SAMPLE_SO_S_B',
    lines: [],
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
      /* 피처 012 FR-006 — ERP 창고 코드는 참고로만 보인다. */
      erpStorageLocationCode: 'SAMPLE-ERP-WH',
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
  salesOrderNo: null,
  customerId: 8201,
  shipToPartnerId: 8211,
  customer: null,
  shipTo: null,
  requestedShipDate: '2026-08-20',
  statusCode: 'SAMPLE_SR_S_A',
  shipmentProgressCode: 'NOT_ALLOCATED',
  shippingInspectionStatusCode: 'NOT_REQUIRED',
  lines: [
    {
      shipmentRequestLineId: 9001,
      lineNo: 1,
      salesOrderLineId: 8601,
      itemId: 8301,
      /* 피처 010 시안 보완 — 품목·단위·수주 라인 표시 칸. 이 화면은 읽지 않는다. */
      itemCode: 'SAMPLE-ITEM-01',
      itemName: '합성 품목 가',
      uomCode: 'SAMPLE-EA',
      salesOrderLine: null,
      requestedQty: 80,
      allocatedQty: 80,
      pickedQty: 0,
      shippedQty: 0,
      uomId: 8401,
      shippingInspectionRequired: false,
      /* client#601 1-5 — 집은 LOT 신설. 이 화면은 아직 이 값을 읽지 않는다. */
      picks: [],
      /* 피처 010 — 초과·피킹 LOT 행. 이 화면은 아직 이 값을 읽지 않는다. */
      overQty: 0,
      lots: [],
      /* 피처 012 — 줄 출고 창고. 이 화면은 응답의 이 값을 읽지 않는다. */
      warehouse: null,
    },
  ],
  /* 피처 010 — 지시서 코드·피킹 창고·교체·막힘·판정 요약·완료 출하. 이 화면은 아직 읽지 않는다. */
  code: 'SHPREQ:SAMPLE-SR-0001',
  pickingWarehouses: [],
  replacementCount: 0,
  completionBlockers: [],
  blockerSummary: {},
  lotJudgmentSummary: { notInspected: 0, accepted: 0, rejected: 0, held: 0 },
  completedShipment: null,
  /* 피처 012 — 사업부·줄 창고 요약·ERP 송신·출하. 이 화면은 읽지 않는다. */
  businessUnitId: 7001,
  businessUnit: { businessUnitId: 7001, businessUnitCode: 'SAMPLE-BU-01', businessUnitName: '합성 사업부 가' },
  warehouses: [],
  erpSendStatus: null,
  shipments: [],
};

export const partnerFixtures = [
  { partnerId: 8201, partnerCode: 'SAMPLE-CUST-01', partnerName: '합성 고객 가', isActive: true },
  { partnerId: 8202, partnerCode: 'SAMPLE-CUST-02', partnerName: '합성 고객 나', isActive: true },
  { partnerId: 8211, partnerCode: 'SAMPLE-SHIP-01', partnerName: '합성 납품처 가', isActive: true },
  { partnerId: 8212, partnerCode: 'SAMPLE-SHIP-02', partnerName: '합성 납품처 나', isActive: true },
];

/**
 * 품목 — **선택 팝업의 결과이자 라인 이름 풀이의 원천**이다.
 *
 * ⚠ `itemTypeCode`·`baseUomId` 는 계약의 필수 값이다. 빠뜨리면 스텁이 서버보다 너그러워져,
 *   팝업이 라인에 채우는 기준 단위가 비어도 시험이 통과한다.
 */
export const itemFixtures = [
  {
    itemId: 8301,
    itemCode: 'SAMPLE-ITEM-01',
    itemName: '합성 품목 가',
    itemTypeCode: 'FINISHED',
    baseUomId: 8401,
    isActive: true,
  },
  {
    itemId: 8302,
    itemCode: 'SAMPLE-ITEM-02',
    itemName: '합성 품목 나',
    itemTypeCode: 'FINISHED',
    baseUomId: 8401,
    isActive: true,
  },
];

export const uomFixtures = [
  { uomId: 8401, uomCode: 'SAMPLE-UOM-EA', uomName: '개', isActive: true },
];

/** 가용 수량 조회 응답 — 품목 8301은 부족(가용 60 < 배정 80이 될 수 있다), 8302는 넉넉하다. */
export const availableBalanceFixtures: Record<number, { availableQty: number }[]> = {
  8301: [{ availableQty: 60 }],
  8302: [{ availableQty: 500 }],
};

/**
 * 피처 012 — 사업부·공장·창고(합성값). quickstart 모양: 사업부 X(1공장: 창고 A·C·불량창고 D, 2공장: 창고 B),
 * 사업부 Y(3공장: 창고 Y).
 */
export const businessUnitFixtures = [
  { businessUnitId: 7001, legalEntityId: 1, businessUnitCode: 'SAMPLE-BU-X', businessUnitName: '합성 사업부 X', isActive: true },
  { businessUnitId: 7002, legalEntityId: 1, businessUnitCode: 'SAMPLE-BU-Y', businessUnitName: '합성 사업부 Y', isActive: true },
  { businessUnitId: 7003, legalEntityId: 1, businessUnitCode: 'SAMPLE-BU-Z', businessUnitName: '합성 사업부 Z', isActive: false },
];

export const plantFixtures = [
  { plantId: 7101, legalEntityId: 1, businessUnitId: 7001, plantCode: 'SAMPLE-P1', plantName: '합성 1공장', isActive: true },
  { plantId: 7102, legalEntityId: 1, businessUnitId: 7001, plantCode: 'SAMPLE-P2', plantName: '합성 2공장', isActive: true },
  { plantId: 7103, legalEntityId: 1, businessUnitId: 7002, plantCode: 'SAMPLE-P3', plantName: '합성 3공장', isActive: true },
];

const warehouse = (
  warehouseId: number,
  warehouseName: string,
  plantId: number,
  businessUnitId: number,
  patch: { isDefect?: boolean; isActive?: boolean } = {},
) => ({
  warehouseId,
  plantId,
  businessUnitId,
  warehouseCode: `SAMPLE-WH-${String(warehouseId)}`,
  warehouseName,
  warehouseTypeCode: 'PRODUCT',
  isExternal: false,
  isDefect: patch.isDefect ?? false,
  isActive: patch.isActive ?? true,
  locationPrefix: '',
});

export const warehouseFixtures = [
  warehouse(9101, '합성 창고 A', 7101, 7001),
  warehouse(9103, '합성 창고 C', 7101, 7001),
  warehouse(9104, '합성 불량창고 D', 7101, 7001, { isDefect: true }),
  warehouse(9102, '합성 창고 B', 7102, 7001),
  warehouse(9105, '합성 창고 Y', 7103, 7002),
];
