import type {
  BackwardChain,
  FlowBasis,
  FlowNamed,
  FlowPackage,
  FlowProductSide,
  FlowShipment,
  FlowSplitLink,
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
  | 'SHIPMENT'
  /** 008 — 이 LOT 이 떼어져 나온 원래 LOT(부모 · 역방향은 조상). */
  | 'SPLIT_FROM'
  /** 008 — 이 LOT 에서 떼어 낸 분할 LOT(자손). */
  | 'SPLIT';

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
  /** 분할 줄의 근거 글(「분할 (출고번호 · 라인)」 등) — 있으면 근거 칸에 이것을 쓴다. */
  note?: string;
  /** W/O 가 이 LOT 이 아니라 분할 자손으로 투입됐으면 그 LOT 번호(경유 LOT). */
  via?: string;
}

/** 분할 고리의 출고 — 「GI-… · 라인 n」. 출고가 아닌 옛 분할이면 빈 글. */
export const splitIssueText = (
  link: FlowSplitLink,
  format: (goodsIssueNo: string, lineNo: number) => string,
): string =>
  link.goodsIssue === null ? '' : format(link.goodsIssue.goodsIssueNo, link.goodsIssue.lineNo);

const SPLIT_MARK = /-S\d+/gu;

/**
 * 분할 자손의 깊이(1 = 이 LOT 에서 바로 떼어 낸 것) — 번호 끝 마디(`-S{n}`) 수의 차이로 센다. 응답이 깊이 순이지만
 * 깊이를 싣지 않아서다. 64자를 넘어 원조 기준으로 매긴 번호면 틀릴 수 있다 — 들여쓰기에만 쓴다.
 */
export const splitDepth = (centerLotNo: string, childLotNo: string): number =>
  Math.max(
    1,
    (childLotNo.match(SPLIT_MARK)?.length ?? 0) - (centerLotNo.match(SPLIT_MARK)?.length ?? 0),
  );

const splitLine = (
  link: FlowSplitLink,
  kind: 'SPLIT_FROM' | 'SPLIT',
  depth: number,
  item: FlowNamed,
  note: (link: FlowSplitLink) => string,
): ChainLine => ({
  depth,
  kind,
  number: link.lot.lotNo,
  item,
  qty: link.qty,
  uomCode: link.uomCode,
  at: link.splitAt,
  partner: null,
  basis: null,
  note: note(link),
});

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
/** 분할 줄의 근거·입하 근거 글 — 부르는 쪽(화면 문구)이 짓는다. */
export interface SplitNotes {
  split: (link: FlowSplitLink) => string;
  rootInbound: string;
}

export const flattenForward = (chain: ForwardChain, notes?: SplitNotes): ChainLine[] => {
  const { lot } = chain;
  const lines: ChainLine[] = [];
  const splitFrom = chain.splitFrom;
  lines.push({
    depth: 0,
    kind: 'LOT',
    number: lot.lotNo,
    item: lot.item,
    qty: splitFrom === null ? chain.receivedQty : splitFrom.qty,
    uomCode: lot.uomCode,
    at: null,
    partner: chain.inbound?.supplier ?? null,
    basis: null,
  });
  if (splitFrom !== null && notes !== undefined) {
    lines.push(splitLine(splitFrom, 'SPLIT_FROM', 1, lot.item, notes.split));
  }
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
      ...(splitFrom !== null && notes !== undefined ? { note: notes.rootInbound } : {}),
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
  if (notes !== undefined) {
    for (const child of chain.splits) {
      lines.push(
        splitLine(child, 'SPLIT', splitDepth(lot.lotNo, child.lot.lotNo), lot.item, notes.split),
      );
    }
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
      ...(wo.viaLot === null ? {} : { via: wo.viaLot.lotNo }),
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
export const flattenBackward = (chain: BackwardChain, notes?: SplitNotes): ChainLine[] => {
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
    /* 분할 LOT 이 투입됐으면 그 조상 — 가까운 부모부터 뿌리까지 한 단씩 깊어진다(008). */
    if (notes !== undefined) {
      input.splitAncestry.forEach((link, index) => {
        lines.push(splitLine(link, 'SPLIT_FROM', 3 + index, input.item, notes.split));
      });
    }
  }
  return lines;
};
