import { Button, Checkbox, DatePicker, Select, TextField } from '@crefle/web-ui';
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
        onChange={onChange}
      />
    </div>
  );
};

export interface FilterBarProps {
  applied: RequestFilters;
  statusOptions: CodeOption[];
  pendingOnly: boolean;
  onApply: (filters: RequestFilters) => void;
  onTogglePendingOnly: (value: boolean) => void;
  onReset: () => void;
}

export const FilterBar = ({
  applied,
  statusOptions,
  pendingOnly,
  onApply,
  onTogglePendingOnly,
  onReset,
}: FilterBarProps) => {
  const t = messages.qualityApproval;
  const fromId = useId();
  const toId = useId();
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
    <div className="filter-bar quality-approval-filter">
      <CodeField
        label={messages.qualityApproval.fields.statusSearch}
        options={statusOptions}
        value={draft.statusCode}
        onChange={(value) => setDraft((current) => ({ ...current, statusCode: value }))}
      />
      {/*
       * 상신일은 시작일·종료일 두 칸으로 나눠 고른다(#144) — 한 칸 범위 달력보다 어느 쪽을 정했는지가 바로 보인다.
       * 각각 따로 지울 수 있다. 보내는 값(`from`·`to`)은 그대로다.
       */}
      <div className="field-cell">
        <label className="field-label" htmlFor={fromId}>
          {t.fields.periodFrom}
        </label>
        <DatePicker
          id={fromId}
          placeholder={t.datePlaceholder}
          clearable
          value={draft.from === '' ? null : draft.from}
          onChange={(value) => setDraft((current) => ({ ...current, from: value ?? '' }))}
        />
      </div>
      <div className="field-cell">
        <label className="field-label" htmlFor={toId}>
          {t.fields.periodTo}
        </label>
        <DatePicker
          id={toId}
          placeholder={t.datePlaceholder}
          clearable
          value={draft.to === '' ? null : draft.to}
          onChange={(value) => setDraft((current) => ({ ...current, to: value ?? '' }))}
        />
      </div>
      {/* 돋보기 없는 글 칸(#144) — Enter 로 바로 조회하는 것은 종전 그대로다. */}
      <TextField
        label={t.fields.q}
        placeholder={t.qPlaceholder}
        value={draft.q}
        onChange={(event) => setDraft((current) => ({ ...current, q: event.target.value }))}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) onApply(draft);
        }}
      />
      <div className="quality-approval-filter-footer">
        <Checkbox
          checked={pendingOnly}
          onChange={(event) => onTogglePendingOnly(event.target.checked)}
        >
          {messages.qualityApproval.fields.pendingOnly}
        </Checkbox>
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
