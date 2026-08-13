import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { goodsReceiptFixtures, goodsReceiptResponseFixtures } from './fixtures';
import { receiptKeys, useGoodsReceipts, type ReceiptListQuery } from './queries';

const LIST_PATH = '/logistics/goods-receipts';

const listFetch = (): { fetch: ReturnType<typeof createStubFetch>; urls: URL[] } => {
  const urls: URL[] = [];

  const fetch = createStubFetch([
    {
      match: (request) => new URL(request.url).pathname === LIST_PATH,
      respond: (request) => {
        urls.push(new URL(request.url));

        return jsonResponse({
          items: goodsReceiptResponseFixtures,
          page: { page: 1, size: 50, total: goodsReceiptResponseFixtures.length },
        });
      },
    },
  ]);

  return { fetch, urls };
};

describe('receiptKeys', () => {
  /** 조건이 다르면 캐시도 갈린다 — 같으면 앞 조건의 결과가 새 조건의 화면에 그대로 선다. */
  it('조건이 캐시 키에 들어간다', () => {
    expect(receiptKeys.list({ q: 'GR' })).not.toEqual(receiptKeys.list({ q: 'GR-2026' }));
  });

  /** 목록의 앞머리를 따로 둔다 — 뒤 회차의 상세·이력과 무효화 범위를 가르기 위해서다. */
  it('앞머리가 목록임을 밝힌다', () => {
    expect(receiptKeys.list({}).slice(0, 2)).toEqual(['disposal-issue-goods-receipts', 'list']);
  });
});

describe('useGoodsReceipts', () => {
  const render = (query: ReceiptListQuery) => {
    const { fetch, urls } = listFetch();
    const hook = renderHookWithProviders(() => useGoodsReceipts(query), { fetch });

    return { ...hook, urls };
  };

  it('응답을 화면 타입으로 옮긴다', async () => {
    const { result } = render({});

    await waitFor(() => {
      expect(result.current.data?.items).toHaveLength(goodsReceiptFixtures.length);
    });

    expect(result.current.data?.items[0]).toEqual(goodsReceiptFixtures[0]);
  });

  /**
   * **채운 조건만 실린다.** 요청 URL이 조건을 그대로 드러내야 무엇으로 조회했는지 읽을 수 있고,
   * 빈 값을 실으면 서버가 그것을 조건으로 해석한다.
   */
  it('조건이 하나도 없으면 쿼리도 비어 있다', async () => {
    const { result, urls } = render({});

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect([...(urls[0]?.searchParams.keys() ?? [])]).toEqual([]);
  });

  it('채운 조건을 계약 이름 그대로 싣는다', async () => {
    const { result, urls } = render({ warehouseId: 9701, q: 'GR-2026', page: 2 });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(Object.fromEntries(urls[0]?.searchParams ?? [])).toEqual({
      warehouseId: '9701',
      q: 'GR-2026',
      page: '2',
    });
  });

  /** 쪽 크기는 서버 기본값을 쓴다 — 화면이 정하면 그 숫자의 근거를 화면이 갖게 된다. */
  it('쪽 크기를 싣지 않는다', async () => {
    const { result, urls } = render({});

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(urls[0]?.searchParams.has('size')).toBe(false);
  });

  it('실패하면 실패로 앉는다', async () => {
    const fetch = createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === LIST_PATH,
        respond: () => jsonResponse({ message: '' }, { status: 500 }),
      },
    ]);
    const { result } = renderHookWithProviders(() => useGoodsReceipts({}), { fetch });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
