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
  variant?: 'close' | 'correction';
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
  variant = 'close',
}: WorkOrderCloseCandidateListPaneProps) => {
  const copy = variant === 'correction' ? messages.workOrderClose.closedCandidateList : t;
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
      <section className="pane" aria-label={copy.pane}>
        {loadError}
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="pane" aria-label={copy.pane}>
        <div role="status" aria-label={copy.loading}>
          <SkeletonText lines={3} />
        </div>
      </section>
    );
  }

  return (
    <section className="pane work-order-close-list-pane" aria-label={copy.pane}>
      <h2 className="pane-title">{copy.pane}</h2>
      <div className="wide-table work-order-close-table">
        <Table
          density="compact"
          caption={<span className="work-order-close-table-caption">{copy.pane}</span>}
          columns={columns}
          rows={rows}
          getRowId={(row) => String(row.workOrderId)}
          sort={null}
          empty={
            <EmptyState
              size="sm"
              live
              title={page.isBeyondLast ? copy.empty.beyondTitle : copy.empty.title}
              description={
                page.isBeyondLast ? copy.empty.beyondDescription : copy.empty.description
              }
            />
          }
        />
      </div>
      <PageNav view={page} onChange={onChangePage} />
    </section>
  );
};
