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
import { balanceRow, ruleFixtureAt, ruleFixtures, uncoveredItemFixtures } from './fixtures';
import {
  BALANCE_PAGE_SIZE,
  DUPLICATE_PROBE_SIZE,
  balanceKeys,
  putawayRuleKeys,
  ruleDetailPath,
  useDuplicateProbe,
  useRuleBalances,
  useRuleDetail,
  useRuleList,
  useUncoveredItems,
} from './queries';
import type { RuleFilters } from './types';

const RULES_PATH = '/logistics/putaway-rules';
const UNCOVERED_PATH = '/logistics/putaway-rules/uncovered-items';
const BALANCES_PATH = '/inventory/balances';

/**
 * 상세 응답. **잠금 토큰은 헤더로 온다**(공유계약 A-4 — 본문 필드로 노출하지 않는다).
 * 편집 가능 여부도 여기에만 있다.
 */
const detailRoute = (putawayRuleId = 9001): StubRoute => ({
  match: (request) => isExactly(request, ruleDetailPath(putawayRuleId)),
  respond: () =>
    jsonResponse(
      {
        putawayRule: ruleFixtureAt(putawayRuleId),
        editability: { codeEditable: false, reason: 'REFERENCED', referenceCount: 2 },
      },
      { headers: { ETag: '7' } },
    ),
});

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

describe('putawayRuleKeys.all', () => {
  /**
   * **뿌리 하나로 규칙 조회 셋을 덮는다** — 규칙을 고치면 목록도, 규칙 없는 품목 수도,
   * 조준 조회의 판정도 함께 낡는다. 무효화 범위가 갈리면 갱신된 값과 낡은 값이 한 화면에 선다.
   */
  it('목록·규칙없는품목·상세·조준 조회를 모두 덮는다', () => {
    const root = [...putawayRuleKeys.all];

    for (const key of [
      putawayRuleKeys.list(filtersOf(), 1),
      putawayRuleKeys.uncovered(9201),
      putawayRuleKeys.detail(9001),
      putawayRuleKeys.duplicateProbe(9201, 9101),
    ]) {
      expect([...key].slice(0, root.length)).toEqual(root);
    }
  });

  /**
   * ⛔ **잔액 키를 덮지 않는다.** 규칙을 고쳐도 창고의 실물 재고는 달라지지 않는다 —
   * 뿌리를 합치면 바뀌지 않은 값을 저장할 때마다 다시 부른다.
   */
  it('잔액 키를 덮지 않는다', () => {
    const root = [...putawayRuleKeys.all];
    const balanceKey = [...balanceKeys.onHand(9201, { itemId: 9101, locationId: 9301 })];

    expect(balanceKey.slice(0, root.length)).not.toEqual(root);
  });
});

describe('ruleDetailPath', () => {
  /**
   * 토큰 보관소는 **응답이 온 URL 경로**를 열쇠로 쓴다 — 이 문자열이 상세 조회가 실제로
   * 부르는 경로와 갈리면 잠금 토큰을 영원히 찾지 못하고 쓰기가 조용히 멈춘다.
   */
  it('상세 조회가 부르는 경로와 같다', async () => {
    const { fetch, urls } = recordingFetch([detailRoute()]);

    renderHookWithProviders(() => useRuleDetail(9001), { fetch });

    await waitFor(() => {
      expect(countOf(urls, ruleDetailPath(9001))).toBe(1);
    });
  });

  it('번호를 경로에 담는다', () => {
    expect(ruleDetailPath(9002)).toBe('/logistics/putaway-rules/9002');
  });
});

describe('useRuleDetail', () => {
  /** 번호가 없으면 요청 자체가 만들어질 수 없다 — 열어 두면 `…/0`이 나가 헛돈다. */
  it('고르기 전에는 부르지 않는다', async () => {
    const { fetch, urls } = recordingFetch([detailRoute()]);

    renderHookWithProviders(() => useRuleDetail(null), { fetch });

    await waitFor(() => {
      expect(urls).toHaveLength(0);
    });
  });

  /** 편집 가능 여부는 **상세에만** 있다 — 목록 행에는 그 사실이 없다. */
  it('규칙과 편집 가능 여부를 함께 낸다', async () => {
    const { fetch } = recordingFetch([detailRoute()]);
    const { result } = renderHookWithProviders(() => useRuleDetail(9001), { fetch });

    await waitFor(() => {
      expect(result.current.data?.putawayRule.putawayRuleId).toBe(9001);
    });

    expect(result.current.data?.editability.codeEditable).toBe(false);
  });
});

