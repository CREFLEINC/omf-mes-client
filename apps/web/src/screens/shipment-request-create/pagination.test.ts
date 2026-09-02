import { describe, expect, it } from 'vitest';

import { toPageView } from './pagination';

describe('toPageView', () => {
  it('범위와 전체 건수를 함께 낸다', () => {
    const view = toPageView({ page: 2, size: 50, total: 120 }, 50);

    expect(view.rangeLabel).toBe('51–100 / 전체 120건');
    expect(view.canPrev).toBe(true);
    expect(view.canNext).toBe(true);
  });

  it('보이는 것이 없으면 범위를 지어내지 않고 전체 건수만 낸다', () => {
    const view = toPageView({ page: 1, size: 50, total: 0 }, 0);

    expect(view.rangeLabel).toBe('전체 0건');
  });

  it('결과가 있는데 이 쪽에는 없으면 쪽 밖이다', () => {
    const view = toPageView({ page: 3, size: 50, total: 60 }, 0);

    expect(view.isBeyondLast).toBe(true);
  });

  it('서버가 0을 주면 나눗셈이 무한대가 되지 않게 하한을 둔다', () => {
    const view = toPageView({ page: 0, size: 0, total: 0 }, 0);

    expect(Number.isFinite(view.totalPages)).toBe(true);
  });
});
