import { Button, Chip, Icon, Table, type Column } from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { useEffect, useId, type CSSProperties } from 'react';

import { iqcTone, lotStatusTone, shortDateTime } from './cells';
import {
  closeBundle,
  collapseAll,
  expandAll,
  openBundle,
  toggleRow,
  visibleRows,
  type Lineage,
  type LineageLine,
  type LineageStage,
  type TreeView,
  type VisibleRow,
} from './graph-rows';

const t = messages.traceTree.tree;

export interface TraceNames {
  lotStatus: (code: string) => string;
  workOrderStatus: (code: string) => string;
  iqc: (code: string) => string;
}

const qtyFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 3 });
const qtyText = (qty: number | null | undefined, uom: string | null | undefined): string =>
  qty === null || qty === undefined ? '' : `${qtyFormat.format(qty)} ${uom ?? ''}`.trim();

/** 창고 · 위치 — 엑셀과 같은 「창고 이름 (코드) / 위치 이름 (코드)」. */
export const stockPlace = (
  warehouse: { name: string; code: string },
  location: { name: string; code: string } | undefined,
): string =>
  location === undefined
    ? named(warehouse.name, warehouse.code)
    : `${named(warehouse.name, warehouse.code)} / ${named(location.name, location.code)}`;

/**
 * 번호를 「-」「|」 경계에서만 접히게 — 경계 뒤에 접을 자리(<wbr>)를 두고 칸은 글자 중간에서 꺾지 않는다(1440 깊은 단계).
 */
/**
 * 계보 단계 이름 — 공정 반제품(피처 016)은 「반제품 LOT · 공정 10」처럼 만든 공정 순번을 붙인다. 요약 칸도 같은 이름.
 */
export const stageNameOf = (
  stage: LineageStage,
  lot: { operationSeq?: number | null } | undefined,
): string => {
  const name = t.stages[stage];
  const seq = lot?.operationSeq ?? null;

  return stage === 'SEMI_LOT' && seq !== null ? t.stageOperation(name, seq) : name;
};

export const BreakableNo = ({ value }: { value: string }) => (
  <>
    {value.split(/(?<=[-|])/).flatMap((part, index) =>
      /* 조각 자리가 곧 열쇠다(번호는 바뀌지 않는다). */
      index === 0 ? [part] : [<wbr key={index} />, part],
    )}
  </>
);

/** 들여쓰기 상한 — 이보다 깊으면 더 들이지 않고 단계 칩 앞에 깊이 수를 둔다(번호 자리를 지킨다). */
const INDENT_CAP = 5;

/** 계보 줄의 번호 — LOT·W/O·출하·포장·시리얼·입하 LOT 번호, 재고는 창고와 위치. */
export const numberOf = (line: LineageLine): string => {
  const node = line.node;
  if (node === undefined) return line.nodeKey;
  return (
    node.lot?.lotNo ??
    node.workOrder?.workOrderNo ??
    node.shipment?.shipmentNo ??
    node.handlingUnitNo ??
    node.serialNo ??
    node.inboundLot?.inboundLotNo ??
    (node.warehouse === undefined ? line.nodeKey : stockPlace(node.warehouse, node.location))
  );
};

/** 품목 칸 — 품목 이름, 출하는 고객, 입하 LOT 은 공급사. 마우스를 올리면 「이름 (코드)」. */
const itemOf = (line: LineageLine): { text: string; title: string } => {
  const node = line.node;
  const named2 = (value: { name: string; code: string } | null | undefined) =>
    value === null || value === undefined
      ? { text: '', title: '' }
      : { text: value.name, title: named(value.name, value.code) };
  if (node === undefined) return { text: '', title: '' };
  if (node.kind === 'SHIPMENT') return named2(node.shipment?.customer);
  if (node.kind === 'INBOUND_LOT') return named2(node.inboundLot?.supplier);
  return named2(node.item);
};

/** 수량 칸 — 부모에서 온 이음의 양(투입량·실적·배분량), 뿌리는 LOT 수량. 단위는 그 항목, 없으면 부모 것. */
const qtyOf = (line: LineageLine): string => {
  const uom = line.node?.uomCode ?? line.parent?.node?.uomCode ?? null;
  const edge = line.edge;
  const value = qtyText(edge === null ? line.node?.qty : edge.qty, uom);
  if (value === '' || edge === null) return value;
  if (edge.kind === 'CONSUMED') return t.consumed(value);
  if (edge.kind === 'PRODUCED_BY') return t.produced(value);
  return value;
};

/** 일시 칸 — 투입 줄은 첫 투입, 그 밖은 항목의 때(입하·생산·분할·출하). */
const atOf = (line: LineageLine): string => {
  const node = line.node;
  if (line.edge?.firstAt !== undefined) return shortDateTime(line.edge.firstAt);
  if (node === undefined) return '';
  switch (node.kind) {
    case 'MATERIAL_LOT': {
      const at = node.material?.receivedAt ?? null;
      return at === null ? '' : t.received(shortDateTime(at, true));
    }
    case 'PRODUCTION_LOT':
      return shortDateTime(node.producedAt ?? null);
    case 'SPLIT_LOT':
      return shortDateTime(node.split?.splitAt ?? null);
    case 'SHIPMENT':
      return shortDateTime(node.shipment?.shippedAt ?? null);
    case 'INBOUND_LOT':
      return node.inboundLot === undefined
        ? ''
        : t.received(shortDateTime(node.inboundLot.receivedDate));
    case 'SERIAL':
    case 'COMPONENT_SERIAL':
      return node.producedAt === null || node.producedAt === undefined
        ? ''
        : shortDateTime(node.producedAt);
    default:
      return '';
  }
};

