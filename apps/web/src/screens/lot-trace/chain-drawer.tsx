import { AlertBanner, Button, Chip, SkeletonText, Tooltip } from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';

import { DetailDrawer } from '../../patterns/detail-drawer';
import {
  backwardImpact,
  backwardStages,
  currentStage,
  flattenBackward,
  flattenForward,
  forwardImpact,
  forwardStages,
  groupShipments,
  PACKED,
  type ChainLine,
  type StageCell,
} from './chain-model';
import { saveCsv, toCsvText, type CsvColumn } from './export';
import { useCodeNames } from './queries';
import { formatQty } from './rows';
import type { PathStep, TraceDirection } from './trace-filters';
import { useBackwardChain, useExpandedChains, useForwardChain } from './trace-queries';
import { plantDate, plantDateTime } from './trace-table';
import type {
  BackwardChain,
  FlowBasis,
  FlowInputMaterial,
  FlowLotHead,
  FlowProductionLot,
  FlowProductSide,
  ForwardChain,
  ForwardWorkOrder,
} from './trace-types';

const t = messages.lotTrace;
const c = t.chain;

/** W-03-01 LOT 상태 — 그 화면이 `q`(LOT 번호)와 `lot`(고른 LOT)을 주소로 받는다. */
export const LOT_STATUS_PATH = '/quality/lot-status';

export const lotStatusHref = (lot: { lotId: number; lotNo: string }): string =>
  `${LOT_STATUS_PATH}?${new URLSearchParams({ q: lot.lotNo, lot: String(lot.lotId) }).toString()}`;

const NORMAL_LOT_STATUS = 'NORMAL';

export interface LotRef {
  lotId: number;
  lotNo: string;
  lotType: PathStep['lotType'];
}

export interface ChainDrawerProps {
  direction: TraceDirection;
  lotId: number;
  path: readonly PathStep[];
  canOpenLotStatus: boolean;
  onClose: () => void;
  /** 방향 바꾸기, 기준 바꾸기, 경로 줄 되돌아가기. */
  onOpenLot: (direction: TraceDirection, lot: LotRef, path: PathStep[]) => void;
}

const lotTypeOf = (head: FlowLotHead): PathStep['lotType'] =>
  head.lotTypeCode === 'MATERIAL' ? 'MATERIAL' : 'PRODUCTION';

const qty = (value: number, uomCode: string): string => `${formatQty(value)} ${uomCode}`.trim();

/** 추정 칩. 칩에 마우스를 올리거나 초점을 두면 근거 한 문장이 보인다(계획 2-4). */
const EstimateChip = ({ basis }: { basis: FlowBasis | 'inputOnly' }) => (
  <Tooltip content={c.estimateTip[basis]}>
    <span
      className="lot-trace-chip-anchor"
      tabIndex={0}
      aria-label={`${c.estimate[basis]}. ${c.estimateTip[basis]}`}
    >
      <Chip variant="status" size="sm" status={basis === 'inputOnly' ? 'idle' : 'info'}>
        {c.estimate[basis]}
      </Chip>
    </span>
  </Tooltip>
);

const VisitedChip = () => (
  <Tooltip content={c.visitedTip}>
    <span
      className="lot-trace-chip-anchor"
      tabIndex={0}
      aria-label={`${c.visited}. ${c.visitedTip}`}
    >
      <Chip variant="status" size="sm" status="idle">
        {c.visited}
      </Chip>
    </span>
  </Tooltip>
);

const Note = ({ children }: { children: ReactNode }) => (
  <li className="lot-trace-node lot-trace-note">{children}</li>
);

