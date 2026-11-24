/**
 * W-02-13 자재 기준 생산 추적(피처 015, omf-all-around#355) — 「이 자재 LOT 이 어느 제품에 들어가 어느 고객에게 나갔나」.
 * 유형: T-W-A 조회형 — 위 조건 줄, 왼쪽 LOT 목록(최근 100 · 공급사 + 입하일 조건 · 스캔 누적), 오른쪽 고른 LOT 하나의
 *       요약 · LOT 계보(반제품을 지나 출하 · 재고까지) · 영향 제품 LOT(최종 LOT 목록). 틀은 `patterns/trace-tree`.
 * 이탈: C-6 조회 조건 줄에 [초기화] 대신 [최근 목록으로](목록 상태를 지움, FR-024)를 두고 번호 칸은 Enter · 스캔으로
 *       바로 찾는다(LOT 상태 조회와 같다). C-10 · C-16 목록과 최종 LOT 표의 첫 칸은 「LOT 번호 + 아래 줄(들어온 번호 ·
 *       품목 · 상대)」 두 줄이고, LOT 번호는 줄이지 않고 칸 폭에서 접는다(시안 2판 · 총괄 확인 2026-11-24). 최종 LOT 표의
 *       묶은 칸(고객 · 출하번호 · 창고 위치)은 두 줄까지 접는다. 계보 표는 들여쓰기 칸이 길어 상세 창 안에서 가로로 구를 수 있다.
 */
import { Chip, type Column } from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';

import { TraceEndTable } from '../../patterns/trace-tree/end-table';
import {
  TraceLotCell,
  iqcTone,
  lotStatusTone,
  shortDateTime,
} from '../../patterns/trace-tree/cells';
import { TraceSummaryCard } from '../../patterns/trace-tree/summary-card';
import { TraceWorkspace, type TraceDetailContext } from '../../patterns/trace-tree/trace-workspace';
import type { ForwardEndRow, ForwardTree } from '../../patterns/trace-tree/types';

const t = messages.traceTree;

const qtyFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 3 });

const FATE_TONE: Record<ForwardEndRow['fate'], 'error' | 'idle' | 'warning' | 'success'> = {
  SHIPPED: 'error',
  IN_STOCK: 'idle',
  PARTIAL: 'warning',
  CONSUMED_OUT: 'success',
  VOIDED: 'idle',
};

/** 첫 값 + 「외 n건」(R-3 — 출하가 둘 이상이면 화면은 줄이고 파일은 출하마다 한 줄). */
const firstWithMore = (values: readonly string[]): string =>
  values.length <= 1
    ? (values[0] ?? '')
    : `${values[0] ?? ''} ${t.summary.moreShipments(values.length - 1)}`;

const Summary = ({ tree, names, partial, entry, stageOf }: TraceDetailContext) => {
  const forward = tree as ForwardTree;
  const root = forward.nodes.find((node) => node.nodeKey === forward.root);
  if (root?.lot === undefined) return null;
  const material = root.material;
  const facts = [
    ...(material?.inboundLotNo
      ? [{ key: 'inbound', label: t.summary.inboundLot, value: material.inboundLotNo }]
      : []),
    ...(material?.supplier
      ? [
          {
            key: 'supplier',
            label: t.summary.supplier,
            value: named(material.supplier.name, material.supplier.code),
          },
        ]
      : []),
    ...(material?.supplierLotNo
      ? [{ key: 'supplierLot', label: t.summary.supplierLot, value: material.supplierLotNo }]
      : []),
    ...(material?.iqcJudgmentCode
      ? [
          {
            key: 'iqc',
            label: t.summary.iqc,
            value: (
              <Chip variant="status" size="sm" status={iqcTone(material.iqcJudgmentCode)}>
                {names.iqc(material.iqcJudgmentCode)}
              </Chip>
            ),
          },
        ]
      : []),
  ];
  const summary = forward.summary;
  return (
    <TraceSummaryCard
      lot={root.lot}
      kindLabel={t.tree.stages[stageOf(root.nodeKey) ?? root.kind]}
      statusName={names.lotStatus(root.lot.statusCode)}
      serialNo={entry?.serialNo ?? null}
      partial={partial}
      facts={facts}
      counts={[
        { key: 'wo', label: t.summary.workOrders, value: summary.workOrderCount },
        { key: 'end', label: t.summary.endLots, value: summary.endLotCount },
        {
          key: 'ship',
          label: t.summary.shipments,
          value: t.summary.shipmentsValue(summary.shippedLotCount, summary.customerCount),
        },
        { key: 'stock', label: t.summary.stockLots, value: summary.stockLotCount },
      ]}
    />
  );
};

