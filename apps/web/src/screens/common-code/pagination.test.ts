import { describe, expect, it } from 'vitest';

import { toPageView } from './pagination';

describe('toPageView', () => {
  it('현재 쪽과 전체 쪽 수를 낸다', () => {
    const view = toPageView({ page: 2, size: 50, total: 240 }, 50);

    expect(view.page).toBe(2);
    expect(view.totalPages).toBe(5);
    expect(view.rangeLabel).toBe('51–100 / 전체 240건');
  });

  it('첫 쪽에서는 이전이 막히고 다음이 열린다', () => {
    const view = toPageView({ page: 1, size: 50, total: 240 }, 50);

    expect(view.canPrev).toBe(false);
    expect(view.canNext).toBe(true);
  });

  it('마지막 쪽에서는 다음이 막힌다', () => {
    const view = toPageView({ page: 5, size: 50, total: 240 }, 40);

    expect(view.canPrev).toBe(true);
    expect(view.canNext).toBe(false);
  });

  /* 경계 — total이 size의 배수면 마지막 쪽이 딱 떨어진다. 여기서 다음이 열리면 빈 쪽으로 간다. */
  it('전체 건수가 쪽 크기의 배수여도 마지막 쪽에서 다음이 막힌다', () => {
    const view = toPageView({ page: 4, size: 50, total: 200 }, 50);

    expect(view.totalPages).toBe(4);
    expect(view.canNext).toBe(false);
  });

  it('0건이면 범위를 지어내지 않고 전체 건수만 낸다', () => {
    const view = toPageView({ page: 1, size: 50, total: 0 }, 0);

    expect(view.rangeLabel).toBe('전체 0건');
    expect(view.canPrev).toBe(false);
    expect(view.canNext).toBe(false);
    expect(view.isBeyondLast).toBe(false);
  });

  it('결과는 있는데 이 쪽에 없으면 범위 밖으로 판정한다', () => {
    const view = toPageView({ page: 9, size: 50, total: 240 }, 0);

    expect(view.isBeyondLast).toBe(true);
    expect(view.rangeLabel).toBe('전체 240건');
  });

  it('전체가 0건이면 범위 밖으로 보지 않는다 — 갈 수 있는 쪽이 없다', () => {
    expect(toPageView({ page: 3, size: 50, total: 0 }, 0).isBeyondLast).toBe(false);
  });

  /* 서버가 0을 주면 나눗셈이 무한대가 된다. 계산이 깨지지 않게 하한을 둔다. */
  it('쪽 크기가 0이어도 계산이 깨지지 않는다', () => {
    const view = toPageView({ page: 1, size: 0, total: 3 }, 3);

    expect(Number.isFinite(view.totalPages)).toBe(true);
    expect(view.rangeLabel).toBe('1–3 / 전체 3건');
  });

  it('쪽 번호가 0 이하여도 첫 쪽으로 본다', () => {
    expect(toPageView({ page: 0, size: 50, total: 10 }, 10).page).toBe(1);
  });
});
