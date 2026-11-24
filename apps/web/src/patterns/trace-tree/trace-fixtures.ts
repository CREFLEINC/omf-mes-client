import { jsonResponse, type StubRoute } from '../../test/api-harness';
import type {
  BackwardTree,
  ForwardTree,
  TraceDirection,
  TraceLotRow,
  TraceStartMatch,
} from './types';

/**
 * 추적 두 화면 시험의 가상 계보(quickstart 「준비」를 줄인 것) — 합성값만 쓴다(공개 저장소).
 * 자재 A(공급사 S, 입하 IL-1) → W/O 1 → P1(반제품) → W/O 2 → P3 → SH-1(고객 X), W/O 1 → P2(재고).
 */
export const PLANT = {
  plantId: 8401,
  plantCode: 'PL-SYN',
  plantName: '합성 공장',
  isActive: true,
  businessUnitId: 8301,
};

export const lotRow = (
  lotId: number,
  lotNo: string,
  overrides: Partial<TraceLotRow> = {},
): TraceLotRow => ({
  lot: {
    lotId,
    lotNo,
    lotTypeCode: 'MATERIAL',
    statusCode: 'NORMAL',
    lifecycleStatusCode: 'ACTIVE',
  },
  item: { itemId: 1, code: 'ITEM-A', name: '자재 A' },
  qty: 1000,
  uomCode: 'EA',
  partner: { partnerId: 7, code: 'SUP-S', name: '공급사 S' },
  inboundLotNo: 'IL-1',
  sortDate: '2026-11-20T02:00:00Z',
  sortDateKind: 'CONSUMED',
  ...overrides,
});

export const A = lotRow(201, 'ITEM-A|1000|261120|SUP-S|0001');
export const B = lotRow(202, 'ITEM-B|500|261120|SUP-S|0001', {
  item: { itemId: 2, code: 'ITEM-B', name: '자재 B' },
});
export const C = lotRow(203, 'ITEM-A|1000|261121|SUP-S|0002');

