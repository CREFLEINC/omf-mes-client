import { describe, expect, it } from 'vitest';

import { appendDigit } from './numeric-keypad';

/*
 * 앞자리 0 — **화면에서 잡는다.** `011` 은 계약이 받는 수로는 `11` 과 같지만, 되돌릴 수 없는
 * 기록에 글자가 그대로 남으면 나중에 같은 값인지 사람이 판단해야 한다.
 */
describe('appendDigit', () => {
  it('0 뒤에 숫자를 누르면 그 숫자로 바뀐다', () => {
    expect(appendDigit('0', '1')).toBe('1');
  });

  it('0 을 두 번 눌러도 0 하나다', () => {
    expect(appendDigit('0', '0')).toBe('0');
  });

  it('0 이 아닌 값에는 그대로 붙는다', () => {
    expect(appendDigit('1', '1')).toBe('11');
    expect(appendDigit('', '5')).toBe('5');
  });

  /* 소수는 다르다 — `0.` 은 「0점 무엇」의 시작이라 앞자리 0 이 뜻을 갖는다. */
  it('소수점 뒤에는 0 도 그대로 붙는다', () => {
    expect(appendDigit('0.', '5')).toBe('0.5');
    expect(appendDigit('0.', '0')).toBe('0.0');
  });
});