/** 생산 입고, 포장, 출하 — 문서로 이어진 단계라 근거 칩이 없다. 출하는 출하 번호 아래 취급 단위를 묶는다. */
const ProductSideNodes = ({
  side,
  uomCode,
  stageAnchors,
}: {
  side: FlowProductSide;
  uomCode: string;
  stageAnchors: boolean;
}) => {
  const groups = groupShipments(side.shipments);
  return (
    <>
      {side.productionReceipts.map((receipt, index) => (
        <li
          key={`r-${receipt.goodsReceiptId}`}
          className="lot-trace-node"
          data-stage={stageAnchors && index === 0 ? 'PRODUCTION_RECEIVED' : undefined}
        >
          <span className="lot-trace-node-kind">{c.productionReceipt}</span>
          <span className="mono-cell">{receipt.goodsReceiptNo}</span>
          <span>{qty(receipt.qty, uomCode)}</span>
          <span>{plantDate(receipt.receiptDatetime)}</span>
          <span>{receipt.warehouse.name}</span>
        </li>
      ))}
      {side.packages.map((entry, index) => (
        <li
          key={`p-${entry.handlingUnitId}`}
          className="lot-trace-node"
          data-stage={stageAnchors && index === 0 ? 'PACKED' : undefined}
        >
          <span className="lot-trace-node-kind">{c.packing}</span>
          <span className="mono-cell">{entry.handlingUnitNo}</span>
          <span>{qty(entry.qty, uomCode)}</span>
          {entry.shippingUnit !== null && (
            <span className="mono-cell">{entry.shippingUnit.shippingUnitNo}</span>
          )}
          {entry.statusCode !== PACKED && (
            <Chip variant="status" size="sm" status="warning">
              {c.packingOpen}
            </Chip>
          )}
        </li>
      ))}
      {groups.length === 0 ? (
        <Note>{c.noShipment}</Note>
      ) : (
        groups.map((group, index) => (
          <li
            key={`s-${group.shipmentId}`}
            className="lot-trace-node"
            data-stage={stageAnchors && index === 0 ? 'SHIPPED' : undefined}
          >
            <span className="lot-trace-node-kind">{c.shipment}</span>
            <span className="mono-cell">{group.shipmentNo}</span>
            <span>{qty(group.qty, uomCode)}</span>
            <span>{plantDate(group.shippedAt)}</span>
            <span>{named(group.customer.name, group.customer.code)}</span>
            {group.units.length > 0 && (
              <ul className="lot-trace-tree">
                {group.units.map((unit) => (
                  <li key={unit.handlingUnitNo} className="lot-trace-node">
                    <span className="mono-cell">{unit.handlingUnitNo}</span>
                    <span>{qty(unit.qty, uomCode)}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))
      )}
    </>
  );
};

interface TreeContext<Chain> {
  expanded: ReadonlySet<number>;
  chains: ReadonlyMap<number, Chain>;
  pending: ReadonlySet<number>;
  toggle: (lotId: number) => void;
  switchTo: (direction: TraceDirection, lot: LotRef) => void;
}

const LotActions = ({
  lot,
  target,
  reroot,
  ctx,
  self,
}: {
  lot: FlowLotHead;
  target: TraceDirection;
  reroot: boolean;
  self: TraceDirection;
  ctx: TreeContext<unknown>;
}) => {
  const ref: LotRef = { lotId: lot.lotId, lotNo: lot.lotNo, lotType: lotTypeOf(lot) };
  return (
    <span className="lot-trace-node-actions">
      <Button
        size="sm"
        variant="outlined"
        aria-label={target === 'forward' ? c.toForwardFor(lot.lotNo) : c.toBackwardFor(lot.lotNo)}
        onClick={() => ctx.switchTo(target, ref)}
      >
        {target === 'forward' ? c.toForward : c.toBackward}
      </Button>
      {reroot && (
        <Button
          size="sm"
          variant="outlined"
          aria-label={c.rerootFor(lot.lotNo)}
          onClick={() => ctx.switchTo(self, ref)}
        >
          {c.reroot}
        </Button>
      )}
    </span>
  );
};

const Toggle = ({
  lotNo,
  open,
  onToggle,
}: {
  lotNo: string;
  open: boolean;
  onToggle: () => void;
}) => (
  <button
    type="button"
    className="lot-trace-toggle"
    aria-expanded={open}
    aria-label={open ? c.collapse(lotNo) : c.expand(lotNo)}
    onClick={onToggle}
  >
    <span aria-hidden="true">{open ? '▾' : '▸'}</span>
  </button>
);

/* ── 정방향 나무 ─────────────────────────────────────────────────────── */

const ForwardWorkOrders = ({
  chain,
  seen,
  ctx,
  anchors,
}: {
  chain: ForwardChain;
  seen: ReadonlySet<number>;
  ctx: TreeContext<ForwardChain>;
  anchors: boolean;
}) => (
  <>
    {chain.workOrders.length === 0 && <Note>{c.noInput}</Note>}
    {chain.workOrders.map((wo, index) => (
      <ForwardWorkOrderNode
        key={wo.workOrderId}
        wo={wo}
        uomCode={chain.lot.uomCode}
        seen={seen}
        ctx={ctx}
        anchors={anchors && index === 0}
      />
    ))}
    {chain.truncated && <Note>{c.truncated(chain.totalProductionLotCount)}</Note>}
  </>
);

const ForwardWorkOrderNode = ({
  wo,
  uomCode,
  seen,
  ctx,
  anchors,
}: {
  wo: ForwardWorkOrder;
  uomCode: string;
  seen: ReadonlySet<number>;
  ctx: TreeContext<ForwardChain>;
  anchors: boolean;
}) => (
  <li className="lot-trace-node" data-stage={anchors ? 'CONSUMED' : undefined}>
    <span className="lot-trace-node-kind">{c.workOrder}</span>
    <span className="mono-cell">{wo.workOrderNo}</span>
    <span className="lot-trace-node-name" title={named(wo.item.name, wo.item.code)}>
      {wo.item.name}
    </span>
    <span>
      {c.consumed(
        qty(wo.consumedQty, uomCode),
        plantDateTime(wo.firstConsumedAt),
        plantDateTime(wo.lastConsumedAt),
      )}
    </span>
    {wo.linkBasis === null && <EstimateChip basis="inputOnly" />}
    {wo.linkBasis !== null && (
      <ul className="lot-trace-tree">
        {wo.productionLots.length === 0 && <Note>{c.noProductionLot}</Note>}
        {wo.productionLots.map((lot, index) => (
          <ProductionLotNode
            key={lot.lotId}
            lot={lot}
            seen={seen}
            ctx={ctx}
            anchors={anchors && index === 0}
          />
        ))}
      </ul>
    )}
  </li>
);

const ProductionLotNode = ({
  lot,
  seen,
  ctx,
  anchors,
}: {
  lot: FlowProductionLot;
  seen: ReadonlySet<number>;
  ctx: TreeContext<ForwardChain>;
  anchors: boolean;
}) => {
  const visited = lot.cyclic || seen.has(lot.lotId);
  const expandable = lot.consumedFurther > 0 && !visited;
  const open = expandable && ctx.expanded.has(lot.lotId);
  const next = ctx.chains.get(lot.lotId);
  return (
    <li className="lot-trace-node" data-stage={anchors ? 'PRODUCED' : undefined}>
      {expandable && (
        <Toggle lotNo={lot.lotNo} open={open} onToggle={() => ctx.toggle(lot.lotId)} />
      )}
      <span className="lot-trace-node-kind">{c.productionLot}</span>
      <span className="mono-cell">{lot.lotNo}</span>
      <span>{c.good(qty(lot.goodQty, lot.uomCode))}</span>
      <span>{plantDate(lot.completedAt)}</span>
      <EstimateChip basis={lot.linkBasis} />
      {visited && <VisitedChip />}
      <LotActions
        lot={lot}
        target="backward"
        self="forward"
        reroot={lot.consumedFurther > 0}
        ctx={ctx as TreeContext<unknown>}
      />
      <ul className="lot-trace-tree">
        <ProductSideNodes side={lot} uomCode={lot.uomCode} stageAnchors={anchors} />
        {open && next === undefined && ctx.pending.has(lot.lotId) && (
          <Note>
            <SkeletonText lines={1} />
          </Note>
        )}
        {open && next !== undefined && (
          <ForwardWorkOrders
            chain={next}
            seen={new Set([...seen, lot.lotId])}
            ctx={ctx}
            anchors={false}
          />
        )}
      </ul>
    </li>
  );
};

/* ── 역방향 나무 ─────────────────────────────────────────────────────── */

const BackwardInputs = ({
  chain,
  seen,
  ctx,
}: {
  chain: BackwardChain;
  seen: ReadonlySet<number>;
  ctx: TreeContext<BackwardChain>;
}) =>
  chain.workOrder === null || chain.inputMaterials.length === 0 ? (
    <>
      {chain.workOrder !== null && <BackwardWorkOrderLine chain={chain} />}
      <Note>{c.noInputMaterials}</Note>
    </>
  ) : (
    <li className="lot-trace-node">
      <span className="lot-trace-node-kind">{c.workOrder}</span>
      <BackwardWorkOrderText chain={chain} />
      <ul className="lot-trace-tree">
        {chain.inputMaterials.map((input) => (
          <InputMaterialNode key={input.lotId} input={input} seen={seen} ctx={ctx} />
        ))}
      </ul>
    </li>
  );

const BackwardWorkOrderText = ({ chain }: { chain: BackwardChain }) =>
  chain.workOrder === null ? null : (
    <>
      <span className="mono-cell">{chain.workOrder.workOrderNo}</span>
      <span>
        {c.results(
          chain.workOrder.results.count,
          qty(chain.workOrder.results.goodQty, chain.lot.uomCode),
          qty(chain.workOrder.results.defectQty, chain.lot.uomCode),
        )}
      </span>
    </>
  );

const BackwardWorkOrderLine = ({ chain }: { chain: BackwardChain }) => (
  <li className="lot-trace-node">
    <span className="lot-trace-node-kind">{c.workOrder}</span>
    <BackwardWorkOrderText chain={chain} />
  </li>
);

const InputMaterialNode = ({
  input,
  seen,
  ctx,
}: {
  input: FlowInputMaterial;
  seen: ReadonlySet<number>;
  ctx: TreeContext<BackwardChain>;
}) => {
  const visited = input.cyclic || seen.has(input.lotId);
  const expandable = input.producedBy !== null && !visited;
  const open = expandable && ctx.expanded.has(input.lotId);
  const next = ctx.chains.get(input.lotId);
  return (
    <li className="lot-trace-node">
      {expandable && (
        <Toggle lotNo={input.lotNo} open={open} onToggle={() => ctx.toggle(input.lotId)} />
      )}
      <span className="lot-trace-node-kind">{c.inputMaterials}</span>
      <span className="lot-trace-node-name" title={named(input.item.name, input.item.code)}>
        {input.item.name}
      </span>
      <span className="mono-cell">{input.lotNo}</span>
      <span>{qty(input.consumedQty, input.uomCode)}</span>
      {input.inbound !== null && (
        <>
          <span>{input.inbound.supplier.name}</span>
          <span>{plantDate(input.inbound.receiptDatetime)}</span>
          {input.inbound.supplierLotNo !== null && (
            <span>
              {c.supplierLot} <span className="mono-cell">{input.inbound.supplierLotNo}</span>
            </span>
          )}
        </>
      )}
      <EstimateChip basis={input.linkBasis} />
      {visited && <VisitedChip />}
      <LotActions
        lot={input}
        target="forward"
        self="backward"
        reroot={input.producedBy !== null}
        ctx={ctx as TreeContext<unknown>}
      />
      {open && (
        <ul className="lot-trace-tree">
          {next === undefined ? (
            <Note>
              <SkeletonText lines={1} />
            </Note>
          ) : (
            <BackwardInputs chain={next} seen={new Set([...seen, input.lotId])} ctx={ctx} />
          )}
        </ul>
      )}
    </li>
  );
};

/* ── 드로어 ─────────────────────────────────────────────────────────── */

const StageStrip = ({ cells, onJump }: { cells: StageCell[]; onJump: (stage: string) => void }) => {
  const current = currentStage(cells);
  return (
    <ol className="lot-trace-stages" aria-label={c.stagesLabel}>
      {cells.map((cell) => (
        <li
          key={cell.stage}
          className={`lot-trace-stage${cell.count === 0 ? ' is-empty' : ''}${cell.stage === current ? ' is-current' : ''}`}
          aria-current={cell.stage === current ? 'step' : undefined}
        >
          <button type="button" disabled={cell.count === 0} onClick={() => onJump(cell.stage)}>
            <span className="lot-trace-stage-name">{t.stages[cell.stage]}</span>
            <span className="lot-trace-stage-count">{c.stageCount(cell.count)}</span>
          </button>
        </li>
      ))}
    </ol>
  );
};

const exportColumns = (): CsvColumn<ChainLine>[] => {
  const kindName: Record<ChainLine['kind'], string> = {
    LOT: t.trace.lotNo,
    INBOUND: c.inbound,
    RECEIPT: c.receipt,
    WORK_ORDER: c.workOrder,
    PRODUCTION_LOT: c.productionLot,
    INPUT_MATERIAL: c.inputMaterials,
    PRODUCTION_RECEIPT: c.productionReceipt,
    PACKAGE: c.packing,
    SHIPMENT: c.shipment,
  };
  const x = c.exportColumns;
  return [
    { header: x.depth, value: (line) => String(line.depth) },
    { header: x.node, value: (line) => kindName[line.kind] },
    { header: x.number, value: (line) => line.number },
    { header: x.itemCode, value: (line) => line.item?.code ?? '' },
    { header: x.itemName, value: (line) => line.item?.name ?? '' },
    { header: x.qty, value: (line) => (line.qty === null ? '' : String(line.qty)) },
    { header: x.uom, value: (line) => (line.qty === null ? '' : line.uomCode) },
    { header: x.at, value: (line) => plantDateTime(line.at) },
    {
      header: x.partner,
      value: (line) => (line.partner === null ? '' : named(line.partner.name, line.partner.code)),
    },
    {
      header: x.basis,
      value: (line) =>
        line.basis === null
          ? ''
          : line.basis === 'INPUT_ONLY'
            ? c.estimate.inputOnly
            : c.estimate[line.basis],
    },
  ];
};

interface ChainViewProps {
  head: FlowLotHead;
  path: readonly PathStep[];
  direction: TraceDirection;
  canOpenLotStatus: boolean;
  impact: string;
  cells: StageCell[];
  hasEstimate: boolean;
  lines: () => ChainLine[];
  onOpenLot: ChainDrawerProps['onOpenLot'];
  children: ReactNode;
}

const ChainView = ({
  head,
  path,
  direction,
  canOpenLotStatus,
  impact,
  cells,
  hasEstimate,
  lines,
  onOpenLot,
  children,
}: ChainViewProps) => {
  const navigate = useNavigate();
  const tree = useRef<HTMLUListElement>(null);
  const lotStatus = useCodeNames('LOT_STATUS');
  const jump = (stage: string) => {
    const target = tree.current?.querySelector<HTMLElement>(`[data-stage="${stage}"]`);
    target?.scrollIntoView({ block: 'center' });
  };
  return (
    <>
      {path.length > 0 && (
        <nav className="lot-trace-path" aria-label={c.path}>
          <span className="lot-trace-path-label">{c.path}</span>
          {path.map((step, index) => (
            <span
              key={`${step.direction}-${step.lotId}-${String(index)}`}
              className="lot-trace-path-step"
            >
              <Button
                size="sm"
                variant="text"
                aria-label={c.backTo(step.lotNo)}
                onClick={() => onOpenLot(step.direction, step, path.slice(0, index))}
              >
                {step.lotType === 'MATERIAL'
                  ? c.pathMaterial(step.lotNo)
                  : c.pathProduct(step.lotNo)}
              </Button>
              <span aria-hidden="true">→</span>
            </span>
          ))}
          <span className="lot-trace-path-current">
            {lotTypeOf(head) === 'MATERIAL'
              ? c.pathMaterial(head.lotNo)
              : c.pathProduct(head.lotNo)}
          </span>
        </nav>
      )}
      <div className="lot-trace-chain-head">
        <span>{named(head.item.name, head.item.code)}</span>
        {head.statusCode !== NORMAL_LOT_STATUS && (
          <Chip variant="status" size="sm" status="warning">
            {lotStatus.nameOf(head.statusCode)}
          </Chip>
        )}
        <span className="lot-trace-chain-actions">
          {canOpenLotStatus && (
            <Button size="sm" variant="outlined" onClick={() => void navigate(lotStatusHref(head))}>
              {c.lotStatus}
            </Button>
          )}
          <Button
            size="sm"
            variant="outlined"
            onClick={() =>
              saveCsv(c.exportFileName(head.lotNo), toCsvText(exportColumns(), lines()))
            }
          >
            {c.exportChain}
          </Button>
        </span>
      </div>
      <p className="lot-trace-impact">{impact}</p>
      <StageStrip cells={cells} onJump={jump} />
      {hasEstimate && <AlertBanner variant="info">{c.estimateNotice}</AlertBanner>}
      <section className="lot-trace-chain" aria-label={c.tree}>
        <ul ref={tree} className="lot-trace-tree lot-trace-tree-root" data-direction={direction}>
          {children}
        </ul>
      </section>
    </>
  );
};

const useTreeState = <Chain,>(
  direction: TraceDirection,
  rootLot: LotRef | null,
  path: readonly PathStep[],
  onOpenLot: ChainDrawerProps['onOpenLot'],
): TreeContext<Chain> => {
  const [expanded, setExpanded] = useState<number[]>([]);
  const { chains, pending } = useExpandedChains<Chain>(direction, expanded);
  return {
    expanded: new Set(expanded),
    chains,
    pending,
    toggle: (lotId) =>
      setExpanded((current) =>
        current.includes(lotId) ? current.filter((id) => id !== lotId) : [...current, lotId],
      ),
    switchTo: (target, lot) => {
      if (rootLot === null) return;
      onOpenLot(target, lot, [...path, { direction, ...rootLot }]);
    },
  };
};

const ForwardBody = ({ lotId, ...props }: ChainDrawerProps) => {
  const query = useForwardChain(lotId);
  const head = query.data?.lot;
  const root: LotRef | null =
    head === undefined ? null : { lotId: head.lotId, lotNo: head.lotNo, lotType: lotTypeOf(head) };
  const ctx = useTreeState<ForwardChain>('forward', root, props.path, props.onOpenLot);
  if (query.isError) return <ChainError onRetry={() => void query.refetch()} />;
  if (query.data === undefined) return <ChainLoading />;
  const chain = query.data;
  const impact = forwardImpact(chain);
  const seen = new Set([...props.path.map((step) => step.lotId), chain.lot.lotId]);
  return (
    <ChainView
      head={chain.lot}
      path={props.path}
      direction="forward"
      canOpenLotStatus={props.canOpenLotStatus}
      impact={c.impactForward(impact.lots, impact.shipments, impact.customers)}
      cells={forwardStages(chain)}
      hasEstimate={chain.basis !== null}
      lines={() => flattenForward(chain, ctx.chains)}
      onOpenLot={props.onOpenLot}
    >
      {chain.inbound !== null && (
        <li className="lot-trace-node">
          <span className="lot-trace-node-kind">{c.inbound}</span>
          <span className="mono-cell">{chain.inbound.inboundReceiptNo}</span>
          <span>{plantDate(chain.inbound.receiptDatetime)}</span>
          <span>{named(chain.inbound.supplier.name, chain.inbound.supplier.code)}</span>
          {chain.inbound.supplierLotNo !== null && (
            <span>
              {c.supplierLot} <span className="mono-cell">{chain.inbound.supplierLotNo}</span>
            </span>
          )}
        </li>
      )}
      {chain.receipts.map((receipt, index) => (
        <li
          key={receipt.goodsReceiptId}
          className="lot-trace-node"
          data-stage={index === 0 ? 'RECEIVED' : undefined}
        >
          <span className="lot-trace-node-kind">{c.receipt}</span>
          <span className="mono-cell">{receipt.goodsReceiptNo}</span>
          <span>{qty(receipt.qty, chain.lot.uomCode)}</span>
          <span>{plantDate(receipt.receiptDatetime)}</span>
          <span>{receipt.warehouse.name}</span>
        </li>
      ))}
      <ForwardWorkOrders chain={chain} seen={seen} ctx={ctx} anchors />
    </ChainView>
  );
};

const BackwardBody = ({ lotId, ...props }: ChainDrawerProps) => {
  const query = useBackwardChain(lotId);
  const head = query.data?.lot;
  const root: LotRef | null =
    head === undefined ? null : { lotId: head.lotId, lotNo: head.lotNo, lotType: lotTypeOf(head) };
  const ctx = useTreeState<BackwardChain>('backward', root, props.path, props.onOpenLot);
  if (query.isError) return <ChainError onRetry={() => void query.refetch()} />;
  if (query.data === undefined) return <ChainLoading />;
  const chain = query.data;
  const impact = backwardImpact(chain);
  const seen = new Set([...props.path.map((step) => step.lotId), chain.lot.lotId]);
  return (
    <ChainView
      head={chain.lot}
      path={props.path}
      direction="backward"
      canOpenLotStatus={props.canOpenLotStatus}
      impact={c.impactBackward(impact.lots, impact.suppliers)}
      cells={backwardStages(chain)}
      hasEstimate={chain.basis !== null}
      lines={() => flattenBackward(chain, ctx.chains)}
      onOpenLot={props.onOpenLot}
    >
      <ProductSideNodes side={chain} uomCode={chain.lot.uomCode} stageAnchors />
      <BackwardInputs chain={chain} seen={seen} ctx={ctx} />
    </ChainView>
  );
};

const ChainLoading = () => (
  <div role="status" aria-label={c.loading}>
    <SkeletonText lines={6} />
  </div>
);

const ChainError = ({ onRetry }: { onRetry: () => void }) => (
  <AlertBanner
    variant="error"
    title={c.loadFailed}
    action={
      <Button size="sm" variant="outlined" onClick={onRetry}>
        {c.retry}
      </Button>
    }
  />
);

/**
 * LOT 하나의 사슬(T-W-A 드로어, 계획 2-4). 위에서 아래로: 경로 줄(지나온 LOT이 있을 때), 머리(품목, LOT 상태 칩,
 * [LOT 상태 보기], [사슬 내보내기]), 영향 요약, 단계 줄, 추정 안내, 들여쓴 나무.
 * 반제품은 한 번에 한 단씩 펼친다. 지나온 경로와 위 단계의 LOT은 다시 펼치지 않는다(서버는 자기 자신만 표시).
 */
export const ChainDrawer = (props: ChainDrawerProps) => (
  <DetailDrawer
    title={
      props.direction === 'forward' ? (
        <ForwardTitle lotId={props.lotId} />
      ) : (
        <BackwardTitle lotId={props.lotId} />
      )
    }
    onClose={props.onClose}
    className="lot-trace-drawer lot-trace-chain-drawer"
  >
    {props.direction === 'forward' ? (
      <ForwardBody key={props.lotId} {...props} />
    ) : (
      <BackwardBody key={props.lotId} {...props} />
    )}
  </DetailDrawer>
);

/** 드로어 머리 = LOT 번호(고정폭). 본문과 같은 조회(같은 캐시)를 읽는다. */
const ForwardTitle = ({ lotId }: { lotId: number }) => (
  <span className="mono-cell">{useForwardChain(lotId).data?.lot.lotNo ?? ''}</span>
);

const BackwardTitle = ({ lotId }: { lotId: number }) => (
  <span className="mono-cell">{useBackwardChain(lotId).data?.lot.lotNo ?? ''}</span>
);
