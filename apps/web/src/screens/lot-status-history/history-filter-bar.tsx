import { Button, DatePicker, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef, useState } from 'react';

import type { HistoryFilters } from './filters';
import type { FilterOption } from './lot-filter-bar';
import { validateHistoryPeriod, type HistoryPeriodError } from './period';
import { useRangeStep } from './range-step';

const t = messages.lotStatusHistory;

const periodReason = (error: HistoryPeriodError | null): string | null => {
  switch (error) {
    case 'missing':
      return t.historyFilter.reasons.missing;
    case 'invalid':
      return t.historyFilter.reasons.invalid;
    case 'reversed':
      return t.historyFilter.reasons.reversed;
    case null:
      return null;
  }
};

export interface HistoryFilterBarProps {
  appliedFilters: HistoryFilters;
  actorOptions: readonly FilterOption[];
  actorNote?: string;
  onSearch: (filters: HistoryFilters) => void;
  onReset: () => void;
}

export const HistoryFilterBar = ({
  appliedFilters,
  actorOptions,
  actorNote,
  onSearch,
  onReset,
}: HistoryFilterBarProps) => {
  const periodId = useId();
  const actorId = useId();
  const actorNoteId = useId();
  const reasonId = useId();
  const [draft, setDraft] = useState(appliedFilters);
  const { from: appliedFrom, to: appliedTo, actor: appliedActor, lot: appliedLot } = appliedFilters;

  useEffect(() => {
    setDraft({ from: appliedFrom, to: appliedTo, actor: appliedActor, lot: appliedLot });
  }, [appliedActor, appliedFrom, appliedLot, appliedTo]);

  const reason = periodReason(validateHistoryPeriod({ from: draft.from, to: draft.to }));
  /*
   * ⭐ 달력이 열려 있는 동안은 지금 고를 날짜를 말한다 — 시작일 → 종료일(사용자 지시 2026-09-19).
   * 닫혀 있으면 조회를 막는 까닭(있을 때만)을 말한다. 조회 가능 여부는 여전히 reason 만 정한다.
   */
  const periodTriggerRef = useRef<HTMLButtonElement>(null);
  const step = useRangeStep(periodTriggerRef);
  const periodHint =
    step === 'start'
      ? t.historyFilter.steps.start
      : step === 'end'
        ? t.historyFilter.steps.end
        : reason;
  const hasAppliedActor = actorOptions.some((option) => option.value === appliedActor);
  const visibleActorOptions =
    appliedActor !== '' && !hasAppliedActor
      ? [...actorOptions, { value: appliedActor, label: t.historyFilter.actorUnknownOption }]
      : actorOptions;

  return (
    <div className="filter-bar lot-status-filter">
      <div className="field-cell lot-status-filter-period">
        {/* ⭐ 조회를 막는 까닭은 「기간」 옆에 옅은 안내 글자로(사용자 지시 2026-09-19 — 위치 칸과 같은 모양). */}
        <div className="lot-status-filter-label-row">
          <label className="field-label" htmlFor={periodId}>
            {t.historyFilter.fields.period}
          </label>
          {periodHint !== null && (
            <span id={reasonId} className="field-note" aria-live="polite">
              {periodHint}
            </span>
          )}
        </div>
        <DatePicker
          ref={periodTriggerRef}
          id={periodId}
          mode="range"
          placeholder={t.historyFilter.periodPlaceholder}
          value={[draft.from === '' ? null : draft.from, draft.to === '' ? null : draft.to]}
          onChange={([from, to]) => setDraft((current) => ({ ...current, from, to }))}
          aria-describedby={periodHint === null ? undefined : reasonId}
        />
      </div>
      <div className="field-cell wide-select">
        <label className="field-label" htmlFor={actorId}>
          {t.historyFilter.fields.actor}
        </label>
        <Select
          id={actorId}
          value={draft.actor}
          placeholder={t.values.all}
          aria-describedby={actorNote === undefined ? undefined : actorNoteId}
          options={[{ value: '', label: t.values.all }, ...visibleActorOptions]}
          onChange={(actor) => setDraft((current) => ({ ...current, actor }))}
        />
        {actorNote !== undefined && (
          <span id={actorNoteId} className="field-note">
            {actorNote}
          </span>
        )}
      </div>
      <TextField
        containerClassName="lot-status-filter-lot-no"
        label={t.historyFilter.fields.lot}
        value={draft.lot}
        onChange={(event) => setDraft((current) => ({ ...current, lot: event.target.value }))}
      />
      {/* 조회·초기화는 조건과 같은 줄 끝에 한 덩어리로(규범 2-1). 조회가 주 동작이라 오른쪽 끝. */}
      <div className="filter-actions field-cell-unlabeled lot-status-filter-actions">
        <Button variant="outlined" onClick={onReset}>
          {t.actions.reset}
        </Button>
        <Button
          disabled={reason !== null}
          aria-describedby={reason === null ? undefined : reasonId}
          onClick={() => onSearch(draft)}
        >
          {t.actions.search}
        </Button>
      </div>
    </div>
  );
};
