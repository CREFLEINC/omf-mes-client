import { Button, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { PageNav } from './page-nav';
import type { PageView } from './pagination';
import type { RequestRow } from './types';

export interface RequestListProps {
  rows: RequestRow[];
  isLoading: boolean;
  error: ReactNode;
  page: PageView;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onChangePage: (page: number) => void;
}

export const RequestList = ({
  rows,
  isLoading,
  error,
  page,
  selectedId,
  onSelect,
  onChangePage,
}: RequestListProps) => {
  const t = messages.qualityApproval;
  const columns: Column<RequestRow>[] = [
    {
      key: 'request',
      header: t.fields.request,
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-label={t.actions.selectRow(row.approvalRequestNo)}
          aria-current={row.approvalRequestId === selectedId ? 'true' : undefined}
          onClick={() => onSelect(row.approvalRequestId)}
        >
          {row.approvalTypeCode} · {row.approvalRequestNo}
        </button>
      ),
    },
    { key: 'target', header: t.fields.target, render: (row) => row.targetName },
    {
      key: 'status',
      header: t.fields.statusCode,
      render: (row) => (
        <>
          {row.statusCode}
          {row.isMyTurn && <span className="field-note"> · {t.values.myTurn}</span>}
        </>
      ),
    },
  ];

  if (error !== null && error !== undefined) return error;
  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  const empty = page.isBeyondLast ? (
    <EmptyState
      size="sm"
      live
      title={t.empty.beyondTitle}
      description={t.empty.beyondDescription}
      action={
        <Button variant="outlined" onClick={() => onChangePage(1)}>
          {t.actions.goFirstPage}
        </Button>
      }
    />
  ) : (
    <EmptyState size="sm" live title={t.empty.title} description={t.empty.description} />
  );

  return (
    <div className="quality-approval-list">
      <div className="quality-approval-table">
        <Table
          density="compact"
          caption={<span className="quality-approval-table-caption">{t.panes.list}</span>}
          columns={columns}
          rows={rows}
          getRowId={(row) => String(row.approvalRequestId)}
          empty={empty}
        />
      </div>
      <PageNav view={page} onChange={onChangePage} />
    </div>
  );
};
