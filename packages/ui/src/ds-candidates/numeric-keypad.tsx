import type { ReactNode } from 'react';

import { Button, type ButtonSize } from '@crefle/web-ui';

import './numeric-keypad.css';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

/**
 * 누른 숫자를 값에 붙인다.
 *
 * ⛔ **앞자리 0 을 쌓지 않는다**(사용자 지시 2026-09-10). `011` 은 `11` 과 같은 수인데 글자가
 * 달라, 되돌릴 수 없는 기록에 실리면 나중에 같은 값인지 눈으로 판단해야 한다. 실제로 현장
 * 화면에서 `011` 이 그대로 섰다.
 *
 * ⚠ 소수는 그대로 둔다 — `0.` 은 `0` 이 아니라 「0점 무엇」의 시작이다.
 */
export const appendDigit = (value: string, digit: string): string =>
  value === '0' ? digit : `${value}${digit}`;

export interface NumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
  /** 넘기면 그 길이에서 더 받지 않는다. */
  maxLength?: number;
  /**
   * 넘기면 그 «수»를 넘기는 입력을 받지 않는다. 자릿수(`maxLength`)와 다른 축이다 —
   * 1000 이 상한이면 자릿수는 4 지만 `9999` 는 받으면 안 된다.
   */
  max?: number;
  disabled?: boolean;
  /**
   * 소수점 키를 그린다. 기본은 그리지 않는다 — 수량·타발수처럼 정수만 받는 자리가 대부분이라,
   * 키가 늘 있으면 넣을 수 없는 값을 넣게 된다.
   *
   * ⚠ 켜도 **소수점은 하나뿐**이다. 둘째 점을 누르면 없던 일로 둔다 — 넣었다가 지우게 하면
   * 손이 두 번 간다(자릿수 상한과 같은 처리).
   */
  allowDecimal?: boolean;
  /** 소수점 키의 접근 이름. `allowDecimal` 일 때만 쓴다. */
  decimalLabel?: string;
  /** 한 자 지움 키의 접근 이름. 화면 문구는 소비처가 갖는다. */
  backspaceLabel: string;
  /**
   * 한 자 지움 키에 «보이는» 기호. 접근 이름(`backspaceLabel`)과 다른 축이다 — 화면마다
   * 쓰던 기호가 달라, 부품을 바꿔 끼울 때 모양까지 바뀌지 않게 밖에서 받는다.
   */
  backspaceGlyph?: ReactNode;
  /** 전체 지움 키의 접근 이름. */
  clearLabel: string;
  /** 키 묶음 전체의 접근 이름. */
  label: string;
  /**
   * 키 하나의 크기 등급. ⛔ **부품이 정하지 않고 밖에서 받는다** — 터치 규격이 화면마다
   * 다르고(POP 64·72 · 모바일 56), 부품이 고르면 자기가 어느 화면에 놓였는지 알게 된다.
   */
  keySize?: ButtonSize;
  className?: string;
}

/**
 * 화면 내장 숫자 입력 패드. 운영체제 터치 키보드는 전체 화면을 덮고 닫기 제어가 어려워
 * 현장 단말에서 쓸 수 없다. 디자인 시스템에 없어 제품이 갖는다.
 */
export const NumericKeypad = ({
  value,
  onChange,
  maxLength,
  max,
  disabled = false,
  allowDecimal = false,
  decimalLabel,
  backspaceLabel,
  backspaceGlyph = '←',
  clearLabel,
  label,
  keySize = 'xl',
  className,
}: NumericKeypadProps) => {
  const full = maxLength !== undefined && value.length >= maxLength;

  const append = (digit: string) => {
    const next = appendDigit(value, digit);

    /* 상한을 넘기는 입력은 «없던 일»로 둔다 — 넣었다가 지우게 하면 손이 두 번 간다. */
    if (max !== undefined && Number(next) > max) return;

    onChange(next);
  };

  return (
    <div
      className={['omf-numeric-keypad', className].filter(Boolean).join(' ')}
      role="group"
      aria-label={label}
    >
      {DIGITS.map((digit) => (
        <Button
          key={digit}
          type="button"
          variant="outlined"
          size={keySize}
          disabled={disabled || full}
          onClick={() => {
            append(digit);
          }}
        >
          {digit}
        </Button>
      ))}
      <Button
        type="button"
        variant="outlined"
        size={keySize}
        className="omf-numeric-keypad__backspace"
        disabled={disabled || value === ''}
        aria-label={backspaceLabel}
        onClick={() => {
          onChange(value.slice(0, -1));
        }}
      >
        {backspaceGlyph}
      </Button>
      <Button
        type="button"
        variant="outlined"
        size={keySize}
        className="omf-numeric-keypad__zero"
        disabled={disabled || full}
        onClick={() => {
          append('0');
        }}
      >
        0
      </Button>
      <Button
        type="button"
        variant="outlined"
        size={keySize}
        className="omf-numeric-keypad__clear"
        disabled={disabled || value === ''}
        onClick={() => {
          onChange('');
        }}
      >
        {clearLabel}
      </Button>
      {allowDecimal ? (
        <Button
          type="button"
          variant="outlined"
          size={keySize}
          className="omf-numeric-keypad__decimal"
          disabled={disabled || full || value.includes('.')}
          aria-label={decimalLabel}
          onClick={() => {
            /* 빈 칸에서 누르면 `.5` 가 아니라 `0.5` 로 시작한다 — 계약에 보내는 값이 수다. */
            onChange(value === '' ? '0.' : `${value}.`);
          }}
        >
          .
        </Button>
      ) : null}
    </div>
  );
};