/** 줄 설명(마우스를 올리면) — 자재는 입하 LOT·공급사·공급사 LOT, 분할은 출고 번호, 분리는 「생산 LOT 분리」. */
const noteOf = (line: LineageLine): string => {
  const node = line.node;
  if (node === undefined) return '';
  if (node.kind === 'SPLIT_LOT') {
    if (node.split === undefined) return '';
    return node.split.goodsIssueNo === null
      ? t.separatedNote
      : t.splitNote(node.split.goodsIssueNo, node.split.lineNo);
  }
  const material = node.material;
  if (material !== undefined) {
    return [
      material.inboundLotNo,
      material.supplier === null ? null : named(material.supplier.name, material.supplier.code),
      material.supplierLotNo === null ? null : t.supplierLotNote(material.supplierLotNo),
    ]
      .filter((part): part is string => part !== null && part !== '')
      .join(', ');
  }
  return '';
};

const StatusCell = ({ line, names }: { line: LineageLine; names: TraceNames }) => {
  const node = line.node;
  if (node === undefined) return null;
  if (node.lot !== undefined) {
    return (
      <Chip variant="status" size="sm" status={lotStatusTone(node.lot.statusCode)}>
        {names.lotStatus(node.lot.statusCode)}
      </Chip>
    );
  }
  if (node.workOrder !== undefined) {
    return (
      <Chip variant="status" size="sm" status="idle">
        {names.workOrderStatus(node.workOrder.statusCode)}
      </Chip>
    );
  }
  if (node.kind === 'SHIPMENT') {
    return (
      <Chip variant="status" size="sm" status="info">
        {t.shipped}
      </Chip>
    );
  }
  const judgment = node.inboundLot?.iqcJudgmentCode ?? null;
  if (judgment !== null) {
    return (
      <Chip variant="status" size="sm" status={iqcTone(judgment)}>
        {t.iqc(names.iqc(judgment))}
      </Chip>
    );
  }
  return null;
};

const indent = (depth: number): CSSProperties =>
  ({ '--trace-depth': Math.min(depth, INDENT_CAP) }) as CSSProperties;

export interface TraceTreeTableProps {
  lineage: Lineage;
  view: TreeView;
  onViewChange: (view: TreeView) => void;
  /** 계보의 LOT 번호를 누르면 그 번호를 스캔한 것처럼 목록에 더해 연다(FR-011). */
  onOpenLot: (lotNo: string) => void;
  names: TraceNames;
}

/**
 * LOT 계보 표(R-13) — 들여쓰기·펼침 단추(BOM 하이라키 칸을 본뜸). 칸은 계보(단계·번호)·품목·수량·일시·상태.
 * 접기·펴기·묶음·[더 보기]는 받은 그래프를 다시 나눠 그릴 뿐 다시 부르지 않는다.
 * 추정 이음은 표시하지 않는다(10-28 결정 — 내려받은 파일의 근거 열에만).
 */
