import { describe, expect, it, vi } from 'vitest';

import { fetchAllPages, MAX_PAGES, PAGE_SIZE, type PagedResponse } from './fetch-all-pages';

/**
 * 쪽을 나눠 주는 서버를 흉내 낸다. `size` 는 **서버가 정한다** — 요청한 값을 낮춰 적용하는
 * 서버가 실재하고, 그때 「받은 수 === 요청한 size」로 세는 판정이 두 쪽째에서 멈춘다.
 */
const server = (total: number, serverSize?: number) => {
  const calls: { page: number; size: number }[] = [];

  const fetchPage = (page: number, size: number): Promise<PagedResponse<number>> => {
    calls.push({ page, size });

    const applied = serverSize ?? size;
    const from = (page - 1) * applied;
    const items = Array.from(
      { length: Math.max(0, Math.min(applied, total - from)) },
      (_, i) => from + i,
    );

    return Promise.resolve({ items, page: { page, size: applied, total } });
  };

  return { calls, fetchPage };
};

describe('fetchAllPages', () => {
  it('한 쪽에 다 들어가면 한 번만 부른다', async () => {
    const { calls, fetchPage } = server(30);

    const result = await fetchAllPages(fetchPage);

    expect(result.items).toHaveLength(30);
    expect(calls).toHaveLength(1);
    expect(result.truncated).toBe(false);
  });

  /** 이 결함의 본체 — 첫 쪽만 받으면 그 뒤의 값이 표에서 「알 수 없음」이 된다. */
  it('여러 쪽이면 끝까지 받는다', async () => {
    const { calls, fetchPage } = server(936);

    const result = await fetchAllPages(fetchPage);

    expect(result.items).toHaveLength(936);
    expect(calls.map((call) => call.page)).toEqual([1, 2, 3, 4, 5]);
    expect(result.truncated).toBe(false);
  });

  it('요청하는 쪽 크기는 서버 상한과 같다', async () => {
    const { calls, fetchPage } = server(500);

    await fetchAllPages(fetchPage);

    expect(calls.every((call) => call.size === PAGE_SIZE)).toBe(true);
  });

  /*
   * ⛔ **`size` 로 세지 않는다.** 서버가 요청한 쪽 크기를 낮춰 적용하면 「받은 수 === size」가
   * 첫 쪽부터 거짓이 되어, 그 조건으로 이어 받는 판정은 두 쪽째를 부르지 않는다.
   */
  it('서버가 쪽 크기를 낮춰 적용해도 끝까지 받는다', async () => {
    const { calls, fetchPage } = server(300, 100);

    const result = await fetchAllPages(fetchPage);

    expect(result.items).toHaveLength(300);
    expect(calls.length).toBeGreaterThan(1);
    expect(result.truncated).toBe(false);
  });

  /** 서버가 잘못된 총계를 주면 끝없이 부르게 된다 — 쪽 수 상한이 그 방어선이다. */
  it('총계가 터무니없이 크면 쪽 수 상한에서 멈추고 잘림으로 알린다', async () => {
    const { calls, fetchPage } = server(1_000_000);

    const result = await fetchAllPages(fetchPage);

    expect(calls).toHaveLength(MAX_PAGES);
    expect(result.truncated).toBe(true);
  });

  /** 총계는 큰데 서버가 도중에 빈 쪽을 주면 더 받아도 새 사실이 없다. */
  it('빈 쪽이 오면 멈춘다', async () => {
    const fetchPage = vi
      .fn<(page: number, size: number) => Promise<PagedResponse<number>>>()
      .mockResolvedValueOnce({ items: [1, 2], page: { page: 1, size: 200, total: 999 } })
      .mockResolvedValue({ items: [], page: { page: 2, size: 200, total: 999 } });

    const result = await fetchAllPages(fetchPage);

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(result.items).toEqual([1, 2]);
    /* 다 받지 못한 것은 사실이다 — 읽는 쪽이 그 사실을 밝혀야 한다. */
    expect(result.truncated).toBe(true);
  });

  /** 엉뚱한 쪽 번호가 오면 같은 쪽을 되풀이해 받을 수 있다 — 그 전에 멈춘다. */
  it('요청한 쪽과 다른 쪽이 오면 멈춘다', async () => {
    const fetchPage = vi
      .fn<(page: number, size: number) => Promise<PagedResponse<number>>>()
      .mockResolvedValueOnce({ items: [1, 2], page: { page: 1, size: 200, total: 999 } })
      .mockResolvedValue({ items: [1, 2], page: { page: 1, size: 200, total: 999 } });

    const result = await fetchAllPages(fetchPage);

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(result.items).toEqual([1, 2]);
    expect(result.truncated).toBe(true);
  });

  it('돌려주는 쪽 정보는 첫 쪽의 것이다 — 총계가 잘림 판정의 잣대다', async () => {
    const { fetchPage } = server(500);

    const result = await fetchAllPages(fetchPage);

    expect(result.page).toEqual({ page: 1, size: PAGE_SIZE, total: 500 });
  });

  it('쪽 크기와 상한을 부르는 쪽이 정할 수 있다', async () => {
    const { calls, fetchPage } = server(1_000);

    const result = await fetchAllPages(fetchPage, { size: 50, maxPages: 3 });

    expect(calls.map((call) => call.size)).toEqual([50, 50, 50]);
    expect(result.items).toHaveLength(150);
    expect(result.truncated).toBe(true);
  });
});
