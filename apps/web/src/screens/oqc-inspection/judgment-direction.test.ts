import { describe, expect, it } from 'vitest';

import { toJudgmentDirection } from './judgment-direction';

/**
 * 「틀려도 조용한 것」 — 방향을 잘못 그려도 화면은 멀쩡히 돌고, 사용자는 그 문장을 근거로
 * 되돌릴 수 없는 쓰기를 누른다.
 */
describe('toJudgmentDirection', () => {
  it('계약이 적어 둔 3값의 방향을 서로 다르게 낸다', () => {
    expect(toJudgmentDirection('ACCEPTED')).toBe('release');
    expect(toJudgmentDirection('REJECTED')).toBe('hold');
    expect(toJudgmentDirection('HELD')).toBe('pending');
  });

  it('모르는 코드에 방향을 지어내지 않는다', () => {
    expect(toJudgmentDirection('SOMETHING_NEW')).toBe('unknown');
    expect(toJudgmentDirection('')).toBe('unknown');
  });
});
