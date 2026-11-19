import { Button, Chip, DatePicker, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { isUsable, type ConfirmFilters, type ErpFilter } from './filters';
import { ERP_SEND_STATUSES } from './types';

const t = messages.shipmentConfirm;

export interface FilterBarProps {
  applied: ConfirmFilters;
  /** 적용된 조건의 ERP 송신 상태별 건수 — 없으면 칩에 수를 붙이지 않는다(시안 「대기 2」). */
  counts?: Readonly<Record<string, number>> | null;
  onApply: (filters: ConfirmFilters) => void;
  onReset: () => void;
}

const ERP_FILTERS: readonly ErpFilter[] = ['all', ...ERP_SEND_STATUSES];

const erpLabel = (value: ErpFilter): string => (value === 'all' ? t.filter.all : t.erp[value]);

/** 칩 글자 — 건수를 알면 「대기 2」, 「전체」는 상태별 합. */
const chipLabel = (value: ErpFilter, counts: Readonly<Record<string, number>> | null): string => {
  if (counts === null) return erpLabel(value);
  const count =
    value === 'all'
      ? Object.values(counts).reduce((sum, one) => sum + one, 0)
      : (counts[value] ?? 0);
  return t.filter.chip(erpLabel(value), count);
};

/**
 * 조회 조건 — 기간 · 출하번호 · ERP 송신(피처 010).
 *
 * ⭐ ERP 송신 거르기는 칩 한 줄이다(시안 W0412-After) — 6값이 한눈에 보여야 「송신 오류」처럼
 * 손이 가야 할 건이 숨지 않는다. 칩을 눌러도 바로 조회하지 않고 [조회]로 확정한다(다른 조건과 같다).
 *
 * 기본 정렬은 경과일 긴 순 그대로다(§5-7) — 계약이 방향을 받지 않아 선택지를 두지 않는다.
 */
export const FilterBar = ({ applied, counts = null, onApply, onReset }: FilterBarProps) => {
  const periodId = useId();
  const periodNoteId = `${periodId}-note`;
  const [draft, setDraft] = useState<ConfirmFilters>(applied);

  useEffect(() => {
    setDraft(applied);
  }, [applied]);

  return (
    <div className="filter-bar ship-history-filter">
      <div className="field-cell">
        <label className="field-label" htmlFor={periodId}>
          {t.filter.period}
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
        <span id={periodNoteId} className="field-note">
          {isUsable(draft) ? t.filter.periodRequired : t.filter.periodReversed}
        </span>
      </div>

      <div className="field-cell">
        <TextField
          label={t.filter.q}
          value={draft.q}
          placeholder={t.filter.qPlaceholder}
          onChange={(event) => {
            const q = event.target.value;
            setDraft((current) => ({ ...current, q }));
          }}
        />
      </div>

      <div className="field-cell">
        <span className="field-label" id={`${periodId}-erp`}>
          {t.filter.erp}
        </span>
        <div className="ship-history-chips" role="group" aria-labelledby={`${periodId}-erp`}>
          {ERP_FILTERS.map((value) => (
            <Chip
              key={value}
              variant="filter"
              size="sm"
              selected={draft.erp === value}
              onSelectedChange={() => setDraft((current) => ({ ...current, erp: value }))}
            >
              {chipLabel(value, counts)}
            </Chip>
          ))}
        </div>
      </div>

      <div className="field-cell field-cell-unlabeled">
        <div className="filter-actions">
          <Button disabled={!isUsable(draft)} onClick={() => onApply(draft)}>
            {t.filter.search}
          </Button>
          <Button variant="outlined" onClick={onReset}>
            {t.filter.reset}
          </Button>
        </div>
      </div>
    </div>
  );
};
