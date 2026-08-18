import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import type { BalanceTarget } from './balance-lookup';
import { DEFAULT_FILTERS } from './filters';
import { balanceRow, ruleFixtures, uncoveredItemFixtures } from './fixtures';
import { BALANCE_PAGE_SIZE, useRuleBalances, useRuleList, useUncoveredItems } from './queries';
import type { RuleFilters } from './types';

const RULES_PATH = '/logistics/putaway-rules';
const UNCOVERED_PATH = '/logistics/putaway-rules/uncovered-items';
const BALANCES_PATH = '/inventory/balances';

const listBody = (items: unknown[], total = items.length) => ({
  items,
  page: { page: 1, size: 20, total },
});

/**
 * 경로가 겹친다 — 규칙 없는 품목 경로가 목록 경로로 시작하므로 `pathname`을 **정확히** 견준다.
 * 접두로 견주면 두 조회를 갈라 셀 수 없고, 「목록을 부르지 않았다」가 헛통과한다.
 */
const isExactly = (request: Request, pathname: string): boolean =>
  new URL(request.url).pathname === pathname;

const rulesRoute = (items: unknown[] = ruleFixtures, total?: number): StubRoute => ({
  match: (request) => isExactly(request, RULES_PATH),
  respond: () => jsonResponse(listBody(items, total)),
});

const uncoveredRoute = (items: unknown[] = uncoveredItemFixtures, total?: number): StubRoute => ({
  match: (request) => isExactly(request, UNCOVERED_PATH),
  respond: () => jsonResponse(listBody(items, total)),
});

/** 나간 요청의 주소를 기록한다. 「부르지 않았다」는 셀 수 있는 자리가 있어야 증명된다. */
const recordingFetch = (routes: StubRoute[]): { fetch: StubFetch; urls: URL[] } => {
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

const countOf = (urls: URL[], pathname: string): number =>
  urls.filter((url) => url.pathname === pathname).length;

const filtersOf = (overrides: Partial<RuleFilters> = {}): RuleFilters => ({
  ...DEFAULT_FILTERS,
  ...overrides,
});

describe('useRuleList', () => {
  /**
   * **창고를 고르기 전에는 부르지 않는다.** 창고 없이 부르면 전 창고의 규칙이 섞여 오고,
   * 그 목록은 어느 창고의 사실도 아니다.
   */
  it('창고를 고르기 전에는 목록을 부르지 않는다', () => {
    const { fetch, urls } = recordingFetch([rulesRoute()]);

    renderHookWithProviders(() => useRuleList(DEFAULT_FILTERS, 1), { fetch });

    expect(countOf(urls, RULES_PATH)).toBe(0);
  });

  it('창고를 고르면 그 창고로 목록을 부른다', async () => {
    const { fetch, urls } = recordingFetch([rulesRoute()]);
    const { result } = renderHookWithProviders(
      () => useRuleList(filtersOf({ warehouseId: '9201' }), 1),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.data?.items).toHaveLength(ruleFixtures.length);
    });

    const query = urls[0]?.searchParams;

    expect(query?.get('warehouseId')).toBe('9201');
    expect(query?.get('includeInactive')).toBe('true');
  });

  it('사용 중만을 켜면 includeInactive=false가 실린다', async () => {
    const { fetch, urls } = recordingFetch([rulesRoute()]);
    const { result } = renderHookWithProviders(
      () => useRuleList(filtersOf({ warehouseId: '9201', activeOnly: true }), 1),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(urls[0]?.searchParams.get('includeInactive')).toBe('false');
  });

  it('조회가 실패하면 실패로 남는다 — 빈 목록으로 뭉개지 않는다', async () => {
    const failing: StubRoute = {
      match: (request) => isExactly(request, RULES_PATH),
      respond: () => jsonResponse({ message: '' }, { status: 500 }),
    };
    const { fetch } = recordingFetch([failing]);
    const { result } = renderHookWithProviders(
      () => useRuleList(filtersOf({ warehouseId: '9201' }), 1),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.data).toBeUndefined();
  });
});

