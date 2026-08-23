import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { endAvailability, validateEndDate } from './end-policy';
import { makeRatio } from './fixtures';

const t = messages.shotConversion.end;

describe('끝낼 수 있는가', () => {
  it('끝이 없는 정책은 끝낼 수 있다', () => {
    expect(endAvailability(makeRatio(1, 1))).toEqual({ can: true, reason: null });
  });

  /** ⛔ 감추지 않고 사유와 함께 잠근다 — 감추면 「왜 이 줄에는 종료가 없지」가 된다. */
  it('이미 끝난 정책은 사유와 함께 잠긴다', () => {
    const availability = endAvailability(makeRatio(1, 1, { effectiveTo: '2026-12-31' }));

    expect(availability.can).toBe(false);
    expect(availability.reason).toBe(t.alreadyEnded);
  });

  /**
   * ⚠ **오늘이 아니라 «종료일이 있는가»로 잰다.** 오늘로 재면 «앞으로» 끝나기로 예정된
   * 정책이 「아직 안 끝났으니 끝낼 수 있다」가 되어, 사용자가 이미 정해 둔 종료일을
   * 모른 채 덮어쓴다.
   */
  it('앞으로 끝날 예정인 정책도 이미 정해진 것으로 본다', () => {
    expect(endAvailability(makeRatio(1, 1, { effectiveTo: '2099-12-31' })).can).toBe(false);
  });

  it('빈 문자열은 끝이 없는 것으로 본다', () => {
    expect(endAvailability(makeRatio(1, 1, { effectiveTo: '' })).can).toBe(true);
  });
});

describe('고른 종료일', () => {
  const policy = makeRatio(1, 1, { effectiveFrom: '2026-03-01' });

  it('고르지 않았으면 고르라고 한다', () => {
    expect(validateEndDate(policy, '')).toBe(t.dateRequired);
  });

  it('시작일보다 뒤면 통과한다', () => {
    expect(validateEndDate(policy, '2026-12-31')).toBeNull();
  });

  /** ⭐ 같은 날은 허용한다 — 계약이 「종료 ≥ 시작」이다. */
  it('시작일과 같은 날은 통과한다', () => {
    expect(validateEndDate(policy, '2026-03-01')).toBeNull();
  });

  /** ⭐ 문구에 그 시작일을 담는다 — 그것이 언제인지 창에서 알 길이 없다. */
  it('시작일보다 앞이면 그 시작일을 문구에 담아 짚는다', () => {
    expect(validateEndDate(policy, '2026-01-01')).toBe(t.dateBeforeStart('2026-03-01'));
  });
});
