import { Button, Chip, DatePicker, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { hasChangedFilters } from '../../patterns/filter-more';

import { isUsable, type ConfirmFilters, type ErpFilter } from './filters';
import { ERP_SEND_STATUSES } from './types';

const t = messages.shipmentConfirm;

export interface FilterBarProps {
  applied: ConfirmFilters;
  /** 처음 값(최근 한 달) — 「초기화」가 되돌리는 값이고, 이 값과 다를 때만 「초기화」가 보인다. */
  defaults: ConfirmFilters;
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
 *
 * 보이는 조건은 셋(기간 · 검색어 · ERP 송신)이라 「조건 더보기」가 없다(C-6). 「초기화」는 바뀐 것이
 * 있을 때만 보인다. ERP 송신 칩은 조회 단추 다음 줄에 둔다 — 칩 줄이 길어 한 줄에 함께 두면 「초기화」가
 * 나타나는 순간 단추가 다음 줄로 튄다. 건수를 아는데 0 건인 칩은 세우지 않는다(고른 칩과 「전체」는 남긴다).
 */
export const FilterBar = ({
  applied,
  defaults,
  counts = null,
  onApply,
  onReset,
}: FilterBarProps) => {
  const periodId = useId();
  const periodNoteId = `${periodId}-note`;
  const [draft, setDraft] = useState<ConfirmFilters>(applied);

  useEffect(() => {
    setDraft(applied);
  }, [applied]);

  /* 편집 중인 값도 처음 값으로 되돌린다 — 조회한 값이 이미 처음 값이면 되돌림 effect 가 깨어나지 않는다. */
  const reset = (): void => {
    setDraft(defaults);
    onReset();
  };

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

      <div className="field-cell field-cell-unlabeled">
        <div className="filter-actions">
          <Button disabled={!isUsable(draft)} onClick={() => onApply(draft)}>
            {t.filter.search}
          </Button>
          {hasChangedFilters(defaults, draft, applied) && (
            <Button variant="outlined" onClick={reset}>
              {t.filter.reset}
            </Button>
          )}
        </div>
      </div>
      <div className="field-cell ship-history-erp">
        <span className="field-label" id={`${periodId}-erp`}>
          {t.filter.erp}
        </span>
        <div className="ship-history-chips" role="group" aria-labelledby={`${periodId}-erp`}>
          {ERP_FILTERS.filter(
            (value) =>
              counts === null ||
              value === 'all' ||
              value === draft.erp ||
              value === applied.erp ||
              (counts[value] ?? 0) > 0,
          ).map((value) => (
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
    </div>
  );
};
