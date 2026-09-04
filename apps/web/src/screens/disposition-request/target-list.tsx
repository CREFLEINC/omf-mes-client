import { Button, Chip, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { sourceCodeLabel, stageLabel } from './codes';
import { PageNav } from './page-nav';
import type { PageView } from './pagination';
import type { TargetRow } from './types';

export interface TargetListProps {
  rows: TargetRow[];
  isLoading: boolean;
  error: ReactNode;
  page: PageView;
  selectedKey: string | null;
  onSelect: (row: TargetRow) => void;
  onChangePage: (page: number) => void;
}

/**
 * 판정 대기 대상 목록 — 좌측 창. 행은 LOT(또는 부적합) 하나이고, 배지 넷이 한 목록에서 나온다.
 * 모르는 상태 코드는 이름을 지어내지 않고 코드를 그대로 보인다(G-9).
 */
export const TargetList = ({
  rows,
  isLoading,
  error,
  page,
  selectedKey,
  onSelect,
  onChangePage,
}: TargetListProps) => {
  const t = messages.dispositionRequest;
  const columns: Column<TargetRow>[] = [
    {
      key: 'lotNo',
      header: t.fields.lotNo,
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-label={t.actions.selectRow(row.lotNo)}
          aria-current={row.key === selectedKey ? 'true' : undefined}
          onClick={() => onSelect(row)}
        >
          {row.lotNo}
        </button>
      ),
    },
    { key: 'item', header: t.fields.item, render: (row) => row.itemText },
    { key: 'qty', header: t.fields.qty, align: 'end', render: (row) => row.qtyText },
    {
      key: 'source',
      header: t.fields.sourceCode,
      render: (row) => sourceCodeLabel(row.sourceCode),
    },
    {
      key: 'receipt',
      header: t.fields.receiptNo,
      render: (row) =>
        row.receiptNo === null
          ? t.values.notAvailable
          : `${row.receiptNo}${row.receivedAtText === null ? '' : ` · ${row.receivedAtText}`}`,
    },
    {
      key: 'stage',
      header: t.fields.stage,
      render: (row) => (
        <Chip variant="status" size="sm">
          {stageLabel(row.stage, row.stageCodeText)}
        </Chip>
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
    <div className="disposition-request-list">
      <div className="disposition-request-table">
        <Table
          density="compact"
          caption={<span className="disposition-request-table-caption">{t.panes.list}</span>}
          columns={columns}
          rows={rows}
          getRowId={(row) => row.key}
          empty={empty}
        />
      </div>
      <PageNav view={page} label={t.page.label} onChange={onChangePage} />
    </div>
  );
};
