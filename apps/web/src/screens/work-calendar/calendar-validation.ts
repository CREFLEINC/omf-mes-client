import { messages } from '@omf-mes/i18n';

import type { CalendarFormValues } from './types';

const t = messages.workCalendar.validation;

/**
 * 서버가 준 필드 오류를 **인라인으로 낼 수 있는** 칸 이름.
 *
 * ⛔ **오류를 그릴 자리가 없는 칸을 넣지 않는다** — 넣으면 그 오류는 인라인으로 분류된 뒤
 * 아무 데도 그려지지 않아 어디에도 표시되지 않는 오류가 된다.
 */
export const CALENDAR_FORM_FIELDS: readonly string[] = ['calendarCode', 'calendarName'];

/** 보내기 전에 화면에서 잡을 수 있는 것만 잡는다. 코드 중복은 서버 몫이다. */
export const validateCalendar = (values: CalendarFormValues): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (values.calendarCode === '') {
    errors.calendarCode = t.required;
  } else if (values.calendarCode.trim() === '') {
    errors.calendarCode = t.codeBlank;
  }

  if (values.calendarName.trim() === '') {
    errors.calendarName = t.required;
  }

  return errors;
};
