import {
  AlertBanner,
  Button,
  Chip,
  type Column,
  DatePicker,
  EmptyState,
  SearchInput,
  Select,
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
import { useLotStatusOptions } from '../lot-status-history/options';
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
): LotStatusCandidateQuery => {
  const query: LotStatusCandidateQuery = {};
  const itemId = positiveId(filters.itemId);
  if (filters.q !== '') query.q = filters.q;
  if (itemId !== undefined) query.itemId = itemId;
  if (filters.lotStatusCode !== '') query.lotStatusCode = filters.lotStatusCode;
  if (validateTransitionPeriod(filters) === null)
    Object.assign(query, toTransitionPeriodBounds(filters, offsetMinutes));
  if (Number.isSafeInteger(page) && page > 1) query.page = page;
  return query;
};

export const lotStatusTransitionKeys = {
  candidates: (filters: LotStatusCandidateFilters, page: number, offsetMinutes: number) =>
    ['lot-status-transition', 'candidates', { ...filters }, page, offsetMinutes] as const,
};

const ROOT_KEY = ['lot-status-transition'] as const;

const useCandidates = (
  filters: LotStatusCandidateFilters,
  page: number,
  offsetMinutes: number,
  enabled: boolean,
) => {
  const { client } = useApiClient();
  const query = toLotStatusCandidateQuery(filters, page, offsetMinutes);
  return useQuery({
    queryKey: lotStatusTransitionKeys.candidates(filters, page, offsetMinutes),
    enabled,
    placeholderData: keepPreviousData,
    queryFn: () => runRequest(() => client.GET('/quality/lot-statuses', { params: { query } })),
  });
};

/*
 * 표의 수량 옆 단위 코드 — 표시용 조회다(`500 EA`). 단위는 수가 적지만 기본 쪽 크기에 잘리지
 * 않게 쪽 크기를 준다. 조회·선택·전이와 캐시 키를 섞지 않는다 — 전이 뒤 무효화가 이것까지
 * 다시 부르지 않게 한다.
 */
const UOM_PAGE_SIZE = 200;

const useUomCodes = (): ReadonlyMap<number, string> => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: ['lot-status-transition:uoms'],
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/uoms', {
          params: { query: { includeInactive: true, size: UOM_PAGE_SIZE } },
        }),
      ),
  });

  return new Map((query.data?.items ?? []).map((uom) => [uom.uomId, uom.uomCode]));
};

const rowKey = (row: LotStatusCandidate): string =>
  `${row.lotId}:${row.warehouseId ?? '-'}:${row.locationId ?? '-'}`;
const emptyValue = '—';
const quantity = (value: number | undefined): string =>
  value === undefined ? emptyValue : new Intl.NumberFormat('ko-KR').format(value);