/** 행선지 — 출하됐으면 고객과 출하번호, 남았으면 창고와 위치(일부 출하면 둘 다). 둘 이상이면 「외 n건」. */
const destinationOf = (row: ForwardEndRow): string =>
  [
    firstWithMore(
      row.shipments.map((shipment) => `${shipment.customer.name} ${shipment.shipmentNo}`),
    ),
    firstWithMore(row.stock.map((stock) => `${stock.warehouse.name} ${stock.location.code}`)),
  ]
    .filter((part) => part !== '')
    .join(', ');

/**
 * 영향 제품 LOT 칸(시안 2판) — 제품 LOT · 품목명 · 행방 · 고객, 출하번호, 창고 위치 · 출하일 · 수량 · 상태.
 * 고객 · 출하번호와 창고 · 위치는 행방에 따라 하나가 서므로 한 칸에 둔다(상세 창 폭 — T-W-A 하위 표).
 */
const columns = (statusName: (code: string) => string): Column<ForwardEndRow>[] => {
  const c = t.end.forward;
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
      key: 'fate',
      header: c.fate,
      width: '80px',
      render: (row) => (
        <Chip variant="status" size="sm" status={FATE_TONE[row.fate]}>
          {t.end.fates[row.fate]}
        </Chip>
      ),
    },
    {
      key: 'destination',
      header: c.destination,
      render: (row) => {
        const text = destinationOf(row);
        return (
          <span className="trace-tree-wrap" title={text}>
            {text}
          </span>
        );
      },
    },
    {
      key: 'shippedAt',
      header: c.shippedAt,
      width: '72px',
      render: (row) => shortDateTime(row.shipments[0]?.shippedAt ?? null, true),
    },
    {
      key: 'qty',
      header: c.qty,
      width: '88px',
      align: 'end',
      render: (row) => `${qtyFormat.format(row.producedQty)} ${row.uomCode}`,
    },
    {
      key: 'status',
      header: c.status,
      width: '64px',
      render: (row) => (
        <Chip variant="status" size="sm" status={lotStatusTone(row.lot.statusCode)}>
          {statusName(row.lot.statusCode)}
        </Chip>
      ),
    },
  ];
};

const EndRows = ({ tree, names, activeEnd, onLocate, partial }: TraceDetailContext) => {
  const forward = tree as ForwardTree;
  return (
    <TraceEndTable
      title={t.material.endTitle}
      columns={columns(names.lotStatus)}
      rows={forward.endRows}
      getRowId={(row) => String(row.lot.lotId)}
      lotNoOf={(row) => row.lot.lotNo}
      activeId={activeEnd}
      onLocate={(row) => onLocate(String(row.lot.lotId), `L:${String(row.lot.lotId)}`)}
      emptyTitle={t.material.endEmpty}
      note={t.material.endNote}
      partial={partial}
      widthKey="omf-mes:material-trace:end"
    />
  );
};

export const MaterialTraceScreen = () => (
  <TraceWorkspace
    direction="FORWARD"
    renderSummary={(context) => <Summary {...context} />}
    renderEnd={(context) => <EndRows {...context} />}
  />
);
