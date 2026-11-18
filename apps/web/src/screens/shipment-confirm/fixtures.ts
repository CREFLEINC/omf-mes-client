import { createStubFetch, jsonResponse, type StubFetch } from '../../test/api-harness';

/**
 * W-04-12 출하 내역의 목 응답.
 *
 * ⚠ 값은 전부 **지어낸 합성값**이다 — 실 사번·품목코드·LOT 번호를 쓰지 않는다(공개 저장소 경계).
 */

type ErpSendStatus =
  'NOT_QUEUED' | 'NOT_SENT_NO_SALES_ORDER' | 'CANCELLED' | 'SEND_ERROR' | 'PENDING' | 'SENT';

export interface ShipmentStub {
  shipmentId: number;
  shipmentNo: string;
  statusCode: 'UNCONFIRMED' | 'CONFIRMED' | 'CANCELLED';
  /** POP 출하 완료(피처 010)로 생긴 출하인가 — 완료 단말·작업자가 실린다. */
  completedByPop?: boolean;
  expedited?: boolean;
  erpSendStatus: ErpSendStatus;
  cancelRequestPending?: boolean;
  warehouseNames: string[];
  shippedAt?: string;
  erpDeliveryNo?: string;
}

export interface ConfirmStubOptions {
  shipments?: ShipmentStub[];
  /** 확정 응답. 없으면 성공. */
  confirmResponse?: (shipmentId: number) => Response | undefined;
  /** ETag 를 안 내린다 — 토큰이 없는 갈래. */
  omitEtag?: boolean;
  /** 목록 조회를 실패시킨다. */
  listStatus?: number;
  /** 취소 요청 응답을 갈아 끼운다. */
  cancelResponse?: () => Response;
}

let sent: Request[] = [];

export const requestsSent = (): Request[] => sent;

export const DEFAULT_SHIPMENTS: ShipmentStub[] = [
  {
    shipmentId: 101,
    shipmentNo: 'SYN-SH-101',
    statusCode: 'CONFIRMED',
    completedByPop: true,
    erpSendStatus: 'PENDING',
    warehouseNames: ['합성 완제품 창고 A', '합성 완제품 창고 B'],
    shippedAt: '2026-11-18T14:32:00+07:00',
  },
  {
    shipmentId: 102,
    shipmentNo: 'SYN-SH-102',
    statusCode: 'CONFIRMED',
    completedByPop: true,
    erpSendStatus: 'NOT_SENT_NO_SALES_ORDER',
    warehouseNames: ['합성 완제품 창고 B'],
    shippedAt: '2026-11-18T15:10:00+07:00',
  },
  {
    shipmentId: 103,
    shipmentNo: 'SYN-SH-103',
    statusCode: 'CONFIRMED',
    completedByPop: true,
    erpSendStatus: 'SENT',
    erpDeliveryNo: 'SYN-DN-0381',
    warehouseNames: ['합성 완제품 창고 A'],
    shippedAt: '2026-11-16T09:30:00+07:00',
  },
  {
    shipmentId: 104,
    shipmentNo: 'SYN-SH-104',
    statusCode: 'CONFIRMED',
    completedByPop: true,
    erpSendStatus: 'PENDING',
    cancelRequestPending: true,
    warehouseNames: ['합성 완제품 창고 A'],
    shippedAt: '2026-11-17T10:12:00+07:00',
  },
  {
    shipmentId: 105,
    shipmentNo: 'SYN-SH-105',
    statusCode: 'UNCONFIRMED',
    erpSendStatus: 'NOT_QUEUED',
    warehouseNames: ['합성 완제품 창고 A'],
    shippedAt: '2026-11-15T13:20:00+07:00',
  },
  {
    shipmentId: 106,
    shipmentNo: 'SYN-SH-106',
    statusCode: 'UNCONFIRMED',
    expedited: true,
    erpSendStatus: 'NOT_QUEUED',
    warehouseNames: ['합성 완제품 창고 A'],
    shippedAt: '2026-11-18T11:40:00+07:00',
  },
  {
    shipmentId: 107,
    shipmentNo: 'SYN-SH-107',
    statusCode: 'CONFIRMED',
    completedByPop: true,
    erpSendStatus: 'SEND_ERROR',
    warehouseNames: ['합성 완제품 창고 A'],
    shippedAt: '2026-11-17T16:45:00+07:00',
  },
  {
    shipmentId: 108,
    shipmentNo: 'SYN-SH-108',
    statusCode: 'CANCELLED',
    completedByPop: true,
    erpSendStatus: 'CANCELLED',
    warehouseNames: ['합성 완제품 창고 B'],
    shippedAt: '2026-11-16T15:02:00+07:00',
  },
];

