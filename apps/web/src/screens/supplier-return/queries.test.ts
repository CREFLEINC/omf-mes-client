import { NETWORK_ERROR } from '@omf-mes/api-client';
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { ApiRequestError } from '../../patterns/request';
import { balanceFixtures, goodsReceiptFixtures, goodsReceiptLineFixtures } from './fixtures';
import {
  BALANCE_PAGE_SIZE,
  isReceiptNotFound,
  useGoodsReceiptDetail,
  useOnHandBalances,
} from './queries';

/**
 * 상세 조회의 **성립 조건**을 재는 자리.
 *
 * 이 감지기가 있어야 하는 이유가 있다. 「고르기 전에는 상세를 부르지 않는다」는 두 겹으로
 * 막혀 있다 — **① `enabled`**(조회 자체를 열지 않는다)와 **② `queryFn`의 가드**(그래도 불리면
 * 던진다). 화면 수준에서 요청 수만 세면 ①을 떼어도 ②가 요청을 막아 **아무 단언도 실패하지
 * 않는다.** 그러면 ①은 검사되지 않은 채 남고, 나중에 ②가 `?? 0` 같은 대체값으로 바뀌는 순간
 * **없는 전표의 경로로 요청이 나간다.**
 *
 * 그래서 여기서 **①을 단독으로** 잰다 — 조회가 아예 서지 않았는지(`fetchStatus`)와
 * 실패로 앉지 않았는지를 함께 본다.
 */

const DETAIL_PATH = '/logistics/goods-receipts/9001';

const detailRoute = {
  match: (request: Request): boolean =>
    request.method === 'GET' && new URL(request.url).pathname === DETAIL_PATH,
  respond: (): Response =>
    jsonResponse({ goodsReceipt: goodsReceiptFixtures[0], lines: goodsReceiptLineFixtures }),
};

const recordingFetch = (): { fetch: ReturnType<typeof createStubFetch>; paths: string[] } => {
  const paths: string[] = [];
  const stub = createStubFetch([detailRoute]);

  return {
    paths,
    fetch: async (request) => {
      paths.push(new URL(request.url).pathname);

      return stub(request);
    },
  };
};

/**
 * 던져진 실패가 상태로 앉을 시간을 준다.
 *
 * **동기로 곧바로 단언하면 놓친다** — `queryFn`이 던져도 그 실패는 마이크로태스크를 한 바퀴
 * 돈 뒤에야 쿼리 상태가 된다. 기다리지 않고 재면 「아직 실패하지 않았다」를 「실패하지
 * 않는다」로 읽는다.
 */
const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
};

describe('useGoodsReceiptDetail', () => {
  it('고르지 않았으면 조회가 서지 않는다', async () => {
    const { fetch, paths } = recordingFetch();
    const { result } = renderHookWithProviders(() => useGoodsReceiptDetail(null), { fetch });

    await settle();

    expect(paths).toEqual([]);
    /* 조회가 **아예 서지 않았다** — 섰다가 가드에 막힌 것이 아니다. */
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.isError).toBe(false);
  });

  /**
   * **다시 부르기는 `enabled`를 보지 않는다**(설치본 실측) — 「다시 조회」가 성립하지 않는
   * 조회를 불러도 요청이 나가서는 안 되고, 그것을 막는 것은 `queryFn`의 가드뿐이다.
   * 마운트만 재는 앞 감지기는 이 경로를 지나가지 않으므로 **여기서 단독으로 잰다.**
   *
   * 실패 상태로 앉는 것까지 막는 것은 이 가드의 몫이 아니다 — 그것은 부르는 쪽이 막고,
   * 화면 수준 감지기가 「쓸모없는 실패를 만들지 않는다」로 잰다.
   */
  it('고르지 않은 채 다시 불러도 요청이 나가지 않는다', async () => {
    const { fetch, paths } = recordingFetch();
    const { result } = renderHookWithProviders(() => useGoodsReceiptDetail(null), { fetch });

    await settle();

    await act(async () => {
      await result.current.refetch();
    });
    await settle();

    expect(paths).toEqual([]);
  });

  /** 짝 방향 — 고르면 실제로 나간다(아무것도 안 불러서 통과한 것이 아니다). */
  it('고르면 그 전표의 경로로 한 번 나간다', async () => {
    const { fetch, paths } = recordingFetch();
    const { result } = renderHookWithProviders(() => useGoodsReceiptDetail(9001), { fetch });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(paths).toEqual([DETAIL_PATH]);
    expect(result.current.data?.lines).toHaveLength(goodsReceiptLineFixtures.length);
  });
});

