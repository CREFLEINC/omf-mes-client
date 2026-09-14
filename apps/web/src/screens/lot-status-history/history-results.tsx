import {
  AlertBanner,
  Button,
  Chip,
  type Column,
  EmptyState,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { HistoryFilters } from './filters';
import { validateHistoryPeriod } from './period';
import { useLotHoldEvents } from './queries';
import type { LotHoldEventView } from './types';

const t = messages.lotStatusHistory;
const EMPTY = '—';

const formatDateTime = (value: string): string => {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match === null ? value : `${match[1]} ${match[2]}`;
};

const eventLabel = (eventType: LotHoldEventView['eventTypeCode']): string =>
  eventType === 'HELD' ? t.history.events.held : t.history.events.released;

const quantity = (value: number): string => new Intl.NumberFormat('ko-KR').format(value);

const eventKey = (event: LotHoldEventView): string =>
  `${event.lotHoldId}:${event.eventTypeCode}:${event.occurredAt}`;

const actorName = (event: LotHoldEventView): string =>
  event.actorName?.trim() || t.history.actorUnknown;

interface HistoryResultsProps {
  filters: HistoryFilters;
  page: number;
  offsetMinutes: number;
  onPageChange: (page: number) => void;
}

export const HistoryResults = ({
  filters,
  page,
  offsetMinutes,
  onPageChange,
}: HistoryResultsProps) => {
  const history = useLotHoldEvents(filters, page, offsetMinutes);
  const hasValidPeriod = validateHistoryPeriod({ from: filters.from, to: filters.to }) === null;
  const columns: Column<LotHoldEventView>[] = [
    {
      key: 'occurredAt',
      header: t.history.columns.occurredAt,
      width: '164px',
      render: (event) => formatDateTime(event.occurredAt),
    },
    { key: 'lotNo', header: t.history.columns.lot, render: (event) => event.lotNo },
    {
      key: 'eventTypeCode',
      header: t.history.columns.event,
      width: '140px',
      render: (event) => (
        <Chip variant="status" size="sm">
          {eventLabel(event.eventTypeCode)}
        </Chip>
      ),
    },
    {
      key: 'actorName',
      header: t.history.columns.actor,
      render: actorName,
    },
    {
      key: 'reasonCode',
      header: t.history.columns.reason,
      render: (event) => event.reasonCode ?? EMPTY,
    },
  ];

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
  const rows = [...(history.data?.rows ?? [])];
  const meta = history.data?.page;
  const currentPage = meta !== undefined && meta.page > 0 ? meta.page : page;
  const pageSize = meta !== undefined && meta.size > 0 ? meta.size : 1;
  const totalPages = Math.ceil((meta?.total ?? 0) / pageSize);
  const start = (currentPage - 1) * pageSize + 1;
  const rangeLabel =
    meta === undefined
      ? ''
      : rows.length === 0
        ? t.range.total(quantity(meta.total))
        : t.range.span(quantity(start), quantity(start + rows.length - 1), quantity(meta.total));

  return (
    <section className="pane lot-status-pane" aria-labelledby="lot-hold-history-title">
      <h2 className="pane-title" id="lot-hold-history-title">
        {t.history.pane}
      </h2>
      <AlertBanner variant="info">{t.scopeNotice}</AlertBanner>
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
      {hasValidPeriod && history.data !== undefined && (
        <>
          <div className="wide-table lot-status-table" aria-busy={history.isFetching}>
            <Table
              density="compact"
              caption={t.history.pane}
              columns={columns}
              rows={rows}
              getRowId={eventKey}
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
          {meta !== undefined && (
            <nav className="form-actions" aria-label={t.history.pagination}>
              <p className="field-note form-actions-secondary">{rangeLabel}</p>
              <Button
                variant="outlined"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => onPageChange(currentPage - 1)}
              >
                {t.actions.previousPage}
              </Button>
              <Button
                variant="outlined"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => onPageChange(currentPage + 1)}
              >
                {t.actions.nextPage}
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
};
