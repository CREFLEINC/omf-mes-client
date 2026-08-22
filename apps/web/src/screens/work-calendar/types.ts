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

/**
 * 하루 편집 폼이 들고 있는 값.
 *
 * ⛔ **날짜가 여기 없다** — 어느 날을 고치는지는 창을 여는 쪽이 안다. 폼 값에 두면 고치는
 * 도중 날짜가 바뀔 수 있는 모양이 되고, 그때 사용자가 본 날과 저장되는 날이 갈린다.
 */
export interface DayFormValues {
  /** `WORKING` · `HOLIDAY` · `PARTIAL`. 계약이 정한 세 값이다 */
  dayTypeCode: string;
  /** 부분 가동일 때만 쓴다. **수가 아니라 글자로 든다** — `08:0` 같은 중간 입력을 지킨다 */
  startTime: string;
  endTime: string;
  reasonCode: string;
  remarks: string;
}

/**
 * 일괄 적용 폼이 들고 있는 값.
 *
 * ⭐ **적용할 설정은 하루 편집과 같은 모양을 쓴다** — 두 벌을 두면 한쪽만 고쳐진다.
 */
export interface BulkFormValues {
  from: string;
  to: string;
  /** 고른 요일(0=일). **비어 있으면 기간 전체**다 */
  weekdays: number[];
  day: DayFormValues;
}