const WAREHOUSE_IDS: Record<string, number> = {
  '합성 완제품 창고 A': 2001,
  '합성 완제품 창고 B': 2002,
};

const warehouseOf = (name: string) => ({
  warehouseId: WAREHOUSE_IDS[name] ?? 2999,
  warehouseCode: name.endsWith('A') ? 'SYN-WH-A' : 'SYN-WH-B',
  warehouseName: name,
});

/** 라인 하나 · LOT 둘. 첫 LOT 은 두 창고의 잔액 행에서 나가 배분이 둘이다. */
const linesOf = (stub: ShipmentStub) => {
  const [first, second] = stub.warehouseNames;
  const firstId = WAREHOUSE_IDS[first ?? ''] ?? 2999;
  const secondId = WAREHOUSE_IDS[second ?? first ?? ''] ?? firstId;
  const allocation = (
    id: number,
    lotId: number,
    lotNo: string,
    warehouseId: number,
    qty: number,
    managementCode: string | null,
  ) => ({
    shipmentLotAllocationId: id,
    shipmentId: stub.shipmentId,
    shipmentLineId: stub.shipmentId * 10,
    itemId: 5001,
    itemCode: 'SYN-FG-A100',
    lotId,
    lotNo,
    warehouseId,
    allocatedQty: qty,
    uomId: 7001,
    oqcPassed: true,
    packedQty: 0,
    managementCode,
  });

  return [
    {
      shipmentLineId: stub.shipmentId * 10,
      lineNo: 1,
      shipmentRequestLineId: 4001,
      itemId: 5001,
      shippedQty: 110,
      uomId: 7001,
      allocations: [
        allocation(1, 9001, 'SYN-LOT-0001', firstId, 40, 'SYN-PLT-0007'),
        allocation(2, 9002, 'SYN-LOT-0002', firstId, 20, null),
        allocation(3, 9002, 'SYN-LOT-0002', secondId, 50, null),
      ],
    },
  ];
};

const shipmentBody = (stub: ShipmentStub) => ({
  shipmentId: stub.shipmentId,
  shipmentNo: stub.shipmentNo,
  shipmentRequestId: 3001,
  warehouseId:
    stub.completedByPop === true ? null : (WAREHOUSE_IDS[stub.warehouseNames[0] ?? ''] ?? 2999),
  statusCode: stub.statusCode,
  expedited: stub.expedited ?? false,
  ...(stub.shippedAt === undefined ? {} : { shippedAt: stub.shippedAt }),
  ...(stub.erpDeliveryNo === undefined ? {} : { erpDeliveryNo: stub.erpDeliveryNo }),
  erpSendStatus: stub.erpSendStatus,
  cancelRequestPending: stub.cancelRequestPending ?? false,
  completedTerminal:
    stub.completedByPop === true ? { terminalId: 61, terminalCode: 'SYN-POP-01' } : null,
  completedWorker:
    stub.completedByPop === true
      ? { workerId: 71, workerNo: 'SYN-W-0102', workerName: '합성 작업자' }
      : null,
  warehouses: stub.warehouseNames.map(warehouseOf),
  lines: linesOf(stub),
});

