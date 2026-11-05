import { describe, expect, it } from 'vitest';
import { planWeek, shiftPlanDate } from './plan-view-model';

describe('생산계획 주간 날짜', () => {
  it('연도 경계를 넘어도 월요일부터 일요일까지 공장 날짜를 유지한다', () => {
    expect(planWeek('2027-01-01')).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);
  });
  it('일요일을 다음 주로 넘기지 않으며 윤년의 날짜를 보존한다', () => {
    expect(planWeek('2026-11-08')[0]).toBe('2026-11-02');
    expect(shiftPlanDate('2028-02-28', 1)).toBe('2028-02-29');
    expect(shiftPlanDate('2026-11-02', -7)).toBe('2026-10-26');
  });
  it('입력 중인 불완전 날짜와 존재하지 않는 날짜를 일정으로 만들지 않는다', () => {
    expect(planWeek('')).toEqual([]);
    expect(planWeek('2026-02-30')).toEqual([]);
    expect(planWeek('2026-1')).toEqual([]);
  });
});
