import {
  Chip,
  type ChipStatus,
  type Column,
  EmptyState,
  SkeletonText,
  Table,
  TextField,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.workOrder;

export interface WorkOrderListRow {
  workOrderId: number;
  workOrderNo: string;
  operationLabel: string | null | undefined;
  quantityLabel: string;
  priorityText: string;
  priorityError: string | undefined;
  assignmentLabel: string;
  validationLabel: string;
  validationTone: ChipStatus;
}

export interface WorkOrderListPaneProps {
  rows: WorkOrderListRow[];
  selectedWorkOrderId: number | null;
  isLoading: boolean;
  loadError: ReactNode;
  priorityDisabledReason: string | null;
  onSelect: (workOrderId: number) => void;
  onPriorityChange: (workOrderId: number, value: string) => void;
}

const operationLabel = (value: WorkOrderListRow['operationLabel']): string =>
  value === null || value === undefined || value.trim() === '' ? t.values.missingOperation : value;

export const WorkOrderListPane = ({
  rows,
  selectedWorkOrderId,
  isLoading,
  loadError,
  priorityDisabledReason,
  onSelect,
  onPriorityChange,
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
    <section className="pane" aria-label={t.panes.list}>
      <div className="wide-table">
        <Table
          density="compact"
          columns={columns}
          rows={rows}
          getRowId={(row) => String(row.workOrderId)}
          sort={null}
          empty={
            <EmptyState size="sm" live title={t.empty.title} description={t.empty.description} />
          }
        />
      </div>
    </section>
  );
};
