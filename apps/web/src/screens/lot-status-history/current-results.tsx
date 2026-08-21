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

import { toLotStatusSort, toTableSort } from './current-sort';
import type { LotFilters, LotStatusSort } from './filters';
import type { FilterOption } from './lot-filter-bar';
import { useLotStatusList, useLotStatusSummary } from './queries';
import { lotStatusRowKey, type LotStatusRow } from './types';

const EMPTY = '—';

const formatDateTime = (value: string | null): string => {
  if (value === null) return EMPTY;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match === null ? value : `${match[1]} ${match[2]}`;
};

const knownLabel = (options: readonly FilterOption[], value: string): string | undefined =>
  options.find((option) => option.value === value)?.label;

const statusLabel = (options: readonly FilterOption[], value: string): string =>
  knownLabel(options, value) ?? `${value} (목록 미확정)`;

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
      <EmptyState
        size="sm"
        title="LOT 유형을 선택하고 조회하세요"
        description="조회 조건을 적용하면 현재 상태 요약과 LOT 목록이 표시됩니다."
      />
    );
  }

  const itemLabel = (itemId: number): string =>
    knownLabel(itemOptions, String(itemId)) ??
    (isItemPending ? '불러오는 중…' : isItemError ? '품목 목록 조회 실패' : '알 수 없음');
  const columns: Column<LotStatusRow>[] = [
    {
      key: 'lotNo',
      header: 'LOT',
      width: '176px',
      sortable: true,
      render: (row) => (
        <Button
          variant="text"
          size="sm"
          aria-label={`${row.lotNo} 상세 보기`}
          onClick={() => onSelectLot(row.lotId)}
        >
          {row.lotNo}
        </Button>
      ),
    },
    { key: 'item', header: '품목', sortable: true, render: (row) => itemLabel(row.itemId) },
    {
      key: 'lotStatusCode',
      header: '현재 상태',
      width: '180px',
      render: (row) => (
        <Chip variant="status" size="sm">
          {statusLabel(statusOptions, row.lotStatusCode)}
        </Chip>
      ),
    },
    {
      key: 'onHandQty',
      header: '보유',
      align: 'end',
      width: '112px',
      render: (row) => quantity(row.onHandQty),
    },
    {
      key: 'latestTransitionAt',
      header: '최근 전이',
      width: '156px',
      sortable: true,
      render: (row) => formatDateTime(row.latestTransitionAt),
    },
    {
      key: 'latestReasonCode',
      header: '사유',
      width: '168px',
      render: (row) => row.latestReasonCode ?? EMPTY,
    },
  ];

  const retry = (query: typeof list | typeof summary, label: string) => (
    <Button
      variant="outlined"
      size="sm"
      aria-label={`${label} 다시 시도`}
      onClick={() => void query.refetch()}
    >
      다시 시도
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
        ? `전체 ${quantity(meta.total)}건`
        : `${quantity(start)}–${quantity(start + rows.length - 1)} / 전체 ${quantity(meta.total)}건`;

  return (
    <section aria-labelledby="lot-current-results-title">
      <h2 id="lot-current-results-title">현재 상태</h2>
      {summary.isPending && (
        <div role="status" aria-label="현재 상태 요약을 불러오는 중">
          <SkeletonText lines={1} />
        </div>
      )}
      {summary.isError && (
        <AlertBanner
          variant="error"
          title="현재 상태 요약을 불러오지 못했습니다."
          action={retry(summary, '현재 상태 요약')}
        />
      )}
      {summary.data !== undefined && (
        <>
          <div className="filter-bar" role="group" aria-label="현재 상태 요약">
            {summaryCells.map((cell) => (
              <StatCard
                key={cell.key}
                label={cell.label}
                value={cell.value === null ? '집계 미확정' : String(cell.value)}
                unit="건"
              />
            ))}
          </div>
          <p className="field-note">기준 시각 {formatDateTime(summary.data.asOf)}</p>
          {summary.data.outOfScopeCount !== null && summary.data.outOfScopeCount > 0 && (
            <AlertBanner variant="info">
              권한 범위 밖 {summary.data.outOfScopeCount}건이 제외되었습니다.
            </AlertBanner>
          )}
        </>
      )}

      <h3>LOT 목록</h3>
      {list.isPending && (
        <div role="status" aria-label="LOT 목록을 불러오는 중">
          <SkeletonText lines={3} />
        </div>
      )}
      {list.isFetching && list.data !== undefined && (
        <p className="field-note" role="status" aria-label="LOT 목록 갱신 중">
          LOT 목록을 갱신하는 중입니다.
        </p>
      )}
      {list.isError && (
        <AlertBanner
          variant="error"
          title="LOT 목록을 불러오지 못했습니다."
          action={retry(list, 'LOT 목록')}
        />
      )}
      {list.data !== undefined && (
        <>
          <div className="wide-table" aria-busy={list.isFetching}>
            <Table
              density="compact"
              caption="현재 LOT 상태"
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
                      ? '이 쪽에는 결과가 없습니다'
                      : '조건에 맞는 LOT이 없습니다'
                  }
                  action={
                    isBeyondLast ? (
                      <Button variant="outlined" onClick={() => onPageChange(1)}>
                        첫 쪽으로
                      </Button>
                    ) : undefined
                  }
                />
              }
            />
          </div>
          {meta !== undefined && (
            <nav className="form-actions" aria-label="LOT 목록 쪽 이동">
              <p className="field-note form-actions-secondary">{rangeLabel}</p>
              <Button
                variant="outlined"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => onPageChange(currentPage - 1)}
              >
                이전 쪽
              </Button>
              <Button
                variant="outlined"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => onPageChange(currentPage + 1)}
              >
                다음 쪽
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
};
