import { describe, expect, it } from 'vitest';

import { formatAsOf } from './as-of';

describe('formatAsOf', () => {
  it('응답이 도착한 시각을 분까지 옮긴다', () => {
    /* 실행 환경의 시간대로 읽는다 — 밀리초 수치를 현지 시각으로 만든 값과 견준다. */
    const at = new Date(2026, 7, 11, 16, 20, 45);

    expect(formatAsOf(at.getTime())).toBe('2026-08-11 16:20');
  });

  it('초를 내지 않는다 — 조회 시점이 초 단위로 읽힐 이유가 없다', () => {
    const at = new Date(2026, 7, 11, 16, 20, 45);

    expect(formatAsOf(at.getTime())).not.toContain('45');
  });

  it('한 자리 수를 0으로 채운다', () => {
    expect(formatAsOf(new Date(2026, 0, 3, 9, 5).getTime())).toBe('2026-01-03 09:05');
  });

  /**
   * ⭐ **아직 받은 자료가 없으면 `dataUpdatedAt`이 `0`이다.** 그대로 그리면 1970년이 서고,
   * 사용자는 그 시각의 알림을 본 것으로 읽는다 — 표기 자체를 내지 않는 것이 유일하게 참인 답이다.
   */
  it('아직 받은 자료가 없으면 표기를 내지 않는다', () => {
    expect(formatAsOf(0)).toBeNull();
    expect(formatAsOf(null)).toBeNull();
  });

  it('0 방어가 1970년을 막는다', () => {
    /* 방어가 없으면 이 값이 나온다 — 무엇이 잘못되는지 자리에 남긴다. */
    expect(formatAsOf(1)).toContain('1970');
    expect(formatAsOf(0)).toBeNull();
  });

  it('실행 환경의 시각을 스스로 읽지 않는다 — 같은 인자에 같은 결과다', () => {
    const at = new Date(2026, 7, 11, 16, 20).getTime();

    expect(formatAsOf(at)).toBe(formatAsOf(at));
  });
});
