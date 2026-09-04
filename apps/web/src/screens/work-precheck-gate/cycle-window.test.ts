import { describe, expect, it } from 'vitest';

import { cycleWindowStart } from './cycle-window';

const assignment = (
  cycleTypeCode: string,
  cycleInterval: number,
  cycleBaseDate: string | null,
) => ({ cycleTypeCode, cycleInterval, cycleBaseDate });

describe('cycleWindowStart', () => {
  it('일 주기는 오늘이 창의 시작이다', () => {
    expect(cycleWindowStart(assignment('DAY', 1, '2026-08-01'), '2026-09-04')).toBe('2026-09-04');
  });

  it('간격이 여러 날이면 기준일에서 그 배수만큼 떨어진 날이 창의 시작이다', () => {
    /* 08-01 에서 3일씩: 09-03 이 오늘을 포함하는 구간의 시작이다. */
    expect(cycleWindowStart(assignment('DAY', 3, '2026-08-01'), '2026-09-04')).toBe('2026-09-03');
  });

  it('주 주기는 기준일과 같은 요일이 창의 시작이다', () => {
    expect(cycleWindowStart(assignment('WEEK', 1, '2026-08-01'), '2026-09-04')).toBe('2026-08-29');
  });

  it('월 주기는 기준일의 날짜가 창의 시작이다', () => {
    expect(cycleWindowStart(assignment('MONTH', 1, '2026-08-01'), '2026-09-04')).toBe('2026-09-01');
  });

  it('월 주기의 시작일이 그 달에 없으면 그 달의 마지막 날로 당긴다', () => {
    expect(cycleWindowStart(assignment('MONTH', 1, '2026-01-31'), '2026-02-28')).toBe('2026-02-28');
  });

  it('오늘이 기준일의 날짜에 아직 못 미치면 지난 달 구간이다', () => {
    expect(cycleWindowStart(assignment('MONTH', 1, '2026-08-15'), '2026-09-04')).toBe('2026-08-15');
  });

  it('년 주기는 기준일의 월·일이 창의 시작이다', () => {
    expect(cycleWindowStart(assignment('YEAR', 1, '2024-03-10'), '2026-09-04')).toBe('2026-03-10');
  });

  /**
   * ⚠ 기준일이 비면 계약이 「부여일이 기준」이라고 적었는데 **부여일이 응답에 없다.**
   * 지어내지 않고 오늘을 창의 시작으로 둔다 — 가장 좁은 창이라 이력을 넓게 인정하지 않는다.
   */
  it('기준일이 비면 오늘을 창의 시작으로 둔다', () => {
    expect(cycleWindowStart(assignment('DAY', 1, null), '2026-09-04')).toBe('2026-09-04');
  });

  it('기준일이 아직 오지 않았으면 그 날이 창의 시작이다', () => {
    expect(cycleWindowStart(assignment('DAY', 1, '2026-12-01'), '2026-09-04')).toBe('2026-12-01');
  });

  /**
   * ⛔ 모르는 주기 단위를 임의로 해석하지 않는다 — 오늘 하루로 좁힌다. 넓게 잡으면 지난
   * 점검이 오늘 것으로 인정돼 **차단해야 할 작업이 열린다.**
   */
  it('모르는 주기 단위는 오늘 하루로 좁힌다', () => {
    expect(cycleWindowStart(assignment('SHIFT', 1, '2026-08-01'), '2026-09-04')).toBe('2026-09-04');
  });

  it('간격이 0 이하면 오늘 하루로 좁힌다', () => {
    expect(cycleWindowStart(assignment('DAY', 0, '2026-08-01'), '2026-09-04')).toBe('2026-09-04');
  });
});
