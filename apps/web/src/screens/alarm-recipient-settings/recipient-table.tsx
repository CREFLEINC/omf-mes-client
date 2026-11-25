import { Chip, EmptyState, IconButton, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { BoardTable } from '../../patterns/board-table';
import { useColumnOrder } from '../../patterns/column-grip-order';

const t = messages.alarmRecipientSettings;

export interface RecipientTableRow {
  id: string;
  name: string;
  departmentName: string | null;
  hasPhone: boolean;
  active: boolean;
}

interface RecipientTableProps {
  /** 열 폭 · 순서를 남기는 열쇠 — 화면마다 다르게. */
  storageKey: string;
  rows: RecipientTableRow[];
  onRemove: (id: string) => void;
}

/**
 * 지정한 수신자 표 — 알림 수신자 설정 · 인계 알림 설정이 함께 쓴다(사용자 지시 2026-11-25 「표 형식으로」).
 * 수신자가 없으면 표 머리줄은 두고 표 안에 문구를 낸다(다른 목록의 빈 상태와 같다).
 */
export const RecipientTable = ({ storageKey, rows, onRemove }: RecipientTableProps) => {
  const columns: Column<RecipientTableRow>[] = [
    {
      key: 'name',
      header: t.recipientTable.name,
      width: '160px',
      render: (row) =>
        row.active ? (
          row.name
        ) : (
          <span className="alarm-recipient-name">
            {row.name}
            <Chip size="sm" status="error">
              {t.values.inactive}
            </Chip>
          </span>
        ),
    },
    {
      key: 'department',
      header: t.recipientTable.department,
      width: '160px',
      render: (row) => row.departmentName ?? t.values.noDepartment,
    },
    {
      key: 'phone',
      header: t.recipientTable.phone,
      width: '140px',
      render: (row) =>
        row.hasPhone ? (
          t.values.hasPhone
        ) : (
          <Chip size="sm" status="warning">{`📵 ${t.values.noPhone}`}</Chip>
        ),
    },
    {
      key: 'manage',
      header: t.recipientTable.manage,
      width: '80px',
      render: (row) => (
        <IconButton
          icon="delete"
          size="sm"
          aria-label={`${row.name} ${t.actions.remove}`}
          onClick={() => onRemove(row.id)}
        />
      ),
    },
  ];
  const ordered = useColumnOrder(`${storageKey}:order`, columns);

  return (
    <BoardTable
      label={t.columns.recipients}
      widthKey={storageKey}
      columns={ordered}
      rows={rows}
      getRowId={(row) => row.id}
      empty={<EmptyState size="sm" title={t.state.noRecipients} />}
    />
  );
};
