import { describe, expect, it } from 'vitest';

import { autoJudgmentOf, expectedJudgmentOf, needsJudgmentChangeReason } from './judgment-change';

const draft = (accepted: string, rejected: string, held: string) => ({ accepted, rejected, held });

/** omf-all-around#125 — 서버 `expectedJudgment` 와 같은 규칙(장부 P-70). */
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

/** #197 — 검사 기준(합격판정개수)이 없어도 전량 합격이면 「합격」을 채운다. */
describe('autoJudgmentOf', () => {
  it('합격판정개수가 있으면 자동 판정과 같다', () => {
    expect(autoJudgmentOf(draft('94', '6', '0'), 5, 100)).toBe('REJECTED');
  });

  it.each([
    [draft('100', '', ''), 'ACCEPTED'],
    [draft('100', '0', '0'), 'ACCEPTED'],
    /* 불량이 하나라도 있으면 불합격 — 합계가 맞지 않아도(사용자 지시 2026-10-29). */
    [draft('99', '1', '0'), 'REJECTED'],
    [draft('50', '1', '0'), 'REJECTED'],
    [draft('99', '0', '1'), null],
    [draft('99', '', ''), null],
    [draft('101', '', ''), null],
    [draft('x', '', ''), null],
  ])('합격판정개수 없음 · 검사 수량 100 · %o → %s', (quantities, expected) => {
    expect(autoJudgmentOf(quantities, null, 100)).toBe(expected);
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
