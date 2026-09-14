import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  createTestQueryClient,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../test/api-harness';
import { useItem, useItemLabels, useItemSearch } from './masters';

const page = { page: 0, size: 20, totalElements: 0, totalPages: 1 };

const item = (itemId: number) => ({
  itemId,
  itemCode: `RM-${String(itemId)}`,
  itemName: `자재${String(itemId)}`,
  fifoPolicyCode: 'FEFO',
});

/** 마스터가 큰 곳을 흉내 낸다. 목록 조회는 청한 만큼만 답하고 단건 조회는 전부 답한다. */
const masterRoutes = (size: number, seen: URL[]): StubRoute[] => {
  const all = Array.from({ length: size }, (_, index) => item(index + 1));

  return [
    {
      match: (request) => /^\/mdm\/items\/\d+$/.test(new URL(request.url).pathname),
      respond: (request) => {
        const url = new URL(request.url);
        seen.push(url);
        const itemId = Number(url.pathname.split('/').pop());
        const found = all.find((each) => each.itemId === itemId);

        return found === undefined
          ? jsonResponse({ message: '없음' }, { status: 404 })
          : jsonResponse({ item: found });
      },
    },
    {
      match: (request) => new URL(request.url).pathname === '/mdm/items',
      respond: (request) => {
        const url = new URL(request.url);
        seen.push(url);
        const q = url.searchParams.get('q');
        const asked = Number(url.searchParams.get('size') ?? '20');
        const matched = q === null ? all : all.filter((each) => each.itemCode.includes(q));

        return jsonResponse({ items: matched.slice(0, asked), page });
      },
    },
  ];
};

describe('품목 표시명', () => {
  /*
   * 실기에서 마스터가 9,000건인 곳의 코드순 앞 200건 밖 품목이 전부 이름 없이 섰다.
   * 목록 한 번으로 지도를 만들면 한 쪽에 담기는 만큼만 얻고 나머지는 조용히 빈다.
   */
  it('앞 쪽 밖의 품목도 이름을 얻는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch(masterRoutes(9000, seen));

    const { result } = renderHookWithProviders(() => useItemLabels([8999]), { fetch });

    await waitFor(() => {
      expect(result.current.get(8999)?.itemCode).toBe('RM-8999');
    });
  });

  /* 보이는 줄만큼만 부른다. 같은 품목이 여러 줄에 있어도 한 번이다. */
  it('같은 품목이 겹쳐 나와도 한 번만 묻는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch(masterRoutes(9000, seen));

    const { result } = renderHookWithProviders(() => useItemLabels([31, 31, 77, 31]), { fetch });

    await waitFor(() => {
      expect(result.current.size).toBe(2);
    });
    expect(seen.map((url) => url.pathname).sort()).toEqual(['/mdm/items/31', '/mdm/items/77']);
  });

  /*
   * 한 화면이 받아 둔 것을 다른 자리가 다시 부르면, 줄이 많은 화면에서 같은 조회가
   * 곱절로 나간다. 단건 조회와 열쇠가 같아야 캐시가 이어진다.
   */
  it('단건 조회와 받아 둔 것을 나눠 쓴다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch(masterRoutes(9000, seen));
    const queryClient = createTestQueryClient();

    const labels = renderHookWithProviders(() => useItemLabels([31]), { fetch, queryClient });

    await waitFor(() => {
      expect(labels.result.current.size).toBe(1);
    });

    const single = renderHookWithProviders(() => useItem(31), { fetch, queryClient });

    await waitFor(() => {
      expect(single.result.current.data?.itemCode).toBe('RM-31');
    });
    expect(seen).toHaveLength(1);
  });
});

describe('품목 찾기', () => {
  /* 찾는 말이 없을 때 마스터 전부를 청하면 단말이 그것을 다 받아 늘어놓으려 한다. */
  it('찾는 말이 없으면 묻지 않는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch(masterRoutes(9000, seen));

    const { result } = renderHookWithProviders(() => useItemSearch('   '), { fetch });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });
    expect(seen).toHaveLength(0);
  });

  /* 앞에서 잘린 목록을 늘어놓으면 있는 품목이 없는 것으로 보여 고르지 못하고도 이유를 모른다. */
  it('앞 쪽 밖의 품목도 찾아서 고를 수 있다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch(masterRoutes(9000, seen));

    const { result } = renderHookWithProviders(() => useItemSearch('RM-8999'), { fetch });

    await waitFor(() => {
      expect(result.current.data?.[0]?.itemId).toBe(8999);
    });
    expect(seen[0]?.searchParams.get('q')).toBe('RM-8999');
  });
});
