import { describe, expect, it } from 'vitest';

import { toPageView } from './pagination';

describe('toPageView', () => {
  it('첫 쪽에서는 이전이 막히고 다음이 열린다', () => {
    const view = toPageView({ page: 1, size: 50, total: 240 }, 50);

    expect(view.canPrev).toBe(false);
    expect(view.canNext).toBe(true);
    expect(view.rangeLabel).toBe('1–50 / 전체 240건');
  });

  it('가운데 쪽에서는 이전·다음이 모두 열린다', () => {
    const view = toPageView({ page: 3, size: 50, total: 240 }, 50);

    expect(view.canPrev).toBe(true);
    expect(view.canNext).toBe(true);
    expect(view.rangeLabel).toBe('101–150 / 전체 240건');
  });

  it('마지막 쪽에서는 다음이 막힌다', () => {
    const view = toPageView({ page: 5, size: 50, total: 240 }, 40);

    expect(view.canNext).toBe(false);
    expect(view.rangeLabel).toBe('201–240 / 전체 240건');
  });

  /* 경계 — 전체 건수가 쪽 크기의 배수면 마지막 쪽이 꽉 찬다. 여기서 다음이 열리면 빈 쪽으로 간다. */
  it('전체가 쪽 크기의 배수면 마지막 쪽에서 다음이 막힌다', () => {
    const view = toPageView({ page: 2, size: 50, total: 100 }, 50);

    expect(view.totalPages).toBe(2);
    expect(view.canNext).toBe(false);
  });

  /* 결과가 하나도 없으면 범위를 지어내지 않는다 — 「1–0」은 뜻이 없다. */
  it('전체 0건이면 범위 대신 전체 건수만 낸다', () => {
    const view = toPageView({ page: 1, size: 50, total: 0 }, 0);

    expect(view.rangeLabel).toBe('전체 0건');
    expect(view.canPrev).toBe(false);
    expect(view.canNext).toBe(false);
    expect(view.isBeyondLast).toBe(false);
  });

  /* 주소 조작·조건 변경으로 생긴다. 빈 상태의 안내가 갈린다. */
  it('결과가 있는데 이 쪽에 없으면 범위 밖으로 표시한다', () => {
    const view = toPageView({ page: 9, size: 50, total: 240 }, 0);

    expect(view.isBeyondLast).toBe(true);
    expect(view.rangeLabel).toBe('전체 240건');
    expect(view.canNext).toBe(false);
  });

  /* 서버가 0을 주면 나눗셈이 무한대가 된다 — 계산이 깨지지 않게 하한을 둔다. */
  it('쪽 크기·쪽 번호가 0이어도 계산이 깨지지 않는다', () => {
    const view = toPageView({ page: 0, size: 0, total: 3 }, 3);

    expect(view.page).toBe(1);
    expect(Number.isFinite(view.totalPages)).toBe(true);
  });
});
