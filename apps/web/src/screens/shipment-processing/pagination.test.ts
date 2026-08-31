import { describe, expect, it } from 'vitest';

import { toPageView } from './pagination';

describe('toPageView', () => {
  it('범위 라벨을 계산한다', () => {
    const view = toPageView({ page: 2, size: 20, total: 45 }, 20);

    expect(view.page).toBe(2);
    expect(view.totalPages).toBe(3);
    expect(view.rangeLabel).toBe('21–40 / 총 45건');
    expect(view.canPrev).toBe(true);
    expect(view.canNext).toBe(true);
    expect(view.isBeyondLast).toBe(false);
  });

  it('결과가 0건이면 건수만 낸다', () => {
    const view = toPageView({ page: 1, size: 20, total: 0 }, 0);

    expect(view.rangeLabel).toBe('총 0건');
    expect(view.canPrev).toBe(false);
    expect(view.canNext).toBe(false);
  });

  it('마지막 쪽을 넘어가면 isBeyondLast가 참이다', () => {
    const view = toPageView({ page: 5, size: 20, total: 45 }, 0);

    expect(view.isBeyondLast).toBe(true);
    expect(view.canNext).toBe(false);
  });

  it('size가 0이어도 나누기 오류 없이 계산한다', () => {
    const view = toPageView({ page: 1, size: 0, total: 10 }, 10);

    expect(view.totalPages).toBe(10);
  });
});
