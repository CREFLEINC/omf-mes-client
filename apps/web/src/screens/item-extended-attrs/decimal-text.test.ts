import { describe, expect, it } from 'vitest';

import { toDecimalText } from './decimal-text';

/**
 * F4 — 지수 표기가 화면에 그대로 나오는 것을 막는다.
 *
 * **값이 바뀌지 않는 것이 이 함수의 유일한 계약이다.** 표기만 펴고 자릿수는 손대지 않는다 —
 * 반올림하거나 자리를 채우면 사용자가 고치지 않은 줄이 저장할 때 다른 값이 된다.
 */
describe('toDecimalText', () => {
  it('지수 표기가 아니면 그대로 둔다', () => {
    expect(toDecimalText(2.5)).toBe('2.5');
    expect(toDecimalText(0.00012345)).toBe('0.00012345');
    expect(toDecimalText(0)).toBe('0');
    expect(toDecimalText(1)).toBe('1');
  });

  /* `numeric(18,8)`의 가장 작은 값이 정확히 이 자리다 — `String`이 지수로 낸다. */
  it('아주 작은 수를 십진으로 편다', () => {
    expect(String(1e-8)).toBe('1e-8');
    expect(toDecimalText(1e-8)).toBe('0.00000001');
  });

  it('소수부가 있는 아주 작은 수도 편다', () => {
    expect(toDecimalText(1.2345e-7)).toBe('0.00000012345');
  });

  it('아주 큰 수를 십진으로 편다', () => {
    expect(String(1e21)).toBe('1e+21');
    expect(toDecimalText(1e21)).toBe('1000000000000000000000');
    expect(toDecimalText(1.5e21)).toBe('1500000000000000000000');
  });

  it('음수의 부호를 지킨다', () => {
    expect(toDecimalText(-1e-8)).toBe('-0.00000001');
    expect(toDecimalText(-1.5e21)).toBe('-1500000000000000000000');
  });

  /**
   * **표기를 펴도 값이 같다.** 이 단언이 깨지면 화면이 자료를 바꾸고 있다는 뜻이다 —
   * 자릿수를 맞추거나 반올림하는 구현이 들어오면 여기서 잡힌다.
   */
  it('편 표기를 다시 읽으면 같은 값이다', () => {
    const values = [1e-8, 1.2345e-7, 1e21, 1.5e21, -1e-8, 2.5, 0.00012345, 0, 1];

    for (const value of values) {
      expect(Number(toDecimalText(value))).toBe(value);
    }
  });

  /* 수가 아닌 값은 다듬을 표기 자체가 없다 — 삼키지 않고 그대로 낸다. */
  it('수가 아니면 그대로 낸다', () => {
    expect(toDecimalText(Number.NaN)).toBe('NaN');
    expect(toDecimalText(Number.POSITIVE_INFINITY)).toBe('Infinity');
  });
});
