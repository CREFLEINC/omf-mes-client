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
import { useCallback, useEffect, useId, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
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

type LotStatusCandidateQuery = NonNullable<
  NonNullable<paths['/quality/lot-statuses']['get']>['parameters']['query']
>;
export type LotStatusCandidate = components['schemas']['LotQualityStatus'];

const t = messages.lotStatusTransition.candidate;
const tSelected = messages.lotStatusTransition.selected;

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
  const periodId = useId();
  const periodError = validateTransitionPeriod(draft);
  const periodErrorMessage =
    periodError === 'missing'
      ? t.filters.periodMissing
      : periodError === 'invalid'
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
  const reset = (): void => {
    if (confirmationPinned) return;
    const next = defaultLotStatusCandidateFilters(new Date());
    setDraft(next);
    setFilters(next);
    changePage(1);
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
            onClick={() => {
              if (!confirmationPinned) setSelectedKey(rowKey(row));
            }}
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
      {/* 조회 조건 카드 — LOT 현황처럼 조건만 따로 둔다. */}
      <section
        className="pane lot-status-search"
        aria-label={messages.lotStatusHistory.lotFilter.pane}
      >
        <div className="filter-bar lot-status-filter lot-status-transition-filter">
          <div className="field-cell lot-status-transition-period">
            {/*
             * 기간의 기준(최근 전이일)은 라벨 옆 같은 줄의 흐린 보조 글자로 둔다(사용자 지시 2026-09-19 —
             * 칩 형식을 없앤다). 표시 전용이다.
             */}
            <div className="lot-status-transition-period-label">
              <label className="field-label" htmlFor={periodId}>
                {t.filters.period}
              </label>
              <span className="lot-status-transition-period-hint">{t.filters.note}</span>
            </div>
            <DatePicker
              className="lot-status-transition-period-input"
              id={periodId}
              mode="range"
              disabled={confirmationPinned}
              value={[draft.from === '' ? null : draft.from, draft.to === '' ? null : draft.to]}
              onChange={([from, to]) => setDraft((current) => ({ ...current, from, to }))}
            />
            {/* 기간 오류는 칸 바로 아래 — 도움말이 라벨 옆으로 옮겨도 오류 자리는 그대로다. */}
            {periodErrorMessage !== null && (
              <span className="field-error" role="alert">
                {periodErrorMessage}
              </span>
            )}
          </div>
          <SearchInput
            disabled={confirmationPinned}
            containerClassName="lot-status-filter-lot-no"
            label={messages.lotStatusHistory.lotFilter.lotScanLabel}
            placeholder={messages.lotStatusHistory.lotFilter.lotNoScanPlaceholder}
            value={draft.q}
            onChange={(event) => setDraft((current) => ({ ...current, q: event.target.value }))}
            onSearch={apply}
            clearLabel={messages.common.clear}
          />
          <FilterSelect
            cellClassName="wide-select lot-status-transition-item-filter"
            disabled={confirmationPinned}
            label={t.filters.item}
            options={[{ value: '', label: t.filters.all }, ...itemOptions]}
            value={draft.itemId}
            onChange={(itemId) => setDraft((current) => ({ ...current, itemId }))}
          />
          <FilterSelect
            cellClassName="lot-status-transition-status-filter"
            disabled={confirmationPinned}
            label={t.filters.status}
            options={[{ value: '', label: t.filters.all }, ...statusOptions]}
            value={draft.lotStatusCode}
            onChange={(lotStatusCode) => setDraft((current) => ({ ...current, lotStatusCode }))}
          />
          {/* [조회](주 동작) → [초기화] — LOT 현황과 같은 순서, 줄의 오른쪽 끝. */}
          <div className="filter-actions field-cell-unlabeled lot-status-filter-actions">
            <Button
              variant="filled"
              disabled={confirmationPinned || periodError !== null}
              onClick={apply}
            >
              {t.filters.search}
            </Button>
            <Button variant="outlined" disabled={confirmationPinned} onClick={reset}>
              {t.filters.reset}
            </Button>
          </div>
        </div>
      </section>
      {/* 결과 카드 — 총 건수는 표 아래 쪽 이동 줄에만 둔다(LOT 현황과 같다). */}
      <section
        className="pane lot-status-pane lot-status-transition-pane"
        aria-labelledby="lot-status-transition-candidates-title"
      >
        <h2 className="pane-title" id="lot-status-transition-candidates-title">
          {t.pane}
        </h2>
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
            <div
              ref={fit.ref}
              className="wide-table lot-status-table lot-status-transition-table inspection-queue-table"
              style={resizable.style}
              aria-busy={candidates.isFetching}
            >
              <Table
                density="compact"
                caption={t.pane}
                columns={fit.columns}
                rows={candidates.data.items}
                getRowId={rowKey}
                sort={null}
                empty={<EmptyState size="sm" live title={t.empty} />}
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
      {selected !== null && (
        <div className="lot-status-transition-detail-grid">
          <section className="pane lot-status-transition-pane" aria-label={tSelected.pane}>
            <h2 className="pane-title">{tSelected.title}</h2>
            <dl className="lot-status-transition-identity" aria-label={tSelected.identity}>
              {[
                [tSelected.lotNo, selected.lotNo],
                [tSelected.item, itemLabel(selected.itemId)],
              ].map(([label, value]) => (
                <div className="field-cell" key={label}>
                  <dt className="field-label">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <h3 className="lot-status-transition-subtitle">{tSelected.currentTitle}</h3>
            {/*
             * 현재 상태만 색 칩으로 강조하고(LOT 이력 화면과 같은 색) 수량·최근 변경은 정돈된 글자로 둔다
             * (사용자 지시). 최근 사유는 공통코드 이름이다 — 코드가 글자 중간에서 접히지 않는다.
             */}
            <dl className="lot-status-transition-status-grid" aria-label={tSelected.current}>
              {(
                [
                  [
                    'status',
                    tSelected.status,
                    <Chip variant="status" status={lotStatusTone(selected.lotStatusCode)}>
                      {statusLabel(selected.lotStatusCode)}
                    </Chip>,
                  ],
                  ['onHand', tSelected.onHand, quantity(selected.onHandQty)],
                  ['held', tSelected.held, quantity(selected.heldQty)],
                  ['available', tSelected.available, quantity(selected.availableQty)],
                  [
                    'latestTransition',
                    tSelected.latestTransition,
                    formatDateTime(selected.latestTransitionAt),
                  ],
                  [
                    'latestReason',
                    tSelected.latestReason,
                    selected.latestReasonCode === null || selected.latestReasonCode === undefined
                      ? emptyValue
                      : reasonLabel(selected.latestReasonCode),
                  ],
                ] as const
              ).map(([key, label, value]) => (
                <div className={`field-cell lot-status-transition-current-${key}`} key={key}>
                  <dt className="field-label">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          {(confirmationPinned || !candidates.isFetching) && (
            <LotStatusTransitionPreparation
              key={rowKey(selected)}
              lot={selected}
              onConfirmationChange={onConfirmationChange}
            />
          )}
        </div>
      )}
    </div>
  );
};
