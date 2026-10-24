import { Chip, EmptyState, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { formatPlantDateTime } from '../../patterns/plant-time';
import { SelectableTable } from '../../patterns/selectable-table';
import type { Dispatch } from './types';

const t = messages.dispatchHistory;

export interface DispatchTableProps {
  rows: Dispatch[];
  selectedId: number | null;
  eventName: (code: string) => string;
  onSelect: (notificationEventId: number) => void;
}

/** 알리지 않은 이유는 문구로 보인다 — 모르는 코드는 원문을 그대로 둔다. */
export const resultLabel = (row: Dispatch): string => {
  if (row.dispatchStatus === 'NOTIFIED') return t.results.NOTIFIED;
  const code = row.skipReasonCode ?? '';
  return t.skipped(
    code in t.skipReasons ? t.skipReasons[code as keyof typeof t.skipReasons] : code,
  );
};

/** 이벤트 처리 결과 표. 행을 누르면 그 건의 Zalo 상세 드로어가 열린다(C-1·T-W-A). */
export const DispatchTable = ({ rows, selectedId, eventName, onSelect }: DispatchTableProps) => {
  const columns: Column<Dispatch>[] = [
    {
      key: 'occurredAt',
      header: t.columns.occurredAt,
      render: (row) => formatPlantDateTime(row.occurredAt) ?? row.occurredAt,
    },
    { key: 'event', header: t.columns.event, render: (row) => eventName(row.eventCode) },
    { key: 'department', header: t.columns.department, render: (row) => row.departmentName ?? '—' },
    { key: 'target', header: t.columns.target, render: (row) => row.targetLabel ?? '—' },
    {
      key: 'result',
      header: t.columns.result,
      render: (row) => (
        <Chip size="sm" status={row.dispatchStatus === 'NOTIFIED' ? 'success' : 'warning'}>
          {resultLabel(row)}
        </Chip>
      ),
    },
    {
      key: 'count',
      header: t.columns.notificationCount,
      align: 'end',
      render: (row) => String(row.notificationCount),
    },
    {
      key: 'zalo',
      header: t.columns.zalo,
      render: ({ zalo }) =>
        t.zaloSummary(zalo.sent, zalo.failed, zalo.pending, zalo.expired, zalo.skippedNoPhone),
    },
  ];

  return (
    <SelectableTable
      columns={columns}
      rows={rows}
      getRowId={(row) => String(row.notificationEventId)}
      activeId={selectedId === null ? null : String(selectedId)}
      onActivate={(row) => onSelect(row.notificationEventId)}
      caption={t.panes.dispatches}
      empty={<EmptyState size="sm" title={t.state.empty} />}
    />
  );
};
