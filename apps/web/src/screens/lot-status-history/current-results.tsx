import {
  AlertBanner,
  Button,
  Chip,
  type Column,
  EmptyState,
  Icon,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { toLotStatusSort, toTableSort } from './current-sort';
import {
  ALL_LOT_TYPES,
  type LotFilters,
  type LotStatusSort,
  LOT_PAGE_SIZES,
  type LotPageSize,
} from './filters';
import type { FilterOption } from './lot-filter-bar';
import { codeName, lotStatusTone, useLotHoldReasonOptions } from './options';
import { RefreshStatus } from './refresh-status';
import { useUomCodeOf, withUom } from './uoms';
import { useLotStatusList, useLotStatusSummary } from './queries';
import { useItemNameSources } from './reference-options';
import { lotStatusRowKey, type LotStatusRow } from './types';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { PageNav } from '../../patterns/page-nav';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnWidths } from '../../patterns/column-resize';
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
  lotTypeOptions: readonly FilterOption[];
  onSortChange: (sort: LotStatusSort) => void;
  onPageChange: (page: number) => void;
  /** 한 쪽에 보일 LOT 수(20 · 50 · 100) — 바꾸면 첫 쪽으로 간다. */
  pageSize: LotPageSize;
  onPageSizeChange: (size: LotPageSize) => void;
  onSelectLot: (lotId: number) => void;
  /** 지금 상세에 연 LOT — 그 줄을 파란 바탕으로 표시한다. */
  selectedLotId: number | null;
}

