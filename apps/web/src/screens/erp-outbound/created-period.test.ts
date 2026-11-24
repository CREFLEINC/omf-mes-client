import { describe, expect, it } from 'vitest';

import { presetOf, presetPeriod, readCreatedPeriod } from './created-period';

const TODAY = new Date(2026, 9, 28);

describe('created-period', () => {
  it('최근 1주일 · 1개월은 오늘을 포함해 센다', () => {
    expect(presetPeriod('week', TODAY)).toEqual({ from: '2026-10-22', to: '2026-10-28' });
    expect(presetPeriod('month', TODAY)).toEqual({ from: '2026-09-29', to: '2026-10-28' });
    // 달 끝 — 3월 31일의 한 달은 3월 1일부터(2월에는 31일이 없다).
    expect(presetPeriod('month', new Date(2026, 2, 31))).toEqual({
      from: '2026-03-01',
      to: '2026-03-31',
    });
  });

  it('걸린 기간이 바로 고르는 범위와 같을 때만 그 이름을 낸다', () => {
    expect(presetOf(presetPeriod('week', TODAY), TODAY)).toBe('week');
    expect(presetOf(presetPeriod('month', TODAY), TODAY)).toBe('month');
    expect(presetOf({ from: '2026-10-01', to: '2026-10-28' }, TODAY)).toBeNull();
    expect(presetOf(null, TODAY)).toBeNull();
  });

  it('주소의 기간은 두 날짜가 다 맞을 때만 건다', () => {
    expect(readCreatedPeriod(new URLSearchParams('from=2026-10-01&to=2026-10-20'))).toEqual({
      from: '2026-10-01',
      to: '2026-10-20',
    });
    expect(readCreatedPeriod(new URLSearchParams('from=2026-10-01'))).toBeNull();
    expect(readCreatedPeriod(new URLSearchParams('from=2026-10-20&to=2026-10-01'))).toBeNull();
    expect(readCreatedPeriod(new URLSearchParams('from=bad&to=2026-10-01'))).toBeNull();
  });
});
