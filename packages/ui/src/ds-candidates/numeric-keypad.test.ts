import { describe, expect, it } from 'vitest';

import { appendDigit } from './numeric-keypad';

/*
 * 앞자리 0 — **화면에서 잡되, 켠 칸에서만 잡는다.**
 *
 * `011` 은 계약이 받는 «수»로는 `11` 과 같지만, 되돌릴 수 없는 기록에 글자가 그대로 남으면
 * 나중에 같은 값인지 사람이 판단해야 한다. 그래서 수량 칸에서는 정리한다.
 *
 * ⛔ **사번·번호에는 걸지 않는다**(리뷰 지적 2026-09-11). 그쪽은 수가 아니라 글자라,
 *    정리하면 `0` 으로 시작하는 값을 «칠 수 없게» 된다.
 */
describe('appendDigit — 기본(식별자 칸)', () => {
  it('0 으로 시작하는 값을 그대로 쌓는다 — 사번을 칠 수 있어야 한다', () => {
    expect(appendDigit('0', '1')).toBe('01');
    expect(appendDigit('01', '2')).toBe('012');
  });

  it('0 이 아닌 값에도 그대로 붙는다', () => {
    expect(appendDigit('1', '1')).toBe('11');
    expect(appendDigit('', '5')).toBe('5');
  });
});

describe('appendDigit — 켰을 때(수량 칸)', () => {
  it('0 뒤에 숫자를 누르면 그 숫자로 바뀐다', () => {
    expect(appendDigit('0', '1', true)).toBe('1');
  });

  it('0 을 두 번 눌러도 0 하나다', () => {
    expect(appendDigit('0', '0', true)).toBe('0');
  });

  it('0 이 아닌 값에는 그대로 붙는다', () => {
    expect(appendDigit('1', '1', true)).toBe('11');
    expect(appendDigit('', '5', true)).toBe('5');
  });

  /* 소수는 다르다 — `0.` 은 「0점 무엇」의 시작이라 앞자리 0 이 뜻을 갖는다. */
  it('소수점 뒤에는 0 도 그대로 붙는다', () => {
    expect(appendDigit('0.', '5', true)).toBe('0.5');
    expect(appendDigit('0.', '0', true)).toBe('0.0');
  });
});
