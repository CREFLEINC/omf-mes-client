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
  const periodLabelId = useId();
  const detailId = useId();
  const [isDetailOpen, setIsDetailOpen] = useState(appliedFilters.actor !== '');
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
    <>
      <div className="filter-bar lot-status-filter lot-status-history-filter">
        {/*
         * 기간 — 「기간」 한 이름 아래 [시작일] ~ [종료일] 두 달력 칸(출하 일정 조회와 같은 디자인 시스템 짜임 ·
         * 사용자 2026-11-02). 처음에는 둘 다 오늘. 종료가 시작보다 앞서면 종료일 칸에 붉은 테두리와 아래 알림.
         */}
        <div className="field-cell" role="group" aria-labelledby={periodLabelId}>
          <span className="field-label" id={periodLabelId}>
            {t.historyFilter.fields.period}
          </span>
          <div className="lot-status-date-range-row">
            <DatePicker
              className="lot-status-date-field"
              aria-label={t.historyFilter.fields.from}
              placeholder={t.historyFilter.fields.from}
              invalid={draft.from === ''}
              value={draft.from === '' ? null : draft.from}
              onChange={(from) => setDraft((current) => ({ ...current, from }))}
            />
            <DatePicker
              className="lot-status-date-field"
              aria-label={t.historyFilter.fields.to}
              placeholder={t.historyFilter.fields.to}
              invalid={draft.to === '' || reason !== null}
              value={draft.to === '' ? null : draft.to}
              onChange={(to) => setDraft((current) => ({ ...current, to }))}
              aria-describedby={reason === null ? undefined : reasonId}
            />
          </div>
          {reason !== null && (
            <span id={reasonId} className="field-error" role="alert">
              {reason}
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
          <Button
            variant="text"
            size="sm"
            aria-expanded={isDetailOpen}
            aria-controls={detailId}
            onClick={() => setIsDetailOpen((open) => !open)}
          >
            {isDetailOpen ? t.lotFilter.detailClose : t.lotFilter.detailOpen}
          </Button>
        </div>
      </div>
      {/*
       * 행위자는 상세 조건으로 접어 둔다 — 걸린 행위자가 있으면 펼친 채로 들어온다(LOT 현황과 같다 · 사용자 2026-11-02).
       * `hidden` 은 감싸는 상자에 둔다 — `.filter-bar` 의 display 가 속성을 덮는다.
       */}
      <div id={detailId} hidden={!isDetailOpen}>
        <div className="filter-bar lot-status-filter lot-status-history-filter">
          <div className="field-cell lot-status-history-actor">
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
        </div>
      </div>
    </>
  );
};
