import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { DEFAULT_FILTERS } from './filters';
import { ruleFixtures, uncoveredItemFixtures } from './fixtures';
import { useRuleList, useUncoveredItems } from './queries';
import type { RuleFilters } from './types';

const RULES_PATH = '/logistics/putaway-rules';
const UNCOVERED_PATH = '/logistics/putaway-rules/uncovered-items';

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

    renderHookWithProviders(() => useUncoveredItems(null, 1), { fetch });

    expect(countOf(urls, UNCOVERED_PATH)).toBe(0);
  });

  /**
   * **목록 조건을 싣지 않는다.** 이 수는 창고 전체의 사실이며 조건으로 좁히면 조건에 따라
   * 수가 달라져 근거로 쓸 수 없다.
   */
  it('창고만 싣고 목록 조건을 싣지 않는다', async () => {
    const { fetch, urls } = recordingFetch([uncoveredRoute()]);
    const { result } = renderHookWithProviders(() => useUncoveredItems(9201, 1), { fetch });

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
    const { result } = renderHookWithProviders(() => useUncoveredItems(9201, 1), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.page.total).toBe(0);
  });
});
