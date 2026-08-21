import { Button, DatePicker, Select, TextField } from '@crefle/web-ui';
import { useEffect, useId, useState } from 'react';

import type { HistoryFilters } from './filters';
import type { FilterOption } from './lot-filter-bar';
import { validateHistoryPeriod, type HistoryPeriodError } from './period';

const periodReason = (error: HistoryPeriodError | null): string | null => {
  switch (error) {
    case 'missing':
      return '기간을 모두 선택한 뒤 조회할 수 있습니다.';
    case 'invalid':
      return '유효한 기간을 선택해 주세요.';
    case 'reversed':
      return '기간 종료는 시작보다 앞설 수 없습니다.';
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
      ? [...actorOptions, { value: appliedActor, label: '선택한 행위자 (이름 확인 불가)' }]
      : actorOptions;

  return (
    <div className="filter-bar">
      <div className="field-cell">
        <label className="field-label" htmlFor={periodId}>
          기간
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
          행위자
        </label>
        <Select
          id={actorId}
          value={draft.actor}
          placeholder="전체"
          aria-describedby={actorNote === undefined ? undefined : actorNoteId}
          options={[{ value: '', label: '전체' }, ...visibleActorOptions]}
          onChange={(actor) => setDraft((current) => ({ ...current, actor }))}
        />
        {actorNote !== undefined && (
          <span id={actorNoteId} className="field-note">
            {actorNote}
          </span>
        )}
      </div>
      <TextField
        label="LOT"
        value={draft.lot}
        onChange={(event) => setDraft((current) => ({ ...current, lot: event.target.value }))}
      />
      <div className="field-cell field-cell-unlabeled">
        <div className="filter-actions">
          <Button
            disabled={reason !== null}
            aria-describedby={reason === null ? undefined : reasonId}
            onClick={() => onSearch(draft)}
          >
            조회
          </Button>
          <Button variant="outlined" onClick={onReset}>
            초기화
          </Button>
        </div>
        {reason !== null && (
          <span id={reasonId} className="field-note">
            {reason}
          </span>
        )}
      </div>
    </div>
  );
};
