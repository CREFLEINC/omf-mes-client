import { describe, expect, it } from 'vitest';

import { formatDateRange, formatLocalDateTime, formatTimeOfDay } from './date-display';

describe('date-display — 관리웹 날짜 표기(사용자 지시 2026-10-19)', () => {
  it('보는 사람 시계의 yyyy-MM-dd HH:mm — 두 자리, 24시간제, 초 없음', () => {
    expect(formatLocalDateTime(new Date(2026, 0, 2, 3, 4, 59))).toBe('2026-01-02 03:04');
    expect(formatLocalDateTime(new Date(2026, 9, 19, 14, 2).getTime())).toBe('2026-10-19 14:02');
  });

  it('범위는 A ~ B', () => {
    expect(formatDateRange('2026-10-16', '2026-10-19')).toBe('2026-10-16 ~ 2026-10-19');
  });

  it('시각만 있는 값은 HH:mm — 초를 떼고, 꼴이 다르면 그대로', () => {
    expect(formatTimeOfDay('08:00:00')).toBe('08:00');
    expect(formatTimeOfDay('20:30')).toBe('20:30');
    expect(formatTimeOfDay('미정')).toBe('미정');
  });
});
