import {
  AlertBanner,
  Button,
  Chip,
  type Column,
  DatePicker,
  EmptyState,
  SearchInput,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import type { components, paths } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { HubActions, useHubActionsTarget } from '../../patterns/hub-actions';
import { PaneSplitter, useFitToViewport, usePaneSplit } from '../../patterns/po-board';
import {
  PaneHeightSplitter,
  SplitOrientationToggle,
  useSplitOrientation,
} from '../../patterns/split-orientation';
import {
  lookupDisplayLabelWithInactive,
  type LookupSource,
  selectableLookupOptions,
} from '../../patterns/lookup-display';
import { runRequest } from '../../patterns/request';
import { Select } from '../../patterns/select';
import {
  codeName,
  lotStatusTone,
  useLotHoldReasonOptions as useHoldReasonNames,
  useLotStatusOptions,
  useLotTypeOptions,
} from '../lot-status-history/options';
import {
  DEFAULT_LOT_PAGE_SIZE,
  LOT_PAGE_SIZES,
  type LotPageSize,
} from '../lot-status-history/filters';
import { StatusChips } from '../lot-status-history/screen';
import { useUomCodeOf, withUom } from '../lot-status-history/uoms';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnWidths } from '../../patterns/column-resize';
import { PageNav } from '../../patterns/page-nav';
import { LOT_HOLD_RELEASE_REASON_GROUP, useLotHoldReasonOptions } from './code-options';
import {
  useItemNameSources,
  useItemReferenceOptions,
} from '../lot-status-history/reference-options';
import {
  defaultTransitionPeriod,
  toTransitionPeriodBounds,
  validateTransitionPeriod,
} from './period';
import { LotStatusTransitionPreparation } from './transition-preparation';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { PaneEmptyIcon } from '../../patterns/pane-empty-icon';

type LotStatusCandidateQuery = NonNullable<
  NonNullable<paths['/quality/lot-statuses']['get']>['parameters']['query']
>;
type LotStatusSummaryQuery = NonNullable<
  NonNullable<paths['/quality/lot-status-summary']['get']>['parameters']['query']
>;
export type LotStatusCandidate = components['schemas']['LotQualityStatus'];

const t = messages.lotStatusTransition.candidate;
const tSelected = messages.lotStatusTransition.selected;
const tHistory = messages.lotStatusHistory;

/* 좌우 · 상하 배치와 가운데 막대 비율은 LOT 상태 이력 탭과 따로 기억한다. */
const SPLIT_KEY = 'omf-mes:lot-status-transition:split';
const SPLIT_ORIENTATION_KEY = 'omf-mes:lot-status-transition:split-orientation';

export interface LotStatusCandidateFilters {
  q: string;
  itemId: string;
  lotStatusCode: string;
  from: string;
  to: string;
}

export const EMPTY_LOT_STATUS_CANDIDATE_FILTERS: LotStatusCandidateFilters = {
  q: '',
  itemId: '',
  lotStatusCode: '',
  from: '',
  to: '',
};

export const defaultLotStatusCandidateFilters = (today: Date): LotStatusCandidateFilters => ({
  ...EMPTY_LOT_STATUS_CANDIDATE_FILTERS,
  ...defaultTransitionPeriod(today),
});

