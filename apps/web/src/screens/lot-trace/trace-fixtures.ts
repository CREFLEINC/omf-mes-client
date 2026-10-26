import { jsonResponse, type StubRoute } from '../../test/api-harness';
import type {
  BackwardChain,
  BackwardListRow,
  FlowLotHead,
  FlowProductionLot,
  ForwardChain,
  ForwardListRow,
} from './trace-types';

/* 합성값이다 — 실제 기준 정보 값을 쓰지 않는다(공개 저장소). */

export const head = (lotId: number, lotNo: string, lotTypeCode: string): FlowLotHead => ({
  lotId,
  lotNo,
  plantId: 1,
  item:
    lotTypeCode === 'MATERIAL'
      ? { id: 1, code: 'ITEM-A', name: '자재 A' }
      : { id: 6, code: 'FG-A', name: '제품 A' },
  lotTypeCode,
  statusCode: 'NORMAL',
  uomId: 1,
  uomCode: lotTypeCode === 'MATERIAL' ? 'KG' : 'EA',
  completedAt: lotTypeCode === 'MATERIAL' ? null : '2026-10-23T06:00:00Z',
});

const EMPTY_STAGES = {
  received: { count: 1 },
  consumed: { workOrderCount: 0 },
  produced: { lotCount: 0 },
  productionReceived: { lotCount: 0 },
  packed: { lotCount: 0, handlingUnitCount: 0 },
  shipped: { lotCount: 0, shipmentCount: 0, lastShippedAt: null },
};

export const forwardRow = (
  lotId: number,
  lotNo: string,
  overrides: Partial<ForwardListRow> = {},
): ForwardListRow => ({
  ...head(lotId, lotNo, 'MATERIAL'),
  inbound: null,
  receipts: [],
  receivedQty: 500,
  firstReceivedAt: '2026-10-23T08:00:00Z',
  consumedQty: 200,
  stages: EMPTY_STAGES,
  currentStageCode: 'CONSUMED',
  basis: 'LOT_GENEALOGY_ESTIMATE',
  ...overrides,
});

export const backwardRow = (lotId: number, lotNo: string): BackwardListRow => ({
  ...head(lotId, lotNo, 'PRODUCTION'),
  workOrder: { workOrderId: 70, workOrderNo: 'WO-SYN-0001', statusCode: 'COMPLETED' },
  producedQty: 120,
  firstProducedAt: '2026-10-23T02:00:00Z',
  lastProducedAt: '2026-10-23T06:00:00Z',
  inputMaterialLotCount: 2,
  basis: 'LOT_GENEALOGY_ESTIMATE',
  stages: {
    productionReceived: { count: 1, qty: 120 },
    packed: { handlingUnitCount: 0, qty: 0 },
    shipped: { shipmentCount: 0, qty: 0, lastShippedAt: null, customers: [], customerCount: 0 },
  },
  currentStageCode: 'PRODUCTION_RECEIVED',
});

export const productionLot = (
  lotId: number,
  lotNo: string,
  overrides: Partial<FlowProductionLot> = {},
): FlowProductionLot => ({
  ...head(lotId, lotNo, 'PRODUCTION'),
  productionReceipts: [],
  packages: [],
  shipments: [],
  goodQty: 100,
  linkBasis: 'LOT_GENEALOGY_ESTIMATE',
  serialCount: 0,
  consumedFurther: 0,
  cyclic: false,
  ...overrides,
});

export const forwardChain = (
  lotId: number,
  lotNo: string,
  workOrders: ForwardChain['workOrders'],
  lotTypeCode = 'MATERIAL',
): ForwardChain => ({
  lot: head(lotId, lotNo, lotTypeCode),
  basis: 'LOT_GENEALOGY_ESTIMATE',
  inbound: {
    inboundReceiptId: 1,
    inboundReceiptNo: 'IR-SYN-0001',
    receiptDatetime: '2026-10-23T08:00:00Z',
    supplier: { id: 3, code: 'SUP-A', name: '공급사 A' },
    supplierLotNo: 'SL-0001',
  },
  receipts: [
    {
      goodsReceiptId: 9,
      goodsReceiptNo: 'GR-SYN-0001',
      receiptDatetime: '2026-10-23T08:00:00Z',
      warehouse: { id: 2, code: 'WH-A', name: '창고 A' },
      qty: 500,
    },
  ],
  receivedQty: 500,
  workOrders,
  truncated: false,
  totalProductionLotCount: workOrders.reduce((n, wo) => n + wo.productionLots.length, 0),
});

