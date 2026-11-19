import { messages } from '@omf-mes/i18n';
import {
  forwardRef,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type TextareaHTMLAttributes,
} from 'react';

import { useScannerSubmit } from '../pop-scanner-submit';
import { PuDialog } from './dialog';
import { PuIcon } from './icon';
import { PuButton, PuNote, puCx } from './layout';

/**
 * 칸(규칙 5) · 스캔 칸(규칙 6) · 고르기 타일(규칙 7) · 숫자 키패드(규칙 8) — #295.
 */
const t = messages.popUniform;

/**
 * 칸 하나: 이름은 칸 위, 필수는 빨간 *. `need` 면 칸 테두리가 빨갛다(비어 있는 동안).
 * 「불량 1: 유형을 선택해 주세요」 같은 별도 문구는 두지 않는다.
 */
export const PuField = ({
  label,
  required = false,
  optional,
  aside,
  htmlFor,
  labelId,
  children,
  className,
}: {
  label: ReactNode;
  required?: boolean;
  /** 「(선택)」처럼 이름 옆에 회색으로 붙는 말. */
  optional?: ReactNode;
  /** 이름 줄 오른쪽 끝(체크 등). */
  aside?: ReactNode;
  htmlFor?: string;
  labelId?: string;
  children: ReactNode;
  className?: string;
}) => (
  <div className={puCx('pu-field', className)}>
    <label className="pu-label" htmlFor={htmlFor} id={labelId}>
      {label}
      {required && (
        <span className="req" aria-hidden>
          *
        </span>
      )}
      {optional !== undefined && <span className="opt">{optional}</span>}
      {aside !== undefined && <span className="aside">{aside}</span>}
    </label>
    {children}
  </div>
);

export interface PuInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** 필수인데 비었다 — 빨간 테두리. */
  need?: boolean;
  /** 키패드가 지금 넣는 칸 — 파란 테두리. */
  target?: boolean;
  /** 숫자 칸(오른쪽 맞춤 · 굵게). */
  numeric?: boolean;
}

export const PuInput = forwardRef<HTMLInputElement, PuInputProps>(function PuInput(
  { need = false, target = false, numeric = false, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={puCx(
        'pu-input',
        numeric && 'num',
        need && !rest.disabled && 'is-need',
        target && !rest.disabled && 'is-target',
        className,
      )}
      aria-invalid={need || undefined}
      {...rest}
    />
  );
});

export const PuTextArea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { need?: boolean }
>(function PuTextArea({ need = false, className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={puCx('pu-input', need && 'is-need', className)}
      aria-invalid={need || undefined}
      {...rest}
    />
  );
});

/** 칸 옆 단위(EA 등). */
export const PuUnit = ({ children }: { children: ReactNode }) => (
  <span className="pu-unit">{children}</span>
);

/* ── 스캔 칸 ── */

export interface PuScanFieldProps {
  label: ReactNode;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  /** 스캔(Enter · 스캐너 끝)·직접 입력으로 들어온 값. */
  onSubmit: (value: string) => void;
  placeholder?: string;
  /** 읽었는가 — 초록 「스캔 완료」. */
  done?: boolean;
  doneText?: string;
  /** 못 찾음 등: 칸 바로 아래 빨간 한 줄. */
  error?: ReactNode;
  /** [직접 입력] 창 제목·칸 이름. 비우면 칸 이름을 쓴다. 단추를 감추려면 `manual={false}`. */
  manual?: false | { title?: string; label?: string; keypad?: boolean };
  disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  inputId?: string;
  autoFocus?: boolean;
  /** 칸 아래 덧붙임(스캔으로 담긴 줄 등). */
  children?: ReactNode;
  ariaLabel?: string;
}

/**
 * 스캔 칸 한 모양: 빨간 테두리 + 「스캔 대기」 점멸 → 읽으면 초록 「스캔 완료」.
 * 옆 단추는 [직접 입력] 하나 — 라벨이 상해 못 읽으면 번호를 넣는다.
 * 못 찾으면 부르는 쪽이 칸을 비우고 `error` 를 준다(칸 바로 아래 빨간 한 줄).
 */
