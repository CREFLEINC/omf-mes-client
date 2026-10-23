import { describe, expect, it } from 'vitest';

import { expectedJudgmentOf, needsJudgmentChangeReason } from './judgment-change';

const draft = (accepted: string, rejected: string, held: string) => ({ accepted, rejected, held });

/** omf-all-around#126 — 서버 `expectedJudgment` 와 같은 규칙(장부 P-70). */
describe('expectedJudgmentOf', () => {
  it.each([
    [draft('100', '0', '0'), 'ACCEPTED'],
    [draft('95', '5', '0'), 'ACCEPTED'],
    [draft('94', '6', '0'), 'REJECTED'],
    [draft('95', '3', '2'), 'HELD'],
    [draft('80', '10', '10'), 'REJECTED'],
    [draft('', '', ''), 'ACCEPTED'],
  ])('합격판정개수 5 · %o → %s', (quantities, expected) => {
    expect(expectedJudgmentOf(quantities, 5)).toBe(expected);
  });

  it('합격판정개수가 없으면 자동 판정이 없다', () => {
    expect(expectedJudgmentOf(draft('90', '10', '0'), null)).toBeNull();
  });

  it('수량이 아닌 값이 있으면 판정하지 않는다', () => {
    expect(expectedJudgmentOf(draft('90', 'x', '0'), 5)).toBeNull();
  });
});

describe('needsJudgmentChangeReason', () => {
  it('자동 판정과 다르게 고르면 사유가 필요하다', () => {
    expect(needsJudgmentChangeReason('ACCEPTED', 'REJECTED')).toBe(true);
    expect(needsJudgmentChangeReason('REJECTED', 'REJECTED')).toBe(false);
    expect(needsJudgmentChangeReason('', 'REJECTED')).toBe(false);
    expect(needsJudgmentChangeReason('ACCEPTED', null)).toBe(false);
  });
});
