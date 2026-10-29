import { describe, expect, it } from 'vitest';

import { autoJudgmentOf } from './web-steps';

const draft = (accepted: string, rejected: string, held: string) => ({ accepted, rejected, held });

/** PQC [확정] 때 채우는 최종 판정(사용자 지시 2026-10-29 · #197) — IQC 와 같은 규칙. */
describe('autoJudgmentOf (PQC)', () => {
  it.each([
    [draft('100', '', ''), 'ACCEPTED'],
    [draft('100', '0', '0'), 'ACCEPTED'],
    [draft('99', '1', '0'), 'REJECTED'],
    [draft('50', '1', '0'), 'REJECTED'],
    [draft('99', '0', '1'), null],
    [draft('99', '', ''), null],
    [draft('x', '', ''), null],
  ])('검사 수량 100 · %o → %s', (quantities, expected) => {
    expect(autoJudgmentOf(quantities, 100)).toBe(expected);
  });
});
