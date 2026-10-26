import { Chip, Table, type Column, type SortState } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { useColumnOrder } from '../../patterns/column-order';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnWidths } from '../../patterns/column-resize';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { toStatusBadge } from '../oqc-inspection/status-badge';
import type { InspectionQueueRow } from '../oqc-inspection/types';
import { useUoms } from '../pqc-inspection/queries';
import { useItem } from '../production-result/flow-queries';
import { useTargetLots, useWorkOrder } from '../production-result/queries';

const t = messages.pqcInspectionRegister;
const empty = messages.pqcInspection.emptyValue;

/** 작업지시 번호 — 대상(`targetId`)이 PQC 에서는 작업지시다(계약 「작업지시(PQC)」). */
const WorkOrderCell = ({ workOrderId }: { workOrderId: number }) => {
  const workOrder = useWorkOrder(workOrderId);
  const workOrderNo = workOrder.data?.workOrderNo;
  return <span title={workOrderNo}>{workOrderNo ?? empty}</span>;
};

const VOIDED_LIFECYCLE = 'VOIDED';

/**
 * 대상 LOT — PQC 의뢰는 작업지시 단위라 그 작업지시의 생산 LOT(폐번 제외)을 보인다(상세 「대상 LOT」과 같다).
 * 여럿이면 첫 번호 「외 N건」, 전체 번호는 title 로 본다(#135).
 */
const LotCell = ({ workOrderId }: { workOrderId: number }) => {
  const lots = useTargetLots(workOrderId);
  const lotNos = (lots.data ?? [])
    .filter((row) => row.lifecycleStatusCode !== VOIDED_LIFECYCLE)
    .map((row) => row.lotNo);
  const [firstLotNo, ...restLotNos] = lotNos;
  if (firstLotNo === undefined) return <>{empty}</>;
  return (
    <span title={lotNos.join('\n')}>
      {restLotNos.length === 0 ? firstLotNo : t.web.summary.lotMore(firstLotNo, restLotNos.length)}
    </span>
  );
};

/** 품목 — 이름(주)과 코드(보조) 두 줄. 내부 번호는 내지 않는다(#135). */
const ItemCell = ({ itemId }: { itemId: number }) => {
  const item = useItem(itemId);
  if (item.data === undefined) return <>{empty}</>;
  return (
    <span className="pqc-web-queue-item">
      <span className="pqc-web-queue-item-name">{item.data.itemName}</span>
      <span className="pqc-web-queue-item-code">{item.data.itemCode}</span>
    </span>
  );
};

export interface PqcQueueTableProps {
  /** 넘치면 줄이지 않고 가로로 구른다 — 좌우 배치(#185). 기본은 상자 폭에 맞춘다. */
  scrollX?: boolean;
  rows: InspectionQueueRow[];
  onSelect: (inspectionRequestId: number) => void;
  /** 고른 의뢰 — 그 줄을 파랗게 표시한다(#185 · 입하 예정 조회와 같다). */
  selectedId: number | null;
  empty: React.ReactNode;
}

/**
 * W-03-11 목록(omf-all-around#135) — 대상 LOT · 품목 · 작업지시 · 의뢰번호 · 검사 수량 · 상태 · 의뢰 일시. 줄을 누르면 상세가 열린다.
 * ⚠ OQC 화면의 목록 표는 그대로 둔다 — 이 표는 PQC 화면만 쓴다.
 */
