import { describe, expect, it } from 'vitest';

import {
  DEFAULT_TRANSITION_PERIOD_DAYS,
  defaultTransitionPeriod,
  toTransitionPeriodBounds,
  validateTransitionPeriod,
} from './period';

describe('Lot Status 전이 조회 기간', () => {
  it('오늘을 포함한 최근 30일을 기본값으로 만든다', () => {
    expect(DEFAULT_TRANSITION_PERIOD_DAYS).toBe(30);
    expect(defaultTransitionPeriod(new Date(2026, 7, 25))).toEqual({
      from: '2026-07-27',
      to: '2026-08-25',
    });
  });

  it('달·해와 윤년 경계를 지역 날짜로 넘긴다', () => {
    expect(defaultTransitionPeriod(new Date(2026, 0, 10))).toEqual({
      from: '2025-12-12',
      to: '2026-01-10',
    });
    expect(defaultTransitionPeriod(new Date(2028, 2, 1))).toEqual({
      from: '2028-02-01',
      to: '2028-03-01',
    });
  });

  it.each([
    [{ from: '', to: '2026-08-25' }, 'missing'],
    [{ from: '2026-08-01', to: '' }, 'missing'],
    [{ from: '2026-02-30', to: '2026-08-25' }, 'invalid'],
    [{ from: '2026-08-26', to: '2026-08-25' }, 'reversed'],
    [{ from: '2026-08-01', to: '2026-08-25' }, null],
  ] as const)('%j 기간을 %s로 판정한다', (period, expected) => {
    expect(validateTransitionPeriod(period)).toBe(expected);
  });

  it('⛔ 끝 경계는 반열림이다(L-3-1) — 종료일 익일 00:00:00을 서버용 date-time으로 만든다', () => {
    expect(toTransitionPeriodBounds({ from: '2026-08-01', to: '2026-08-25' }, 540)).toEqual({
      transitionFrom: '2026-08-01T00:00:00+09:00',
      transitionTo: '2026-08-26T00:00:00+09:00',
    });
    expect(toTransitionPeriodBounds({ from: '2026-08-01', to: '2026-08-25' }, -300)).toEqual({
      transitionFrom: '2026-08-01T00:00:00-05:00',
      transitionTo: '2026-08-26T00:00:00-05:00',
    });
  });

  it('⛔ 종료일이 월·해 경계에 있어도 다음 날로 넘어간다', () => {
    expect(toTransitionPeriodBounds({ from: '2026-08-01', to: '2026-08-31' }, 540)).toEqual({
      transitionFrom: '2026-08-01T00:00:00+09:00',
      transitionTo: '2026-09-01T00:00:00+09:00',
    });
    expect(toTransitionPeriodBounds({ from: '2026-12-01', to: '2026-12-31' }, 540)).toEqual({
      transitionFrom: '2026-12-01T00:00:00+09:00',
      transitionTo: '2027-01-01T00:00:00+09:00',
    });
  });
});
