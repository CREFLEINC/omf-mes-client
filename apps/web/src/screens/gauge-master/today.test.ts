import { afterEach, describe, expect, it, vi } from 'vitest';

import { todayIso } from './today';

afterEach(() => {
  vi.useRealTimers();
});

/** 시험이 도는 곳의 시간대. UTC면 로컬/UTC가 갈리지 않아 이 시험은 뜻이 없다. */
const offsetMinutes = new Date('2026-03-10T00:30:00+09:00').getTimezoneOffset();

describe('오늘', () => {
  it('로컬 달력의 날짜를 준다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 10, 12, 0, 0));

    expect(todayIso()).toBe('2026-03-10');
  });

  it('한 자리 월·일을 0으로 채운다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 12, 0, 0));

    expect(todayIso()).toBe('2026-01-05');
  });

  /*
   * ⛔ `toISOString()` 은 UTC 달력이라 UTC+ 지역의 이른 아침에 «어제»를 준다.
   * 그러면 만료일이 오늘인 계측기가 아침에는 「1일 남음」으로 보인다.
   */
  it.runIf(offsetMinutes < 0)('UTC 날짜가 하루 이르더라도 로컬 날짜를 준다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 10, 0, 30, 0));

    expect(new Date().toISOString().slice(0, 10)).toBe('2026-03-09');
    expect(todayIso()).toBe('2026-03-10');
  });
});
