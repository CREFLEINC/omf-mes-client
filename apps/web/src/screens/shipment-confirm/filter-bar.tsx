import { Button, DatePicker, Select } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { isUsable, type ConfirmFilters, type SortKey } from './filters';

const t = messages.shipmentConfirm.filter;

export interface FilterBarProps {
  applied: ConfirmFilters;
  onApply: (filters: ConfirmFilters) => void;
  onReset: () => void;
}

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'elapsed', label: t.sortOptions.elapsed },
  { value: 'shipDate', label: t.sortOptions.shipDate },
  { value: 'customer', label: t.sortOptions.customer },
];

/**
 * 조회 조건.
 *
 * ⚠ **정렬 기본값이 「경과일 긴 순」이다**(§5-7) — 목록의 관행은 최신순인데 적체 관리 화면에서는
 * **오래된 것이 위험하다.** 왜 그런지를 칸 옆에 상시 둔다.
 */
export const FilterBar = ({ applied, onApply, onReset }: FilterBarProps) => {
  const periodId = useId();
  const periodNoteId = `${periodId}-note`;
  const sortId = useId();
  const sortNoteId = `${sortId}-note`;
  const [draft, setDraft] = useState<ConfirmFilters>(applied);
  const { from, to, sort } = applied;

  useEffect(() => {
    setDraft({ from, to, sort });
  }, [from, to, sort]);

  return (
    <div className="filter-bar">
      <div className="field-cell">
        <label className="field-label" htmlFor={periodId}>
          {t.shipDate}
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
          {isUsable(draft) ? t.periodRequired : t.periodReversed}
        </span>
      </div>

      <div className="field-cell wide-select">
        <label className="field-label" htmlFor={sortId}>
          {t.sort}
        </label>
        <Select
          id={sortId}
          options={SORT_OPTIONS}
          value={draft.sort}
          aria-describedby={sortNoteId}
          onChange={(value) => setDraft((current) => ({ ...current, sort: value as SortKey }))}
        />
        <span id={sortNoteId} className="field-note">
          {t.sortNote}
        </span>
      </div>

      <div className="field-cell field-cell-unlabeled">
        <div className="filter-actions">
          <Button disabled={!isUsable(draft)} onClick={() => onApply(draft)}>
            {t.search}
          </Button>
          <Button variant="outlined" onClick={onReset}>
            {t.reset}
          </Button>
        </div>
      </div>
    </div>
  );
};
