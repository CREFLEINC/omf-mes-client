import { messages } from '@omf-mes/i18n';
import { useId, useState, type ReactNode } from 'react';

import { PopSelect } from '../../patterns/pop-select';
import {
  PuButton,
  PuField,
  PuInput,
  PuNote,
  PuSection,
  PuTextKeyboard,
} from '../../patterns/pop-uniform';
import type { HoldDraft } from './hold-draft';
import type { HoldReasonsResult } from './reason-options';

const t = messages.workHoldRegister;

export interface HoldFormProps {
  draft: HoldDraft;
  disabled: boolean;
  reasons: HoldReasonsResult;
  /** 고를 수 없는 값으로 등록을 눌렀을 때 뜨는 말. 누르기 전에는 `null`이다. */
  error: string | null;
  onReasonChange: (code: string) => void;
  onRemarksChange: (remarks: string) => void;
  /** 구획 맨 위 안내 줄(작업지시 없음 · 세션 없음 · 미전송 · 거부 등). */
  notes?: ReactNode;
}

/**
 * 《중단 등록》 구획의 입력(스펙 §3 · §4-A · POP 통일 시안 #295).
 *
 * ⭐ **사유는 칸을 눌러 선택 창으로 고른다**(시안 규칙 7) — 사유가 7가지라 한 줄씩 늘어선 동그라미 대신
 *    칸 하나 + 선택 창이다. 목록은 서버가 준다(2026-09-06 개정) — 고객이 사유를 늘린다.
 *
 * ⚠ **조작은 이 구획이 갖지 않는다** — 화면 바닥의 작업 줄이 갖는다.
 */
export const HoldForm = ({
  draft,
  disabled,
  reasons,
  error,
  onReasonChange,
  onRemarksChange,
  notes,
}: HoldFormProps) => {
  const reasonId = useId();
  const remarksId = useId();
  const labelId = useId();
  /* 비고 칸을 누르면 칸 바로 아래에 글자판을 연다(사용자 지시 2026-11-19 · 이 화면은 키패드 자리가 없다). */
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const reasonEmpty = !reasons.isLoading && !reasons.isError && reasons.reasons.length === 0;

  return (
    <PuSection title={t.form.sectionLabel} labelId={labelId}>
      {notes}

      {/*
       * ⛔ **못 받은 것을 빈 목록으로 그리지 않는다.** 「고를 것이 없다」와 「받지 못했다」는
       * 작업자가 할 일이 다르다 — 앞은 마스터를 채워야 하고 뒤는 다시 받아 보면 된다.
       */}
      {!reasons.isLoading && reasons.isError && (
        <PuNote
          tone="bad"
          action={
            <PuButton size="sm" onClick={reasons.refetch}>
              {t.errors.retry}
            </PuButton>
          }
        >
          {t.form.reasonLoadFailed}
        </PuNote>
      )}
      {reasonEmpty && <PuNote tone="warn">{t.form.reasonEmpty}</PuNote>}
      {/*
       * ⚠ **다 받지 못한 것을 「없다」로 읽히게 두지 않는다** — 찾는 사유가 안 보이면 현장은 「기타」로
       * 몰아 적는다. 그 기록은 정정 경로가 없다.
       */}
      {reasons.truncated && <PuNote tone="warn">{t.form.reasonTruncated}</PuNote>}
      {/* ⚠ 받아 둔 목록으로 그렸다는 사실을 말한다(#1005) — 숨기면 작업자는 목록이 최신이라고 믿는다. */}
      {reasons.fromCache && <PuNote tone="warn">{t.form.reasonFromCache}</PuNote>}

      {/* 글자판이 열린 동안은 사유·비고를 한 줄에 나란히 둔다 — 1024×768 에서도 구획 안에 들어가게. */}
      <div className={keyboardOpen && !disabled ? 'wh-fields is-kbd' : 'wh-fields'}>
        <PuField label={t.form.reasonLabel} required htmlFor={reasonId}>
          <PopSelect
            id={reasonId}
            aria-label={t.form.reasonLabel}
            placeholder={reasons.isLoading ? t.form.reasonLoading : t.form.reasonPlaceholder}
            /*
             * ⛔ **고른 값에 `undefined` 를 주지 않는다** — 비제어로 돌면 등록 뒤 초안을 비워도 화면에는
             * 고른 표시가 남는다. `null` 이라야 「고른 것이 없다」로 제어된다.
             */
            value={draft.reasonCode ?? null}
            options={reasons.reasons.map((reason) => ({ value: reason.code, label: reason.name }))}
            disabled={disabled || reasons.isLoading || reasons.reasons.length === 0}
            invalid={!disabled && draft.reasonCode === null}
            onChange={onReasonChange}
          />
        </PuField>

        {error !== null && <PuNote tone="bad">{error}</PuNote>}

        {/*
         * ⭐ **비고는 W/O 중단 본문**(`WorkOrderHold.note`)이 받는다(2026-09-06 게이트 승인).
         * ⛔ **재개에는 이 값을 싣지 않는다** — 스펙 §3 도면이 《중단 등록》 구획에만 그린다.
         */}
        <PuField label={t.form.remarksLabel} optional={t.form.optional} htmlFor={remarksId}>
          <div className="pu-row">
            <PuInput
              id={remarksId}
              value={draft.remarks}
              disabled={disabled}
              autoComplete="off"
              target={keyboardOpen && !disabled}
              onFocus={() => {
                setKeyboardOpen(true);
              }}
              onBlur={() => {
                setKeyboardOpen(false);
              }}
              onChange={(event) => {
                onRemarksChange(event.target.value);
              }}
            />
          </div>
        </PuField>
      </div>
      {keyboardOpen && !disabled && (
        /* 글자판의 빈 곳·꺼진 키를 눌러도 칸에서 초점이 빠져 닫히지 않게 한다. */
        <div
          className="wh-kbd"
          onMouseDown={(event) => {
            event.preventDefault();
          }}
        >
          <PuTextKeyboard value={draft.remarks} onChange={onRemarksChange} />
        </div>
      )}
    </PuSection>
  );
};
