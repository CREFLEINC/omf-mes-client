import { Button, Checkbox, DatePicker, SearchInput, Select } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import type { CodeOption } from './code-options';
import { EMPTY_FILTERS, type RequestFilters } from './filters';

interface CodeFieldProps {
  label: string;
  options: CodeOption[];
  value: string;
  onChange: (value: string) => void;
}

const CodeField = ({ label, options, value, onChange }: CodeFieldProps) => {
  const id = useId();
  const noteId = `${id}-note`;
  const choices =
    options.length === 0 ? [] : [{ value: '', label: messages.qualityApproval.all }, ...options];

  return (
    <div className="field-cell">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <Select
        id={id}
        options={choices}
        value={value === '' && choices.length === 0 ? null : value}
        placeholder={
          options.length === 0
            ? messages.qualityApproval.codePlaceholder
            : messages.qualityApproval.all
        }
        aria-describedby={options.length === 0 ? noteId : undefined}
        onChange={onChange}
      />
      {options.length === 0 && (
        <span id={noteId} className="field-note">
          {messages.qualityApproval.codePending}
        </span>
      )}
    </div>
  );
};

export interface FilterBarProps {
  applied: RequestFilters;
  typeOptions: CodeOption[];
  statusOptions: CodeOption[];
  pendingOnly: boolean;
  onApply: (filters: RequestFilters) => void;
  onTogglePendingOnly: (value: boolean) => void;
  onReset: () => void;
}

export const FilterBar = ({
  applied,
  typeOptions,
  statusOptions,
  pendingOnly,
  onApply,
  onTogglePendingOnly,
  onReset,
}: FilterBarProps) => {
  const periodId = useId();
  const [draft, setDraft] = useState<RequestFilters>(applied);
  const { approvalTypeCode, statusCode, from, to, q } = applied;

  useEffect(() => {
    setDraft({ approvalTypeCode, statusCode, from, to, q });
  }, [approvalTypeCode, statusCode, from, to, q]);

  const reset = (): void => {
    setDraft(EMPTY_FILTERS);
    onReset();
  };

  return (
    <div className="filter-bar">
      <CodeField
        label={messages.qualityApproval.fields.approvalTypeCode}
        options={typeOptions}
        value={draft.approvalTypeCode}
        onChange={(value) => setDraft((current) => ({ ...current, approvalTypeCode: value }))}
      />
      <CodeField
        label={messages.qualityApproval.fields.statusCode}
        options={statusOptions}
        value={draft.statusCode}
        onChange={(value) => setDraft((current) => ({ ...current, statusCode: value }))}
      />
      <div className="field-cell">
        <label className="field-label" htmlFor={periodId}>
          {messages.qualityApproval.fields.period}
        </label>
        <DatePicker
          id={periodId}
          mode="range"
          value={[draft.from === '' ? null : draft.from, draft.to === '' ? null : draft.to]}
          placeholder={messages.common.selectDate}
          onChange={([nextFrom, nextTo]) =>
            setDraft((current) => ({ ...current, from: nextFrom, to: nextTo }))
          }
        />
      </div>
      <SearchInput
        label={messages.qualityApproval.fields.q}
        value={draft.q}
        onChange={(event) => setDraft((current) => ({ ...current, q: event.target.value }))}
        onSearch={(value) => onApply({ ...draft, q: value })}
      />
      <div className="field-cell field-cell-unlabeled">
        <Checkbox
          checked={pendingOnly}
          onChange={(event) => onTogglePendingOnly(event.target.checked)}
        >
          {messages.qualityApproval.fields.pendingOnly}
        </Checkbox>
      </div>
      <div className="field-cell field-cell-unlabeled">
        <div className="filter-actions">
          <Button onClick={() => onApply(draft)}>{messages.common.search}</Button>
          <Button variant="outlined" onClick={reset}>
            {messages.common.reset}
          </Button>
        </div>
      </div>
    </div>
  );
};
