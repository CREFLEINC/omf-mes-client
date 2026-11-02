import { Button, DatePicker, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { Select } from '../../patterns/select';
import type { HistoryFilters } from './filters';
import type { FilterOption } from './lot-filter-bar';
import { validateHistoryPeriod, type HistoryPeriodError } from './period';

const t = messages.lotStatusHistory;

const periodReason = (error: HistoryPeriodError | null): string | null => {
  switch (error) {
    /* 날짜를 비운 경우는 [조회]만 잠그고 문구는 두지 않는다(사용자 2026-11-02). */
    case 'missing':
      return null;
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
  const fromId = useId();
  const toId = useId();
  const actorId = useId();
  const actorNoteId = useId();
  const reasonId = useId();
  const [draft, setDraft] = useState(appliedFilters);
  const { from: appliedFrom, to: appliedTo, actor: appliedActor, lot: appliedLot } = appliedFilters;

  useEffect(() => {
    setDraft({ from: appliedFrom, to: appliedTo, actor: appliedActor, lot: appliedLot });
  }, [appliedActor, appliedFrom, appliedLot, appliedTo]);

  const periodError = validateHistoryPeriod({ from: draft.from, to: draft.to });
  /* 조회를 막는 까닭 — 날짜를 비웠으면 문구 없이 잠그기만 한다. */
  const reason = periodReason(periodError);
  const hasAppliedActor = actorOptions.some((option) => option.value === appliedActor);
  const visibleActorOptions =
    appliedActor !== '' && !hasAppliedActor
      ? [...actorOptions, { value: appliedActor, label: t.historyFilter.actorUnknownOption }]
      : actorOptions;

  return (
    <div className="filter-bar lot-status-filter">
      {/*
       * 기간은 시작일 · 종료일 두 칸으로 나눈다 — 처음에는 둘 다 오늘(사용자 2026-11-02). 종료가 시작보다 앞서면
       * 종료일 칸 아래에 알린다.
       */}
      <div className="field-cell lot-status-filter-date">
        <label className="field-label" htmlFor={fromId}>
          {t.historyFilter.fields.from}
        </label>
        <DatePicker
          id={fromId}
          value={draft.from === '' ? null : draft.from}
          onChange={(from) => setDraft((current) => ({ ...current, from }))}
        />
      </div>
      <div className="field-cell lot-status-filter-date">
        <label className="field-label" htmlFor={toId}>
          {t.historyFilter.fields.to}
        </label>
        <DatePicker
          id={toId}
          value={draft.to === '' ? null : draft.to}
          onChange={(to) => setDraft((current) => ({ ...current, to }))}
          aria-describedby={reason === null ? undefined : reasonId}
        />
        {reason !== null && (
          <span id={reasonId} className="field-error" role="alert">
            {reason}
          </span>
        )}
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
      {/* LOT 번호 — LOT 상태 묶음 네 탭과 같은 검색 칸(사용자 2026-10-30). Enter 는 [조회]와 같다. */}
      <SearchInput
        containerClassName="lot-status-filter-lot-no"
        label={t.lotFilter.lotScanLabel}
        placeholder={t.lotFilter.lotNoScanPlaceholder}
        value={draft.lot}
        onChange={(event) => setDraft((current) => ({ ...current, lot: event.target.value }))}
        onSearch={() => {
          if (periodError === null) onSearch(draft);
        }}
        clearLabel={messages.common.clear}
      />
      {/* 조회·초기화는 조건과 같은 줄 끝에 한 덩어리로 — 검사 조회·판정처럼 [조회](주 동작) → [초기화](사용자 2026-10-30). */}
      <div className="filter-actions field-cell-unlabeled lot-status-filter-actions">
        <Button
          variant="filled"
          disabled={periodError !== null}
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
  );
};
