import { Button, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { HandlingUnit } from './types';

const t = messages.repackLabelIssue.pending;

export interface PendingPaneProps {
  rows: readonly HandlingUnit[];
  selectedId: number | null;
  isLoading: boolean;
  isError: boolean;
  disabled: boolean;
  onSelect: (handlingUnitId: number) => void;
  onRetry: () => void;
}

/** 발행 대기 목록 — 계약의 `labelIssued=false` 결과만 보여 준다(§4-A·§5-1). */
export const PendingPane = ({
  rows,
  selectedId,
  isLoading,
  isError,
  disabled,
  onSelect,
  onRetry,
}: PendingPaneProps) => {
  const columns: Column<HandlingUnit>[] = [
    {
      key: 'handlingUnitNo',
      header: t.numberColumn,
      render: (row) => t.newNumber(row.handlingUnitNo),
    },
    { key: 'handlingUnitTypeCode', header: t.typeColumn },
    {
      key: 'select',
      header: t.actionColumn,
      align: 'end',
      width: '9rem',
      render: (row) => {
        const selected = row.handlingUnitId === selectedId;

        return (
          <Button
            variant={selected ? 'filled' : 'outlined'}
            size="sm"
            disabled={disabled || selected}
            aria-pressed={selected}
            aria-label={selected ? t.selected : t.select(row.handlingUnitNo)}
            onClick={() => onSelect(row.handlingUnitId)}
          >
            {selected ? t.selected : t.selectAction}
          </Button>
        );
      },
    },
  ];

  if (isError) {
    return (
      <div className="pop-repack-pending-state" role="alert">
        <p>{t.loadFailed}</p>
        <Button variant="outlined" size="sm" onClick={onRetry}>
          {messages.common.retry}
        </Button>
      </div>
    );
  }

  return (
    <div className="pop-repack-pending-table">
      <Table
        rows={[...rows]}
        columns={columns}
        getRowId={(row) => String(row.handlingUnitId)}
        density="compact"
        caption={t.caption}
        empty={<p className="pop-empty-note">{isLoading ? t.loading : t.empty}</p>}
      />
    </div>
  );
};