describe('useUncoveredItems', () => {
  it('창고를 고르기 전에는 부르지 않는다', () => {
    const { fetch, urls } = recordingFetch([uncoveredRoute()]);

    renderHookWithProviders(() => useUncoveredItems(null), { fetch });

    expect(countOf(urls, UNCOVERED_PATH)).toBe(0);
  });

  /**
   * **목록 조건을 싣지 않는다.** 이 수는 창고 전체의 사실이며 조건으로 좁히면 조건에 따라
   * 수가 달라져 근거로 쓸 수 없다.
   */
  it('창고만 싣고 목록 조건을 싣지 않는다', async () => {
    const { fetch, urls } = recordingFetch([uncoveredRoute()]);
    const { result } = renderHookWithProviders(() => useUncoveredItems(9201), { fetch });

    await waitFor(() => {
      expect(result.current.data?.items).toHaveLength(uncoveredItemFixtures.length);
    });

    const query = urls[0]?.searchParams;

    expect(query?.get('warehouseId')).toBe('9201');
    expect(query?.has('itemId')).toBe(false);
    expect(query?.has('includeInactive')).toBe(false);
  });

  /** 0건이 정상이며 좋은 상태다 — 빈 목록을 실패로 다루지 않는다. */
  it('0건도 성공이다', async () => {
    const { fetch } = recordingFetch([uncoveredRoute([], 0)]);
    const { result } = renderHookWithProviders(() => useUncoveredItems(9201), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.page.total).toBe(0);
  });
});

const balancesRoute = (items: unknown[] = [balanceRow()], total?: number): StubRoute => ({
  match: (request) => isExactly(request, BALANCES_PATH),
  respond: () => jsonResponse(listBody(items, total)),
});

const AT_LOCATION: BalanceTarget = { itemId: 9101, locationId: 9301 };
const WAREHOUSE_WIDE: BalanceTarget = { itemId: 9102, locationId: null };

const balanceQueryOf = (urls: URL[], index = 0): URLSearchParams | undefined =>
  urls.filter((url) => url.pathname === BALANCES_PATH)[index]?.searchParams;

