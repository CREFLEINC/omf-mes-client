import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { NumericKeypad } from '@omf-mes/ui';

import { POP_TOUCH_SIZE } from './touch-spec';

const t = messages.pqcInspection.pad;

export interface KeypadPanelProps {
  /** 지금 치고 있는 칸의 이름. **`null` 이면 아직 고르지 않은 것**이다. */
  label: string | null;
  /** 그 칸의 값. */
  value: string;
  onChange: (next: string) => void;
  /** 확정된 회차에서는 패드도 누르지 않는다(#1146 ③). */
  isLocked: boolean;
  /**
   * 부호(−·+)와 소수점을 받는가 — **측정치 칸일 때만 켠다**(사용자 지시 2026-09-17). 측정치는
   * 규격 중심에서 벗어난 음수·소수가 들어오고, 수량은 0 이상의 정수다.
   */
  allowSignAndDecimal: boolean;
}

/** 음수로 바꾼다. 이미 음수면 그대로 둔다. */
export const toNegative = (value: string): string => (value.startsWith('-') ? value : `-${value}`);

/** 양수로 바꾼다 — 앞의 `-` 를 뗀다. */
export const toPositive = (value: string): string =>
  value.startsWith('-') ? value.slice(1) : value;

/** 소수점을 붙인다. 이미 있으면 그대로다. 정수 자리가 비었으면 `0` 을 채운다. */
export const withDecimalPoint = (value: string): string => {
  if (value.includes('.')) return value;
  if (value === '' || value === '-') return `${value}0.`;

  return `${value}.`;
};

/**
 * 숫자 키패드 구획 — **우단 《결과 입력》 옆에 상시로 선다**(설계 2차 공지 `a6a87e1` ·
 * `omf-mes#286` · 스펙 §3-1 지정).
 *
 * ⭐ **왜 팝업이 아닌가.** §5-9 액션 표와 §7 DS 매핑이 「측정값·수량은 화면 내장 숫자 키패드로
 * 넣는다」를 적어 두었는데 **도면에 그 블록이 없었다.** D-4 가 「배치는 부품이 정하지 않는다 —
 * 화면이 놓는다」라, 도면이 비운 동안 우리는 팝업으로 세웠다. 2026-09-03 판이 자리를 못
 * 박으면서(3단 배치의 셋째 칸 216) **팝업일 이유가 사라졌다** — 열고 닫는 조작도 함께 사라진다.
 *
 * ⭐ **좌단 측정값도 이 패드를 쓴다**(도면 주석 「좌단 측정값도 이 패드로」). 칸이 다섯이든
 * 열이든 패드는 하나이고, **포커스한 칸에 들어간다**(D-4 「포커스된 필드에 연동되는 입력 버퍼」).
 *
 * ⛔ **고른 칸이 없으면 누를 수 없다.** 어디로 들어갈지 모르는 숫자를 받으면 사용자는 자기가
 *    무엇을 쳤는지 모른다.
 */
export const KeypadPanel = ({
  label,
  value,
  onChange,
  isLocked,
  allowSignAndDecimal,
}: KeypadPanelProps) => {
  const disabled = isLocked || label === null;
  const signDisabled = disabled || !allowSignAndDecimal;

  return (
    <section className="pane pqc-keypad" aria-label={t.keypadLabel}>
      <h2 className="pane-title">{t.title}</h2>

      {/* 어느 칸을 치고 있는지 늘 보인다 — 패드가 칸에서 떨어져 있어 눈이 되짚을 자리가 필요하다. */}
      <p className="pqc-pad-target">{label ?? t.noTarget}</p>
      {/*
       * ⛔ **빈 값에 줄표를 세우지 않는다**(사용자 지시 2026-09-10). 칸을 고르기만 하고 아직
       *    아무것도 안 눌렀을 때 「—」가 서면 그것이 값처럼 읽힌다 — 빈 자리 그대로 둔다.
       *    줄 높이는 CSS 가 잡고 있어(`min-block-size`) 첫 숫자에 화면이 튀지 않는다.
       */}
      <p className="pqc-pad-value">{value}</p>

      <NumericKeypad
        value={value}
        dropLeadingZero
        onChange={onChange}
        disabled={disabled}
        keySize={POP_TOUCH_SIZE}
        label={t.keypadLabel}
        backspaceLabel={t.backspace}
        clearLabel={t.clear}
      />

      {/*
       * ⭐ **부호·소수점 줄** — 측정치 칸일 때만 켜진다(사용자 지시 2026-09-17). 줄은 늘 세워 두어
       *    칸을 옮길 때 키 배치가 흔들리지 않게 한다. 공용 키패드는 건드리지 않고 이 구획이 붙인다.
       */}
      <div className="pqc-pad-extra" role="group" aria-label={t.extraKeysLabel}>
        <Button
          type="button"
          variant="outlined"
          size={POP_TOUCH_SIZE}
          className="pqc-pad-sign"
          aria-label={t.negative}
          disabled={signDisabled || value.startsWith('-')}
          onClick={() => onChange(toNegative(value))}
        >
          −
        </Button>
        <Button
          type="button"
          variant="outlined"
          size={POP_TOUCH_SIZE}
          className="pqc-pad-sign"
          aria-label={t.positive}
          disabled={signDisabled || !value.startsWith('-')}
          onClick={() => onChange(toPositive(value))}
        >
          +
        </Button>
        <Button
          type="button"
          variant="outlined"
          size={POP_TOUCH_SIZE}
          className="pqc-pad-decimal"
          aria-label={t.decimal}
          disabled={signDisabled || value.includes('.')}
          onClick={() => onChange(withDecimalPoint(value))}
        >
          .
        </Button>
      </div>
    </section>
  );
};
