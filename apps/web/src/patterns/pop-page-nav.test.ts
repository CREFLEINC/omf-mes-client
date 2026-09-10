import { describe, expect, it } from 'vitest';

import { pageBoundaryOf } from './pop-page-nav';

/**
 * 쪽 경계 판정 — **넘길 수 있는가**를 정하는 자리다(#1005).
 *
 * ⛔ 여기가 틀리면 [페이지 아래]가 없는 쪽을 청하거나, 있는 쪽을 잠근다. 둘 다 작업자에게는
 *    「목록이 고장났다」로 보인다.
 */
describe('pageBoundaryOf — 쪽 경계 판정 (#1005)', () => {
  it('못 받았으면 넘길 수 없다', () => {
    expect(pageBoundaryOf(undefined)).toEqual({
      page: 1,
      totalPages: 0,
      canPageUp: false,
      canPageDown: false,
    });
  });

  it('나머지가 있으면 쪽을 올려 잡는다 — 45건을 20씩이면 3쪽이다', () => {
    expect(pageBoundaryOf({ page: 1, size: 20, total: 45 }).totalPages).toBe(3);
  });

  it('첫 쪽에서는 위로 갈 수 없다', () => {
    const boundary = pageBoundaryOf({ page: 1, size: 20, total: 45 });

    expect(boundary.canPageUp).toBe(false);
    expect(boundary.canPageDown).toBe(true);
  });

  it('마지막 쪽에서는 아래로 갈 수 없다', () => {
    const boundary = pageBoundaryOf({ page: 3, size: 20, total: 45 });

    expect(boundary.canPageUp).toBe(true);
    expect(boundary.canPageDown).toBe(false);
  });

  it('한 쪽에 다 담기면 넘길 곳이 없다', () => {
    expect(pageBoundaryOf({ page: 1, size: 20, total: 7 })).toMatchObject({
      totalPages: 1,
      canPageUp: false,
      canPageDown: false,
    });
  });

  /*
   * ⛔ **`size` 가 0 으로 와도 나누지 않는다.** 0 으로 나누면 쪽 수가 `Infinity` 가 되어
   *    [페이지 아래]가 **영영 열린 채로 남고**, 작업자는 빈 쪽을 계속 청하게 된다.
   *    서버가 그렇게 보낼 리 없다고 두면 그날 화면이 멈춘다.
   */
  it('쪽 크기가 0 이어도 쪽 수가 무한이 되지 않는다', () => {
    const boundary = pageBoundaryOf({ page: 1, size: 0, total: 45 });

    expect(Number.isFinite(boundary.totalPages)).toBe(true);
    expect(boundary.totalPages).toBe(45);
  });

  it('쪽 번호가 0 이하로 와도 첫 쪽으로 본다', () => {
    expect(pageBoundaryOf({ page: 0, size: 20, total: 45 }).page).toBe(1);
  });

  it('한 건도 없으면 넘길 곳이 없다', () => {
    expect(pageBoundaryOf({ page: 1, size: 20, total: 0 })).toMatchObject({
      totalPages: 0,
      canPageDown: false,
    });
  });
});
