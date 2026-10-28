import { Button, SearchInput, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import type { PurchaseOrderFilters } from './filters';
import { ProgressFilterField } from './progress';
import type { SelectOption } from './types';

const t = messages.erpPurchaseOrder;

interface FilterSelectProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
}

const FilterSelect = ({ label, options, value, onChange }: FilterSelectProps) => {
  const id = useId();
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
      />
    </div>
  );
};

export interface ErpPurchaseOrderFilterBarProps {
  appliedFilters: PurchaseOrderFilters;
  supplierOptions: SelectOption[];
  plantOptions: SelectOption[];
  statusOptions: SelectOption[];
  onSearch: (filters: PurchaseOrderFilters) => void;
  onReset: () => void;
}

/**
 * 조건 줄. 고치는 동안은 초안(`draft`)에만 담고 「조회」를 눌러야 주소로 간다 —
 * 칸 하나를 바꿀 때마다 조회가 나가면 기간을 다 고르기도 전에 엉뚱한 결과가 뜬다.
 * 진행 단추만은 누르는 즉시 건다 — 걸린 조건에 진행만 바꿔 얹고, 고치던 초안은 그대로 둔다.
 */
export const ErpPurchaseOrderFilterBar = ({
  appliedFilters,
  supplierOptions,
  plantOptions,
  statusOptions,
  onSearch,
  onReset,
}: ErpPurchaseOrderFilterBarProps) => {
  const [draft, setDraft] = useState(appliedFilters);
  const reasonId = useId();
  const { q, supplier, plant, status, from, to, progress } = appliedFilters;
  /* 주소가 바뀌면(뒤로가기·초기화) 초안도 따라간다. 진행은 초안을 거치지 않아 따라가지 않는다. */
  useEffect(
    () => setDraft((current) => ({ ...current, q, supplier, plant, status, from, to })),
    [q, supplier, plant, status, from, to],
  );

  const reversed = draft.from !== '' && draft.to !== '' && draft.from > draft.to;
  const update = <K extends keyof PurchaseOrderFilters>(key: K, value: PurchaseOrderFilters[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const search = (): void => {
    if (!reversed) onSearch({ ...draft, progress });
  };

  return (
    <div className="filter-bar">
      <TextField
        type="date"
        label={t.fields.orderDateFrom}
        value={draft.from}
        onChange={(event) => update('from', event.target.value)}
      />
      <TextField
        type="date"
        label={t.fields.orderDateTo}
        value={draft.to}
        onChange={(event) => update('to', event.target.value)}
      />
      <FilterSelect
        label={t.fields.supplier}
        options={supplierOptions}
        value={draft.supplier}
        onChange={(value) => update('supplier', value)}
      />
      <FilterSelect
        label={t.fields.plant}
        options={plantOptions}
        value={draft.plant}
        onChange={(value) => update('plant', value)}
      />
      <FilterSelect
        label={t.fields.status}
        options={statusOptions}
        value={draft.status}
        onChange={(value) => update('status', value)}
      />
      <SearchInput
        label={t.fields.q}
        placeholder={t.values.searchPlaceholder}
        value={draft.q}
        onChange={(event) => update('q', event.target.value)}
        onSearch={search}
        clearLabel={messages.common.clear}
      />
      <ProgressFilterField
        value={progress}
        onChange={(next) => onSearch({ ...appliedFilters, progress: next })}
      />
      <div className="field-cell field-cell-unlabeled">
        {reversed && (
          <span id={reasonId} className="field-error">
            {t.filters.dateRangeError}
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
