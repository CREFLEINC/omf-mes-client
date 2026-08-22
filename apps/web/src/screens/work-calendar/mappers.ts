import type { components } from '@omf-mes/api-client';

import type { CalendarFormValues, WorkCalendar } from './types';

type WorkCalendarCreate = components['schemas']['WorkCalendarCreate'];
type WorkCalendarUpdate = components['schemas']['WorkCalendarUpdate'];

/** 목록 행을 폼 값으로. */
export const formValuesFrom = (calendar: WorkCalendar): CalendarFormValues => ({
  calendarCode: calendar.calendarCode,
  calendarName: calendar.calendarName,
});

export const emptyFormValues = (): CalendarFormValues => ({
  calendarCode: '',
  calendarName: '',
});

/**
 * 캘린더 수정 요청 본문.
 *
 * ⛔ **`isActive` 는 실리지 않는다** — 사용 중지는 `:deactivate` 가 받는다.
 * ⭐ **잠긴 코드는 아예 싣지 않는다** — 계약이 「참조가 0일 때만 보낼 수 있다」고 못박았다.
 */
export const toCalendarUpdate = (
  values: CalendarFormValues,
  codeEditable: boolean,
): WorkCalendarUpdate => ({
  ...(codeEditable ? { calendarCode: values.calendarCode.trim() } : {}),
  calendarName: values.calendarName.trim(),
});

/** 캘린더 등록 요청 본문. 등록에는 잠긴 코드가 없다 — 아직 아무도 참조하지 않는다. */
export const toCalendarCreate = (values: CalendarFormValues): WorkCalendarCreate => ({
  calendarCode: values.calendarCode.trim(),
  calendarName: values.calendarName.trim(),
});
