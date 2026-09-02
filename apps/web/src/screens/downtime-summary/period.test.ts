import { describe, expect, it } from 'vitest';

import { DEFAULT_PERIOD_DAYS, defaultPeriod, periodLockReason, resolvePeriod } from './period';

describe('defaultPeriod', () => {
  it('오늘을 마지막 날로 두고 한 달치를 고른다 — 오늘을 포함해 센다', () => {
    expect(defaultPeriod(new Date(2026, 7, 31))).toEqual({
      from: '2026-08-02',
      to: '2026-08-31',
    });
  });

  it('달 경계를 넘어간다', () => {
    expect(defaultPeriod(new Date(2026, 0, 10)).from).toBe('2025-12-12');
  });

  it('윤년 2월을 건너뛰지 않는다', () => {
    expect(defaultPeriod(new Date(2024, 2, 1)).from).toBe('2024-02-01');
  });

  it('길이가 상수와 맞는다', () => {
    expect(DEFAULT_PERIOD_DAYS).toBe(30);
  });
});

describe('resolvePeriod', () => {
  /**
   * ⭐ 이 화면의 두 칸은 계약에서 **`date`**다. 형제 화면들이 쓰는 `date-time` 반열림 규약
   * (끝 경계를 익일 00:00으로 미는 것)을 여기로 옮겨 오면 **하루가 통째로 밀린다.**
   */
  it('고른 날짜를 그대로 보낸다 — 끝 경계를 익일로 밀지 않는다', () => {
    const state = resolvePeriod({ from: '2026-08-01', to: '2026-08-18' });

    expect(state).toEqual({
      kind: 'ready',
      query: { startedFrom: '2026-08-01', startedTo: '2026-08-18' },
    });
  });

  it('하루짜리 기간도 통과한다', () => {
    expect(resolvePeriod({ from: '2026-08-18', to: '2026-08-18' }).kind).toBe('ready');
  });

  it('비어 있으면 막고 채우라고 말한다', () => {
    expect(periodLockReason({ from: '', to: '2026-08-18' })).toContain('기간');
    expect(periodLockReason({ from: '2026-08-01', to: '' })).not.toBeNull();
  });

  /** 달력에 없는 날을 「두 날짜를 바꾸세요」로 안내하면 바꿔도 풀리지 않는다. */
  it('달력에 없는 날은 「바꾸세요」가 아니라 「다시 고르세요」다', () => {
    const reason = periodLockReason({ from: '2026-02-31', to: '2026-03-01' });

    expect(reason).toBe('달력에 없는 날짜입니다. 시작일과 종료일을 다시 고르세요.');
  });

  it('뒤집힌 기간을 막는다', () => {
    expect(periodLockReason({ from: '2026-08-18', to: '2026-08-01' })).toContain('앞섭니다');
  });

  it('통과하면 막는 사유가 없다', () => {
    expect(periodLockReason({ from: '2026-08-01', to: '2026-08-18' })).toBeNull();
  });
});
