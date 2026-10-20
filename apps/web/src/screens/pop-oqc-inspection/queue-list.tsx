import { Chip, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { toStatusBadge } from '../oqc-inspection/status-badge';
import type { InspectionQueueRow } from '../oqc-inspection/types';

const t = messages.popOqcInspection.queue;
const detail = messages.popOqcInspection.detail;

export interface PopQueueListProps {
  rows: InspectionQueueRow[];
  selectedId: number | null;
  onSelect: (inspectionRequestId: number) => void;
  /** 줄이 없을 때 표 자리에 서는 것(불러오는 중·없음·실패). */
  empty: ReactNode;
}

/**
 * 판정 대기 목록 — POP 목록 정본(`pop-row-target`)을 따른다. 줄 어디를 눌러도 그 줄을 고르고,
 * 고른 줄은 바탕색으로 드러난다(`pop-row-select-on`).
 *
 * ⚠ 관리웹 W-04-03 의 `QueueTable` 을 쓰지 않는다 — 그쪽은 밑줄 링크 한 칸만 눌리는 관리웹 관용구다.
 */
export const PopQueueList = ({ rows, selectedId, onSelect, empty }: PopQueueListProps) => {
  const columns: Column<InspectionQueueRow>[] = [
    {
      key: 'request',
      header: t.columns.request,
      align: 'center',
      width: '40%',
      render: (row) => {
        const selected = row.inspectionRequestId === selectedId;

        return (
          <button
            type="button"
            className={`pop-row-select${selected ? ' pop-row-select-on' : ''}`}
            aria-pressed={selected}
            aria-label={t.selectRow(row.inspectionRequestNo)}
            onClick={() => onSelect(row.inspectionRequestId)}
          >
            <span>{row.inspectionRequestNo}</span>
          </button>
        );
      },
    },
    {
      key: 'item',
      header: t.columns.item,
      align: 'center',
      width: '20%',
      render: (row) => detail.idValue(row.itemId),
    },
    {
      key: 'qty',
      header: t.columns.qty,
      align: 'center',
      width: '20%',
      render: (row) => <span className="pop-oqc-num">{String(row.targetQty)}</span>,
    },
    {
      key: 'status',
      header: t.columns.status,
      align: 'center',
      width: '20%',
      render: (row) => {
        const badge = toStatusBadge(row.statusCode);

        return (
          <Chip variant="status" size="md" status={badge.tone}>
            {badge.label}
          </Chip>
        );
      },
    },
  ];

  return (
    <div
      role="presentation"
      className="pop-row-target pop-oqc-queue"
      onClick={(event) => {
        const from = event.target as HTMLElement;
        if (from.closest('.pop-row-select') !== null) return;
        from.closest('tr')?.querySelector<HTMLButtonElement>('.pop-row-select')?.click();
      }}
    >
      <Table
        caption={t.caption}
        density="comfortable"
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.inspectionRequestId)}
        empty={empty}
      />
    </div>
  );
};
