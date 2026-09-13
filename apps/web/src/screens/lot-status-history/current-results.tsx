import {
  AlertBanner,
  Button,
  Chip,
  type Column,
  EmptyState,
  SkeletonText,
  StatCard,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { toLotStatusSort, toTableSort } from './current-sort';
import type { LotFilters, LotStatusSort } from './filters';
import type { FilterOption } from './lot-filter-bar';
import { useLotStatusList, useLotStatusSummary } from './queries';
import { lotStatusRowKey, type LotStatusRow } from './types';

const t = messages.lotStatusHistory;
const EMPTY = '—';

const formatDateTime = (value: string | null): string => {
  if (value === null) return EMPTY;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match === null ? value : `${match[1]} ${match[2]}`;
};

const knownLabel = (options: readonly FilterOption[], value: string): string | undefined =>
  options.find((option) => option.value === value)?.label;

const statusLabel = (options: readonly FilterOption[], value: string): string =>
  knownLabel(options, value) ?? t.values.unlisted(value);

const quantity = (value: number | null): string =>
  value === null ? EMPTY : new Intl.NumberFormat('ko-KR').format(value);

interface CurrentResultsProps {
  filters: LotFilters;
  page: number;
  statusOptions: readonly FilterOption[];
  itemOptions: readonly FilterOption[];
  isItemPending: boolean;
  isItemError: boolean;
  onSortChange: (sort: LotStatusSort) => void;
  onPageChange: (page: number) => void;
  onSelectLot: (lotId: number) => void;
}

export const CurrentResults = ({
  filters,
  page,
  statusOptions,
  itemOptions,
  isItemPending,
  isItemError,
  onSortChange,
  onPageChange,
  onSelectLot,
}: CurrentResultsProps) => {
  const list = useLotStatusList(filters, page);
  const summary = useLotStatusSummary(filters);

  if (filters.lotType === '') {
    return (
      <section
        className="pane lot-status-pane lot-status-empty-pane"
        aria-labelledby="lot-current-results-title"
      >
        <h2 className="pane-title" id="lot-current-results-title">
          {t.current.pane}
        </h2>
        <EmptyState
          size="sm"
          title={t.current.beforeSearch.title}
          description={t.current.beforeSearch.description}
        />
      </section>
    );
  }

  const itemLabel = (itemId: number): string =>
    knownLabel(itemOptions, String(itemId)) ??
    (isItemPending
      ? t.current.itemLabel.loading
      : isItemError
        ? t.current.itemLabel.failed
        : t.current.itemLabel.unknown);
  const columns: Column<LotStatusRow>[] = [
    {
      key: 'lotNo',
      header: t.current.columns.lot,
      width: '176px',
      sortable: true,
      render: (row) => (
        <Button
          variant="text"
          size="sm"
          aria-label={t.current.openDetail(row.lotNo)}
          onClick={() => onSelectLot(row.lotId)}
        >
          {row.lotNo}
        </Button>
      ),
    },
    {
      key: 'item',
      header: t.current.columns.item,
      sortable: true,
      render: (row) => itemLabel(row.itemId),
    },
    {
      key: 'lotStatusCode',
      header: t.current.columns.status,
      width: '180px',
      render: (row) => (
        <Chip variant="status" size="sm">
          {statusLabel(statusOptions, row.lotStatusCode)}
        </Chip>
      ),
    },
    {
      key: 'onHandQty',
      header: t.current.columns.onHand,
      align: 'end',
      width: '112px',
      render: (row) => quantity(row.onHandQty),
    },
    {
      key: 'latestTransitionAt',
      header: t.current.columns.latestTransition,
      width: '156px',
      sortable: true,
      render: (row) => formatDateTime(row.latestTransitionAt),
    },
    {
      key: 'latestReasonCode',
      header: t.current.columns.reason,
      width: '168px',
      render: (row) => row.latestReasonCode ?? EMPTY,
    },
  ];

  const retry = (query: typeof list | typeof summary, label: string) => (
    <Button
      variant="outlined"
      size="sm"
      aria-label={t.actions.retryLabel(label)}
      onClick={() => void query.refetch()}
    >
      {t.actions.retry}
    </Button>
  );
  const rows = [...(list.data?.rows ?? [])];
  const summaryCells = [
    ...statusOptions.map((option) => ({
      key: option.value,
      label: option.label,
      value:
        summary.data?.counts.find((count) => count.statusCode === option.value)?.lotCount ?? null,
    })),
    ...(summary.data?.counts ?? [])
      .filter((count) => knownLabel(statusOptions, count.statusCode) === undefined)
      .map((count) => ({
        key: `${count.statusCode}:${count.lotTypeCode ?? ''}`,
        label: statusLabel(statusOptions, count.statusCode),
        value: count.lotCount,
      })),
  ];
  const meta = list.data?.page;
  const currentPage = meta !== undefined && meta.page > 0 ? meta.page : page;
  const pageSize = meta !== undefined && meta.size > 0 ? meta.size : 1;
  const totalPages = Math.ceil((meta?.total ?? 0) / pageSize);
  const isBeyondLast = meta !== undefined && meta.total > 0 && currentPage > totalPages;
  const start = (currentPage - 1) * pageSize + 1;
  const rangeLabel =
    meta === undefined
      ? ''
      : rows.length === 0
        ? t.range.total(quantity(meta.total))
        : t.range.span(quantity(start), quantity(start + rows.length - 1), quantity(meta.total));

  return (
    <section className="pane lot-status-pane" aria-labelledby="lot-current-results-title">
      <h2 className="pane-title" id="lot-current-results-title">
        {t.current.pane}
      </h2>
      {summary.isPending && (
        <div role="status" aria-label={t.current.summary.loading}>
          <SkeletonText lines={1} />
        </div>
      )}
      {summary.isError && (
        <AlertBanner
          variant="error"
          title={t.current.summary.failed}
          action={retry(summary, t.current.summary.pane)}
        />
      )}
      {summary.data !== undefined && (
        <>
          <div className="lot-status-summary-grid" role="group" aria-label={t.current.summary.pane}>
            {summaryCells.map((cell) => (
              <StatCard
                key={cell.key}
                label={cell.label}
                value={cell.value === null ? t.current.summary.unknownCount : String(cell.value)}
                unit={t.current.summary.unit}
              />
            ))}
          </div>
          <p className="field-note">{t.current.summary.asOf(formatDateTime(summary.data.asOf))}</p>
          {summary.data.outOfScopeCount !== null && summary.data.outOfScopeCount > 0 && (
            <AlertBanner variant="info">
              {t.current.summary.outOfScope(summary.data.outOfScopeCount)}
            </AlertBanner>
          )}
        </>
      )}

      <h3 className="lot-status-list-title">{t.current.list.title}</h3>
      {list.isPending && (
        <div role="status" aria-label={t.current.list.loading}>
          <SkeletonText lines={3} />
        </div>
      )}
      {list.isFetching && list.data !== undefined && (
        <p className="field-note" role="status" aria-label={t.current.list.refreshing}>
          {t.current.list.refreshingText}
        </p>
      )}
      {list.isError && (
        <AlertBanner
          variant="error"
          title={t.current.list.failed}
          action={retry(list, t.current.list.title)}
        />
      )}
      {list.data !== undefined && (
        <>
          <div className="wide-table lot-status-table" aria-busy={list.isFetching}>
            <Table
              density="compact"
              caption={t.current.pane}
              columns={columns}
              rows={rows}
              getRowId={lotStatusRowKey}
              sort={toTableSort(filters.sort)}
              onSortChange={(sort) => onSortChange(toLotStatusSort(sort))}
              empty={
                <EmptyState
                  size="sm"
                  live
                  title={
                    meta !== undefined && meta.total > 0
                      ? t.current.list.emptyPage
                      : t.current.list.empty
                  }
                  action={
                    isBeyondLast ? (
                      <Button variant="outlined" onClick={() => onPageChange(1)}>
                        {t.current.list.firstPage}
                      </Button>
                    ) : undefined
                  }
                />
              }
            />
          </div>
          {meta !== undefined && (
            <nav className="form-actions" aria-label={t.current.list.pagination}>
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
