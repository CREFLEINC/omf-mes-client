import {
  AlertBanner,
  Button,
  Checkbox,
  Chip,
  type Column,
  DatePicker,
  EmptyState,
  SearchInput,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { HubActions, useHubActionsTarget } from '../../patterns/hub-actions';
import { PaneSplitter, useFitToViewport, usePaneSplit } from '../../patterns/po-board';
import {
  PaneHeightSplitter,
  SplitOrientationToggle,
  useSplitOrientation,
} from '../../patterns/split-orientation';
import { runRequest } from '../../patterns/request';
import { Select } from '../../patterns/select';
import { lookupDisplayLabelWithInactive } from '../../patterns/lookup-display';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnWidths } from '../../patterns/column-resize';
import { PageNav } from '../../patterns/page-nav';
import {
  DEFAULT_LOT_PAGE_SIZE,
  LOT_PAGE_SIZES,
  type LotPageSize,
} from '../lot-status-history/filters';
import {
  useItemNameSources,
  useItemReferenceOptions,
  useLocationNameSources,
  useWarehouseReferenceOptions,
  type ReferenceOptionsResult,
} from '../lot-status-history/reference-options';
import {
  lotStatusTone,
  useLotStatusOptions,
  useLotTypeOptions,
} from '../lot-status-history/options';
import { StatusChips } from '../lot-status-history/screen';
import { useUomCodeOf, withUom } from '../lot-status-history/uoms';
import { useWorkOrderCloseUomLookup } from '../work-order-close/candidate-references';
import {
  EMPTY_SUSPICIOUS_MATERIAL_FILTERS,
  reconcileSuspiciousMaterialSelection,
  toSelectedLotSnapshot,
  toSuspiciousMaterialQuery,
  validateSuspiciousMaterialPeriod,
  type SelectedLotSnapshot,
  type SuspiciousMaterialFilters,
} from './candidate-model';
import { formatPlantDateTime } from '../../patterns/plant-time';

type Lot = components['schemas']['LotQualityStatus'];
const t = messages.suspiciousMaterialHold.candidate;
const tHistory = messages.lotStatusHistory;

/* 좌우 · 상하 배치와 가운데 막대 비율은 다른 LOT 상태 탭과 따로 기억한다. */
const SPLIT_KEY = 'omf-mes:suspicious-material-hold:split';
const SPLIT_ORIENTATION_KEY = 'omf-mes:suspicious-material-hold:split-orientation';

interface Props {
  isLocked: boolean;
  selection: SelectedLotSnapshot[];
  onSelectionChange: (selection: SelectedLotSnapshot[]) => void;
  onAvailabilityChange?: (ready: boolean) => void;
  /** 목록 옆(상하 배치면 아래) 칸 — 보류 입력 · 실행 · 자재 불량 기록(LOT 상태 변경 탭과 같은 두 칸 · 사용자 2026-11-02). */
  detail: ReactNode;
}

/*
 * 목록이 한 쪽에서 잘렸어도 찾은 이름은 보인다 — 잘림은 「없음」을 단정할 수 없을 뿐이다. 예전에는 잘리면
 * 이름을 아예 내지 않아 줄마다 「이름 미확인」이 섰다.
 */
const referenceLabel = (
  query: { data?: ReferenceOptionsResult; isPending: boolean; isError: boolean } | undefined,
  id: number | undefined,
  fallback: string,
): string => {
  if (id === undefined || query === undefined || query.isPending || query.isError) return fallback;
  return query.data?.entries.find((entry) => entry.value === String(id))?.label ?? fallback;
};

const EMPTY = '—';
const SELECT_COLUMN_WIDTH = 56;
const quantity = (value: number): string => new Intl.NumberFormat('ko-KR').format(value);

/** 칸 안 한 줄 — 넘치면 말줄임하고 전체 값은 title 로(LOT 현황과 같다). */
const OneLine = ({ text }: { text: string }) => (
  <span className="lot-status-one-line" title={text}>
    {text}
  </span>
);

