/**
 * 서버가 준 수를 **지수 표기 없이** 십진 문자열로 옮긴다.
 *
 * `String(1e-8)`은 `"1e-8"`이다. 이 화면에는 그 표기가 실제로 올 수 있는 자리가 둘 있다 —
 * 단위 환산의 환산 비율(계약 `numeric(18,8)`)과 구성품의 스크랩률(0~1 비율 · A-8).
 * 「1e-8」은 사람이 자료로 읽지 못하고, 편집 창에서 그 표기를 그대로 고치려 하면 실수하기 쉽다.
 *
 * **값을 바꾸지 않는다.** 자릿수를 맞추거나 반올림하지 않고 표기만 편다 —
 * `Number(toDecimalText(x)) === x`가 언제나 성립한다. 자릿수를 손대면
 * 사용자가 고치지 않은 줄이 저장할 때 다른 값이 된다.
 *
 * **사용자가 친 표기는 손대지 않는다.** 이 함수가 도는 자리는 서버 응답을 초안·표기로
 * 옮기는 한 곳뿐이다. 입력칸에 친 값을 다듬으면 타이핑 도중에 값이 흔들린다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/**
 * `String(number)`가 내는 지수 표기. 부호·정수부·소수부·지수로 나눈다.
 * 자바스크립트는 지수를 언제나 부호와 함께 낸다(`1e+21` · `1e-8`).
 */
const EXPONENT_NOTATION = /^(-?)(\d+)(?:\.(\d+))?e([+-]\d+)$/i;

export const toDecimalText = (value: number): string => {
  const text = String(value);
  const match = EXPONENT_NOTATION.exec(text);

  // 지수 표기가 아니면 그대로 둔다. `NaN`·`Infinity`도 여기로 떨어진다.
  if (match === null) return text;

  const [, sign = '', intPart = '', fracPart = '', exponentText = '0'] = match;
  const digits = `${intPart}${fracPart}`;
  /* 소수점이 놓일 자리. 원래 자리(정수부 길이)에서 지수만큼 옮긴다. */
  const pointAt = intPart.length + Number(exponentText);

  // 소수점이 첫 자리보다 앞이면 `0.` 뒤에 그만큼 0을 채운다.
  if (pointAt <= 0) return `${sign}0.${'0'.repeat(-pointAt)}${digits}`;

  // 소수점이 마지막 자리보다 뒤면 자릿수를 0으로 채워 정수로 만든다.
  if (pointAt >= digits.length) return `${sign}${digits}${'0'.repeat(pointAt - digits.length)}`;

  return `${sign}${digits.slice(0, pointAt)}.${digits.slice(pointAt)}`;
};