export const workOrder = (
  workOrderId: number,
  productionLots: FlowProductionLot[],
  linkBasis: ForwardChain['workOrders'][number]['linkBasis'] = 'LOT_GENEALOGY_ESTIMATE',
): ForwardChain['workOrders'][number] => ({
  workOrderId,
  workOrderNo: `WO-SYN-${String(workOrderId).padStart(4, '0')}`,
  item: { id: 6, code: 'FG-A', name: '제품 A' },
  statusCode: 'IN_PROGRESS',
  consumedQty: 200,
  firstConsumedAt: '2026-10-23T02:00:00Z',
  lastConsumedAt: '2026-10-23T03:00:00Z',
  linkBasis,
  productionLots,
});

export const backwardChain = (
  lotId: number,
  lotNo: string,
  inputs: BackwardChain['inputMaterials'],
  withWorkOrder = true,
): BackwardChain => ({
  lot: head(lotId, lotNo, 'PRODUCTION'),
  goodQty: 120,
  basis: 'LOT_GENEALOGY_ESTIMATE',
  productionReceipts: [],
  packages: [],
  shipments: [],
  workOrder: withWorkOrder
    ? {
        workOrderId: 70,
        workOrderNo: 'WO-SYN-0070',
        item: { id: 6, code: 'FG-A', name: '제품 A' },
        statusCode: 'COMPLETED',
        results: { count: 2, goodQty: 120, defectQty: 5, firstAt: null, lastAt: null },
      }
    : null,
  inputMaterials: inputs,
});

export const inputMaterial = (
  lotId: number,
  lotNo: string,
  overrides: Partial<BackwardChain['inputMaterials'][number]> = {},
): BackwardChain['inputMaterials'][number] => ({
  ...head(lotId, lotNo, 'MATERIAL'),
  inbound: {
    inboundReceiptId: 1,
    inboundReceiptNo: 'IR-SYN-0001',
    receiptDatetime: '2026-10-22T08:00:00Z',
    supplier: { id: 3, code: 'SUP-A', name: '공급사 A' },
    supplierLotNo: 'SL-0001',
  },
  receipts: [],
  receivedQty: 500,
  consumedQty: 3,
  firstConsumedAt: '2026-10-23T02:00:00Z',
  lastConsumedAt: '2026-10-23T03:00:00Z',
  linkBasis: 'LOT_GENEALOGY_ESTIMATE',
  producedBy: null,
  cyclic: false,
  ...overrides,
});

export interface TraceStubData {
  forwardRows?: ForwardListRow[];
  backwardRows?: BackwardListRow[];
  forwardChains?: Record<number, ForwardChain>;
  backwardChains?: Record<number, BackwardChain>;
  listStatus?: number;
  listErrors?: unknown;
}

/** 추적 목록과 사슬 스텁. 부른 주소를 `calls`에 남긴다. */
export const traceRoutes = (data: TraceStubData, calls: URL[]): StubRoute[] => [
  {
    match: (request) => new URL(request.url).pathname.startsWith('/trace/'),
    respond: (request) => {
      const url = new URL(request.url);
      calls.push(url);
      const forwardStageCounts = {
        RECEIVED: 0,
        CONSUMED: 0,
        PRODUCED: 0,
        PRODUCTION_RECEIVED: 0,
        PACKED: 0,
        SHIPPED: 0,
      };
      if (
        url.pathname === '/trace/material-lot-flows' ||
        url.pathname === '/trace/product-lot-flows'
      ) {
        if (data.listStatus !== undefined) {
          return jsonResponse(data.listErrors ?? { errors: [] }, { status: data.listStatus });
        }
        const forward = url.pathname === '/trace/material-lot-flows';
        const items = forward ? (data.forwardRows ?? []) : (data.backwardRows ?? []);
        const counts = forward
          ? { ...forwardStageCounts }
          : { PRODUCED: 0, PRODUCTION_RECEIVED: 0, PACKED: 0, SHIPPED: 0 };
        for (const item of items) {
          const key = item.currentStageCode as keyof typeof counts;
          counts[key] = (counts[key] ?? 0) + 1;
        }
        return jsonResponse({
          items,
          page: { page: 1, size: Number(url.searchParams.get('size') ?? 50), total: items.length },
          stageCounts: counts,
        });
      }
      const matched = /^\/trace\/lots\/(\d+)\/(forward|backward)-flow$/.exec(url.pathname);
      if (matched !== null) {
        const id = Number(matched[1]);
        const chain =
          matched[2] === 'forward' ? data.forwardChains?.[id] : data.backwardChains?.[id];
        return chain === undefined
          ? jsonResponse({ errors: [] }, { status: 404 })
          : jsonResponse(chain);
      }
      return jsonResponse({ errors: [] }, { status: 404 });
    },
  },
];
