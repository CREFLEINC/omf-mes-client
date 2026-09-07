import type { ReactNode } from 'react';

import { Button, type ButtonSize } from '@crefle/web-ui';

import './numeric-keypad.css';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

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
  backspaceLabel,
  backspaceGlyph = '←',
  clearLabel,
  label,
  keySize = 'xl',
  className,
}: NumericKeypadProps) => {
  const full = maxLength !== undefined && value.length >= maxLength;

  const append = (digit: string) => {
    const next = value + digit;

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
    </div>
  );
};
