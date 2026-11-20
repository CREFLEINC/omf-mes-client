import type { Completion, CompletionResult, ShipmentRequestRow } from './model';

/**
 * P-04-07 시험 자료 — 시안(`P0407-After`)의 가상 지시서 SR-261118-001 을 계약 모양으로 옮겼다.
 * 라인 1 FG-A100 목표 100 피킹 110(LOT 3개), 라인 2 FG-B200 목표 50 피킹 50(LOT 1개). 시험 전용이다.
 */

type RequestLot = NonNullable<ShipmentRequestRow['lines']>[number]['lots'][number];

const requestLot = (
  shipmentRequestLotId: number,
  lotNo: string,
  pickedQty: number,
  statusCode: RequestLot['statusCode'] = 'PICKED',
): RequestLot => ({
  shipmentRequestLotId,
  lotId: shipmentRequestLotId,
  lotNo,
  itemId: 3001,
  pickedQty,
  uomId: 1,
  statusCode,
  managementCode: null,
  pickedAt: '2026-11-18T02:00:00Z',
  pickedWorker: null,
  shipmentId: null,
  portions: [],
  oqcLotStatus: statusCode === 'REPLACED' ? null : 'ACCEPTED',
  oqcResult: null,
  replacement: null,
});

const portion = (
  warehouseId: number,
  warehouseName: string,
  locationCode: string,
  qty: number,
  locationSystemRoleCode: string | null = null,
) => ({
  warehouseId,
  warehouseCode: `WH-${String(warehouseId)}`,
  warehouseName,
  locationId: warehouseId * 100 + qty,
  locationCode,
  locationSystemRoleCode,
  qty,
});

/* LOT 수량별 몫(한 창고 한 자리). 두 창고에 나뉜 0002 는 따로 적는다(시안 ③). */
const PORTIONS: Record<number, ReturnType<typeof portion>[]> = {
  40: [portion(11, '완제품 창고 A', 'A-01-01', 40)],
  30: [portion(11, '완제품 창고 A', 'A-01-01', 30)],
  50: [portion(12, '완제품 창고 B', 'B-02-01', 50)],
};

export const completion = (overrides: Partial<Completion> = {}): Completion => ({
  shipmentRequestId: 501,
  shipmentRequestNo: 'SR-261118-001',
  code: 'SHPREQ:SR-261118-001',
  versionNo: 3,
  requestedShipDate: '2026-11-18',
  customer: { partnerId: 71, partnerCode: 'C-GANA', partnerName: '가나전자' },
  shipTo: { partnerId: 72, partnerCode: 'C-GANA2', partnerName: '가나전자 2공장' },
  salesOrderNo: 'SO-T1',
  warehouses: [
    {
      warehouseId: 11,
      warehouseCode: 'WH-FG-A',
      warehouseName: '완제품 창고 A',
      lotCount: 3,
      qty: 110,
      /* 피처 012 — 창고의 공장. 이 화면은 C3 에서 읽는다. */
      plantId: 1,
      plantName: '1공장',
    },
    {
      warehouseId: 12,
      warehouseCode: 'WH-FG-B',
      warehouseName: '완제품 창고 B',
      lotCount: 1,
      qty: 50,
      plantId: 1,
      plantName: '1공장',
    },
  ],
  lines: [
    {
      shipmentRequestLineId: 601,
      lineNo: 1,
      itemId: 3001,
      itemCode: 'FG-A100',
      itemName: '센서 모듈 A',
      uomId: 1,
      uomCode: 'EA',
      targetQty: 100,
      pickedQty: 110,
      overQty: 10,
      shippedQty: 0,
      lotCount: 3,
      salesOrderLineId: 801,
      warehouse: null,
    },
    {
      shipmentRequestLineId: 602,
      lineNo: 2,
      itemId: 3002,
      itemCode: 'FG-B200',
      itemName: '브래킷 B',
      uomId: 1,
      uomCode: 'EA',
      targetQty: 50,
      pickedQty: 50,
      overQty: 0,
      shippedQty: 0,
      lotCount: 1,
      salesOrderLineId: 802,
      warehouse: null,
    },
  ],
  lots: [
    {
      shipmentRequestLotId: 701,
      lineNo: 1,
      lotId: 901,
      lotNo: 'P2611-0001',
      itemId: 3001,
      qty: 40,
      uomId: 1,
      uomCode: 'EA',
      portions: PORTIONS[40] ?? [],
      statusCode: 'PICKED',
      oqcLotStatus: 'ACCEPTED',
      managementCode: 'GN-PLT-0007',
    },
    {
      shipmentRequestLotId: 702,
      lineNo: 1,
      lotId: 902,
      lotNo: 'P2611-0002',
      itemId: 3001,
      qty: 40,
      uomId: 1,
      uomCode: 'EA',
      portions: [
        portion(11, '완제품 창고 A', 'A-01-02', 20),
        portion(12, '완제품 창고 B', 'B-02-01', 20),
      ],
      statusCode: 'PICKED',
      oqcLotStatus: 'ACCEPTED',
      managementCode: 'GN-PLT-0008',
    },
    {
      shipmentRequestLotId: 704,
      lineNo: 1,
      lotId: 904,
      lotNo: 'P2611-0004',
      itemId: 3001,
      qty: 30,
      uomId: 1,
      uomCode: 'EA',
      portions: PORTIONS[30] ?? [],
      statusCode: 'PICKED',
      oqcLotStatus: 'ACCEPTED',
      managementCode: null,
    },
    {
      shipmentRequestLotId: 711,
      lineNo: 2,
      lotId: 911,
      lotNo: 'P2611-0101',
      itemId: 3002,
      qty: 50,
      uomId: 1,
      uomCode: 'EA',
      portions: PORTIONS[50] ?? [],
      statusCode: 'PICKED',
      oqcLotStatus: 'NOT_REQUIRED',
      managementCode: null,
    },
  ],
  replacedLots: [],
  blockers: [],
  completedShipment: null,
  /* 피처 012 — 지시서 사업부. 이 화면은 C3 에서 읽는다. */
  businessUnit: null,
  ...overrides,
});

