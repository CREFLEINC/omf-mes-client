import { describe, expect, it } from 'vitest';

import { toPageView } from './pagination';

/** 쪽 계산 — 「지금 어디를 보고 있는가」와 「어디로 갈 수 있는가」. */

describe('toPageView', () => {
  it('서버가 준 쪽을 정본으로 쓴다', () => {
    const view = toPageView({ page: 2, size: 20, total: 45 }, 20);

    expect(view.page).toBe(2);
    expect(view.totalPages).toBe(3);
    expect(view.canPrev).toBe(true);
    expect(view.canNext).toBe(true);
    expect(view.isBeyondLast).toBe(false);
  });

  it('첫 쪽에서는 이전으로 갈 수 없다', () => {
    const view = toPageView({ page: 1, size: 20, total: 45 }, 20);

    expect(view.canPrev).toBe(false);
    expect(view.canNext).toBe(true);
  });

  it('마지막 쪽에서는 다음으로 갈 수 없다', () => {
    const view = toPageView({ page: 3, size: 20, total: 45 }, 5);

    expect(view.canPrev).toBe(true);
    expect(view.canNext).toBe(false);
  });

  it('결과는 있는데 이 쪽에 없으면 범위 밖이다', () => {
    const view = toPageView({ page: 4, size: 20, total: 45 }, 0);

    expect(view.isBeyondLast).toBe(true);
  });

  it('결과가 아예 없으면 범위 밖이 아니다', () => {
    // 「조건에 맞는 것이 없다」와 「이 쪽에 없다」는 사용자가 할 조치가 다르다.
    expect(toPageView({ page: 1, size: 20, total: 0 }, 0).isBeyondLast).toBe(false);
  });

  it('보이는 범위를 문구로 낸다', () => {
    expect(toPageView({ page: 3, size: 20, total: 45 }, 5).rangeLabel).toBe('41–45 / 전체 45건');
  });

  it('보이는 것이 없으면 범위를 지어내지 않는다', () => {
    expect(toPageView({ page: 4, size: 20, total: 45 }, 0).rangeLabel).toBe('전체 45건');
  });

  it('서버가 0을 주어도 계산이 깨지지 않는다', () => {
    const view = toPageView({ page: 0, size: 0, total: 0 }, 0);

    expect(view.page).toBe(1);
    expect(view.totalPages).toBe(0);
    expect(Number.isFinite(view.totalPages)).toBe(true);
  });
});
