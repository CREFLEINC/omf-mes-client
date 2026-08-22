import type { components } from '@omf-mes/api-client';

export type WorkCalendarDay = components['schemas']['WorkCalendarDay'];

/**
 * 칸 하나가 그릴 것.
 *
 * ⭐ **「설정 없음」이 네 번째 갈래다.** 계약은 **설정이 있는 날만** 내려 준다 — 받지 않은 날을
 * 「가동」으로 그리면 **실제로 쉬는 날이 일하는 날로 보인다.** 아직 정하지 않은 것과 가동으로
 * 정한 것은 다른 사실이다(공유계약 G-9).
 */
export type DayStatus = 'unset' | 'working' | 'holiday' | 'partial';

/** 설정을 상태로. 계약의 세 값 밖이 오면 「모른다」로 다루지 않고 그대로 되돌린다. */
export const dayStatusOf = (day: WorkCalendarDay | undefined): DayStatus => {
  if (day === undefined) return 'unset';

  switch (day.dayTypeCode) {
    case 'WORKING':
      return 'working';
    case 'HOLIDAY':
      return 'holiday';
    case 'PARTIAL':
      return 'partial';
  }
};

/**
 * 날짜로 찾을 수 있게 담는다. **같은 날짜가 두 번 오면 나중 것이 이긴다** —
 * 계약상 캘린더와 일자가 키라 그런 응답은 없어야 하지만, 왔을 때 조용히 둘 다 그리는 것보다
 * 하나를 고르는 편이 낫다.
 */
export const byDate = (items: readonly WorkCalendarDay[]): Map<string, WorkCalendarDay> =>
  new Map(items.map((item) => [item.calendarDate, item]));

/**
 * 부분 가동의 시각 두 칸을 한 줄로. **둘 다 있어야 뜻이 선다** — 하나만 있으면 언제부터인지
 * 언제까지인지 알 수 없어, 지어내지 않고 아무 말도 하지 않는다.
 */
export const partialHours = (day: WorkCalendarDay | undefined): string | null => {
  if (day === undefined) return null;

  const start = day.startTime;
  const end = day.endTime;

  if (start === null || start === undefined || start === '') return null;
  if (end === null || end === undefined || end === '') return null;

  return `${start}~${end}`;
};
