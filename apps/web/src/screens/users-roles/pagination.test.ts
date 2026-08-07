import { describe, expect, it } from 'vitest';

import { toPageView } from './pagination';

describe('toPageView', () => {
  it('첫 쪽에서는 이전이 막히고 다음이 열린다', () => {
    const view = toPageView({ page: 1, size: 20, total: 45 }, 20);

    expect(view.canPrev).toBe(false);
    expect(view.canNext).toBe(true);
    expect(view.totalPages).toBe(3);
  });

  it('마지막 쪽에서는 다음이 막힌다', () => {
    const view = toPageView({ page: 3, size: 20, total: 45 }, 5);

    expect(view.canPrev).toBe(true);
    expect(view.canNext).toBe(false);
  });

  /** 경계 하나 어긋나기가 가장 잘 생기는 자리다 — 나눈 나머지가 0이면 쪽이 하나 더 있는 것처럼 보인다. */
  it('전체 건수가 쪽 크기의 배수여도 마지막 쪽 판정이 맞다', () => {
    const view = toPageView({ page: 2, size: 20, total: 40 }, 20);

    expect(view.totalPages).toBe(2);
    expect(view.canNext).toBe(false);
  });

  it('결과가 0건이면 앞뒤가 모두 막힌다', () => {
    const view = toPageView({ page: 1, size: 20, total: 0 }, 0);

    expect(view.canPrev).toBe(false);
    expect(view.canNext).toBe(false);
    expect(view.totalPages).toBe(0);
    expect(view.isBeyondLast).toBe(false);
  });

  it('결과는 있는데 이 쪽에 없으면 범위 밖이다 — 「없습니다」와 다른 안내가 나가야 한다', () => {
    expect(toPageView({ page: 5, size: 20, total: 45 }, 0).isBeyondLast).toBe(true);
    expect(toPageView({ page: 3, size: 20, total: 45 }, 5).isBeyondLast).toBe(false);
  });

  it('보이는 것이 있으면 범위를 밝힌다', () => {
    const view = toPageView({ page: 3, size: 20, total: 45 }, 5);

    expect(view.rangeLabel).toBe('41–45 / 전체 45건');
  });

  it('보이는 것이 없으면 범위를 지어내지 않고 전체 건수만 밝힌다', () => {
    expect(toPageView({ page: 1, size: 20, total: 0 }, 0).rangeLabel).toBe('전체 0건');
  });

  /** 서버가 0을 주면 나눗셈이 무한대가 된다. 계산이 깨지지 않게 하한을 둔다. */
  it('쪽 크기·쪽 번호가 0이어도 계산이 깨지지 않는다', () => {
    const view = toPageView({ page: 0, size: 0, total: 3 }, 3);

    expect(view.page).toBe(1);
    expect(Number.isFinite(view.totalPages)).toBe(true);
  });

  /** 서버가 준 쪽을 정본으로 쓴다 — 주소의 쪽을 쓰면 표시와 내용이 어긋난다. */
  it('현재 쪽은 서버가 준 값이다', () => {
    expect(toPageView({ page: 2, size: 20, total: 45 }, 20).page).toBe(2);
  });
});