export const PuScanField = ({
  label,
  required = false,
  value,
  onChange,
  onSubmit,
  placeholder,
  done = false,
  doneText,
  error,
  manual,
  disabled = false,
  inputRef,
  inputId,
  autoFocus,
  children,
  ariaLabel,
}: PuScanFieldProps) => {
  const fallbackId = useId();
  const id = inputId ?? fallbackId;
  const errorId = useId();
  const [manualOpen, setManualOpen] = useState(false);
  const latest = useRef(value);
  latest.current = value;
  const scanner = useScannerSubmit(
    (scanned) => {
      const trimmed = scanned.trim();
      if (trimmed !== '') onSubmit(trimmed);
    },
    () => latest.current,
  );
  const labelText = typeof label === 'string' ? label : (ariaLabel ?? '');

  return (
    <div className="pu-field">
      <label className="pu-label" htmlFor={id}>
        {label}
        {required && (
          <span className="req" aria-hidden>
            *
          </span>
        )}
      </label>
      <div className="pu-row">
        <div className={puCx('pu-scan', done && 'is-done', disabled && 'is-off')}>
          <PuIcon name="scan" />
          <input
            ref={inputRef}
            id={id}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            autoFocus={autoFocus}
            autoComplete="off"
            aria-label={ariaLabel}
            aria-invalid={error !== undefined && error !== null ? true : undefined}
            aria-describedby={error !== undefined && error !== null ? errorId : undefined}
            onChange={(event) => {
              onChange(event.target.value);
              scanner.noteInput(event.target.value);
            }}
            onKeyDown={scanner.onKeyDown}
          />
          <span className="ready">{done ? (doneText ?? t.scan.done) : t.scan.ready}</span>
        </div>
        {manual !== false && (
          <PuButton
            disabled={disabled}
            onClick={() => {
              setManualOpen(true);
            }}
          >
            {t.scan.manual}
          </PuButton>
        )}
      </div>
      {error !== undefined && error !== null && error !== false && (
        <PuNote tone="bad" id={errorId}>
          {error}
        </PuNote>
      )}
      {children}
      {manualOpen && manual !== false && (
        <PuManualDialog
          title={manual?.title ?? t.scan.manual}
          label={manual?.label ?? labelText}
          keypad={manual?.keypad ?? false}
          onClose={() => {
            setManualOpen(false);
          }}
          onSubmit={(entered) => {
            setManualOpen(false);
            onChange(entered);
            onSubmit(entered);
          }}
        />
      )}
    </div>
  );
};

/** [직접 입력] 창: 칸 하나 + [취소] · [확인]. 숫자만 넣는 칸(사번 등)은 키패드를 함께 보인다. */
export const PuManualDialog = ({
  title,
  label,
  keypad = false,
  onSubmit,
  onClose,
  confirmLabel,
}: {
  title: ReactNode;
  label: string;
  keypad?: boolean;
  onSubmit: (value: string) => void;
  onClose: () => void;
  confirmLabel?: string;
}) => {
  const [value, setValue] = useState('');
  const id = useId();
  const submit = (): void => {
    const trimmed = value.trim();
    if (trimmed !== '') onSubmit(trimmed);
  };

  return (
    <PuDialog
      title={title}
      onClose={onClose}
      footer={
        <>
          <PuButton onClick={onClose}>{t.dialog.cancel}</PuButton>
          <PuButton variant="primary" disabled={value.trim() === ''} onClick={submit}>
            {confirmLabel ?? t.dialog.confirm}
          </PuButton>
        </>
      }
    >
      <PuField label={label} htmlFor={id}>
        <PuInput
          id={id}
          value={value}
          numeric={keypad}
          target={keypad}
          inputMode={keypad ? 'none' : undefined}
          autoFocus
          autoComplete="off"
          onChange={(event) => {
            setValue(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit();
          }}
        />
      </PuField>
      {keypad && (
        <PuKeypad
          targetLabel={label}
          decimal={false}
          onKey={(key) => {
            setValue((prev) => applyKeypadKey(prev, key, { decimal: false }));
          }}
          onClearAll={() => {
            setValue('');
          }}
        />
      )}
    </PuDialog>
  );
};

/* ── 고르기 타일(6개 이하) ── */

export interface PuTileOption<V extends string = string> {
  value: V;
  label: ReactNode;
  disabled?: boolean;
  /** 판정 색: 합격·OK 초록, 불합격·NG 빨강, 보류 노랑. */
  judge?: 'ok' | 'ng' | 'hold';
}

export const PuTiles = <V extends string = string>({
  options,
  value,
  onChange,
  cols,
  label,
  disabled = false,
}: {
  options: readonly PuTileOption<V>[];
  value: V | null;
  onChange: (value: V) => void;
  /** 한 줄 칸 수(기본 3). */
  cols?: number;
  label: string;
  disabled?: boolean;
}) => (
  <div
    className="pu-tiles"
    role="radiogroup"
    aria-label={label}
    style={cols === undefined ? undefined : ({ '--cols': String(cols) } as CSSProperties)}
  >
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        role="radio"
        aria-checked={option.value === value}
        className={puCx(
          'pu-tile',
          option.value === value && 'is-on',
          option.judge !== undefined && `j-${option.judge}`,
        )}
        disabled={disabled || option.disabled === true}
        onClick={() => {
          onChange(option.value);
        }}
      >
        {option.label}
      </button>
    ))}
  </div>
);

