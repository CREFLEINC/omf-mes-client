import { describe, expect, it } from 'vitest';

import { formatAsOf, formatHeldAt } from './as-of';

describe('formatAsOf', () => {
  it('null이나 0(아직 받지 못함)이면 표기하지 않는다', () => {
    expect(formatAsOf(null)).toBeNull();
    expect(formatAsOf(0)).toBeNull();
  });

  it('현지 시각으로 YYYY-MM-DD HH:mm을 낸다', () => {
    const at = new Date(2026, 7, 6, 9, 12, 30).getTime();

    expect(formatAsOf(at)).toBe('2026-08-06 09:12');
  });
});

describe('formatHeldAt', () => {
  it('시간대가 붙은 값을 MM-DD HH:mm으로 줄인다', () => {
    expect(formatHeldAt('2026-08-06T09:12:00+09:00')).toBe('08-06 09:12');
  });

  it('깨진 값에는 표기를 지어내지 않고 원래 값을 낸다', () => {
    expect(formatHeldAt('not-a-date')).toBe('not-a-date');
  });
});
