import { describe, expect, it } from 'vitest';

import { LIST_REFRESH_MS, listRefetchInterval } from './queries';

/**
 * 목록의 자료를 만드는 것은 이 화면이 아니다 — PDA 로 등록한 입하가 **스스로 떠야** 한다
 * (omf-all-around#29). 그 간격과, 멈춰야 하는 한 자리를 잰다.
 */
describe('listRefetchInterval', () => {
  it('쉬는 중에는 주기 갱신이 돈다', () => {
    expect(listRefetchInterval(false)).toBe(LIST_REFRESH_MS);
  });

  /**
   * ⛔ 등록·인쇄가 도는 사이에 목록이 바뀌면 고른 줄이 빠질 수 있고, 그때 발번 대상 카드가 빈
   *    상태로 돌아가 「인쇄 중인데 아무것도 고르지 않은 화면」이 된다(#1241).
   */
  it('실행 중에는 멈춘다', () => {
    expect(listRefetchInterval(true)).toBe(false);
  });

  /** 걸어오는 동안 한 번은 돌아야 하고, 초 단위로 조일 이유는 없다. */
  it('간격이 사람이 걸어오는 시간 안에 있다', () => {
    expect(LIST_REFRESH_MS).toBeGreaterThanOrEqual(10_000);
    expect(LIST_REFRESH_MS).toBeLessThanOrEqual(60_000);
  });
});