export const forwardTreeOf = (lotId: number, lotNo: string): ForwardTree => ({
  root: `L:${String(lotId)}`,
  nodes: [
    {
      nodeKey: `L:${String(lotId)}`,
      kind: 'MATERIAL_LOT',
      lot: {
        lotId,
        lotNo,
        lotTypeCode: 'MATERIAL',
        statusCode: 'NORMAL',
        lifecycleStatusCode: 'ACTIVE',
      },
      item: { itemId: 1, code: 'ITEM-A', name: '자재 A' },
      qty: 1000,
      uomCode: 'EA',
      material: {
        inboundLotId: 1,
        inboundLotNo: 'IL-1',
        supplier: { partnerId: 7, code: 'SUP-S', name: '공급사 S' },
        supplierLotNo: 'SUP-A',
        receivedAt: '2026-11-01T02:00:00Z',
        iqcJudgmentCode: 'ACCEPTED',
      },
    },
    {
      nodeKey: 'W:1',
      kind: 'WORK_ORDER',
      workOrder: { workOrderId: 1, workOrderNo: 'WO-SYN-0001', statusCode: 'CLOSED' },
      item: { itemId: 11, code: 'SEMI-1', name: '반제품 1' },
    },
    {
      nodeKey: 'L:301',
      kind: 'PRODUCTION_LOT',
      lot: {
        lotId: 301,
        lotNo: 'PL-SYN-0001-A01',
        lotTypeCode: 'PRODUCTION',
        statusCode: 'NORMAL',
        lifecycleStatusCode: 'ACTIVE',
      },
      item: { itemId: 11, code: 'SEMI-1', name: '반제품 1' },
      qty: 200,
      uomCode: 'EA',
      producedAt: '2026-11-17T03:00:00Z',
    },
    {
      nodeKey: 'L:302',
      kind: 'PRODUCTION_LOT',
      lot: {
        lotId: 302,
        lotNo: 'PL-SYN-0001-A02',
        lotTypeCode: 'PRODUCTION',
        statusCode: 'NORMAL',
        lifecycleStatusCode: 'ACTIVE',
      },
      item: { itemId: 11, code: 'SEMI-1', name: '반제품 1' },
      qty: 180,
      uomCode: 'EA',
      producedAt: '2026-11-17T04:00:00Z',
    },
    {
      nodeKey: 'W:2',
      kind: 'WORK_ORDER',
      workOrder: { workOrderId: 2, workOrderNo: 'WO-SYN-0002', statusCode: 'CLOSED' },
      item: { itemId: 12, code: 'FG-1', name: '완제품 1' },
    },
    {
      nodeKey: 'L:303',
      kind: 'PRODUCTION_LOT',
      lot: {
        lotId: 303,
        lotNo: 'PL-SYN-0002-A01',
        lotTypeCode: 'PRODUCTION',
        statusCode: 'NORMAL',
        lifecycleStatusCode: 'ACTIVE',
      },
      item: { itemId: 12, code: 'FG-1', name: '완제품 1' },
      qty: 200,
      uomCode: 'EA',
      producedAt: '2026-11-18T03:00:00Z',
    },
    {
      nodeKey: 'S:1',
      kind: 'SHIPMENT',
      shipment: {
        shipmentId: 1,
        shipmentNo: 'SH-SYN-0001',
        shippedAt: '2026-11-19T02:00:00Z',
        statusCode: 'SHIPPED',
        customer: { partnerId: 9, code: 'CUS-X', name: '고객 X' },
      },
    },
    {
      nodeKey: 'K:302:5',
      kind: 'STOCK',
      qty: 180,
      warehouse: { warehouseId: 3, code: 'WH-P', name: '생산창고' },
      location: { locationId: 5, code: 'L-02', name: 'L-02' },
    },
  ],
  edges: [
    {
      from: `L:${String(lotId)}`,
      to: 'W:1',
      kind: 'CONSUMED',
      qty: 200,
      basis: 'RECORDED',
      firstAt: '2026-11-17T01:00:00Z',
      lastAt: '2026-11-17T02:00:00Z',
    },
    { from: 'W:1', to: 'L:301', kind: 'PRODUCED', qty: 200, basis: 'LOT_GENEALOGY_ESTIMATE' },
    { from: 'W:1', to: 'L:302', kind: 'PRODUCED', qty: 180, basis: 'LOT_GENEALOGY_ESTIMATE' },
    {
      from: 'L:301',
      to: 'W:2',
      kind: 'CONSUMED',
      qty: 200,
      basis: 'RECORDED',
      firstAt: '2026-11-18T01:00:00Z',
      lastAt: '2026-11-18T02:00:00Z',
    },
    { from: 'L:302', to: 'K:302:5', kind: 'STOCKED', qty: 180, basis: 'RECORDED' },
    { from: 'W:2', to: 'L:303', kind: 'PRODUCED', qty: 200, basis: 'LOT_GENEALOGY_ESTIMATE' },
    { from: 'L:303', to: 'S:1', kind: 'SHIPPED', qty: 200, basis: 'RECORDED' },
  ],
  limit: { exceeded: false, maxDepthReached: false, lotCount: 4, lotCap: 5000 },
  endRows: [
    {
      lot: {
        lotId: 303,
        lotNo: 'PL-SYN-0002-A01',
        lotTypeCode: 'PRODUCTION',
        statusCode: 'NORMAL',
        lifecycleStatusCode: 'ACTIVE',
      },
      item: { itemId: 12, code: 'FG-1', name: '완제품 1' },
      producedQty: 200,
      uomCode: 'EA',
      fate: 'SHIPPED',
      shipments: [
        {
          shipmentNo: 'SH-SYN-0001',
          customer: { partnerId: 9, code: 'CUS-X', name: '고객 X' },
          shippedAt: '2026-11-19T02:00:00Z',
          qty: 200,
        },
      ],
      stock: [],
      viaWorkOrders: ['WO-SYN-0002'],
    },
    {
      lot: {
        lotId: 302,
        lotNo: 'PL-SYN-0001-A02',
        lotTypeCode: 'PRODUCTION',
        statusCode: 'NORMAL',
        lifecycleStatusCode: 'ACTIVE',
      },
      item: { itemId: 11, code: 'SEMI-1', name: '반제품 1' },
      producedQty: 180,
      uomCode: 'EA',
      fate: 'IN_STOCK',
      shipments: [],
      stock: [
        {
          warehouse: { warehouseId: 3, code: 'WH-P', name: '생산창고' },
          location: { locationId: 5, code: 'L-02', name: 'L-02' },
          qty: 180,
        },
      ],
      viaWorkOrders: ['WO-SYN-0001'],
    },
  ],
  summary: {
    lotCount: 4,
    workOrderCount: 2,
    endLotCount: 2,
    shippedLotCount: 1,
    customerCount: 1,
    stockLotCount: 1,
  },
});

