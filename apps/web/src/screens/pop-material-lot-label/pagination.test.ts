import { describe, expect, it } from 'vitest';

import { toPageView } from './pagination';

const meta = (page: number, size: number, total: number) => ({ page, size, total });

describe('toPageView', () => {
  it('첫 쪽에서는 이전으로 갈 수 없다', () => {
    const view = toPageView(meta(1, 20, 45), 20);

    expect(view.canPrev).toBe(false);
    expect(view.canNext).toBe(true);
  });

  it('마지막 쪽에서는 다음으로 갈 수 없다', () => {
    const view = toPageView(meta(3, 20, 45), 5);

    expect(view.canPrev).toBe(true);
    expect(view.canNext).toBe(false);
  });

  /** 세는 단위를 문구가 밝힌다 — 쪽 나눔은 입하 건이고 목록 줄은 자재라 단위가 다르다. */
  it('보이는 범위를 서버가 준 쪽 기준으로 세고 단위를 밝힌다', () => {
    expect(toPageView(meta(3, 20, 45), 5).rangeLabel).toBe('입하 건 41–45 / 전체 45건');
  });

  it('보이는 것이 없으면 범위를 지어내지 않고 전체 건수만 밝힌다', () => {
    expect(toPageView(meta(1, 20, 0), 0).rangeLabel).toBe('입하 건 전체 0건');
  });

  it('결과는 있는데 이 쪽에 없는 상태를 가려낸다 — 빈 상태의 안내가 갈린다', () => {
    expect(toPageView(meta(9, 20, 45), 0).isBeyondLast).toBe(true);
    expect(toPageView(meta(1, 20, 0), 0).isBeyondLast).toBe(false);
  });

  it('서버가 크기를 0으로 주어도 계산이 깨지지 않는다', () => {
    const view = toPageView(meta(1, 0, 10), 0);

    expect(Number.isFinite(view.totalPages)).toBe(true);
  });
});
