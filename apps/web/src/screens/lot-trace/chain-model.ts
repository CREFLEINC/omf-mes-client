import type {
  BackwardChain,
  FlowBasis,
  FlowNamed,
  FlowPackage,
  FlowProductSide,
  FlowShipment,
  ForwardChain,
  ForwardStage,
} from './trace-types';

/**
 * LOT 상세의 계산 — 순수 함수만 둔다(단계 줄, 영향 요약, 출하 묶음, 내보내기 줄).
 * 단계와 수는 응답에 있는 문서만 센다. 포장은 확정(PACKED)만 센다 — 포장 중(OPEN)은 칩으로만 보인다(계약).
 */

/**
 * 단계 줄 한 칸은 건수만 갖는다. 생산 LOT마다 단위가 다를 수 있어(반제품 KG, 제품 EA) 단계의 수량을
 * 더하면 뜻 없는 합이 된다. 수량은 나무의 각 줄이 제 단위로 보인다.
 */
export interface StageCell {
  stage: ForwardStage;
  count: number;
}

export const PACKED = 'PACKED';

export const packedOnly = (packages: readonly FlowPackage[]): FlowPackage[] =>
  packages.filter((entry) => entry.statusCode === PACKED);

/** 출하 한 건 아래 취급 단위 줄들. 계약은 출하와 취급 단위마다 한 줄이라 출하 번호로 묶는다. */
export interface ShipmentGroup {
  shipmentId: number;
  shipmentNo: string;
  shippedAt: string | null;
  statusCode: string;
  customer: FlowNamed;
  qty: number;
  units: { handlingUnitNo: string; qty: number }[];
}

export const groupShipments = (rows: readonly FlowShipment[]): ShipmentGroup[] => {
  const groups = new Map<number, ShipmentGroup>();
  for (const row of rows) {
    const group = groups.get(row.shipmentId) ?? {
      shipmentId: row.shipmentId,
      shipmentNo: row.shipmentNo,
      shippedAt: row.shippedAt,
      statusCode: row.statusCode,
      customer: row.customer,
      qty: 0,
      units: [],
    };
    group.qty += row.qty;
    if (row.handlingUnitNo !== null) {
      group.units.push({ handlingUnitNo: row.handlingUnitNo, qty: row.qty });
    }
    groups.set(row.shipmentId, group);
  }
  return [...groups.values()];
};

const productStages = (sides: readonly FlowProductSide[]): StageCell[] => {
  const receipts = sides.flatMap((side) => side.productionReceipts);
  const packed = sides.flatMap((side) => packedOnly(side.packages));
  const shipments = sides.flatMap((side) => side.shipments);
  return [
    { stage: 'PRODUCTION_RECEIVED', count: receipts.length },
    { stage: 'PACKED', count: packed.length },
    { stage: 'SHIPPED', count: new Set(shipments.map((s) => s.shipmentId)).size },
  ];
};

/** 정방향 단계 줄: 입고 → 투입 → 생산 → 제품입고 → 포장 → 출하. */
export const forwardStages = (chain: ForwardChain): StageCell[] => {
  const lots = uniqueProductionLots(chain);
  return [
    { stage: 'RECEIVED', count: chain.receipts.length },
    { stage: 'CONSUMED', count: chain.workOrders.length },
    { stage: 'PRODUCED', count: lots.length },
    ...productStages(lots),
  ];
};

/** 역방향 단계 줄: 생산 → 제품입고 → 포장 → 출하. */
export const backwardStages = (chain: BackwardChain): StageCell[] => [
  { stage: 'PRODUCED', count: chain.workOrder === null ? 0 : 1 },
  ...productStages([chain]),
];

/** 지금 단계 — 건수가 있는 마지막 단계. */
export const currentStage = (cells: readonly StageCell[]): ForwardStage | null =>
  [...cells].reverse().find((cell) => cell.count > 0)?.stage ?? null;

export const uniqueProductionLots = (chain: ForwardChain) => {
  const seen = new Map<number, ForwardChain['workOrders'][number]['productionLots'][number]>();
  for (const wo of chain.workOrders) {
    for (const lot of wo.productionLots) if (!seen.has(lot.lotId)) seen.set(lot.lotId, lot);
  }
  return [...seen.values()];
};

export interface ForwardImpact {
  lots: number;
  shipments: number;
  customers: number;
}

export const forwardImpact = (chain: ForwardChain): ForwardImpact => {
  const lots = uniqueProductionLots(chain);
  const shipments = lots.flatMap((lot) => lot.shipments);
  return {
    lots: lots.length,
    shipments: new Set(shipments.map((s) => s.shipmentId)).size,
    customers: new Set(shipments.map((s) => s.customer.id)).size,
  };
};

export const backwardImpact = (chain: BackwardChain): { lots: number; suppliers: number } => ({
  lots: new Set(chain.inputMaterials.map((m) => m.lotId)).size,
  suppliers: new Set(
    chain.inputMaterials.flatMap((m) => (m.inbound === null ? [] : [m.inbound.supplier.id])),
  ).size,
});

/* ── 사슬 내보내기(펼친 단계까지) ─────────────────────────────────────── */