/** 보기 바꿈(세그먼트·탭). */
export const PuSeg = <V extends string = string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: V; label: ReactNode; disabled?: boolean }[];
  value: V;
  onChange: (value: V) => void;
  label: string;
}) => (
  <div className="pu-seg" role="tablist" aria-label={label}>
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        role="tab"
        aria-selected={option.value === value}
        disabled={option.disabled}
        onClick={() => {
          onChange(option.value);
        }}
      >
        {option.label}
      </button>
    ))}
  </div>
);

/* ── 숫자 키패드 ── */

export type PuKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back';

/**
 * 키 하나를 값에 붙인다. 「0」 하나뿐이면 숫자로 바꾼다. 「.」은 소수 칸에서만, 한 번만.
 * `maxDecimals` 를 주면 소수 자리를 그 이상 받지 않는다.
 */
export const applyKeypadKey = (
  value: string,
  key: PuKey,
  { decimal = true, maxDecimals }: { decimal?: boolean; maxDecimals?: number } = {},
): string => {
  if (key === 'back') return value.slice(0, -1);
  if (key === '.') {
    if (!decimal || value.includes('.')) return value;
    return `${value === '' ? '0' : value}.`;
  }
  if (maxDecimals !== undefined && value.includes('.')) {
    const [, fraction = ''] = value.split('.');
    if (fraction.length >= maxDecimals) return value;
  }
  return value === '0' ? key : value + key;
};

const KEYS: readonly PuKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];
/** `clearInPad` 일 때 — 맨 아래 줄은 ← · 0 · [전체 삭제](마지막 칸은 따로 그린다). */
const PAD_KEYS: readonly PuKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0'];

/**
 * 같은 키패드(3×4, 키 56, 「.」 포함). 위에 「입력 칸: ○○」과 [전체 삭제](누른 칸만 지움).
 * 정수만 받는 칸이면 `decimal={false}` — 「.」이 꺼진다.
 */
export const PuKeypad = ({
  targetLabel,
  onKey,
  onClearAll,
  decimal = true,
  disabled = false,
  clearInPad = false,
}: {
  /** 지금 숫자가 들어갈 칸 이름. 없으면 「입력할 칸을 누르세요」. */
  targetLabel: ReactNode | null;
  onKey: (key: PuKey) => void;
  onClearAll: () => void;
  decimal?: boolean;
  disabled?: boolean;
  /**
   * 정수 칸에서 [전체 삭제]를 위 줄 대신 키패드 맨 아래 줄에 둔다 — 「← · 0 · 전체 삭제」(사번 입력,
   * 사용자 지시 2026-11-19). 이때 「.」 키는 없다.
   */
  clearInPad?: boolean;
}) => (
  <div className="pu-stack" role="group" aria-label={t.keypad.region}>
    <div className="pu-keypad-head">
      <span className="pu-keypad-target">
        {targetLabel === null ? (
          t.keypad.noTarget
        ) : (
          <>
            {t.keypad.target} <b>{targetLabel}</b>
          </>
        )}
      </span>
      {clearInPad ? null : (
        <PuButton size="sm" disabled={disabled || targetLabel === null} onClick={onClearAll}>
          {t.keypad.clearAll}
        </PuButton>
      )}
    </div>
    <div className="pu-keypad">
      {(clearInPad ? PAD_KEYS : KEYS).map((key) => (
        <button
          key={key}
          type="button"
          className={key === 'back' ? 'fn' : undefined}
          aria-label={key === 'back' ? t.keypad.backspace : key}
          disabled={disabled || targetLabel === null || (key === '.' && !decimal)}
          onClick={() => {
            onKey(key);
          }}
        >
          {key === 'back' ? '←' : key}
        </button>
      ))}
      {clearInPad ? (
        <button
          type="button"
          className="fn pu-keypad-clear"
          disabled={disabled || targetLabel === null}
          onClick={onClearAll}
        >
          {t.keypad.clearAll}
        </button>
      ) : null}
    </div>
  </div>
);
