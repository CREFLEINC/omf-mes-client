import { createStubFetch, jsonResponse, type StubRoute } from '../../test/api-harness';
import type { Candidate, WorkRecordDetail, WorkRecordLot } from './forward-contract';

/*
 * 시험 받침 — 공장 · 공급사 · 품목 · P/O · LOT 은 모두 지어낸 값이다(시험 전용).
 * 합성 캡(SYN-CAP, EA) 입하 LOT 넷:
 *  - 9001 마감 승인 대기 · 자동 마감 — 0031/10: 300 · 0012/10: 1,575(초과 75) · P/O 없음 175, 입하 2,050 · 입고 2,050.
 *  - 9002 진행 중 — 입하 완료, IQC 진행 중 자재 관리 LOT 2개.
 *  - 9003 진행 중 — 입하 중(매칭 없음).
 *  - 9004 최종 마감.
 */
export const PLANT = {
  plantId: 8401,
  businessUnitId: 8301,
  legalEntityId: 8201,
  plantCode: 'G1',
  plantName: '합성 1공장',
  timezoneCode: 'Asia/Ho_Chi_Minh',
  isActive: true,
};

export const lotRow = (inboundLotId: number, over: Partial<WorkRecordLot> = {}): WorkRecordLot => ({
  inboundLotId,
  inboundLotNo: `IL-20261110-${String(inboundLotId).slice(-4)}`,
  plantId: 8401,
  supplierId: 8201,
  supplierCode: 'SYN-S1',
  supplierName: '합성 공급사 가',
  itemId: 601,
  itemCode: 'SYN-CAP',
  itemName: '합성 캡',
  uomCode: 'EA',
  statusCode: 'RECEIVED',
  receivingDate: '2026-11-10',
  inboundReceiptNo: 'IR-SYN-0001',
  lotCount: 3,
  receivedQty: 2050,
  goodsReceivedQty: 2050,
  unallocatedQty: 0,
  iqc: null,
  inspectionRequired: true,
  iqcDefaultSkipApplies: false,
  firstRegisteredAt: '2026-11-10T01:00:00Z',
  receivedClosedAt: '2026-11-10T17:00:00Z',
  closedAutomatically: false,
  finalizedAt: null,
  reopenable: false,
  reopenReasonCode: null,
  reopenBlockerCode: null,
  openInboundLotNo: null,
  reopened: false,
  finalizable: false,
  erpSendModeCode: 'ON_FINALIZE',
  versionNo: 4,
  poAllocations: [],
  finalizedByName: null,
  finalizeBlockers: [],
  lotProgress: { received: 3, inIqc: 0, inDisposition: 0, disposed: 0, returned: 0 },
  ...over,
});

export const READY = lotRow(9001, {
  finalizable: true,
  closedAutomatically: true,
  unallocatedQty: 175,
  poAllocations: [
    {
      purchaseOrderLineId: 501,
      purchaseOrderNo: 'PO-SYN-0031',
      lineNo: 10,
      orderDate: '2026-10-28',
      erpPurchaseOrderNo: null,
      qty: 300,
      excessQty: 0,
    },
    {
      purchaseOrderLineId: 502,
      purchaseOrderNo: 'PO-SYN-0012',
      lineNo: 10,
      orderDate: '2026-11-05',
      erpPurchaseOrderNo: null,
      qty: 1575,
      excessQty: 75,
    },
  ],
});

export const IQC_PENDING = lotRow(9002, {
  lotCount: 2,
  receivedQty: 50,
  goodsReceivedQty: 0,
  poAllocations: [
    {
      purchaseOrderLineId: 511,
      purchaseOrderNo: 'PO-SYN-0044',
      lineNo: 20,
      orderDate: '2026-11-01',
      erpPurchaseOrderNo: null,
      qty: 50,
      excessQty: 0,
    },
  ],
  finalizeBlockers: [{ code: 'IQC_IN_PROGRESS', lotNos: ['SYN-LOT-0001', 'SYN-LOT-0002'] }],
});

export const RECEIVING = lotRow(9003, {
  statusCode: 'RECEIVING',
  receivedClosedAt: null,
  receivedQty: 3000,
  goodsReceivedQty: 0,
  unallocatedQty: 3000,
});

export const FINAL = lotRow(9004, {
  statusCode: 'FINALIZED',
  lotCount: 2,
  receivedQty: 2000,
  finalizedAt: '2026-11-11T02:20:00Z',
  finalizedByName: '합성 관리자 나',
  goodsReceivedQty: 2000,
  poAllocations: [
    {
      purchaseOrderLineId: 521,
      purchaseOrderNo: 'PO-SYN-0008',
      lineNo: 10,
      orderDate: '2026-10-15',
      erpPurchaseOrderNo: 'EPO-SYN-0008',
      qty: 2000,
      excessQty: 0,
    },
  ],
});

export const materialLot = (
  lotId: number,
  over: Partial<WorkRecordDetail['lots'][number]> = {},
) => ({
  lotId,
  lotNo: `SYN-CAP|1000|261110|SYN-S1|${String(lotId).padStart(4, '0')}`,
  lotQty: 1000,
  package: null,
  supplierLotNo: null,
  lifecycleStatusCode: 'ACTIVE' as const,
  statusCode: 'NORMAL',
  registeredAt: '2026-11-10T01:00:00Z',
  fromSupplierLabel: false,
  goodsReceived: true,
  dispositionStatusCode: null,
  ...over,
});