describe('useDuplicateProbe', () => {
  /** 겨눌 조합이 아직 없으면 부를 조건도 없다 — 폼이 닫혀 있으면 두 번호가 `null`이다. */
  it.each([
    ['품목', 9201, null],
    ['창고', null, 9101],
    ['둘 다', null, null],
  ])('%s이 정해지기 전에는 부르지 않는다', async (_name, warehouseId, itemId) => {
    const { fetch, urls } = recordingFetch([rulesRoute()]);

    renderHookWithProviders(() => useDuplicateProbe(warehouseId, itemId), { fetch });

    await waitFor(() => {
      expect(urls).toHaveLength(0);
    });
  });

  /**
   * ⛔ **열리지도 않은 조회를 「불러오는 중」으로 말하지 않는다.**
   *
   * TanStack v5에서 `enabled`가 거짓인 질의는 `isPending`이 **참**이다. 그 값을 그대로 옮기면
   * 한 번도 나가지 않은 요청이 「불러오는 중」으로 보이고, 그 상태가 **미완성 판정을 가려**
   * 갓 연 빈 폼이 「확인하지 못했습니다」라고 말하게 된다.
   *
   * 같은 함정을 `useItemSearch`가 이미 같은 형태로 피했다 — 두 조회가 같은 규율을 지나야 한다.
   */
  it('겨눈 것이 없으면 불러오는 중이 아니다', async () => {
    const { fetch } = recordingFetch([rulesRoute()]);
    const { result } = renderHookWithProviders(() => useDuplicateProbe(9201, null), { fetch });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.isError).toBe(false);
  });

  /** 겨눈 것이 있고 아직 오지 않았으면 그때는 **참말로** 불러오는 중이다(양성 짝). */
  it('겨눈 것이 있고 응답이 오기 전에는 불러오는 중이다', async () => {
    const holding: StubRoute = {
      match: (request) => isExactly(request, RULES_PATH),
      respond: () => jsonResponse(listBody([])),
    };
    const urls: URL[] = [];
    const stub = createStubFetch([holding]);
    const { result } = renderHookWithProviders(() => useDuplicateProbe(9201, 9101), {
      fetch: async (request) => {
        urls.push(new URL(request.url));

        return stub(request);
      },
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  /**
   * **창고·품목만 싣는다** — 쿼리로는 「창고 전체」(`locationId === null`)를 표현할 수 없고
   * 우선순위 조건 자체가 없다. 맞추는 일은 `judgeDuplicate`가 한다.
   */
  it('창고·품목으로 좁히고 사용 중인 것만 부른다', async () => {
    const { fetch, urls } = recordingFetch([rulesRoute()]);

    renderHookWithProviders(() => useDuplicateProbe(9201, 9101), { fetch });

    await waitFor(() => {
      expect(countOf(urls, RULES_PATH)).toBe(1);
    });

    const query = urls[0]?.searchParams;

    expect(query?.get('warehouseId')).toBe('9201');
    expect(query?.get('itemId')).toBe('9101');
    expect(query?.get('includeInactive')).toBe('false');
    expect(query?.get('locationId')).toBeNull();
  });

  /**
   * 판정하는 자리에서 **잘림은 「없다」로 읽힌다.** 크기를 명시해야 `page.total`과 견줘
   * 잘렸는지 알 수 있다.
   */
  it('쪽 크기를 명시해 싣는다', async () => {
    const { fetch, urls } = recordingFetch([rulesRoute()]);

    renderHookWithProviders(() => useDuplicateProbe(9201, 9101), { fetch });

    await waitFor(() => {
      expect(countOf(urls, RULES_PATH)).toBe(1);
    });

    expect(urls[0]?.searchParams.get('size')).toBe(String(DUPLICATE_PROBE_SIZE));
  });
});
