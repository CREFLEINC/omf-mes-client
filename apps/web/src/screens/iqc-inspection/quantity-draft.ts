/**
 * 수량 3칸의 편집 상태와 합계 판정.
 *
 * ⭐ **이 파일이 화면을 지배한다.** 계약의 저장 제약이 하나뿐이고 그것이 세 칸을 묶는다:
 *
 * ```
 * 합격 + 불합격 + 보류 = 검사수량
 * ```
 *
 * 화면은 실시간으로 합계와 잔여를 보이고, 어긋난 동안 **확정을 막는다**(스펙 §6).
 * ⛔ **자동 계산을 만들지 않는다** — 어느 칸을 사용자가 넣고 어느 칸을 채울지가 아직
 * 정해지지 않았다(스펙 §8-4). 세 칸을 모두 손으로 넣고 합계·잔여만 보인다.
 *
 * ⛔ **부동소수 비교를 쓰지 않는다.** 정본이 `numeric(20, 6)` 이라 소수 여섯 자리가 실제로
 * 온다. `0.1 + 0.2 === 0.3` 이 거짓인 세계에서 이 화면의 **유일한 판정**을 부동소수로 하면,
 * 눈에는 딱 맞는데 확정 버튼이 비활성인 화면이 만들어진다 — 사용자는 무엇이 틀렸는지 영영
 * 알 수 없다. 그래서 **마이크로 단위 정수(BigInt)** 로 옮겨 정확히 비교한다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 정본 `app.qty_t` 의 소수 자릿수(`numeric(20, 6)`). 이 값이 바뀌면 여기만 고친다. */
export const QTY_SCALE = 6;

const QUANTITY_PATTERN = /^(\d+)(?:\.(\d+))?$/;

/**
 * 「12.34」를 마이크로 단위 정수로 옮긴다. 자릿수가 넘치면 **자르지 않고 거절한다** —
 * 조용히 버림하면 사용자가 넣은 값과 저장되는 값이 달라진다.
 *
 * 음수·지수 표기·공백만 있는 값은 수량이 아니다. `qty_t` 가 `>= 0` 을 강제한다.
 */
export const toMicro = (raw: string): bigint | null => {
  const matched = QUANTITY_PATTERN.exec(raw.trim());

  if (matched === null) return null;

  const fraction = matched[2] ?? '';

  if (fraction.length > QTY_SCALE) return null;

  return (
    BigInt(matched[1] ?? '0') * 10n ** BigInt(QTY_SCALE) + BigInt(fraction.padEnd(QTY_SCALE, '0'))
  );
};

/**
 * 서버가 준 수량을 마이크로 단위로 옮긴다.
 *
 * **`toFixed` 를 거친다.** 계약이 `double` 로 내려 주므로 값 자체에 이미 부동소수 오차가
 * 실려 있을 수 있고, `qty * 1_000_000` 을 그대로 곱하면 그 오차가 커진 채 정수가 된다.
 * 정본의 자릿수로 한 번 반올림한 뒤 옮기면 서버가 저장한 값과 같은 자리에 선다.
 */
export const fromServerQty = (quantity: number): bigint =>
  toMicro(Math.abs(quantity).toFixed(QTY_SCALE)) ?? 0n;

/** 마이크로 단위를 사람이 읽는 문자열로. 뒤따르는 0은 걷는다 — 「10.000000」은 읽기 나쁘다. */
export const formatMicro = (micro: bigint): string => {
  const sign = micro < 0n ? '-' : '';
  const absolute = micro < 0n ? -micro : micro;
  const unit = 10n ** BigInt(QTY_SCALE);
  const fraction = (absolute % unit).toString().padStart(QTY_SCALE, '0').replace(/0+$/, '');

  return `${sign}${absolute / unit}${fraction === '' ? '' : `.${fraction}`}`;
};

/** 세 칸의 편집 상태. **전부 문자열이다** — 치는 동안에는 아직 수량이 아니다. */
export interface QuantityDraft {
  accepted: string;
  rejected: string;
  held: string;
}

export const EMPTY_QUANTITY_DRAFT: QuantityDraft = { accepted: '', rejected: '', held: '' };

/** 어느 칸이 수량이 아닌가. **빈 칸은 0으로 읽는다** — 계약의 기본값이 0이다. */
export interface QuantityErrors {
  accepted: boolean;
  rejected: boolean;
  held: boolean;
}

const isQuantityOrEmpty = (raw: string): boolean => raw.trim() === '' || toMicro(raw) !== null;

export const validateQuantities = (draft: QuantityDraft): QuantityErrors => ({
  accepted: !isQuantityOrEmpty(draft.accepted),
  rejected: !isQuantityOrEmpty(draft.rejected),
  held: !isQuantityOrEmpty(draft.held),
});

export const hasQuantityError = (errors: QuantityErrors): boolean =>
  errors.accepted || errors.rejected || errors.held;

const readMicro = (raw: string): bigint => (raw.trim() === '' ? 0n : (toMicro(raw) ?? 0n));

/**
 * 합계 판정의 결과. **세 값이 함께 움직인다** — 화면이 이 하나만 보고 그린다.
 *
 * `remaining` 이 음수면 **넘긴 것**이다. 0으로 깎지 않는다 — 얼마나 넘겼는지가 사용자가
 * 고쳐야 할 양이고, 감추면 「왜 안 맞는지」를 다시 세어야 한다.
 */
export interface QuantityTotals {
  /** 세 칸의 합 */
  sum: bigint;
  /** 검사수량 − 합. 음수면 넘겼다 */
  remaining: bigint;
  /** 정확히 일치하는가. **확정 가능 여부의 유일한 근거다** */
  matches: boolean;
}

export const toTotals = (draft: QuantityDraft, inspectedQty: number): QuantityTotals => {
  const sum = readMicro(draft.accepted) + readMicro(draft.rejected) + readMicro(draft.held);
  const inspected = fromServerQty(inspectedQty);

  return { sum, remaining: inspected - sum, matches: sum === inspected };
};
