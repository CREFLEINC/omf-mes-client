import { type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { PageNav } from '../work-order/page-nav';
import type { WorkOrderPageView } from '../work-order/pagination';

const t = messages.workOrderRelease.candidateList;

export interface WorkOrderReleaseCandidateRow {
  workOrderId: number;
  workOrderNo: string;
  itemLabel: string | null;
  quantityLabel: string;
}

export interface WorkOrderReleaseCandidateListPaneProps {
  rows: WorkOrderReleaseCandidateRow[];
  selectedWorkOrderId: number | null;
  isLoading: boolean;
  loadError: ReactNode;
  page: WorkOrderPageView;
  onSelect: (workOrderId: number) => void;
  onChangePage: (page: number) => void;
}

const itemLabel = (value: string | null | undefined): string =>
  value === null || value === undefined || value.trim() === '' ? t.values.missingItem : value;

export const WorkOrderReleaseCandidateListPane = ({
  rows,
  selectedWorkOrderId,
  isLoading,
  loadError,
  page,
  onSelect,
  onChangePage,
}: WorkOrderReleaseCandidateListPaneProps) => {
  const columns: Column<WorkOrderReleaseCandidateRow>[] = [
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
    { key: 'item', header: t.fields.item, render: (row) => itemLabel(row.itemLabel) },
    { key: 'quantityLabel', header: t.fields.quantity, align: 'end' },
  ];

  if (loadError !== null && loadError !== undefined) {
    return (
      <section className="pane" aria-label={t.pane}>
        {loadError}
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="pane" aria-label={t.pane}>
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={3} />
        </div>
      </section>
    );
  }

  return (
    <section className="pane" aria-label={t.pane}>
      <div className="wide-table">
        <Table
          density="compact"
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
