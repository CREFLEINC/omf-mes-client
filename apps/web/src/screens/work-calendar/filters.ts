import type { CalendarFilters } from './types';

/**
 * 화면을 처음 열었을 때의 조회 조건. 예시 데이터가 아니라 화면 상수라 여기가 자리다.
 *
 * ⚠ **파일 이름이 `code-options` 가 아니다** — 형제 화면들의 같은 자리 파일은 공통코드 선택지를
 * 함께 담지만, 이 슬라이스에는 코드 선택지가 아직 없다. 일자 편집(사유 코드)이 들어올 때
 * 그 파일을 따로 만든다. **없는 것을 이름으로 예고하지 않는다.**
 */
export const defaultCalendarFilters: CalendarFilters = {
  q: '',
  includeInactive: false,
};