/** 막힌 같은 지시서 — 라인 2 미피킹, 0002 미검사, 0003 불합격(시안 ④). */
export const blockedCompletion = (): Completion => {
  const base = completion();

  return completion({
    lines: base.lines.map((line) =>
      line.lineNo === 2 ? { ...line, pickedQty: 0, overQty: 0, lotCount: 0 } : line,
    ),
    lots: [
      { ...(base.lots[0] as Completion['lots'][number]) },
      { ...(base.lots[1] as Completion['lots'][number]), oqcLotStatus: 'NOT_INSPECTED' },
      {
        ...(base.lots[2] as Completion['lots'][number]),
        lotNo: 'P2611-0003',
        oqcLotStatus: 'REJECTED',
      },
    ],
    blockers: [
      { code: 'PICKING_SHORT', lineNo: 2 },
      { code: 'NOT_INSPECTED', lotNo: 'P2611-0002' },
      { code: 'REJECTED', lotNo: 'P2611-0003' },
    ],
  });
};

export const completedShipment = {
  shipmentId: 1001,
  shipmentNo: 'SH-261118-001',
  completedAt: '2026-11-18T07:32:00Z',
  completedTerminal: { terminalId: 61, terminalCode: 'POP-출하-01' },
  completedWorker: { workerId: 71, workerNo: 'W-0102', workerName: '김작업' },
};

export const completionResult = (): CompletionResult => ({
  ...completedShipment,
  completion: completion({ completedShipment, blockers: [{ code: 'ALREADY_COMPLETED' }] }),
  /* 피처 012 — 창고마다 출고 전표. 이 화면은 C3 에서 읽는다. */
  goodsIssues: [],
});

export const requestRow = (overrides: Partial<ShipmentRequestRow> = {}): ShipmentRequestRow => ({
  fulfillmentPlantId: 1,
  shipmentRequestId: 501,
  shipmentRequestNo: 'SR-261118-001',
  salesOrderId: 41,
  salesOrderNo: 'SO-T1',
  customerId: 71,
  shipToPartnerId: 72,
  customer: { partnerId: 71, partnerCode: 'C-GANA', partnerName: '가나전자(행)' },
  shipTo: { partnerId: 72, partnerCode: 'S-GANA2', partnerName: '가나전자 2공장' },
  requestedShipDate: '2026-11-18',
  statusCode: 'OPEN',
  shippingInspectionStatusCode: 'PASSED',
  shipmentProgressCode: 'PICKED',
  lines: [
    {
      shipmentRequestLineId: 601,
      lineNo: 1,
      itemId: 3001,
      itemCode: 'FG-A100',
      itemName: '센서 모듈 A',
      requestedQty: 100,
      allocatedQty: 100,
      pickedQty: 110,
      shippedQty: 0,
      uomId: 1,
      uomCode: 'EA',
      salesOrderLine: null,
      shippingInspectionRequired: true,
      picks: [],
      warehouse: null,
      overQty: 10,
      lots: [
        requestLot(701, 'P2611-0001', 40),
        requestLot(702, 'P2611-0002', 40),
        requestLot(703, 'P2611-0003', 30, 'REPLACED'),
        requestLot(704, 'P2611-0004', 30),
      ],
    },
    {
      shipmentRequestLineId: 602,
      lineNo: 2,
      itemId: 3002,
      itemCode: 'FG-B200',
      itemName: '브래킷 B',
      requestedQty: 50,
      allocatedQty: 50,
      pickedQty: 50,
      shippedQty: 0,
      uomId: 1,
      uomCode: 'EA',
      salesOrderLine: null,
      shippingInspectionRequired: false,
      picks: [],
      warehouse: null,
      overQty: 0,
      lots: [requestLot(711, 'P2611-0101', 50)],
    },
  ],
  versionNo: 3,
  code: 'SHPREQ:SR-261118-001',
  pickingWarehouses: [],
  replacementCount: 1,
  completionBlockers: [],
  blockerSummary: {},
  lotJudgmentSummary: { notInspected: 0, accepted: 4, rejected: 0, held: 0 },
  completedShipment: null,
  /* 피처 012 — 사업부·줄 창고 요약·ERP 송신·출하. */
  businessUnitId: null,
  businessUnit: null,
  warehouses: [],
  erpSendStatus: null,
  shipments: [],
  ...overrides,
});