export const TraceTreeTable = ({
  lineage,
  view,
  onViewChange,
  onOpenLot,
  names,
}: TraceTreeTableProps) => {
  const rows = visibleRows(lineage, view);
  const blockedId = useId();
  const tableId = useId();

  /* 경로 펼치기로 찾아간 줄로 스크롤한다. */
  useEffect(() => {
    if (view.located === null) return;
    const target = document.getElementById(`${tableId}-${view.located}`);
    target?.scrollIntoView?.({ block: 'center' });
  }, [view.located, tableId]);

  const lineageCell = (row: VisibleRow) => {
    if (row.type === 'more') {
      return (
        <span className="trace-tree-cell" style={indent(row.depth)}>
          <span className="trace-tree-spacer" aria-hidden="true" />
          <Button
            variant="text"
            size="sm"
            leadingIcon={<Icon name="expand_more" size={18} />}
            onClick={() => onViewChange(openBundle(view, row.bundleKey))}
          >
            {t.more(row.next, row.remaining)}
          </Button>
        </span>
      );
    }
    if (row.type === 'bundle') {
      const label = t.bundle(t.stages[row.kind], row.count);
      return (
        <span className="trace-tree-cell trace-tree-bundle" style={indent(row.depth)}>
          <button
            type="button"
            className="trace-tree-toggle"
            aria-expanded={row.open}
            aria-label={row.open ? t.collapse(label) : t.expand(label)}
            onClick={() =>
              onViewChange(row.open ? closeBundle(view, row.key) : openBundle(view, row.key))
            }
          >
            <Icon name={row.open ? 'expand_more' : 'chevron_right'} size={18} />
          </button>
          <span className="trace-tree-stage" data-stage="BUNDLE">
            {label}
          </span>
        </span>
      );
    }
    const line = row.line;
    const number = numberOf(line);
    const isLot = line.node?.lot !== undefined && line.depth > 0;
    const note = noteOf(line);
    return (
      <span
        id={`${tableId}-${row.key}`}
        className={`trace-tree-cell${row.located ? ' is-located' : ''}`}
        style={indent(row.depth)}
        title={note === '' ? undefined : note}
      >
        {row.expandable ? (
          <button
            type="button"
            className="trace-tree-toggle"
            aria-expanded={row.expanded}
            aria-label={row.expanded ? t.collapse(number) : t.expand(number)}
            onClick={() => onViewChange(toggleRow(view, row.key))}
          >
            <Icon name={row.expanded ? 'expand_more' : 'chevron_right'} size={18} />
          </button>
        ) : (
          <span className="trace-tree-spacer" aria-hidden="true" />
        )}
        <span className="trace-tree-cell-body">
          <span className="trace-tree-cell-head">
            {row.depth > INDENT_CAP && (
              <span className="trace-tree-depth" title={t.depth(row.depth)}>
                {row.depth}
              </span>
            )}
            <span
              className="trace-tree-stage"
              data-stage={line.stage}
              title={stageNameOf(line.stage, line.node?.lot)}
            >
              {stageNameOf(line.stage, line.node?.lot)}
            </span>
          </span>
          {isLot ? (
            <button
              type="button"
              className="trace-tree-no trace-tree-link mono-cell"
              title={t.openLot(number)}
              onClick={() => onOpenLot(number)}
            >
              <BreakableNo value={number} />
            </button>
          ) : (
            <span className="trace-tree-no mono-cell" title={number}>
              {line.node?.warehouse === undefined ? <BreakableNo value={number} /> : number}
            </span>
          )}
          {line.mark === 'duplicate' && (
            <span className="field-note trace-tree-flag" title={t.duplicate}>
              {t.duplicate}
            </span>
          )}
          {line.mark === 'cycle' && (
            <span className="trace-tree-flag" title={t.cycle}>
              <Chip variant="status" size="sm" status="warning">
                {t.cycle}
              </Chip>
            </span>
          )}
        </span>
        {row.located && (
          <span className="trace-tree-located" title={t.located}>
            <Icon name="my_location" size={16} />
            <span className="visually-hidden">{t.located}</span>
          </span>
        )}
      </span>
    );
  };

  const columns: Column<VisibleRow>[] = [
    { key: 'lineage', header: t.columns.lineage, render: lineageCell },
    {
      key: 'item',
      header: t.columns.item,
      width: '20%',
      render: (row) => {
        if (row.type !== 'node') return '';
        const item = itemOf(row.line);
        /* 품목명은 두 줄까지 접어 읽히게, 그보다 길면 말줄임(전체는 마우스를 올리면). */
        return (
          <span className="trace-tree-wrap" title={item.title}>
            {item.text}
          </span>
        );
      },
    },
    {
      key: 'qty',
      header: t.columns.qty,
      width: '104px',
      align: 'end',
      render: (row) => {
        const text =
          row.type === 'node'
            ? qtyOf(row.line)
            : row.type === 'bundle'
              ? qtyText(row.qty, row.uomCode)
              : '';
        return text === '' ? (
          ''
        ) : (
          <span className="ellipsis-cell" title={text}>
            {text}
          </span>
        );
      },
    },
    {
      key: 'at',
      header: t.columns.at,
      width: '124px',
      render: (row) => {
        const text = row.type === 'node' ? atOf(row.line) : '';
        return text === '' ? (
          ''
        ) : (
          <span className="ellipsis-cell" title={text}>
            {text}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: t.columns.status,
      width: '96px',
      render: (row) => (row.type === 'node' ? <StatusCell line={row.line} names={names} /> : ''),
    },
  ];

  return (
    <section className="trace-tree-panel" aria-labelledby={`${tableId}-title`}>
      <div className="trace-tree-panel-head">
        <h3 className="subsection-title" id={`${tableId}-title`}>
          {t.title}
        </h3>
        <span className="trace-tree-panel-actions">
          <Button
            variant="outlined"
            size="sm"
            disabled={!lineage.canExpandAll}
            aria-describedby={lineage.canExpandAll ? undefined : blockedId}
            onClick={() => onViewChange(expandAll(lineage))}
          >
            {t.expandAll}
          </Button>
          <Button variant="outlined" size="sm" onClick={() => onViewChange(collapseAll(lineage))}>
            {t.collapseAll}
          </Button>
        </span>
      </div>
      <div className="trace-tree-table">
        <Table
          density="compact"
          zebra={false}
          caption={<span className="visually-hidden">{t.caption}</span>}
          columns={columns}
          rows={rows}
          getRowId={(row) => row.key}
        />
      </div>
      {!lineage.canExpandAll && (
        <p id={blockedId} className="field-note">
          {t.bigNote} {t.expandAllBlocked}
        </p>
      )}
    </section>
  );
};
