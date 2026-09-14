import { Button, DatePicker, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import type { HistoryFilters } from './filters';
import type { FilterOption } from './lot-filter-bar';
import { validateHistoryPeriod, type HistoryPeriodError } from './period';

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
  const hasAppliedActor = actorOptions.some((option) => option.value === appliedActor);
  const visibleActorOptions =
    appliedActor !== '' && !hasAppliedActor
      ? [...actorOptions, { value: appliedActor, label: t.historyFilter.actorUnknownOption }]
      : actorOptions;

  return (
    <div className="filter-bar lot-status-filter lot-status-history-filter">
      <div className="field-cell">
        <label className="field-label" htmlFor={periodId}>
          {t.historyFilter.fields.period}
        </label>
        <DatePicker
          id={periodId}
          mode="range"
          value={[draft.from === '' ? null : draft.from, draft.to === '' ? null : draft.to]}
          onChange={([from, to]) => setDraft((current) => ({ ...current, from, to }))}
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
        label={t.historyFilter.fields.lot}
        value={draft.lot}
        onChange={(event) => setDraft((current) => ({ ...current, lot: event.target.value }))}
      />
      <div className="lot-status-filter-footer">
        {reason !== null && (
          <span id={reasonId} className="field-note">
            {reason}
          </span>
        )}

        <div className="filter-actions lot-status-filter-buttons">
          <Button
            disabled={reason !== null}
            aria-describedby={reason === null ? undefined : reasonId}
            onClick={() => onSearch(draft)}
          >
            {t.actions.search}
          </Button>
          <Button variant="outlined" onClick={onReset}>
            {t.actions.reset}
          </Button>
        </div>
      </div>
    </div>
  );
};
