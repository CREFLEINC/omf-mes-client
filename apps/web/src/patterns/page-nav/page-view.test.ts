import { describe, expect, it } from 'vitest';

import { toPageView } from './page-view';

describe('toPageView', () => {
  it('서버가 준 쪽을 정본으로 쓴다', () => {
    const view = toPageView({ page: 2, size: 50, total: 120 });

    expect(view.page).toBe(2);
    expect(view.totalPages).toBe(3);
    expect(view.canPrev).toBe(true);
    expect(view.canNext).toBe(true);
  });

  it('첫 쪽에서는 이전으로 갈 수 없다', () => {
    expect(toPageView({ page: 1, size: 50, total: 120 }).canPrev).toBe(false);
  });

  it('마지막 쪽에서는 다음으로 갈 수 없다', () => {
    expect(toPageView({ page: 3, size: 50, total: 120 }).canNext).toBe(false);
  });

  /* 「결과가 없다」와 「이 쪽에는 없다」는 사용자가 할 조치가 다르다. */
  it('결과가 있는데 이 쪽에 없으면 쪽 밖으로 본다', () => {
    expect(toPageView({ page: 5, size: 50, total: 120 }).isBeyondLast).toBe(true);
  });

  it('결과 자체가 없으면 쪽 밖이 아니다', () => {
    expect(toPageView({ page: 1, size: 50, total: 0 }).isBeyondLast).toBe(false);
  });

  it('쪽 크기가 0이어도 계산이 깨지지 않는다', () => {
    const view = toPageView({ page: 0, size: 0, total: 3 });

    expect(view.page).toBe(1);
    expect(Number.isFinite(view.totalPages)).toBe(true);
  });
});
