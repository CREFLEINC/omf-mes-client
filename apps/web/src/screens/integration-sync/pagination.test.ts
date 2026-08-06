import { describe, expect, it } from 'vitest';

import { toPageView } from './pagination';

describe('toPageView — 위치 표시', () => {
  it('지금 보고 있는 범위와 전체 건수를 함께 낸다', () => {
    const view = toPageView({ page: 3, size: 50, total: 240 }, 50);

    expect(view.rangeLabel).toBe('101–150 / 전체 240건');
  });

  it('마지막 쪽은 받은 건수만큼만 센다', () => {
    const view = toPageView({ page: 5, size: 50, total: 240 }, 40);

    expect(view.rangeLabel).toBe('201–240 / 전체 240건');
  });

  it('0건이면 범위 없이 전체 건수만 낸다', () => {
    const view = toPageView({ page: 1, size: 50, total: 0 }, 0);

    expect(view.rangeLabel).toBe('전체 0건');
    expect(view.canPrev).toBe(false);
    expect(view.canNext).toBe(false);
  });

  it('결과가 있는데 이 쪽이 비었으면 범위를 지어내지 않는다', () => {
    const view = toPageView({ page: 9, size: 50, total: 240 }, 0);

    expect(view.rangeLabel).toBe('전체 240건');
  });
});

describe('toPageView — 이동 가능 여부', () => {
  it('첫 쪽에서는 이전으로 갈 수 없다', () => {
    const view = toPageView({ page: 1, size: 50, total: 240 }, 50);

    expect(view.canPrev).toBe(false);
    expect(view.canNext).toBe(true);
  });

  it('마지막 쪽에서는 다음으로 갈 수 없다', () => {
    const view = toPageView({ page: 5, size: 50, total: 240 }, 40);

    expect(view.totalPages).toBe(5);
    expect(view.canNext).toBe(false);
    expect(view.canPrev).toBe(true);
  });

  it('전체가 쪽 크기의 배수면 마지막 쪽이 딱 나눠떨어진다 — 여기서 한 쪽이 더 생기면 안 된다', () => {
    const view = toPageView({ page: 2, size: 20, total: 40 }, 20);

    expect(view.totalPages).toBe(2);
    expect(view.canNext).toBe(false);
  });

  it('쪽 크기가 0이어도 계산이 깨지지 않는다 — 0으로 나누면 무한대가 나온다', () => {
    const view = toPageView({ page: 1, size: 0, total: 3 }, 3);

    expect(Number.isFinite(view.totalPages)).toBe(true);
    expect(view.rangeLabel).toBe('1–3 / 전체 3건');
  });
});

describe('toPageView — 범위 밖 쪽', () => {
  it('마지막 쪽보다 뒤면 그 사실을 알린다', () => {
    const view = toPageView({ page: 9, size: 50, total: 240 }, 0);

    expect(view.isBeyondLast).toBe(true);
  });

  it('결과가 아예 없는 것은 범위 밖이 아니다 — 안내가 갈린다', () => {
    expect(toPageView({ page: 1, size: 50, total: 0 }, 0).isBeyondLast).toBe(false);
  });

  it('결과가 있는 쪽은 범위 밖이 아니다', () => {
    expect(toPageView({ page: 5, size: 50, total: 240 }, 40).isBeyondLast).toBe(false);
  });
});
