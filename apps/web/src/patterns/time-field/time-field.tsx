import { Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef, useState } from 'react';

const steps = (count: number, step: number): string[] =>
  Array.from({ length: count }, (_, index) => String(index * step).padStart(2, '0'));

const HOURS = steps(24, 1);
/** 고르기 창의 분은 5분 단위 — 그 사이 값은 칸에 직접 친다. */
const MINUTES = steps(12, 5);

const VALID = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * 친 글자를 24시간 `HH:MM` 로 다듬는다 — 없는 시각은 입력 자체를 막는다(사용자 결정 2026-11-26).
 * 시 첫 자리 3~9 는 `0` 을 붙이고(`8` → `08`), 24~29 시·분 십의 자리 6~9 는 받지 않는다. 숫자만 쳐도 `:` 를 넣는다.
 */
export const sanitizeTime = (raw: string): string => {
  let out = '';
  for (const char of raw.replace(/\D/g, '')) {
    const length = out.length;
    if (length === 0) out += char > '2' ? `0${char}` : char;
    else if (length === 1) {
      if (out === '2' && char > '3') continue;
      out += char;
    } else if (length === 2) {
      if (char > '5') continue;
      out += char;
    } else out += char;
    if (out.length >= 4) break;
  }
  return out.length > 2 ? `${out.slice(0, 2)}:${out.slice(2, 4)}` : out;
};

/** 덜 친 값을 칸을 벗어날 때 채운다 — `8` → `08:00`, `08:3` → `08:30`. */
export const completeTime = (text: string): string => {
  let digits = text.replace(/\D/g, '');
  if (digits === '') return '';
  if (digits.length === 1) digits = `0${digits}`;
  if (digits.length === 2) digits += '00';
  if (digits.length === 3) digits += '0';
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
};

/** 화면마다 다른 칸 이름·안내 글자. 모양·동작은 같다. */
export interface TimeFieldLabels {
  /** 칸·고르기 창 이름. */
  field: string;
  hourList: string;
  minuteList: string;
  /** 묶음 머리 — 「시」·「분」. */
  hourHead: string;
  minuteHead: string;
  placeholder: string;
}

export interface TimeFieldProps {
  labels: TimeFieldLabels;
  /** `00`~`23`. 고르지 않았으면 빈 문자열. */
  hour: string;
  /** `00`~`59`. 고르지 않았으면 빈 문자열. */
  minute: string;
  /** 시·분이 다 정해졌을 때 부른다. */
  onChange: (hour: string, minute: string) => void;
  /**
   * 값을 비울 수 있는 칸이면 준다 — 고르기 창에 [비우기]가 생기고, 칸 글자를 다 지우면 비운다.
   * 주지 않으면 비울 수 없고(종전 동작), 다 지운 채 벗어나면 앞 값으로 돌아간다.
   */
  onClear?: () => void;
  disabled: boolean;
  invalid: boolean;
  describedBy?: string;
  /** 필수 칸인지 — 보조 기술에 알리고, 팝업 안에서 비어 있으면 연한 빨간 바탕. 주지 않으면 필수(종전 동작). */
  required?: boolean;
  /**
   * 고를 수 없는 시각(`HH:MM`) — 고르기 창의 그 분 칸을 잠그고, 직접 쳐도 받지 않는다. 주지 않으면 모두 고를 수 있다.
   * 예: 교대 관리의 종료 시간은 시작 시간과 같은 시각일 수 없다(#318).
   */
  blockedTimes?: readonly string[];
}

/**
 * 시각 칸 — 24시간 `HH:MM` 을 칸에 바로 치거나(숫자만 쳐도 된다), 오른쪽 시계 아이콘으로 고르기 창을 열어 고른다
 * (팝업 디자인 시안 2026-11-26 · omf-all-around#360).
 *
 * 고르기 창은 시(00~23)·분(5분 단위) 단추 묶음과 [비우기]·[취소]·[확인]. 시를 고르고 분을 고르면 값이 정해지고 닫힌다.
 * [확인]은 시만 고른 채로도 정한다(분은 지금 값, 없으면 00). [취소]·Esc·바깥 누르기는 고르던 것을 버린다.
 * 디자인 시스템에 시각 부품이 없어 공용 패턴으로 둔다 — 모양은 DS 토큰으로 맞춘다(`app.css`).
 */
