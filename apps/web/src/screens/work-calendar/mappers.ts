import type { components } from '@omf-mes/api-client';

import type { CalendarFormValues, DayFormValues, WorkCalendar } from './types';

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

type WorkCalendarDay = components['schemas']['WorkCalendarDay'];

/** 하루 설정을 폼 값으로. 설정이 없는 날은 빈 폼이되 구분은 고르지 않은 상태다. */
export const dayFormValuesFrom = (day: WorkCalendarDay | undefined): DayFormValues => ({
  dayTypeCode: day?.dayTypeCode ?? '',
  startTime: day?.startTime ?? '',
  endTime: day?.endTime ?? '',
  reasonCode: day?.reasonCode ?? '',
  remarks: day?.remarks ?? '',
});

/**
 * 하루 설정 요청 본문 한 건.
 *
 * ⭐ **부분 가동이 아니면 시각을 비운다.** 짝 제약이 「부분 가동일 때만 뜻이 있다」는 말이므로
 * 값을 남겨 두면 서버 자료가 모순 상태가 된다 — 휴무인데 08:00~12:00 이 붙은 꼴이다.
 * 폼에는 남겨 둔다(다시 부분 가동으로 바꾸면 방금 적은 것이 그대로 있다) —
 * **비우는 자리는 보낼 때 하나다.**
 *
 * ⛔ **빈 글자를 그대로 보내지 않는다** — 계약이 `null` 을 받는 자리라, 빈 글자를 보내면
 * 「사유가 빈 문자열인 날」이 생긴다. 없는 것과 빈 것은 다르다.
 */
export const toDayUpdate = (calendarDate: string, values: DayFormValues): WorkCalendarDay => {
  const onPartial = values.dayTypeCode === 'PARTIAL';

  return {
    calendarDate,
    dayTypeCode: values.dayTypeCode as WorkCalendarDay['dayTypeCode'],
    startTime: onPartial ? blankToNull(values.startTime) : null,
    endTime: onPartial ? blankToNull(values.endTime) : null,
    reasonCode: blankToNull(values.reasonCode),
    remarks: blankToNull(values.remarks),
  };
};

const blankToNull = (value: string): string | null => (value.trim() === '' ? null : value.trim());
