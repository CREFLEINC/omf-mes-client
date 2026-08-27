import { Button, DatePicker, Select } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import type { CodeOption } from './disposition-codes';
import type { PendingFilters } from './filters';
import type { DispositionLookup } from './lookups';

interface SelectCellProps {
  label: string;
  options: CodeOption[];
  value: string;
  pendingNote?: string;
  wide?: boolean;
  onChange: (value: string) => void;
}

/**
 * 디자인 시스템 `Select`에는 `label` prop이 없다(설치본 실측) — 라벨을 직접 붙이고
 * `htmlFor`로 잇는다. 선택지가 비었을 때 감추지 않고 사유를 다는 것은 공유계약 G-2다.
 */
const SelectCell = ({ label, options, value, pendingNote, wide, onChange }: SelectCellProps) => {
  const id = useId();
  const noteId = `${id}-note`;
  const isPending = options.length === 0;
  const choices = isPending
    ? []
    : [{ value: '', label: messages.dispositionDecision.all }, ...options];

  return (
    <div className={wide === true ? 'field-cell wide-select' : 'field-cell'}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <Select
        id={id}
        options={choices}
        value={value === '' && isPending ? null : value}
        placeholder={
          isPending
            ? messages.dispositionDecision.codePlaceholder
            : messages.dispositionDecision.all
        }
        aria-describedby={isPending && pendingNote !== undefined ? noteId : undefined}
        onChange={onChange}
      />
      {isPending && pendingNote !== undefined && (
        <span id={noteId} className="field-note">
          {pendingNote}
        </span>
      )}
    </div>
  );
};

export interface FilterBarProps {
  applied: PendingFilters;
  severityOptions: CodeOption[];
  statusOptions: CodeOption[];
  items: DispositionLookup;
  onApply: (filters: PendingFilters) => void;
  onReset: () => void;
}

export const FilterBar = ({
  applied,
  severityOptions,
  statusOptions,
  items,
  onApply,
  onReset,
}: FilterBarProps) => {
  const t = messages.dispositionDecision;
  const periodId = useId();
  const periodNoteId = `${periodId}-note`;
  const [draft, setDraft] = useState<PendingFilters>(applied);
  const { from, to, itemId, severityCode, statusCode } = applied;

  useEffect(() => {
    setDraft({ from, to, itemId, severityCode, statusCode });
  }, [from, to, itemId, severityCode, statusCode]);

  const itemOptions = items.entries.map((entry) => ({ value: entry.value, label: entry.label }));

  return (
    <div className="filter-bar">
      <div className="field-cell">
        <label className="field-label" htmlFor={periodId}>
          {t.fields.period}
        </label>
        <DatePicker
          id={periodId}
          mode="range"
          value={[draft.from === '' ? null : draft.from, draft.to === '' ? null : draft.to]}
          placeholder={messages.common.selectDate}
          aria-describedby={periodNoteId}
          onChange={([nextFrom, nextTo]) =>
            setDraft((current) => ({ ...current, from: nextFrom, to: nextTo }))
          }
        />
        {/* L-3 — 기간은 비울 수 없다. 왜 필수인지를 칸 옆에 상시 둔다. */}
        <span id={periodNoteId} className="field-note">
          {t.values.periodRequired}
        </span>
      </div>
      <SelectCell
        label={t.fields.item}
        options={itemOptions}
        value={draft.itemId}
        wide
        onChange={(value) => setDraft((current) => ({ ...current, itemId: value }))}
      />
      <SelectCell
        label={t.fields.severityCode}
        options={severityOptions}
        value={draft.severityCode}
        pendingNote={t.codePending}
        onChange={(value) => setDraft((current) => ({ ...current, severityCode: value }))}
      />
      <SelectCell
        label={t.fields.statusCode}
        options={statusOptions}
        value={draft.statusCode}
        pendingNote={t.codePending}
        onChange={(value) => setDraft((current) => ({ ...current, statusCode: value }))}
      />
      <div className="field-cell field-cell-unlabeled">
        <div className="filter-actions">
          <Button onClick={() => onApply(draft)}>{messages.common.search}</Button>
          <Button variant="outlined" onClick={onReset}>
            {messages.common.reset}
          </Button>
        </div>
      </div>
    </div>
  );
};