export const CurrentResults = ({
  filters,
  page,
  statusOptions,
  lotTypeOptions,
  onSortChange,
  onPageChange,
  pageSize: requestedPageSize,
  onPageSizeChange,
  onSelectLot,
  selectedLotId,
}: CurrentResultsProps) => {
  /*
   * 들어오자마자 목록을 띄운다(사용자 2026-10-30) — 아직 조회 단추를 누르지 않았으면(유형이 빈 값) 「전체」 유형으로
   * 부른다. 조회 단추를 눌렀을 때와 같은 조건이다.
   */
  const query: LotFilters =
    filters.lotType === '' ? { ...filters, lotType: ALL_LOT_TYPES } : filters;
  const list = useLotStatusList(query, page, requestedPageSize);
  const summary = useLotStatusSummary(query);
  const reasons = useLotHoldReasonOptions();
  const uomCodeOf = useUomCodeOf();
  const itemNames = useItemNameSources(list.data?.rows.map((row) => row.itemId) ?? []);

  const itemLabel = (itemId: number): string => {
    const source = itemNames.get(itemId);
    const item = source?.entries[0];

    if (item !== undefined) return item.isActive ? item.label : t.values.inactive(item.label);
    if (source === undefined || source.isLoading) return t.current.itemLabel.loading;
    return source.isError ? t.current.itemLabel.failed : t.current.itemLabel.unknown;
  };
  /*
   * 열 짜임은 검사 조회·판정 대기 목록을 따른다(사용자 2026-10-30) — 찾는 값(LOT · 품목)이 앞에 넓게, 상태 · 수량 ·
   * 사유는 좁게, 일시는 맨 끝이다. 모든 열은 가운데 정렬이다(사용자 2026-10-30). 폭은 px 로 두고 사용자가 끌어 바꾼 폭 · 순서는 브라우저에
   * 남는다(useColumnWidths · useColumnOrder). 긴 값은 칸 안에서 말줄임하고 전체 값은 title 로 보인다.
   *   LOT 260 · 품목 320 · 현재 상태 88 · 보유 수량 120 · 사유 160 · 최근 상태 변경 160
   */
  const columns: Column<LotStatusRow>[] = [
    {
      key: 'lotNo',
      header: t.current.columns.lot,
      align: 'center',
      width: '260px',
      sortable: true,
      render: (row) => (
        <span className="lot-no-with-type">
          {/* LOT 유형 라벨 — 번호 왼쪽(사용자 2026-10-30). */}
          {row.lotTypeCode !== null && (
            <Chip variant="status" status="info" size="sm">
              {lotTypeOptions.find((option) => option.value === row.lotTypeCode)?.label ??
                t.values.unlisted(row.lotTypeCode)}
            </Chip>
          )}
          <span
            className="lot-status-one-line"
            title={row.lotNo}
            aria-current={row.lotId === selectedLotId ? 'true' : undefined}
          >
            {row.lotNo}
          </span>
        </span>
      ),
    },
    {
      key: 'item',
      header: t.current.columns.item,
      align: 'center',
      width: '320px',
      sortable: true,
      render: (row) => <OneLine text={itemLabel(row.itemId)} />,
    },
    {
      key: 'lotStatusCode',
      header: t.current.columns.status,
      align: 'center',
      width: '88px',
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
      width: '120px',
      render: (row) => (
        <OneLine
          text={
            row.onHandQty === null ? EMPTY : withUom(quantity(row.onHandQty), uomCodeOf(row.uomId))
          }
        />
      ),
    },
    {
      key: 'latestReasonCode',
      header: t.current.columns.reason,
      align: 'center',
      width: '160px',
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
    {
      key: 'latestTransitionAt',
      header: t.current.columns.latestTransition,
      align: 'center',
      width: '160px',
      sortable: true,
      render: (row) => <OneLine text={formatDateTime(row.latestTransitionAt)} />,
    },
  ];
  const ordered = useColumnOrder('omf-mes:lot-status:columns:current:order', columns);
  /* 좌우 배치에서는 열을 줄이지 않고 표 안에서 가로로 구른다 — 검사 조회·판정 대기 목록과 같다. */
  const resizable = useColumnWidths('omf-mes:lot-status:columns:current', ordered, {
    fitContent: true,
  });
  const fit = useFitColumns(resizable.columns, { scrollX: true });

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
  const pageSize = meta !== undefined && meta.size > 0 ? meta.size : requestedPageSize;
  const totalPages = Math.ceil((meta?.total ?? 0) / pageSize);
  /* 고를 수 없는 크기(20 · 50 · 100 밖)를 서버가 돌려주면 크기 칸이 비므로 고른 크기를 보인다. */
  const shownPageSize: LotPageSize =
    LOT_PAGE_SIZES.find((size) => size === pageSize) ?? requestedPageSize;
  const isBeyondLast = meta !== undefined && meta.total > 0 && currentPage > totalPages;

  return (
    <section className="pane lot-status-pane" aria-labelledby="lot-current-results-title">
      <div className="lot-status-pane-head">
        <h2 className="pane-title" id="lot-current-results-title">
          {t.current.pane}
        </h2>
        {/* 권한 밖 제외 안내는 제목 바로 옆, 글 길이만큼만(사용자 2026-10-30). */}
        {summary.data?.outOfScopeCount != null && summary.data.outOfScopeCount > 0 && (
          <p className="iqc-inspection-action-note lot-status-scope-note" data-tone="info">
            <Icon name="info" size={14} aria-hidden />
            {t.current.summary.outOfScope(summary.data.outOfScopeCount)}
          </p>
        )}
        {/*
         * 오른쪽 끝 — 마지막 갱신 + [갱신](사용자 2026-10-30). 요약과 목록을 함께 다시 부른다. 「조회 기준」 자리를
         * 이어받는다(두 시각을 나란히 두면 헷갈린다).
         */}
        <RefreshStatus
          updatedAt={Math.max(list.dataUpdatedAt, summary.dataUpdatedAt)}
          isRefreshing={list.isFetching || summary.isFetching}
          onRefresh={() => {
            void list.refetch();
            void summary.refetch();
          }}
        />
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
          {/*
           * 상태별 건수는 상자 없이 한 줄로 편다 — 이름 아래 큰 숫자 · 단위(2026-10-30 시안). 집계를 못 낸 상태는
           * 「미확정」 글만 보인다.
           */}
          <div className="lot-status-summary-grid" role="group" aria-label={t.current.summary.pane}>
            {summaryCells.map((cell) => (
              <div key={cell.key} className="lot-status-stat" role="group" aria-label={cell.label}>
                <span className="lot-status-stat-label">{cell.label}</span>
                <span className="lot-status-stat-value">
                  {cell.value === null ? (
                    <span className="lot-status-stat-unit">{t.current.summary.unknownCount}</span>
                  ) : (
                    <>
                      {quantity(cell.value)}
                      <span className="lot-status-stat-unit">{t.current.summary.unit}</span>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="lot-status-pane-head">
        {/* 총 건수는 표 아래 쪽 이동 줄에만 둔다(사용자 2026-10-30). */}
        <h3 className="lot-status-list-title">{t.current.list.title}</h3>
      </div>
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
          {/*
           * 줄 아무 곳이나 눌러 그 LOT 상세를 연다 — LOT 번호를 따로 누르는 길은 두지 않는다(사용자 2026-10-30, PQC
           * 검사 대기 목록과 같다). 고른 줄은 파란 바탕이다(`.inspection-queue-table`).
           */}
          <div
            ref={fit.ref}
            className="wide-table lot-status-table lot-status-list-table inspection-queue-table"
            style={resizable.style}
            aria-busy={list.isFetching}
            onClick={(event) => {
              const row = (event.target as Element).closest('tbody tr');
              if (row === null || row.parentElement === null) return;
              const picked = rows[Array.from(row.parentElement.children).indexOf(row)];
              if (picked !== undefined) onSelectLot(picked.lotId);
            }}
          >
            <Table
              density="compact"
              caption={t.current.pane}
              columns={fit.columns}
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
            <PageNav
              sizes={LOT_PAGE_SIZES}
              meta={{ page: currentPage, size: shownPageSize, total: meta.total }}
              onChangePage={onPageChange}
              onChangeSize={onPageSizeChange}
              /* 쪽 크기 선택은 작게, 처음~마지막 단추는 크게 — 화면 안 쪽 이동을 같은 크기로(사용자 2026-10-30). */
              controlSize="sm"
              buttonSize="md"
            />
          )}
        </>
      )}
    </section>
  );
};
