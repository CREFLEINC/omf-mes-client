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
  it('지금 자리를 쪽 번호로 말한다 — 서버가 준 쪽을 정본으로 쓴다', () => {
    expect(toPageView(meta(3, 20, 45), 5).rangeLabel).toBe('3쪽 중 3쪽');
  });

  /**
   * ⛔ **건수를 세지 않는다.** 쪽 나눔은 「입하 건」 단위인데 목록의 줄은 「자재」다
   * (스펙 §3-6) — 한 건에 자재가 여럿이면 두 수가 맞지 않고, 어긋난 수를 나란히 두면
   * 사용자가 화면을 의심한다. 쪽 번호는 어느 단위로 세든 같다.
   */
  it('보이는 줄 수와 어긋나는 건수를 말하지 않는다', () => {
    // 입하 건 5건을 받아 자재 줄이 일곱인 상태 — 두 수가 함께 서면 서로를 부정한다.
    expect(toPageView(meta(1, 5, 12), 7).rangeLabel).toBe('3쪽 중 1쪽');
  });

  it('보여 줄 쪽이 없으면 자리를 지어내지 않는다', () => {
    expect(toPageView(meta(1, 20, 0), 0).rangeLabel).toBe('보여 줄 쪽이 없습니다.');
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
