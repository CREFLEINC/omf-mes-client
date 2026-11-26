import { Button, Chip, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { validatePeriod, type PeriodInput } from '../integration-sync/period';
import { presetOf, presetPeriod, type CreatedPreset } from './created-period';

const t = messages.erpOutbound;

export interface CreatedFilterProps {
  /** 제목 줄 왼쪽의 소제목 — 오른쪽 끝에 범위 라벨을 둔다. */
  title: string;
  /** 걸린 기간. 없으면 전체다. */
  applied: PeriodInput | null;
  /** 바로 고르는 범위의 기준일 — 화면이 한 번 만들어 넘긴다. */
  today: Date;
  onApply: (period: PeriodInput | null) => void;
}

/** 고른 조건 — 전체 · 바로 고르는 범위(라벨) · 직접 지정(날짜 칸을 고친 상태). */
type CreatedChoice = 'all' | CreatedPreset | 'custom';

const choiceOf = (applied: PeriodInput | null, today: Date): CreatedChoice =>
  applied === null ? 'all' : (presetOf(applied, today) ?? 'custom');

const PRESETS: readonly CreatedPreset[] = ['week', 'month'];

/**
 * 송신 대기의 등록일 조건 — 소제목 줄 오른쪽 끝의 라벨 「최근 1주일 · 최근 1개월」과 조회 상자의 날짜 두 칸(사용자 지시
 * 2026-11-25, 종전 선택칸). 라벨을 누르면 바로 걸고, 고른 라벨을 다시 누르면 전체로 돌아간다. 날짜 칸은 [조회]로 건다.
 */
export const CreatedFilter = ({ title, applied, today, onApply }: CreatedFilterProps) => {
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
    <>
      <div className="pane-heading-row erp-outbound-pending-head">
        <h3 className="pane-title">{title}</h3>
        <div className="filter-chips" role="group" aria-label={t.created.label}>
          {PRESETS.map((preset) => (
            <Chip
              key={preset}
              variant="filter"
              size="sm"
              selected={choice === preset}
              aria-pressed={choice === preset}
              onSelectedChange={() => {
                if (choice === preset) {
                  setChoice('all');
                  onApply(null);
                } else {
                  setChoice(preset);
                  onApply(presetPeriod(preset, today));
                }
              }}
            >
              {t.created[preset]}
            </Chip>
          ))}
        </div>
      </div>
      {/* 등록일 조건은 조회 상자로 감싼다(사용자 지시 2026-11-24 「박스 입혀」). */}
      <div className="pane po-board-filter erp-send-created-box">
        <form
          className="filter-bar erp-send-created"
          aria-label={t.created.label}
          onSubmit={(event) => {
            event.preventDefault();
            if (!isBlank && reason === null) onApply(draft);
          }}
        >
          {/* 시작일 · 종료일 · 조회는 늘 보인다 — 고른 기간이 날짜 칸에 채워지고, 날짜를 고치면 라벨 선택이 풀린다. */}
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
    </>
  );
};