/** 투입되지 않은 자재 LOT — 계보는 LOT 하나, 최종 LOT 목록은 비었다(US1-4). */
export const lonelyTreeOf = (lotId: number, lotNo: string): ForwardTree => {
  const full = forwardTreeOf(lotId, lotNo);
  return {
    ...full,
    nodes: full.nodes.slice(0, 1),
    edges: [],
    endRows: [],
    summary: {
      lotCount: 1,
      workOrderCount: 0,
      endLotCount: 0,
      shippedLotCount: 0,
      customerCount: 0,
      stockLotCount: 0,
    },
    limit: { exceeded: false, maxDepthReached: false, lotCount: 1, lotCap: 5000 },
  };
};

/* 역방향 — P3 → W/O 2 → P1(반제품) → W/O 1 → A → IL-1(공급사 S, IQC 합격). */
export const P3 = lotRow(303, 'PL-SYN-0002-A01', {
  lot: {
    lotId: 303,
    lotNo: 'PL-SYN-0002-A01',
    lotTypeCode: 'PRODUCTION',
    statusCode: 'NORMAL',
    lifecycleStatusCode: 'ACTIVE',
  },
  item: { itemId: 12, code: 'FG-1', name: '완제품 1' },
  partner: { partnerId: 9, code: 'CUS-X', name: '고객 X' },
  inboundLotNo: null,
  sortDateKind: 'SHIPPED',
});
export const P4 = lotRow(304, 'PL-SYN-0002-A02', {
  lot: {
    lotId: 304,
    lotNo: 'PL-SYN-0002-A02',
    lotTypeCode: 'PRODUCTION',
    statusCode: 'NORMAL',
    lifecycleStatusCode: 'ACTIVE',
  },
  item: { itemId: 12, code: 'FG-1', name: '완제품 1' },
  partner: { partnerId: 9, code: 'CUS-X', name: '고객 X' },
  inboundLotNo: null,
  sortDateKind: 'RECEIVED',
});

