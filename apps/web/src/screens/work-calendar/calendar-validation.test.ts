import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { CALENDAR_FORM_FIELDS, validateCalendar } from './calendar-validation';
import type { CalendarFormValues } from './types';

const t = messages.workCalendar.validation;

const make = (overrides: Partial<CalendarFormValues> = {}): CalendarFormValues => ({
  calendarCode: 'CAL-A',
  calendarName: '2026 기본',
  ...overrides,
});

describe('validateCalendar', () => {
  it('빈 값이 없으면 오류가 없다', () => {
    expect(validateCalendar(make())).toEqual({});
  });

  it.each(['calendarCode', 'calendarName'] as const)('%s 가 비면 막는다', (field) => {
    expect(validateCalendar(make({ [field]: '' }))[field]).toBe(t.required);
  });

  /* 공백만 친 것은 「비었다」와 다른 실수다 — 다른 말로 짚어야 무엇을 고칠지 안다. */
  it('코드가 공백뿐이면 다른 말로 짚는다', () => {
    expect(validateCalendar(make({ calendarCode: '   ' })).calendarCode).toBe(t.codeBlank);
    expect(t.codeBlank).not.toBe(t.required);
  });

  it('이름은 공백뿐이어도 「필수」다 — 이름은 다듬어 담는다', () => {
    expect(validateCalendar(make({ calendarName: '   ' })).calendarName).toBe(t.required);
  });
});

describe('CALENDAR_FORM_FIELDS', () => {
  /*
   * ⛔ **오류를 그릴 자리가 없는 칸을 넣으면 그 오류는 어디에도 표시되지 않는다.**
   * 두 이름이 모두 입력칸을 가진다는 것이 이 목록의 전제다.
   */
  it('폼 값의 이름과 정확히 같은 둘이다', () => {
    expect([...CALENDAR_FORM_FIELDS].sort()).toEqual(Object.keys(make()).sort());
  });
});