export const detailOf = (
  row: WorkRecordLot,
  over: Partial<WorkRecordDetail> = {},
): WorkRecordDetail => ({
  ...row,
  lots:
    row.inboundLotId === 9002
      ? [
          materialLot(1, { lotQty: 25, statusCode: 'INSPECTION_PENDING', goodsReceived: false }),
          materialLot(2, { lotQty: 25, statusCode: 'INSPECTION_PENDING', goodsReceived: false }),
        ]
      : [materialLot(1), materialLot(2), materialLot(3, { lotQty: 50 })],
  events: [],
  finalizeBlockers: row.finalizeBlockers ?? [],
  ...over,
});

export const candidate = (
  purchaseOrderLineId: number,
  over: Partial<Candidate> = {},
): Candidate => ({
  purchaseOrderLineId,
  purchaseOrderId: purchaseOrderLineId + 1000,
  purchaseOrderNo: 'PO-SYN-0000',
  lineNo: 10,
  orderDate: '2026-11-01',
  erpPurchaseOrderNo: null,
  orderedQty: 0,
  receivedQty: 0,
  toleranceQty: 0,
  thisLotQty: 0,
  maxQty: 0,
  openedAfterReceiptClose: false,
  ...over,
});

/** 9001 의 매칭 후보 — 0031/10(잔량 다 씀) · 0012/10(초과 75, 허용치 100) · 마감 뒤 열린 초과분 P/O 0077/10. */
export const READY_CANDIDATES: Candidate[] = [
  candidate(501, {
    purchaseOrderNo: 'PO-SYN-0031',
    orderDate: '2026-10-28',
    orderedQty: 300,
    receivedQty: 300,
    thisLotQty: 300,
    maxQty: 300,
  }),
  candidate(502, {
    purchaseOrderNo: 'PO-SYN-0012',
    orderDate: '2026-11-05',
    orderedQty: 1500,
    receivedQty: 1575,
    toleranceQty: 100,
    thisLotQty: 1575,
    maxQty: 1600,
  }),
  candidate(503, {
    purchaseOrderNo: 'PO-SYN-0077',
    orderDate: '2026-11-11',
    orderedQty: 500,
    receivedQty: 0,
    thisLotQty: 0,
    maxQty: 500,
    openedAfterReceiptClose: true,
  }),
];

export interface Recorded {
  method: string;
  url: URL;
  body: unknown;
}

const pathOf = (request: Request): string => new URL(request.url).pathname;
const page = <T>(items: T[]) => ({ items, page: { page: 1, size: 200, total: items.length } });

/** 보기 조건으로 목록을 고른다 — 화면이 묻는 조건을 그대로 재연한다. */
const listFor = (url: URL, rows: readonly WorkRecordLot[]): WorkRecordLot[] => {
  if (url.searchParams.get('erpSendModeCode') !== 'ON_FINALIZE') return [];
  if (url.searchParams.get('finalizable') === 'true')
    return rows.filter((row) => row.finalizable && row.statusCode === 'RECEIVED');
  const statuses = url.searchParams.getAll('statusCode');
  if (statuses.includes('FINALIZED')) return rows.filter((row) => row.statusCode === 'FINALIZED');
  return rows.filter((row) => row.statusCode !== 'FINALIZED' && !row.finalizable);
};

export interface StubOptions {
  rows?: WorkRecordLot[];
  details?: Record<number, WorkRecordDetail>;
  candidates?: () => Candidate[];
  put?: (body: unknown) => Response;
  finalize?: (body: unknown) => Response;
}

/** W-01-16 이 부르는 길을 모두 받는 스텁 — 쓰기 본문을 기록한다. */
export const workRecordStub = (options: StubOptions = {}) => {
  const recorded: Recorded[] = [];
  const rows = options.rows ?? [READY, IQC_PENDING, RECEIVING, FINAL];
  const details: Record<number, WorkRecordDetail> =
    options.details ??
    Object.fromEntries(rows.map((row) => [row.inboundLotId, detailOf(row)] as const));
  const record = async (request: Request): Promise<unknown> => {
    const text = request.method === 'GET' ? '' : await request.clone().text();
    const body = text === '' ? null : (JSON.parse(text) as unknown);
    recorded.push({ method: request.method, url: new URL(request.url), body });
    return body;
  };
  const routes: StubRoute[] = [
    {
      match: (r) => r.method === 'GET' && pathOf(r) === '/mdm/plants',
      respond: () => jsonResponse(page([PLANT])),
    },
    {
      match: (r) => r.method === 'GET' && pathOf(r) === '/logistics/inbound-lots',
      respond: async (r) => {
        await record(r);
        return jsonResponse(page(listFor(new URL(r.url), rows)));
      },
    },
    {
      match: (r) =>
        r.method === 'GET' &&
        /^\/logistics\/inbound-lots\/\d+\/allocation-candidates$/.test(pathOf(r)),
      respond: async (r) => {
        await record(r);
        return jsonResponse({ items: (options.candidates ?? (() => READY_CANDIDATES))() });
      },
    },
    {
      match: (r) => r.method === 'GET' && /^\/logistics\/inbound-lots\/\d+$/.test(pathOf(r)),
      respond: async (r) => {
        await record(r);
        const id = Number(pathOf(r).split('/').pop());
        return jsonResponse(details[id]);
      },
    },
    {
      match: (r) => r.method === 'PUT' && /\/po-allocations$/.test(pathOf(r)),
      respond: async (r) => {
        const body = await record(r);
        return options.put?.(body) ?? jsonResponse(details[9001]);
      },
    },
    {
      match: (r) => r.method === 'POST' && /:finalize$/.test(pathOf(r)),
      respond: async (r) => {
        const body = await record(r);
        return (
          options.finalize?.(body) ??
          jsonResponse({ ...READY, statusCode: 'FINALIZED', finalizedAt: '2026-11-12T03:00:00Z' })
        );
      },
    },
  ];
  return { fetch: createStubFetch(routes), recorded, details };
};

export const ROUTE = '/logistics/inbound-work-record?from=2026-11-01&to=2026-11-12';
