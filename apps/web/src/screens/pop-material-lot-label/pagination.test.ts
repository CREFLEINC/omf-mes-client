import { describe, expect, it } from 'vitest';

import { ROWS_PER_PAGE, toLinePageView, toPageView } from './pagination';

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
    expect(toPageView(meta(1, 20, 0), 0).rangeLabel).toBe('');
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

/**
 * ⭐ **잘릴 줄은 다음 쪽으로 넘긴다**(사용자 지시 2026-09-19 · omf-all-around#32).
 *
 * 서버 쪽 나눔은 입하 «건» 단위라, 건이 한 쪽에 다 들어가면 줄이 아무리 많아도 이전·다음이
 * 영영 꺼져 있었다 — 목록은 넘치는 줄을 잘라 냈고 스크롤도 없어 그 줄에 닿을 길이 없었다.
 */
describe('toLinePageView', () => {
  const oneReceiptPage = { page: 1, size: 50, total: 7 };

  it('줄이 한 쪽에 다 들어가면 쪽이 하나다', () => {
    const view = toLinePageView(oneReceiptPage, ROWS_PER_PAGE, 1);

    expect(view.totalPages).toBe(1);
    expect(view.canNext).toBe(false);
    expect(view.start).toBe(0);
  });

  /** ⛔ 한 줄이라도 넘치면 그 줄은 «다음 쪽»이다 — 잘라 보이지 않는다. */
  it('한 줄이 넘치면 쪽이 하나 더 생긴다', () => {
    const view = toLinePageView(oneReceiptPage, ROWS_PER_PAGE + 1, 1);

    expect(view.totalPages).toBe(2);
    expect(view.canNext).toBe(true);
    expect(view.end - view.start).toBe(ROWS_PER_PAGE);
  });

  it('둘째 쪽은 앞 쪽이 세운 줄 다음부터 센다', () => {
    const view = toLinePageView(oneReceiptPage, ROWS_PER_PAGE + 3, 2);

    expect(view.start).toBe(ROWS_PER_PAGE);
    expect(view.canPrev).toBe(true);
    expect(view.canNext).toBe(false);
  });

  /** 앞 건 쪽으로 돌아갈 때는 줄 수를 모르므로 범위를 넘겨 두고 여기서 잡는다. */
  it('범위를 넘긴 줄 쪽은 마지막 쪽으로 잡는다', () => {
    const view = toLinePageView(oneReceiptPage, ROWS_PER_PAGE + 1, Number.MAX_SAFE_INTEGER);

    expect(view.page).toBe(2);
    expect(view.start).toBe(ROWS_PER_PAGE);
  });

  /** ⭐ 줄 쪽을 다 넘기면 **다음 건 쪽**으로 이어 넘어간다 — 사용자에게는 그냥 「다음」이다. */
  it('마지막 줄 쪽이어도 건 쪽이 남아 있으면 다음이 열린다', () => {
    const view = toLinePageView({ page: 1, size: 50, total: 60 }, 3, 1);

    expect(view.totalPages).toBe(1);
    expect(view.canNext).toBe(true);
  });

  it('첫 줄 쪽이어도 앞 건 쪽이 있으면 이전이 열린다', () => {
    const view = toLinePageView({ page: 2, size: 50, total: 60 }, 3, 1);

    expect(view.canPrev).toBe(true);
  });

  /** 줄이 하나도 없어도 자리는 말한다 — 「이 쪽에는 없다」 안내와 함께 어디인지 보여야 한다. */
  it('줄이 없어도 쪽 자리를 비우지 않는다', () => {
    expect(toLinePageView(oneReceiptPage, 0, 1).rangeLabel).not.toBe('');
    expect(toLinePageView({ page: 1, size: 50, total: 0 }, 0, 1).rangeLabel).toBe('');
  });
});