export type ChainNodeKind =
  | 'LOT'
  | 'INBOUND'
  | 'RECEIPT'
  | 'WORK_ORDER'
  | 'PRODUCTION_LOT'
  | 'INPUT_MATERIAL'
  | 'PRODUCTION_RECEIPT'
  | 'PACKAGE'
  | 'SHIPMENT';

export interface ChainLine {
  depth: number;
  kind: ChainNodeKind;
  number: string;
  item: FlowNamed | null;
  qty: number | null;
  uomCode: string;
  at: string | null;
  partner: FlowNamed | null;
  basis: FlowBasis | 'INPUT_ONLY' | null;
}

const productLines = (side: FlowProductSide, depth: number, uomCode: string): ChainLine[] => [
  ...side.productionReceipts.map((receipt): ChainLine => ({
    depth,
    kind: 'PRODUCTION_RECEIPT',
    number: receipt.goodsReceiptNo,
    item: null,
    qty: receipt.qty,
    uomCode,
    at: receipt.receiptDatetime,
    partner: null,
    basis: null,
  })),
  ...side.packages.map((entry): ChainLine => ({
    depth,
    kind: 'PACKAGE',
    number: entry.handlingUnitNo,
    item: null,
    qty: entry.qty,
    uomCode,
    at: null,
    partner: null,
    basis: null,
  })),
  ...side.shipments.map((shipment): ChainLine => ({
    depth,
    kind: 'SHIPMENT',
    number:
      shipment.handlingUnitNo === null
        ? shipment.shipmentNo
        : `${shipment.shipmentNo} ${shipment.handlingUnitNo}`,
    item: null,
    qty: shipment.qty,
    uomCode,
    at: shipment.shippedAt,
    partner: shipment.customer,
    basis: null,
  })),
];

/** 정방향 사슬을 줄로 편다(추적 내보내기). */
export const flattenForward = (chain: ForwardChain): ChainLine[] => {
  const { lot } = chain;
  const lines: ChainLine[] = [];
  lines.push({
    depth: 0,
    kind: 'LOT',
    number: lot.lotNo,
    item: lot.item,
    qty: chain.receivedQty,
    uomCode: lot.uomCode,
    at: null,
    partner: chain.inbound?.supplier ?? null,
    basis: null,
  });
  if (chain.inbound !== null) {
    lines.push({
      depth: 1,
      kind: 'INBOUND',
      number: chain.inbound.inboundReceiptNo,
      item: null,
      qty: null,
      uomCode: '',
      at: chain.inbound.receiptDatetime,
      partner: chain.inbound.supplier,
      basis: null,
    });
  }
  for (const receipt of chain.receipts) {
    lines.push({
      depth: 1,
      kind: 'RECEIPT',
      number: receipt.goodsReceiptNo,
      item: null,
      qty: receipt.qty,
      uomCode: lot.uomCode,
      at: receipt.receiptDatetime,
      partner: null,
      basis: null,
    });
  }
  for (const wo of chain.workOrders) {
    lines.push({
      depth: 1,
      kind: 'WORK_ORDER',
      number: wo.workOrderNo,
      item: wo.item,
      qty: wo.consumedQty,
      uomCode: lot.uomCode,
      at: wo.firstConsumedAt,
      partner: null,
      basis: wo.linkBasis ?? 'INPUT_ONLY',
    });
    for (const child of wo.productionLots) {
      lines.push({
        depth: 2,
        kind: 'PRODUCTION_LOT',
        number: child.lotNo,
        item: child.item,
        qty: child.goodQty,
        uomCode: child.uomCode,
        at: child.completedAt,
        partner: null,
        basis: child.linkBasis,
      });
      lines.push(...productLines(child, 3, child.uomCode));
    }
  }
  return lines;
};

/** 역방향 사슬을 줄로 편다(추적 내보내기). */
export const flattenBackward = (chain: BackwardChain): ChainLine[] => {
  const { lot } = chain;
  const lines: ChainLine[] = [];
  lines.push({
    depth: 0,
    kind: 'LOT',
    number: lot.lotNo,
    item: lot.item,
    qty: chain.goodQty,
    uomCode: lot.uomCode,
    at: lot.completedAt,
    partner: null,
    basis: null,
  });
  lines.push(...productLines(chain, 1, lot.uomCode));
  if (chain.workOrder !== null) {
    lines.push({
      depth: 1,
      kind: 'WORK_ORDER',
      number: chain.workOrder.workOrderNo,
      item: chain.workOrder.item,
      qty: chain.workOrder.results.goodQty,
      uomCode: lot.uomCode,
      at: chain.workOrder.results.lastAt,
      partner: null,
      basis: null,
    });
  }
  for (const input of chain.inputMaterials) {
    lines.push({
      depth: 2,
      kind: 'INPUT_MATERIAL',
      number: input.lotNo,
      item: input.item,
      qty: input.consumedQty,
      uomCode: input.uomCode,
      at: input.inbound?.receiptDatetime ?? null,
      partner: input.inbound?.supplier ?? null,
      basis: input.linkBasis,
    });
  }
  return lines;
};
