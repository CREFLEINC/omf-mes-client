import { Button, DatePicker, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { EMPTY_FILTERS, type RequestFilters } from './filters';

export interface FilterBarProps {
  applied: RequestFilters;
  onApply: (filters: RequestFilters) => void;
  onReset: () => void;
}

export const FilterBar = ({ applied, onApply, onReset }: FilterBarProps) => {
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
      {/* 상태는 탭 줄 오른쪽 상태 칩으로 거른다(#186) — 조건 칸에는 두지 않는다. 고른 상태는 조회해도 그대로다. */}
      {/*
       * 상신일은 시작일·종료일 두 칸으로 나눠 고른다(#144) — 한 칸 범위 달력보다 어느 쪽을 정했는지가 바로 보인다.
       * 각각 따로 지울 수 있다. 보내는 값(`from`·`to`)은 그대로다.
       */}
      <div className="field-cell">
        <label className="field-label" htmlFor={fromId}>
          {t.fields.periodFrom}
        </label>
        {/* 시작일은 종료일보다 늦을 수 없다 — 범위 달력 하나일 때 저절로 지켜지던 순서다. */}
        <DatePicker
          id={fromId}
          placeholder={t.datePlaceholder}
          clearable
          max={draft.to === '' ? undefined : draft.to}
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
          min={draft.from === '' ? undefined : draft.from}
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
      {/* 「결재 대기만 보기」는 탭 줄 오른쪽 칩으로 옮겼다(#186 · `PendingChip`). */}
      <div className="quality-approval-filter-footer">
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
