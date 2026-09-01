import { describe, expect, it } from 'vitest';

import { toPageView } from './pagination';

describe('toPageView', () => {
  it('보이는 범위와 전체 건수를 함께 말한다', () => {
    const view = toPageView({ page: 2, size: 50, total: 120 }, 50);

    expect(view.rangeLabel).toBe('51–100 / 전체 120건');
    expect(view.canPrev).toBe(true);
    expect(view.canNext).toBe(true);
    expect(view.isBeyondLast).toBe(false);
  });

  it('보이는 것이 없으면 범위를 지어내지 않고 전체 건수만 밝힌다', () => {
    expect(toPageView({ page: 1, size: 50, total: 0 }, 0).rangeLabel).toBe('전체 0건');
  });

  it('결과는 있는데 이 쪽에 없으면 그 사실을 가른다 — 조건 문제와 쪽 문제는 푸는 법이 다르다', () => {
    expect(toPageView({ page: 9, size: 50, total: 120 }, 0).isBeyondLast).toBe(true);
    expect(toPageView({ page: 1, size: 50, total: 0 }, 0).isBeyondLast).toBe(false);
  });

  it('서버가 0을 줘도 계산이 깨지지 않는다', () => {
    const view = toPageView({ page: 0, size: 0, total: 0 }, 0);

    expect(view.page).toBe(1);
    expect(view.canPrev).toBe(false);
    expect(view.canNext).toBe(false);
  });
});
