import { Chip, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { toStatusBadge } from '../oqc-inspection/status-badge';
import type { InspectionQueueRow } from '../oqc-inspection/types';
import { useItem } from '../production-result/flow-queries';
import { useWorkOrder } from '../production-result/queries';

const t = messages.pqcInspectionRegister;
const empty = messages.pqcInspection.emptyValue;

/** 작업지시 번호 — 대상(`targetId`)이 PQC 에서는 작업지시다(계약 「작업지시(PQC)」). */
const WorkOrderCell = ({ workOrderId }: { workOrderId: number }) => {
  const workOrder = useWorkOrder(workOrderId);
  return <>{workOrder.data?.workOrderNo ?? empty}</>;
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
 * W-03-11 목록(omf-all-around#135) — 의뢰번호 · 작업지시 · 품목 · 검사 수량 · 상태. 줄 아무 곳이나 누르면 상세가 열린다.
 * ⚠ OQC 화면의 목록 표는 그대로 둔다 — 이 표는 PQC 화면만 쓴다.
 */
export const PqcQueueTable = ({ rows, onSelect, empty: emptyContent }: PqcQueueTableProps) => {
  const columns: Column<InspectionQueueRow>[] = [
    {
      key: 'no',
      header: messages.pqcInspection.detail.fields.inspectionRequestNo,
      width: '18%',
      render: (row) => (
        <button
          type="button"
          className="link-cell pqc-web-queue-open"
          onClick={() => onSelect(row.inspectionRequestId)}
        >
          {row.inspectionRequestNo}
        </button>
      ),
    },
    {
      key: 'workOrder',
      header: t.columns.workOrder,
      width: '18%',
      render: (row) => <WorkOrderCell workOrderId={row.targetId} />,
    },
    {
      key: 'item',
      header: t.columns.item,
      width: '40%',
      render: (row) => <ItemCell itemId={row.itemId} />,
    },
    {
      key: 'qty',
      header: t.columns.targetQty,
      width: '12%',
      render: (row) => String(row.targetQty),
    },
    {
      key: 'status',
      header: t.columns.status,
      width: '12%',
      render: (row) => {
        const badge = toStatusBadge(row.statusCode);
        return (
          <Chip variant="status" size="sm" status={badge.tone}>
            {badge.label}
          </Chip>
        );
      },
    },
  ];

  return (
    /* 줄 아무 곳이나 눌러도 연다 — 눌린 줄의 의뢰번호 단추로 넘긴다(키보드는 그 단추로). */
    <div
      className="pqc-web-queue"
      onClick={(event) => {
        const target = event.target as Element;
        if (target.closest('button, a, input') !== null) return;
        target
          .closest('tbody tr')
          ?.querySelector<HTMLButtonElement>('.pqc-web-queue-open')
          ?.click();
      }}
    >
      <Table
        caption={<span className="visually-hidden">{t.queue.caption}</span>}
        density="compact"
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.inspectionRequestId)}
        empty={emptyContent}
      />
    </div>
  );
};
