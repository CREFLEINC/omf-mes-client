import { Button, SearchInput, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { type ProductionOrderFilters } from './filters';
import type { SelectOption } from './types';

const t = messages.productionOrder;

interface FilterSelectProps {
  label: string;
  options: SelectOption[];
  value: string;
  note?: string;
  onChange: (value: string) => void;
}

const FilterSelect = ({ label, options, value, note, onChange }: FilterSelectProps) => {
  const id = useId();
  const noteId = `${id}-note`;
  return (
    <div className="field-cell">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <Select
        id={id}
        options={[{ value: '', label: t.filters.all }, ...options]}
        value={value}
        onChange={onChange}
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

export interface ProductionOrderFilterBarProps {
  appliedFilters: ProductionOrderFilters;
  businessUnitOptions: SelectOption[];
  plantOptions: SelectOption[];
  itemOptions: SelectOption[];
  statusOptions: string[];
  businessUnitNote?: string;
  plantNote?: string;
  itemNote?: string;
  statusNote?: string;
  onSearch: (filters: ProductionOrderFilters) => void;
  onReset: () => void;
}

export const ProductionOrderFilterBar = ({
  appliedFilters,
  businessUnitOptions,
  plantOptions,
  itemOptions,
  statusOptions,
  businessUnitNote,
  plantNote,
  itemNote,
  statusNote,
  onSearch,
  onReset,
}: ProductionOrderFilterBarProps) => {
  const [draft, setDraft] = useState(appliedFilters);
  const { q, businessUnit, plant, item, status, dueFrom, dueTo } = appliedFilters;
  const reasonId = useId();
  useEffect(
    () => setDraft({ q, businessUnit, plant, item, status, dueFrom, dueTo }),
    [q, businessUnit, plant, item, status, dueFrom, dueTo],
  );

  const reversed = draft.dueFrom !== '' && draft.dueTo !== '' && draft.dueFrom > draft.dueTo;
  const update = (key: keyof ProductionOrderFilters, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const search = (): void => {
    if (!reversed) onSearch(draft);
  };

  return (
    <div className="filter-bar production-order-filter-bar">
      <TextField
        fullWidth
        type="date"
        label={t.fields.dueFrom}
        value={draft.dueFrom}
        onChange={(event) => update('dueFrom', event.target.value)}
      />
      <TextField
        fullWidth
        type="date"
        label={t.fields.dueTo}
        value={draft.dueTo}
        onChange={(event) => update('dueTo', event.target.value)}
      />
      <FilterSelect
        label={t.fields.businessUnit}
        options={businessUnitOptions}
        value={draft.businessUnit}
        note={businessUnitNote}
        onChange={(value) => update('businessUnit', value)}
      />
      <FilterSelect
        label={t.fields.plant}
        options={plantOptions}
        value={draft.plant}
        note={plantNote}
        onChange={(value) => update('plant', value)}
      />
      <FilterSelect
        label={t.fields.item}
        options={itemOptions}
        value={draft.item}
        note={itemNote}
        onChange={(value) => update('item', value)}
      />
      <FilterSelect
        label={t.fields.status}
        options={statusOptions.map((value) => ({ value, label: value }))}
        value={draft.status}
        note={statusNote}
        onChange={(value) => update('status', value)}
      />
      <SearchInput
        fullWidth
        label={t.fields.q}
        value={draft.q}
        onChange={(event) => update('q', event.target.value)}
        onSearch={search}
      />
      <div className="field-cell field-cell-unlabeled">
        {reversed && (
          <span id={reasonId} className="field-error">
            {t.filters.dueRangeError}
          </span>
        )}
        <div className="filter-actions">
          <Button
            disabled={reversed}
            aria-describedby={reversed ? reasonId : undefined}
            onClick={search}
          >
            {messages.common.search}
          </Button>
          <Button variant="outlined" onClick={onReset}>
            {messages.common.reset}
          </Button>
        </div>
      </div>
    </div>
  );
};
