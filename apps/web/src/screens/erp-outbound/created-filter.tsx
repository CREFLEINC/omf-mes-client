import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { Select } from '../../patterns/select';
import { validatePeriod, type PeriodInput } from '../integration-sync/period';
import { presetOf, presetPeriod, type CreatedPreset } from './created-period';

const t = messages.erpOutbound;

export interface CreatedFilterProps {
  /** 걸린 기간. 없으면 전체다. */
  applied: PeriodInput | null;
  /** 바로 고르는 범위의 기준일 — 화면이 한 번 만들어 넘긴다. */
  today: Date;
  onApply: (period: PeriodInput | null) => void;
}

/** 선택칸의 값 — 전체 · 바로 고르는 범위 · 직접 지정. */
type CreatedChoice = 'all' | CreatedPreset | 'custom';

const choiceOf = (applied: PeriodInput | null, today: Date): CreatedChoice =>
  applied === null ? 'all' : (presetOf(applied, today) ?? 'custom');

/**
 * 송신 대기의 등록일 조건 — 선택칸 하나로 「전체 · 최근 1주일 · 최근 1개월 · 직접 지정」을 고른다(사용자 지시 2026-11-24,
 * 종전 단추 셋). 범위를 고르면 바로 걸고, 「직접 지정」이면 날짜 두 칸과 [조회]가 나타나 [조회]로 건다.
 */
export const CreatedFilter = ({ applied, today, onApply }: CreatedFilterProps) => {
  const fieldId = useId();
  const reasonId = useId();
  const appliedChoice = choiceOf(applied, today);
  const [choice, setChoice] = useState<CreatedChoice>(appliedChoice);
  const [draft, setDraft] = useState<PeriodInput>(applied ?? { from: '', to: '' });

  // 뒤로가기 등으로 걸린 기간이 바뀌면 선택칸 · 날짜 칸도 따라간다.
  const appliedFrom = applied?.from ?? '';
  const appliedTo = applied?.to ?? '';
  useEffect(() => {
    setChoice(appliedChoice);
    setDraft({ from: appliedFrom, to: appliedTo });
  }, [appliedFrom, appliedTo]);

  /* 칸이 둘 다 비어 있으면 조회 단추를 잠그고, 하나만 찼거나 거꾸로면 그 사유를 낸다. */
  const isBlank = draft.from === '' && draft.to === '';
  const reason = isBlank ? null : validatePeriod(draft, t.created.reasons);

  return (
    /* 등록일 조건은 조회 상자로 감싼다(사용자 지시 2026-11-24 「박스 입혀」). */
    <div className="pane po-board-filter erp-send-created-box">
      <form
        className="filter-bar erp-send-created"
        aria-label={t.created.label}
        onSubmit={(event) => {
          event.preventDefault();
          if (!isBlank && reason === null) onApply(draft);
        }}
      >
        <div className="field-cell">
          <label className="field-label" htmlFor={`${fieldId}-range`}>
            {t.created.label}
          </label>
          <Select
            id={`${fieldId}-range`}
            value={choice}
            options={[
              { value: 'all', label: t.created.all },
              { value: 'week', label: t.created.week },
              { value: 'month', label: t.created.month },
              { value: 'custom', label: t.created.custom },
            ]}
            onChange={(value) => {
              const next = value as CreatedChoice;
              setChoice(next);
              if (next === 'all') onApply(null);
              else if (next !== 'custom') onApply(presetPeriod(next, today));
            }}
          />
        </div>
        {/* 시작일 · 종료일 · 조회는 늘 보인다 — 고른 기간이 날짜 칸에 채워지고, 날짜를 고치면 「직접 지정」이 된다. */}
        <TextField
          id={`${fieldId}-from`}
          type="date"
          label={t.created.from}
          value={draft.from}
          onChange={(event) => {
            setChoice('custom');
            setDraft((current) => ({ ...current, from: event.target.value }));
          }}
        />
        <TextField
          id={`${fieldId}-to`}
          type="date"
          label={t.created.to}
          value={draft.to}
          onChange={(event) => {
            setChoice('custom');
            setDraft((current) => ({ ...current, to: event.target.value }));
          }}
        />
        <div className="field-cell field-cell-unlabeled">
          <div className="filter-actions">
            <Button
              type="submit"
              disabled={isBlank || reason !== null}
              aria-describedby={reason === null ? undefined : reasonId}
            >
              {messages.common.search}
            </Button>
          </div>
          {reason !== null && (
            <span id={reasonId} className="field-note">
              {reason}
            </span>
          )}
        </div>
      </form>
    </div>
  );
};
