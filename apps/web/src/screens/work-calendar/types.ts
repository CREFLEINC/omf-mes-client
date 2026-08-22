import type { components } from '@omf-mes/api-client';

/** 작업 캘린더 하나. 코드와 이름과 사용 여부뿐이고, **내용은 일자가 갖는다.** */
export type WorkCalendar = components['schemas']['WorkCalendar'];

export interface CalendarFilters {
  q: string;
  includeInactive: boolean;
}

/**
 * 폼이 들고 있는 값.
 *
 * ⛔ **`isActive` 가 여기 없다** — 사용 중지는 `:deactivate` 가 받는다(계약이 수정 본문에
 * 두지 않았다). 폼 값에 두면 언젠가 스위치가 붙고, 그때 두 경로가 같은 컬럼을 두고 경합한다.
 */
export interface CalendarFormValues {
  calendarCode: string;
  calendarName: string;
}
