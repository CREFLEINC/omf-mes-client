import { describe, expect, it } from 'vitest';

import {
  dayFormValuesFrom,
  emptyFormValues,
  formValuesFrom,
  toCalendarCreate,
  toCalendarUpdate,
  toDayUpdate,
} from './mappers';
import { calendarDefault } from './fixtures';
import type { CalendarFormValues, DayFormValues } from './types';

const values = (overrides: Partial<CalendarFormValues> = {}): CalendarFormValues => ({
  calendarCode: 'CAL-A',
  calendarName: '2026 기본',
  ...overrides,
});

describe('formValuesFrom', () => {
  it('목록 행의 값을 폼 값으로 옮긴다', () => {
    expect(formValuesFrom(calendarDefault)).toEqual({
      calendarCode: 'CAL-A',
      calendarName: 'CAL-A 캘린더',
    });
  });

  /* ⛔ 사용 여부는 폼 값이 아니다 — 사용 중지는 다른 경로가 받는다. */
  it('사용 여부를 폼 값으로 옮기지 않는다', () => {
    expect(formValuesFrom(calendarDefault)).not.toHaveProperty('isActive');
  });
});

describe('emptyFormValues', () => {
  it('두 칸이 모두 비어 있다', () => {
    expect(emptyFormValues()).toEqual({ calendarCode: '', calendarName: '' });
  });
});

describe('toCalendarUpdate', () => {
  /*
   * ⭐ 계약이 「`calendarCode` 는 참조가 0일 때만 보낼 수 있다」고 못박았다 —
   * 잠긴 코드를 실으면 서버가 거절한다.
   */
  it('코드를 고칠 수 없으면 코드를 싣지 않는다', () => {
    expect(toCalendarUpdate(values(), false)).not.toHaveProperty('calendarCode');
    expect(toCalendarUpdate(values(), true).calendarCode).toBe('CAL-A');
  });

  /* ⛔ 사용 여부는 실리지 않는다 — 사용 중지는 `:deactivate` 가 받는다. */
  it('사용 여부를 싣지 않는다', () => {
    expect(toCalendarUpdate(values(), true)).not.toHaveProperty('isActive');
  });

  it('앞뒤 공백을 다듬는다', () => {
    const body = toCalendarUpdate(
      values({ calendarCode: '  CAL-A ', calendarName: ' 기본 ' }),
      true,
    );

    expect(body.calendarCode).toBe('CAL-A');
    expect(body.calendarName).toBe('기본');
  });
});

describe('toCalendarCreate', () => {
  /* 등록에는 잠긴 코드가 없다 — 아직 아무도 그 코드를 참조하지 않는다. */
  it('등록은 코드를 언제나 싣는다', () => {
    expect(toCalendarCreate(values()).calendarCode).toBe('CAL-A');
  });

  it('앞뒤 공백을 다듬는다', () => {
    expect(toCalendarCreate(values({ calendarName: '  기본  ' })).calendarName).toBe('기본');
  });
});

describe('dayFormValuesFrom', () => {
  it('설정을 폼 값으로 옮긴다', () => {
    expect(
      dayFormValuesFrom({
        calendarDate: '2026-08-05',
        dayTypeCode: 'PARTIAL',
        startTime: '08:00',
        endTime: '12:00',
        reasonCode: 'HALF',
        remarks: '창립기념일',
      }),
    ).toEqual({
      dayTypeCode: 'PARTIAL',
      startTime: '08:00',
      endTime: '12:00',
      reasonCode: 'HALF',
      remarks: '창립기념일',
    });
  });

  /* 설정이 없는 날은 「미설정」이라 구분도 고르지 않은 상태다 — 「가동」으로 채우지 않는다. */
  it('설정이 없으면 구분을 고르지 않은 빈 폼이다', () => {
    expect(dayFormValuesFrom(undefined)).toEqual({
      dayTypeCode: '',
      startTime: '',
      endTime: '',
      reasonCode: '',
      remarks: '',
    });
  });

  it('없는 값은 빈 칸으로 둔다', () => {
    const values = dayFormValuesFrom({ calendarDate: '2026-08-05', dayTypeCode: 'WORKING' });

    expect(values.startTime).toBe('');
    expect(values.reasonCode).toBe('');
  });
});

describe('toDayUpdate', () => {
  const values = (overrides: Partial<DayFormValues> = {}): DayFormValues => ({
    dayTypeCode: 'PARTIAL',
    startTime: '08:00',
    endTime: '12:00',
    reasonCode: 'HALF',
    remarks: '반일',
    ...overrides,
  });

  it('고치는 날을 그대로 싣는다', () => {
    expect(toDayUpdate('2026-08-05', values()).calendarDate).toBe('2026-08-05');
  });

  /*
   * ⭐ **부분 가동이 아니면 시각을 비운다.** 남겨 두면 서버 자료가 모순이 된다 —
   * 휴무인데 08:00~12:00 이 붙은 꼴이다.
   */
  it.each(['WORKING', 'HOLIDAY'])('%s 이면 시각을 비워 보낸다', (code) => {
    const body = toDayUpdate('2026-08-05', values({ dayTypeCode: code }));

    expect(body.startTime).toBeNull();
    expect(body.endTime).toBeNull();
  });

  it('부분 가동이면 시각을 그대로 보낸다', () => {
    const body = toDayUpdate('2026-08-05', values());

    expect(body.startTime).toBe('08:00');
    expect(body.endTime).toBe('12:00');
  });

  /* ⛔ 없는 것과 빈 것은 다르다 — 빈 글자를 보내면 「사유가 빈 문자열인 날」이 생긴다. */
  it.each(['', '   '])('사유가 %s 면 null 을 보낸다', (value) => {
    expect(toDayUpdate('2026-08-05', values({ reasonCode: value })).reasonCode).toBeNull();
  });

  it('사유와 비고의 앞뒤 공백을 다듬는다', () => {
    const body = toDayUpdate('2026-08-05', values({ reasonCode: ' HALF ', remarks: ' 반일 ' }));

    expect(body.reasonCode).toBe('HALF');
    expect(body.remarks).toBe('반일');
  });
});