export const backwardTreeOf = (
  lotId: number,
  lotNo: string,
  serialNo: string | null = null,
): BackwardTree => {
  const lotKey = `L:${String(lotId)}`;
  const serialNodes =
    serialNo === null
      ? []
      : [
          {
            nodeKey: 'N:1',
            kind: 'SERIAL' as const,
            serialNo,
            lotId,
            producedAt: '2026-11-18T03:00:00Z',
          },
        ];
  return {
    root: serialNo === null ? lotKey : 'N:1',
    nodes: [
      ...serialNodes,
      {
        nodeKey: lotKey,
        kind: 'PRODUCTION_LOT',
        lot: {
          lotId,
          lotNo,
          lotTypeCode: 'PRODUCTION',
          statusCode: 'NORMAL',
          lifecycleStatusCode: 'ACTIVE',
        },
        item: { itemId: 12, code: 'FG-1', name: '완제품 1' },
        qty: 200,
        uomCode: 'EA',
        producedAt: '2026-11-18T03:00:00Z',
      },
      {
        nodeKey: 'W:2',
        kind: 'WORK_ORDER',
        workOrder: { workOrderId: 2, workOrderNo: 'WO-SYN-0002', statusCode: 'CLOSED' },
        item: { itemId: 12, code: 'FG-1', name: '완제품 1' },
      },
      {
        nodeKey: 'L:201',
        kind: 'MATERIAL_LOT',
        lot: {
          lotId: 201,
          lotNo: A.lot.lotNo,
          lotTypeCode: 'MATERIAL',
          statusCode: 'NORMAL',
          lifecycleStatusCode: 'ACTIVE',
        },
        item: { itemId: 1, code: 'ITEM-A', name: '자재 A' },
        qty: 1000,
        uomCode: 'EA',
      },
      {
        nodeKey: 'I:1',
        kind: 'INBOUND_LOT',
        inboundLot: {
          inboundLotId: 1,
          inboundLotNo: 'IL-1',
          receivedDate: '2026-11-01',
          supplier: { partnerId: 7, code: 'SUP-S', name: '공급사 S' },
          iqcJudgmentCode: 'ACCEPTED',
        },
      },
    ],
    edges: [
      ...(serialNo === null
        ? []
        : [
            {
              from: 'N:1',
              to: lotKey,
              kind: 'SERIAL_OF' as const,
              qty: null,
              basis: 'RECORDED' as const,
            },
          ]),
      { from: lotKey, to: 'W:2', kind: 'PRODUCED_BY', qty: 200, basis: 'RECORDED' },
      {
        from: 'W:2',
        to: 'L:201',
        kind: 'CONSUMED',
        qty: 200,
        basis: 'LOT_GENEALOGY_ESTIMATE',
        firstAt: '2026-11-18T01:00:00Z',
      },
      { from: 'L:201', to: 'I:1', kind: 'RECEIVED_FROM', qty: null, basis: 'RECORDED' },
    ],
    limit: { exceeded: false, maxDepthReached: false, lotCount: 2, lotCap: 5000 },
    endRows: [
      {
        lot: {
          lotId: 201,
          lotNo: A.lot.lotNo,
          lotTypeCode: 'MATERIAL',
          statusCode: 'NORMAL',
          lifecycleStatusCode: 'ACTIVE',
        },
        item: { itemId: 1, code: 'ITEM-A', name: '자재 A' },
        supplier: { partnerId: 7, code: 'SUP-S', name: '공급사 S' },
        supplierLotNo: 'SUP-A',
        inboundLot: {
          inboundLotNo: 'IL-1',
          receivedDate: '2026-11-01',
          iqcJudgmentCode: 'ACCEPTED',
        },
        workOrder: { workOrderNo: 'WO-SYN-0002' },
        productLots: [lotNo],
        consumedQty: 200,
        uomCode: 'EA',
        basis: 'LOT_GENEALOGY_ESTIMATE',
      },
    ],
    summary: { rawLotCount: 1, supplierCount: 1, workOrderCount: 1, productLotCount: 1 },
    rootShipments: [
      {
        shipmentNo: 'SH-SYN-0001',
        customer: { partnerId: 9, code: 'CUS-X', name: '고객 X' },
        shippedAt: '2026-11-19T02:00:00Z',
        qty: 200,
      },
    ],
  };
};

export interface TraceCalls {
  lists: URL[];
  starts: URL[];
  trees: URL[];
  exports: Request[];
}

export interface TraceStubOptions {
  direction: TraceDirection;
  recent: TraceLotRow[];
  /** 번호 → 맞은 묶음. 없으면 빈 배열. */
  starts?: Record<string, TraceStartMatch[]>;
  /** lotId(+ serial) → 계보. */
  tree: (lotId: number, serialNo: string | null) => ForwardTree | BackwardTree;
  /** lotId → LOT 번호(주소로 들어올 때). */
  lotNos?: Record<number, string>;
  condition?: (page: number) => TraceLotRow[];
  conditionTotal?: number;
}

