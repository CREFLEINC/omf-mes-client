import { AlertBanner, Button, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { HistoryFilters } from './filters';
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
  const totalPages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const start = (currentPage - 1) * HISTORY_PAGE_SIZE;
  const rows = entries.slice(start, start + HISTORY_PAGE_SIZE);
  const rangeLabel =
    rows.length === 0
      ? t.range.total(quantity(total))
      : t.range.span(quantity(start + 1), quantity(start + rows.length), quantity(total));

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
          <div className="wide-table lot-status-table" aria-busy={history.isFetching}>
            <LotTimelineTable
              caption={t.history.pane}
              entries={rows}
              statusOptions={statusOptions}
              appUserName={appUserName}
              variant="history"
              empty={
                <EmptyState
                  size="sm"
                  live
                  title={t.history.empty.title}
                  description={t.history.empty.description}
                />
              }
            />
          </div>
          <nav className="form-actions" aria-label={t.history.pagination}>
            <p className="field-note form-actions-secondary">{rangeLabel}</p>
            <Button
              variant="outlined"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
            >
              {t.actions.previousPage}
            </Button>
            <Button
              variant="outlined"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
            >
              {t.actions.nextPage}
            </Button>
          </nav>
        </>
      )}
    </section>
  );
};
