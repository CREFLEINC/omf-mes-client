import { Button, DatePicker, Select } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { sourceCodeOptions, type CodeOption } from './disposition-codes';
import type { PendingFilters } from './filters';
import type { DispositionLookup } from './lookups';

interface SelectCellProps {
  label: string;
  options: CodeOption[];
  value: string;
  pendingNote?: string;
  /** 선택지가 «있어도» 상시 붙는 안내. 값 목록이 비어서가 아니라 축의 범위를 알릴 때 쓴다. */
  note?: string;
  wide?: boolean;
  onChange: (value: string) => void;
}

/**
 * 디자인 시스템 `Select`에는 `label` prop이 없다(설치본 실측) — 라벨을 직접 붙이고
 * `htmlFor`로 잇는다. 선택지가 비었을 때 감추지 않고 사유를 다는 것은 공유계약 G-2다.
 *
 * ⚠ **두 안내가 한 자리를 쓴다.** 선택지가 비면 그 사유(G-2)가 먼저다 — 축의 범위를 알리는
 * 안내를 그 위에 겹쳐 놓으면 「왜 못 고르는지」가 밀려난다.
 */
const SelectCell = ({
  label,
  options,
  value,
  pendingNote,
  note,
  wide,
  onChange,
}: SelectCellProps) => {
  const id = useId();
  const noteId = `${id}-note`;
  const isPending = options.length === 0;
  const choices = isPending
    ? []
    : [{ value: '', label: messages.dispositionDecision.all }, ...options];
  const description = isPending ? pendingNote : note;

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
        aria-describedby={description === undefined ? undefined : noteId}
        onChange={onChange}
      />
      {description !== undefined && (
        <span id={noteId} className="field-note">
          {description}
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
  const { from, to, itemId, severityCode, statusCode, sourceCode } = applied;

  useEffect(() => {
    setDraft({ from, to, itemId, severityCode, statusCode, sourceCode });
  }, [from, to, itemId, severityCode, statusCode, sourceCode]);

  const itemOptions = items.entries.map((entry) => ({ value: entry.value, label: entry.label }));
  /* 심각도·상태와 달리 밖에서 받지 않는다 — 계약이 두 값을 열거해 기다릴 대기가 없다. */
  const sourceOptions = sourceCodeOptions();

  return (
    <div className="filter-bar disposition-filter">
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
      {/*
       * 원천 — ⭐ 서버가 대상 LOT의 입고 유형으로 파생해 내리는 축이고 **화면은 보내지 않는다.**
       * 여기서는 «거르는 축»으로만 쓴다. 안내를 상시 다는 이유는 이 축이 두 갈래만 담기
       * 때문이다 — 수리·자재를 찾다 빈 목록을 보면 「데이터가 없다」로 읽는다.
       */}
      <SelectCell
        label={t.fields.sourceCode}
        options={sourceOptions}
        value={draft.sourceCode}
        note={t.sourceNote}
        onChange={(value) => setDraft((current) => ({ ...current, sourceCode: value }))}
      />
      <div className="disposition-filter-actions">
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
