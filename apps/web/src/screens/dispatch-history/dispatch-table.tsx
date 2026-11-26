import { Chip, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { useFitColumns } from '../../patterns/column-fit';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useColumnWidths } from '../../patterns/column-resize';
import { ListEmpty } from '../../patterns/list-empty';
import { formatPlantDateTime } from '../../patterns/plant-time';
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

/**
 * 이벤트 처리 결과 표. 행을 누르면 그 건의 Zalo 상세가 오른쪽 상세 상자에 선다(#358).
 * 고른 줄 모양 · 줄 아무 곳이나 눌러 고르기는 다른 목록 | 상세 화면과 같다(`.users-roles-row-pick` — 알림 연결 설정 · 단말 관리).
 */
export const DispatchTable = ({ rows, selectedId, eventName, onSelect }: DispatchTableProps) => {
  const columns: Column<Dispatch>[] = [
    {
      key: 'occurredAt',
      header: t.columns.occurredAt,
      render: (row) => formatPlantDateTime(row.occurredAt) ?? row.occurredAt,
    },
    {
      key: 'event',
      /* 이벤트 열만 왼쪽 정렬 — 다른 알림 화면의 이름 열과 같다(app.css `.notify-name-head`). 고르는 단추가 이 칸을 감싼다. */
      header: <span className="notify-name-head">{t.columns.event}</span>,
      render: (row) => (
        <button
          type="button"
          className="users-roles-row-pick"
          aria-current={row.notificationEventId === selectedId ? 'true' : undefined}
          onClick={() => onSelect(row.notificationEventId)}
        >
          {eventName(row.eventCode)}
        </button>
      ),
    },
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

  /* 열 순서 · 폭은 사용자가 바꾸고 브라우저에 남는다(단말 관리와 같다 · #358). */
  const ordered = useColumnOrder('omf-mes:dispatch-history:columns:order', columns);
  const resizable = useColumnWidths('omf-mes:dispatch-history:columns', ordered);
  const fit = useFitColumns(resizable.columns);

  return (
    /* 줄 아무 곳이나 눌러도 고른다 — DS 표에 줄 클릭이 없어 눌린 줄의 고르는 단추로 넘긴다(알림 연결 설정과 같다). */
    <div
      ref={fit.ref}
      className="users-roles-list inspection-queue-table notify-list-table"
      style={resizable.style}
      onClick={(event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest('button, a, input, select, textarea') !== null) return;
        target
          .closest('tbody tr')
          ?.querySelector<HTMLButtonElement>('.users-roles-row-pick')
          ?.click();
      }}
    >
      <Table
        density="compact"
        columns={fit.columns}
        rows={rows}
        getRowId={(row) => String(row.notificationEventId)}
        caption={t.panes.dispatches}
        empty={<ListEmpty title={t.state.empty} description={messages.common.listEmptyHint} />}
      />
    </div>
  );
};
