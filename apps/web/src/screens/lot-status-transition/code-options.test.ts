import { describe, expect, it } from 'vitest';

import { isKnownReason, type ReasonOption } from './code-options';

const options: readonly ReasonOption[] = [
  { value: 'SYN_A', label: 'Synthetic A' },
  { value: 'SYN_B', label: 'Synthetic B' },
];

describe('isKnownReason — 선택지 안의 값만 통과한다', () => {
  it('목록에 있는 코드는 통과한다', () => {
    expect(isKnownReason(options, 'SYN_B')).toBe(true);
  });

  /* 목록이 바뀐 뒤 남은 낡은 값·빈 값·라벨 문자열은 보내지 않는다(fail-closed). */
  it.each([['SYN_GONE'], [''], ['Synthetic A']])('%s 는 통과하지 않는다', (code) => {
    expect(isKnownReason(options, code)).toBe(false);
  });

  it('선택지가 비어 있으면 어떤 값도 통과하지 않는다', () => {
    expect(isKnownReason([], 'SYN_A')).toBe(false);
  });
});
