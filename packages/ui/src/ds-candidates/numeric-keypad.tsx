import { Button } from '@crefle/web-ui';

import './numeric-keypad.css';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export interface NumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
  /** 넘기면 그 길이에서 더 받지 않는다. */
  maxLength?: number;
  disabled?: boolean;
  /** 한 자 지움 키의 접근 이름. 화면 문구는 소비처가 갖는다. */
  backspaceLabel: string;
  /** 전체 지움 키의 접근 이름. */
  clearLabel: string;
  /** 키 묶음 전체의 접근 이름. */
  label: string;
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
  disabled = false,
  backspaceLabel,
  clearLabel,
  label,
  className,
}: NumericKeypadProps) => {
  const full = maxLength !== undefined && value.length >= maxLength;

  const append = (digit: string) => {
    onChange(value + digit);
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
          size="xl"
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
        size="xl"
        disabled={disabled || value === ''}
        aria-label={backspaceLabel}
        onClick={() => {
          onChange(value.slice(0, -1));
        }}
      >
        ←
      </Button>
      <Button
        type="button"
        variant="outlined"
        size="xl"
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
        size="xl"
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
