import { AlertBanner, Button, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { lookupDisplayLabel } from '../../patterns/lookup-display';
import type { DispositionLookup } from './lookups';
import { PageNav } from './page-nav';
import type { PageView } from './pagination';
import type { NonconformanceRow } from './types';

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
 * ⚠ **「판정 진행」 열은 만들지 않는다** — 스펙 §4-A는 「미판정 / 일부 판정 / 완료」를 서버가
 * 낸다고 적었으나 계약 응답에 그 필드가 없고, `statusCode`로는 앞의 둘을 가를 수 없다.
 * 없는 것을 화면이 지어내면 다음 화면이 잘못된 대상을 집으므로 A-11로 물러나 상태만 보인다.
 * 회신 대기: omf-mes#253.
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
    <>
      {/*
       * A-11 — 만들지 않기로 «물러난» 두 항목의 사실을 결과 표 머리에 적는다.
       * 조용히 빼면 보는 사람이 「없는 기능」이 아니라 「없는 데이터」로 읽는다.
       * 서버가 값을 내리기 시작하면 이 안내부터 지운다(omf-mes#253).
       */}
      <div className="banner-slot">
        <AlertBanner variant="info">
          {t.withdrawn.decisionProgress} {t.withdrawn.sourceFilter}
        </AlertBanner>
      </div>
      <Table
        density="compact"
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.nonconformanceId)}
        empty={empty}
      />
      <PageNav view={page} label={t.page.label} onChange={onChangePage} />
    </>
  );
};
