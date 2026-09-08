import { describe, expect, it, vi } from 'vitest';

import { fetchAllPages } from './fetch-all-pages';

describe('fetchAllPages', () => {
  it('전체 건수에 이를 때까지 다음 쪽을 이어 붙인다', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ items: [1, 2], page: { page: 1, size: 2, total: 3 } })
      .mockResolvedValueOnce({ items: [3], page: { page: 2, size: 2, total: 3 } });

    await expect(fetchAllPages(fetchPage)).resolves.toEqual({
      items: [1, 2, 3],
      page: { page: 1, size: 3, total: 3 },
    });
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('완전 수집이 필수이면 빈 다음 쪽을 부분 결과로 내지 않는다', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ items: [1], page: { page: 1, size: 1, total: 3 } })
      .mockResolvedValueOnce({ items: [], page: { page: 2, size: 1, total: 3 } });

    await expect(fetchAllPages(fetchPage, { requireComplete: true })).rejects.toThrow(
      '마지막 쪽까지 받지 못했습니다.',
    );
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('일반 조회는 서버가 빈 다음 쪽을 주면 받은 분량만 돌려준다', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ items: [1], page: { page: 1, size: 1, total: 3 } })
      .mockResolvedValueOnce({ items: [], page: { page: 2, size: 1, total: 3 } });

    await expect(fetchAllPages(fetchPage)).resolves.toEqual({
      items: [1],
      page: { page: 1, size: 1, total: 3 },
    });
  });
});
