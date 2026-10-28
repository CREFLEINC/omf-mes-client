import {
  AlertBanner,
  Button,
  Chip,
  EmptyState,
  Icon,
  SkeletonText,
  Stepper,
  Table,
  Tooltip,
  type Column,
  type StepStatus,
} from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router';

import { saveCsv, toCsvText, type CsvColumn } from '../../patterns/csv';
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
  uniqueProductionLots,
  type ChainLine,
  type ShipmentGroup,
  type StageCell,
} from './chain-model';
import { LoadFailure, toLoadCause } from './load-failure';
import { useCodeNames } from './queries';
import { formatQty } from './rows';
import type { PathStep } from './trace-filters';
import { useBackwardChain, useForwardChain } from './trace-queries';
import { plantDate, plantDateTime } from './trace-table';
import type {
  BackwardChain,
  FlowBasis,
  FlowInputMaterial,
  FlowLotHead,
  FlowPackage,
  FlowProductionLot,
  FlowProductSide,
  FlowReceipt,
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

/** 상세 가운데 둘 LOT. [보기]가 넘긴다. */
export type LotRef = PathStep;

export interface LotDetailProps {
  lotId: number;
  /** 지나온 LOT(먼저 본 것부터). 비면 목록에서 고른 LOT이다. */
  path: readonly PathStep[];
  canOpenLotStatus: boolean;
  /** 다른 LOT을 가운데 둔다. 목록과 탭은 그대로다. `path`는 그 LOT까지 지나온 경로다. */
  onCenter: (lot: LotRef, path: PathStep[]) => void;
}

const lotTypeOf = (head: FlowLotHead): PathStep['lotType'] =>
  head.lotTypeCode === 'MATERIAL' ? 'MATERIAL' : 'PRODUCTION';

const refOf = (head: FlowLotHead): LotRef => ({
  lotId: head.lotId,
  lotNo: head.lotNo,
  lotType: lotTypeOf(head),
});

const qty = (value: number, uomCode: string): string => `${formatQty(value)} ${uomCode}`.trim();

/* ── 작은 조각 ───────────────────────────────────────────────────────── */

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

/** 항목명(위)과 값(아래)의 격자. 값이 없는 항목은 그리지 않는다(C-10). */
interface Fact {
  key: string;
  label: string;
  value: ReactNode;
  /** 긴 값(품목, 공급사)은 두 칸을 쓴다. */
  wide?: boolean;
}

const Facts = ({ items, compact = false }: { items: (Fact | null)[]; compact?: boolean }) => (
  <dl className={compact ? 'lot-trace-facts is-compact' : 'lot-trace-facts'}>
    {items
      .filter((item): item is Fact => item !== null)
      .map((item) => (
        <div
          key={item.key}
          className={item.wide === true ? 'lot-trace-fact is-wide' : 'lot-trace-fact'}
        >
          <dt className="field-label">{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
  </dl>
);

const Mono = ({ children }: { children: string }) => (
  <span className="mono-cell" title={children}>
    {children}
  </span>
);

const Ellipsis = ({ text, title }: { text: string; title?: string }) => (
  <span className="ellipsis-cell" title={title ?? text}>
    {text}
  </span>
);

const ViewButton = ({ lot, onView }: { lot: LotRef; onView: (lot: LotRef) => void }) => (
  <Button
    size="sm"
    variant="outlined"
    aria-label={c.viewFor(lot.lotNo)}
    onClick={() => onView(lot)}
  >
    {c.view}
  </Button>
);

/** 상세 안 구획. 단계 줄의 칸을 누르면 `stage`가 맞는 첫 구획으로 간다. */
const Section = ({
  title,
  stage,
  aside,
  children,
}: {
  title: string;
  stage?: string;
  aside?: ReactNode;
  children: ReactNode;
}) => (
  <section className="lot-trace-section" aria-label={title} data-stage={stage}>
    <div className="lot-trace-section-head">
      <h3 className="subsection-title">{title}</h3>
      {aside}
    </div>
    {children}
  </section>
);

/** 구획 안의 작은 표 하나. 이름표를 달고, 줄이 없으면 표 대신 한 줄 안내다. */
const SmallTable = <Row,>({
  title,
  heading = true,
  stage,
  columns,
  rows,
  getRowId,
  empty,
  sticky = false,
}: {
  title: string;
  /** 마지막 열(행 동작)을 오른쪽에 붙여 둔다. */
  sticky?: boolean;
  /** 거짓이면 이름표를 두지 않는다(구획 제목이 이미 같은 말을 할 때). 표의 접근 이름으로는 남는다. */
  heading?: boolean;
  stage?: string;
  columns: Column<Row>[];
  rows: Row[];
  getRowId: (row: Row) => string;
  empty: string;
}) => (
  <div className="lot-trace-block" data-stage={stage}>
    {heading && <h4 className="lot-trace-block-title">{title}</h4>}
    {rows.length === 0 ? (
      <p className="field-note lot-trace-block-empty">{empty}</p>
    ) : (
      <div className={sticky ? 'lot-trace-detail-table has-action' : 'lot-trace-detail-table'}>
        <Table
          caption={<span className="visually-hidden">{title}</span>}
          density="compact"
          columns={columns}
          rows={rows}
          getRowId={getRowId}
        />
      </div>
    )}
  </div>
);

/* ── 표의 열 ─────────────────────────────────────────────────────────── */

const k = c.columns;

const receiptColumns = (uomCode: string): Column<FlowReceipt>[] => [
  {
    key: 'no',
    header: k.receiptNo,
    render: (row) => <Mono>{row.goodsReceiptNo}</Mono>,
  },
  {
    key: 'date',
    header: k.receiptDate,
    align: 'center',
    render: (row) => plantDate(row.receiptDatetime),
  },
  {
    key: 'qty',
    header: k.qty,
    align: 'end',
    render: (row) => qty(row.qty, uomCode),
  },
  {
    key: 'warehouse',
    header: k.warehouse,
    render: (row) => <Ellipsis text={row.warehouse.name} />,
  },
];

const packageColumns = (uomCode: string): Column<FlowPackage>[] => [
  {
    key: 'no',
    header: k.handlingUnitNo,
    render: (row) => <Mono>{row.handlingUnitNo}</Mono>,
  },
  {
    key: 'qty',
    header: k.qty,
    align: 'end',
    render: (row) => qty(row.qty, uomCode),
  },
  {
    key: 'shippingUnit',
    header: k.shippingUnitNo,
    render: (row) =>
      row.shippingUnit === null ? null : <Mono>{row.shippingUnit.shippingUnitNo}</Mono>,
  },
  {
    key: 'status',
    header: k.packingStatus,
    align: 'center',
    render: (row) =>
      row.statusCode === PACKED ? (
        c.packed
      ) : (
        <Chip variant="status" size="sm" status="warning">
          {c.packingOpen}
        </Chip>
      ),
  },
];

const shipmentColumns = (uomCode: string): Column<ShipmentGroup>[] => [
  {
    key: 'no',
    header: k.shipmentNo,
    render: (row) => <Mono>{row.shipmentNo}</Mono>,
  },
  {
    key: 'date',
    header: k.shippedAt,
    align: 'center',
    render: (row) => plantDate(row.shippedAt),
  },
  {
    key: 'qty',
    header: k.qty,
    align: 'end',
    render: (row) => qty(row.qty, uomCode),
  },
  {
    key: 'customer',
    header: k.customerName,
    render: (row) => (
      <Ellipsis text={row.customer.name} title={named(row.customer.name, row.customer.code)} />
    ),
  },
];

/**
 * 제품입고, 포장, 출하 세 표. 생산 LOT 하나의 아래 단계다. `sections`이면(가운데 LOT이 생산 LOT) 표마다 구획으로
 * 세우고, 아니면(자재 LOT의 생산 LOT 묶음 안) 이름표 단 작은 표로 둔다.
 */
const ProductSideTables = ({
  side,
  uomCode,
  sections,
}: {
  side: FlowProductSide;
  uomCode: string;
  sections: boolean;
}) => {
  const tables = [
    {
      stage: 'PRODUCTION_RECEIVED',
      node: (
        <SmallTable
          title={c.sections.productionReceipt}
          heading={!sections}
          stage={sections ? undefined : 'PRODUCTION_RECEIVED'}
          columns={receiptColumns(uomCode)}
          rows={side.productionReceipts}
          getRowId={(row) => String(row.goodsReceiptId)}
          empty={c.noProductionReceipt}
        />
      ),
      title: c.sections.productionReceipt,
    },
    {
      stage: 'PACKED',
      node: (
        <SmallTable
          title={c.sections.packing}
          heading={!sections}
          stage={sections ? undefined : 'PACKED'}
          columns={packageColumns(uomCode)}
          rows={side.packages}
          getRowId={(row) => String(row.handlingUnitId)}
          empty={c.noPacking}
        />
      ),
      title: c.sections.packing,
    },
    {
      stage: 'SHIPPED',
      node: (
        <SmallTable
          title={c.sections.shipment}
          heading={!sections}
          stage={sections ? undefined : 'SHIPPED'}
          columns={shipmentColumns(uomCode)}
          rows={groupShipments(side.shipments)}
          getRowId={(row) => String(row.shipmentId)}
          empty={c.noShipment}
        />
      ),
      title: c.sections.shipment,
    },
  ];
  return (
    <>
      {tables.map((table) =>
        sections ? (
          <Section key={table.stage} title={table.title} stage={table.stage}>
            {table.node}
          </Section>
        ) : (
          <div key={table.stage}>{table.node}</div>
        ),
      )}
    </>
  );
};

/* ── 사용처(자재 LOT, 반제품 LOT의 아래 방향) ────────────────────────── */

const usageColumns = (uomCode: string, withBasis: boolean): Column<ForwardWorkOrder>[] => [
  {
    key: 'no',
    header: k.workOrderNo,
    render: (row) => <Mono>{row.workOrderNo}</Mono>,
  },
  {
    key: 'item',
    header: k.itemName,
    render: (row) => <Ellipsis text={row.item.name} title={named(row.item.name, row.item.code)} />,
  },
  {
    key: 'qty',
    header: k.consumedQty,
    align: 'end',
    render: (row) => qty(row.consumedQty, uomCode),
  },
  {
    key: 'first',
    header: k.firstConsumedAt,
    align: 'center',
    render: (row) => plantDateTime(row.firstConsumedAt),
  },
  {
    key: 'last',
    header: k.lastConsumedAt,
    align: 'center',
    render: (row) => plantDateTime(row.lastConsumedAt),
  },
  ...(withBasis
    ? [
        {
          key: 'basis',
          header: k.basis,
          align: 'center' as const,
          render: (row: ForwardWorkOrder) =>
            row.linkBasis === null ? <EstimateChip basis="inputOnly" /> : null,
        },
      ]
    : []),
];

/** 생산 LOT마다 W/O 번호(여러 W/O에 걸친 LOT도 있다). */
const workOrdersOf = (chain: ForwardChain, lotId: number): string[] =>
  chain.workOrders
    .filter((wo) => wo.productionLots.some((lot) => lot.lotId === lotId))
    .map((wo) => wo.workOrderNo);

/** 생산 LOT이 이보다 많으면 묶음을 접은 채 시작한다. 펼치면 그 LOT의 제품입고, 포장, 출하가 보인다. */
const OPEN_GROUPS = 3;

const ProductionLotGroup = ({
  lot,
  workOrders,
  open,
  onView,
}: {
  lot: FlowProductionLot;
  workOrders: string[];
  open: boolean;
  onView: (lot: LotRef) => void;
}) => {
  const shipments = groupShipments(lot.shipments).length;
  const stages = [
    lot.productionReceipts.length > 0 ? 'PRODUCTION_RECEIVED' : '',
    lot.packages.length > 0 ? 'PACKED' : '',
    shipments > 0 ? 'SHIPPED' : '',
  ]
    .filter((stage) => stage !== '')
    .join(' ');
  return (
    <details className="lot-trace-group" open={open} data-stage={`PRODUCED ${stages}`.trim()}>
      <summary className="lot-trace-group-summary">
        <Icon name="expand_more" size={20} />
        <span className="field-label">{c.lotType.PRODUCTION}</span>
        <span className="mono-cell lot-trace-group-lot">{lot.lotNo}</span>
        <span className="lot-trace-group-counts">
          {c.documentCounts(lot.productionReceipts.length, lot.packages.length, shipments)}
        </span>
      </summary>
      <div className="lot-trace-group-body">
        <div className="lot-trace-group-head">
          <Facts
            items={[
              {
                key: 'item',
                label: c.facts.item,
                wide: true,
                value: (
                  <Ellipsis
                    text={named(lot.item.name, lot.item.code)}
                    title={named(lot.item.name, lot.item.code)}
                  />
                ),
              },
              {
                key: 'wo',
                label: c.facts.workOrderNo,
                value: <Mono>{workOrders.join(', ')}</Mono>,
              },
              { key: 'good', label: c.facts.goodQty, value: qty(lot.goodQty, lot.uomCode) },
              lot.completedAt === null
                ? null
                : { key: 'done', label: c.facts.completedAt, value: plantDate(lot.completedAt) },
              { key: 'basis', label: c.facts.basis, value: <EstimateChip basis={lot.linkBasis} /> },
            ]}
          />
          <ViewButton lot={refOf(lot)} onView={onView} />
        </div>
        <ProductSideTables side={lot} uomCode={lot.uomCode} sections={false} />
      </div>
    </details>
  );
};

/** 사용처: 이 LOT이 투입된 W/O 표, 그리고 그 W/O로 만든 생산 LOT마다 제품입고, 포장, 출하. */
const UsageSections = ({
  chain,
  onView,
}: {
  chain: ForwardChain;
  onView: (lot: LotRef) => void;
}) => {
  const lots = uniqueProductionLots(chain);
  return (
    <>
      <Section title={c.sections.usage} stage="CONSUMED">
        <SmallTable
          title={c.sections.usage}
          heading={false}
          columns={usageColumns(
            chain.lot.uomCode,
            chain.workOrders.some((wo) => wo.linkBasis === null),
          )}
          rows={chain.workOrders}
          getRowId={(row) => String(row.workOrderId)}
          empty={c.noInput}
        />
      </Section>
      {chain.workOrders.length > 0 && (
        <Section
          title={c.sections.productionLots}
          stage="PRODUCED"
          aside={<span className="lot-trace-section-count">{c.count(lots.length)}</span>}
        >
          {lots.length === 0 && <p className="field-note">{c.noProductionLot}</p>}
          {lots.map((lot) => (
            <ProductionLotGroup
              key={lot.lotId}
              lot={lot}
              workOrders={workOrdersOf(chain, lot.lotId)}
              open={lots.length <= OPEN_GROUPS}
              onView={onView}
            />
          ))}
          {chain.truncated && (
            <AlertBanner variant="info">{c.truncated(chain.totalProductionLotCount)}</AlertBanner>
          )}
        </Section>
      )}
    </>
  );
};

/* ── 투입 자재(생산 LOT의 위 방향) ────────────────────────────────────── */

const inputColumns = (
  onView: (lot: LotRef) => void,
  withBasis: boolean,
): Column<FlowInputMaterial>[] => [
  {
    key: 'lot',
    header: k.materialLot,
    render: (row) => <Mono>{row.lotNo}</Mono>,
  },
  {
    key: 'item',
    header: k.itemName,
    render: (row) => <Ellipsis text={row.item.name} title={named(row.item.name, row.item.code)} />,
  },
  {
    key: 'qty',
    header: k.consumedQty,
    align: 'end',
    render: (row) => qty(row.consumedQty, row.uomCode),
  },
  {
    key: 'supplier',
    header: k.supplierName,
    render: (row) =>
      row.inbound === null ? null : (
        <Ellipsis
          text={row.inbound.supplier.name}
          title={named(row.inbound.supplier.name, row.inbound.supplier.code)}
        />
      ),
  },
  {
    key: 'inboundAt',
    header: k.inboundAt,
    align: 'center',
    render: (row) => (row.inbound === null ? null : plantDate(row.inbound.receiptDatetime)),
  },
  {
    key: 'supplierLot',
    header: k.supplierLot,
    render: (row) =>
      row.inbound?.supplierLotNo == null ? null : <Mono>{row.inbound.supplierLotNo}</Mono>,
  },
  ...(withBasis
    ? [
        {
          key: 'basis',
          header: k.basis,
          align: 'center' as const,
          render: (row: FlowInputMaterial) => <EstimateChip basis={row.linkBasis} />,
        },
      ]
    : []),
  {
    key: 'action',
    header: k.action,
    align: 'center',
    render: (row) => <ViewButton lot={refOf(row)} onView={onView} />,
  },
];

const ProductionSections = ({
  chain,
  onView,
}: {
  chain: BackwardChain;
  onView: (lot: LotRef) => void;
}) => {
  const wo = chain.workOrder;
  const uom = chain.lot.uomCode;
  return (
    <>
      <Section title={c.sections.production} stage="PRODUCED">
        {wo === null ? (
          <p className="field-note">{c.noProduction}</p>
        ) : (
          <Facts
            items={[
              { key: 'wo', label: c.facts.workOrderNo, value: <Mono>{wo.workOrderNo}</Mono> },
              { key: 'good', label: c.facts.goodQty, value: qty(chain.goodQty, uom) },
              chain.lot.completedAt === null
                ? null
                : {
                    key: 'done',
                    label: c.facts.completedAt,
                    value: plantDate(chain.lot.completedAt),
                  },
              { key: 'count', label: c.facts.woResultCount, value: c.count(wo.results.count) },
              { key: 'woGood', label: c.facts.woGoodQty, value: qty(wo.results.goodQty, uom) },
              {
                key: 'woDefect',
                label: c.facts.woDefectQty,
                value: qty(wo.results.defectQty, uom),
              },
            ]}
          />
        )}
      </Section>
      <Section title={c.sections.inputs}>
        <SmallTable
          title={c.sections.inputs}
          heading={false}
          sticky
          columns={inputColumns(
            onView,
            chain.inputMaterials.some((input) => input.linkBasis !== null),
          )}
          rows={chain.inputMaterials}
          getRowId={(row) => String(row.lotId)}
          empty={c.noInputMaterials}
        />
      </Section>
      <ProductSideTables side={chain} uomCode={uom} sections />
    </>
  );
};

/* ── 단계 줄 ─────────────────────────────────────────────────────────── */

/**
 * 단계 줄 — 공정 흐름 순서의 DS Stepper. 가장 멀리 간 단계(건수가 있는 마지막 단계)가 진행 중, 그 앞에서 건수가 있는
 * 단계는 완료, 나머지는 대기다. 마지막 단계(출하)까지 갔으면 진행 중 없이 모든 단계가 완료다.
 * 단계를 누르면 상세에서 그 단계의 첫 구획으로 간다.
 */
const StageStrip = ({ cells, onJump }: { cells: StageCell[]; onJump: (stage: string) => void }) => {
  const current = currentStage(cells);
  const currentIndex = cells.findIndex((cell) => cell.stage === current);
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

/* ── 내보내기 ────────────────────────────────────────────────────────── */

const exportColumns = (): CsvColumn<ChainLine>[] => {
  const x = c.exportColumns;
  return [
    { header: x.depth, value: (line) => String(line.depth) },
    { header: x.node, value: (line) => c.exportKinds[line.kind] },
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

const NO_EXPANDED = new Map<number, never>();

/* ── 상세 ────────────────────────────────────────────────────────────── */

const Loading = () => (
  <div role="status" aria-label={c.loading}>
    <SkeletonText lines={6} />
  </div>
);

/** 경로 줄 — [이전 LOT]과 지나온 LOT들. 누르면 그 LOT을 다시 가운데 둔다. */
const PathBar = ({
  path,
  here,
  onCenter,
}: {
  path: readonly PathStep[];
  here: LotRef;
  onCenter: LotDetailProps['onCenter'];
}) => {
  const prev = path.at(-1);
  if (prev === undefined) return null;
  const name = (step: LotRef) =>
    step.lotType === 'MATERIAL' ? c.pathMaterial(step.lotNo) : c.pathProduct(step.lotNo);
  return (
    <nav className="lot-trace-path" aria-label={c.path}>
      <Button
        size="sm"
        variant="outlined"
        className="lot-trace-back"
        onClick={() => onCenter(prev, path.slice(0, -1))}
      >
        <Icon name="arrow_back" size={16} />
        {c.back}
      </Button>
      <span className="lot-trace-path-steps">
        {path.map((step, index) => (
          <span key={`${String(step.lotId)}-${String(index)}`} className="lot-trace-path-step">
            <Button
              size="sm"
              variant="text"
              aria-label={c.backTo(step.lotNo)}
              onClick={() => onCenter(step, path.slice(0, index))}
            >
              {name(step)}
            </Button>
            <Icon name="chevron_right" size={16} />
          </span>
        ))}
        <span className="lot-trace-path-current" aria-current="true">
          {name(here)}
        </span>
      </span>
    </nav>
  );
};

interface ViewProps {
  head: FlowLotHead;
  path: readonly PathStep[];
  canOpenLotStatus: boolean;
  onCenter: LotDetailProps['onCenter'];
  impact: Fact[];
  cells: StageCell[];
  estimated: boolean;
  lines: () => ChainLine[];
  children: ReactNode;
}

/** 상세의 틀: 경로 줄, 머리(LOT 종류, LOT 번호, LOT 상태, 동작), 요약 항목, 단계 줄, 추정 안내, 구획들. */
const DetailFrame = ({
  head,
  path,
  canOpenLotStatus,
  onCenter,
  impact,
  cells,
  estimated,
  lines,
  children,
}: ViewProps) => {
  const navigate = useNavigate();
  const lotStatus = useCodeNames('LOT_STATUS');
  const body = useRef<HTMLDivElement>(null);
  const type = lotTypeOf(head);
  const jump = (stage: string) => {
    const target = body.current?.querySelector<HTMLElement>(`[data-stage~="${stage}"]`);
    if (target instanceof HTMLDetailsElement) target.open = true;
    target?.scrollIntoView({ block: 'start' });
  };
  return (
    <div ref={body} className="lot-trace-detail">
      <PathBar path={path} here={refOf(head)} onCenter={onCenter} />
      <header className="lot-trace-detail-head">
        <div className="lot-trace-detail-title">
          <Chip variant="status" size="sm" status="idle">
            {c.lotType[type]}
          </Chip>
          <h2 className="subsection-title mono-cell">{head.lotNo}</h2>
          {head.statusCode !== NORMAL_LOT_STATUS && (
            <Chip variant="status" size="sm" status="warning">
              {lotStatus.nameOf(head.statusCode)}
            </Chip>
          )}
        </div>
        <div className="lot-trace-detail-actions">
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
        </div>
      </header>
      <Facts
        compact
        items={[
          {
            key: 'item',
            label: c.facts.item,
            wide: true,
            value: <Ellipsis text={named(head.item.name, head.item.code)} />,
          },
          ...impact,
        ]}
      />
      <StageStrip cells={cells} onJump={jump} />
      {estimated && <AlertBanner variant="info">{c.estimateNotice}</AlertBanner>}
      {children}
    </div>
  );
};

type FrameProps = Pick<ViewProps, 'path' | 'canOpenLotStatus' | 'onCenter'>;

const MaterialView = ({ chain, ...frame }: FrameProps & { chain: ForwardChain }) => {
  const impact = forwardImpact(chain);
  const view = (lot: LotRef) => frame.onCenter(lot, [...frame.path, refOf(chain.lot)]);
  const inbound = chain.inbound;
  return (
    <DetailFrame
      {...frame}
      head={chain.lot}
      impact={[
        {
          key: 'received',
          label: c.facts.receivedQty,
          value: qty(chain.receivedQty, chain.lot.uomCode),
        },
        { key: 'lots', label: c.facts.productionLotCount, value: c.count(impact.lots) },
        { key: 'shipments', label: c.facts.shipmentCount, value: c.count(impact.shipments) },
        { key: 'customers', label: c.facts.customerCount, value: c.count(impact.customers) },
      ]}
      cells={forwardStages(chain)}
      estimated={chain.basis !== null}
      lines={() => flattenForward(chain, NO_EXPANDED)}
    >
      <Section title={c.sections.inbound} stage="RECEIVED">
        {inbound === null ? (
          <p className="field-note">{c.noInbound}</p>
        ) : (
          <Facts
            items={[
              {
                key: 'no',
                label: c.facts.inboundNo,
                value: <Mono>{inbound.inboundReceiptNo}</Mono>,
              },
              { key: 'at', label: c.facts.inboundAt, value: plantDate(inbound.receiptDatetime) },
              {
                key: 'supplier',
                label: c.facts.supplier,
                wide: true,
                value: <Ellipsis text={named(inbound.supplier.name, inbound.supplier.code)} />,
              },
              inbound.supplierLotNo === null
                ? null
                : {
                    key: 'supplierLot',
                    label: c.facts.supplierLot,
                    value: <Mono>{inbound.supplierLotNo}</Mono>,
                  },
            ]}
          />
        )}
        <SmallTable
          title={c.sections.materialReceipt}
          columns={receiptColumns(chain.lot.uomCode)}
          rows={chain.receipts}
          getRowId={(row) => String(row.goodsReceiptId)}
          empty={c.noReceipt}
        />
      </Section>
      <UsageSections chain={chain} onView={view} />
    </DetailFrame>
  );
};

const ProductionView = ({
  chain,
  usage,
  usageError,
  onRetryUsage,
  ...frame
}: FrameProps & {
  chain: BackwardChain;
  /** 다시 투입된 반제품이면 그 정방향 사슬. 투입된 적이 없으면 `undefined`. */
  usage: ForwardChain | undefined;
  usageError: boolean;
  onRetryUsage: () => void;
}) => {
  const impact = backwardImpact(chain);
  const view = (lot: LotRef) => frame.onCenter(lot, [...frame.path, refOf(chain.lot)]);
  return (
    <DetailFrame
      {...frame}
      head={chain.lot}
      impact={[
        { key: 'good', label: c.facts.goodQty, value: qty(chain.goodQty, chain.lot.uomCode) },
        { key: 'inputs', label: c.facts.inputLotCount, value: c.count(impact.lots) },
        { key: 'suppliers', label: c.facts.supplierCount, value: c.count(impact.suppliers) },
      ]}
      cells={backwardStages(chain)}
      estimated={chain.basis !== null || (usage !== undefined && usage.basis !== null)}
      lines={() => [
        ...flattenBackward(chain, NO_EXPANDED),
        ...(usage === undefined
          ? []
          : flattenForward(usage, NO_EXPANDED).filter((line) => line.depth > 0)),
      ]}
    >
      <ProductionSections chain={chain} onView={view} />
      {usage !== undefined && <UsageSections chain={usage} onView={view} />}
      {usageError && (
        <AlertBanner
          variant="error"
          title={c.usageFailed}
          action={
            <Button size="sm" variant="outlined" onClick={onRetryUsage}>
              {c.retry}
            </Button>
          }
        />
      )}
    </DetailFrame>
  );
};

/**
 * 고른 LOT 하나의 추적(T-W-A 상세 창). 그 LOT을 가운데 두고 위 방향과 아래 방향을 한 번에 보인다.
 * - 자재 LOT: 입하, 자재 입고, 사용처(투입된 W/O), 생산 LOT마다 제품입고, 포장, 출하.
 * - 생산 LOT: 생산 실적, 투입 자재, 제품입고, 포장, 출하. 다시 투입된 반제품이면 사용처도 잇는다.
 * 두 사슬(정방향, 역방향)을 함께 부르고, 응답의 LOT 종류로 무엇을 보일지 정한다. 상세 안의 LOT은 [보기]로
 * 가운데에 다시 둔다(목록과 탭은 그대로). 지나온 LOT은 머리 위 경로 줄과 [이전 LOT]으로 되돌아간다.
 */
export const LotDetail = ({ lotId, ...frame }: LotDetailProps) => {
  const forward = useForwardChain(lotId);
  const backward = useBackwardChain(lotId);
  const head = forward.data?.lot ?? backward.data?.lot;

  if (head === undefined) {
    if (forward.isPending || backward.isPending) return <Loading />;
    /* 둘 다 실패했다. 없는 LOT(404)보다 다른 원인(권한, 서버 오류)을 먼저 보인다. */
    const errors = [forward.error, backward.error];
    return (
      <LoadFailure
        error={errors.find((error) => toLoadCause(error) !== 'notFound') ?? errors[0]}
        title={c.loadFailed}
        onRetry={() => {
          void forward.refetch();
          void backward.refetch();
        }}
      />
    );
  }

  if (lotTypeOf(head) === 'MATERIAL') {
    if (forward.data !== undefined) return <MaterialView chain={forward.data} {...frame} />;
    return forward.isPending ? (
      <Loading />
    ) : (
      <LoadFailure
        error={forward.error}
        title={c.loadFailed}
        onRetry={() => void forward.refetch()}
      />
    );
  }
  if (backward.data === undefined) {
    return backward.isPending ? (
      <Loading />
    ) : (
      <LoadFailure
        error={backward.error}
        title={c.loadFailed}
        onRetry={() => void backward.refetch()}
      />
    );
  }
  const usage =
    forward.data !== undefined && forward.data.workOrders.length > 0 ? forward.data : undefined;
  /* 사용처 사슬이 없는 LOT(404)은 실패가 아니다. 그 밖의 실패만 알린다. */
  const usageError = forward.isError && toLoadCause(forward.error) !== 'notFound';
  return (
    <ProductionView
      chain={backward.data}
      usage={usage}
      usageError={usageError}
      onRetryUsage={() => void forward.refetch()}
      {...frame}
    />
  );
};

/** 아직 LOT을 고르지 않았을 때 상세 자리. */
export const LotDetailEmpty = ({ material }: { material: boolean }) => (
  <EmptyState
    size="sm"
    title={c.pickTitle}
    description={material ? c.pickMaterial : c.pickProduct}
  />
);
