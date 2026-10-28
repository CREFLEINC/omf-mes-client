import { Button, SearchInput, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { ItemPickerDialog } from '../../patterns/item-picker';
import { Select } from '../../patterns/select';
import type { ErpProductionOrderFilters } from './filters';
import { ProgressFilterField } from './progress';
import { useItemNames } from './lookups';
import type { SelectOption } from './types';

const t = messages.erpProductionOrder;

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

interface ItemFieldProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * 품목 조건 — 품목 마스터가 수천 건이라 선택칸이 아니라 공용 「품목 선택」 창으로 고른다.
 * 지난 ERP W/O 를 찾는 조건이라 사용 중지 품목까지 찾고, 재고와 상관없어 가용 재고 열은 뺀다.
 * 고른 품목의 이름은 품목 상세로 푼다 — 주소로 들어와 창을 거치지 않은 값도 이름이 선다.
 */
const ItemField = ({ value, onChange }: ItemFieldProps) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const itemId = Number(value);
  const hasItem = value !== '' && Number.isSafeInteger(itemId) && itemId > 0;
  const itemNameOf = useItemNames(hasItem ? [itemId] : []);
  const label = hasItem ? itemNameOf(itemId) : '';
  const open = (): void => setIsPickerOpen(true);

  return (
    <>
      <SearchInput
        label={t.fields.item}
        value={label}
        readOnly
        title={label === '' ? undefined : label}
        placeholder={t.filters.itemPlaceholder}
        aria-haspopup="dialog"
        clearLabel={t.filters.itemClear}
        onClick={open}
        onSearch={open}
        onChange={() => undefined}
        onClear={() => onChange('')}
      />
      {isPickerOpen && (
        <ItemPickerDialog
          multiple={false}
          includeInactive
          showAvailability={false}
          confirmLabel={t.filters.itemPick}
          onClose={() => setIsPickerOpen(false)}
          onConfirm={([item]) => {
            if (item !== undefined) onChange(String(item.itemId));
            setIsPickerOpen(false);
          }}
        />
      )}
    </>
  );
};

export interface ErpProductionOrderFilterBarProps {
  appliedFilters: ErpProductionOrderFilters;
  statusOptions: SelectOption[];
  onSearch: (filters: ErpProductionOrderFilters) => void;
  onReset: () => void;
}

/**
 * 조건 줄. 고치는 동안은 초안(`draft`)에만 담고 「조회」를 눌러야 주소로 간다 —
 * 칸 하나를 바꿀 때마다 조회가 나가면 기간을 다 고르기도 전에 엉뚱한 결과가 뜬다.
 * 진행 단추만은 누르는 즉시 건다 — 걸린 조건에 진행만 바꿔 얹고, 고치던 초안은 그대로 둔다.
 */
export const ErpProductionOrderFilterBar = ({
  appliedFilters,
  statusOptions,
  onSearch,
  onReset,
}: ErpProductionOrderFilterBarProps) => {
  const [draft, setDraft] = useState(appliedFilters);
  const reasonId = useId();
  const { q, item, status, from, to, progress } = appliedFilters;
  /* 주소가 바뀌면(뒤로가기·초기화) 초안도 따라간다. 진행은 초안을 거치지 않아 따라가지 않는다. */
  useEffect(
    () => setDraft((current) => ({ ...current, q, item, status, from, to })),
    [q, item, status, from, to],
  );

  const reversed = draft.from !== '' && draft.to !== '' && draft.from > draft.to;
  const update = <K extends keyof ErpProductionOrderFilters>(
    key: K,
    value: ErpProductionOrderFilters[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));
  const search = (): void => {
    if (!reversed) onSearch({ ...draft, progress });
  };

  return (
    <div className="filter-bar">
      <TextField
        type="date"
        label={t.fields.plannedStartFrom}
        value={draft.from}
        onChange={(event) => update('from', event.target.value)}
      />
      <TextField
        type="date"
        label={t.fields.plannedStartTo}
        value={draft.to}
        onChange={(event) => update('to', event.target.value)}
      />
      <FilterSelect
        label={t.fields.status}
        options={statusOptions}
        value={draft.status}
        onChange={(value) => update('status', value)}
      />
      <ItemField value={draft.item} onChange={(value) => update('item', value)} />
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
