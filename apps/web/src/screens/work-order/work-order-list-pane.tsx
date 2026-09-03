import { Chip, type Column, EmptyState, SkeletonText, Table, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { PageNav } from './page-nav';
import type { WorkOrderListRow } from './list-row';
import type { WorkOrderPageView } from './pagination';

export type { WorkOrderListRow } from './list-row';

const t = messages.workOrder;

export interface WorkOrderListPaneProps {
  rows: WorkOrderListRow[];
  selectedWorkOrderId: number | null;
  isLoading: boolean;
  loadError: ReactNode;
  priorityDisabledReason: string | null;
  page: WorkOrderPageView;
  onSelect: (workOrderId: number) => void;
  onPriorityChange: (workOrderId: number, value: string) => void;
  onChangePage: (page: number) => void;
}

const operationLabel = (value: WorkOrderListRow['operationLabel']): string =>
  value === null || value === undefined || value.trim() === '' ? t.values.missingOperation : value;

export const WorkOrderListPane = ({
  rows,
  selectedWorkOrderId,
  isLoading,
  loadError,
  priorityDisabledReason,
  page,
  onSelect,
  onPriorityChange,
  onChangePage,
}: WorkOrderListPaneProps) => {
  const columns: Column<WorkOrderListRow>[] = [
    {
      key: 'workOrderNo',
      header: t.fields.workOrderNo,
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-label={t.actions.select(row.workOrderNo)}
          aria-current={selectedWorkOrderId === row.workOrderId ? true : undefined}
          onClick={() => {
            onSelect(row.workOrderId);
          }}
        >
          {row.workOrderNo}
        </button>
      ),
    },
    {
      key: 'operation',
      header: t.fields.operation,
      render: (row) => operationLabel(row.operationLabel),
    },
    { key: 'quantityLabel', header: t.fields.quantity, align: 'end' },
    {
      key: 'priorityText',
      header: t.fields.priority,
      render: (row) => (
        <TextField
          size="sm"
          containerClassName="work-order-priority-field"
          inputMode="numeric"
          aria-label={t.actions.priorityLabel(row.workOrderNo)}
          value={row.priorityText}
          error={row.priorityError}
          disabled={priorityDisabledReason !== null}
          disabledReason={priorityDisabledReason ?? undefined}
          onChange={(event) => {
            onPriorityChange(row.workOrderId, event.target.value);
          }}
        />
      ),
    },
    { key: 'assignmentLabel', header: t.fields.assignment },
    {
      key: 'validationLabel',
      header: t.fields.validation,
      render: (row) => (
        <Chip variant="status" status={row.validationTone} size="sm">
          {row.validationLabel}
        </Chip>
      ),
    },
  ];

  if (loadError !== null && loadError !== undefined) {
    return (
      <section className="pane" aria-label={t.panes.list}>
        {loadError}
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="pane" aria-label={t.panes.list}>
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={4} />
        </div>
      </section>
    );
  }

  return (
    <section className="pane work-order-assignment-list-pane" aria-label={t.panes.list}>
      <h2 className="pane-title">{t.panes.list}</h2>
      <div className="wide-table work-order-assignment-table">
        <Table
          density="compact"
          caption={<span className="work-order-table-caption">{t.panes.list}</span>}
          columns={columns}
          rows={rows}
          getRowId={(row) => String(row.workOrderId)}
          sort={null}
          empty={
            <EmptyState
              size="sm"
              live
              title={page.isBeyondLast ? t.empty.beyondTitle : t.empty.title}
              description={page.isBeyondLast ? t.empty.beyondDescription : t.empty.description}
            />
          }
        />
      </div>
      <PageNav view={page} onChange={onChangePage} />
    </section>
  );
};
