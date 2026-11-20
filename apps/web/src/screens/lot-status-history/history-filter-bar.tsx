import { Button, DatePicker, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import {
  FilterMoreButton,
  HiddenFilterChips,
  hasChangedFilters,
  useFilterMore,
} from '../../patterns/filter-more';
import { Select } from '../../patterns/select';
import { initialHistoryFilters, type HistoryFilters } from './filters';
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
  /* 처리자는 「조건 더보기」로 접는다(C-6) — 늘 접힌 채로 들어오고, 걸린 처리자는 아래 칩으로 알린다. */
  const more = useFilterMore();
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
  /* 접힌 처리자 칩 — 값은 펼친 칸이 보이는 글자와 같다(목록에 없으면 「이름 확인 불가」). */
  const actorLabel = t.historyFilter.fields.actor;
  const actorValue =
    visibleActorOptions.find((option) => option.value === appliedActor)?.label ?? '';
  const hiddenChips =
    appliedActor === ''
      ? []
      : [
          {
            key: 'actor' as const,
            label: `${actorLabel}: ${actorValue}`,
            removeLabel: messages.common.filterMore.remove(actorLabel),
          },
        ];

  /* 「초기화」는 바뀐 것이 있을 때만(C-6) — 편집 중인 값이나 조회에 쓰인 값이 처음 값(오늘 · 오늘)과 다를 때. */
  const initial = initialHistoryFilters();
  const isChanged = hasChangedFilters(initial, draft, appliedFilters);
  /* 편집 상태도 함께 처음으로 — 조회에 쓰인 값이 이미 처음 값이면 주소가 바뀌지 않아 되돌림이 깨어나지 않는다. */
  const reset = (): void => {
    setDraft(initial);
    onReset();
  };

  return (
    <>
      <div className="filter-bar lot-status-filter lot-status-history-filter">
        {/*
         * 기간 — 「기간」 한 이름 아래 [시작일] ~ [종료일] 두 달력 칸(출하 일정 조회와 같은 디자인 시스템 짜임 ·
         * 사용자 2026-11-02). 처음에는 둘 다 오늘. 종료가 시작보다 앞서면 종료일 칸에 붉은 테두리와 아래 알림.
         */}
        <div className="field-cell" role="group" aria-label={t.historyFilter.fields.period}>
          {/* 「기간」 한 이름 대신 칸마다 「조회 시작일」 · 「조회 종료일」(omf-all-around#228). */}
          <div className="lot-status-date-range-row">
            <div className="field-cell lot-status-date-cell">
              <span className="field-label" aria-hidden="true">
                {t.historyFilter.fields.fromLabel}
              </span>
              <DatePicker
                className="lot-status-date-field"
                aria-label={t.historyFilter.fields.fromLabel}
                placeholder={t.historyFilter.fields.from}
                invalid={draft.from === ''}
                value={draft.from === '' ? null : draft.from}
                onChange={(from) => setDraft((current) => ({ ...current, from }))}
              />
            </div>
            <div className="field-cell lot-status-date-cell">
              <span className="field-label" aria-hidden="true">
                {t.historyFilter.fields.toLabel}
              </span>
              <DatePicker
                className="lot-status-date-field"
                aria-label={t.historyFilter.fields.toLabel}
                placeholder={t.historyFilter.fields.to}
                invalid={draft.to === '' || reason !== null}
                value={draft.to === '' ? null : draft.to}
                onChange={(to) => setDraft((current) => ({ ...current, to }))}
                aria-describedby={reason === null ? undefined : reasonId}
              />
            </div>
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
          {isChanged && (
            <Button variant="outlined" onClick={reset}>
              {t.actions.reset}
            </Button>
          )}
          <FilterMoreButton open={more.isOpen} controlsId={more.id} onToggle={more.toggle} />
        </div>
      </div>
      {/*
       * 행위자는 「조건 더보기」로 접어 둔다(LOT 현황과 같다 · 사용자 2026-11-02 · C-6).
       * `hidden` 은 감싸는 상자에 둔다 — `.filter-bar` 의 display 가 속성을 덮는다.
       */}
      <div id={more.id} hidden={!more.isOpen}>
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
      <HiddenFilterChips
        open={more.isOpen}
        chips={hiddenChips}
        onRemove={() => onSearch({ ...appliedFilters, actor: '' })}
      />
    </>
  );
};
