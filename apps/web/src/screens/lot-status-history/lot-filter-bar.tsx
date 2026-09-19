import { Button, SearchInput, Select } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { ALL_LOT_TYPES, type LotFilters } from './filters';
import { ItemFilterField } from './item-filter-field';
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
  lotTypeNote?: string;
  lotStatusNote?: string;
  warehouseNote?: string;
  onSearch: (filters: LotFilters) => void;
  onReset: () => void;
}

interface SelectFieldProps {
  label: string;
  options: readonly FilterOption[];
  value: string;
  note?: string;
  /** 칸 폭 규칙(app.css). 값의 길이에 맞춘 폭을 칸마다 따로 준다. */
  className: string;
  /** 먼저 골라야 할 것이 남아 잠겨 있다. */
  disabled?: boolean;
  /** 잠긴 까닭 — 라벨 옆에 옅은 안내 글자로 둔다. */
  labelHint?: string;
  onChange: (value: string) => void;
}

const SelectField = ({
  label,
  options,
  value,
  note,
  className,
  disabled = false,
  labelHint,
  onChange,
}: SelectFieldProps) => {
  const id = useId();
  const noteId = `${id}-note`;
  const hintId = `${id}-hint`;
  const describedBy = [labelHint === undefined ? '' : hintId, note === undefined ? '' : noteId]
    .filter((part) => part !== '')
    .join(' ');

  return (
    <div className={`field-cell ${className}`}>
      {labelHint === undefined ? (
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
      ) : (
        /* ⭐ 안내는 라벨 옆에 옅은 글자로만 — 칩 모양은 쓰지 않는다(사용자 지시 2026-09-19). */
        <div className="lot-status-filter-label-row">
          <label className="field-label" htmlFor={id}>
            {label}
          </label>
          <span id={hintId} className="field-note">
            {labelHint}
          </span>
        </div>
      )}
      <Select
        id={id}
        options={[...options]}
        value={value}
        disabled={disabled}
        onChange={onChange}
        aria-describedby={describedBy === '' ? undefined : describedBy}
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
  lotTypeNote,
  lotStatusNote,
  warehouseNote,
  onSearch,
  onReset,
}: LotFilterBarProps) => {
  const [filters, setFilters] = useState<LotFilters>(appliedFilters);

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
  /*
   * ⭐ 위치는 창고를 고른 뒤에 연다 — 그 전에는 잠그고 까닭은 라벨 옆 안내 글자로 둔다
   * (사용자 지시 2026-09-19).
   */
  const isLocationLocked = filters.warehouse === '';
  const locationNote = isLocationLocked
    ? undefined
    : locations.isError
      ? t.lotFilter.notes.locationFailed
      : locations.data?.isTruncated === true
        ? t.lotFilter.notes.locationTruncated
        : undefined;

  /* 아직 조회 전('')이면 초안은 「전체」다 — 유형을 고르지 않고 조회해도 된다(사용자 지시 2026-09-19). */
  const lotType = filters.lotType === '' ? ALL_LOT_TYPES : filters.lotType;
  const search = (): void => onSearch({ ...filters, lotType });

  return (
    <div className="filter-bar lot-status-filter">
      <SelectField
        className="lot-status-filter-lot-type"
        label={t.lotFilter.fields.lotType}
        options={[{ value: ALL_LOT_TYPES, label: t.values.all }, ...lotTypeOptions]}
        value={lotType}
        note={lotTypeNote}
        onChange={(lotType) => setFilters((current) => ({ ...current, lotType }))}
      />
      <SearchInput
        containerClassName="lot-status-filter-lot-no"
        label={t.lotFilter.fields.lotNo}
        value={filters.q}
        onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))}
        onSearch={search}
        clearLabel={messages.common.clear}
      />
      <ItemFilterField
        value={filters.item}
        onChange={(item) => setFilters((current) => ({ ...current, item }))}
      />
      <SelectField
        className="lot-status-filter-status"
        label={t.lotFilter.fields.status}
        options={withAll(lotStatusOptions)}
        value={filters.status}
        note={lotStatusNote}
        onChange={(status) => setFilters((current) => ({ ...current, status }))}
      />
      <SelectField
        className="lot-status-filter-place"
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
        className="lot-status-filter-place lot-status-filter-location"
        label={t.lotFilter.fields.location}
        options={withAll(locationOptions)}
        value={filters.location}
        note={locationNote}
        disabled={isLocationLocked}
        labelHint={isLocationLocked ? t.lotFilter.notes.locationNeedsWarehouse : undefined}
        onChange={(location) => setFilters((current) => ({ ...current, location }))}
      />
      {/* 조회·초기화는 조건과 같은 줄 끝에 한 덩어리로(규범 2-1). 조회가 주 동작이라 오른쪽 끝. */}
      <div className="filter-actions field-cell-unlabeled lot-status-filter-actions">
        <Button variant="outlined" onClick={onReset}>
          {t.actions.reset}
        </Button>
        <Button onClick={search}>{t.actions.search}</Button>
      </div>
    </div>
  );
};
