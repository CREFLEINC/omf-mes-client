import { describe, expect, it } from 'vitest';

import { byDate, dayStatusOf, partialHours, type WorkCalendarDay } from './day-status';

const day = (overrides: Partial<WorkCalendarDay> = {}): WorkCalendarDay => ({
  calendarDate: '2026-08-15',
  dayTypeCode: 'WORKING',
  ...overrides,
});

describe('dayStatusOf', () => {
  /*
   * ⭐ **「설정 없음」이 네 번째 갈래다.** 계약은 설정이 있는 날만 내려 준다 —
   * 받지 않은 날을 「가동」으로 그리면 실제로 쉬는 날이 일하는 날로 보인다(G-9).
   */
  it('설정이 없으면 「미설정」이지 「가동」이 아니다', () => {
    expect(dayStatusOf(undefined)).toBe('unset');
    expect(dayStatusOf(undefined)).not.toBe('working');
  });

  it.each([
    ['WORKING', 'working'],
    ['HOLIDAY', 'holiday'],
    ['PARTIAL', 'partial'],
  ] as const)('%s 는 %s 다', (code, expected) => {
    expect(dayStatusOf(day({ dayTypeCode: code }))).toBe(expected);
  });

  it('네 갈래가 서로 다르다', () => {
    const statuses = [
      dayStatusOf(undefined),
      dayStatusOf(day({ dayTypeCode: 'WORKING' })),
      dayStatusOf(day({ dayTypeCode: 'HOLIDAY' })),
      dayStatusOf(day({ dayTypeCode: 'PARTIAL' })),
    ];

    expect(new Set(statuses).size).toBe(4);
  });
});

describe('byDate', () => {
  it('날짜로 찾을 수 있게 담는다', () => {
    const map = byDate([day({ calendarDate: '2026-08-01' }), day({ calendarDate: '2026-08-02' })]);

    expect(map.get('2026-08-01')?.calendarDate).toBe('2026-08-01');
    expect(map.get('2026-08-03')).toBeUndefined();
  });

  /* 계약상 키가 캘린더와 일자라 그런 응답은 없어야 하지만, 왔을 때 둘 다 그리는 것보다 낫다. */
  it('같은 날짜가 두 번 오면 나중 것이 이긴다', () => {
    const map = byDate([
      day({ calendarDate: '2026-08-01', dayTypeCode: 'WORKING' }),
      day({ calendarDate: '2026-08-01', dayTypeCode: 'HOLIDAY' }),
    ]);

    expect(map.get('2026-08-01')?.dayTypeCode).toBe('HOLIDAY');
  });

  it('빈 목록도 받는다', () => {
    expect(byDate([]).size).toBe(0);
  });
});

describe('partialHours', () => {
  it('두 시각이 있으면 한 줄로 잇는다', () => {
    expect(partialHours(day({ startTime: '08:00', endTime: '12:00' }))).toBe('08:00~12:00');
  });

  /*
   * ⛔ **하나만 있으면 아무 말도 하지 않는다.** 언제부터인지 언제까지인지 알 수 없는데
   * 한쪽만 그리면 사용자가 나머지를 지어내 읽는다.
   */
  it.each([
    [{ startTime: '08:00' }],
    [{ endTime: '12:00' }],
    [{ startTime: '08:00', endTime: null }],
    [{ startTime: '', endTime: '12:00' }],
  ])('한쪽만 있으면 %s 아무 말도 하지 않는다', (overrides) => {
    expect(partialHours(day(overrides))).toBeNull();
  });

  it('설정이 없으면 아무 말도 하지 않는다', () => {
    expect(partialHours(undefined)).toBeNull();
  });
});
