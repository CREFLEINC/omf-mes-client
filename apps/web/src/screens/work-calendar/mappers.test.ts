import { describe, expect, it } from 'vitest';

import { emptyFormValues, formValuesFrom, toCalendarCreate, toCalendarUpdate } from './mappers';
import { calendarDefault } from './fixtures';
import type { CalendarFormValues } from './types';

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
