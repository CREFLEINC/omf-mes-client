import {
  AlertBanner,
  Button,
  Chip,
  Icon,
  SkeletonText,
  Stepper,
  Tooltip,
  type StepStatus,
} from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { useId, useRef, useState, type ReactNode } from 'react';
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
import { saveCsv, toCsvText, type CsvColumn } from '../../patterns/csv';
import { LoadFailure } from './load-failure';
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

/** 추정 칩. 칩에 마우스를 올리거나 초점을 두면 근거 한 문장이 보인다. */
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

/**
 * 생산 입고, 포장, 출하 — 문서로 이어진 단계라 근거 칩이 없다. 출하는 출하 번호 아래 취급 단위를 묶는다.
 * `stageAnchors`이면(첫 단의 LOT) 줄마다 단계 이름을 달아 단계 줄의 칸을 누르면 그 단계의 첫 줄로 간다.
 */
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
      {side.productionReceipts.map((receipt) => (
        <li
          key={`r-${receipt.goodsReceiptId}`}
          className="lot-trace-node"
          data-stage={stageAnchors ? 'PRODUCTION_RECEIVED' : undefined}
        >
          <span className="lot-trace-node-kind">{c.productionReceipt}</span>
          <span className="mono-cell">{receipt.goodsReceiptNo}</span>
          <span>{qty(receipt.qty, uomCode)}</span>
          <span>{plantDate(receipt.receiptDatetime)}</span>
          <span>{receipt.warehouse.name}</span>
        </li>
      ))}
      {side.packages.map((entry) => (
        <li
          key={`p-${entry.handlingUnitId}`}
          className="lot-trace-node"
          data-stage={stageAnchors ? 'PACKED' : undefined}
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
        groups.map((group) => (
          <li
            key={`s-${group.shipmentId}`}
            className="lot-trace-node"
            data-stage={stageAnchors ? 'SHIPPED' : undefined}
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
                    <span className="lot-trace-node-kind">{c.shipmentPackage}</span>
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
  failed: ReadonlySet<number>;
  retry: (lotId: number) => void;
  toggle: (lotId: number) => void;
  switchTo: (direction: TraceDirection, lot: LotRef) => void;
  /** 생산 LOT 아래 문서(생산 입고, 포장, 출하)를 접은 채 시작하는가. 생산 LOT이 잘린 큰 사슬에서 참이다. */
  documentsCollapsed: boolean;
  documentsOpen: ReadonlySet<number>;
  toggleDocuments: (lotId: number) => void;
}

/** 펼친 LOT의 다음 단을 받는 중이면 자리 표시, 실패하면 그 줄에 사유와 [다시 조회]. */
const ExpandStatus = ({
  lotId,
  lotNo,
  ctx,
}: {
  lotId: number;
  lotNo: string;
  ctx: TreeContext<unknown>;
}) => {
  if (ctx.failed.has(lotId)) {
    return (
      <li className="lot-trace-node lot-trace-note lot-trace-expand-failed">
        <span>{c.expandFailed}</span>
        <Button
          size="sm"
          variant="outlined"
          aria-label={c.retryFor(lotNo)}
          onClick={() => ctx.retry(lotId)}
        >
          {c.retry}
        </Button>
      </li>
    );
  }
  return ctx.pending.has(lotId) ? (
    <Note>
      <SkeletonText lines={1} />
    </Note>
  ) : null;
};

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
    <Icon name="expand_more" size={20} />
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
    {chain.workOrders.map((wo) => (
      <ForwardWorkOrderNode
        key={wo.workOrderId}
        wo={wo}
        uomCode={chain.lot.uomCode}
        seen={seen}
        ctx={ctx}
        anchors={anchors}
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
        {wo.productionLots.map((lot) => (
          <ProductionLotNode key={lot.lotId} lot={lot} seen={seen} ctx={ctx} anchors={anchors} />
        ))}
      </ul>
    )}
  </li>
);

const PRODUCT_STAGES = ['PRODUCTION_RECEIVED', 'PACKED', 'SHIPPED'] as const;

/**
 * 생산 LOT 아래 문서. 잘린 큰 사슬(`documentsCollapsed`)에서는 접은 채 시작하고 건수 단추로 편다.
 * 접힌 단추 줄에도 그 안의 단계 이름을 달아 단계 줄이 그 자리로 간다.
 */
const ProductDocuments = ({
  lot,
  ctx,
  anchors,
}: {
  lot: FlowProductionLot;
  ctx: TreeContext<ForwardChain>;
  anchors: boolean;
}) => {
  const counts = [
    lot.productionReceipts.length,
    lot.packages.length,
    groupShipments(lot.shipments).length,
  ];
  const total = counts.reduce((sum, count) => sum + count, 0);
  const listId = useId();
  if (!ctx.documentsCollapsed || total === 0) {
    return <ProductSideNodes side={lot} uomCode={lot.uomCode} stageAnchors={anchors} />;
  }
  const open = ctx.documentsOpen.has(lot.lotId);
  const stages = PRODUCT_STAGES.filter((_, index) => (counts[index] ?? 0) > 0).join(' ');
  return (
    <li className="lot-trace-node" data-stage={anchors && !open ? stages : undefined}>
      <button
        type="button"
        className="lot-trace-toggle lot-trace-documents-toggle"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => ctx.toggleDocuments(lot.lotId)}
      >
        <Icon name="expand_more" size={20} />
        {c.documents(total)}
      </button>
      {open && (
        <ul id={listId} className="lot-trace-tree">
          <ProductSideNodes side={lot} uomCode={lot.uomCode} stageAnchors={anchors} />
        </ul>
      )}
    </li>
  );
};

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
        <ProductDocuments lot={lot} ctx={ctx} anchors={anchors} />
        {open && next === undefined && (
          <ExpandStatus lotId={lot.lotId} lotNo={lot.lotNo} ctx={ctx as TreeContext<unknown>} />
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
  anchors,
}: {
  chain: BackwardChain;
  seen: ReadonlySet<number>;
  ctx: TreeContext<BackwardChain>;
  anchors: boolean;
}) =>
  chain.workOrder === null || chain.inputMaterials.length === 0 ? (
    <>
      {chain.workOrder !== null && <BackwardWorkOrderLine chain={chain} anchors={anchors} />}
      <Note>{c.noInputMaterials}</Note>
    </>
  ) : (
    <li className="lot-trace-node" data-stage={anchors ? 'PRODUCED' : undefined}>
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

const BackwardWorkOrderLine = ({ chain, anchors }: { chain: BackwardChain; anchors: boolean }) => (
  <li className="lot-trace-node" data-stage={anchors ? 'PRODUCED' : undefined}>
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
            <ExpandStatus
              lotId={input.lotId}
              lotNo={input.lotNo}
              ctx={ctx as TreeContext<unknown>}
            />
          ) : (
            <BackwardInputs
              chain={next}
              seen={new Set([...seen, input.lotId])}
              ctx={ctx}
              anchors={false}
            />
          )}
        </ul>
      )}
    </li>
  );
};

