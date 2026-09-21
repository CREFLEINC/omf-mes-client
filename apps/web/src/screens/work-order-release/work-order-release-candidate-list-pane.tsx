import { type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { WorkOrderPageView } from '../work-order/pagination';
import { ItemLabelLines } from './item-label-lines';
import { PageNav } from './page-nav';

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
  /** 조회를 한 번이라도 했는가. 아직이면 「없다」가 아니라 「조회해 주세요」다. */
  hasSearched: boolean;
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
  hasSearched,
  onSelect,
  onChangePage,
}: WorkOrderReleaseCandidateListPaneProps) => {
  const columns: Column<WorkOrderReleaseCandidateRow>[] = [
    {
      key: 'workOrderNo',
      header: t.fields.workOrderNo,
      align: 'center',
      width: '35%',
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
      key: 'item',
      header: t.fields.item,
      align: 'center',
      width: '45%',
      render: (row) => <ItemLabelLines label={itemLabel(row.itemLabel)} />,
    },
    { key: 'quantityLabel', header: t.fields.quantity, align: 'center', width: '20%' },
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
    <section className="pane work-order-release-list-pane" aria-label={t.pane}>
      <h2 className="pane-title">{t.pane}</h2>
      <div className="wide-table work-order-release-table">
        <Table
          density="compact"
          caption={<span className="work-order-release-table-caption">{t.pane}</span>}
          columns={columns}
          rows={rows}
          getRowId={(row) => String(row.workOrderId)}
          sort={null}
          empty={
            <EmptyState
              size="sm"
              live
              title={
                !hasSearched
                  ? t.empty.notSearchedTitle
                  : page.isBeyondLast
                    ? t.empty.beyondTitle
                    : t.empty.title
              }
              description={
                !hasSearched
                  ? t.empty.notSearchedDescription
                  : page.isBeyondLast
                    ? t.empty.beyondDescription
                    : t.empty.description
              }
            />
          }
        />
      </div>
      <PageNav view={page} onChange={onChangePage} />
    </section>
  );
};
