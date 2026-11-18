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
  itemCode: 'SAMPLE-ITEM-01',
  itemName: '합성 품목 가',
  requestedQty: 500,
  allocatedQty: 500,
  pickedQty: 500,
  shippedQty: 500,
  uomId: 9501,
  uomCode: 'SAMPLE-EA',
  salesOrderLine: null,
  shippingInspectionRequired: false,
  picks: [],
  /* 피처 010 — 초과·피킹 LOT 행. */
  overQty: 0,
  lots: [],
};

const BASE_SHIPMENT_REQUEST = {
  shipmentRequestId: 9001,
  shipmentRequestNo: 'SAMPLE-SR-0001',
  salesOrderNo: null,
  customerId: 9101,
  shipToPartnerId: 9111,
  requestedShipDate: '2026-08-13',
  statusCode: 'SAMPLE_STATUS_A',
  shipmentProgressCode: 'PICKED',
  shippingInspectionStatusCode: 'NOT_REQUIRED',
  lines: [BASE_LINE],
  /* 피처 010 — 지시서 코드·피킹 창고·교체·막힘·LOT 판정 요약·완료 출하. */
  code: 'SHPREQ:SAMPLE-SR-0001',
  pickingWarehouses: [],
  replacementCount: 0,
  completionBlockers: [],
  blockerSummary: {},
  lotJudgmentSummary: { notInspected: 0, accepted: 0, rejected: 0, held: 0 },
  completedShipment: null,
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

/** 피킹 LOT 행 하나(피처 010). 몫·판정·교체 근거를 덮어쓴다. */
export const pickedLot = (overrides: Record<string, unknown> = {}) => ({
  shipmentRequestLotId: 9801,
  lotId: 9901,
  lotNo: 'SAMPLE-LOT-0001',
  itemId: 9301,
  pickedQty: 40,
  uomId: 9501,
  statusCode: 'PICKED',
  managementCode: 'SAMPLE-PLT-0007',
  pickedAt: '2026-11-18T09:12:00+07:00',
  pickedWorker: { workerId: 9601, workerNo: 'SAMPLE-W-01', workerName: '합성 작업자' },
  shipmentId: null,
  portions: [
    {
      warehouseId: 9401,
      warehouseCode: 'SAMPLE-WH-A',
      warehouseName: '합성 완제품 창고 A',
      locationId: 9411,
      locationCode: 'SAMPLE-A-01-01',
      locationSystemRoleCode: null,
      qty: 40,
    },
  ],
  oqcLotStatus: 'ACCEPTED',
  oqcResult: null,
  replacement: null,
  ...overrides,
});

/**
 * 피킹 중인 지시서 — 목표 100 · 피킹 110(초과 10), LOT 셋(하나는 교체됨, 하나는 미검사),
 * 두 창고, 막는 이유 둘(미검사 · 수주 라인 취소).
 */
export const pickingRequest = () =>
  shipmentRequest({
    shipmentRequestId: 9010,
    shipmentRequestNo: 'SAMPLE-SR-0010',
    shipmentProgressCode: 'PICKED',
    code: 'SHPREQ:SAMPLE-SR-0010',
    replacementCount: 1,
    pickingWarehouses: [
      { warehouseId: 9401, warehouseCode: 'SAMPLE-WH-A', warehouseName: '합성 완제품 창고 A' },
      { warehouseId: 9402, warehouseCode: 'SAMPLE-WH-B', warehouseName: '합성 완제품 창고 B' },
    ],
    completionBlockers: [
      { code: 'NOT_INSPECTED', lotNo: 'SAMPLE-LOT-0004' },
      { code: 'SALES_ORDER_LINE_CANCELLED', lineNo: 1 },
    ],
    blockerSummary: { NOT_INSPECTED: 1, SALES_ORDER_LINE_CANCELLED: 1 },
    lotJudgmentSummary: { notInspected: 1, accepted: 1, rejected: 0, held: 0 },
    lines: [
      {
        ...BASE_LINE,
        shipmentRequestLineId: 9710,
        requestedQty: 100,
        allocatedQty: 100,
        pickedQty: 110,
        shippedQty: 0,
        shippingInspectionRequired: true,
        overQty: 10,
        lots: [
          pickedLot({
            pickedQty: 80,
            portions: [
              {
                warehouseId: 9401,
                warehouseCode: 'SAMPLE-WH-A',
                warehouseName: '합성 완제품 창고 A',
                locationId: 9411,
                locationCode: 'SAMPLE-A-01-01',
                locationSystemRoleCode: null,
                qty: 40,
              },
              {
                warehouseId: 9402,
                warehouseCode: 'SAMPLE-WH-B',
                warehouseName: '합성 완제품 창고 B',
                locationId: 9421,
                locationCode: 'SAMPLE-B-02-01',
                locationSystemRoleCode: null,
                qty: 40,
              },
            ],
          }),
          pickedLot({
            shipmentRequestLotId: 9803,
            lotId: 9903,
            lotNo: 'SAMPLE-LOT-0003',
            pickedQty: 30,
            statusCode: 'REPLACED',
            managementCode: null,
            oqcLotStatus: 'REJECTED',
            portions: [],
            replacement: {
              inspectionResultId: 9851,
              resultNo: 'SAMPLE-QR-0002',
              resultRound: 2,
              resultAt: '2026-11-18T10:35:00+07:00',
              judgment: 'REJECTED',
              nonconformanceId: 9861,
              nonconformanceNo: 'SAMPLE-NC-0003',
              replacedAt: '2026-11-18T10:42:00+07:00',
              worker: { workerId: 9601, workerNo: 'SAMPLE-W-01', workerName: '합성 작업자' },
            },
          }),
          pickedLot({
            shipmentRequestLotId: 9804,
            lotId: 9904,
            lotNo: 'SAMPLE-LOT-0004',
            pickedQty: 30,
            managementCode: null,
            oqcLotStatus: 'NOT_INSPECTED',
            portions: [
              {
                warehouseId: 9402,
                warehouseCode: 'SAMPLE-WH-B',
                warehouseName: '합성 완제품 창고 B',
                locationId: 9421,
                locationCode: 'SAMPLE-B-02-01',
                locationSystemRoleCode: null,
                qty: 30,
              },
            ],
          }),
        ],
      },
    ],
  });