/* ── 드로어 ─────────────────────────────────────────────────────────── */

/**
 * 단계 줄 — 공정 흐름 순서의 DS Stepper. 가장 멀리 간 단계(건수가 있는 마지막 단계)가 진행 중, 그 앞에서 건수가 있는
 * 단계는 완료, 나머지는 대기다. 마지막 단계(출하)까지 갔으면 진행 중 없이 모든 단계가 완료다.
 * 단계를 누르면 나무에서 그 단계의 첫 줄로 간다.
 */
const StageStrip = ({ cells, onJump }: { cells: StageCell[]; onJump: (stage: string) => void }) => {
  const current = currentStage(cells);
  const currentIndex = cells.findIndex((cell) => cell.stage === current);
  /* 마지막 단계(출하)까지 갔으면 흐름이 끝난 것이라 진행 중 단계 없이 모두 완료다. */
  const finished = currentIndex === cells.length - 1;
  const statusOf = (cell: StageCell, index: number): StepStatus => {
    if (finished) return 'complete';
    if (index === currentIndex) return 'current';
    return index < currentIndex && cell.count > 0 ? 'complete' : 'pending';
  };
  return (
    <Stepper
      className="lot-trace-stages"
      size="sm"
      aria-label={c.stagesLabel}
      steps={cells.map((cell, index) => ({
        status: statusOf(cell, index),
        label: (
          <button
            type="button"
            className="lot-trace-stage-jump"
            disabled={cell.count === 0}
            onClick={() => onJump(cell.stage)}
          >
            <span>{t.stages[cell.stage]}</span>
            <span className="lot-trace-stage-count">{c.stageCount(cell.count)}</span>
          </button>
        ),
      }))}
    />
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
  /** 펼친 단을 받는 중이거나 받지 못했으면 그 사유. [사슬 내보내기]를 잠근다(C-4). */
  exportBlocked: string | null;
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
  exportBlocked,
  lines,
  onOpenLot,
  children,
}: ChainViewProps) => {
  const navigate = useNavigate();
  const tree = useRef<HTMLUListElement>(null);
  const lotStatus = useCodeNames('LOT_STATUS');
  const exportReasonId = useId();
  /* 단계 이름이 달린 줄 가운데 나무에서 처음 나오는 줄로 간다. 접힌 문서 줄은 단계 이름 여럿을 단다. */
  const jump = (stage: string) => {
    const target = tree.current?.querySelector<HTMLElement>(`[data-stage~="${stage}"]`);
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
            disabled={exportBlocked !== null}
            aria-describedby={exportBlocked === null ? undefined : exportReasonId}
            onClick={() =>
              saveCsv(c.exportFileName(head.lotNo), toCsvText(exportColumns(), lines()))
            }
          >
            {c.exportChain}
          </Button>
        </span>
      </div>
      {exportBlocked !== null && (
        <p id={exportReasonId} className="lot-trace-chain-blocked">
          {exportBlocked}
        </p>
      )}
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

const toggled = (current: number[], lotId: number): number[] =>
  current.includes(lotId) ? current.filter((id) => id !== lotId) : [...current, lotId];

const useTreeState = <Chain,>(
  direction: TraceDirection,
  rootLot: LotRef | null,
  path: readonly PathStep[],
  onOpenLot: ChainDrawerProps['onOpenLot'],
  documentsCollapsed: boolean,
): TreeContext<Chain> => {
  const [expanded, setExpanded] = useState<number[]>([]);
  const [documentsOpen, setDocumentsOpen] = useState<number[]>([]);
  const { chains, pending, failed, retry } = useExpandedChains<Chain>(direction, expanded);
  return {
    expanded: new Set(expanded),
    chains,
    pending,
    failed,
    retry,
    toggle: (lotId) => setExpanded((current) => toggled(current, lotId)),
    documentsCollapsed,
    documentsOpen: new Set(documentsOpen),
    toggleDocuments: (lotId) => setDocumentsOpen((current) => toggled(current, lotId)),
    switchTo: (target, lot) => {
      if (rootLot === null) return;
      onOpenLot(target, lot, [...path, { direction, ...rootLot }]);
    },
  };
};

/** 펼친 단이 다 오지 않았으면 내보낸 파일에 그 단이 빠진다. 그동안 [사슬 내보내기]를 잠근다. */
const exportBlockedBy = (ctx: TreeContext<unknown>): string | null =>
  ctx.failed.size > 0 ? c.exportFailed : ctx.pending.size > 0 ? c.exportPending : null;

const ForwardBody = ({ lotId, ...props }: ChainDrawerProps) => {
  const query = useForwardChain(lotId);
  const head = query.data?.lot;
  const root: LotRef | null =
    head === undefined ? null : { lotId: head.lotId, lotNo: head.lotNo, lotType: lotTypeOf(head) };
  const ctx = useTreeState<ForwardChain>(
    'forward',
    root,
    props.path,
    props.onOpenLot,
    query.data?.truncated === true,
  );
  if (query.isError) return <ChainError error={query.error} onRetry={() => void query.refetch()} />;
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
      exportBlocked={exportBlockedBy(ctx as TreeContext<unknown>)}
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
      {chain.receipts.map((receipt) => (
        <li key={receipt.goodsReceiptId} className="lot-trace-node" data-stage="RECEIVED">
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
  const ctx = useTreeState<BackwardChain>('backward', root, props.path, props.onOpenLot, false);
  if (query.isError) return <ChainError error={query.error} onRetry={() => void query.refetch()} />;
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
      exportBlocked={exportBlockedBy(ctx as TreeContext<unknown>)}
      lines={() => flattenBackward(chain, ctx.chains)}
      onOpenLot={props.onOpenLot}
    >
      <ProductSideNodes side={chain} uomCode={chain.lot.uomCode} stageAnchors />
      <BackwardInputs chain={chain} seen={seen} ctx={ctx} anchors />
    </ChainView>
  );
};

const ChainLoading = () => (
  <div role="status" aria-label={c.loading}>
    <SkeletonText lines={6} />
  </div>
);

const ChainError = ({ error, onRetry }: { error: unknown; onRetry: () => void }) => (
  <LoadFailure error={error} title={c.loadFailed} onRetry={onRetry} />
);

/**
 * LOT 하나의 사슬(T-W-A 드로어). 위에서 아래로: 경로 줄(지나온 LOT이 있을 때), 머리(품목, LOT 상태 칩,
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

/**
 * 드로어 머리 = LOT 번호(고정폭). 본문과 같은 조회(같은 캐시)를 읽는다. 불러오지 못하면 LOT 번호를 모르므로
 * 머리가 비지 않게 「LOT 사슬」을 둔다.
 */
const ChainTitle = ({ lotNo, failed }: { lotNo: string | undefined; failed: boolean }) =>
  lotNo !== undefined ? (
    <span className="mono-cell">{lotNo}</span>
  ) : (
    <span>{failed ? c.title : ''}</span>
  );

const ForwardTitle = ({ lotId }: { lotId: number }) => {
  const query = useForwardChain(lotId);
  return <ChainTitle lotNo={query.data?.lot.lotNo} failed={query.isError} />;
};

const BackwardTitle = ({ lotId }: { lotId: number }) => {
  const query = useBackwardChain(lotId);
  return <ChainTitle lotNo={query.data?.lot.lotNo} failed={query.isError} />;
};