/* 번호 · 일시 칸은 한 줄 값이 다 보이는 고정 폭, 품목이 나머지를 쓴다. */
export const PqcQueueTable = ({
  rows,
  onSelect,
  selectedId,
  empty: emptyContent,
  scrollX = false,
}: PqcQueueTableProps) => {
  /*
   * 의뢰 일시 정렬(#133 과 같다 · 받은 쪽 안에서). ⭐ 정렬을 이 표가 쥔다 — 줄을 누르면 줄 차례로 의뢰를 찾으므로,
   * 화면에 그린 차례와 찾는 배열의 차례가 같아야 한다. 정렬은 원문(RFC3339)으로 한다.
   */
  const [sort, setSort] = useState<SortState | null>(null);
  /* 검사 수량 옆 단위 코드(#135). 단위 목록을 못 읽으면 수량만 낸다. */
  const uoms = useUoms();
  const uomCodeOf = (uomId: number): string | undefined =>
    uoms.data?.find((uom) => uom.uomId === uomId)?.uomCode;
  const shown =
    sort === null
      ? rows
      : [...rows].sort((a, b) =>
          sort.direction === 'ascending'
            ? a.requestedAt.localeCompare(b.requestedAt)
            : b.requestedAt.localeCompare(a.requestedAt),
        );
  const columns: Column<InspectionQueueRow>[] = [
    {
      key: 'lot',
      align: 'start',
      header: t.columns.lot,
      /* 번호가 길다(30자 남짓) — 넓은 창에서는 다 보이고, 1440 창에서는 끝을 말줄임하고 전체는 title 로 본다. */
      width: '240px',
      render: (row) => <LotCell workOrderId={row.targetId} />,
    },
    {
      key: 'item',
      align: 'start',
      header: t.columns.item,
      width: '240px',
      render: (row) => <ItemCell itemId={row.itemId} />,
    },
    {
      key: 'workOrder',
      align: 'center',
      header: t.columns.workOrder,
      width: '160px',
      render: (row) => <WorkOrderCell workOrderId={row.targetId} />,
    },
    {
      key: 'no',
      align: 'start',
      header: messages.pqcInspection.detail.fields.inspectionRequestNo,
      width: '160px',
      render: (row) => (
        <span
          title={row.inspectionRequestNo}
          aria-current={row.inspectionRequestId === selectedId ? 'true' : undefined}
        >
          {row.inspectionRequestNo}
        </span>
      ),
    },
    {
      key: 'qty',
      align: 'center',
      header: t.columns.targetQty,
      width: '96px',
      render: (row) => {
        const uomCode = uomCodeOf(row.uomId);
        return uomCode === undefined ? String(row.targetQty) : `${row.targetQty} ${uomCode}`;
      },
    },
    {
      key: 'status',
      align: 'center',
      header: t.columns.status,
      width: '88px',
      render: (row) => {
        const badge = toStatusBadge(row.statusCode);
        return (
          <Chip variant="status" size="sm" status={badge.tone}>
            {badge.label}
          </Chip>
        );
      },
    },
    {
      key: 'requestedAt',
      align: 'center',
      header: t.columns.requestedAt,
      width: '160px',
      sortable: true,
      render: (row) => formatPlantDateTime(row.requestedAt) ?? row.requestedAt,
    },
  ];
  /* 열 순서·폭은 사용자가 바꾸고 브라우저에 남는다(#185) — 순서를 먼저 정하고 그 위에 폭 손잡이를 단다. */
  const ordered = useColumnOrder('omf-mes:pqc-inspection-register:columns:queue:order', columns);
  const resizable = useColumnWidths('omf-mes:pqc-inspection-register:columns:queue', ordered, {
    /* 좌우 배치(가로 스크롤)에서는 열이 그 데이터의 가장 긴 폭까지만 넓어진다(사용자 지시 2026-10-26). */
    fitContent: scrollX,
  });
  /* 상자 폭을 넘지 않는다 — 넓혀 둔 열이 많으면 비율대로 줄여 맞춘다(#185 · 반응형). */
  const fit = useFitColumns(resizable.columns, { scrollX });

  return (
    /* 줄 아무 곳이나 눌러 연다(#135) — 의뢰번호를 따로 누르는 길은 두지 않는다. */
    <div
      ref={fit.ref}
      className="pqc-web-queue inspection-queue-table"
      style={resizable.style}
      onClick={(event) => {
        const row = (event.target as Element).closest('tbody tr');
        if (row === null || row.parentElement === null) return;
        const index = Array.from(row.parentElement.children).indexOf(row);
        const picked = shown[index];
        if (picked !== undefined) onSelect(picked.inspectionRequestId);
      }}
    >
      <Table
        caption={<span className="visually-hidden">{t.queue.caption}</span>}
        density="compact"
        columns={fit.columns}
        rows={shown}
        sort={sort}
        onSortChange={setSort}
        getRowId={(row) => String(row.inspectionRequestId)}
        empty={emptyContent}
      />
    </div>
  );
};