const positiveId = (value: string): number | undefined => {
  if (!/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

export const toLotStatusCandidateQuery = (
  filters: LotStatusCandidateFilters,
  page: number,
  offsetMinutes: number,
  /** 한 쪽 LOT 수 — 주지 않으면 서버 기본 크기다. */
  size?: number,
): LotStatusCandidateQuery => {
  const query: LotStatusCandidateQuery = {};
  const itemId = positiveId(filters.itemId);
  if (filters.q !== '') query.q = filters.q;
  if (itemId !== undefined) query.itemId = itemId;
  if (filters.lotStatusCode !== '') query.lotStatusCode = filters.lotStatusCode;
  if (validateTransitionPeriod(filters) === null)
    Object.assign(query, toTransitionPeriodBounds(filters, offsetMinutes));
  if (Number.isSafeInteger(page) && page > 1) query.page = page;
  if (size !== undefined) query.size = size;
  return query;
};

export const lotStatusTransitionKeys = {
  candidates: (
    filters: LotStatusCandidateFilters,
    page: number,
    offsetMinutes: number,
    size?: number,
  ) => ['lot-status-transition', 'candidates', { ...filters }, page, size, offsetMinutes] as const,
  statusCounts: (filters: LotStatusCandidateFilters, offsetMinutes: number) =>
    ['lot-status-transition', 'status-counts', { ...filters }, offsetMinutes] as const,
};

/**
 * 상태 칩 건수 — 목록과 같은 조건(LOT 번호 · 자재 · 기간)에서 상태만 뺀 요약 한 번이다. 요약은 목록과 같은 WHERE 로
 * LOT 하나를 한 건으로 센다(서버 lot-status.service.ts) — 칩을 눌러도 키가 같아 다시 부르지 않는다.
 */
export const toLotStatusCountsQuery = (
  filters: LotStatusCandidateFilters,
  offsetMinutes: number,
): LotStatusSummaryQuery =>
  /* 1쪽 · 크기 없음이라 page · size 가 붙지 않는다 — 남는 것은 요약도 받는 조건뿐이다. */
  toLotStatusCandidateQuery({ ...filters, lotStatusCode: '' }, 1, offsetMinutes);

const useStatusCounts = (
  filters: LotStatusCandidateFilters,
  offsetMinutes: number,
  enabled: boolean,
) => {
  const { client } = useApiClient();
  const withoutStatus = { ...filters, lotStatusCode: '' };
  const query = toLotStatusCountsQuery(withoutStatus, offsetMinutes);
  return useQuery({
    queryKey: lotStatusTransitionKeys.statusCounts(withoutStatus, offsetMinutes),
    enabled,
    placeholderData: keepPreviousData,
    queryFn: () =>
      runRequest(() => client.GET('/quality/lot-status-summary', { params: { query } })),
  });
};

const ROOT_KEY = ['lot-status-transition'] as const;

const useCandidates = (
  filters: LotStatusCandidateFilters,
  page: number,
  offsetMinutes: number,
  size: number,
  enabled: boolean,
) => {
  const { client } = useApiClient();
  const query = toLotStatusCandidateQuery(filters, page, offsetMinutes, size);
  return useQuery({
    queryKey: lotStatusTransitionKeys.candidates(filters, page, offsetMinutes, size),
    enabled,
    placeholderData: keepPreviousData,
    queryFn: () => runRequest(() => client.GET('/quality/lot-statuses', { params: { query } })),
  });
};

const rowKey = (row: LotStatusCandidate): string =>
  `${row.lotId}:${row.warehouseId ?? '-'}:${row.locationId ?? '-'}`;
const emptyValue = '—';
const quantity = (value: number | undefined): string =>
  value === undefined ? emptyValue : new Intl.NumberFormat('ko-KR').format(value);
const formatDateTime = (value: string | undefined): string => {
  if (value === undefined) return emptyValue;
  return formatPlantDateTime(value) ?? value;
};

interface FilterSelectProps {
  /** 칸의 폭 규칙 — 값 길이가 다른 두 선택칸(자재·품질 상태)이 서로 다른 폭을 갖게 한다. */
  cellClassName: string;
  disabled: boolean;
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

const FilterSelect = ({
  cellClassName,
  disabled,
  label,
  options,
  value,
  onChange,
}: FilterSelectProps) => {
  const id = useId();
  return (
    <div className={`field-cell ${cellClassName}`}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <Select id={id} disabled={disabled} options={options} value={value} onChange={onChange} />
    </div>
  );
};

export const LotStatusTransitionCandidateScreen = () => {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(() => defaultLotStatusCandidateFilters(new Date()));
  const [filters, setFilters] = useState(() => defaultLotStatusCandidateFilters(new Date()));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<LotPageSize>(DEFAULT_LOT_PAGE_SIZE);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [confirmationPinned, setConfirmationPinned] = useState(false);
  const offsetMinutes = -new Date().getTimezoneOffset();
  const candidates = useCandidates(filters, page, offsetMinutes, pageSize, !confirmationPinned);
  const selected =
    candidates.isError && !confirmationPinned
      ? null
      : (candidates.data?.items.find((candidate) => rowKey(candidate) === selectedKey) ?? null);
  useEffect(() => {
    if (
      !confirmationPinned &&
      selectedKey !== null &&
      candidates.data !== undefined &&
      !candidates.isFetching &&
      !candidates.isError &&
      selected === null
    )
      setSelectedKey(null);
  }, [
    candidates.data,
    candidates.isError,
    candidates.isFetching,
    confirmationPinned,
    selected,
    selectedKey,
  ]);
  const onConfirmationChange = useCallback(
    (pinned: boolean): void => {
      setConfirmationPinned(pinned);
      if (pinned) void queryClient.cancelQueries({ queryKey: ROOT_KEY });
    },
    [queryClient],
  );
  const items = useItemReferenceOptions();
  const uomCodeOf = useUomCodeOf();
  const lotTypes = useLotTypeOptions();
  /* 단위를 못 풀면 수량만 낸다 — 「알 수 없음」 같은 말을 새로 만들지 않는다(LOT 현황과 같은 단위 풀이). */
  const quantityWithUnit = (value: number | undefined, uomId: number | undefined): string =>
    value === undefined ? quantity(value) : withUom(quantity(value), uomCodeOf(uomId ?? null));
  const lotTypeLabel = (code: string): string =>
    lotTypes.data?.items.find((item) => item.code === code)?.label ??
    messages.lotStatusHistory.values.unlisted(code);
  const itemNames = useItemNameSources(
    candidates.data?.items.map((candidate) => candidate.itemId) ?? [],
  );
  const statuses = useLotStatusOptions();
  /* 최근 사유는 코드가 아니라 공통코드 이름으로 보인다(보류·해제 사유 · LOT 이력 화면과 같은 매핑). */
  const holdReasonNames = useHoldReasonNames();
  const releaseReasonNames = useLotHoldReasonOptions(LOT_HOLD_RELEASE_REASON_GROUP);
  const reasonLabel = (code: string): string => {
    const hold = codeName(holdReasonNames.data?.items, code);
    if (hold !== code) return hold;
    return releaseReasonNames.options.find((option) => option.value === code)?.label ?? code;
  };
  const periodLabelId = useId();
  const periodReasonId = useId();
  const detailId = useId();
  /* 자재는 상세 조건으로 접어 둔다 — 걸린 자재가 있으면 펼친 채로 들어온다(LOT 상태 이력의 처리자와 같다). */
  const [isDetailOpen, setIsDetailOpen] = useState(filters.itemId !== '');
  const periodError = validateTransitionPeriod(draft);
  /* 날짜를 비운 경우는 [조회]만 잠그고 문구는 두지 않는다(LOT 상태 이력과 같다). 검사 규칙은 종전 그대로다. */
  const periodReason =
    periodError === 'invalid'
      ? t.filters.periodInvalid
      : periodError === 'reversed'
        ? t.filters.periodReversed
        : null;
  const itemSource: LookupSource = {
    entries: items.data?.entries ?? [],
    isLoading: items.isPending,
    isError: items.isError,
  };
  const itemOptions = selectableLookupOptions(itemSource, draft.itemId);
  const statusOptions =
    statuses.data?.items.map((item) => ({ value: item.code, label: item.label })) ?? [];
  /* 이름은 보이는 행의 품목 상세로 푼다 — 품목 목록은 첫 쪽만 받아 그 밖 품목이 「알 수 없음」이 된다(#1336). */
  const itemLabel = (itemId: number): string =>
    lookupDisplayLabelWithInactive(
      itemNames.get(itemId) ?? { entries: [], isError: false, isLoading: true },
      itemId,
    );
  const statusLabel = (code: string): string =>
    statusOptions.find((option) => option.value === code)?.label ?? t.statusUnknown(code);
  const currentStatusChip =
    selected === null ? null : (
      <Chip variant="status" status={lotStatusTone(selected.lotStatusCode)} size="sm">
        {statusLabel(selected.lotStatusCode)}
      </Chip>
    );
  /* 상태 칩 — 탭 막대 오른쪽(LOT 상태 이력 · LOT 현황과 같다). 누르면 그 상태로 서버에서 다시 거른다. */
  const statusCounts = useStatusCounts(filters, offsetMinutes, !confirmationPinned);
  const chipCounts = useMemo(() => {
    if (statusCounts.data === undefined) return undefined;
    const counts = new Map<string, number>();
    for (const row of statusCounts.data.counts) {
      counts.set(row.statusCode, (counts.get(row.statusCode) ?? 0) + row.lotCount);
    }
    return counts;
  }, [statusCounts.data]);
  const hubTarget = useHubActionsTarget();
  const { splitRef, aboveRef } = useFitToViewport();
  const split = usePaneSplit(SPLIT_KEY, 0.5);
  const layout = useSplitOrientation(SPLIT_ORIENTATION_KEY);
  const changePage = (next: number): void => {
    if (confirmationPinned) return;
    setPage(next);
    setSelectedKey(null);
  };
  const changePageSize = (size: LotPageSize): void => {
    if (confirmationPinned) return;
    setPageSize(size);
    changePage(1);
  };
  const apply = (): void => {
    if (confirmationPinned || periodError !== null) return;
    setFilters({ ...draft });
    changePage(1);
  };
  const changeStatus = (lotStatusCode: string): void => {
    if (confirmationPinned) return;
    setDraft((current) => ({ ...current, lotStatusCode }));
    setFilters((current) => ({ ...current, lotStatusCode }));
    changePage(1);
  };
  const statusChips = (
    <StatusChips
      options={statusOptions}
      counts={chipCounts}
      value={filters.lotStatusCode}
      disabled={confirmationPinned}
      onChange={changeStatus}
    />
  );
  const reset = (): void => {
    if (confirmationPinned) return;
    const next = defaultLotStatusCandidateFilters(new Date());
    setDraft(next);
    setFilters(next);
    changePage(1);
  };
  const toggleRow = (row: LotStatusCandidate): void => {
    /* 고른 줄을 다시 누르면 선택을 푼다(LOT 상태 이력과 같다). */
    if (!confirmationPinned)
      setSelectedKey((current) => (current === rowKey(row) ? null : rowKey(row)));
  };

  const columns: Column<LotStatusCandidate>[] = [
    /*
     * 표는 LOT 현황 목록과 같은 짜임이다 — 모든 열 가운데 정렬, 폭은 px 로 두고 끌어 바꾼 폭 · 순서는 브라우저에 남는다.
     *   LOT 260 · 품목 320 · 상태 88 · 보유 수량 120 · 보류 수량 120
     */
    {
      key: 'lotNo',
      header: t.fields.lotNo,
      align: 'center',
      width: '260px',
      render: (row) => (
        <span className="lot-no-with-type">
          {/* LOT 유형 라벨 — 번호 왼쪽(LOT 현황과 같다). */}
          {row.lotTypeCode !== undefined && (
            <Chip variant="status" status="info" size="sm">
              {lotTypeLabel(row.lotTypeCode)}
            </Chip>
          )}
          <button
            type="button"
            className="link-cell lot-status-one-line"
            title={row.lotNo}
            aria-label={t.select(row.lotNo)}
            aria-current={selectedKey === rowKey(row) ? true : undefined}
            disabled={confirmationPinned}
            onClick={() => toggleRow(row)}
          >
            {row.lotNo}
          </button>
        </span>
      ),
    },
    {
      key: 'item',
      header: t.fields.item,
      align: 'center',
      width: '320px',
      /* 긴 품목명은 칸 안에서 말줄임하고, 전체 이름은 title 로 남긴다. */
      render: (row) => {
        const label = itemLabel(row.itemId);

        return (
          <span className="lot-status-one-line" title={label}>
            {label}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: t.fields.status,
      align: 'center',
      width: '88px',
      /* 상태 색은 LOT 현황과 같다 — 정상 초록 · 검사 대기 노랑 · 불량 빨강 · 그 밖 회색. */
      render: (row) => (
        <Chip variant="status" status={lotStatusTone(row.lotStatusCode)} size="sm">
          {statusLabel(row.lotStatusCode)}
        </Chip>
      ),
    },
    {
      key: 'onHand',
      header: t.fields.onHand,
      align: 'center',
      width: '120px',
      render: (row) => quantityWithUnit(row.onHandQty, row.uomId),
    },
    {
      key: 'held',
      header: t.fields.held,
      align: 'center',
      width: '120px',
      render: (row) => quantityWithUnit(row.heldQty, row.uomId),
    },
  ];
  const ordered = useColumnOrder('omf-mes:lot-status:columns:transition:order', columns);
  const resizable = useColumnWidths('omf-mes:lot-status:columns:transition', ordered, {
    fitContent: true,
  });
  const fit = useFitColumns(resizable.columns, { scrollX: true });
  const meta = candidates.data?.page;
  const currentPage = meta !== undefined && meta.page > 0 ? meta.page : page;
  /* 고를 수 없는 크기(10 · 20 · 50 밖)를 서버가 돌려주면 크기 칸이 비므로 고른 크기를 보인다. */
  const shownPageSize: LotPageSize = LOT_PAGE_SIZES.find((size) => size === meta?.size) ?? pageSize;

  return (
    <div className="lot-status-transition-flow">
      {/* 상태 칩은 탭 막대 오른쪽, 좌우 · 상하 배치 단추 왼쪽이다. 탭 막대가 없으면(묶음 밖) 조회 카드 위쪽 줄에 둔다. */}
      {hubTarget !== null && <HubActions target={hubTarget}>{statusChips}</HubActions>}
      <SplitOrientationToggle orientation={layout.orientation} onChange={layout.change} />
      {/* 조회 조건 카드 — LOT 상태 이력과 같은 짜임(기간 · LOT 스캔 · 조회 · 초기화 · 상세 검색). */}
      <section
        ref={aboveRef}
        className="pane lot-status-search"
        aria-label={tHistory.lotFilter.pane}
      >
        {hubTarget === null && <div className="lot-status-search-head">{statusChips}</div>}
        <div className="filter-bar lot-status-filter lot-status-transition-filter">
          {/* 기간 — 「기간」 한 이름 아래 [시작일] [종료일] 두 달력 칸. 기준(최근 전이일)과 처음 값(최근 30일)은 종전 그대로다. */}
          <div className="field-cell" role="group" aria-labelledby={periodLabelId}>
            <span className="field-label" id={periodLabelId}>
              {tHistory.historyFilter.fields.period}
            </span>
            <div className="lot-status-date-range-row">
              <DatePicker
                className="lot-status-date-field"
                aria-label={tHistory.historyFilter.fields.from}
                placeholder={tHistory.historyFilter.fields.from}
                disabled={confirmationPinned}
                invalid={draft.from === ''}
                value={draft.from === '' ? null : draft.from}
                onChange={(from) => setDraft((current) => ({ ...current, from }))}
              />
              <DatePicker
                className="lot-status-date-field"
                aria-label={tHistory.historyFilter.fields.to}
                placeholder={tHistory.historyFilter.fields.to}
                disabled={confirmationPinned}
                invalid={draft.to === '' || periodReason !== null}
                value={draft.to === '' ? null : draft.to}
                onChange={(to) => setDraft((current) => ({ ...current, to }))}
                aria-describedby={periodReason === null ? undefined : periodReasonId}
              />
            </div>
            {periodReason !== null && (
              <span id={periodReasonId} className="field-error" role="alert">
                {periodReason}
              </span>
            )}
          </div>
          <SearchInput
            disabled={confirmationPinned}
            containerClassName="lot-status-filter-lot-no"
            label={tHistory.lotFilter.lotScanLabel}
            placeholder={tHistory.lotFilter.lotNoScanPlaceholder}
            value={draft.q}
            onChange={(event) => setDraft((current) => ({ ...current, q: event.target.value }))}
            onSearch={apply}
            clearLabel={messages.common.clear}
          />
          {/* [조회](주 동작) → [초기화] → 상세 검색 펼치기 — LOT 상태 이력과 같은 순서, 줄의 오른쪽 끝. */}
          <div className="filter-actions field-cell-unlabeled lot-status-filter-actions">
            <Button
              variant="filled"
              disabled={confirmationPinned || periodError !== null}
              aria-describedby={periodReason === null ? undefined : periodReasonId}
              onClick={apply}
            >
              {t.filters.search}
            </Button>
            <Button variant="outlined" disabled={confirmationPinned} onClick={reset}>
              {t.filters.reset}
            </Button>
            <Button
              variant="text"
              size="sm"
              aria-expanded={isDetailOpen}
              aria-controls={detailId}
              onClick={() => setIsDetailOpen((open) => !open)}
            >
              {isDetailOpen ? tHistory.lotFilter.detailClose : tHistory.lotFilter.detailOpen}
            </Button>
          </div>
        </div>
        {/* `hidden` 은 감싸는 상자에 둔다 — `.filter-bar` 의 display 가 속성을 덮는다. */}
        <div id={detailId} hidden={!isDetailOpen}>
          <div className="filter-bar lot-status-filter lot-status-transition-filter">
            <FilterSelect
              cellClassName="wide-select lot-status-transition-item-filter"
              disabled={confirmationPinned}
              label={t.filters.item}
              options={[{ value: '', label: t.filters.all }, ...itemOptions]}
              value={draft.itemId}
              onChange={(itemId) => setDraft((current) => ({ ...current, itemId }))}
            />
          </div>
        </div>
      </section>
      {/* 목록과 고른 LOT(전이 준비)을 처음부터 나란히(상하 배치면 위아래로) 둔다 — LOT 상태 이력과 같다. */}
      <div
        ref={splitRef}
        className={`po-board-split inspection-split lot-status-split${layout.orientation === 'column' ? ' is-stacked' : ''}`}
        style={{ ...split.style, ...layout.style }}
      >
        {/* 결과 카드 — 총 건수는 표 아래 쪽 이동 줄에만 둔다(LOT 현황과 같다). */}
        {/* 「전이 대상 LOT」 제목은 두지 않는다(사용자 2026-11-02) — 구역 이름은 화면 읽기용으로만. */}
        <section className="pane lot-status-pane lot-status-transition-pane" aria-label={t.pane}>
          {candidates.isError ? (
            <AlertBanner
              variant="error"
              title={t.failed}
              action={<Button onClick={() => void candidates.refetch()}>{t.retry}</Button>}
            />
          ) : candidates.isPending ? (
            <div role="status" aria-label={t.loading}>
              <SkeletonText lines={3} />
            </div>
          ) : (
            <>
              {/* 줄 아무 곳이나 눌러도 고른다 — LOT 번호 단추는 키보드로 고르는 자리로 남는다. */}
              <div
                ref={fit.ref}
                className="wide-table lot-status-table lot-status-transition-table inspection-queue-table"
                style={resizable.style}
                aria-busy={candidates.isFetching}
                onClick={(event) => {
                  const target = event.target as Element;
                  if (target.closest('button') !== null) return;
                  const row = target.closest('tbody tr');
                  if (row === null || row.parentElement === null) return;
                  const picked =
                    candidates.data.items[Array.from(row.parentElement.children).indexOf(row)];
                  if (picked !== undefined) toggleRow(picked);
                }}
              >
                <Table
                  density="compact"
                  caption={t.pane}
                  columns={fit.columns}
                  rows={candidates.data.items}
                  getRowId={rowKey}
                  sort={null}
                  empty={
                    <EmptyState
                      size="sm"
                      live
                      icon={<PaneEmptyIcon name="assignment" />}
                      title={t.empty}
                      description={t.emptyHint}
                    />
                  }
                />
              </div>
              {meta !== undefined && (
                <PageNav
                  sizes={LOT_PAGE_SIZES}
                  meta={{ page: currentPage, size: shownPageSize, total: meta.total }}
                  onChangePage={changePage}
                  onChangeSize={changePageSize}
                  controlSize="sm"
                  buttonSize="md"
                  disabled={confirmationPinned}
                />
              )}
            </>
          )}
        </section>
        <PaneSplitter
          label={messages.common.inspectionHub.splitter}
          ratio={split.ratio}
          onChange={split.commit}
        />
        {layout.orientation === 'column' && (
          <PaneHeightSplitter
            label={messages.common.inspectionHub.heightSplitter}
            height={layout.listHeight}
            onChange={layout.changeListHeight}
          />
        )}
        <div className="lot-status-transition-detail">
          {selected === null ? (
            <section
              className="pane lot-status-pane lot-status-transition-pane"
              aria-label={tSelected.title}
            >
              <EmptyState
                size="sm"
                icon={<PaneEmptyIcon name="layers" />}
                title={tHistory.detail.pick}
                description={tHistory.detail.pickHint}
              />
            </section>
          ) : (
            /*
             * 고른 LOT 과 상태 변경을 한 카드에 — LOT 상자, 그 아래(상하 배치면 옆) 현재 상태 · 변경할 상태
             * (사용자 시안 2026-11-02).
             */
            <section className="pane lot-status-transition-pane" aria-label={tSelected.pane}>
              <div className="lot-status-transition-card-head">
                <h2 className="pane-title">{tSelected.title}</h2>
              </div>
              {/*
               * 고른 LOT 상자 — 위에 LOT 번호와 상태 칩, 구분선 아래 품목(코드 · 이름 두 줄) · 최근 변경 · 변경 사유
               * 세 칸(사용자 시안 2026-11-02).
               */}
              {/* 상하 배치(넓은 카드)면 LOT 상자 옆에 변경할 상태, 좌우 배치면 위아래(사용자 2026-11-02). */}
              <div
                className={`lot-status-transition-body${layout.orientation === 'column' ? ' is-wide' : ''}`}
              >
                <div
                  className="lot-status-transition-lot-box"
                  role="group"
                  aria-label={tSelected.identity}
                >
                  <div className="lot-status-transition-lot-head">
                    <div className="lot-status-transition-lot-id">
                      <span className="field-label">{tSelected.lotNo}</span>
                      {/* LOT 유형 라벨 — 번호 왼쪽(목록 · LOT 현황과 같다 · 사용자 2026-11-02). */}
                      <span className="lot-no-with-type">
                        {selected.lotTypeCode !== undefined && (
                          <Chip variant="status" status="info" size="sm">
                            {lotTypeLabel(selected.lotTypeCode)}
                          </Chip>
                        )}
                        <strong className="lot-status-transition-lot-no">{selected.lotNo}</strong>
                      </span>
                    </div>
                    {currentStatusChip}
                  </div>
                  <dl className="lot-status-transition-lot-facts">
                    {(
                      [
                        [
                          tSelected.item,
                          /* 「코드 · 이름」을 두 줄로 — 코드 아래 이름. */
                          itemLabel(selected.itemId)
                            .split(' · ')
                            .map((part, index, parts) =>
                              index === 0 ? (
                                <span key="code">{part}</span>
                              ) : index === 1 ? (
                                <span key="name" className="lot-status-transition-item-name">
                                  {parts.slice(1).join(' · ')}
                                </span>
                              ) : null,
                            ),
                        ],
                        [tSelected.latestTransition, formatDateTime(selected.latestTransitionAt)],
                        [
                          tSelected.latestReason,
                          selected.latestReasonCode === null ||
                          selected.latestReasonCode === undefined
                            ? emptyValue
                            : reasonLabel(selected.latestReasonCode),
                        ],
                      ] as const
                    ).map(([label, value]) => (
                      <div className="field-cell" key={label}>
                        <dt className="field-label">{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                {(confirmationPinned || !candidates.isFetching) && (
                  <LotStatusTransitionPreparation
                    key={rowKey(selected)}
                    lot={selected}
                    onConfirmationChange={onConfirmationChange}
                  />
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
