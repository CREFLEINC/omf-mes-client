import { type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { PageNav } from '../work-order/page-nav';
import type { WorkOrderPageView } from '../work-order/pagination';

const t = messages.workOrderClose.candidateList;

export interface WorkOrderCloseCandidateRow {
  workOrderId: number;
  workOrderNo: string;
  itemLabel: string | null;
  quantityLabel: string;
}

export interface WorkOrderCloseCandidateListPaneProps {
  rows: WorkOrderCloseCandidateRow[];
  selectedWorkOrderId: number | null;
  isLoading: boolean;
  loadError: ReactNode;
  page: WorkOrderPageView;
  onSelect: (workOrderId: number) => void;
  onChangePage: (page: number) => void;
}

const itemLabel = (value: WorkOrderCloseCandidateRow['itemLabel']): string =>
  value === null || value.trim() === '' ? t.values.missingItem : value;

export const WorkOrderCloseCandidateListPane = ({
  rows,
  selectedWorkOrderId,
  isLoading,
  loadError,
  page,
  onSelect,
  onChangePage,
}: WorkOrderCloseCandidateListPaneProps) => {
  const columns: Column<WorkOrderCloseCandidateRow>[] = [
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
    <section className="pane work-order-close-list-pane" aria-label={t.pane}>
      <h2 className="pane-title">{t.pane}</h2>
      <div className="wide-table work-order-close-table">
        <Table
          density="compact"
          caption={<span className="work-order-close-table-caption">{t.pane}</span>}
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
