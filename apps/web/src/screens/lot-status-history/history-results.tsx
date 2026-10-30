import { AlertBanner, Button, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { PageNav } from '../../patterns/page-nav';
import { type HistoryFilters, LOT_PAGE_SIZES, type LotPageSize } from './filters';
import type { FilterOption } from './lot-filter-bar';
import { LotTimelineTable } from './lot-timeline-table';
import { validateHistoryPeriod } from './period';
import { useLotHistoryTimeline } from './queries';

const t = messages.lotStatusHistory;

/** 두 이력을 합친 뒤 화면이 나누는 한 쪽의 줄 수. */
export const HISTORY_PAGE_SIZE = 20;

const quantity = (value: number): string => new Intl.NumberFormat('ko-KR').format(value);

interface HistoryResultsProps {
  filters: HistoryFilters;
  page: number;
  offsetMinutes: number;
  statusOptions: readonly FilterOption[];
  appUserName: (appUserId: number) => string | null;
  onPageChange: (page: number) => void;
}

export const HistoryResults = ({
  filters,
  page,
  offsetMinutes,
  statusOptions,
  appUserName,
  onPageChange,
}: HistoryResultsProps) => {
  const history = useLotHistoryTimeline(filters, offsetMinutes);
  /* 쪽 크기는 LOT 목록처럼 20 · 50 · 100 에서 고른다(사용자 2026-10-30 · 디자인 통일). */
  const [pageSize, setPageSize] = useState<LotPageSize>(HISTORY_PAGE_SIZE);
  const hasValidPeriod = validateHistoryPeriod({ from: filters.from, to: filters.to }) === null;

  const retry = (
    <Button
      variant="outlined"
      size="sm"
      aria-label={t.actions.retryLabel(t.history.pane)}
      onClick={() => void history.refetch()}
    >
      {t.actions.retry}
    </Button>
  );
  const entries = history.data?.entries ?? [];
  const total = entries.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = (currentPage - 1) * pageSize;
  const rows = entries.slice(start, start + pageSize);

  return (
    <section
      className="pane lot-status-pane lot-status-history-pane"
      aria-labelledby="lot-history-title"
    >
      <h2 className="pane-title" id="lot-history-title">
        {t.history.pane}
      </h2>
      {!hasValidPeriod && (
        <EmptyState
          size="sm"
          title={t.history.beforeSearch.title}
          description={t.history.beforeSearch.description}
        />
      )}
      {hasValidPeriod && history.isPending && (
        <div role="status" aria-label={t.history.loading}>
          <SkeletonText lines={3} />
        </div>
      )}
      {hasValidPeriod && history.isError && (
        <AlertBanner variant="error" title={t.history.failed} action={retry} />
      )}
      {hasValidPeriod && history.isFetching && history.data !== undefined && (
        <p className="field-note" role="status" aria-label={t.history.refreshing}>
          {t.history.refreshingText}
        </p>
      )}
      {hasValidPeriod && history.data?.isTruncated === true && (
        <AlertBanner variant="warning">{t.history.truncated}</AlertBanner>
      )}
      {hasValidPeriod && history.data !== undefined && (
        <>
          <LotTimelineTable
            caption={t.history.pane}
            entries={rows}
            statusOptions={statusOptions}
            appUserName={appUserName}
            variant="history"
            busy={history.isFetching}
            empty={
              <EmptyState
                size="sm"
                live
                title={t.history.empty.title}
                description={t.history.empty.description}
              />
            }
          />
          {/* 총 건수는 표 아래 쪽 이동 줄에만 — LOT 목록과 같다(사용자 2026-10-30). */}
          <PageNav
            sizes={LOT_PAGE_SIZES}
            meta={{ page: currentPage, size: pageSize, total }}
            onChangePage={onPageChange}
            onChangeSize={(size) => {
              setPageSize(size);
              onPageChange(1);
            }}
            controlSize="sm"
            buttonSize="md"
          />
        </>
      )}
    </section>
  );
};
