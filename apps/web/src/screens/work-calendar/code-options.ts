import type { CalendarFilters } from './types';

/** 화면을 처음 열었을 때의 조회 조건. 예시 데이터가 아니라 화면 상수라 여기가 자리다. */
export const defaultCalendarFilters: CalendarFilters = {
  q: '',
  includeInactive: false,
};
