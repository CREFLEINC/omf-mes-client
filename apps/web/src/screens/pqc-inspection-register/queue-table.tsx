import { Chip, Table, type Column, type SortState } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { formatPlantDateTime } from '../../patterns/plant-time';
import { toStatusBadge } from '../oqc-inspection/status-badge';
import type { InspectionQueueRow } from '../oqc-inspection/types';
import { useItem } from '../production-result/flow-queries';
import { useWorkOrder } from '../production-result/queries';

const t = messages.pqcInspectionRegister;
const empty = messages.pqcInspection.emptyValue;

/** 작업지시 번호 — 대상(`targetId`)이 PQC 에서는 작업지시다(계약 「작업지시(PQC)」). */
const WorkOrderCell = ({ workOrderId }: { workOrderId: number }) => {
  const workOrder = useWorkOrder(workOrderId);
  const workOrderNo = workOrder.data?.workOrderNo;
  return <span title={workOrderNo}>{workOrderNo ?? empty}</span>;
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
  rows: InspectionQueueRow[];
  onSelect: (inspectionRequestId: number) => void;
  empty: React.ReactNode;
}

/**
 * W-03-11 목록(omf-all-around#135) — 의뢰번호 · 작업지시 · 품목 · 검사 수량 · 상태 · 의뢰 일시. 줄을 누르면 상세가 열린다.
 * ⚠ OQC 화면의 목록 표는 그대로 둔다 — 이 표는 PQC 화면만 쓴다.
 */
/* 번호 · 일시 칸은 한 줄 값이 다 보이는 고정 폭, 품목이 나머지를 쓴다. */
export const PqcQueueTable = ({ rows, onSelect, empty: emptyContent }: PqcQueueTableProps) => {
  /*
   * 의뢰 일시 정렬(#133 과 같다 · 받은 쪽 안에서). ⭐ 정렬을 이 표가 쥔다 — 줄을 누르면 줄 차례로 의뢰를 찾으므로,
   * 화면에 그린 차례와 찾는 배열의 차례가 같아야 한다. 정렬은 원문(RFC3339)으로 한다.
   */
  const [sort, setSort] = useState<SortState | null>(null);
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
      key: 'no',
      header: messages.pqcInspection.detail.fields.inspectionRequestNo,
      width: '12rem',
      render: (row) => <span title={row.inspectionRequestNo}>{row.inspectionRequestNo}</span>,
    },
    {
      key: 'workOrder',
      header: t.columns.workOrder,
      width: '11rem',
      render: (row) => <WorkOrderCell workOrderId={row.targetId} />,
    },
    {
      key: 'item',
      header: t.columns.item,
      render: (row) => <ItemCell itemId={row.itemId} />,
    },
    {
      key: 'qty',
      header: t.columns.targetQty,
      width: '5.5rem',
      render: (row) => String(row.targetQty),
    },
    {
      key: 'status',
      header: t.columns.status,
      width: '5.5rem',
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
      header: t.columns.requestedAt,
      width: '10rem',
      sortable: true,
      render: (row) => formatPlantDateTime(row.requestedAt) ?? row.requestedAt,
    },
  ];

  return (
    /* 줄 아무 곳이나 눌러 연다(#135) — 의뢰번호를 따로 누르는 길은 두지 않는다. */
    <div
      className="pqc-web-queue"
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
        columns={columns}
        rows={shown}
        sort={sort}
        onSortChange={setSort}
        getRowId={(row) => String(row.inspectionRequestId)}
        empty={emptyContent}
      />
    </div>
  );
};