/**
 * 재고 잔액 조회를 **겹을 떼어내고** 재는 자리(PR ① 계획 정정 1의 M16 일화 — 「겹 뒤의 규칙은
 * 겹을 떼어내고 잰다」).
 *
 * 「전표를 고르기 전에는 잔액을 부르지 않는다」도 두 겹이다 — **① `enabled`**와
 * **② `queryFn`의 가드**. 화면에서 요청 수만 세면 ①을 떼어도 ②가 막아 아무도 울지 않는다.
 */
const BALANCES_PATH = '/inventory/balances';

const balancesRoute = (
  page: Partial<{ page: number; size: number; total: number }> = {},
): StubRoute => ({
  match: (request: Request): boolean =>
    request.method === 'GET' && new URL(request.url).pathname === BALANCES_PATH,
  respond: (request: Request): Response => {
    const itemId = new URL(request.url).searchParams.get('itemId');
    const items = balanceFixtures.filter((balance) => String(balance.itemId) === itemId);

    return jsonResponse({ items, page: { page: 1, size: 50, total: items.length, ...page } });
  },
});

const recordingBalanceFetch = (
  routes: StubRoute[],
): { fetch: StubFetch; urls: URL[] } => {
  const urls: URL[] = [];
  const stub = createStubFetch(routes);

  return {
    urls,
    fetch: async (request) => {
      urls.push(new URL(request.url));

      return stub(request);
    },
  };
};

