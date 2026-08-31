import { describe, expect, it } from 'vitest';

import { toHistoryPeriodBounds, validateHistoryPeriod } from './period';

describe('validateHistoryPeriod', () => {
  it('두 실존 날짜가 순서대로 있으면 유효하다', () => {
    expect(validateHistoryPeriod({ from: '2026-08-01', to: '2026-08-07' })).toBeNull();
  });

  it.each([
    { from: '', to: '2026-08-07' },
    { from: '2026-08-01', to: '' },
    { from: '', to: '' },
  ])('기간 한쪽 이상이 비면 missing이다: $from ~ $to', (period) => {
    expect(validateHistoryPeriod(period)).toBe('missing');
  });

  it.each([
    { from: '2026-8-01', to: '2026-08-07' },
    { from: '2026-08-01', to: '2026/08/07' },
    { from: '2026-02-31', to: '2026-08-07' },
    { from: '2026-08-01', to: '2026-13-01' },
  ])('형식이 틀리거나 존재하지 않는 날짜는 invalid이다: $from ~ $to', (period) => {
    expect(validateHistoryPeriod(period)).toBe('invalid');
  });

  it('시작일이 종료일보다 늦으면 reversed이다', () => {
    expect(validateHistoryPeriod({ from: '2026-08-08', to: '2026-08-07' })).toBe('reversed');
  });

  it('시작일과 종료일이 같은 날이어도 유효하다', () => {
    expect(validateHistoryPeriod({ from: '2026-08-07', to: '2026-08-07' })).toBeNull();
  });

  it('윤년의 2월 29일은 허용하고 평년의 2월 29일은 거부한다', () => {
    expect(validateHistoryPeriod({ from: '2024-02-29', to: '2024-02-29' })).toBeNull();
    expect(validateHistoryPeriod({ from: '2026-02-29', to: '2026-03-01' })).toBe('invalid');
  });
});

describe('toHistoryPeriodBounds', () => {
  it.each([
    {
      offsetMinutes: 540,
      expected: {
        from: '2026-08-01T00:00:00+09:00',
        to: '2026-08-08T00:00:00+09:00',
      },
    },
    {
      offsetMinutes: -300,
      expected: {
        from: '2026-08-01T00:00:00-05:00',
        to: '2026-08-08T00:00:00-05:00',
      },
    },
    {
      offsetMinutes: 330,
      expected: {
        from: '2026-08-01T00:00:00+05:30',
        to: '2026-08-08T00:00:00+05:30',
      },
    },
    {
      offsetMinutes: 0,
      expected: {
        from: '2026-08-01T00:00:00+00:00',
        to: '2026-08-08T00:00:00+00:00',
      },
    },
  ])(
    '⛔ 끝 경계는 반열림이다(L-3-1) — 종료일 익일 00:00:00을 $offsetMinutes분 offset으로 만든다',
    ({ offsetMinutes, expected }) => {
      expect(
        toHistoryPeriodBounds({ from: '2026-08-01', to: '2026-08-07' }, offsetMinutes),
      ).toEqual(expected);
    },
  );

  it('⛔ 종료일이 월·해 경계에 있어도 다음 날로 넘어간다', () => {
    expect(toHistoryPeriodBounds({ from: '2026-08-01', to: '2026-08-31' }, 540)).toEqual({
      from: '2026-08-01T00:00:00+09:00',
      to: '2026-09-01T00:00:00+09:00',
    });
    expect(toHistoryPeriodBounds({ from: '2026-12-01', to: '2026-12-31' }, 540)).toEqual({
      from: '2026-12-01T00:00:00+09:00',
      to: '2027-01-01T00:00:00+09:00',
    });
  });

  it('입력 기간 객체를 변경하지 않는다', () => {
    const period = { from: '2026-08-01', to: '2026-08-07' };

    toHistoryPeriodBounds(period, 540);

    expect(period).toEqual({ from: '2026-08-01', to: '2026-08-07' });
  });
});
