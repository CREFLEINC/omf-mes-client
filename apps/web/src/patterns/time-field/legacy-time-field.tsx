import { Icon } from '@crefle/web-ui';
import { useEffect, useId, useRef, useState } from 'react';

import type { TimeFieldLabels } from './time-field';

const twoDigits = (count: number): string[] =>
  Array.from({ length: count }, (_, index) => String(index).padStart(2, '0'));

const HOURS = twoDigits(24);
const MINUTES = twoDigits(60);

export interface LegacyTimeFieldProps {
  labels: TimeFieldLabels;
  /** `00`~`23`. 고르지 않았으면 빈 문자열. */
  hour: string;
  /** `00`~`59`. 고르지 않았으면 빈 문자열. */
  minute: string;
  /** 시·분을 다 골랐을 때 한 번 부른다. */
  onChange: (hour: string, minute: string) => void;
  disabled: boolean;
  invalid: boolean;
  describedBy?: string;
  /** 고를 수 없는 시각(`HH:MM`) — 그 시의 그 분 칸만 잠근다. 주지 않으면 모두 고를 수 있다. */
  blockedTimes?: readonly string[];
}

/**
 * 종전 시각 선택칸 — 품질 관리 화면 본문(팝업 · 서랍 밖)은 팝업 디자인 시안(omf-all-around#360) 전 모양 · 동작을
 * 그대로 둔다(사용자 지시 2026-11-27 「품질은 팝업 외에 건들면 안됐어」). 새 시각 칸은 `TimeField`.
 *
 * 칸 하나를 누르면 날짜 선택처럼 팝오버 하나가 열리고, 그 안의 시(00~23)·분(00~59) 두 열에서
 * 한 번에 고른다(담당자 지시). 시를 고르고 분을 고르면 값이 정해지고 닫힌다. 바깥을 누르거나 Esc 면 고르던 것을 버리고 닫힌다.
 *
 * 디자인 시스템에 시각 선택·팝오버 부품이 없어 공용 패턴으로 둔다(입고 · 부품 IQC) — 모양은 DS 토큰으로 `Select` 와 맞춘다(`app.css`).
 * 열면 지금 값(없으면 맨 위)이 보이게 각 열을 굴린다. 아래 자리가 모자라면 위로 연다.
 */
export const LegacyTimeField = ({
  labels,
  hour,
  minute,
  onChange,
  disabled,
  invalid,
  describedBy,
  blockedTimes,
}: LegacyTimeFieldProps) => {
  const popupId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setOpen] = useState(false);
  const [opensUp, setOpensUp] = useState(false);
  /** 열려 있는 동안 고르는 중인 시 — 분까지 골라야 값이 된다. */
  const [draftHour, setDraftHour] = useState(hour);

  const hasValue = hour !== '' && minute !== '';

  const close = (): void => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const open = (): void => {
    const trigger = triggerRef.current;

    if (trigger !== null) {
      /* 팝오버 높이(열 6행 + 머리) 만큼 아래가 비어 있지 않으면 위로 연다. */
      const rect = trigger.getBoundingClientRect();
      setOpensUp(rect.bottom + 320 > window.innerHeight && rect.top > 320);
    }
    setDraftHour(hour);
    setOpen(true);
  };

  /* 바깥을 누르면 닫는다. */
  useEffect(() => {
    if (!isOpen) return undefined;

    const onPointerDown = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [isOpen]);

  /* 열면 고른 값(없으면 맨 위)이 보이게 각 열을 굴리고, 시 열의 그 칸에 포커스를 둔다. */
  useEffect(() => {
    if (!isOpen) return;

    const root = rootRef.current;

    root?.querySelectorAll<HTMLElement>('.time-picker-legacy-column').forEach((column) => {
      const selected = column.querySelector<HTMLElement>('[aria-selected="true"]');

      column.scrollTop = selected === null ? 0 : selected.offsetTop - column.clientHeight / 2;
    });
    (
      root?.querySelector<HTMLElement>('[data-column="hour"] [aria-selected="true"]') ??
      root?.querySelector<HTMLElement>('[data-column="hour"] [role="option"]')
    )?.focus();
  }, [isOpen]);

  const column = (
    kind: 'hour' | 'minute',
    values: string[],
    selected: string,
    onPick: (value: string) => void,
  ) => (
    <div className="time-picker-legacy-column-wrap">
      <span className="time-picker-legacy-column-label" aria-hidden="true">
        {kind === 'hour' ? labels.hourHead : labels.minuteHead}
      </span>
      <div
        role="listbox"
        aria-label={kind === 'hour' ? labels.hourList : labels.minuteList}
        className="time-picker-legacy-column"
        data-column={kind}
      >
        {values.map((value) => (
          <button
            key={value}
            type="button"
            role="option"
            aria-selected={value === selected}
            /*
             * 분은 시를 고른 뒤에 고른다 — 시가 없으면 분 칸은 잠긴다. `disabled` 대신 `aria-disabled` 로 잠근다:
             * 입력 칸 묶음의 «아직 열리지 않은 칸» 표시(`:has(:disabled)`)가 이 칸까지 흐리게 만들지 않게.
             */
            aria-disabled={
              kind === 'minute' &&
              (draftHour === '' || blockedTimes?.includes(`${draftHour}:${value}`) === true)
                ? true
                : undefined
            }
            className="time-picker-legacy-option"
            onClick={() => {
              if (kind === 'minute' && draftHour === '') return;
              if (kind === 'minute' && blockedTimes?.includes(`${draftHour}:${value}`) === true)
                return;

              onPick(value);
            }}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className="time-picker">
      <button
        ref={triggerRef}
        type="button"
        className="time-picker-legacy-trigger"
        aria-label={labels.field}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? popupId : undefined}
        aria-required
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        data-open={isOpen || undefined}
        data-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => {
          if (isOpen) setOpen(false);
          else open();
        }}
      >
        <span className={hasValue ? undefined : 'time-picker-legacy-placeholder'}>
          {hasValue ? `${hour}:${minute}` : labels.placeholder}
        </span>
        <Icon name="schedule" size={20} />
      </button>

      {isOpen && (
        <div
          id={popupId}
          role="dialog"
          aria-label={labels.field}
          className="time-picker-legacy-popup"
          data-placement={opensUp ? 'up' : 'down'}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              close();
            }
          }}
        >
          {column('hour', HOURS, draftHour, setDraftHour)}
          {column('minute', MINUTES, draftHour === hour ? minute : '', (value) => {
            onChange(draftHour, value);
            close();
          })}
        </div>
      )}
    </div>
  );
};