describe('useOnHandBalances', () => {
  /** **M25의 첫째 겹** — `enabled`를 떼면 창고를 모르는 채 조회가 선다. */
  it('창고를 모르면 조회가 서지 않는다', async () => {
    const { fetch, urls } = recordingBalanceFetch([balancesRoute()]);
    const { result } = renderHookWithProviders(() => useOnHandBalances(null, [9301]), { fetch });

    await settle();

    expect(urls).toEqual([]);
    expect(result.current.items).toEqual([]);
    expect(result.current.isError).toBe(false);
  });

  /** 「다시 부르기」는 `enabled`를 보지 않는다 — 막는 것은 `queryFn`의 가드뿐이다. */
  it('창고를 모르는 채 다시 불러도 요청이 나가지 않는다', async () => {
    const { fetch, urls } = recordingBalanceFetch([balancesRoute()]);
    const { result } = renderHookWithProviders(() => useOnHandBalances(null, [9301]), { fetch });

    await settle();
    act(() => {
      result.current.refetch();
    });
    await settle();

    expect(urls).toEqual([]);
  });

  it('품목이 하나도 없으면 요청이 없다', async () => {
    const { fetch, urls } = recordingBalanceFetch([balancesRoute()]);
    const { result } = renderHookWithProviders(() => useOnHandBalances(9701, []), { fetch });

    await settle();

    expect(urls).toEqual([]);
    expect(result.current.items).toEqual([]);
  });

  /**
   * **C20** — 다섯 조건이 전부 실려야 한다. 특히 `includeZero`를 빼면 보유가 0인 LOT이
   * 아예 오지 않아 「0이라 없다」와 「잘려서 없다」가 뭉개진다(감지기 M26).
   */
  it('창고·품목·묶는 축·0 포함·쪽 크기를 함께 싣는다', async () => {
    const { fetch, urls } = recordingBalanceFetch([balancesRoute()]);
    const { result } = renderHookWithProviders(() => useOnHandBalances(9701, [9301]), { fetch });

    await waitFor(() => {
      expect(result.current.items[0]?.isLoading).toBe(false);
    });

    expect(urls).toHaveLength(1);
    expect(Object.fromEntries(urls[0]?.searchParams ?? [])).toEqual({
      warehouseId: '9701',
      itemId: '9301',
      groupBy: 'LOT',
      includeZero: 'true',
      size: String(BALANCE_PAGE_SIZE),
    });
  });

  /** 번호 여러 개를 한 번에 받는 조건이 계약에 없다 — **품목마다 한 번**이다. */
  it('품목마다 한 번씩 나가고 같은 품목은 한 번만 나간다', async () => {
    const { fetch, urls } = recordingBalanceFetch([balancesRoute()]);
    const { result } = renderHookWithProviders(
      () => useOnHandBalances(9701, [9301, 9302, 9301]),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.items.every((item) => !item.isLoading)).toBe(true);
    });

    expect(urls.map((url) => url.searchParams.get('itemId')).sort()).toEqual(['9301', '9302']);
    expect(result.current.items.map((item) => item.itemId)).toEqual([9301, 9302]);
  });

  it('품목마다의 잔액 줄을 그 품목 자리에 담는다', async () => {
    const { fetch } = recordingBalanceFetch([balancesRoute()]);
    const { result } = renderHookWithProviders(() => useOnHandBalances(9701, [9301]), { fetch });

    await waitFor(() => {
      expect(result.current.items[0]?.entries.length).toBeGreaterThan(0);
    });

    expect(result.current.items[0]?.entries).toEqual(
      balanceFixtures
        .filter((balance) => balance.itemId === 9301)
        .map((balance) => ({
          lotId: balance.lotId,
          onHandQty: balance.onHandQty,
          uomId: balance.uomId,
        })),
    );
  });

  /** 잘림을 **품목마다** 낸다 — 한 품목이 잘렸다고 다른 품목의 상한까지 버릴 이유가 없다. */
  it('전체 건수가 받은 건수보다 많으면 잘린 것으로 낸다', async () => {
    const { fetch } = recordingBalanceFetch([balancesRoute({ total: 99 })]);
    const { result } = renderHookWithProviders(() => useOnHandBalances(9701, [9301]), { fetch });

    await waitFor(() => {
      expect(result.current.items[0]?.isLoading).toBe(false);
    });

    expect(result.current.items[0]?.truncated).toBe(true);
    expect(result.current.truncated).toBe(true);
  });

  it('잘리지 않았으면 그렇게 낸다', async () => {
    const { fetch } = recordingBalanceFetch([balancesRoute()]);
    const { result } = renderHookWithProviders(() => useOnHandBalances(9701, [9301]), { fetch });

    await waitFor(() => {
      expect(result.current.items[0]?.isLoading).toBe(false);
    });

    expect(result.current.items[0]?.truncated).toBe(false);
    expect(result.current.truncated).toBe(false);
  });

  it('실패한 품목만 실패로 낸다', async () => {
    const failing: StubRoute = {
      match: (request) =>
        request.method === 'GET' &&
        new URL(request.url).pathname === BALANCES_PATH &&
        new URL(request.url).searchParams.get('itemId') === '9302',
      respond: () => jsonResponse({ message: '' }, { status: 500 }),
    };
    const { fetch } = recordingBalanceFetch([failing, balancesRoute()]);
    const { result } = renderHookWithProviders(() => useOnHandBalances(9701, [9301, 9302]), {
      fetch,
    });

    await waitFor(() => {
      expect(result.current.items.every((item) => !item.isLoading)).toBe(true);
    });

    expect(result.current.items.map((item) => item.isError)).toEqual([false, true]);
    expect(result.current.isError).toBe(true);
  });
});

describe('isReceiptNotFound', () => {
  /**
   * 없는 전표는 다시 시도해도 나타나지 않는다 — 「다시 시도」가 아니라 **다시 고르기**로
   * 안내해야 하므로 다른 실패와 갈린다.
   */
  it('404만 없는 전표로 본다', () => {
    expect(isReceiptNotFound(new ApiRequestError({ kind: 'http', status: 404 }))).toBe(true);
    expect(isReceiptNotFound(new ApiRequestError({ kind: 'http', status: 500 }))).toBe(false);
    expect(isReceiptNotFound(new ApiRequestError(NETWORK_ERROR))).toBe(false);
  });

  /* 요청 경로 밖에서 생긴 오류를 없는 전표로 읽으면 고른 번호를 까닭 없이 지운다. */
  it('요청 경로 밖의 오류는 없는 전표가 아니다', () => {
    expect(isReceiptNotFound(new Error('렌더 중 예외'))).toBe(false);
  });
});
