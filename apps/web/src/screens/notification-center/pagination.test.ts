import { describe, expect, it } from 'vitest';

import { toPageView } from './pagination';

describe('toPageView', () => {
  it('서버가 준 쪽을 정본으로 쓴다', () => {
    /* 주소의 쪽 번호를 쓰면 서버가 다른 쪽을 돌려줬을 때 표시와 내용이 어긋난다. */
    expect(toPageView({ page: 3, size: 50, total: 137 }).page).toBe(3);
  });

  it('쪽 수가 응답의 size에서 나온다 — 화면이 쪽 크기를 지어내지 않는다', () => {
    expect(toPageView({ page: 1, size: 50, total: 137 }).totalPages).toBe(3);
    expect(toPageView({ page: 1, size: 20, total: 45 }).totalPages).toBe(3);
  });

  /**
   * ⭐ **결과가 있는데 이 쪽에 없는 것은 0건과 다르다.** 가르지 않으면 사용자가 조건을 헛되이
   * 넓힌다 — 넓혀도 그 쪽에는 여전히 아무것도 없다.
   */
  it('결과가 있는데 이 쪽에 없으면 그 사실을 든다', () => {
    expect(toPageView({ page: 9, size: 50, total: 137 }).isBeyondLast).toBe(true);
  });

  it('결과가 0건이면 넘어선 쪽이 아니다 — 그 둘은 다른 사태다', () => {
    expect(toPageView({ page: 1, size: 50, total: 0 }).isBeyondLast).toBe(false);
    expect(toPageView({ page: 3, size: 50, total: 0 }).isBeyondLast).toBe(false);
  });

  it('마지막 쪽 자체는 넘어선 것이 아니다', () => {
    expect(toPageView({ page: 3, size: 50, total: 137 }).isBeyondLast).toBe(false);
  });

  it('서버가 0을 줘도 계산이 깨지지 않는다', () => {
    /* size가 0이면 나눗셈이 무한대가 되어 totalPages가 Infinity로 샌다. */
    const view = toPageView({ page: 0, size: 0, total: 0 });

    expect(view.page).toBe(1);
    expect(Number.isFinite(view.totalPages)).toBe(true);
  });
});
