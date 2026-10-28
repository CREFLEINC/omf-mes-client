import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

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

const PRESETS: readonly CreatedPreset[] = ['week', 'month'];

/**
 * 송신 예정의 생성일 조건 — 「전체 · 최근 1주일 · 최근 1개월」은 누르는 즉시 걸고, 날짜 두 칸은 「조회」로 건다.
 * 걸린 범위가 바로 고르는 범위와 같으면 그 단추가 눌린 채로 선다.
 */
export const CreatedFilter = ({ applied, today, onApply }: CreatedFilterProps) => {
  const fieldId = useId();
  const reasonId = useId();
  const [draft, setDraft] = useState<PeriodInput>(applied ?? { from: '', to: '' });

  // 단추 · 뒤로가기로 걸린 기간이 바뀌면 날짜 칸도 따라간다.
  const appliedFrom = applied?.from ?? '';
  const appliedTo = applied?.to ?? '';
  useEffect(() => {
    setDraft({ from: appliedFrom, to: appliedTo });
  }, [appliedFrom, appliedTo]);

  const active = presetOf(applied, today);
  /* 칸이 둘 다 비어 있으면 조회 단추를 잠그고, 하나만 찼거나 거꾸로면 그 사유를 낸다. */
  const isBlank = draft.from === '' && draft.to === '';
  const reason = isBlank ? null : validatePeriod(draft);

  return (
    <form
      className="filter-bar erp-send-created"
      aria-label={t.created.label}
      onSubmit={(event) => {
        event.preventDefault();
        if (!isBlank && reason === null) onApply(draft);
      }}
    >
      <div className="field-cell">
        <span className="field-label">{t.created.label}</span>
        <div className="filter-actions" role="group" aria-label={t.created.presets}>
          <Button
            variant={applied === null ? 'filled' : 'outlined'}
            size="sm"
            aria-pressed={applied === null}
            onClick={() => {
              onApply(null);
            }}
          >
            {t.created.all}
          </Button>
          {PRESETS.map((preset) => (
            <Button
              key={preset}
              variant={active === preset ? 'filled' : 'outlined'}
              size="sm"
              aria-pressed={active === preset}
              onClick={() => {
                onApply(presetPeriod(preset, today));
              }}
            >
              {t.created[preset]}
            </Button>
          ))}
        </div>
      </div>
      <TextField
        id={`${fieldId}-from`}
        type="date"
        label={t.created.from}
        value={draft.from}
        onChange={(event) => {
          setDraft((current) => ({ ...current, from: event.target.value }));
        }}
      />
      <TextField
        id={`${fieldId}-to`}
        type="date"
        label={t.created.to}
        value={draft.to}
        onChange={(event) => {
          setDraft((current) => ({ ...current, to: event.target.value }));
        }}
      />
      <div className="field-cell field-cell-unlabeled">
        <div className="filter-actions">
          <Button
            type="submit"
            size="sm"
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
  );
};