const formatDateTime = (value: string | undefined): string => {
  if (value === undefined) return emptyValue;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match === null ? value : `${match[1]} ${match[2]}`;
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
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [confirmationPinned, setConfirmationPinned] = useState(false);
  const offsetMinutes = -new Date().getTimezoneOffset();
  const candidates = useCandidates(filters, page, offsetMinutes, !confirmationPinned);
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
  const uomCodes = useUomCodes();
  /* 단위를 못 풀면 수량만 낸다 — 「알 수 없음」 같은 말을 새로 만들지 않는다. */
  const quantityWithUnit = (value: number | undefined, uomId: number | undefined): string => {
    const code = uomId === undefined ? undefined : uomCodes.get(uomId);

    return value === undefined || code === undefined
      ? quantity(value)
      : `${quantity(value)} ${code}`;
  };
  const itemNames = useItemNameSources(
    candidates.data?.items.map((candidate) => candidate.itemId) ?? [],
  );
  const statuses = useLotStatusOptions();
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
    /* 표는 머리와 모든 열을 가운데로 맞춘다(사용자 지시 2026-09-18). */
    {
      key: 'lotNo',
      header: t.fields.lotNo,
      align: 'center',
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-label={t.select(row.lotNo)}
          aria-current={selectedKey === rowKey(row) ? true : undefined}
          disabled={confirmationPinned}
          onClick={() => {
            if (!confirmationPinned) setSelectedKey(rowKey(row));
          }}
        >
          {row.lotNo}
        </button>
      ),
    },
    {
      key: 'item',
      header: t.fields.item,
      align: 'center',
      /* 긴 품목명이 수량 열을 밀지 않게 한 줄로 자르고, 전체 이름은 title 로 남긴다. */
      render: (row) => {
        const label = itemLabel(row.itemId);

        return (
          <span className="lot-status-transition-item" title={label}>
            {label}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: t.fields.status,
      align: 'center',
      render: (row) => <Chip variant="status">{statusLabel(row.lotStatusCode)}</Chip>,
    },
    {
      key: 'onHand',
      header: t.fields.onHand,
      align: 'center',
      render: (row) => quantityWithUnit(row.onHandQty, row.uomId),
    },
    {
      key: 'held',
      header: t.fields.held,
      align: 'center',
      render: (row) => quantityWithUnit(row.heldQty, row.uomId),
    },
  ];
  const meta = candidates.data?.page;
  const totalPages = meta === undefined || meta.size < 1 ? 1 : Math.ceil(meta.total / meta.size);

  return (
    <div className="lot-status-transition-flow">
      <section
        className="pane lot-status-transition-pane"
        aria-labelledby="lot-status-transition-candidates-title"
      >
        <h2 className="pane-title" id="lot-status-transition-candidates-title">
          {t.pane}
        </h2>
        <div className="filter-bar lot-status-transition-filter">
          <div className="field-cell lot-status-transition-period">
            {/*
             * 기간의 기준(최근 전이일)은 라벨 옆에 라벨 형식(칩)으로 둔다(사용자 지시 2026-09-18).
             * 품질 상태 배지(기본 idle)와 헷갈리지 않게 info 톤을 쓴다 — 표시 전용이라 누를 수 없다.
             */}
            <div className="lot-status-transition-period-label">
              <label className="field-label" htmlFor={periodId}>
                {t.filters.period}
              </label>
              {/* 칩은 칸 폭을 키우지 않는다 — 날짜 입력 폭 안에서 말줄임하고 전체 문구는 title 에 둔다. */}
              <Chip size="sm" status="info" title={t.filters.note}>
                <span className="lot-status-transition-period-chip-text">{t.filters.note}</span>
              </Chip>
            </div>
            <DatePicker
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
            label={t.filters.lotNo}
            placeholder={t.filters.lotNoPlaceholder}
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
          {/* 조회·초기화는 조건과 같은 줄 끝에 한 덩어리로 붙인다(규범 2-1) — 좁아지면 함께 넘어간다. */}
          <div className="filter-actions field-cell-unlabeled lot-status-transition-filter-actions">
            <Button variant="outlined" disabled={confirmationPinned} onClick={reset}>
              {t.filters.reset}
            </Button>
            <Button disabled={confirmationPinned || periodError !== null} onClick={apply}>
              {t.filters.search}
            </Button>
          </div>
        </div>
        {/* 조건과 결과를 한 카드 안에서 가른다 — 선 하나와 작은 머리, 건수는 그 옆. */}
        <div className="lot-status-transition-result-head">
          <h3 className="lot-status-transition-result-title">{t.resultTitle}</h3>
          {candidates.data !== undefined && !candidates.isError && (
            <span className="field-note">
              {t.resultCount(new Intl.NumberFormat('ko-KR').format(meta?.total ?? 0))}
            </span>
          )}
        </div>
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
              className="wide-table lot-status-transition-table"
              aria-busy={candidates.isFetching}
            >
              <Table
                density="compact"
                caption={t.pane}
                columns={columns}
                rows={candidates.data.items}
                getRowId={rowKey}
                sort={null}
                empty={<EmptyState size="sm" live title={t.empty} />}
              />
            </div>
            <div className="lot-status-transition-list-footer">
              <p className="field-note">{t.pageStatus(page, totalPages)}</p>
              <nav className="form-actions" aria-label={t.pagination}>
                <Button
                  variant="outlined"
                  disabled={confirmationPinned || page <= 1}
                  onClick={() => changePage(page - 1)}
                >
                  {t.previous}
                </Button>
                <Button
                  variant="outlined"
                  disabled={confirmationPinned || page >= totalPages}
                  onClick={() => changePage(page + 1)}
                >
                  {t.next}
                </Button>
              </nav>
            </div>
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
            <dl className="lot-status-transition-status-grid" aria-label={tSelected.current}>
              {[
                [tSelected.status, statusLabel(selected.lotStatusCode)],
                [tSelected.onHand, quantity(selected.onHandQty)],
                [tSelected.held, quantity(selected.heldQty)],
                [tSelected.available, quantity(selected.availableQty)],
                [tSelected.latestTransition, formatDateTime(selected.latestTransitionAt)],
                [tSelected.latestReason, selected.latestReasonCode ?? emptyValue],
              ].map(([label, value]) => (
                <div className="field-cell" key={label}>
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