const path = (request: Request) => new URL(request.url).pathname;

export const traceStubRoutes = (options: TraceStubOptions, calls: TraceCalls): StubRoute[] => [
  {
    match: (request) => path(request) === '/mdm/plants',
    respond: () => jsonResponse({ items: [PLANT], page: { page: 1, size: 100, total: 1 } }),
  },
  {
    match: (request) => path(request) === '/mdm/code-values',
    respond: (request) => {
      const group = new URL(request.url).searchParams.get('codeGroupCode');
      const items =
        group === 'LOT_STATUS'
          ? [{ code: 'NORMAL', codeName: '정상', displayOrder: 1, isActive: true }]
          : group === 'WORK_ORDER_STATUS'
            ? [{ code: 'CLOSED', codeName: '마감', displayOrder: 1, isActive: true }]
            : [{ code: 'ACCEPTED', codeName: '합격', displayOrder: 1, isActive: true }];
      return jsonResponse({ items, page: { page: 1, size: 100, total: items.length } });
    },
  },
  {
    match: (request) => path(request) === '/mdm/partners',
    respond: () =>
      jsonResponse({
        items: [{ partnerId: 7, partnerCode: 'SUP-S', partnerName: '공급사 S', isActive: true }],
        page: { page: 1, size: 100, total: 1 },
      }),
  },
  {
    match: (request) =>
      path(request) === '/trace/material-trace-lots' ||
      path(request) === '/trace/product-trace-lots',
    respond: (request) => {
      const url = new URL(request.url);
      calls.lists.push(url);
      if (url.searchParams.has('partnerId')) {
        const page = Number(url.searchParams.get('page') ?? '1');
        return jsonResponse({
          mode: 'CONDITION',
          items: options.condition?.(page) ?? [],
          page: { page, size: 100, total: options.conditionTotal ?? 0 },
        });
      }
      return jsonResponse({
        mode: 'RECENT',
        items: options.recent,
        page: { page: 1, size: 100, total: options.recent.length },
      });
    },
  },
  {
    match: (request) => path(request) === '/trace/trace-starts',
    respond: (request) => {
      const url = new URL(request.url);
      calls.starts.push(url);
      return jsonResponse({ matches: options.starts?.[url.searchParams.get('q') ?? ''] ?? [] });
    },
  },
  {
    match: (request) =>
      path(request) === '/trace/forward-tree' || path(request) === '/trace/backward-tree',
    respond: (request) => {
      const url = new URL(request.url);
      calls.trees.push(url);
      return jsonResponse(
        options.tree(Number(url.searchParams.get('lotId')), url.searchParams.get('serialNo')),
      );
    },
  },
  {
    match: (request) => /^\/trace\/lots\/\d+$/.test(path(request)),
    respond: (request) => {
      const lotId = Number(path(request).split('/').at(-1));
      const lotNo = options.lotNos?.[lotId];
      return lotNo === undefined
        ? jsonResponse({ message: '없음' }, { status: 404 })
        : jsonResponse({ lot: { lotId, lotNo }, externalIdentifiers: [], holds: [] });
    },
  },
  {
    match: (request) => request.method === 'POST' && path(request).endsWith('-exports'),
    respond: (request) => {
      calls.exports.push(request);
      return new Response(new Blob(['xlsx']), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="material-trace-20261124-1530.xlsx"',
        },
      });
    },
  },
];

export const newCalls = (): TraceCalls => ({ lists: [], starts: [], trees: [], exports: [] });

export const startsOf = (
  matchedBy: TraceStartMatch['matchedBy'],
  label: string,
  lots: TraceLotRow[],
  extra: Partial<TraceStartMatch> = {},
): TraceStartMatch[] => [
  { matchedBy, label, serialNo: null, otherDirection: false, truncated: false, lots, ...extra },
];