/** 그 출하를 만든 지시서 — 목표·OQC 판정·위치 몫·교체 이력을 여기서 읽는다. */
const shipmentRequestBody = () => ({
  shipmentRequestId: 3001,
  shipmentRequestNo: 'SYN-SR-3001',
  customerId: 8201,
  shipToPartnerId: 8211,
  requestedShipDate: '2026-11-18',
  statusCode: 'SYN',
  shipmentProgressCode: 'SHIPPED',
  shippingInspectionStatusCode: 'PASSED',
  code: 'SHPREQ:SYN-SR-3001',
  pickingWarehouses: [],
  replacementCount: 1,
  completionBlockers: [],
  blockerSummary: {},
  lotJudgmentSummary: { notInspected: 0, accepted: 2, rejected: 0, held: 0 },
  completedShipment: null,
  lines: [
    {
      shipmentRequestLineId: 4001,
      lineNo: 1,
      itemId: 5001,
      requestedQty: 100,
      allocatedQty: 100,
      pickedQty: 110,
      shippedQty: 110,
      uomId: 7001,
      shippingInspectionRequired: true,
      picks: [],
      overQty: 10,
      lots: [
        {
          shipmentRequestLotId: 1,
          lotId: 9001,
          lotNo: 'SYN-LOT-0001',
          itemId: 5001,
          pickedQty: 40,
          uomId: 7001,
          statusCode: 'SHIPPED',
          managementCode: 'SYN-PLT-0007',
          pickedAt: '2026-11-18T09:00:00+07:00',
          pickedWorker: null,
          shipmentId: 101,
          portions: [
            {
              warehouseId: 2001,
              warehouseCode: 'SYN-WH-A',
              warehouseName: '합성 완제품 창고 A',
              locationId: 1,
              locationCode: 'SYN-A-01-01',
              qty: 40,
            },
          ],
          oqcLotStatus: 'ACCEPTED',
          replacement: null,
        },
        {
          shipmentRequestLotId: 3,
          lotId: 9003,
          lotNo: 'SYN-LOT-0003',
          itemId: 5001,
          pickedQty: 30,
          uomId: 7001,
          statusCode: 'REPLACED',
          managementCode: null,
          pickedAt: '2026-11-18T09:10:00+07:00',
          pickedWorker: null,
          shipmentId: null,
          portions: [],
          oqcLotStatus: 'REJECTED',
          replacement: {
            inspectionResultId: 1,
            resultNo: 'SYN-QR-1',
            resultAt: '2026-11-18T10:00:00+07:00',
            judgment: 'REJECTED',
            nonconformanceId: 1,
            nonconformanceNo: 'SYN-NC-0004',
            replacedAt: '2026-11-18T11:05:00+07:00',
            worker: null,
          },
        },
      ],
    },
  ],
});

export const confirmStub = (options: ConfirmStubOptions = {}): StubFetch => {
  sent = [];
  const shipments = options.shipments ?? DEFAULT_SHIPMENTS;

  const routes = [
    {
      match: (request: Request) =>
        new URL(request.url).pathname === '/logistics/shipments' && request.method === 'GET',
      respond: (request: Request) => {
        if (options.listStatus !== undefined)
          return new Response('', { status: options.listStatus });

        const erp = new URL(request.url).searchParams.get('erpSendStatus');
        const items = shipments.filter((one) => erp === null || one.erpSendStatus === erp);
        return jsonResponse({
          items: items.map(shipmentBody),
          page: { page: 1, size: 50, total: items.length },
        });
      },
    },
    {
      match: (request: Request) =>
        /^\/logistics\/shipments\/\d+$/.test(new URL(request.url).pathname) &&
        request.method === 'GET',
      respond: (request: Request) => {
        const id = Number(new URL(request.url).pathname.split('/').pop());
        const stub = shipments.find((one) => one.shipmentId === id) ?? DEFAULT_SHIPMENTS[0]!;
        return jsonResponse(shipmentBody(stub), {
          headers: options.omitEtag === true ? {} : { ETag: `"v${String(id)}"` },
        });
      },
    },
    {
      match: (request: Request) =>
        /^\/logistics\/shipment-requests\/\d+$/.test(new URL(request.url).pathname) &&
        request.method === 'GET',
      respond: () => jsonResponse(shipmentRequestBody()),
    },
    {
      match: (request: Request) =>
        new URL(request.url).pathname.endsWith(':confirm') && request.method === 'POST',
      respond: (request: Request) => {
        const id = Number(new URL(request.url).pathname.split('/')[3]?.split(':')[0]);
        return options.confirmResponse?.(id) ?? jsonResponse({ shipmentId: id });
      },
    },
    {
      match: (request: Request) =>
        new URL(request.url).pathname.endsWith(':request-cancel') && request.method === 'POST',
      respond: () => options.cancelResponse?.() ?? jsonResponse({ approvalRequestId: 9001 }),
    },
  ];

  const stub = createStubFetch(routes);

  return async (request: Request) => {
    sent.push(request.clone());
    return stub(request);
  };
};

/** 나간 확정 요청들. */
export const confirmRequests = (): Request[] =>
  sent.filter((request) => request.method === 'POST' && request.url.endsWith(':confirm'));

/** 나간 취소 요청들. */
export const cancelRequests = (): Request[] =>
  sent.filter((request) => request.method === 'POST' && request.url.endsWith(':request-cancel'));

/** 나간 목록 조회들. */
export const listRequests = (): URL[] =>
  sent
    .filter(
      (request) =>
        request.method === 'GET' && new URL(request.url).pathname === '/logistics/shipments',
    )
    .map((request) => new URL(request.url));
