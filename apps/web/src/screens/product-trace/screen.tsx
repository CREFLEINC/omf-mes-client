/**
 * W-02-14 제품 기준 역추적(피처 015, omf-all-around#355) — 「이 제품(LOT·출하·시리얼)에 어떤 자재가 어느 공급사에서
 * 들어왔나」.
 * 유형: T-W-A 조회형 — 위 조건 줄, 왼쪽 LOT 목록(최근 100 — LOT 마다 출하일, 없으면 제품 창고 입고일 · 고객 + 출하일 조건 ·
 *       스캔 누적), 오른쪽 고른 LOT 하나의 요약(그 LOT 의 출하) · LOT 계보(W/O → 투입 자재 → 반제품이면 그 자재까지 →
 *       입하 LOT · 공급사) · 투입 원자재 LOT(최종 LOT 목록). 틀은 `patterns/trace-tree`.
 * 이탈: W-02-13 과 같다(C-6 [최근 목록으로] · 스캔 Enter, C-10 · C-16 첫 칸 두 줄 · LOT 번호 접기, 묶은 칸(공급사 ·
 *       공급사 LOT) 두 줄, 계보 표 가로 구름).
 */
import { Chip, type Column } from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';

import { TraceLotCell, shortDateTime } from '../../patterns/trace-tree/cells';
import { TraceEndTable } from '../../patterns/trace-tree/end-table';
import { TraceSummaryCard } from '../../patterns/trace-tree/summary-card';
import { TraceWorkspace, type TraceDetailContext } from '../../patterns/trace-tree/trace-workspace';
import type { BackwardEndRow, BackwardTree } from '../../patterns/trace-tree/types';

const t = messages.traceTree;

const qtyFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 3 });

const rowIdOf = (row: BackwardEndRow): string =>
  `${String(row.lot.lotId)}:${row.workOrder.workOrderNo}`;

const Summary = ({ tree, names, partial, entry, stageOf }: TraceDetailContext) => {
  const backward = tree as BackwardTree;
  /* 시리얼로 들어오면 뿌리가 시리얼이다 — 요약은 그 아래 LOT 이다. */
  const rootNode = backward.nodes.find((node) => node.nodeKey === backward.root);
  const lotNode =
    rootNode?.lot !== undefined
      ? rootNode
      : backward.nodes.find((node) => node.nodeKey === `L:${String(rootNode?.lotId ?? '')}`);
  if (lotNode?.lot === undefined) return null;
  const shipments = backward.rootShipments;
  const first = shipments[0];
  const facts = [
    ...(lotNode.item === undefined
      ? []
      : [
          {
            key: 'item',
            label: t.summary.item,
            value: `${named(lotNode.item.name, lotNode.item.code)} ${
              lotNode.qty === undefined
                ? ''
                : `${qtyFormat.format(lotNode.qty)} ${lotNode.uomCode ?? ''}`
            }`.trim(),
          },
        ]),
    ...(first === undefined
      ? []
      : [
          {
            key: 'shipment',
            label: t.summary.shipment,
            value: [
              first.shipmentNo,
              named(first.customer.name, first.customer.code),
              shortDateTime(first.shippedAt, true),
              `${qtyFormat.format(first.qty)} ${lotNode.uomCode ?? ''}`.trim(),
              ...(shipments.length > 1 ? [t.summary.moreShipments(shipments.length - 1)] : []),
            ].join(', '),
          },
        ]),
  ];
  const summary = backward.summary;
  return (
    <TraceSummaryCard
      lot={lotNode.lot}
      kindLabel={t.tree.stages[stageOf(lotNode.nodeKey) ?? lotNode.kind]}
      statusName={names.lotStatus(lotNode.lot.statusCode)}
      serialNo={rootNode?.serialNo ?? entry?.serialNo ?? null}
      partial={partial}
      facts={facts}
      counts={[
        { key: 'raw', label: t.summary.rawLots, value: summary.rawLotCount },
        {
          key: 'suppliers',
          label: t.summary.suppliers,
          value: t.summary.suppliersValue(summary.supplierCount),
        },
        { key: 'wo', label: t.summary.workOrders, value: summary.workOrderCount },
      ]}
    />
  );
};

/**
 * 투입 원자재 LOT 칸(시안 2판) — 자재 LOT · 품목명 · 공급사, 공급사 LOT · 입하 LOT(입하일은 마우스를 올리면) · IQC · 투입 W/O ·
 * 투입량. 공급사와 공급사 LOT 은 한 칸에 둔다(상세 창 폭 — T-W-A 하위 표).
 */
const columns = (iqcName: (code: string) => string): Column<BackwardEndRow>[] => {
  const c = t.end.backward;
  return [
    {
      key: 'lotNo',
      header: c.lotNo,
      width: '180px',
      render: (row) => (
        <TraceLotCell
          lotNo={row.lot.lotNo}
          sub={row.item.name}
          subTitle={named(row.item.name, row.item.code)}
        />
      ),
    },
    {
      key: 'supplier',
      header: c.supplier,
      render: (row) => {
        const text = [row.supplier?.name ?? '', row.supplierLotNo ?? '']
          .filter((part) => part !== '')
          .join(', ');
        return (
          <span
            className="trace-tree-wrap"
            title={
              row.supplier === null
                ? text
                : [named(row.supplier.name, row.supplier.code), row.supplierLotNo ?? '']
                    .filter((part) => part !== '')
                    .join(', ')
            }
          >
            {text}
          </span>
        );
      },
    },
    {
      key: 'inboundLot',
      header: c.inboundLot,
      width: '116px',
      render: (row) =>
        row.inboundLot === null ? (
          ''
        ) : (
          <span
            className="trace-tree-wrap mono-cell"
            title={c.receivedAt(shortDateTime(row.inboundLot.receivedDate, true))}
          >
            {row.inboundLot.inboundLotNo}
          </span>
        ),
    },
    {
      key: 'iqc',
      header: c.iqc,
      width: '60px',
      render: (row) => {
        const code = row.inboundLot?.iqcJudgmentCode ?? null;
        return code === null ? (
          ''
        ) : (
          <Chip variant="status" size="sm" status={code === 'PASS' ? 'success' : 'warning'}>
            {iqcName(code)}
          </Chip>
        );
      },
    },
    {
      key: 'workOrder',
      header: c.workOrder,
      width: '116px',
      render: (row) => (
        <span className="trace-tree-wrap mono-cell">{row.workOrder.workOrderNo}</span>
      ),
    },
    {
      key: 'qty',
      header: c.qty,
      width: '80px',
      align: 'end',
      render: (row) =>
        row.consumedQty === null ? '' : `${qtyFormat.format(row.consumedQty)} ${row.uomCode}`,
    },
  ];
};

const EndRows = ({ tree, names, activeEnd, onLocate, partial }: TraceDetailContext) => {
  const backward = tree as BackwardTree;
  return (
    <TraceEndTable
      title={t.product.endTitle}
      columns={columns(names.iqc)}
      rows={backward.endRows}
      getRowId={rowIdOf}
      lotNoOf={(row) => row.lot.lotNo}
      activeId={activeEnd}
      onLocate={(row) => onLocate(rowIdOf(row), `L:${String(row.lot.lotId)}`)}
      emptyTitle={t.product.endEmpty}
      note={t.product.endNote}
      partial={partial}
      widthKey="omf-mes:product-trace:end"
    />
  );
};

export const ProductTraceScreen = () => (
  <TraceWorkspace
    direction="BACKWARD"
    renderSummary={(context) => <Summary {...context} />}
    renderEnd={(context) => <EndRows {...context} />}
  />
);
