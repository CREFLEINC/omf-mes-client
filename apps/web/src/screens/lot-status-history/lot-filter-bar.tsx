import { Button, SearchInput, Select } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import type { LotFilters } from './filters';
import { useLocationReferenceOptions } from './reference-options';

const t = messages.lotStatusHistory;

export interface FilterOption {
  value: string;
  label: string;
}

export interface LotFilterBarProps {
  appliedFilters: LotFilters;
  lotTypeOptions: readonly FilterOption[];
  lotStatusOptions: readonly FilterOption[];
  warehouseOptions: readonly FilterOption[];
  itemOptions: readonly FilterOption[];
  lotTypeNote?: string;
  lotStatusNote?: string;
  warehouseNote?: string;
  itemNote?: string;
  lotTypeBlockReason?: string;
  onSearch: (filters: LotFilters) => void;
  onReset: () => void;
}

interface SelectFieldProps {
  label: string;
  options: readonly FilterOption[];
  value: string;
  note?: string;
  required?: boolean;
  onChange: (value: string) => void;
}

const SelectField = ({
  label,
  options,
  value,
  note,
  required = false,
  onChange,
}: SelectFieldProps) => {
  const id = useId();
  const noteId = `${id}-note`;

  return (
    <div className="field-cell wide-select">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <Select
        id={id}
        options={[...options]}
        value={value === '' && required ? null : value}
        onChange={onChange}
        aria-required={required || undefined}
        aria-describedby={note === undefined ? undefined : noteId}
      />
      {note !== undefined && (
        <span id={noteId} className="field-note">
          {note}
        </span>
      )}
    </div>
  );
};

const withAll = (options: readonly FilterOption[]): FilterOption[] => [
  { value: '', label: t.values.all },
  ...options,
];

const toIdentifier = (value: string): number | null => (value === '' ? null : Number(value));

export const LotFilterBar = ({
  appliedFilters,
  lotTypeOptions,
  lotStatusOptions,
  warehouseOptions,
  itemOptions,
  lotTypeNote,
  lotStatusNote,
  warehouseNote,
  itemNote,
  lotTypeBlockReason,
  onSearch,
  onReset,
}: LotFilterBarProps) => {
  const [filters, setFilters] = useState<LotFilters>(appliedFilters);
  const reasonId = useId();

  const {
    lotType: appliedLotType,
    q: appliedQ,
    item: appliedItem,
    status: appliedStatus,
    warehouse: appliedWarehouse,
    location: appliedLocation,
    sort: appliedSort,
  } = appliedFilters;

  useEffect(() => {
    setFilters({
      lotType: appliedLotType,
      q: appliedQ,
      item: appliedItem,
      status: appliedStatus,
      warehouse: appliedWarehouse,
      location: appliedLocation,
      sort: appliedSort,
    });
  }, [
    appliedLotType,
    appliedQ,
    appliedItem,
    appliedStatus,
    appliedWarehouse,
    appliedLocation,
    appliedSort,
  ]);

  const locations = useLocationReferenceOptions(toIdentifier(filters.warehouse));
  const locationOptions =
    locations.data?.entries.map((entry) => ({
      value: entry.value,
      label: entry.isActive ? entry.label : t.values.inactive(entry.label),
    })) ?? [];
  const locationNote =
    filters.warehouse === ''
      ? t.lotFilter.notes.locationNeedsWarehouse
      : locations.isError
        ? t.lotFilter.notes.locationFailed
        : locations.data?.isTruncated === true
          ? t.lotFilter.notes.locationTruncated
          : undefined;

  const searchReason =
    lotTypeBlockReason ?? (filters.lotType === '' ? t.lotFilter.reasons.lotTypeRequired : null);
  const search = (): void => {
    if (searchReason === null) onSearch(filters);
  };

  return (
    <div className="filter-bar lot-status-filter">
      <SelectField
        required
        label={t.lotFilter.fields.lotType}
        options={lotTypeOptions}
        value={filters.lotType}
        note={lotTypeNote}
        onChange={(lotType) => setFilters((current) => ({ ...current, lotType }))}
      />
      <SearchInput
        label={t.lotFilter.fields.lotNo}
        value={filters.q}
        onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
        onSearch={search}
      />
      <SelectField
        label={t.lotFilter.fields.item}
        options={withAll(itemOptions)}
        value={filters.item}
        note={itemNote}
        onChange={(item) => setFilters((current) => ({ ...current, item }))}
      />
      <SelectField
        label={t.lotFilter.fields.status}
        options={withAll(lotStatusOptions)}
        value={filters.status}
        note={lotStatusNote}
        onChange={(status) => setFilters((current) => ({ ...current, status }))}
      />
      <SelectField
        label={t.lotFilter.fields.warehouse}
        options={withAll(warehouseOptions)}
        value={filters.warehouse}
        note={warehouseNote}
        onChange={(warehouse) =>
          setFilters((current) => ({
            ...current,
            warehouse,
            location: warehouse === current.warehouse ? current.location : '',
          }))
        }
      />
      <SelectField
        label={t.lotFilter.fields.location}
        options={withAll(locationOptions)}
        value={filters.location}
        note={locationNote}
        onChange={(location) => setFilters((current) => ({ ...current, location }))}
      />
      <div className="lot-status-filter-footer">
        {searchReason !== null && (
          <span id={reasonId} className="field-note">
            {searchReason}
          </span>
        )}

        <div className="filter-actions lot-status-filter-buttons">
          <Button
            disabled={searchReason !== null}
            aria-describedby={searchReason === null ? undefined : reasonId}
            onClick={search}
          >
            {t.actions.search}
          </Button>
          <Button variant="outlined" onClick={onReset}>
            {t.actions.reset}
          </Button>
        </div>
      </div>
    </div>
  );
};
