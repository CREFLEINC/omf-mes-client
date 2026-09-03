import { Button, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { lookupDisplayLabel } from '../../patterns/lookup-display';
import type { DispositionLookup } from './lookups';
import { PageNav } from './page-nav';
import type { PageView } from './pagination';
import { dispositionProgressLabel, type NonconformanceRow } from './types';

export interface NonconformanceListProps {
  rows: NonconformanceRow[];
  items: DispositionLookup;
  isLoading: boolean;
  error: ReactNode;
  page: PageView;
  selectedId: number | null;
  onSelect: (nonconformanceId: number) => void;
  onChangePage: (page: number) => void;
}

/**
 * ⭐ 「판정 진행」 열은 서버가 대상 수량 합과 결정 수량 합을 롤업해 낸 `dispositionProgressCode`를
 * 그대로 보인다 — `statusCode`의 「판정 대기」 한 값은 미판정·일부 판정을 가르지 못한다.
 * 근거: W-03-10 §4-A · omf-mes#253(회신 반영).
 */
export const NonconformanceList = ({
  rows,
  items,
  isLoading,
  error,
  page,
  selectedId,
  onSelect,
  onChangePage,
}: NonconformanceListProps) => {
  const t = messages.dispositionDecision;
  const columns: Column<NonconformanceRow>[] = [
    {
      key: 'nonconformanceNo',
      header: t.fields.nonconformanceNo,
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-label={t.actions.selectRow(row.nonconformanceNo)}
          aria-current={row.nonconformanceId === selectedId ? 'true' : undefined}
          onClick={() => onSelect(row.nonconformanceId)}
        >
          {row.nonconformanceNo}
        </button>
      ),
    },
    {
      key: 'item',
      header: t.fields.item,
      render: (row) => lookupDisplayLabel(items, row.itemId),
    },
    { key: 'qty', header: t.fields.qty, align: 'end', render: (row) => row.affectedQtyText },
    {
      key: 'dispositionProgress',
      header: t.fields.dispositionProgressCode,
      render: (row) => dispositionProgressLabel(row.dispositionProgressCode),
    },
    { key: 'severity', header: t.fields.severityCode, render: (row) => row.severityCode },
    { key: 'openedAt', header: t.fields.openedAt, render: (row) => row.openedAtText },
    { key: 'status', header: t.fields.statusCode, render: (row) => row.statusCode },
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
    <div className="disposition-list">
      {/*
       * ⭐ 여기 있던 「원천으로 거를 수 없다」 안내(A-11)를 걷었다 — **물러났던 것이 아니라
       * 되살아났다.** 축이 `sourceCode`로 정의돼 필터 바에 섰으므로(W-03-10 §5-4 · #648)
       * 그 자리에 남겨 두면 화면이 «있는 기능»을 없다고 말하게 된다.
       */}
      <div className="disposition-table disposition-pending-table">
        <Table
          density="compact"
          caption={<span className="disposition-table-caption">{t.panes.list}</span>}
          columns={columns}
          rows={rows}
          getRowId={(row) => String(row.nonconformanceId)}
          empty={empty}
        />
      </div>
      <PageNav view={page} label={t.page.label} onChange={onChangePage} />
    </div>
  );
};