describe('useRuleBalances', () => {
  /** 창고 없이 부르면 남의 창고 잔액이 이 화면의 사용률이 된다 — 조건 자체가 성립하지 않는다. */
  it('창고를 고르기 전에는 부르지 않는다', () => {
    const { fetch, urls } = recordingFetch([balancesRoute()]);

    renderHookWithProviders(() => useRuleBalances(null, [AT_LOCATION]), { fetch });

    expect(countOf(urls, BALANCES_PATH)).toBe(0);
  });

  it('볼 규칙이 없으면 부르지 않는다', () => {
    const { fetch, urls } = recordingFetch([balancesRoute()]);

    renderHookWithProviders(() => useRuleBalances(9201, []), { fetch });

    expect(countOf(urls, BALANCES_PATH)).toBe(0);
  });

  /**
   * **C2-1 앞머리.** 계약은 「창고·품목·LOT 중 적어도 하나」를 요구하는데 위치는 그 셋에 들지
   * 않는다 — 위치만 실으면 400이다. 그래서 창고를 늘 싣는다.
   */
  it('위치가 있는 규칙은 창고·품목·위치를 함께 싣는다', async () => {
    const { fetch, urls } = recordingFetch([balancesRoute()]);
    const { result } = renderHookWithProviders(() => useRuleBalances(9201, [AT_LOCATION]), {
      fetch,
    });

    await waitFor(() => {
      expect(result.current.targets[0]?.isLoading).toBe(false);
    });

    const query = balanceQueryOf(urls);

    expect(query?.get('warehouseId')).toBe('9201');
    expect(query?.get('itemId')).toBe('9101');
    expect(query?.get('locationId')).toBe('9301');
  });

  /**
   * **C2-1 뒷머리.** 위치를 비운 규칙은 그 창고의 그 품목 **전체**가 대상이다 —
   * `locationId`를 실으면 한 위치의 잔액만 보고 창고 전체 규칙의 사용률이 실제보다 작아진다.
   */
  it('위치를 비운 규칙은 위치를 싣지 않는다', async () => {
    const { fetch, urls } = recordingFetch([balancesRoute()]);
    const { result } = renderHookWithProviders(() => useRuleBalances(9201, [WAREHOUSE_WIDE]), {
      fetch,
    });

    await waitFor(() => {
      expect(result.current.targets[0]?.isLoading).toBe(false);
    });

    const query = balanceQueryOf(urls);

    expect(query?.has('locationId')).toBe(false);
    expect(query?.get('itemId')).toBe('9102');
  });

  /**
   * **위치 축으로 묶어야 창고 전체 규칙과 위치 규칙이 갈린다.** 품목 축으로 묶으면 위치가
   * 접혀 두 규칙이 같은 수를 보게 된다.
   *
   * **0인 줄도 받는다.** 받지 않으면 「0이라 없다」와 「그 조건의 줄이 없다」가 화면에서
   * 같아 보이고, 0이라는 확인된 사실이 「확인하지 못함」으로 떨어진다.
   */
  it('위치 축으로 묶고 0인 줄도 받는다', async () => {
    const { fetch, urls } = recordingFetch([balancesRoute()]);
    const { result } = renderHookWithProviders(() => useRuleBalances(9201, [AT_LOCATION]), {
      fetch,
    });

    await waitFor(() => {
      expect(result.current.targets[0]?.isLoading).toBe(false);
    });

    const query = balanceQueryOf(urls);

    expect(query?.get('groupBy')).toBe('LOCATION');
    expect(query?.get('includeZero')).toBe('true');
    expect(query?.get('size')).toBe(String(BALANCE_PAGE_SIZE));
  });

  it('대상마다 한 번씩 부른다', async () => {
    const { fetch, urls } = recordingFetch([balancesRoute()]);
    const { result } = renderHookWithProviders(
      () => useRuleBalances(9201, [AT_LOCATION, WAREHOUSE_WIDE]),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.targets.every((target) => !target.isLoading)).toBe(true);
    });

    expect(countOf(urls, BALANCES_PATH)).toBe(2);
  });

  /**
   * **대상마다 갈라 든다.** 한 대상의 실패를 전체 실패로 뭉치면 멀쩡히 받은 대상의 규칙까지
   * 사용률을 잃는다 — 그 규칙들은 화면이 답해 줄 수 있는데도 못 답하게 된다.
   */
  it('한 대상이 실패해도 다른 대상은 그대로 선다', async () => {
    const failingLocation: StubRoute = {
      match: (request) =>
        isExactly(request, BALANCES_PATH) && new URL(request.url).searchParams.has('locationId'),
      respond: () => jsonResponse({ message: '' }, { status: 500 }),
    };
    const { fetch } = recordingFetch([failingLocation, balancesRoute()]);
    const { result } = renderHookWithProviders(
      () => useRuleBalances(9201, [AT_LOCATION, WAREHOUSE_WIDE]),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    const atLocation = result.current.targets.find((target) => target.locationId === 9301);
    const wide = result.current.targets.find((target) => target.locationId === null);

    expect(atLocation?.isError).toBe(true);
    expect(wide?.isError).toBe(false);
    expect(wide?.rows).toHaveLength(1);
  });

  /** 서버가 센 전체 건수가 받은 건수보다 많으면 잘린 것이다 — 잘린 합을 사용률의 분자로 쓰지 않는다. */
  it('전체 건수가 받은 건수보다 많으면 잘림으로 표시한다', async () => {
    const { fetch } = recordingFetch([balancesRoute([balanceRow()], 5)]);
    const { result } = renderHookWithProviders(() => useRuleBalances(9201, [AT_LOCATION]), {
      fetch,
    });

    await waitFor(() => {
      expect(result.current.truncated).toBe(true);
    });

    expect(result.current.targets[0]?.truncated).toBe(true);
  });

  /** 대상의 차례가 그대로 결과의 차례다 — 어긋나면 규칙이 남의 잔액을 읽는다. */
  it('결과가 대상의 축을 그대로 들고 있다', async () => {
    const { fetch } = recordingFetch([balancesRoute()]);
    const { result } = renderHookWithProviders(
      () => useRuleBalances(9201, [AT_LOCATION, WAREHOUSE_WIDE]),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.targets.every((target) => !target.isLoading)).toBe(true);
    });

    expect(result.current.targets.map((target) => [target.itemId, target.locationId])).toEqual([
      [9101, 9301],
      [9102, null],
    ]);
  });
});
