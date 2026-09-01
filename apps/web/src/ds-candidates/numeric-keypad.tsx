import { Button } from '@crefle/web-ui';

/**
 * 화면 내장 숫자 키패드 — **공유계약 D-4**(✓확정 2026-08-02).
 *
 * > POP **숫자 입력**(수량 · 측정값 · 사번)은 **화면 내장 키패드**를 쓴다. OS 터치 키보드에
 * > 의존하지 않는다 — 키오스크 창에서 화면을 덮고 제어가 어렵다.
 *
 * ## 왜 `ds-candidates/`인가
 *
 * DS에 없는 **새 원시 요소**(갈래 d)다. 저장소 규약대로 여기서 먼저 만들고 **세 번째
 * 사용처**에서 DS로 승격한다(`CLAUDE.md` 「디자인 시스템」 · `design-system-v2-webui#41`).
 *
 * ⚠ **사용처가 여럿이다.** `P-02-01` 스펙 §7이 이 부품을 `ds-gap G-6` · 「7곳째」로 등재해
 * 두었고, 사번(`P-CO-01`) · 수량(`P-02-03`) · 측정값(`P-05-01`)이 모두 이 조항 아래 있다.
 * 그래서 화면 슬라이스가 아니라 **여기**에 둔다 — 같은 것을 화면마다 만들면 D-4가 말하는
 * 「한 곳에 모은다」가 무너진다.
 *
 * ⚠ **자릿수·소수점 규칙은 부르는 쪽이 정한다.** 사번은 정수·고정 자릿수이고 수량은 소수를
 * 받는다 — 이 부품은 **누른 키를 문자열로 돌려줄 뿐** 무엇이 유효한지 판정하지 않는다.
 * 판정을 여기 넣으면 사용처마다 분기가 쌓이고, 그 분기는 각 화면의 검증 규칙과 갈라진다.
 */

export interface NumericKeypadProps {
  /** 지금 값. 부르는 쪽이 소유한다 — 이 부품은 상태를 갖지 않는다. */
  value: string;
  onChange: (next: string) => void;
  /** 소수점 키를 낼지. 사번처럼 정수만 받는 자리는 끈다. */
  allowDecimal?: boolean;
  /** 입력을 마쳤을 때. 스캔형 화면에서는 이 자리가 「기록」이 된다. */
  onSubmit?: () => void;
  /**
   * 제출만 잠근다. **숫자 키는 계속 눌린다** — 값을 고칠 수 없게 만들면 왜 못 보내는지
   * 알아보려던 작업자가 입력까지 막힌 것으로 읽는다. 사유는 부르는 쪽이 화면에 낸다.
   */
  submitDisabled?: boolean;
  /** 접근 이름 — 화면에 이 패드가 둘 이상 설 수 있어 무엇을 치는 패드인지 밝힌다. */
  label: string;
  submitLabel: string;
  clearLabel: string;
  backspaceLabel: string;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

/**
 * 누른 키를 값에 반영한다.
 *
 * ⛔ **소수점을 둘 이상 받지 않는다.** `1.2.3`은 어떤 사용처에서도 유효하지 않고, 그것을
 * 각 화면의 검증에 맡기면 작업자는 다 치고 나서야 틀린 것을 안다.
 *
 * ⛔ **앞자리 0을 쌓지 않는다.** `007`은 `7`과 같은 수인데 글자가 달라, 되돌릴 수 없는 기록에
 * 실리면 나중에 같은 값인지 눈으로 판단해야 한다.
 */
export const pressKey = (value: string, key: string): string => {
  if (key === '.') return value.includes('.') ? value : `${value === '' ? '0' : value}.`;
  if (value === '0') return key;

  return `${value}${key}`;
};

/**
 * 터치 패드. **키 하나가 손가락 하나보다 커야 한다** — 장갑을 낀 채 누르므로 현장 단말의
 * 터치 하한(`pop-touch-target`)을 모든 키에 건다.
 */
export const NumericKeypad = ({
  value,
  onChange,
  allowDecimal = true,
  onSubmit,
  submitDisabled = false,
  label,
  submitLabel,
  clearLabel,
  backspaceLabel,
}: NumericKeypadProps) => (
  <div className="numeric-keypad" role="group" aria-label={label}>
    {DIGITS.map((digit) => (
      <Button
        key={digit}
        type="button"
        variant="outlined"
        size="xl"
        className="pop-touch-target"
        onClick={() => {
          onChange(pressKey(value, digit));
        }}
      >
        {digit}
      </Button>
    ))}

    {/*
     * 소수점 자리는 사용처가 정한다. 끄더라도 **자리를 비워 두어** 아래 줄의 키가 위로 밀려
     * 올라오지 않게 한다 — 손이 기억한 위치가 화면마다 달라지면 오조작이 는다.
     */}
    {allowDecimal ? (
      <Button
        type="button"
        variant="outlined"
        size="xl"
        className="pop-touch-target"
        onClick={() => {
          onChange(pressKey(value, '.'));
        }}
      >
        .
      </Button>
    ) : (
      <span aria-hidden="true" />
    )}

    <Button
      type="button"
      variant="outlined"
      size="xl"
      className="pop-touch-target"
      onClick={() => {
        onChange(pressKey(value, '0'));
      }}
    >
      0
    </Button>

    <Button
      type="button"
      variant="outlined"
      size="xl"
      className="pop-touch-target"
      aria-label={backspaceLabel}
      onClick={() => {
        onChange(value.slice(0, -1));
      }}
    >
      ⌫
    </Button>

    <Button
      type="button"
      variant="text"
      size="xl"
      className="pop-touch-target"
      onClick={() => {
        onChange('');
      }}
    >
      {clearLabel}
    </Button>

    {onSubmit !== undefined && (
      <Button
        type="button"
        variant="filled"
        size="xl"
        className="pop-touch-target numeric-keypad-submit"
        disabled={submitDisabled}
        onClick={onSubmit}
      >
        {submitLabel}
      </Button>
    )}
  </div>
);
