import {
  AlertBanner,
  Button,
  Checkbox,
  Chip,
  type Column,
  EmptyState,
  SearchInput,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
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
import { useUomCodeOf, withUom } from '../lot-status-history/uoms';
import { useWorkOrderCloseUomLookup } from '../work-order-close/candidate-references';
import {
  EMPTY_SUSPICIOUS_MATERIAL_FILTERS,
  reconcileSuspiciousMaterialSelection,
  toSelectedLotSnapshot,
  toSuspiciousMaterialQuery,
  type SelectedLotSnapshot,
  type SuspiciousMaterialFilters,
} from './candidate-model';
import { formatPlantDateTime } from '../../patterns/plant-time';

type Lot = components['schemas']['LotQualityStatus'];
const t = messages.suspiciousMaterialHold.candidate;

interface Props {
  isLocked: boolean;
  selection: SelectedLotSnapshot[];
  onSelectionChange: (selection: SelectedLotSnapshot[]) => void;
  onAvailabilityChange?: (ready: boolean) => void;
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
  const apply = (): void => move({ ...draft }, 1);
  const reset = (): void => {
    if (isLocked) return;
    setDraft(EMPTY_SUSPICIOUS_MATERIAL_FILTERS);
    move(EMPTY_SUSPICIOUS_MATERIAL_FILTERS, 1);
  };
  const toggle = (row: Lot): void => {
    if (isLocked) return;
    if (selection.some((value) => value.lotId === row.lotId))
      onSelectionChange(selection.filter((value) => value.lotId !== row.lotId));
    else {
      const snapshot = toSelectedLotSnapshot(row);
      const warehouse = referenceLabel(warehouses, row.warehouseId, '');
      const location = referenceLabel(locationsOf(row.warehouseId), row.locationId, '');
      const unit =
        row.uomId === undefined || uoms.isLoading || uoms.isError || uoms.truncated
          ? ''
          : (uoms.entries.find(({ uomId }) => uomId === row.uomId)?.label ?? '');
      if (snapshot !== null)
        onSelectionChange([
          ...selection,
          {
            ...snapshot,
            locationLabel:
              warehouse === '' || location === '' ? null : `${warehouse} / ${location}`,
            uomLabel: unit === '' ? null : unit,
          },
        ]);
    }
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
    header: t.fields.select,
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
    [t.fields.item, 'itemId', options(items.data)],
    [t.fields.warehouse, 'warehouseId', options(warehouses.data)],
    [t.fields.status, 'lotStatusCode', statusOptions],
  ] as const;
  const meta = candidates.data?.page;
  const currentPage = meta !== undefined && meta.page > 0 ? meta.page : page;
  /* 고를 수 없는 크기(10 · 20 · 50 밖)를 서버가 돌려주면 크기 칸이 비므로 고른 크기를 보인다. */
  const shownPageSize: LotPageSize = LOT_PAGE_SIZES.find((size) => size === meta?.size) ?? pageSize;

  return (
    <>
      {/* 조회 조건 카드 — LOT 현황처럼 조건만 따로 둔다. */}
      <section
        className="pane lot-status-search"
        aria-label={messages.lotStatusHistory.lotFilter.pane}
      >
        <div className="filter-bar lot-status-filter">
          <SearchInput
            containerClassName="lot-status-filter-lot-no"
            label={messages.lotStatusHistory.lotFilter.lotScanLabel}
            placeholder={messages.lotStatusHistory.lotFilter.lotNoScanPlaceholder}
            value={draft.q}
            disabled={isLocked}
            onChange={(event) => setDraft((value) => ({ ...value, q: event.target.value }))}
            onSearch={apply}
            clearLabel={messages.common.clear}
          />
          {filterSelects.map(([label, key, entries]) => (
            <div className="field-cell wide-select" key={key}>
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
          {/* [조회](주 동작) → [초기화] — LOT 현황과 같은 순서, 줄의 오른쪽 끝. */}
          <div className="filter-actions field-cell-unlabeled lot-status-filter-actions">
            <Button variant="filled" disabled={isLocked} onClick={apply}>
              {t.actions.search}
            </Button>
            <Button variant="outlined" disabled={isLocked} onClick={reset}>
              {t.actions.reset}
            </Button>
          </div>
        </div>
      </section>
      {/* 결과 카드 — 총 건수는 표 아래 쪽 이동 줄에만 둔다(LOT 현황과 같다). 고른 건수는 제목 옆. */}
      <section className="pane lot-status-pane suspicious-material-hold-pane" aria-label={t.pane}>
        <div className="lot-status-pane-head">
          <h2 className="pane-title">{t.pane}</h2>
          <p className="suspicious-material-hold-selection" role="status">
            {t.values.selected(selection.length)}
          </p>
        </div>
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
    </>
  );
};
