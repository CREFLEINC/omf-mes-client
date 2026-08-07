import { describe, expect, it } from 'vitest';

import { toPageView } from './pagination';

describe('toPageView', () => {
  it('지금 보고 있는 범위를 낸다', () => {
    const view = toPageView({ page: 2, size: 50, total: 240 }, 50);

    expect(view.rangeLabel).toBe('51–100 / 전체 240건');
    expect(view.totalPages).toBe(5);
    expect(view.canPrev).toBe(true);
    expect(view.canNext).toBe(true);
  });

  it('첫 쪽에서는 앞으로 갈 수 없다', () => {
    expect(toPageView({ page: 1, size: 50, total: 240 }, 50).canPrev).toBe(false);
  });

  it('마지막 쪽에서는 뒤로 갈 수 없다', () => {
    expect(toPageView({ page: 5, size: 50, total: 240 }, 40).canNext).toBe(false);
  });

  /* 경계 — 전체 건수가 쪽 크기의 배수면 마지막 쪽이 딱 떨어진다. 열리면 빈 쪽으로 간다. */
  it('전체 건수가 쪽 크기의 배수여도 마지막 쪽에서 닫힌다', () => {
    expect(toPageView({ page: 4, size: 50, total: 200 }, 50).canNext).toBe(false);
  });

  it('보이는 것이 없으면 범위를 지어내지 않는다', () => {
    expect(toPageView({ page: 1, size: 50, total: 0 }, 0).rangeLabel).toBe('전체 0건');
  });

  /* 결과는 있는데 이 쪽에는 없다 — 빈 상태의 안내가 갈린다. */
  it('결과가 있는데 범위 밖 쪽이면 그것을 알린다', () => {
    expect(toPageView({ page: 9, size: 50, total: 240 }, 0).isBeyondLast).toBe(true);
  });

  it('결과가 0건이면 범위 밖으로 보지 않는다', () => {
    expect(toPageView({ page: 1, size: 50, total: 0 }, 0).isBeyondLast).toBe(false);
  });

  /* 서버가 0을 주면 나눗셈이 무한대가 된다. 계산이 깨지지 않아야 한다. */
  it('서버가 쪽 크기를 0으로 줘도 계산이 깨지지 않는다', () => {
    const view = toPageView({ page: 0, size: 0, total: 3 }, 3);

    expect(view.page).toBe(1);
    expect(Number.isFinite(view.totalPages)).toBe(true);
  });
});
