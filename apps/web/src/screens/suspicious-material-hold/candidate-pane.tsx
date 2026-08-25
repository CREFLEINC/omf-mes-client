import {
  AlertBanner,
  Button,
  Checkbox,
  type Column,
  EmptyState,
  SearchInput,
  Select,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import {
  useItemReferenceOptions,
  useLocationReferenceOptions,
  useWarehouseReferenceOptions,
  type ReferenceOptionsResult,
} from '../lot-status-history/reference-options';
import { useLotStatusOptions } from '../lot-status-history/options';
import { useWorkOrderCloseUomLookup } from '../work-order-close/candidate-references';
import {
  EMPTY_SUSPICIOUS_MATERIAL_FILTERS,
  reconcileSuspiciousMaterialSelection,
  toSelectedLotSnapshot,
  toSuspiciousMaterialQuery,
  type SelectedLotSnapshot,
  type SuspiciousMaterialFilters,
} from './candidate-model';

type Lot = components['schemas']['LotQualityStatus'];
const t = messages.suspiciousMaterialHold.candidate;

interface Props {
  isLocked: boolean;
  selection: SelectedLotSnapshot[];
  onSelectionChange: (selection: SelectedLotSnapshot[]) => void;
  onAvailabilityChange?: (ready: boolean) => void;
}

const positiveId = (value: string): number | null => {
  const parsed = Number(value);
  return /^\d+$/.test(value) && Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const referenceLabel = (
  query: { data?: ReferenceOptionsResult; isPending: boolean; isError: boolean },
  id: number | undefined,
  fallback: string,
): string => {
  if (id === undefined || query.isPending || query.isError || query.data?.isTruncated !== false)
    return fallback;
  return query.data.entries.find((entry) => entry.value === String(id))?.label ?? fallback;
};

const sameSelection = (left: SelectedLotSnapshot[], right: SelectedLotSnapshot[]): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

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
  const candidates = useQuery({
    queryKey: ['suspicious-material-hold', 'candidates', filters, page],
    placeholderData: keepPreviousData,
    enabled: !isLocked,
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/lot-statuses', {
          params: { query: toSuspiciousMaterialQuery(filters, page) },
        }),
      ),
  });
  const items = useItemReferenceOptions();
  const warehouses = useWarehouseReferenceOptions();
  const locations = useLocationReferenceOptions(positiveId(filters.warehouseId));
  const statuses = useLotStatusOptions();
  const uoms = useWorkOrderCloseUomLookup();
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

  const move = (nextFilters: SuspiciousMaterialFilters, nextPage: number): void => {
    if (isLocked) return;
    onSelectionChange([]);
    setPage(nextPage);
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
      const location = referenceLabel(locations, row.locationId, '');
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
  const uomLabel = (id: number | undefined): string =>
    id !== undefined && !uoms.isLoading && !uoms.isError && !uoms.truncated
      ? (uoms.entries.find((value) => value.uomId === id)?.label ?? t.values.uomUnknown)
      : t.values.uomUnknown;
  const columns: Column<Lot>[] = [
    {
      key: 'select',
      header: t.fields.select,
      render: (row) => (
        <Checkbox
          aria-label={t.actions.select(row.lotNo)}
          checked={selection.some((value) => value.lotId === row.lotId)}
          disabled={isLocked || !ready || toSelectedLotSnapshot(row) === null}
          onChange={() => toggle(row)}
        />
      ),
    },
    {
      key: 'lot',
      header: t.fields.lotNo,
      render: (row) => (row.fullyHeld ? t.values.fullyHeld(row.lotNo) : row.lotNo),
    },
    {
      key: 'item',
      header: t.fields.item,
      render: (row) => referenceLabel(items, row.itemId, t.values.itemUnknown),
    },
    {
      key: 'location',
      header: t.fields.location,
      render: (row) =>
        `${referenceLabel(warehouses, row.warehouseId, t.values.warehouseUnknown)} / ${referenceLabel(locations, row.locationId, t.values.locationUnknown)}`,
    },
    {
      key: 'quantity',
      header: t.fields.quantity,
      align: 'end',
      render: (row) =>
        `${row.onHandQty === undefined ? t.values.quantityUnknown : String(row.onHandQty)} ${uomLabel(row.uomId)}`,
    },
    {
      key: 'status',
      header: t.fields.statusAndTransition,
      render: (row) =>
        `${statusLabel(row.lotStatusCode)} · ${row.latestTransitionAt ?? t.values.transitionNone}`,
    },
  ];
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
  const pages =
    meta === undefined || meta.size < 1 ? 1 : Math.max(1, Math.ceil(meta.total / meta.size));

  return (
    <section className="pane" aria-label={t.pane}>
      <div className="filter-bar">
        <SearchInput
          label={t.fields.lotNo}
          value={draft.q}
          disabled={isLocked}
          onChange={(event) => setDraft((value) => ({ ...value, q: event.target.value }))}
          onSearch={apply}
        />
        {filterSelects.map(([label, key, entries]) => (
          <div key={key}>
            <span className="field-label">{label}</span>
            <Select
              aria-label={label}
              value={draft[key]}
              options={[{ value: '', label: t.values.all }, ...entries]}
              disabled={isLocked}
              onChange={(value) => setDraft((current) => ({ ...current, [key]: value }))}
            />
          </div>
        ))}
        <Button disabled={isLocked} onClick={apply}>
          {t.actions.search}
        </Button>
        <Button variant="outlined" disabled={isLocked} onClick={reset}>
          {t.actions.reset}
        </Button>
      </div>
      <p role="status">{t.values.selected(selection.length)}</p>
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
          <Table
            density="compact"
            columns={columns}
            rows={candidates.data.items}
            getRowId={(row) => String(row.lotId)}
            sort={null}
            empty={<EmptyState size="sm" live title={t.empty} />}
          />
          <nav className="form-actions" aria-label={t.pagination}>
            <Button
              variant="outlined"
              disabled={isLocked || page <= 1}
              onClick={() => move(filters, page - 1)}
            >
              {t.actions.previous}
            </Button>
            <Button
              variant="outlined"
              disabled={isLocked || page >= pages}
              onClick={() => move(filters, page + 1)}
            >
              {t.actions.next}
            </Button>
          </nav>
        </>
      )}
    </section>
  );
};
