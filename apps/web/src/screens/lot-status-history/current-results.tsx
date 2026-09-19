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
import { codeName, lotStatusTone, useLotHoldReasonOptions } from './options';
import { useUomCodeOf, withUom } from './uoms';
import { useLotStatusList, useLotStatusSummary } from './queries';
import { useItemNameSources } from './reference-options';
import { lotStatusRowKey, type LotStatusRow } from './types';
import { formatPlantDateTime } from '../../patterns/plant-time';

const t = messages.lotStatusHistory;
const EMPTY = '—';

const formatDateTime = (value: string | null): string => {
  if (value === null) return EMPTY;
  return formatPlantDateTime(value) ?? value;
};

const knownLabel = (options: readonly FilterOption[], value: string): string | undefined =>
  options.find((option) => option.value === value)?.label;

const statusLabel = (options: readonly FilterOption[], value: string): string =>
  knownLabel(options, value) ?? t.values.unlisted(value);

const quantity = (value: number | null): string =>
  value === null ? EMPTY : new Intl.NumberFormat('ko-KR').format(value);

/** 칸 안 한 줄 — 넘치면 말줄임하고 전체 값은 title 로(app.css .lot-status-one-line). */
const OneLine = ({ text }: { text: string }) => (
  <span className="lot-status-one-line" title={text}>
    {text}
  </span>
);

interface CurrentResultsProps {
  filters: LotFilters;
  page: number;
  statusOptions: readonly FilterOption[];
  onSortChange: (sort: LotStatusSort) => void;
  onPageChange: (page: number) => void;
  onSelectLot: (lotId: number) => void;
}

export const CurrentResults = ({
  filters,
  page,
  statusOptions,
  onSortChange,
  onPageChange,
  onSelectLot,
}: CurrentResultsProps) => {
  const list = useLotStatusList(filters, page);
  const summary = useLotStatusSummary(filters);
  const reasons = useLotHoldReasonOptions();
  const uomCodeOf = useUomCodeOf();
  const itemNames = useItemNameSources(list.data?.rows.map((row) => row.itemId) ?? []);

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

  const itemLabel = (itemId: number): string => {
    const source = itemNames.get(itemId);
    const item = source?.entries[0];

    if (item !== undefined) return item.isActive ? item.label : t.values.inactive(item.label);
    if (source === undefined || source.isLoading) return t.current.itemLabel.loading;
    return source.isError ? t.current.itemLabel.failed : t.current.itemLabel.unknown;
  };
  /*
   * ⭐ 열 폭은 값의 성격대로 나눈다(사용자 지시 2026-09-19). 표는 고정 배치(app.css
   * .lot-status-list-table)라 비율이 그대로 지켜지고, 넓은 모니터에서도 한 열이 남는 폭을
   * 독차지하지 않는다. 긴 값은 칸 안에서 말줄임하고 전체 값은 title 로 보인다.
   *   LOT 22% · 품목 27%(긴 이름) — 넓게 / 상태 9% · 수량 9% — 좁게 / 최근 상태 변경 15% · 사유 18% — 중간
   * 정렬: ⭐ 모든 열 가운데(사용자 지시 2026-09-19).
   */
  const columns: Column<LotStatusRow>[] = [
    {
      key: 'lotNo',
      header: t.current.columns.lot,
      align: 'center',
      width: '22%',
      sortable: true,
      render: (row) => (
        <Button
          className="lot-status-lot-no"
          variant="text"
          size="sm"
          title={row.lotNo}
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
      align: 'center',
      width: '27%',
      sortable: true,
      render: (row) => <OneLine text={itemLabel(row.itemId)} />,
    },
    {
      key: 'lotStatusCode',
      header: t.current.columns.status,
      align: 'center',
      width: '9%',
      render: (row) => (
        <Chip variant="status" status={lotStatusTone(row.lotStatusCode)} size="sm">
          {statusLabel(statusOptions, row.lotStatusCode)}
        </Chip>
      ),
    },
    {
      key: 'onHandQty',
      header: t.current.columns.onHand,
      align: 'center',
      width: '9%',
      render: (row) => (
        <OneLine
          text={
            row.onHandQty === null ? EMPTY : withUom(quantity(row.onHandQty), uomCodeOf(row.uomId))
          }
        />
      ),
    },
    {
      key: 'latestTransitionAt',
      header: t.current.columns.latestTransition,
      align: 'center',
      width: '15%',
      sortable: true,
      render: (row) => <OneLine text={formatDateTime(row.latestTransitionAt)} />,
    },
    {
      key: 'latestReasonCode',
      header: t.current.columns.reason,
      align: 'center',
      width: '18%',
      render: (row) => (
        <OneLine
          text={
            row.latestReasonCode === null
              ? EMPTY
              : codeName(reasons.data?.items, row.latestReasonCode)
          }
        />
      ),
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
  /*
   * 유형 「전체」로 조회하면 서버가 상태×유형별로 센다. 요약 칸은 상태별 한 칸이라 유형을 더한다
   * (사용자 지시 2026-09-19 — 유형 없이 조회). 한 유형으로 조회하면 행이 상태마다 하나라 그대로다.
   */
  const countOf = (statusCode: string): number | null => {
    const matched = summary.data?.counts.filter((count) => count.statusCode === statusCode) ?? [];
    return matched.length === 0 ? null : matched.reduce((sum, count) => sum + count.lotCount, 0);
  };
  const unknownStatusCodes = [
    ...new Set(
      (summary.data?.counts ?? [])
        .map((count) => count.statusCode)
        .filter((code) => knownLabel(statusOptions, code) === undefined),
    ),
  ];
  const summaryCells = [
    ...statusOptions.map((option) => ({
      key: option.value,
      label: option.label,
      value: countOf(option.value),
    })),
    ...unknownStatusCodes.map((code) => ({
      key: code,
      label: statusLabel(statusOptions, code),
      value: countOf(code),
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
      {/* ⭐ 기준 시각은 제목 옆 — 숫자보다 낮은 위계로(사용자 지시 2026-09-19). */}
      <div className="lot-status-pane-head">
        <h2 className="pane-title" id="lot-current-results-title">
          {t.current.pane}
        </h2>
        {summary.data !== undefined && (
          <span className="field-note">
            {t.current.summary.asOf(formatDateTime(summary.data.asOf))}
          </span>
        )}
      </div>
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
          <div
            className="wide-table lot-status-table lot-status-list-table"
            aria-busy={list.isFetching}
          >
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
          )}
        </>
      )}
    </section>
  );
};