export const TimeField = ({
  labels,
  hour,
  minute,
  onChange,
  onClear,
  disabled,
  invalid,
  describedBy,
  required = true,
  blockedTimes,
}: TimeFieldProps) => {
  const tm = messages.screenPatterns.timeField;
  const popupId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const clockRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setOpen] = useState(false);
  const [opensUp, setOpensUp] = useState(false);
  const [draftHour, setDraftHour] = useState(hour);
  const [draftMinute, setDraftMinute] = useState(minute);

  const value = hour !== '' && minute !== '' ? `${hour}:${minute}` : '';
  const [text, setText] = useState(value);
  const editing = useRef(false);

  /* 밖에서 값이 바뀌면(불러오기·되돌리기) 치는 중이 아닐 때 칸 글자를 맞춘다. */
  useEffect(() => {
    if (!editing.current) setText(value);
  }, [value]);

  const isBlocked = (time: string): boolean => blockedTimes?.includes(time) === true;

  /** 정해진 값을 알린다 — 같은 값·막힌 시각은 알리지 않는다. */
  const commit = (time: string): boolean => {
    if (!VALID.test(time) || isBlocked(time)) return false;
    if (time !== value) onChange(time.slice(0, 2), time.slice(3, 5));
    return true;
  };

  const close = (focus: 'clock' | 'none' = 'clock'): void => {
    setOpen(false);
    if (focus === 'clock') clockRef.current?.focus();
  };

  const open = (): void => {
    const anchor = rootRef.current;

    if (anchor !== null) {
      /* 창 높이만큼 아래가 비어 있지 않으면 위로 연다. */
      const rect = anchor.getBoundingClientRect();
      setOpensUp(rect.bottom + 340 > window.innerHeight && rect.top > 340);
    }
    setDraftHour(hour);
    setDraftMinute(minute);
    setOpen(true);
  };

  /* 바깥을 누르면 고르던 것을 버리고 닫는다. */
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

  /* 열면 고른 시(없으면 첫 칸)에 포커스를 둔다. */
  useEffect(() => {
    if (!isOpen) return;

    const root = rootRef.current;

    (
      root?.querySelector<HTMLElement>('[data-group="hour"] [aria-selected="true"]') ??
      root?.querySelector<HTMLElement>('[data-group="hour"] [role="option"]')
    )?.focus();
  }, [isOpen]);

  const confirmTime =
    draftHour === '' ? '' : `${draftHour}:${draftMinute === '' ? '00' : draftMinute}`;

  const group = (
    kind: 'hour' | 'minute',
    values: string[],
    selected: string,
    onPick: (picked: string) => void,
  ) => (
    <>
      <span className="time-picker-group-label" aria-hidden="true">
        {kind === 'hour' ? labels.hourHead : labels.minuteHead}
      </span>
      <div
        role="listbox"
        aria-label={kind === 'hour' ? labels.hourList : labels.minuteList}
        className="time-picker-grid"
        data-group={kind}
      >
        {values.map((each) => {
          /* 분은 시를 고른 뒤에 고른다. `disabled` 대신 `aria-disabled` — 칸 묶음의 `:has(:disabled)` 흐림이 번지지 않게. */
          const locked =
            kind === 'minute' && (draftHour === '' || isBlocked(`${draftHour}:${each}`));
          return (
            <button
              key={each}
              type="button"
              role="option"
              aria-selected={each === selected}
              aria-disabled={locked || undefined}
              className="time-picker-option"
              onClick={() => {
                if (!locked) onPick(each);
              }}
            >
              {each}
            </button>
          );
        })}
      </div>
    </>
  );

  return (
    <div ref={rootRef} className="time-picker">
      <div
        className="time-picker-trigger"
        data-open={isOpen || undefined}
        data-invalid={invalid || undefined}
        data-empty={value === '' || undefined}
        data-required={required || undefined}
        data-disabled={disabled || undefined}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={5}
          className="time-picker-input"
          aria-label={labels.field}
          aria-required={required || undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          placeholder={labels.placeholder}
          disabled={disabled}
          value={text}
          onFocus={() => {
            editing.current = true;
          }}
          onChange={(event) => {
            const next = sanitizeTime(event.target.value);
            setText(next);
            if (next.length === 5) commit(next);
          }}
          onBlur={() => {
            editing.current = false;
            const next = completeTime(text);
            if (next === '' && onClear !== undefined) {
              if (value !== '') onClear();
              setText('');
              return;
            }
            setText(commit(next) ? next : value);
          }}
        />
        <button
          ref={clockRef}
          type="button"
          className="time-picker-clock"
          aria-label={tm.open(labels.field)}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-controls={isOpen ? popupId : undefined}
          disabled={disabled}
          onClick={() => {
            if (isOpen) setOpen(false);
            else open();
          }}
        >
          <Icon name="schedule" size={20} />
        </button>
      </div>

      {isOpen && (
        <div
          id={popupId}
          role="dialog"
          aria-label={labels.field}
          className="time-picker-popup"
          data-placement={opensUp ? 'up' : 'down'}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              close();
            }
          }}
        >
          {group('hour', HOURS, draftHour, setDraftHour)}
          <hr className="time-picker-divider" />
          {group('minute', MINUTES, draftHour === '' ? '' : draftMinute, (picked) => {
            commit(`${draftHour}:${picked}`);
            close();
          })}
          <div className="time-picker-actions">
            {onClear !== undefined && (
              <button
                type="button"
                className="time-picker-action"
                data-kind="clear"
                disabled={value === ''}
                onClick={() => {
                  onClear();
                  setText('');
                  close();
                }}
              >
                {tm.clear}
              </button>
            )}
            <button
              type="button"
              className="time-picker-action"
              data-kind="cancel"
              onClick={() => close()}
            >
              {tm.cancel}
            </button>
            <button
              type="button"
              className="time-picker-action"
              data-kind="confirm"
              disabled={confirmTime !== '' && isBlocked(confirmTime)}
              onClick={() => {
                if (confirmTime !== '') commit(confirmTime);
                close();
              }}
            >
              {tm.confirm}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