const sameSelection = (left: SelectedLotSnapshot[], right: SelectedLotSnapshot[]): boolean =>
  JSON.stringify(left) === JSON.stringify(right);
const formatDateTime = (value: string | undefined): string => {
  if (value === undefined) return t.values.transitionNone;
  return formatPlantDateTime(value) ?? value;
};

export const SuspiciousMaterialCandidatePane = ({
  isLocked,
  selection,
  onSelectionChange,
  onAvailabilityChange,
  detail,
}: Props) => {
  const { client } = useApiClient();
  const [draft, setDraft] = useState(EMPTY_SUSPICIOUS_MATERIAL_FILTERS);
  const [filters, setFilters] = useState(EMPTY_SUSPICIOUS_MATERIAL_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<LotPageSize>(DEFAULT_LOT_PAGE_SIZE);
  const candidates = useQuery({
    queryKey: ['suspicious-material-hold', 'candidates', filters, page, pageSize],
    placeholderData: keepPreviousData,
    enabled: !isLocked,
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/lot-statuses', {
          params: { query: toSuspiciousMaterialQuery(filters, page, pageSize) },
        }),
      ),
  });
  /*
   * 상태 칩 건수 — 목록과 같은 조건(LOT 번호 · 품목 · 창고)에서 상태만 뺀 요약 한 번이다. 칩을 눌러도 키가 같아 다시
   * 부르지 않는다(LOT 상태 변경 탭과 같다).
   */
  const countQuery = toSuspiciousMaterialQuery({ ...filters, lotStatusCode: '' }, 1);
  const statusCounts = useQuery({
    queryKey: ['suspicious-material-hold', 'status-counts', countQuery],
    placeholderData: keepPreviousData,
    enabled: !isLocked,
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/lot-status-summary', { params: { query: countQuery } }),
      ),
  });
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
  const split = usePaneSplit(SPLIT_KEY, 0.6);
  const layout = useSplitOrientation(SPLIT_ORIENTATION_KEY);
  const detailId = useId();
  const periodFromId = useId();
  const periodToId = useId();
  const periodReasonId = useId();
  /* 기간 — 둘 다 비우면 기간 없이 조회한다. 한쪽만 채웠으면 [조회]만 잠그고, 틀린 날짜 · 뒤바뀐 순서는 알린다. */
  const periodError = validateSuspiciousMaterialPeriod(draft);
  const periodReason =
    periodError === 'invalid'
      ? messages.lotStatusTransition.candidate.filters.periodInvalid
      : periodError === 'reversed'
        ? messages.lotStatusTransition.candidate.filters.periodReversed
        : null;
  /* 품목 · 창고는 상세 조건으로 접어 둔다 — 걸린 조건이 있으면 펼친 채로 들어온다(LOT 상태 이력 · 변경과 같다). */
  const [isDetailOpen, setIsDetailOpen] = useState(
    filters.itemId !== '' || filters.warehouseId !== '',
  );
  const items = useItemReferenceOptions();
  const warehouses = useWarehouseReferenceOptions();
  const rows = candidates.data?.items ?? [];
  /* 이름은 보이는 행으로 푼다 — 품목은 상세로, 위치는 행의 창고마다(품목 목록은 첫 쪽만 받아 거의 다 「미확인」이었다). */
  const itemNames = useItemNameSources(rows.map((row) => row.itemId));
  const locationsByWarehouse = useLocationNameSources(
    rows.flatMap((row) => (row.warehouseId === undefined ? [] : [row.warehouseId])),
  );
  const locationsOf = (warehouseId: number | undefined) =>
    warehouseId === undefined ? undefined : locationsByWarehouse.get(warehouseId);
  const statuses = useLotStatusOptions();
  const lotTypes = useLotTypeOptions();
  const uoms = useWorkOrderCloseUomLookup();
  const uomCodeOf = useUomCodeOf();
  const ready = candidates.data !== undefined && !candidates.isFetching && !candidates.isError;

  useEffect(() => onAvailabilityChange?.(ready), [onAvailabilityChange, ready]);

  useEffect(() => {
    if (candidates.isError) {
      if (selection.length > 0) onSelectionChange([]);
      return;
    }
    if (!ready || candidates.data === undefined) return;
    const next = reconcileSuspiciousMaterialSelection(selection, {
      kind: 'SUCCESS',
      items: candidates.data.items,
    }).map((value) => {
      const previous = selection.find(({ lotId }) => lotId === value.lotId);
      return {
        ...value,
        locationLabel:
          previous !== undefined &&
          previous.warehouseId === value.warehouseId &&
          previous.locationId === value.locationId
            ? previous.locationLabel
            : null,
        uomLabel:
          previous !== undefined && previous.uomId === value.uomId ? previous.uomLabel : null,
      };
    });
    if (!sameSelection(selection, next)) onSelectionChange(next);
  }, [candidates.data, candidates.isError, onSelectionChange, ready, selection]);

  const move = (
    nextFilters: SuspiciousMaterialFilters,
    nextPage: number,
    nextSize: LotPageSize = pageSize,
  ): void => {
    if (isLocked) return;
    onSelectionChange([]);
    setPage(nextPage);
    setPageSize(nextSize);
    setFilters(nextFilters);
  };
  const apply = (): void => {
    if (periodError !== null) return;
    move({ ...draft }, 1);
  };
  const changeStatus = (lotStatusCode: string): void => {
    if (isLocked) return;
    setDraft((current) => ({ ...current, lotStatusCode }));
    move({ ...filters, lotStatusCode }, 1);
  };
  const reset = (): void => {
    if (isLocked) return;
    setDraft(EMPTY_SUSPICIOUS_MATERIAL_FILTERS);
    move(EMPTY_SUSPICIOUS_MATERIAL_FILTERS, 1);
  };
  /* 고른 LOT 한 건의 스냅숏 — 위치 · 단위 이름은 고를 때의 표시 값을 함께 남긴다. 고를 수 없는 LOT 이면 null. */
  const toSnapshot = (row: Lot): SelectedLotSnapshot | null => {
    const snapshot = toSelectedLotSnapshot(row);
    if (snapshot === null) return null;
    const warehouse = referenceLabel(warehouses, row.warehouseId, '');
    const location = referenceLabel(locationsOf(row.warehouseId), row.locationId, '');
    const unit =
      row.uomId === undefined || uoms.isLoading || uoms.isError || uoms.truncated
        ? ''
        : (uoms.entries.find(({ uomId }) => uomId === row.uomId)?.label ?? '');
    return {
      ...snapshot,
      locationLabel: warehouse === '' || location === '' ? null : `${warehouse} / ${location}`,
      uomLabel: unit === '' ? null : unit,
    };
  };
  const toggle = (row: Lot): void => {
    if (isLocked) return;
    if (selection.some((value) => value.lotId === row.lotId))
      onSelectionChange(selection.filter((value) => value.lotId !== row.lotId));
    else {
      const snapshot = toSnapshot(row);
      if (snapshot !== null) onSelectionChange([...selection, snapshot]);
    }
  };
  /* 전체 선택 — 이 쪽에서 고를 수 있는 LOT 만 고르고 푼다(사용자 2026-11-02). */
  const selectableRows = rows.filter((row) => toSelectedLotSnapshot(row) !== null);
  const pickedOnPage = selectableRows.filter((row) =>
    selection.some((value) => value.lotId === row.lotId),
  ).length;
  const allPicked = selectableRows.length > 0 && pickedOnPage === selectableRows.length;
  const toggleAll = (): void => {
    if (isLocked) return;
    if (allPicked) {
      const pageIds = new Set(selectableRows.map((row) => row.lotId));
      onSelectionChange(selection.filter((value) => !pageIds.has(value.lotId)));
      return;
    }
    const added = selectableRows
      .filter((row) => !selection.some((value) => value.lotId === row.lotId))
      .flatMap((row) => {
        const snapshot = toSnapshot(row);
        return snapshot === null ? [] : [snapshot];
      });
    onSelectionChange([...selection, ...added]);
  };
  const statusLabel = (code: string): string =>
    statuses.data?.isTruncated === false
      ? (statuses.data.items.find((item) => item.code === code)?.label ?? t.values.statusUnknown)
      : t.values.statusUnknown;
  const itemLabel = (itemId: number): string =>
    lookupDisplayLabelWithInactive(
      itemNames.get(itemId) ?? { entries: [], isError: false, isLoading: true },
      itemId,
    );
  const lotTypeLabel = (code: string): string =>
    lotTypes.data?.items.find((item) => item.code === code)?.label ??
    messages.lotStatusHistory.values.unlisted(code);
  /* 재고가 없는 LOT 은 창고 · 수량이 비어 온다 — 「미확인」이 아니라 빈 값(—)이다(LOT 현황과 같다). */
  const locationLabel = (row: Lot): string => {
    if (row.warehouseId === undefined) return EMPTY;
    const warehouse = referenceLabel(warehouses, row.warehouseId, t.values.warehouseUnknown);
    if (row.locationId === undefined) return warehouse;
    return `${warehouse} / ${referenceLabel(locationsOf(row.warehouseId), row.locationId, t.values.locationUnknown)}`;
  };
  const selectColumn: Column<Lot> = {
    key: 'select',
    header: (
      <Checkbox
        aria-label={t.actions.selectAll}
        checked={allPicked}
        indeterminate={pickedOnPage > 0 && !allPicked}
        disabled={isLocked || !ready || selectableRows.length === 0}
        onChange={toggleAll}
      />
    ),
    align: 'center',
    width: `${String(SELECT_COLUMN_WIDTH)}px`,
    render: (row) => (
      <Checkbox
        aria-label={t.actions.select(row.lotNo)}
        checked={selection.some((value) => value.lotId === row.lotId)}
        disabled={isLocked || !ready || toSelectedLotSnapshot(row) === null}
        onChange={() => toggle(row)}
      />
    ),
  };
  /*
   * 표는 LOT 현황 목록과 같은 짜임이다 — 모든 열 가운데 정렬, 폭은 px 로 두고 끌어 바꾼 폭 · 순서는 브라우저에 남는다.
   * 선택 칸은 늘 맨 앞이라 순서 · 폭 바꾸기에서 뺀다.
   */
  const columns: Column<Lot>[] = [
    {
      key: 'lot',
      header: t.fields.lotNo,
      align: 'center',
      width: '260px',
      render: (row) => {
        const text = row.fullyHeld ? t.values.fullyHeld(row.lotNo) : row.lotNo;

        return (
          <span className="lot-no-with-type">
            {row.lotTypeCode !== undefined && (
              <Chip variant="status" status="info" size="sm">
                {lotTypeLabel(row.lotTypeCode)}
              </Chip>
            )}
            <OneLine text={text} />
          </span>
        );
      },
    },
    {
      key: 'item',
      header: t.fields.item,
      align: 'center',
      width: '280px',
      render: (row) => <OneLine text={itemLabel(row.itemId)} />,
    },
    {
      key: 'location',
      header: t.fields.location,
      align: 'center',
      width: '280px',
      render: (row) => <OneLine text={locationLabel(row)} />,
    },
    {
      key: 'quantity',
      header: t.fields.quantity,
      align: 'center',
      width: '120px',
      render: (row) => (
        <OneLine
          text={
            row.onHandQty === undefined
              ? EMPTY
              : withUom(quantity(row.onHandQty), uomCodeOf(row.uomId ?? null))
          }
        />
      ),
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
      key: 'latestTransition',
      header: t.fields.latestTransition,
      align: 'center',
      width: '160px',
      render: (row) =>
        row.latestTransitionAt === undefined ? (
          <OneLine text={t.values.transitionNone} />
        ) : (
          <time dateTime={row.latestTransitionAt}>{formatDateTime(row.latestTransitionAt)}</time>
        ),
    },
  ];
  const ordered = useColumnOrder('omf-mes:lot-status:columns:suspicious:order', columns);
  const resizable = useColumnWidths('omf-mes:lot-status:columns:suspicious', ordered, {
    fitContent: true,
  });
  const fit = useFitColumns(resizable.columns, { scrollX: true, reserve: SELECT_COLUMN_WIDTH });
  const options = (data: ReferenceOptionsResult | undefined) =>
    data?.entries.map(({ value, label }) => ({ value, label })) ?? [];
  const statusOptions =
    statuses.data?.items.map((item) => ({ value: item.code, label: item.label })) ?? [];
  const filterSelects = [
    [t.fields.itemSearch, 'itemId', options(items.data)],
    [t.fields.warehouseSearch, 'warehouseId', options(warehouses.data)],
  ] as const;
  const statusChips = (
    <StatusChips
      options={statusOptions}
      counts={chipCounts}
      value={filters.lotStatusCode}
      disabled={isLocked}
      onChange={changeStatus}
    />
  );
  const meta = candidates.data?.page;
  const currentPage = meta !== undefined && meta.page > 0 ? meta.page : page;
  /* 고를 수 없는 크기(10 · 20 · 50 밖)를 서버가 돌려주면 크기 칸이 비므로 고른 크기를 보인다. */
  const shownPageSize: LotPageSize = LOT_PAGE_SIZES.find((size) => size === meta?.size) ?? pageSize;

  return (
    <div className="suspicious-material-hold-flow">
      {/* 상태 칩은 탭 막대 오른쪽, 좌우 · 상하 배치 단추 왼쪽이다. 탭 막대가 없으면(묶음 밖) 조회 카드 위쪽 줄에 둔다. */}
      {hubTarget !== null && <HubActions target={hubTarget}>{statusChips}</HubActions>}
      <SplitOrientationToggle orientation={layout.orientation} onChange={layout.change} />
      {/* 조회 조건 카드 — LOT 상태 이력 · 변경과 같은 짜임(LOT 스캔 · 조회 · 초기화 · 상세 검색). */}
      <section
        ref={aboveRef}
        className="pane lot-status-search"
        aria-label={tHistory.lotFilter.pane}
      >
        {hubTarget === null && <div className="lot-status-search-head">{statusChips}</div>}
        <div className="filter-bar lot-status-filter lot-status-transition-filter">
          {/*
           * 최종 변경 시작일 · 종료일 — 칸마다 제 이름을 위에 두고, 칸 안 흐린 글자는 두지 않는다(사용자 2026-11-02).
           * 막힌 까닭은 종료일 칸 아래 한 줄.
           */}
          <div className="field-cell">
            <label className="field-label" htmlFor={periodFromId}>
              {t.fields.periodFrom}
            </label>
            <DatePicker
              id={periodFromId}
              className="lot-status-date-field suspicious-material-hold-date-field"
              placeholder={t.fields.periodFromPlaceholder}
              disabled={isLocked}
              invalid={draft.from === '' && draft.to !== ''}
              value={draft.from === '' ? null : draft.from}
              onChange={(from) => setDraft((current) => ({ ...current, from }))}
            />
          </div>
          <div className="field-cell">
            <label className="field-label" htmlFor={periodToId}>
              {t.fields.periodTo}
            </label>
            <DatePicker
              id={periodToId}
              className="lot-status-date-field suspicious-material-hold-date-field"
              placeholder={t.fields.periodToPlaceholder}
              disabled={isLocked}
              invalid={(draft.to === '' && draft.from !== '') || periodReason !== null}
              value={draft.to === '' ? null : draft.to}
              onChange={(to) => setDraft((current) => ({ ...current, to }))}
              aria-describedby={periodReason === null ? undefined : periodReasonId}
            />
            {periodReason !== null && (
              <span id={periodReasonId} className="field-error" role="alert">
                {periodReason}
              </span>
            )}
          </div>
          <SearchInput
            containerClassName="lot-status-filter-lot-no"
            label={t.fields.lotScan}
            placeholder={tHistory.lotFilter.lotNoScanPlaceholder}
            value={draft.q}
            disabled={isLocked}
            onChange={(event) => setDraft((value) => ({ ...value, q: event.target.value }))}
            onSearch={apply}
            clearLabel={messages.common.clear}
          />
          {/* [조회](주 동작) → [초기화] → 상세 검색 펼치기 — 다른 LOT 상태 탭과 같은 순서, 줄의 오른쪽 끝. */}
          <div className="filter-actions field-cell-unlabeled lot-status-filter-actions">
            <Button
              variant="filled"
              disabled={isLocked || periodError !== null}
              aria-describedby={periodReason === null ? undefined : periodReasonId}
              onClick={apply}
            >
              {t.actions.search}
            </Button>
            <Button variant="outlined" disabled={isLocked} onClick={reset}>
              {t.actions.reset}
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
            {filterSelects.map(([label, key, entries]) => (
              <div className="field-cell wide-select lot-status-transition-item-filter" key={key}>
                <label className="field-label" htmlFor={`suspicious-material-hold-${key}`}>
                  {label}
                </label>
                <Select
                  id={`suspicious-material-hold-${key}`}
                  value={draft[key]}
                  options={[{ value: '', label: t.values.all }, ...entries]}
                  disabled={isLocked}
                  onChange={(value) => setDraft((current) => ({ ...current, [key]: value }))}
                />
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* 목록과 보류 입력을 처음부터 나란히(상하 배치면 위아래로) 둔다 — LOT 상태 변경과 같다. */}
      <div
        ref={splitRef}
        className={`po-board-split inspection-split lot-status-split${layout.orientation === 'column' ? ' is-stacked' : ''}`}
        style={{ ...split.style, ...layout.style }}
      >
        {/*
         * 결과 카드 — 「의심자재 후보」 제목은 두지 않는다(다른 LOT 상태 탭과 같다 · 사용자 2026-11-02). 고른 건수는 오른쪽
         * 「의심자재 보류 등록」 제목 옆에, 총 건수는 표 아래 쪽 이동 줄에.
         */}
        <section className="pane lot-status-pane suspicious-material-hold-pane" aria-label={t.pane}>
          {candidates.isError ? (
            <AlertBanner
              variant="error"
              title={t.failed}
              action={<Button onClick={() => void candidates.refetch()}>{t.actions.retry}</Button>}
            />
          ) : candidates.isPending ? (
            <div role="status" aria-label={t.loading}>
              <SkeletonText lines={3} />
            </div>
          ) : (
            <>
              <div
                ref={fit.ref}
                className="wide-table lot-status-table suspicious-material-hold-table inspection-queue-table"
                style={resizable.style}
                aria-busy={candidates.isFetching}
                /*
                 * 줄 아무 곳이나 눌러도 그 LOT 을 고르고 푼다(사용자 2026-11-02) — 선택 칸은 키보드로 고르는 자리로 남는다.
                 * 고를 수 없는 LOT · 잠금 · 다시 받는 중에는 선택 칸처럼 아무 일도 하지 않는다.
                 */
                onClick={(event) => {
                  const target = event.target as Element;
                  if (target.closest('button, input, label, a') !== null) return;
                  const row = target.closest('tbody tr');
                  if (row === null || row.parentElement === null) return;
                  const picked =
                    candidates.data.items[Array.from(row.parentElement.children).indexOf(row)];
                  if (picked !== undefined && ready && toSelectedLotSnapshot(picked) !== null)
                    toggle(picked);
                }}
              >
                <Table
                  density="compact"
                  caption={t.pane}
                  columns={[selectColumn, ...fit.columns]}
                  rows={candidates.data.items}
                  getRowId={(row) => String(row.lotId)}
                  sort={null}
                  empty={<EmptyState size="sm" live title={t.empty} />}
                />
              </div>
              {meta !== undefined && (
                <PageNav
                  sizes={LOT_PAGE_SIZES}
                  meta={{ page: currentPage, size: shownPageSize, total: meta.total }}
                  onChangePage={(next) => move(filters, next)}
                  onChangeSize={(size) => move(filters, 1, size)}
                  controlSize="sm"
                  buttonSize="md"
                  disabled={isLocked}
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
        <div className="suspicious-material-hold-detail">{detail}</div>
      </div>
    </div>
  );
};
