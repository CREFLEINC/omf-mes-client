import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderHookWithProviders, type StubFetch } from '../../test/api-harness';
import {
  ITEM_SEARCH_SIZE,
  emergencyWorkOrderKeys,
  useItemBoms,
  useItemRoutings,
  useItemSearch,
  useRoutingOperations,
} from './queries';

const collecting = (): { urls: string[]; fetch: StubFetch } => {
  const urls: string[] = [];
  const fetch: StubFetch = async (request) => {
    const url = new URL(request.url);
    urls.push(`${url.pathname}${url.search}`);
    return jsonResponse({ items: [], page: { page: 1, size: 20, total: 0 } });
  };

  return { urls, fetch };
};

describe('emergencyWorkOrderKeys', () => {
  it('캐시 키에 식별자를 담는다 — 다른 품목의 전개가 섞이지 않는다', () => {
    expect(emergencyWorkOrderKeys.boms(5001)).not.toEqual(emergencyWorkOrderKeys.boms(5002));
    expect(emergencyWorkOrderKeys.routings(5001)).not.toEqual(
      emergencyWorkOrderKeys.routings(5002),
    );
    expect(emergencyWorkOrderKeys.routingOperations(31)).not.toEqual(
      emergencyWorkOrderKeys.routingOperations(32),
    );
    expect(emergencyWorkOrderKeys.itemSearch('가')).not.toEqual(
      emergencyWorkOrderKeys.itemSearch('나'),
    );
  });

  it('무효화 뿌리 키가 모든 갈래를 덮는다', () => {
    for (const key of [
      emergencyWorkOrderKeys.itemSearch('가'),
      emergencyWorkOrderKeys.boms(5001),
      emergencyWorkOrderKeys.routings(5001),
      emergencyWorkOrderKeys.routingOperations(31),
    ]) {
      expect(key.slice(0, 1)).toEqual([...emergencyWorkOrderKeys.all]);
    }
  });
});

describe('고르기 전 조회를 열지 않는다', () => {
  it('⛔ 품목을 고르기 전에는 BOM·Routing 요청을 만들지 않는다 — 0 으로 부르지도 않는다', async () => {
    const { urls, fetch } = collecting();

    renderHookWithProviders(
      () => ({
        boms: useItemBoms(null),
        routings: useItemRoutings(null),
        operations: useRoutingOperations(null),
      }),
      { fetch },
    );

    await waitFor(() => {
      expect(urls).toEqual([]);
    });
  });

  /*
   * 요청이 안 나가는 것만으로는 부족하다. 조회를 열어 둔 채 `queryFn`이 던지게 두어도
   * 요청은 안 나가지만 **훅이 오류 상태가 된다** — 고르기도 전에 화면에 조회 실패가 뜬다.
   * 「안 불렀다」와 「부르려다 실패했다」는 사용자에게 다른 화면이다.
   */
  it('⛔ 고르기 전 상태가 «오류»가 아니다 — 실패 배너가 미리 뜨지 않는다', async () => {
    const { fetch } = collecting();

    const { result } = renderHookWithProviders(
      () => ({
        boms: useItemBoms(null),
        routings: useItemRoutings(null),
        operations: useRoutingOperations(null),
        search: useItemSearch(''),
      }),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.boms.fetchStatus).toBe('idle');
    });
    for (const query of Object.values(result.current)) {
      expect(query.isError).toBe(false);
      expect(query.fetchStatus).toBe('idle');
    }
  });

  it('⛔ 검색어가 비면 품목을 조회하지 않는다 — 전 품목을 받아 올 자리가 아니다', async () => {
    const { urls, fetch } = collecting();

    renderHookWithProviders(() => useItemSearch('   '), { fetch });

    await waitFor(() => {
      expect(urls).toEqual([]);
    });
  });
});

describe('useItemSearch', () => {
  it('검색어와 건수를 싣는다', async () => {
    const { urls, fetch } = collecting();

    renderHookWithProviders(() => useItemSearch('SYN-ITEM'), { fetch });

    await waitFor(() => {
      expect(urls).toHaveLength(1);
    });
    const params = new URLSearchParams(urls[0]?.split('?')[1] ?? '');
    expect(params.get('q')).toBe('SYN-ITEM');
    expect(params.get('size')).toBe(String(ITEM_SEARCH_SIZE));
  });

  it('⛔ Routing 보유로 미리 거르지 않는다 — 지우면 「없는 품목」과 구분할 수 없다', async () => {
    const { urls, fetch } = collecting();

    renderHookWithProviders(() => useItemSearch('SYN-ITEM'), { fetch });

    await waitFor(() => {
      expect(urls).toHaveLength(1);
    });
    expect(urls[0]).not.toContain('hasRouting');
  });

  it('앞뒤 공백은 검색어에 싣지 않는다 — 같은 검색이 다른 키로 두 번 나간다', async () => {
    const { urls, fetch } = collecting();

    renderHookWithProviders(() => useItemSearch('  SYN-ITEM  '), { fetch });

    await waitFor(() => {
      expect(urls).toHaveLength(1);
    });
    expect(new URLSearchParams(urls[0]?.split('?')[1] ?? '').get('q')).toBe('SYN-ITEM');
  });
});

describe('고른 뒤의 조회', () => {
  /*
   * ⛔ **「지금 쓸 수 있는 것만」을 함께 청한다.** 이 조건을 빼면 계약이 종전대로 전부 내려
   * 주고, **폐기된 개정으로 되돌릴 수 없는 지시가 나가는 길**이 열린 채로 남는다. 화면이
   * 상태 문자열로 거르는 것은 답이 아니다 — 판정은 서버 것이다(G-8).
   */
  it('⛔ BOM·Routing 을 「지금 쓸 수 있는 것만」으로 조회한다 — 폐기된 것으로 발행되지 않게', async () => {
    const { urls, fetch } = collecting();

    renderHookWithProviders(() => ({ boms: useItemBoms(5001), routings: useItemRoutings(5001) }), {
      fetch,
    });

    await waitFor(() => {
      expect(urls).toHaveLength(2);
    });
    expect(urls).toContain('/planning/boms?parentItemId=5001&usableOnly=true');
    expect(urls).toContain('/planning/routings?itemId=5001&usableOnly=true');
  });

  it('공정은 고른 개정의 것만 조회한다', async () => {
    const { urls, fetch } = collecting();

    renderHookWithProviders(() => useRoutingOperations(31), { fetch });

    await waitFor(() => {
      expect(urls).toEqual(['/planning/routings/31/operations']);
    });
  });

  it('조회 실패를 오류로 알린다 — 조용히 빈 목록으로 두지 않는다', async () => {
    const fetch: StubFetch = async () => jsonResponse({ message: '서버 오류' }, { status: 500 });

    const { result } = renderHookWithProviders(() => useItemBoms(5001), { fetch });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
