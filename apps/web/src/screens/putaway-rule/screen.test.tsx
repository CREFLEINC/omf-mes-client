import { messages } from '@omf-mes/i18n';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import {
  INACTIVE_LOCATION_LABEL,
  ITEM_LABEL,
  LOCATION_LABEL,
  OWNERSHIP_A,
  OWNERSHIP_B,
  UOM_LABEL,
  WAREHOUSE_LABEL,
  balanceRow,
  itemFixtures,
  locationFixtures,
  ruleFixtureAt,
  ruleFixtures,
  uncoveredItemFixtures,
  uomFixtures,
  warehouseFixtures,
} from './fixtures';
import { PutawayRuleScreen } from './screen';

const t = messages.putawayRule;

const RULES_PATH = '/logistics/putaway-rules';
const UNCOVERED_PATH = '/logistics/putaway-rules/uncovered-items';
const BALANCES_PATH = '/inventory/balances';
const WAREHOUSES_PATH = '/mdm/warehouses';
const LOCATIONS_PATH = '/mdm/locations';
const ITEMS_PATH = '/mdm/items';
const UOMS_PATH = '/mdm/uoms';

/** 단위 9402의 풀린 이름. 창고 전체 규칙(9002)의 용량·적재가 이 단위로 선다. */
const OTHER_UOM_LABEL = 'SYN-UOM-02 · 합성단위 나';

/** 창고를 고른 주소. 이 화면의 거의 모든 조회가 이 조건에서 열린다. */
const WITH_WAREHOUSE = '/?wh=9201';

/**
 * 경로가 겹친다 — 규칙 없는 품목 경로가 목록 경로로 시작하므로 `pathname`을 **정확히** 견준다.
 * 접두로 견주면 두 조회를 갈라 셀 수 없고, 「목록을 부르지 않았다」가 헛통과한다.
 */
const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const listBody = (
  items: unknown[],
  page: Partial<{ page: number; size: number; total: number }> = {},
) => ({ items, page: { page: 1, size: 20, total: items.length, ...page } });

const route = (
  pathname: string,
  items: unknown[],
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse(listBody(items, page)),
});

const failing = (pathname: string, status = 500): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse({ message: '' }, { status }),
});

/**
 * 규칙별로 다른 잔액을 돌려주는 스텁.
 *
 * **한 벌로 같은 답을 내면 배선을 잴 수 없다** — 어느 규칙이 어느 잔액을 받았는지 화면에서
 * 구분되지 않아 「대상마다 갈라 부른다」가 헛통과한다. 요청의 조건을 읽어 그 조건의 답을 준다.
 */
const balanceRowsFor = (itemId: number, locationId: number | null): unknown[] => {
  /* 규칙 9001 — 용량 500, 적재 320 → 64%. 100% 아래 갈래다. */
  if (itemId === 9101 && locationId === 9301) return [balanceRow({ onHandQty: 320 })];
  /* 규칙 9003 — 용량 80, 적재 100 → 125%. 100%를 넘는 갈래다(꺼진 규칙도 적재는 있다). */
  if (itemId === 9101 && locationId === 9302) {
    return [balanceRow({ locationId: 9302, onHandQty: 100 })];
  }
  /* 규칙 9002 — 위치를 비운 창고 전체 규칙. 두 위치의 줄을 함께 받아 더한다(600 / 1200 = 50%). */
  if (itemId === 9102 && locationId === null) {
    return [
      balanceRow({ itemId: 9102, locationId: 9301, uomId: 9402, onHandQty: 300 }),
      balanceRow({ itemId: 9102, locationId: 9302, uomId: 9402, onHandQty: 300 }),
    ];
  }

  /* 규칙 9004 — 그 조건의 잔액 줄이 없다. 「0이다」가 아니라 「없다」 갈래다. */
  return [];
};

const balancesRoute: StubRoute = {
  match: (request) => isGet(request, BALANCES_PATH),
  respond: (request) => {
    const query = new URL(request.url).searchParams;
    const locationId = query.get('locationId');

    return jsonResponse(
      listBody(
        balanceRowsFor(
          Number(query.get('itemId')),
          locationId === null ? null : Number(locationId),
        ),
      ),
    );
  },
};

/** 상세가 내려 주는 잠금 토큰. **다음 쓰기의 `If-Match`에 이 값이 그대로 실려야 한다.** */
const DETAIL_ETAG = '7';

const detailPathOf = (putawayRuleId: number): string =>
  `/logistics/putaway-rules/${String(putawayRuleId)}`;

const isDetailPath = (pathname: string): boolean =>
  /^\/logistics\/putaway-rules\/\d+$/.test(pathname);

const ruleIdOf = (url: URL): number => Number(url.pathname.split('/').at(-1));

/**
 * 규칙 상세. **잠금 토큰은 헤더로 온다**(공유계약 A-4) — 본문에는 없다.
 *
 * 번호를 인자로 받지 않고 **요청이 가리키는 규칙을 돌려준다.** 한 벌로 같은 답을 내면
 * 「고른 규칙의 상세를 부른다」가 헛통과한다.
 */
const detailRoute: StubRoute = {
  match: (request) => request.method === 'GET' && isDetailPath(new URL(request.url).pathname),
  respond: (request) =>
    jsonResponse(
      {
        putawayRule: ruleFixtureAt(ruleIdOf(new URL(request.url))),
        editability: { codeEditable: false, reason: 'REFERENCED', referenceCount: 2 },
      },
      { headers: { ETag: DETAIL_ETAG } },
    ),
};

/** 다른 창고의 위치. **좁힘이 요청에서 왔음**을 증명하려면 걸러질 것이 있어야 한다. */
const OTHER_WAREHOUSE_LOCATION = {
  locationId: 9303,
  warehouseId: 9202,
  locationCode: 'SYN-LOC-03',
  locationName: '합성위치 다',
  locationTypeCode: 'SYN-LOC-TYPE',
  allowMixedItem: false,
  allowMixedLot: false,
  isActive: true,
};

const OTHER_WAREHOUSE_LOCATION_LABEL = 'SYN-LOC-03 · 합성위치 다';

/** 창고로 걸러 돌려준다 — 계약이 `warehouseId`를 **필수**로 요구하는 조회다. */
const locationsRoute: StubRoute = {
  match: (request) => isGet(request, LOCATIONS_PATH),
  respond: (request) => {
    const warehouseId = Number(new URL(request.url).searchParams.get('warehouseId'));

    return jsonResponse(
      listBody(
        [...locationFixtures, OTHER_WAREHOUSE_LOCATION].filter(
          (location) => location.warehouseId === warehouseId,
        ),
      ),
    );
  },
};

/**
 * **조준 조회의 기본 스텁 — 요청이 좁힌 축을 실제로 지킨다.**
 *
 * 목록 스텁 한 벌로 같은 답을 내면 조준 조회가 **부르지도 않은 축의 행**을 받는다. 그러면
 * 「조회가 좁혀 온 자료를 다시 견주는」 자리가 시험에서 늘 어긋난 자료를 보게 되어, 축을
 * 지키는 판정이 무엇을 하는지 잴 수 없다(사본 체크리스트 11번 — 스텁이 요청을 읽어야 한다).
 *
 * 계약대로 `warehouseId`·`itemId`로 좁히고 `includeInactive=false`면 사용 중인 것만 낸다.
 */
const probeRoute: StubRoute = {
  match: (request) => isGet(request, RULES_PATH) && isProbe(new URL(request.url)),
  respond: (request) => {
    const query = new URL(request.url).searchParams;
    const warehouseId = Number(query.get('warehouseId'));
    const itemId = Number(query.get('itemId'));
    const includeInactive = query.get('includeInactive') === 'true';

    return jsonResponse(
      listBody(
        ruleFixtures.filter(
          (rule) =>
            rule.warehouseId === warehouseId &&
            rule.itemId === itemId &&
            (includeInactive || rule.isActive),
        ),
      ),
    );
  },
};

/**
 * 모든 조회를 세울 수 있는 스텁 한 벌.
 *
 * **「부르지 않는다」를 증명하려면 부를 수 있어야 한다.** 스텁을 빼면 하네스가 던져 실패하는데,
 * 그것은 「부르지 않았다」가 아니라 「시험이 준비되지 않았다」를 말한다.
 */
const allRoutes = (overrides: StubRoute[] = []): StubRoute[] => [
  ...overrides,
  route(UNCOVERED_PATH, uncoveredItemFixtures),
  detailRoute,
  probeRoute,
  route(RULES_PATH, ruleFixtures),
  balancesRoute,
  route(WAREHOUSES_PATH, warehouseFixtures),
  locationsRoute,
  route(ITEMS_PATH, itemFixtures),
  route(UOMS_PATH, uomFixtures),
];

/**
 * 나간 요청을 전부 기록한다. 횟수와 질의값을 셀 자리가 있어야 「부르지 않았다」가 증명된다.
 *
 * `hold`가 참을 내는 요청은 **기록한 뒤에 영원히 붙잡아 둔다** — 「응답이 오기 전에 화면이
 * 무엇을 말하는가」를 재려면 그 상태에 머무를 수 있어야 하고, 요청이 실제로 나갔다는 사실은
 * 기록으로 증명돼야 한다(「아직 안 보냈다」와 「보냈는데 안 왔다」는 다른 상태다).
 */
const recordingFetch = (
  routes: StubRoute[],
  hold: (request: Request) => boolean = () => false,
): { fetch: StubFetch; urls: URL[]; requests: Request[]; release: () => void } => {
  const urls: URL[] = [];
  /** 헤더와 본문까지 재려면 요청 자체가 필요하다. **본문을 읽기 전에 복사한다** — 한 번만 읽힌다. */
  const requests: Request[] = [];
  /**
   * 붙잡아 둔 요청을 푸는 손잡이.
   *
   * **미도착 상태만으로는 「나가는 중인 요청을 끊지 않는다」를 잴 수 없다** — 끊었는지는
   * *결과가 도착했을 때* 드러난다. 그래서 붙잡았다가 **원하는 시점에 풀 수 있어야** 한다.
   */
  const holders: (() => void)[] = [];
  const stub = createStubFetch(routes);

  return {
    urls,
    requests,
    release: () => {
      for (const resolve of holders.splice(0)) resolve();
    },
    fetch: async (request) => {
      urls.push(new URL(request.url));
      requests.push(request.clone());

      if (hold(request)) {
        await new Promise<void>((resolve) => {
          holders.push(resolve);
        });
      }

      return stub(request);
    },
  };
};

const countOf = (urls: URL[], pathname: string): number =>
  urls.filter((url) => url.pathname === pathname).length;

const lastOf = (urls: URL[], pathname: string): URL | undefined =>
  urls.filter((url) => url.pathname === pathname).at(-1);

/**
 * 목록 조회와 **조준 조회**는 같은 경로를 쓴다 — 조준 조회만 `size`를 명시해 실으므로 그것으로
 * 가른다. 가르지 않으면 「목록을 다시 부르지 않았다」가 조준 조회 한 번에 헛깨진다.
 */
const isProbe = (url: URL): boolean => url.pathname === RULES_PATH && url.searchParams.has('size');

const listCountOf = (urls: URL[]): number =>
  urls.filter((url) => url.pathname === RULES_PATH && !isProbe(url)).length;

const probeUrls = (urls: URL[]): URL[] => urls.filter(isProbe);

const writesOf = (requests: Request[], method: 'POST' | 'PUT'): Request[] =>
  requests.filter((request) => request.method === method);

/** 주소를 읽어 내는 탐침. 조건·쪽·선택이 주소에 실렸는지 잰다. */
const LocationProbe = () => {
  const location = useLocation();

  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

const currentLocation = (): string => screen.getByTestId('location').textContent ?? '';

/**
 * **화면 바깥에서** 주소를 갈아 끼운다. 뒤로가기·앞으로가기·주소 직접 편집이 이 경로다 —
 * 셋 모두 화면의 클릭 핸들러를 거치지 않고 검색 파라미터만 바뀐다.
 */
const SearchProbe = ({ to }: { to: string }) => {
  const [, setSearchParams] = useSearchParams();

  return (
    <button
      type="button"
      onClick={() => {
        setSearchParams(new URLSearchParams(to));
      }}
    >
      주소 이동
    </button>
  );
};

/**
 * 한 칸 뒤로 간다. **히스토리가 몇 칸 늘었는지를 판정하는 유일한 수단**이다 —
 * 기억 라우터는 브라우저 히스토리를 쓰지 않아 `window.history.back()`이 닿지 않는다.
 */
const BackProbe = () => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => {
        void navigate(-1);
      }}
    >
      뒤로
    </button>
  );
};

const renderScreen = (
  route = '/',
  routes: StubRoute[] = allRoutes(),
  hold?: (request: Request) => boolean,
  navigateTo = '',
) => {
  const { fetch, urls, requests, release } = recordingFetch(routes, hold);
  const result = renderWithProviders(
    <>
      <PutawayRuleScreen />
      <LocationProbe />
      <SearchProbe to={navigateTo} />
      <BackProbe />
    </>,
    { fetch, route },
  );

  return { ...result, urls, requests, release, user: userEvent.setup() };
};

const selectWarehouse = async (
  user: ReturnType<typeof userEvent.setup>,
  optionLabel = WAREHOUSE_LABEL,
): Promise<void> => {
  await user.click(screen.getByRole('combobox', { name: t.fields.warehouse }));
  await user.click(await screen.findByRole('option', { name: optionLabel }));
};

/** 목록이 실제로 섰음을 잡는 시점. 음성 단언은 이 시점 뒤에 잰다. */
const waitForRows = async (): Promise<void> => {
  await screen.findByRole('button', { name: t.actions.selectRow(ITEM_LABEL, LOCATION_LABEL) });
};

describe('PutawayRuleScreen — 창고를 고르기 전', () => {
  /**
   * **C1-1.** 창고 없이 목록을 부르면 전 창고의 규칙이 섞여 오고, 그 목록은 어느 창고의
   * 사실도 아니다. 「부르지 않는다」를 **경로 전체에서** 센다 — 조건을 만지고 쪽을 옮기고
   * 다시 조회를 눌러도 그 셋은 한 번도 나가지 않아야 한다.
   *
   * **잔액도 같은 잠금을 받는다.** 계약이 「창고·품목·LOT 중 적어도 하나」를 요구하므로
   * 창고 없는 요청은 성립하지도 않는다 — 세는 자리를 함께 두어 다음 회차가 빠뜨리지 못하게 한다.
   */
  it('목록도 규칙 없는 품목도 잔액도 한 번도 부르지 않는다', async () => {
    const { urls, user } = renderScreen();

    await screen.findByText(t.empty.noWarehouseTitle);

    await user.click(screen.getByRole('checkbox', { name: t.filters.activeOnly }));
    await user.click(screen.getByRole('button', { name: messages.common.reset }));
    await user.click(screen.getByRole('button', { name: t.actions.reload }));

    await waitFor(() => {
      expect(countOf(urls, WAREHOUSES_PATH)).toBeGreaterThan(0);
    });

    expect(countOf(urls, RULES_PATH)).toBe(0);
    expect(countOf(urls, UNCOVERED_PATH)).toBe(0);
    expect(countOf(urls, BALANCES_PATH)).toBe(0);
  });

  /** 위치·품목·단위도 창고를 전제로 선다 — 창고 없이 부르면 헛도는 요청이다. */
  it('위치·품목·단위 이름 풀이도 부르지 않는다', async () => {
    const { urls } = renderScreen();

    await screen.findByText(t.empty.noWarehouseTitle);
    await waitFor(() => {
      expect(countOf(urls, WAREHOUSES_PATH)).toBe(1);
    });

    expect(countOf(urls, LOCATIONS_PATH)).toBe(0);
    expect(countOf(urls, ITEMS_PATH)).toBe(0);
    expect(countOf(urls, UOMS_PATH)).toBe(0);
  });

  /** 빈 표를 보이면 「규칙이 없다」로 읽힌다 — 안내와 빈 결과는 다른 사실이다. */
  it('빈 표가 아니라 창고를 고르라는 안내가 선다', async () => {
    renderScreen();

    expect(await screen.findByText(t.empty.noWarehouseTitle)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
  });

  /** 셀 범위가 없으면 0건도 사실이 아니다 — 구획째 두지 않는다. */
  it('규칙 없는 품목 구획을 두지 않는다', async () => {
    renderScreen();

    await screen.findByText(t.empty.noWarehouseTitle);

    expect(screen.queryByRole('region', { name: t.panes.uncovered })).not.toBeInTheDocument();
  });

  it('창고 선택지는 첫 진입에 받는다', async () => {
    const { user } = renderScreen();

    await user.click(await screen.findByRole('combobox', { name: t.fields.warehouse }));

    expect(await screen.findByRole('option', { name: WAREHOUSE_LABEL })).toBeInTheDocument();
  });

  /** 미사용 창고를 빼면 그 창고에 남은 규칙을 찾을 길이 사라진다 — 표식만 붙인다. */
  it('미사용 창고가 표식과 함께 선택지에 남는다', async () => {
    const { user } = renderScreen();

    await user.click(await screen.findByRole('combobox', { name: t.fields.warehouse }));

    expect(
      await screen.findByRole('option', {
        name: `SYN-WH-02 · 합성창고 나${t.values.inactiveSuffix}`,
      }),
    ).toBeInTheDocument();
  });
});

describe('PutawayRuleScreen — 창고를 고른 뒤', () => {
  it('창고를 고르면 주소에 실리고 목록이 선다', async () => {
    const { urls, user } = renderScreen();

    await screen.findByText(t.empty.noWarehouseTitle);
    await selectWarehouse(user);

    await waitForRows();
    expect(currentLocation()).toContain('wh=9201');
    expect(lastOf(urls, RULES_PATH)?.searchParams.get('warehouseId')).toBe('9201');
  });

  it('규칙 없는 품목 건수가 목록과 함께 선다', async () => {
    renderScreen(WITH_WAREHOUSE);

    expect(await screen.findByText(t.uncovered.countTitle(2))).toBeInTheDocument();
  });

  /**
   * **C1-4.** 기본은 「사용 중만 꺼짐」이고 그때 `includeInactive=true`가 실린다 —
   * 꺼진 규칙이 목록에 보이고 다시 켜는 것이 이 마스터의 정상 운용이다(이슈 §6).
   */
  it('기본 조회에 includeInactive=true가 실리고 사용 안 함 행에 표식이 붙는다', async () => {
    const { urls } = renderScreen(WITH_WAREHOUSE);

    await waitForRows();

    expect(lastOf(urls, RULES_PATH)?.searchParams.get('includeInactive')).toBe('true');
    expect(screen.getByText(t.values.inactive)).toBeInTheDocument();
  });

  it('사용 중만을 켜면 includeInactive=false로 다시 부른다', async () => {
    const { urls, user } = renderScreen(WITH_WAREHOUSE);

    await waitForRows();
    await user.click(screen.getByRole('checkbox', { name: t.filters.activeOnly }));

    await waitFor(() => {
      expect(lastOf(urls, RULES_PATH)?.searchParams.get('includeInactive')).toBe('false');
    });
    expect(currentLocation()).toContain('active=1');
  });

  /**
   * **C1-5.** 선택 목록만 좁히고 이름 풀이는 좁히지 않는다(사본 체크리스트 10번).
   * 좁힘 밖의 정상 자료가 「알 수 없음」으로 보이는 것을 막는 자리다.
   */
  it('이름 풀이 조회에 목록 조건이 실리지 않는다', async () => {
    const { urls, user } = renderScreen(WITH_WAREHOUSE);

    await waitForRows();
    await user.click(screen.getByRole('checkbox', { name: t.filters.activeOnly }));

    await waitFor(() => {
      expect(lastOf(urls, RULES_PATH)?.searchParams.get('includeInactive')).toBe('false');
    });

    for (const pathname of [ITEMS_PATH, UOMS_PATH]) {
      const query = lastOf(urls, pathname)?.searchParams;

      expect(query?.get('includeInactive')).toBe('true');
      expect(query?.has('itemId')).toBe(false);
      expect(query?.has('q')).toBe(false);
    }

    /* 위치만 창고로 갈라 받는다 — 좁힘이 아니라 계약이 창고를 필수로 요구해서다. */
    const locationQuery = lastOf(urls, LOCATIONS_PATH)?.searchParams;

    expect(locationQuery?.get('warehouseId')).toBe('9201');
    expect(locationQuery?.has('itemId')).toBe(false);
  });

  /** 규칙 없는 품목 수는 창고 전체의 사실이다 — 목록 조건으로 좁히면 근거로 쓸 수 없다. */
  it('규칙 없는 품목 조회에 목록 조건이 실리지 않는다', async () => {
    const { urls, user } = renderScreen(WITH_WAREHOUSE);

    await waitForRows();
    await user.click(screen.getByRole('checkbox', { name: t.filters.activeOnly }));

    await waitFor(() => {
      expect(lastOf(urls, RULES_PATH)?.searchParams.get('includeInactive')).toBe('false');
    });

    const query = lastOf(urls, UNCOVERED_PATH)?.searchParams;

    expect(query?.get('warehouseId')).toBe('9201');
    expect(query?.has('includeInactive')).toBe(false);
    expect(query?.has('itemId')).toBe(false);
  });

  /**
   * **C1-6.** 이름을 못 푼 값을 「알 수 없음」으로 내되 **내부 번호를 대신 내지 않는다**
   * (`omf-mes#44`). 내부 번호가 화면에 서면 그것이 식별자로 읽힌다.
   */
  it('이름을 못 푼 값에 내부 번호가 서지 않는다', async () => {
    renderScreen(WITH_WAREHOUSE);

    await waitForRows();

    const table = screen.getAllByRole('table')[0];

    expect(within(table as HTMLElement).getAllByText(t.values.unknown).length).toBeGreaterThan(0);
    expect(table?.textContent).not.toContain('9199');
    expect(table?.textContent).not.toContain('9499');
  });

  it('풀린 이름이 행에 그대로 선다', async () => {
    renderScreen(WITH_WAREHOUSE);

    await waitForRows();

    expect(screen.getByText(LOCATION_LABEL)).toBeInTheDocument();
    expect(screen.getByText(t.values.capacity('500', UOM_LABEL))).toBeInTheDocument();
  });

  /** 위치를 비운 규칙은 「창고 전체」다 — 값이 빠진 것이 아니라 확정된 뜻이다. */
  it('위치를 비운 규칙이 창고 전체로 선다', async () => {
    renderScreen(WITH_WAREHOUSE);

    await waitForRows();

    expect(screen.getByText(t.values.warehouseWide)).toBeInTheDocument();
  });
});

/**
 * **일부만 실패한 갈래의 배선** — 목록은 200인데 이름 풀이 하나가 500이다.
 *
 * 갈래는 `lookups.ts`가 갖고 표는 pane이 그리지만, **둘을 잇는 것은 화면이다.** 화면이
 * 실패를 삼키면(`isError`를 넘기지 않으면) 실패한 칸이 「알 수 없음」으로 보이는데, 그 문구는
 * *값이 잘못됐다*는 뜻이라 사용자가 반대로 읽는다 — 정상 값에 잘못된 값이라는 표를 붙이는 셈이다.
 *
 * 이 자리는 단위 시험(갈래)·부품 시험(표) 어느 쪽도 지나지 않는다. 화면에서 실제 실패 응답으로 잰다.
 */
describe('PutawayRuleScreen — 이름 풀이만 실패한 갈래', () => {
  /**
   * 규칙 표가 실제로 섰음을 잡는 시점. **행이 서기 전에 「없다」를 재면 아직 아무것도 없는
   * 화면에서 항상 통과하는 무의미한 단언이 된다**(사본 체크리스트 9번).
   */
  const waitForRuleTable = async (): Promise<HTMLElement> => {
    const rows = await screen.findAllByRole('button', { name: /선택$/ });

    expect(rows.length).toBeGreaterThan(0);

    return screen.getAllByRole('table')[0] as HTMLElement;
  };

  /**
   * 품목 칸만 따로 읽는다 — 다른 열의 문면과 섞이면 「품목 칸이 실패 문면이다」가 헛통과한다.
   *
   * **열을 지목해 읽는다.** 표 안의 버튼을 전부 모으는 형태로 두면 다음 회차가 행에 버튼을
   * 하나라도 더하는 순간 말없이 섞인다 — 지금은 그런 버튼이 없지만, 없다는 사실에 기대는
   * 시험은 그것이 생기는 회차에 조용히 뜻을 잃는다(단위 ① 인계).
   */
  const ITEM_COLUMN_INDEX = 1;

  const itemCellTexts = (table: HTMLElement): string[] =>
    within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getAllByRole('cell')[ITEM_COLUMN_INDEX]?.textContent ?? '');

  it('품목 이름 풀이가 실패하면 품목 칸이 실패 문면이 되고 「알 수 없음」으로 보이지 않는다', async () => {
    renderScreen(WITH_WAREHOUSE, allRoutes([failing(ITEMS_PATH)]));

    const table = await waitForRuleTable();

    /* 목록은 200으로 섰다 — 위치·용량은 정상으로 풀린다. 실패한 것은 품목 하나뿐이다. */
    expect(within(table).getByText(LOCATION_LABEL)).toBeInTheDocument();
    expect(within(table).getByText(t.values.capacity('500', UOM_LABEL))).toBeInTheDocument();

    /* 품목 칸 전부가 실패 문면이고, 어느 칸도 「알 수 없음」으로 뭉개지지 않았다. */
    expect(new Set(itemCellTexts(table))).toEqual(new Set([t.values.referenceFailed]));
    expect(itemCellTexts(table)).not.toContain(t.values.unknown);

    /* 실패에도 내부 번호를 대신 내지 않는다(`omf-mes#44`). */
    expect(table.textContent).not.toContain('9101');
  });

  it('위치 이름 풀이가 실패하면 위치 칸이 실패 문면이 되고 창고 전체는 흔들리지 않는다', async () => {
    renderScreen(WITH_WAREHOUSE, allRoutes([failing(LOCATIONS_PATH)]));

    const table = await waitForRuleTable();

    /* 품목은 정상으로 풀린다 — 실패는 위치 축에만 있다. */
    expect(itemCellTexts(table)).toContain(ITEM_LABEL);
    expect(within(table).getAllByText(t.values.referenceFailed).length).toBeGreaterThan(0);

    /*
     * 「창고 전체」는 이름 목록을 필요로 하지 않는 **확정된 뜻**이다 —
     * 참조 조회가 실패해도 흔들리면 안 된다(다섯째 갈래가 네 갈래보다 앞선다).
     */
    expect(within(table).getByText(t.values.warehouseWide)).toBeInTheDocument();
    expect(table.textContent).not.toContain('9301');
  });

  it('단위 이름 풀이가 실패하면 용량이 실패 문면과 함께 서고 수량은 남는다', async () => {
    renderScreen(WITH_WAREHOUSE, allRoutes([failing(UOMS_PATH)]));

    const table = await waitForRuleTable();

    /* 수량은 서버가 준 사실이라 지우지 않는다 — 못 푼 것은 단위 이름뿐이다. */
    expect(
      within(table).getByText(t.values.capacity('500', t.values.referenceFailed)),
    ).toBeInTheDocument();
    expect(table.textContent).not.toContain('9401');
  });
});

/**
 * **이름 목록이 잘린 갈래.** 위치·단위는 고르는 칸이 없어 그 잘림을 말할 자리가 표뿐이다 —
 * 밝히지 않으면 잘린 목록으로 이름을 푼 **정상 규칙**이 「알 수 없음」으로 보이고, 그 문구는
 * *값이 잘못됐다*는 뜻이라 사용자가 정확히 반대로 읽는다.
 */
describe('PutawayRuleScreen — 이름 목록이 잘린 갈래', () => {
  it('전부 다 왔으면 잘림 안내가 서지 않는다', async () => {
    renderScreen(WITH_WAREHOUSE);

    await waitForRows();

    expect(screen.queryByText(t.notes.nameLookupTruncated)).not.toBeInTheDocument();
  });

  it('위치 목록이 잘리면 표 아래에 그 사실이 선다', async () => {
    renderScreen(
      WITH_WAREHOUSE,
      allRoutes([route(LOCATIONS_PATH, locationFixtures, { total: 9999 })]),
    );

    await waitForRows();

    expect(await screen.findByText(t.notes.nameLookupTruncated)).toBeInTheDocument();
  });

  /** 단위 축도 따로 잰다 — 한 축만 이어 두면 다른 축의 잘림이 조용히 사라진다. */
  it('단위 목록이 잘리면 표 아래에 그 사실이 선다', async () => {
    renderScreen(WITH_WAREHOUSE, allRoutes([route(UOMS_PATH, uomFixtures, { total: 9999 })]));

    await waitForRows();

    expect(await screen.findByText(t.notes.nameLookupTruncated)).toBeInTheDocument();
  });

  /**
   * 창고·품목은 **자기 선택칸**이 잘림을 말한다 — 표 아래 안내가 그 몫까지 가져가면 같은
   * 사실이 두 자리에 서고, 어느 축이 잘렸는지가 흐려진다.
   */
  it('품목 목록이 잘리면 선택칸이 말하고 표 아래 안내는 서지 않는다', async () => {
    renderScreen(WITH_WAREHOUSE, allRoutes([route(ITEMS_PATH, itemFixtures, { total: 9999 })]));

    await waitForRows();

    expect(await screen.findByText(t.filters.lookupTruncated)).toBeInTheDocument();
    expect(screen.queryByText(t.notes.nameLookupTruncated)).not.toBeInTheDocument();
  });
});

/**
 * **선택칸 자리표시 — 0건의 이유를 가른다.**
 *
 * ⛔ 「고를 것이 없습니다」는 조회가 실제로 0건을 돌려줬을 때에만 참이다. **미도착·실패·조회가
 * 열리지도 않은 상태**가 전부 빈 배열이라, 배열 길이만 보면 화면이 확인하지 못한 것을 사실로
 * 말하게 된다. 실패 갈래에서는 바로 아래 안내와 **한 칸 안에서 정면으로 어긋난다.**
 *
 * 세 상태는 **응답 상태로만** 갈린다 — 부품에 `options: []`를 직접 넘기는 시험은 이유를 담을
 * 자리가 원리적으로 없어 이 셋을 가르지 못한다. 그래서 화면 층에서 잰다.
 */
describe('PutawayRuleScreen — 선택칸 자리표시', () => {
  const warehouseTrigger = (): HTMLElement =>
    screen.getByRole('combobox', { name: t.fields.warehouse });
  const itemTrigger = (): HTMLElement => screen.getByRole('combobox', { name: t.fields.item });

  it('창고 조회가 0건을 돌려주면 「고를 창고가 없습니다」라고 말한다', async () => {
    renderScreen('/', allRoutes([route(WAREHOUSES_PATH, [])]));

    await waitFor(() => {
      expect(warehouseTrigger()).toHaveTextContent(t.filters.noWarehouseOptions);
    });
  });

  /**
   * **화면의 첫 그림마다 지나는 자리다.** 응답이 오기 전에 「없다」고 하면 그 순간이 곧 거짓이다.
   * 양성 기준은 「요청이 실제로 나갔다」 — 「아직 안 보냈다」와 「보냈는데 안 왔다」는 다른 상태다.
   */
  it('창고 조회가 아직 오지 않았으면 「없다」고 말하지 않는다', async () => {
    const { urls } = renderScreen('/', allRoutes(), (request) =>
      request.url.includes(WAREHOUSES_PATH),
    );

    await waitFor(() => {
      expect(countOf(urls, WAREHOUSES_PATH)).toBe(1);
    });

    expect(warehouseTrigger()).not.toHaveTextContent(t.filters.noWarehouseOptions);
  });

  /**
   * 실패에서 「없다」고 말하면 **한 칸 안에서 두 문장이 어긋난다** — 트리거는 「없다」,
   * 아래 안내는 「못 불러왔다」. 사용자는 컨트롤 안의 글자를 먼저 읽고 마스터가 비었다고 읽는다.
   */
  it('창고 조회가 실패하면 「없다」고 말하지 않고 안내만 선다', async () => {
    renderScreen('/', allRoutes([failing(WAREHOUSES_PATH)]));

    /* 양성 기준 — 실패 안내가 실제로 섰다. 음성 단언은 그 뒤에 잰다. */
    expect(await screen.findByText(t.filters.lookupFailed)).toBeInTheDocument();
    expect(warehouseTrigger()).not.toHaveTextContent(t.filters.noWarehouseOptions);
  });

  /**
   * 품목은 **창고 전에 조회가 열리지도 않는다.** 열리지 않은 조회는 0건을 확인한 적이 없으므로
   * 「없다」고 단정할 근거가 없다 — 잠긴 사유는 안내가 따로 말한다.
   */
  it('품목 조회가 열리지도 않았으면 「없다」고 말하지 않는다', async () => {
    const { urls } = renderScreen();

    await screen.findByText(t.empty.noWarehouseTitle);

    expect(countOf(urls, ITEMS_PATH)).toBe(0);
    expect(itemTrigger()).not.toHaveTextContent(t.filters.noItemOptions);
    expect(screen.getByText(t.filters.itemNeedsWarehouse)).toBeInTheDocument();
  });

  it('품목 조회가 0건을 돌려주면 「고를 품목이 없습니다」라고 말한다', async () => {
    renderScreen(WITH_WAREHOUSE, allRoutes([route(ITEMS_PATH, [])]));

    await waitFor(() => {
      expect(itemTrigger()).toHaveTextContent(t.filters.noItemOptions);
    });
  });

  /** 목록이 왔으면 「전체」가 서고 자리표시는 뜨지 않는다 — 짝이 되는 양성 갈래다. */
  it('목록이 오면 「전체」가 서고 자리표시가 뜨지 않는다', async () => {
    renderScreen();

    await waitFor(() => {
      expect(warehouseTrigger()).toHaveTextContent(t.filters.all);
    });
    expect(warehouseTrigger()).not.toHaveTextContent(t.filters.noWarehouseOptions);
  });
});

describe('PutawayRuleScreen — 조건과 쪽', () => {
  it('품목 조건이 조회와 주소에 함께 실린다', async () => {
    const { urls, user } = renderScreen(WITH_WAREHOUSE);

    await waitForRows();
    await user.click(screen.getByRole('combobox', { name: t.fields.item }));
    await user.click(await screen.findByRole('option', { name: ITEM_LABEL }));

    await waitFor(() => {
      expect(lastOf(urls, RULES_PATH)?.searchParams.get('itemId')).toBe('9101');
    });
    expect(currentLocation()).toContain('item=9101');
  });

  /** 창고를 바꾸면 앞 창고에서 고른 품목은 이 창고의 조건이 아니다. */
  it('창고를 바꾸면 품목 조건이 함께 풀린다', async () => {
    const { user } = renderScreen('/?wh=9201&item=9101');

    await waitForRows();
    await selectWarehouse(user, `SYN-WH-02 · 합성창고 나${t.values.inactiveSuffix}`);

    await waitFor(() => {
      expect(currentLocation()).toContain('wh=9202');
    });
    expect(currentLocation()).not.toContain('item=');
  });

  it('조건 칩의 ×가 그 조건만 푼다', async () => {
    const { user } = renderScreen('/?wh=9201&item=9101');

    await waitForRows();
    await user.click(screen.getByRole('button', { name: t.filters.chipRemoveItem }));

    await waitFor(() => {
      expect(currentLocation()).not.toContain('item=');
    });
    expect(currentLocation()).toContain('wh=9201');
  });

  it('초기화가 조건을 전부 되돌린다', async () => {
    const { user } = renderScreen('/?wh=9201&item=9101&active=1');

    await waitForRows();
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(currentLocation()).not.toContain('wh=');
    });
    expect(await screen.findByText(t.empty.noWarehouseTitle)).toBeInTheDocument();
  });

  it('쪽을 옮기면 주소와 조회에 그 쪽이 실린다', async () => {
    const { urls, user } = renderScreen(WITH_WAREHOUSE, [
      route(UNCOVERED_PATH, uncoveredItemFixtures),
      route(RULES_PATH, ruleFixtures, { total: 45 }),
      balancesRoute,
      route(WAREHOUSES_PATH, warehouseFixtures),
      route(LOCATIONS_PATH, locationFixtures),
      route(ITEMS_PATH, itemFixtures),
      route(UOMS_PATH, uomFixtures),
    ]);

    await waitForRows();
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(lastOf(urls, RULES_PATH)?.searchParams.get('page')).toBe('2');
    });
    expect(currentLocation()).toContain('page=2');
  });

  /** 보이는 행이 달라지므로 고른 규칙이 목록에 없을 수 있다 — 선택을 함께 비운다. */
  it('쪽을 옮기면 고른 규칙이 풀린다', async () => {
    const { user } = renderScreen('/?wh=9201&rule=9001', [
      route(UNCOVERED_PATH, uncoveredItemFixtures),
      route(RULES_PATH, ruleFixtures, { total: 45 }),
      balancesRoute,
      route(WAREHOUSES_PATH, warehouseFixtures),
      route(LOCATIONS_PATH, locationFixtures),
      route(ITEMS_PATH, itemFixtures),
      route(UOMS_PATH, uomFixtures),
    ]);

    await waitForRows();
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(currentLocation()).toContain('page=2');
    });
    expect(currentLocation()).not.toContain('rule=');
  });

  it('조건을 바꾸면 첫 쪽으로 돌아간다', async () => {
    const { user } = renderScreen('/?wh=9201&page=3');

    await waitForRows();
    await user.click(screen.getByRole('checkbox', { name: t.filters.activeOnly }));

    await waitFor(() => {
      expect(currentLocation()).toContain('active=1');
    });
    expect(currentLocation()).not.toContain('page=');
  });
});

describe('PutawayRuleScreen — 규칙 고르기', () => {
  it('행을 고르면 주소에 실리고 조건·쪽이 그대로 남는다', async () => {
    const { user } = renderScreen('/?wh=9201&item=9101');

    await waitForRows();
    await user.click(
      screen.getByRole('button', { name: t.actions.selectRow(ITEM_LABEL, LOCATION_LABEL) }),
    );

    await waitFor(() => {
      expect(currentLocation()).toContain('rule=9001');
    });
    expect(currentLocation()).toContain('wh=9201');
    expect(currentLocation()).toContain('item=9101');
  });

  it('주소로 들어와도 그 행이 고름 표시를 받는다', async () => {
    renderScreen('/?wh=9201&rule=9001');

    await waitForRows();

    expect(
      screen.getByRole('button', { name: t.actions.selectRow(ITEM_LABEL, LOCATION_LABEL) }),
    ).toHaveAttribute('aria-current', 'true');
  });

  /** 규칙을 고르는 것은 보이는 행을 바꾸지 않는다 — 다시 부를 이유가 없다. */
  it('행을 골라도 목록을 다시 부르지 않는다', async () => {
    const { urls, user } = renderScreen(WITH_WAREHOUSE);

    await waitForRows();
    const before = listCountOf(urls);

    await user.click(
      screen.getByRole('button', { name: t.actions.selectRow(ITEM_LABEL, LOCATION_LABEL) }),
    );
    await waitFor(() => {
      expect(currentLocation()).toContain('rule=9001');
    });

    /*
     * **목록만 센다.** 규칙을 고르면 폼이 서고 그 자리에서 조준 조회가 나가는데, 그것은 같은
     * 경로를 쓰되 목록이 아니다 — 함께 세면 이 감지기가 조준 조회 한 번에 헛깨진다.
     */
    expect(listCountOf(urls)).toBe(before);
  });
});

/**
 * **현재 적재 배선** — 규칙 표와 재고 잔액은 계약이 다르다(기준정보 대 자재창고).
 * 둘을 잇는 것은 화면이며, 그 이음매가 어긋나면 **규칙이 남의 자리 잔액을 자기 사용률로 읽는다.**
 */
describe('PutawayRuleScreen — 현재 적재와 사용률', () => {
  const balanceQueries = (urls: URL[]): URLSearchParams[] =>
    urls.filter((url) => url.pathname === BALANCES_PATH).map((url) => url.searchParams);

  /** 같은 (품목·위치)의 규칙이 둘이어도 한 번만 묻는다 — 합성 자료 넷은 축이 모두 다르다. */
  it('보이는 규칙의 (품목·위치)마다 한 번씩 부른다', async () => {
    const { urls } = renderScreen(WITH_WAREHOUSE);

    await waitForRows();
    await waitFor(() => {
      expect(countOf(urls, BALANCES_PATH)).toBe(4);
    });
  });

  /**
   * **C2-1.** 위치가 있는 규칙은 그 위치로 좁혀 묻고, **위치를 비운 창고 전체 규칙은 위치를
   * 싣지 않는다** — 실으면 한 자리의 잔액만 보고 사용률이 실제보다 작아진다.
   */
  it('창고 수준 규칙만 위치 없이 부른다', async () => {
    const { urls } = renderScreen(WITH_WAREHOUSE);

    await waitForRows();
    await waitFor(() => {
      expect(countOf(urls, BALANCES_PATH)).toBe(4);
    });

    const withoutLocation = balanceQueries(urls).filter((query) => !query.has('locationId'));

    expect(withoutLocation).toHaveLength(1);
    expect(withoutLocation[0]?.get('itemId')).toBe('9102');
    expect(balanceQueries(urls).every((query) => query.get('warehouseId') === '9201')).toBe(true);
  });

  /** **C2-2.** 단위가 같고 소유가 하나인 규칙에만 비율이 선다. */
  it('사용률이 막대와 수치로 함께 선다', async () => {
    renderScreen(WITH_WAREHOUSE);

    expect(
      await screen.findByText(t.values.usageSummary('320', UOM_LABEL, '64')),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('progressbar', { name: t.values.usageBarLabel }).length,
    ).toBeGreaterThan(0);
  });

  /** 창고 전체 규칙은 그 창고의 그 품목 **전 위치**를 더한다 — 300 + 300 = 600 / 1200. */
  it('창고 수준 규칙은 여러 위치의 잔액을 더해 낸다', async () => {
    renderScreen(WITH_WAREHOUSE);

    expect(
      await screen.findByText(t.values.usageSummary('600', OTHER_UOM_LABEL, '50')),
    ).toBeInTheDocument();
  });

  /**
   * **C2-5.** 막대는 잘리고 수치는 잘리지 않는다 — 두 자리를 따로 잰다.
   * 규칙 9003은 용량 80에 적재 100이라 125%다.
   */
  it('100%를 넘는 행에서 막대는 잘리고 수치는 실제 비율을 낸다', async () => {
    renderScreen(WITH_WAREHOUSE);

    const over = await screen.findByText(t.values.usageSummary('100', UOM_LABEL, '125'));
    const bars = screen.getAllByRole('progressbar', { name: t.values.usageBarLabel });

    expect(over).toBeInTheDocument();
    expect(bars.some((bar) => bar.getAttribute('aria-valuetext') === '125%')).toBe(true);
    expect(bars.every((bar) => Number(bar.getAttribute('aria-valuenow')) <= 100)).toBe(true);
  });

  /** **C2-6.** 그 조건의 잔액 줄이 없는 행은 대시로 선다 — 「0이다」와 다른 사실이다. */
  it('잔액 줄이 없는 행은 대시로 선다', async () => {
    renderScreen(WITH_WAREHOUSE);

    await waitForRows();

    expect(await screen.findByText(t.values.onHandNone)).toBeInTheDocument();
  });

  /**
   * **C2-4.** 소유 구분은 어떤 축에서도 합치지 않는다(공유계약 L-7) —
   * 자사 재고와 고객 지급품을 더한 비율은 오독이다.
   */
  it('소유가 섞인 규칙은 비율 없이 소유별로 선다', async () => {
    const splitOwnership: StubRoute = {
      match: (request) => isGet(request, BALANCES_PATH),
      respond: () =>
        jsonResponse(
          listBody([
            balanceRow({ ownershipTypeCode: OWNERSHIP_A, onHandQty: 300 }),
            balanceRow({ ownershipTypeCode: OWNERSHIP_B, onHandQty: 120 }),
          ]),
        ),
    };

    renderScreen(WITH_WAREHOUSE, allRoutes([splitOwnership]));

    expect(await screen.findAllByText(t.notes.usageOwnershipSplit)).not.toHaveLength(0);
    expect(
      screen.getAllByText(t.values.ownershipQty(OWNERSHIP_B, '120', UOM_LABEL)).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole('progressbar', { name: t.values.usageBarLabel }),
    ).not.toBeInTheDocument();
  });

  /** **C2-3.** 단위가 다르면 환산하지 않는다 — 두 값을 단위와 함께 그대로 둔다. */
  it('단위가 다른 규칙은 비율 없이 수량과 사유가 선다', async () => {
    const otherUom: StubRoute = {
      match: (request) => isGet(request, BALANCES_PATH),
      respond: () => jsonResponse(listBody([balanceRow({ uomId: 9402, onHandQty: 300 })])),
    };

    renderScreen(WITH_WAREHOUSE, allRoutes([otherUom]));

    expect(await screen.findAllByText(t.notes.usageUnitMismatch)).not.toHaveLength(0);
    expect(screen.getAllByText(t.values.onHandQty('300', OTHER_UOM_LABEL)).length).toBeGreaterThan(
      0,
    );
  });

  /**
   * 계약이 명시로 허용한 음수 적재(음수 허용 품목). 비율을 내면 막대가 0으로 잘려 **가장 비어
   * 있는 위치와 같은 모양**이 되는데, 장부가 어긋난 상태와 여유로운 위치는 정반대의 조치를
   * 부른다 — 화면 배선까지 그 갈래가 살아 있는지 잰다.
   */
  it('적재가 음수인 규칙은 비율 없이 음수 수량과 사유가 선다', async () => {
    const negative: StubRoute = {
      match: (request) => isGet(request, BALANCES_PATH),
      respond: () => jsonResponse(listBody([balanceRow({ onHandQty: -40 })])),
    };

    renderScreen(WITH_WAREHOUSE, allRoutes([negative]));

    expect(await screen.findAllByText(t.notes.usageNegativeOnHand)).not.toHaveLength(0);
    expect(screen.getAllByText(t.values.onHandQty('-40', UOM_LABEL)).length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('progressbar', { name: t.values.usageBarLabel }),
    ).not.toBeInTheDocument();
  });

  /** 실패를 「없음」으로 뭉개면 화면이 확인한 적 없는 것을 사실로 말하게 된다. */
  it('잔액 조회가 실패해도 목록은 서고 그 칸이 실패로 말한다', async () => {
    renderScreen(WITH_WAREHOUSE, allRoutes([failing(BALANCES_PATH)]));

    await waitForRows();

    expect(await screen.findAllByText(t.values.onHandFailed)).not.toHaveLength(0);
    expect(screen.queryByText(t.values.onHandNone)).not.toBeInTheDocument();
    expect(screen.getByText(LOCATION_LABEL)).toBeInTheDocument();
  });

  /** 한쪽만 부르면 갱신된 값과 낡은 값이 한 화면에 섞인다 — 적재도 함께 다시 부른다. */
  it('다시 조회가 잔액도 함께 부른다', async () => {
    const { urls, user } = renderScreen(WITH_WAREHOUSE);

    await waitForRows();
    await waitFor(() => {
      expect(countOf(urls, BALANCES_PATH)).toBe(4);
    });

    await user.click(screen.getByRole('button', { name: t.actions.reload }));

    await waitFor(() => {
      expect(countOf(urls, BALANCES_PATH)).toBe(8);
    });
  });
});

/**
 * **C2-7 배선** — 같은 (품목·창고·위치·우선순위) 활성 규칙이 이 쪽에 둘 이상이면 어느 쪽이
 * 이기는지 데이터가 정하지 않는다. 표식이 없으면 그 사실이 화면 어디에도 드러나지 않는다.
 */
describe('PutawayRuleScreen — 중복 표식', () => {
  const twinRules = [
    ruleFixtureAt(9001),
    { ...ruleFixtureAt(9001), putawayRuleId: 9005 },
    ruleFixtureAt(9002),
  ];

  /**
   * 두 규칙의 품목·위치가 같아 **행 손잡이의 접근 이름까지 같다** — 그것이 바로 중복이 눈에
   * 띄어야 하는 이유다. 그래서 이 시험은 한 행을 집는 `waitForRows`를 쓰지 않는다.
   */
  it('같은 조합의 활성 규칙 둘에 표식이 붙는다', async () => {
    renderScreen(WITH_WAREHOUSE, allRoutes([route(RULES_PATH, twinRules)]));

    expect(await screen.findAllByText(t.values.duplicate)).toHaveLength(2);
  });

  /** 합성 자료 넷은 조합이 모두 달라 표식이 서지 않는다 — 짝이 되는 음성 갈래다. */
  it('중복이 없으면 표식이 서지 않는다', async () => {
    renderScreen(WITH_WAREHOUSE);

    await waitForRows();

    expect(screen.queryByText(t.values.duplicate)).not.toBeInTheDocument();
  });
});

describe('PutawayRuleScreen — 실패와 다시 조회', () => {
  /** **C1-2.** 실패를 「등록된 규칙이 없습니다」로 보이면 사실과 다른 안내가 된다. */
  it('목록 실패에 배너가 서고 빈 상태를 함께 보이지 않는다', async () => {
    renderScreen(WITH_WAREHOUSE, allRoutes([failing(RULES_PATH)]));

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
  });

  it('다시 시도가 같은 조회를 한 번 더 부른다', async () => {
    const { urls, user } = renderScreen(WITH_WAREHOUSE, allRoutes([failing(RULES_PATH)]));

    await screen.findByText(messages.httpError.loadTitle);
    const before = countOf(urls, RULES_PATH);

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(countOf(urls, RULES_PATH)).toBe(before + 1);
    });
  });

  /** 권한 없음에는 같은 권한으로 다시 불러도 같은 답이 온다 — 헛돌 길을 주지 않는다. */
  it('403에는 다시 시도를 내지 않는다', async () => {
    renderScreen(WITH_WAREHOUSE, allRoutes([failing(RULES_PATH, 403)]));

    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  /**
   * 규칙 없는 품목 조회가 실패했는데 0건으로 보이면 「좋은 상태」라는 잘못된 안심을 준다.
   * 목록은 성공했으므로 목록은 그대로 서야 한다.
   */
  it('규칙 없는 품목 실패에서 0건으로 보이지 않고 목록은 그대로 선다', async () => {
    renderScreen(WITH_WAREHOUSE, allRoutes([failing(UNCOVERED_PATH)]));

    await waitForRows();

    expect(screen.queryByText(t.uncovered.noneTitle)).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: t.panes.uncovered })).getByText(
        messages.httpError.loadTitle,
      ),
    ).toBeInTheDocument();
  });

  /** 한쪽만 부르면 갱신된 값과 낡은 값이 한 화면에 섞인다. */
  it('다시 조회가 목록과 규칙 없는 품목을 함께 부른다', async () => {
    const { urls, user } = renderScreen(WITH_WAREHOUSE);

    await waitForRows();
    const beforeList = countOf(urls, RULES_PATH);
    const beforeUncovered = countOf(urls, UNCOVERED_PATH);

    await user.click(screen.getByRole('button', { name: t.actions.reload }));

    await waitFor(() => {
      expect(countOf(urls, RULES_PATH)).toBe(beforeList + 1);
    });
    expect(countOf(urls, UNCOVERED_PATH)).toBe(beforeUncovered + 1);
  });

  /** 선택지를 못 받았으면 그 사실을 밝힌다 — 감추면 「그런 창고가 없다」로 결론짓는다. */
  it('창고 선택지 실패를 안내로 밝힌다', async () => {
    renderScreen('/', allRoutes([failing(WAREHOUSES_PATH)]));

    expect(await screen.findByText(t.filters.lookupFailed)).toBeInTheDocument();
  });
});

describe('PutawayRuleScreen — 빈 목록', () => {
  /** **C1-3.** 0건은 조건을 줄이거나 「사용 중만」을 끄면 나올 수 있다. */
  it('0건이면 빈 상태 문구가 서고 행이 없다', async () => {
    renderScreen(WITH_WAREHOUSE, allRoutes([route(RULES_PATH, [])]));

    expect(await screen.findByText(t.empty.noResultTitle)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /선택$/ })).not.toBeInTheDocument();
  });

  /**
   * **C1-7.** 규칙이 0건인데 규칙 없는 품목이 있으면 **그 사실이 이 화면의 핵심 정보다** —
   * 목록이 비었다는 이유로 함께 감추면 「비어 있음」이 어디에도 드러나지 않는다(공유계약 G-12).
   */
  it('규칙이 0건이어도 규칙 없는 품목 건수는 선다', async () => {
    renderScreen(WITH_WAREHOUSE, allRoutes([route(RULES_PATH, [])]));

    await screen.findByText(t.empty.noResultTitle);

    expect(screen.getByText(t.uncovered.countTitle(2))).toBeInTheDocument();
  });

  /** 0건은 좋은 상태다 — 경고 톤을 쓰면 조치할 것이 있다고 읽힌다. */
  it('규칙 없는 품목이 0건이면 경고 톤을 쓰지 않는다', async () => {
    renderScreen(WITH_WAREHOUSE, allRoutes([route(UNCOVERED_PATH, [])]));

    expect(await screen.findByText(t.uncovered.noneTitle)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

/* ── 등록·수정 ───────────────────────────────────────────────────────── */

const formPane = (): HTMLElement => screen.getByRole('region', { name: t.panes.form });

const createButton = (): HTMLElement => screen.getByRole('button', { name: t.actions.create });

const capacityField = (): HTMLElement => within(formPane()).getByLabelText(t.fields.capacity);

const saveButton = (): HTMLElement =>
  within(formPane()).getByRole('button', { name: messages.common.save });

const submitCreateButton = (): HTMLElement =>
  within(formPane()).getByRole('button', { name: t.actions.submitCreate });

const selectRow = async (
  user: ReturnType<typeof userEvent.setup>,
  itemLabel = ITEM_LABEL,
  locationLabel = LOCATION_LABEL,
): Promise<void> => {
  await user.click(
    screen.getByRole('button', { name: t.actions.selectRow(itemLabel, locationLabel) }),
  );
};

/** 고른 규칙의 폼이 실제로 섰음을 잡는 시점. 음성 단언은 이 시점 뒤에 잰다. */
const waitForEditForm = async (): Promise<void> => {
  await screen.findByText(t.notes.itemFixed);
};

const createRoute = (respond?: StubRoute['respond']): StubRoute => ({
  match: (request) => request.method === 'POST' && new URL(request.url).pathname === RULES_PATH,
  respond:
    respond ??
    (() => jsonResponse({ ...ruleFixtureAt(9001), putawayRuleId: 9005 }, { status: 201 })),
});

const updateRoute = (respond?: StubRoute['respond']): StubRoute => ({
  match: (request) => request.method === 'PUT' && isDetailPath(new URL(request.url).pathname),
  respond: respond ?? (() => jsonResponse(ruleFixtureAt(9001))),
});

const bodyOf = async (request: Request): Promise<Record<string, unknown>> =>
  (await request.json()) as Record<string, unknown>;

describe('PutawayRuleScreen — 편집 자리가 서는 순서', () => {
  /** 등록 본문이 창고를 요구한다 — 만들 대상이 정해지기 전에는 폼을 열 자리가 없다. */
  it('창고를 고르기 전에는 규칙 추가가 사유와 함께 잠긴다', async () => {
    renderScreen();

    await screen.findByText(t.empty.noWarehouseTitle);

    expect(createButton()).toBeDisabled();
    /* **C4-D** — 잠긴 자리에는 반드시 사유가 붙는다(배치 규범 4). */
    expect(screen.getByText(t.actionReasons.addNeedsWarehouse)).toBeInTheDocument();
  });

  /** 짝 방향 — 창고를 고르면 사유가 사라지고 버튼이 열린다. 없으면 「늘 잠긴다」로 그려도 통과한다. */
  it('창고를 고르면 그 사유가 사라지고 규칙 추가가 열린다', async () => {
    const { user } = renderScreen();

    await selectWarehouse(user);
    await waitForRows();

    expect(createButton()).toBeEnabled();
    expect(screen.queryByText(t.actionReasons.addNeedsWarehouse)).not.toBeInTheDocument();
  });

  /** 빈 폼을 두면 「값이 없는 규칙」으로 읽힌다 — 고르라는 안내가 정확하다. */
  it('규칙을 고르기 전에는 안내가 선다', async () => {
    renderScreen(WITH_WAREHOUSE);

    expect(await screen.findByText(t.empty.noSelectionTitle)).toBeInTheDocument();
    expect(within(formPane()).queryByLabelText(t.fields.capacity)).not.toBeInTheDocument();
  });

  /** 갈래 21 — 빈 초안이 열리되 **우선순위만** 기본값을 갖는다(생성 타입에서 필수다). */
  it('규칙 추가로 빈 초안이 열린다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE);

    await waitForRows();
    await user.click(createButton());

    expect(await within(formPane()).findByLabelText(t.fields.priorityNo)).toHaveValue('100');
    expect(capacityField()).toHaveValue('');
    expect(currentLocation()).toContain('new=1');
  });

  /** 등록 중에는 상세를 부를 대상이 없다 — 부르면 없는 자원을 묻는 요청이다. */
  it('등록 중에는 상세를 부르지 않는다', async () => {
    const { urls, user } = renderScreen(WITH_WAREHOUSE);

    await waitForRows();
    await user.click(createButton());
    await within(formPane()).findByLabelText(t.fields.priorityNo);

    expect(urls.filter((url) => isDetailPath(url.pathname))).toHaveLength(0);
  });

  /** 갈래 22 — 고른 규칙의 상세를 부르고 그 값으로 폼이 선다. */
  it('행을 고르면 그 규칙의 상세를 부르고 폼이 채워진다', async () => {
    const { urls, user } = renderScreen(WITH_WAREHOUSE);

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();

    expect(urls.filter((url) => url.pathname === detailPathOf(9001))).toHaveLength(1);
    expect(capacityField()).toHaveValue('500');
    expect(within(formPane()).getByLabelText(t.fields.priorityNo)).toHaveValue('10');
  });

  /**
   * **C3-1.** 실패를 로딩보다 앞에서 판정한다 — 먼저 로딩을 보면 실패한 조회가 영원히
   * 「불러오는 중」으로 보이고, 사용자는 기다리면 될 일이라고 읽는다(사본 대조 추가 ①).
   */
  it('상세 조회가 실패하면 불러오는 중이 아니라 실패가 보인다', async () => {
    const failingDetail: StubRoute = {
      match: (request) => request.method === 'GET' && isDetailPath(new URL(request.url).pathname),
      respond: () => jsonResponse({ message: '' }, { status: 500 }),
    };
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([failingDetail]));

    await waitForRows();
    await selectRow(user);

    expect(await within(formPane()).findByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: t.loading.detail })).not.toBeInTheDocument();
  });

  it('상세 실패에서 다시 시도가 같은 조회를 한 번 더 부른다', async () => {
    const failingDetail: StubRoute = {
      match: (request) => request.method === 'GET' && isDetailPath(new URL(request.url).pathname),
      respond: () => jsonResponse({ message: '' }, { status: 500 }),
    };
    const { urls, user } = renderScreen(WITH_WAREHOUSE, allRoutes([failingDetail]));

    await waitForRows();
    await selectRow(user);
    await within(formPane()).findByText(messages.httpError.loadTitle);

    const before = countOf(urls, detailPathOf(9001));

    await user.click(within(formPane()).getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(countOf(urls, detailPathOf(9001))).toBe(before + 1);
    });
  });
});

/**
 * 없는 규칙을 가리키는 주소는 **정리하되 히스토리를 늘리지 않는다**(사본 체크리스트 1번).
 * 늘리면 뒤로가기가 없는 규칙으로 되돌아가고 그 자리에서 같은 정리가 되풀이돼 사용자가 갇힌다.
 */
describe('PutawayRuleScreen — 없는 규칙을 가리키는 주소', () => {
  const missingDetail: StubRoute = {
    match: (request) => request.method === 'GET' && isDetailPath(new URL(request.url).pathname),
    respond: () => jsonResponse({ message: '' }, { status: 404 }),
  };

  it('주소에서 번호를 걷고 찾을 수 없다고 말한다', async () => {
    renderScreen('/?wh=9201&rule=9999', allRoutes([missingDetail]));

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeInTheDocument();
    await waitFor(() => {
      expect(currentLocation()).not.toContain('rule=9999');
    });
  });

  it('정리가 뒤로가기 기록을 늘리지 않는다', async () => {
    const { user } = renderScreen('/?wh=9201&rule=9999', allRoutes([missingDetail]));

    await screen.findByText(t.empty.notFoundTitle);
    await user.click(screen.getByRole('button', { name: '뒤로' }));

    /* 한 칸 뒤로 가면 이 화면에 들어오기 전이다 — 없는 규칙 주소로 돌아가면 안 된다. */
    await waitFor(() => {
      expect(currentLocation()).not.toContain('rule=9999');
    });
  });

  /**
   * ⭐ **「늘지 않았다」를 자기 치유가 만들 수 없는 값으로 잰다.**
   *
   * 바로 위 시험은 뒤로 간 뒤 「9999가 없다」를 기다리는데, 정리가 푸시였다면 뒤로 간 그 자리에서
   * **정리가 다시 돌아** 같은 문자열을 만든다 — 기다리면 통과하고 **사용자만 그 자리에 갇힌다**
   * (뒤로 눌러도 없는 규칙 주소로 되돌아가 같은 정리가 되풀이된다 · 사본 체크리스트 1번).
   *
   * 그래서 **정리 이전의 자리**(질의 없는 주소)를 기다린다. 푸시로 칸이 쌓였다면 한 칸 뒤는
   * 없는 규칙 주소이고, 그 자리가 다시 정리돼도 **이 값은 되지 못한다.**
   */
  it('정리 뒤 한 칸 뒤로 가면 이 화면에 들어오기 전 자리다', async () => {
    const { user } = renderScreen('/', allRoutes([missingDetail]), undefined, '?wh=9201&rule=9999');

    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    /* 짝 양성 — 없는 규칙을 실제로 가리켰고 정리가 돌았다. */
    await screen.findByText(t.empty.notFoundTitle);
    await waitFor(() => {
      expect(currentLocation()).toBe('/?wh=9201');
    });

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).toBe('/');
    });
  });

  /** 조건이 바뀌면 그 안내가 가리킬 것이 없다 — 자기 대상보다 오래 살지 않는다. */
  it('조건이 바뀌면 안내가 사라진다', async () => {
    const { user } = renderScreen('/?wh=9201&rule=9999', allRoutes([missingDetail]));

    await screen.findByText(t.empty.notFoundTitle);
    await user.click(screen.getByRole('checkbox', { name: t.filters.activeOnly }));

    await waitFor(() => {
      expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
    });
  });
});

describe('PutawayRuleScreen — 폼의 위치 칸 (C3-3 · C3-4)', () => {
  const openCreateForm = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
    await waitForRows();
    await user.click(createButton());
    await within(formPane()).findByLabelText(t.fields.priorityNo);
  };

  /** **C3-3.** 좁힘은 조회가 한다 — 계약이 `warehouseId`를 필수로 요구한다. */
  it('위치 선택지에 고른 창고의 위치만 있다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE);

    await openCreateForm(user);
    await user.click(within(formPane()).getByRole('combobox', { name: t.fields.location }));

    expect(await screen.findByRole('option', { name: LOCATION_LABEL })).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: OTHER_WAREHOUSE_LOCATION_LABEL }),
    ).not.toBeInTheDocument();
  });

  /** 비운 위치는 **확정된 뜻**(창고 전체)이라 고를 수 있는 자리가 늘 있어야 한다. */
  it('위치 선택지 첫 자리가 「창고 전체」다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE);

    await openCreateForm(user);
    await user.click(within(formPane()).getByRole('combobox', { name: t.fields.location }));

    expect(await screen.findByRole('option', { name: t.values.warehouseWide })).toBeInTheDocument();
  });

  /** **C3-4.** 자리표시 배열이 비어 있는 동안 **모든 창고에서** 위치 입력이 열린다. */
  it('관리수준이 정해지지 않았다는 안내가 서면서 위치 칸이 열려 있다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE);

    await openCreateForm(user);

    expect(within(formPane()).getByText(t.notes.managementLevelPending)).toBeInTheDocument();
    expect(within(formPane()).getByRole('combobox', { name: t.fields.location })).toBeEnabled();
  });

  /**
   * 다른 창고의 위치를 실은 규칙은 성립하지 않는다 — 창고를 바꾸면 위치를 비우고
   * **그 창고의 위치를** 다시 받는다.
   */
  it('폼에서 창고를 바꾸면 그 창고의 위치를 부른다', async () => {
    const { urls, user } = renderScreen(WITH_WAREHOUSE);

    await openCreateForm(user);
    await user.click(within(formPane()).getByRole('combobox', { name: t.fields.warehouse }));
    await user.click(
      await screen.findByRole('option', {
        name: `SYN-WH-02 · 합성창고 나${t.values.inactiveSuffix}`,
      }),
    );

    await waitFor(() => {
      expect(lastOf(urls, LOCATIONS_PATH)?.searchParams.get('warehouseId')).toBe('9202');
    });
  });

  /**
   * 조건 줄과 폼이 같은 창고를 보는 동안에는 **그 창고만** 부른다 — 캐시 열쇠가 같아
   * 다른 창고의 위치가 섞여 오지 않는다.
   */
  it('폼이 조건 줄과 같은 창고를 보면 그 창고의 위치만 부른다', async () => {
    const { urls, user } = renderScreen(WITH_WAREHOUSE);

    await openCreateForm(user);

    const warehouseIds = urls
      .filter((url) => url.pathname === LOCATIONS_PATH)
      .map((url) => url.searchParams.get('warehouseId'));

    expect(warehouseIds.length).toBeGreaterThan(0);
    expect(new Set(warehouseIds)).toEqual(new Set(['9201']));
  });
});

describe('PutawayRuleScreen — 품목 찾기 (갈래 23)', () => {
  const openPicker = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
    await waitForRows();
    await user.click(createButton());
    await within(formPane()).findByLabelText(t.fields.priorityNo);
    await user.click(within(formPane()).getByRole('button', { name: t.actions.openItemPicker }));
  };

  it('창에서 고른 품목이 폼에 이름으로 선다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE);

    await openPicker(user);

    const dialog = within(screen.getByRole('dialog'));

    await user.type(dialog.getByLabelText(t.itemPicker.keywordLabel), '합성');
    await user.click(dialog.getByRole('button', { name: t.actions.searchItems }));
    await user.click(
      await dialog.findByRole('button', {
        name: t.actions.chooseItem('SYN-ITEM-02 · 합성품목 나'),
      }),
    );

    expect(within(formPane()).getByLabelText(t.fields.item)).toHaveTextContent(
      'SYN-ITEM-02 · 합성품목 나',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('창을 닫으면 고르지 않는다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE);

    await openPicker(user);
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: messages.common.cancel }),
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    /* 닫기만 했으니 **아직 고르지 않은 상태**다 — 「알 수 없음」(값이 잘못됐다)이 아니다. */
    expect(within(formPane()).getByLabelText(t.fields.item)).toHaveTextContent(
      t.form.itemNotChosen,
    );
  });
});

describe('PutawayRuleScreen — 등록 저장 (C3-5 · C3-10)', () => {
  /**
   * 품목 9101 · 창고 전체 · 우선순위 100을 고른다 — 픽스처에 **같은 네 축의 활성 규칙이 없어**
   * 중복 판정이 이 시험을 막지 않는다(중복 갈래는 아래 전용 묶음이 잰다).
   */
  const openCreateFormWithItem = async (
    user: ReturnType<typeof userEvent.setup>,
  ): Promise<void> => {
    await waitForRows();
    await user.click(createButton());
    await within(formPane()).findByLabelText(t.fields.priorityNo);
    await user.click(within(formPane()).getByRole('button', { name: t.actions.openItemPicker }));

    const dialog = within(screen.getByRole('dialog'));

    await user.type(dialog.getByLabelText(t.itemPicker.keywordLabel), '합성');
    await user.click(dialog.getByRole('button', { name: t.actions.searchItems }));
    await user.click(await dialog.findByRole('button', { name: t.actions.chooseItem(ITEM_LABEL) }));
  };

  const fillCapacity = async (
    user: ReturnType<typeof userEvent.setup>,
    qty: string,
  ): Promise<void> => {
    await user.clear(capacityField());
    await user.type(capacityField(), qty);
    await user.click(within(formPane()).getByRole('combobox', { name: t.fields.uom }));
    await user.click(await screen.findByRole('option', { name: UOM_LABEL }));
  };

  /** **C3-5.** 보내 놓고 서버가 되돌려 주기를 기다리면 사용자가 두 번 기다린다. */
  it('용량 0이면 요청이 나가지 않고 그 칸에 이유가 선다', async () => {
    const { requests, user } = renderScreen(WITH_WAREHOUSE, allRoutes([createRoute()]));

    await openCreateFormWithItem(user);
    await fillCapacity(user, '0');
    await user.click(submitCreateButton());

    expect(await screen.findByText(t.validation.capacityNotPositive)).toBeInTheDocument();
    expect(writesOf(requests, 'POST')).toHaveLength(0);
  });

  it('품목을 고르지 않으면 요청이 나가지 않고 그 칸에 이유가 선다', async () => {
    const { requests, user } = renderScreen(WITH_WAREHOUSE, allRoutes([createRoute()]));

    await waitForRows();
    await user.click(createButton());
    await within(formPane()).findByLabelText(t.fields.priorityNo);
    await fillCapacity(user, '500');
    await user.click(submitCreateButton());

    expect(await screen.findByText(t.validation.itemRequired)).toBeInTheDocument();
    expect(writesOf(requests, 'POST')).toHaveLength(0);
  });

  /** **C3-10.** 등록에는 잠글 대상이 없다 — `If-Match`를 실으면 계약이 400으로 되돌린다. */
  it('등록 요청에 멱등 키가 실리고 If-Match는 실리지 않는다', async () => {
    const { requests, user } = renderScreen(WITH_WAREHOUSE, allRoutes([createRoute()]));

    await openCreateFormWithItem(user);
    await fillCapacity(user, '500');
    await user.click(submitCreateButton());

    await waitFor(() => {
      expect(writesOf(requests, 'POST')).toHaveLength(1);
    });

    const request = writesOf(requests, 'POST')[0];

    expect(request?.headers.get('Idempotency-Key')).not.toBeNull();
    expect(request?.headers.get('If-Match')).toBeNull();
  });

  /** 생성 타입에서 `priorityNo`가 선택이 아니다(부록 A ⓐ) — 폼이 늘 값을 싣는다. */
  it('등록 본문에 우선순위와 비운 위치가 명시돼 실린다', async () => {
    const { requests, user } = renderScreen(WITH_WAREHOUSE, allRoutes([createRoute()]));

    await openCreateFormWithItem(user);
    await fillCapacity(user, '500');
    await user.click(submitCreateButton());

    await waitFor(() => {
      expect(writesOf(requests, 'POST')).toHaveLength(1);
    });

    const body = await bodyOf(writesOf(requests, 'POST')[0] as Request);

    expect(body).toMatchObject({
      itemId: 9101,
      warehouseId: 9201,
      locationId: null,
      capacityQty: 500,
      uomId: 9401,
      priorityNo: 100,
    });
  });

  /** 여기서 옮기지 않으면 사용자는 자기가 만든 규칙을 목록에서 다시 찾아야 한다. */
  it('등록에 성공하면 만든 규칙을 열고 목록을 다시 부른다', async () => {
    const { urls, user } = renderScreen(WITH_WAREHOUSE, allRoutes([createRoute()]));

    await openCreateFormWithItem(user);
    const beforeList = listCountOf(urls);

    await fillCapacity(user, '500');
    await user.click(submitCreateButton());

    await waitFor(() => {
      expect(currentLocation()).toContain('rule=9005');
    });
    expect(currentLocation()).not.toContain('new=1');
    await waitFor(() => {
      expect(listCountOf(urls)).toBeGreaterThan(beforeList);
    });
  });
});

describe('PutawayRuleScreen — 수정 저장 (C3-11 · C3-12)', () => {
  const dirtyForm = async (
    user: ReturnType<typeof userEvent.setup>,
    qty = '600',
  ): Promise<void> => {
    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.clear(capacityField());
    await user.type(capacityField(), qty);
  };

  /**
   * **C3-11.** 잠금 토큰의 원천은 **상세 응답의 `ETag`**다. 액션 경로나 목록에서 꺼내면 언제나
   * 비어 있고, 그때 쓰기 훅은 요청을 보내지 않고 멈춘다.
   */
  it('수정 요청에 멱등 키와 상세가 준 If-Match가 함께 실린다', async () => {
    const { requests, user } = renderScreen(WITH_WAREHOUSE, allRoutes([updateRoute()]));

    await dirtyForm(user);
    await user.click(saveButton());

    await waitFor(() => {
      expect(writesOf(requests, 'PUT')).toHaveLength(1);
    });

    const request = writesOf(requests, 'PUT')[0];

    expect(request?.headers.get('Idempotency-Key')).not.toBeNull();
    expect(request?.headers.get('If-Match')).toBe(DETAIL_ETAG);
    expect(new URL(request?.url ?? '').pathname).toBe(detailPathOf(9001));
  });

  /** 계약이 「바꾸면 다른 규칙이다」로 두 키를 뺐다 — 폼이 값을 들고 있어도 실리지 않는다. */
  it('수정 본문에 품목과 창고가 실리지 않는다', async () => {
    const { requests, user } = renderScreen(WITH_WAREHOUSE, allRoutes([updateRoute()]));

    await dirtyForm(user);
    await user.click(saveButton());

    await waitFor(() => {
      expect(writesOf(requests, 'PUT')).toHaveLength(1);
    });

    const body = await bodyOf(writesOf(requests, 'PUT')[0] as Request);

    expect(body).not.toHaveProperty('itemId');
    expect(body).not.toHaveProperty('warehouseId');
    expect(body.capacityQty).toBe(600);
  });

  /** 성공 뒤 무효화가 없으면 그다음 저장이 조용히 409다 — 새 토큰을 받을 길이 없다. */
  it('수정에 성공하면 상세와 목록을 다시 부른다', async () => {
    const { urls, user } = renderScreen(WITH_WAREHOUSE, allRoutes([updateRoute()]));

    await dirtyForm(user);
    const beforeDetail = countOf(urls, detailPathOf(9001));
    const beforeList = listCountOf(urls);

    await user.click(saveButton());

    await waitFor(() => {
      expect(countOf(urls, detailPathOf(9001))).toBeGreaterThan(beforeDetail);
    });
    expect(listCountOf(urls)).toBeGreaterThan(beforeList);
  });

  /**
   * **C3-12.** 충돌은 상세를 다시 받아 잠금 토큰을 갱신하면 풀린다 — 그 길을 배너가 낸다.
   */
  it('409에서 최신 불러오기가 서고 누르면 상세를 다시 부른다', async () => {
    const conflict = updateRoute(() =>
      jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 }),
    );
    const { urls, user } = renderScreen(WITH_WAREHOUSE, allRoutes([conflict]));

    await dirtyForm(user);
    await user.click(saveButton());

    const reload = await within(formPane()).findByRole('button', {
      name: messages.conflict.reloadAction,
    });
    const before = countOf(urls, detailPathOf(9001));

    await user.click(reload);

    await waitFor(() => {
      expect(countOf(urls, detailPathOf(9001))).toBe(before + 1);
    });
  });

  /** 서버가 그 칸에 붙여 보낸 오류는 **인라인**으로 낸다 — 배너로 올리면 어느 칸인지 사라진다. */
  it('400 필드 오류가 그 칸 옆에 선다', async () => {
    const rejecting = updateRoute(() =>
      jsonResponse(
        {
          message: '',
          errors: [
            {
              scope: 'field',
              field: 'capacityQty',
              code: 'INVALID',
              message: '용량이 너무 큽니다.',
            },
          ],
        },
        { status: 400 },
      ),
    );
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([rejecting]));

    await dirtyForm(user);
    await user.click(saveButton());

    expect(await screen.findByText('용량이 너무 큽니다.')).toBeInTheDocument();
  });

  /** 고친 것이 없으면 보낼 것이 없다 — 사유를 밝히고 잠근다. */
  it('고친 것이 없으면 저장이 사유와 함께 잠긴다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([updateRoute()]));

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();

    expect(saveButton()).toBeDisabled();
    expect(within(formPane()).getByText(t.actionReasons.saveNoChanges)).toBeInTheDocument();
  });
});

describe('PutawayRuleScreen — 활성 중복 선검사 (C3-8 · C3-9)', () => {
  /**
   * **C3-8.** 계약이 400으로 막는 조합이다. 화면이 먼저 막는 이유는 *저장을 누르기 전에 이유를
   * 아는 것*이며, 서버의 400과 이중이되 어느 하나를 등가로 보고 지우지 않는다.
   */
  it('같은 조합의 활성 규칙이 있으면 저장이 막히고 이유가 보인다', async () => {
    /* 9001과 같은 (품목·창고·위치·우선순위)를 가진 다른 규칙 하나 — 자기 자신이 아니다. */
    const twin = { ...ruleFixtureAt(9001), putawayRuleId: 9006 };
    const probeRoute: StubRoute = {
      match: (request) =>
        isGet(request, RULES_PATH) && new URL(request.url).searchParams.has('size'),
      respond: () => jsonResponse(listBody([twin])),
    };
    const { requests, user } = renderScreen(WITH_WAREHOUSE, allRoutes([probeRoute, updateRoute()]));

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.clear(capacityField());
    await user.type(capacityField(), '600');

    expect(
      await within(formPane()).findByText(t.actionReasons.duplicateActive(1)),
    ).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    expect(writesOf(requests, 'PUT')).toHaveLength(0);
  });

  /** 자기 자신을 빼지 않으면 수정이 **늘 자기 때문에** 막힌다. */
  it('자기 자신 때문에 막히지 않는다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([updateRoute()]));

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.clear(capacityField());
    await user.type(capacityField(), '600');

    expect(saveButton()).toBeEnabled();
  });

  /**
   * **C3-9.** 판정하지 못한 갈래는 **막지 않는다** — 조회 하나가 실패했다고 마스터 관리 전체가
   * 멈추면 안 된다. 계약이 같은 조건을 400으로 다시 검사한다.
   */
  it('조준 조회가 실패해도 저장을 막지 않고 그 사실을 밝힌다', async () => {
    const failingProbe: StubRoute = {
      match: (request) =>
        isGet(request, RULES_PATH) && new URL(request.url).searchParams.has('size'),
      respond: () => jsonResponse({ message: '' }, { status: 500 }),
    };
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([failingProbe, updateRoute()]));

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.clear(capacityField());
    await user.type(capacityField(), '600');

    expect(await within(formPane()).findByText(t.notes.duplicateUnknown)).toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  /** 폼이 닫혀 있으면 판정할 자리가 없다 — 읽기만 하는 사용자에게 요청을 내지 않는다. */
  it('폼이 열리기 전에는 조준 조회가 나가지 않는다', async () => {
    const { urls } = renderScreen(WITH_WAREHOUSE);

    await waitForRows();

    expect(probeUrls(urls)).toHaveLength(0);
  });

  /** 조준 조회는 **창고·품목**만 싣는다 — 위치와 우선순위는 화면이 맞춘다. */
  it('조준 조회가 창고·품목으로 좁혀 나간다', async () => {
    const { urls, user } = renderScreen(WITH_WAREHOUSE);

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();

    await waitFor(() => {
      expect(probeUrls(urls).length).toBeGreaterThan(0);
    });

    const query = probeUrls(urls).at(-1)?.searchParams;

    expect(query?.get('warehouseId')).toBe('9201');
    expect(query?.get('itemId')).toBe('9101');
    expect(query?.get('includeInactive')).toBe('false');
  });
});

describe('PutawayRuleScreen — 위치 자체 용량 (C3-6 · C3-7)', () => {
  const selectWarehouseWideRule = async (
    user: ReturnType<typeof userEvent.setup>,
  ): Promise<void> => {
    await waitForRows();
    await selectRow(user, 'SYN-ITEM-02 · 합성품목 나', t.values.warehouseWide);
    await waitForEditForm();
  };

  /**
   * **C3-6.** 규칙 용량이 위치 용량(400)보다 크면 경고가 서되 **저장은 그대로 된다**
   * (`omf-mes#84` — 어느 쪽이 이기는지 아직 정해지지 않았다).
   */
  it('규칙 용량이 위치 용량보다 크면 경고가 서고 저장은 나간다', async () => {
    const { requests, user } = renderScreen(WITH_WAREHOUSE, allRoutes([updateRoute()]));

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.clear(capacityField());
    await user.type(capacityField(), '900');

    expect(
      await within(formPane()).findByText(t.notes.locationCapacity('400', UOM_LABEL)),
    ).toBeInTheDocument();
    expect(within(formPane()).getByText(t.notes.locationCapacityOver)).toBeInTheDocument();

    await user.click(saveButton());

    await waitFor(() => {
      expect(writesOf(requests, 'PUT')).toHaveLength(1);
    });
  });

  /** 넘지 않으면 실값만 보인다 — 사용자가 할 일이 없는 자리에 경고를 두지 않는다. */
  it('넘지 않으면 실값만 보인다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([updateRoute()]));

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.clear(capacityField());
    await user.type(capacityField(), '300');

    expect(
      await within(formPane()).findByText(t.notes.locationCapacity('400', UOM_LABEL)),
    ).toBeInTheDocument();
    expect(within(formPane()).queryByText(t.notes.locationCapacityOver)).not.toBeInTheDocument();
  });

  /** **C3-7.** 창고 전체 규칙은 견줄 위치가 없다 — 값도 경고도 만들지 않는다. */
  it('위치를 비운 규칙에는 위치 용량을 내지 않는다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([updateRoute()]));

    await selectWarehouseWideRule(user);

    expect(within(formPane()).queryByText(/이 위치의 용량/)).not.toBeInTheDocument();
    expect(within(formPane()).queryByText(t.notes.locationCapacityOver)).not.toBeInTheDocument();
  });

  /** **C3-7.** 용량이 없는 위치를 고르면 그 경고를 만들지 않는다. */
  it('용량이 없는 위치를 고르면 경고를 만들지 않는다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([updateRoute()]));

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.click(within(formPane()).getByRole('combobox', { name: t.fields.location }));
    await user.click(
      await screen.findByRole('option', {
        name: `${INACTIVE_LOCATION_LABEL}${t.values.inactiveSuffix}`,
      }),
    );
    await user.clear(capacityField());
    await user.type(capacityField(), '900');

    await waitFor(() => {
      expect(within(formPane()).queryByText(/이 위치의 용량/)).not.toBeInTheDocument();
    });
    expect(within(formPane()).queryByText(t.notes.locationCapacityOver)).not.toBeInTheDocument();
  });

  /** 단위가 다르면 두 수는 애초에 같은 종류가 아니다 — 실값은 보이되 견주지 않았다고 말한다. */
  it('단위가 다르면 견주지 않았다고 말한다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([updateRoute()]));

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.click(within(formPane()).getByRole('combobox', { name: t.fields.uom }));
    await user.click(await screen.findByRole('option', { name: OTHER_UOM_LABEL }));

    expect(
      await within(formPane()).findByText(t.notes.locationCapacityUnitMismatch),
    ).toBeInTheDocument();
    expect(within(formPane()).queryByText(t.notes.locationCapacityOver)).not.toBeInTheDocument();
  });
});

/**
 * **나가는 중인 저장**(공유계약 G-30). 막는 것은 **전역**이고 보이는 것은 **대상에만**이다 —
 * 한 축으로 합치면 반드시 한쪽이 틀린다. 그래서 두 벌로 나눠 잰다.
 */
describe('PutawayRuleScreen — 나가는 중인 저장의 잠금 (C3-13)', () => {
  const holdUpdate = (request: Request): boolean =>
    request.method === 'PUT' && isDetailPath(new URL(request.url).pathname);

  const startSave = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.clear(capacityField());
    await user.type(capacityField(), '600');
    await user.click(saveButton());
  };

  it('다른 규칙으로 옮겨 가는 길이 잠긴다', async () => {
    const { requests, urls, user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([updateRoute()]),
      holdUpdate,
    );

    await startSave(user);
    await waitFor(() => {
      expect(writesOf(requests, 'PUT')).toHaveLength(1);
    });

    const before = countOf(urls, detailPathOf(9003));

    await selectRow(user, ITEM_LABEL, INACTIVE_LOCATION_LABEL);

    expect(currentLocation()).toContain('rule=9001');
    expect(countOf(urls, detailPathOf(9003))).toBe(before);
    /*
     * ⛔ **묻지도 않는다.** 나가는 중에는 잠긴 것이지 「버릴까요」를 물을 자리가 아니다 —
     * 파기 확인이 열리면 사용자가 버리기를 골라 대상을 바꿀 수 있고, 그때 앞 요청의 결과가
     * 지금 보는 맥락에 나타난다. 이 음성 단언이 없으면 **잠금이 사라져도 초안 확인 창이
     * 대신 막아 주는 것처럼 보여** 감지기가 통과한다.
     */
    expect(screen.queryByText(t.dialog.discardBody)).not.toBeInTheDocument();
  });

  /** 쪽 이동도 보이는 행을 바꾼다 — 같은 문으로 막힌다. */
  it('쪽 이동이 잠긴다', async () => {
    const { requests, user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([updateRoute(), route(RULES_PATH, ruleFixtures, { total: 45 })]),
      holdUpdate,
    );

    await startSave(user);
    await waitFor(() => {
      expect(writesOf(requests, 'PUT')).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    expect(currentLocation()).not.toContain('page=2');
  });

  it('규칙 추가와 쪽 이동이 함께 잠긴다', async () => {
    const { requests, user } = renderScreen(WITH_WAREHOUSE, allRoutes([updateRoute()]), holdUpdate);

    await startSave(user);
    await waitFor(() => {
      expect(writesOf(requests, 'PUT')).toHaveLength(1);
    });

    expect(createButton()).toBeDisabled();
  });

  /** 잠긴 이유가 화면 어디에도 없으면 사용자에게 **고장으로 읽힌다.** */
  it('잠긴 사유가 상시 보인다', async () => {
    const { requests, user } = renderScreen(WITH_WAREHOUSE, allRoutes([updateRoute()]), holdUpdate);

    await startSave(user);
    await waitFor(() => {
      expect(writesOf(requests, 'PUT')).toHaveLength(1);
    });

    expect(screen.getByText(t.notes.savingLock)).toBeInTheDocument();
  });

  /**
   * ⭐ **C4-B.** 사유의 자리가 **폼 밖**이다.
   *
   * 폼은 대상이 풀리면 닫히는데(뒤로가기·주소 직접 편집은 클릭 핸들러를 지나지 않아 잠금 문에
   * 걸리지 않는다) 잠금은 요청이 끝날 때까지 남는다 — 사유가 폼 구획 안에만 있으면 이 갈래에서
   * **잠긴 채 이유가 화면 어디에도 없다**(G-30의 「상시」 미달).
   */
  it('폼이 닫힌 채 잠겨도 사유가 선다', async () => {
    const { requests, user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([updateRoute()]),
      holdUpdate,
      '?wh=9201',
    );

    await startSave(user);
    await waitFor(() => {
      expect(writesOf(requests, 'PUT')).toHaveLength(1);
    });

    /* 화면 바깥에서 선택이 풀린 주소로 옮긴다 — 폼이 닫힌다. */
    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await screen.findByText(t.empty.noSelectionTitle);

    // 선행 단언 — 잠금 자체는 살아 있다(요청이 아직 날아가는 중이다).
    expect(createButton()).toBeDisabled();
    expect(screen.getByText(t.notes.savingLock)).toBeInTheDocument();
  });

  /**
   * ⭐ **C4-D.** 머리글의 「규칙 추가」가 **두 사유로** 잠기는데 둘 다 할 일이 다르다.
   * 사유 없이 잠그면 고장으로 읽힌다(배치 규범 4).
   */
  it('나가는 중에는 규칙 추가에 사유가 붙는다', async () => {
    const { requests, user } = renderScreen(WITH_WAREHOUSE, allRoutes([updateRoute()]), holdUpdate);

    await startSave(user);
    await waitFor(() => {
      expect(writesOf(requests, 'PUT')).toHaveLength(1);
    });

    expect(createButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.addLockedByOtherSave)).toBeInTheDocument();
  });

  it('취소도 사유와 함께 잠긴다', async () => {
    const { requests, user } = renderScreen(WITH_WAREHOUSE, allRoutes([updateRoute()]), holdUpdate);

    await startSave(user);
    await waitFor(() => {
      expect(writesOf(requests, 'PUT')).toHaveLength(1);
    });

    expect(within(formPane()).getByRole('button', { name: messages.common.cancel })).toBeDisabled();
    expect(
      within(formPane()).getByText(t.actionReasons.cancelLockedByOtherSave),
    ).toBeInTheDocument();
  });
});

/**
 * **보이는 것은 대상에만**(G-30). 잠금과 **같은 축으로 합쳐 재지 않는다** — 합치면
 * 「남의 저장으로 진행 표시가 도는」 자리와 「내 저장 중에 다른 저장이 시작되는」 자리 중
 * 하나가 반드시 열린다.
 */
describe('PutawayRuleScreen — 나가는 중인 저장의 표시 (C3-14)', () => {
  const holdUpdate = (request: Request): boolean =>
    request.method === 'PUT' && isDetailPath(new URL(request.url).pathname);

  const startSaveThenLeave = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.clear(capacityField());
    await user.type(capacityField(), '600');
    await user.click(saveButton());
    /* 바깥에서 대상을 갈아 끼운다 — 잠금 문을 지나지 않는 길이다(뒤로가기·주소 직접 편집). */
    await user.click(screen.getByRole('button', { name: '주소 이동' }));
  };

  it('저장이 나가는 동안 그 대상의 저장 자리에 진행 표시가 돈다', async () => {
    const { requests, user } = renderScreen(WITH_WAREHOUSE, allRoutes([updateRoute()]), holdUpdate);

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.clear(capacityField());
    await user.type(capacityField(), '600');
    await user.click(saveButton());

    await waitFor(() => {
      expect(writesOf(requests, 'PUT')).toHaveLength(1);
    });

    expect(saveButton()).toBeDisabled();
    /* 진행 표시가 도는 동안에는 「앞선 저장을 기다리는 중」이라는 남의 사유가 서지 않는다. */
    expect(
      within(formPane()).queryByText(t.actionReasons.saveLockedByOtherSave),
    ).not.toBeInTheDocument();
  });

  /** 대상이 바뀌면 진행 표시가 **따라오지 않는다** — 손댄 적 없는 규칙이 「저장 중」이 된다. */
  it('대상이 바뀌면 진행 표시가 따라오지 않고 잠금 사유로 바뀐다', async () => {
    const { requests, user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([updateRoute()]),
      holdUpdate,
      '?wh=9201&rule=9003',
    );

    await startSaveThenLeave(user);

    await waitFor(() => {
      expect(currentLocation()).toContain('rule=9003');
    });
    await waitFor(() => {
      expect(
        within(formPane()).getByText(t.actionReasons.saveLockedByOtherSave),
      ).toBeInTheDocument();
    });
    expect(writesOf(requests, 'PUT')).toHaveLength(1);
  });

  /**
   * 남의 대상에 보낸 요청의 실패 사유를 이 화면에 세우지 않는다 — **감추는 것이 규칙이다.**
   *
   * ⚠ **결과가 도착하는 시점을 대상이 바뀐 뒤로 두어야 한다.** 도착한 뒤에 옮겨 가면 대상
   * 정리(`resetEditing`)가 이미 끝난 쓰기를 거둬 배너가 어차피 사라지고, 그러면 이 감지기가
   * *가리는 규율이 없어도* 통과한다. 붙잡았다가 **옮겨 간 뒤에 푼다.**
   */
  it('대상이 바뀐 뒤 도착한 실패가 새 대상에 서지 않는다', async () => {
    const rejecting = updateRoute(() =>
      jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 }),
    );
    const { requests, release, user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([rejecting]),
      holdUpdate,
      '?wh=9201&rule=9003',
    );

    await startSaveThenLeave(user);
    await waitFor(() => {
      expect(currentLocation()).toContain('rule=9003');
    });

    release();

    /* 요청은 실제로 나갔고 서버가 거절했다 — 그 사실을 감추는 것과 일어나지 않는 것은 다르다. */
    await waitFor(() => {
      expect(writesOf(requests, 'PUT')).toHaveLength(1);
    });
    /* 결과가 도착해 공동 잠금이 풀린 시점을 잡는다 — 음성 단언은 그 뒤에 잰다. */
    await waitFor(() => {
      expect(createButton()).toBeEnabled();
    });
    expect(
      within(formPane()).queryByRole('button', { name: messages.conflict.reloadAction }),
    ).not.toBeInTheDocument();
  });

  /**
   * ⚠⚠ **성공 응답도 같은 가드를 지난다.** 실패 표시만 가리고 성공을 놓치면, 보내는 사이에
   * 다른 규칙으로 옮겨 갔을 때 **9001의 서버 응답이 9003의 폼에 앉는다.** 그 상태에서 한 칸만
   * 고쳐 저장하면 **사용자가 본 적 없는 값이 다른 규칙에 쓰인다** — 이 회차에서 가장 무거운
   * 갈래이며, 단위 ④의 쓰기들이 같은 규약을 물려받는다.
   */
  it('대상이 바뀐 뒤 도착한 성공이 새 대상의 값을 덮지 않는다', async () => {
    const { release, user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([updateRoute()]),
      holdUpdate,
      '?wh=9201&rule=9003',
    );

    await startSaveThenLeave(user);
    await waitFor(() => {
      expect(currentLocation()).toContain('rule=9003');
    });
    /* 9003의 **자기 값**이 선 것을 먼저 잡는다 — 음성 단언은 이 시점 뒤에 잰다. */
    await waitFor(() => {
      expect(capacityField()).toHaveValue('80');
    });

    release();

    /* 저장은 일어났다(알림은 대상과 무관하다) — 그런데 값은 남의 폼에 앉지 않는다. */
    expect(await screen.findByText(messages.common.saved)).toBeInTheDocument();
    expect(capacityField()).toHaveValue('80');
  });

  /**
   * **끊는 것과 감추는 것은 다르다**(`omf-mes#96` · 사본 체크리스트 4번). 대상이 바뀔 때
   * 나가는 중인 쓰기를 `reset()`으로 거두면 무효화·성공·공동 잠금이 통째로 사라진다 —
   * 서버에는 이미 갔는데 화면만 없던 일로 친다.
   */
  it('대상이 바뀌어도 나가는 중인 저장의 되먹임이 끊기지 않는다', async () => {
    const { urls, release, user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([updateRoute()]),
      holdUpdate,
      '?wh=9201&rule=9003',
    );

    await startSaveThenLeave(user);
    await waitFor(() => {
      expect(currentLocation()).toContain('rule=9003');
    });

    /* ① 공동 잠금이 살아 있다 — 요청은 아직 날아가는 중이다. */
    expect(createButton()).toBeDisabled();

    const beforeList = listCountOf(urls);

    release();

    /* ② 성공이 사라지지 않는다. */
    expect(await screen.findByText(messages.common.saved)).toBeInTheDocument();
    /* ③ 무효화가 살아 있다 — 이것이 없으면 다음 저장이 낡은 토큰으로 나간다. */
    await waitFor(() => {
      expect(listCountOf(urls)).toBeGreaterThan(beforeList);
    });
  });
});

describe('PutawayRuleScreen — 초안 파기 (C3-15)', () => {
  const dirtyForm = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.clear(capacityField());
    await user.type(capacityField(), '600');
  };

  /** **C3-15.** 고른 규칙이 바뀌면 초안이 통째로 버려진다 — 확인 없이 일어나면 안 된다. */
  it('편집 중 다른 규칙을 고르면 파기 확인이 뜬다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([updateRoute()]));

    await dirtyForm(user);
    await selectRow(user, ITEM_LABEL, INACTIVE_LOCATION_LABEL);

    expect(await screen.findByText(t.dialog.discardBody)).toBeInTheDocument();
    expect(currentLocation()).toContain('rule=9001');
  });

  it('계속 편집을 고르면 옮겨 가지 않고 친 값이 남는다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([updateRoute()]));

    await dirtyForm(user);
    await selectRow(user, ITEM_LABEL, INACTIVE_LOCATION_LABEL);
    await user.click(await screen.findByRole('button', { name: t.actions.keepEditing }));

    expect(currentLocation()).toContain('rule=9001');
    expect(capacityField()).toHaveValue('600');
  });

  it('버리기를 고르면 그 규칙으로 옮겨 간다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([updateRoute()]));

    await dirtyForm(user);
    await selectRow(user, ITEM_LABEL, INACTIVE_LOCATION_LABEL);
    await user.click(await screen.findByRole('button', { name: t.actions.discardDraft }));

    await waitFor(() => {
      expect(currentLocation()).toContain('rule=9003');
    });
  });

  /** 고친 것이 없으면 잃을 것도 없다 — 걸음을 늘리면 정상 조작이 번거로워진다. */
  it('편집 중이 아니면 확인 없이 옮겨 간다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([updateRoute()]));

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await selectRow(user, ITEM_LABEL, INACTIVE_LOCATION_LABEL);

    await waitFor(() => {
      expect(currentLocation()).toContain('rule=9003');
    });
    expect(screen.queryByText(t.dialog.discardBody)).not.toBeInTheDocument();
  });

  /** 취소는 **되돌리는** 조작이라 옮겨 가지 않고 기준값으로 돌아간다. */
  it('취소로 연 확인에서 버리면 제자리에서 값이 되돌아간다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([updateRoute()]));

    await dirtyForm(user);
    await user.click(within(formPane()).getByRole('button', { name: messages.common.cancel }));
    await user.click(await screen.findByRole('button', { name: t.actions.discardDraft }));

    expect(currentLocation()).toContain('rule=9001');
    await waitFor(() => {
      expect(capacityField()).toHaveValue('500');
    });
  });

  /** 등록 폼의 취소는 **폼을 닫는 것**이다 — 되돌릴 기준값이 없다. */
  it('등록 폼의 취소는 폼을 닫는다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([createRoute()]));

    await waitForRows();
    await user.click(createButton());
    await within(formPane()).findByLabelText(t.fields.priorityNo);
    await user.click(within(formPane()).getByRole('button', { name: messages.common.cancel }));

    await waitFor(() => {
      expect(currentLocation()).not.toContain('new=1');
    });
  });
});

/**
 * **갓 연 폼이 사실이 아닌 문장을 말하지 않는다.**
 *
 * 이 슬라이스는 여섯 자리에서 「확인하지 못한 것을 사실로 말하지 않는다」를 세웠다.
 * 그 규율이 **가장 먼저 깨지기 쉬운 자리가 조회가 열리기 전**이다 — 열리지 않은 조회의
 * 상태를 그대로 옮기면 화면이 「시도했으나 실패했다」고 말하게 된다.
 */
describe('PutawayRuleScreen — 갓 연 등록 폼의 문면', () => {
  const openCreateForm = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
    await waitForRows();
    await user.click(createButton());
    await within(formPane()).findByLabelText(t.fields.priorityNo);
  };

  /**
   * 조준 조회가 **한 번도 나가지 않은** 상태에서 「확인하지 못했습니다」가 서면 안 된다.
   * 요청 수를 함께 세어 **말과 사실을 같은 시점에** 잰다.
   */
  it('규칙 추가 직후에는 중복 판정 안내가 서지 않는다', async () => {
    const { urls, user } = renderScreen(WITH_WAREHOUSE);

    await openCreateForm(user);

    expect(within(formPane()).queryByText(t.notes.duplicateUnknown)).not.toBeInTheDocument();
    expect(probeUrls(urls)).toHaveLength(0);
  });

  /**
   * **양성 짝** — 겨눌 조합이 갖춰지고 조회가 아직 오지 않은 동안에는 **선다.**
   * 이것이 없으면 위 감지기는 「안내를 아예 만들지 않아도」 통과한다.
   */
  it('품목을 고른 뒤 조준 조회가 오기 전에는 안내가 선다', async () => {
    const holdProbe = (request: Request): boolean =>
      request.method === 'GET' &&
      new URL(request.url).pathname === RULES_PATH &&
      new URL(request.url).searchParams.has('size');
    const { urls, user } = renderScreen(WITH_WAREHOUSE, allRoutes(), holdProbe);

    await openCreateForm(user);
    await user.click(within(formPane()).getByRole('button', { name: t.actions.openItemPicker }));

    const dialog = within(screen.getByRole('dialog'));

    await user.type(dialog.getByLabelText(t.itemPicker.keywordLabel), '합성');
    await user.click(dialog.getByRole('button', { name: t.actions.searchItems }));
    await user.click(await dialog.findByRole('button', { name: t.actions.chooseItem(ITEM_LABEL) }));

    await waitFor(() => {
      expect(probeUrls(urls).length).toBeGreaterThan(0);
    });
    expect(await within(formPane()).findByText(t.notes.duplicateUnknown)).toBeInTheDocument();
  });

  /**
   * **전례에서 가져온 인자**(「저장할 뜻이 있을 때만 밝힌다」). 조준 조회는 규칙을 고르기만
   * 해도 나가므로, 이것이 없으면 구경만 하는 사용자에게 저장 안내가 뜬다.
   */
  it('고르기만 하고 고치지 않은 규칙에는 판정 안내가 서지 않는다', async () => {
    const failingProbe: StubRoute = {
      match: (request) =>
        isGet(request, RULES_PATH) && new URL(request.url).searchParams.has('size'),
      respond: () => jsonResponse({ message: '' }, { status: 500 }),
    };
    const { urls, user } = renderScreen(WITH_WAREHOUSE, allRoutes([failingProbe]));

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();

    /* 조회는 실제로 나갔고 실패했다 — 그런데도 구경만 하는 사용자에게는 말하지 않는다. */
    await waitFor(() => {
      expect(probeUrls(urls).length).toBeGreaterThan(0);
    });
    expect(within(formPane()).queryByText(t.notes.duplicateUnknown)).not.toBeInTheDocument();

    /* 한 글자만 고치면 저장할 뜻이 생긴다 — 그때부터는 밝힌다(양성 짝). */
    await user.clear(capacityField());
    await user.type(capacityField(), '600');

    expect(await within(formPane()).findByText(t.notes.duplicateUnknown)).toBeInTheDocument();
  });

  /**
   * ⛔ **아직 고르지 않은 칸에 「알 수 없음」을 세우지 않는다.** 이 슬라이스에서 그 낱말은
   * *값이 잘못됐다*는 뜻이고 목록 표의 깨진 행이 같은 낱말을 쓴다 — 빈 폼에 그것을 세우면
   * 「아직 안 골랐다」와 「값이 깨졌다」를 사용자가 가를 수 없다.
   */
  it('빈 초안의 품목 자리에 「알 수 없음」이 서지 않는다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE);

    await openCreateForm(user);

    const itemCell = within(formPane()).getByLabelText(t.fields.item);

    expect(itemCell).toHaveTextContent(t.form.itemNotChosen);
    expect(itemCell).not.toHaveTextContent(t.values.unknown);
  });

  /** **양성 짝** — 고른 뒤에는 이름이 선다. */
  it('품목을 고르면 그 자리에 이름이 선다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE);

    await openCreateForm(user);
    await user.click(within(formPane()).getByRole('button', { name: t.actions.openItemPicker }));

    const dialog = within(screen.getByRole('dialog'));

    await user.type(dialog.getByLabelText(t.itemPicker.keywordLabel), '합성');
    await user.click(dialog.getByRole('button', { name: t.actions.searchItems }));
    await user.click(await dialog.findByRole('button', { name: t.actions.chooseItem(ITEM_LABEL) }));

    expect(within(formPane()).getByLabelText(t.fields.item)).toHaveTextContent(ITEM_LABEL);
  });

  /**
   * 창이 준 이름을 **그대로 들고 있는다.** 품목 찾기는 검색 조건으로 좁혀 받으므로 좁히지 않은
   * 이름 풀이 목록(잘릴 수 있다)에 그 품목이 **없을 수 있다** — 버리면 방금 고른 품목이
   * 「알 수 없음」으로 보인다.
   */
  it('이름 풀이 목록에 없는 품목을 골라도 창이 준 이름이 선다', async () => {
    /* 이름 풀이에는 없고 **찾기 결과에만** 있는 품목 — 두 조회를 갈라 답한다. */
    const HIDDEN_ITEM = {
      ...itemFixtures[0],
      itemId: 9105,
      itemCode: 'SYN-ITEM-05',
      itemName: '합성품목 마',
    };
    const splitItemsRoute: StubRoute = {
      match: (request) => isGet(request, ITEMS_PATH),
      respond: (request) =>
        jsonResponse(
          listBody(new URL(request.url).searchParams.has('q') ? [HIDDEN_ITEM] : itemFixtures, {
            total: 99,
          }),
        ),
    };
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([splitItemsRoute]));

    await openCreateForm(user);
    await user.click(within(formPane()).getByRole('button', { name: t.actions.openItemPicker }));

    const dialog = within(screen.getByRole('dialog'));

    await user.type(dialog.getByLabelText(t.itemPicker.keywordLabel), '합성');
    await user.click(dialog.getByRole('button', { name: t.actions.searchItems }));
    await user.click(
      await dialog.findByRole('button', {
        name: t.actions.chooseItem('SYN-ITEM-05 · 합성품목 마'),
      }),
    );

    const itemCell = within(formPane()).getByLabelText(t.fields.item);

    expect(itemCell).toHaveTextContent('SYN-ITEM-05 · 합성품목 마');
    expect(itemCell).not.toHaveTextContent(t.values.unknown);
  });
});

describe('PutawayRuleScreen — 같은 주소로는 갱신하지 않는다', () => {
  /**
   * 화면을 바꾸지 않으면서 히스토리 칸만 늘어나면 **뒤로가기가 아무 일도 하지 않는 것처럼**
   * 보인다. 늘지 않았음은 뒤로 한 번 갔을 때 **그 앞으로** 가는 것으로만 증명된다.
   */
  it('같은 규칙을 두 번 골라도 히스토리가 늘지 않는다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([updateRoute()]));

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await selectRow(user);
    await selectRow(user);

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    /* 한 칸 뒤로 가면 고르기 전(창고만 걸린 주소)이다 — 같은 선택이 쌓였다면 아직 rule이 남는다. */
    await waitFor(() => {
      expect(currentLocation()).not.toContain('rule=9001');
    });
  });
});

/**
 * **라우트가 열리면서 「같은 화면으로 질의 없이 다시 들어오는 길」이 도달 가능해졌다** —
 * 사이드바 항목이 그 길이다(단위 ⑤).
 *
 * 화면 안의 조작은 전부 초안 파기 확인을 지나지만 **메뉴는 화면 바깥이라 그 문을 지나지
 * 않는다.** 그러므로 거두는 자리가 클릭 핸들러가 아니라 **주소에 매여** 있어야 한다 —
 * 매여 있지 않으면 버려진 초안이 살아남아, 다시 그 규칙으로 돌아왔을 때 **서버 값이 아닌
 * 값**이 폼에 서고 사용자는 그것이 저장된 값이라고 읽는다.
 */
describe('PutawayRuleScreen — 메뉴로 다시 들어오기', () => {
  const dirtyForm = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.clear(capacityField());
    await user.type(capacityField(), '600');
  };

  it('편집 중에 메뉴 주소로 들어오면 조건도 고른 규칙도 풀린다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([updateRoute()]), undefined, '');

    await dirtyForm(user);
    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    expect(await screen.findByText(t.empty.noWarehouseTitle)).toBeInTheDocument();
    expect(currentLocation()).toBe('/');
    /*
     * ⚠ **파기 확인을 지나지 않는다** — 메뉴는 이 화면의 문 밖에 있다. 확인 없이 초안이
     * 사라지는 것이 지금의 사실이며, 그 사실을 여기 고정해 둔다(막으려면 라우터 수준의
     * 이탈 차단이 필요하고 그것은 이 화면 혼자 정할 일이 아니다).
     */
    expect(screen.queryByText(t.dialog.discardBody)).not.toBeInTheDocument();
  });

  /**
   * ⭐ **거둠은 뒤로 돌아왔을 때 드러난다.** 나간 자리에서는 폼이 닫혀 있어 초안이 남았는지
   * 보이지 않는다 — 같은 규칙으로 돌아와 **기준값이 서는 것**으로만 거둔 사실이 증명된다.
   *
   * 뒤로가기가 **한 번**인 것도 함께 잰다. 메뉴 이동이 히스토리 칸을 둘 이상 늘리면
   * 사용자는 뒤로 눌러도 보던 자리로 돌아오지 못한다.
   */
  it('뒤로가기 한 번이면 앞 자리로 돌아오고 친 값은 되살아나지 않는다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([updateRoute()]), undefined, '');

    await dirtyForm(user);

    /* 짝 양성 — 친 값이 실제로 폼에 있다. 없으면 아래 단언이 「빈 폼」과 구별되지 않는다. */
    expect(capacityField()).toHaveValue('600');

    const before = currentLocation();

    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await screen.findByText(t.empty.noWarehouseTitle);

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).toBe(before);
    });
    await waitForEditForm();
    await waitFor(() => {
      expect(capacityField()).toHaveValue('500');
    });
  });
});

/* ── 끄기·켜기 (단위 ④) ─────────────────────────────────────────────── */

const ACTIVATION_PANE = (): HTMLElement => screen.getByRole('region', { name: t.panes.activation });

const activationDialog = (): HTMLElement => screen.getByRole('dialog');

const isActionPath = (pathname: string, action: 'deactivate' | 'activate'): boolean =>
  pathname === `/logistics/putaway-rules/9001:${action}` ||
  pathname === `/logistics/putaway-rules/9003:${action}`;

const activationRoute = (
  action: 'deactivate' | 'activate',
  respond?: StubRoute['respond'],
): StubRoute => ({
  match: (request) =>
    request.method === 'POST' && isActionPath(new URL(request.url).pathname, action),
  respond:
    respond ??
    (() =>
      jsonResponse({
        ...ruleFixtureAt(action === 'deactivate' ? 9001 : 9003),
        isActive: action === 'activate',
      })),
});

const activationRequests = (requests: Request[], action: 'deactivate' | 'activate'): Request[] =>
  requests.filter(
    (request) => request.method === 'POST' && isActionPath(new URL(request.url).pathname, action),
  );

/** 꺼진 규칙 9003을 고른다 — 「다시 사용」 갈래가 서는 대상이다. */
const selectInactiveRule = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await waitForRows();
  await selectRow(user, ITEM_LABEL, INACTIVE_LOCATION_LABEL);
  await waitForEditForm();
};

const holdDeactivate = (request: Request): boolean =>
  request.method === 'POST' && isActionPath(new URL(request.url).pathname, 'deactivate');

describe('PutawayRuleScreen — 상세 200 뒤에만 전환이 열린다 (C4-1)', () => {
  const holdDetail = (request: Request): boolean =>
    request.method === 'GET' && isDetailPath(new URL(request.url).pathname);

  /**
   * ⭐ **C4-1 · 위험 R2.** 잠금 토큰은 **상세 응답에서만** 온다 — 목록 응답에는 없고
   * `:activate`에도 `If-Match`가 필수다. 그래서 목록 행에서 곧바로 켜거나 끌 수 없다.
   *
   * **짝으로 잰다** — 상세를 붙잡아 둔 동안 끄기 이름이 서지 않는 것과, 풀면 서는 것을
   * 한 시험 안에서 본다. 앞만 재면 「전환 자리를 아예 만들지 않았다」와 구별되지 않는다.
   */
  it('상세가 오기 전에는 중립 이름이 잠기고, 도착하면 끄기가 열린다', async () => {
    const { release, user } = renderScreen(WITH_WAREHOUSE, allRoutes(), holdDetail);

    await waitForRows();
    await selectRow(user);

    /* ① 상세 미도착 — 사용 여부를 모르므로 끄기·켜기 이름을 세우지 않는다. */
    const pending = within(await screen.findByRole('region', { name: t.panes.activation }));

    expect(pending.getByRole('button', { name: t.actions.activation })).toBeDisabled();
    expect(screen.getByText(t.actionReasons.activationNeedsDetail)).toBeInTheDocument();
    expect(pending.queryByRole('button', { name: messages.common.deactivate })).toBeNull();

    release();

    /* ② 상세 200 뒤 — 그제야 끄기가 선다. */
    await waitForEditForm();
    expect(
      within(ACTIVATION_PANE()).getByRole('button', { name: messages.common.deactivate }),
    ).toBeEnabled();
    expect(screen.queryByRole('button', { name: t.actions.activation })).toBeNull();
  });

  /** 상세를 부르기 전 — 규칙을 고르지 않았으면 전환 구획 자체가 없다(전환할 대상이 없다). */
  it('규칙을 고르기 전에는 전환 구획을 두지 않는다', async () => {
    renderScreen(WITH_WAREHOUSE);

    await screen.findByText(t.empty.noSelectionTitle);

    expect(screen.queryByRole('region', { name: t.panes.activation })).not.toBeInTheDocument();
  });

  /** 꺼진 규칙에는 반대쪽 이름이 선다 — 상태를 보지 않으면 늘 같은 이름이 선다. */
  it('꺼진 규칙에는 「다시 사용」이 선다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([updateRoute()]));

    await selectInactiveRule(user);

    expect(
      within(ACTIVATION_PANE()).getByRole('button', { name: t.actions.activate }),
    ).toBeEnabled();
    expect(
      within(ACTIVATION_PANE()).queryByRole('button', { name: messages.common.deactivate }),
    ).toBeNull();
  });
});

describe('PutawayRuleScreen — 끄기 확인 창 (C4-2)', () => {
  /**
   * ⭐ **C4-2.** 계약에 `:deactivate`의 400이 아예 없다 — 화면의 경고가 유일한 방어다.
   * 확인 없이 곧바로 나가면 되돌릴 수 있음에도 현장이 그사이 검증 없이 돈다.
   */
  it('끄기를 누르면 요청 대신 확인 창이 먼저 열린다', async () => {
    const { requests, user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([activationRoute('deactivate')]),
    );

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.click(
      within(ACTIVATION_PANE()).getByRole('button', { name: messages.common.deactivate }),
    );

    expect(within(activationDialog()).getByText(t.dialog.deactivateTitle)).toBeInTheDocument();
    expect(activationRequests(requests, 'deactivate')).toHaveLength(0);
  });

  /**
   * ⭐ **파급을 사실대로 말한다.** 픽스처의 9001은 이 창고·품목에 사용 중인 규칙이 그것뿐이다
   * (9003은 꺼져 있다) — 그래서 「마지막이다」가 참이고 창이 그 문장을 세운다.
   */
  it('마지막 활성 규칙이면 위치 검증 없이 통과한다는 사실과 되돌릴 수 있음을 함께 말한다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([activationRoute('deactivate')]));

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.click(
      within(ACTIVATION_PANE()).getByRole('button', { name: messages.common.deactivate }),
    );

    const dialog = within(await screen.findByRole('dialog'));

    await waitFor(() => {
      expect(dialog.getByText(t.dialog.deactivateLastRule)).toBeInTheDocument();
    });
    expect(dialog.getByText(t.dialog.deactivateReversible)).toBeInTheDocument();
  });

  /**
   * ⛔ **남는 규칙이 있으면 그 문장을 세우지 않는다.** 조준 조회가 같은 창고·품목의 사용 중인
   * 규칙을 실어 오므로 화면이 셀 수 있다 — 갈래 없이 늘 세우면 **확인하지 않은 사실을 단언**한다.
   */
  it('같은 품목에 사용 중인 규칙이 더 있으면 「검증 없이 통과」를 말하지 않는다', async () => {
    /* 조준 조회에만 형제 규칙을 하나 더 실어 준다 — 목록은 그대로다. */
    const sibling = { ...ruleFixtureAt(9001), putawayRuleId: 9005, priorityNo: 20 };
    const probeRoute: StubRoute = {
      match: (request) => isGet(request, RULES_PATH) && isProbe(new URL(request.url)),
      respond: () => jsonResponse(listBody([ruleFixtureAt(9001), sibling])),
    };
    const { user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([probeRoute, activationRoute('deactivate')]),
    );

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.click(
      within(ACTIVATION_PANE()).getByRole('button', { name: messages.common.deactivate }),
    );

    const dialog = within(await screen.findByRole('dialog'));

    await waitFor(() => {
      expect(dialog.getByText(t.dialog.deactivateRemaining(1))).toBeInTheDocument();
    });
    expect(dialog.queryByText(t.dialog.deactivateLastRule)).not.toBeInTheDocument();
  });

  /** 조회가 실패하면 어느 쪽도 단언하지 않는다 — 「마지막이다」도 「남는다」도 확인한 사실이 아니다. */
  it('조준 조회가 실패하면 덮개를 단언하지 않는다', async () => {
    const failingProbe: StubRoute = {
      match: (request) => isGet(request, RULES_PATH) && isProbe(new URL(request.url)),
      respond: () => jsonResponse({ message: '' }, { status: 500 }),
    };
    const { user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([failingProbe, activationRoute('deactivate')]),
    );

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.click(
      within(ACTIVATION_PANE()).getByRole('button', { name: messages.common.deactivate }),
    );

    const dialog = within(await screen.findByRole('dialog'));

    await waitFor(() => {
      expect(dialog.getByText(t.dialog.deactivateCoverageUnknown)).toBeInTheDocument();
    });
    expect(dialog.queryByText(t.dialog.deactivateLastRule)).not.toBeInTheDocument();
  });
});

describe('PutawayRuleScreen — 켜기 전 중복 선검사 (C4-3)', () => {
  /**
   * ⭐ **C4-3.** 계약이 같은 (품목·창고·위치·우선순위) 활성 중복을 400으로 막는다 —
   * 확인 창까지 지나간 뒤 거절을 받으면 사용자는 무엇이 잘못됐는지 알 수 없다.
   *
   * ⚠ **네 축을 서버 값으로 겨눈다.** 꺼진 9003(위치 9302 · 우선순위 200)과 같은 조합의
   * **사용 중인** 규칙을 조준 조회에만 심는다.
   */
  it('켜려는 조합에 활성 중복이 있으면 막히고 건수가 사유로 선다', async () => {
    const clash = { ...ruleFixtureAt(9003), putawayRuleId: 9006, isActive: true };
    const probeRoute: StubRoute = {
      match: (request) => isGet(request, RULES_PATH) && isProbe(new URL(request.url)),
      respond: () => jsonResponse(listBody([clash])),
    };
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([probeRoute, updateRoute()]));

    await selectInactiveRule(user);

    expect(await screen.findByText(t.actionReasons.activateDuplicate(1))).toBeInTheDocument();
    expect(
      within(ACTIVATION_PANE()).getByRole('button', { name: t.actions.activate }),
    ).toBeDisabled();
  });

  /**
   * ⭐ **자기 자신은 판정에서 뺀다.** 조준 조회가 자기를 함께 실어 와도 그것 때문에 막히면
   * 한 번 끈 규칙은 영원히 켤 수 없다.
   */
  it('조준 조회가 자기 자신을 실어 와도 켜기가 막히지 않는다', async () => {
    const probeRoute: StubRoute = {
      match: (request) => isGet(request, RULES_PATH) && isProbe(new URL(request.url)),
      respond: () => jsonResponse(listBody([{ ...ruleFixtureAt(9003), isActive: true }])),
    };
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([probeRoute, updateRoute()]));

    await selectInactiveRule(user);

    await waitFor(() => {
      expect(
        within(ACTIVATION_PANE()).getByRole('button', { name: t.actions.activate }),
      ).toBeEnabled();
    });
    expect(screen.queryByText(t.actionReasons.activateDuplicate(1))).not.toBeInTheDocument();
  });

  /** **막지 않되 말한다** — 계약이 같은 조건을 다시 검사하므로 판정 불가로 막지 않는다(C3-9 잣대). */
  it('중복을 판정하지 못하면 안내가 서고 켜기는 열려 있다', async () => {
    const failingProbe: StubRoute = {
      match: (request) => isGet(request, RULES_PATH) && isProbe(new URL(request.url)),
      respond: () => jsonResponse({ message: '' }, { status: 500 }),
    };
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([failingProbe, updateRoute()]));

    await selectInactiveRule(user);

    expect(await screen.findByText(t.notes.activateDuplicateUnknown)).toBeInTheDocument();
    expect(
      within(ACTIVATION_PANE()).getByRole('button', { name: t.actions.activate }),
    ).toBeEnabled();
  });

  /**
   * ⭐ **네 축을 서버 값으로 겨눈다** — 전환은 폼을 저장하지 않으므로 켜지는 것은 고치던 값이
   * 아니라 **지금 서버에 있는 규칙**이다.
   *
   * 폼에서 우선순위를 고쳐 두고 판정을 본다: 폼 값으로 겨누면 **저장하지도 않은 조합**의
   * 중복을 물어 막힘이 풀리고, 사용자는 켤 수 있다고 믿은 채 서버 400을 받는다.
   */
  it('폼에서 우선순위를 고쳐도 켜기 판정은 서버 값으로 한다', async () => {
    const clash = { ...ruleFixtureAt(9003), putawayRuleId: 9006, isActive: true };
    const probeRoute: StubRoute = {
      match: (request) => isGet(request, RULES_PATH) && isProbe(new URL(request.url)),
      respond: () => jsonResponse(listBody([clash])),
    };
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([probeRoute, updateRoute()]));

    await selectInactiveRule(user);
    await screen.findByText(t.actionReasons.activateDuplicate(1));

    /* 폼의 우선순위만 바꾼다 — 저장하지 않았으므로 서버의 규칙은 그대로 200이다. */
    const priorityField = within(formPane()).getByLabelText(t.fields.priorityNo);

    await user.clear(priorityField);
    await user.type(priorityField, '777');

    expect(screen.getByText(t.actionReasons.activateDuplicate(1))).toBeInTheDocument();
    expect(
      within(ACTIVATION_PANE()).getByRole('button', { name: t.actions.activate }),
    ).toBeDisabled();
  });

  /** 끄기 갈래에는 그 안내가 서지 않는다 — 켜기의 판정을 끄기 자리에서 말하면 사실이 어긋난다. */
  it('켜진 규칙에는 켜기 판정 안내가 서지 않는다', async () => {
    const failingProbe: StubRoute = {
      match: (request) => isGet(request, RULES_PATH) && isProbe(new URL(request.url)),
      respond: () => jsonResponse({ message: '' }, { status: 500 }),
    };
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([failingProbe, updateRoute()]));

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();

    expect(
      within(ACTIVATION_PANE()).getByRole('button', { name: messages.common.deactivate }),
    ).toBeEnabled();
    expect(screen.queryByText(t.notes.activateDuplicateUnknown)).not.toBeInTheDocument();
  });
});

describe('PutawayRuleScreen — 전환의 헤더 규약 (C4-6)', () => {
  /**
   * ⭐ **C4-6 · 위험 R2.** 잠금 토큰의 출처가 **상세 경로 하나**임을 값으로 견준다 —
   * 액션 경로에서 꺼내면 언제나 비어 있어 훅이 **요청을 보내지 않고 멈춘다**(눌러도 아무 일이 없다).
   */
  it('끄기 요청에 멱등 키와 상세 응답의 잠금 토큰이 실린다', async () => {
    const { requests, user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([activationRoute('deactivate')]),
    );

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.click(
      within(ACTIVATION_PANE()).getByRole('button', { name: messages.common.deactivate }),
    );
    await user.click(
      within(activationDialog()).getByRole('button', { name: messages.common.deactivate }),
    );

    await waitFor(() => {
      expect(activationRequests(requests, 'deactivate')).toHaveLength(1);
    });

    const sent = activationRequests(requests, 'deactivate')[0];

    expect(sent?.headers.get('If-Match')).toBe(DETAIL_ETAG);
    expect(sent?.headers.get('Idempotency-Key')).not.toBeNull();
  });

  it('켜기 요청에도 같은 두 헤더가 실린다', async () => {
    const { requests, user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([activationRoute('activate')]),
    );

    await selectInactiveRule(user);
    await user.click(within(ACTIVATION_PANE()).getByRole('button', { name: t.actions.activate }));
    await user.click(within(activationDialog()).getByRole('button', { name: t.actions.activate }));

    await waitFor(() => {
      expect(activationRequests(requests, 'activate')).toHaveLength(1);
    });

    const sent = activationRequests(requests, 'activate')[0];

    expect(sent?.headers.get('If-Match')).toBe(DETAIL_ETAG);
    expect(sent?.headers.get('Idempotency-Key')).not.toBeNull();
  });

  /** 본문을 실으면 계약이 받지 않는다 — 두 오퍼레이션에 요청 본문이 아예 없다. */
  it('전환 요청에 본문을 싣지 않는다', async () => {
    const { requests, user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([activationRoute('deactivate')]),
    );

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.click(
      within(ACTIVATION_PANE()).getByRole('button', { name: messages.common.deactivate }),
    );
    await user.click(
      within(activationDialog()).getByRole('button', { name: messages.common.deactivate }),
    );

    await waitFor(() => {
      expect(activationRequests(requests, 'deactivate')).toHaveLength(1);
    });

    expect(await activationRequests(requests, 'deactivate')[0]?.text()).toBe('');
  });
});

describe('PutawayRuleScreen — 전환의 성공과 실패 (C4-7 · C4-8)', () => {
  /**
   * ⭐ **C4-8.** 성공 뒤 목록이 다시 서고 그 행의 사용 표식이 바뀐다. 무효화를 빠뜨리면
   * 화면은 끈 규칙을 「사용 중」으로 계속 보이고, 다음 저장은 낡은 토큰으로 조용히 409다.
   */
  it('끄기가 성공하면 목록의 사용 표식이 바뀐다', async () => {
    let deactivated = false;
    const versionedList: StubRoute = {
      match: (request) => isGet(request, RULES_PATH) && !isProbe(new URL(request.url)),
      respond: () =>
        jsonResponse(
          listBody(
            deactivated
              ? ruleFixtures.map((rule) =>
                  rule.putawayRuleId === 9001 ? { ...rule, isActive: false } : rule,
                )
              : ruleFixtures,
          ),
        ),
    };
    const { user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([
        versionedList,
        activationRoute('deactivate', () => {
          deactivated = true;

          return jsonResponse({ ...ruleFixtureAt(9001), isActive: false });
        }),
      ]),
    );

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();

    // 선행 단언 — 끄기 전에는 사용 안 함 행이 하나(9003)뿐이다.
    expect(screen.getAllByText(t.values.inactive)).toHaveLength(1);

    await user.click(
      within(ACTIVATION_PANE()).getByRole('button', { name: messages.common.deactivate }),
    );
    await user.click(
      within(activationDialog()).getByRole('button', { name: messages.common.deactivate }),
    );

    expect(await screen.findByText(t.toast.deactivated)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText(t.values.inactive)).toHaveLength(2);
    });
  });

  /** 성공하면 창이 닫힌다 — 열린 채 두면 무엇이 끝났는지 알 수 없다. */
  it('성공하면 확인 창이 닫힌다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([activationRoute('deactivate')]));

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.click(
      within(ACTIVATION_PANE()).getByRole('button', { name: messages.common.deactivate }),
    );
    await user.click(
      within(activationDialog()).getByRole('button', { name: messages.common.deactivate }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  /**
   * ⭐ **C4-7.** 실패에서 **창을 닫지 않는다** — 닫으면 사용자는 무엇이 막았는지 모른 채
   * 같은 버튼을 다시 누른다. 켜기의 400은 서버가 밝힌 활성 중복이며 그 문구를 그대로 낸다.
   */
  it('켜기가 400으로 거절되면 창이 열린 채 이유가 선다', async () => {
    const { user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([
        activationRoute('activate', () =>
          jsonResponse(
            { errors: [{ scope: 'screen', code: 'DUPLICATE', message: '합성 중복 거절' }] },
            { status: 400 },
          ),
        ),
      ]),
    );

    await selectInactiveRule(user);
    await user.click(within(ACTIVATION_PANE()).getByRole('button', { name: t.actions.activate }));
    await user.click(within(activationDialog()).getByRole('button', { name: t.actions.activate }));

    expect(await screen.findByText('합성 중복 거절')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  /** 409에는 「최신 불러오기」를 함께 낸다 — 이 쓰기에는 잠글 대상이 있다. */
  it('409에서 최신 불러오기가 서고 누르면 상세를 다시 부른다', async () => {
    const { urls, user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([
        activationRoute('deactivate', () =>
          jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 }),
        ),
      ]),
    );

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.click(
      within(ACTIVATION_PANE()).getByRole('button', { name: messages.common.deactivate }),
    );
    await user.click(
      within(activationDialog()).getByRole('button', { name: messages.common.deactivate }),
    );

    await screen.findByText(messages.conflict.user);

    const before = countOf(urls, detailPathOf(9001));

    await user.click(screen.getByRole('button', { name: messages.conflict.reloadAction }));

    await waitFor(() => {
      expect(countOf(urls, detailPathOf(9001))).toBeGreaterThan(before);
    });
  });
});

describe('PutawayRuleScreen — 응답을 받지 못한 요청 (C4-A)', () => {
  const offline = (): Response => {
    throw new Error('합성 네트워크 단절');
  };

  /**
   * ⭐ **응답이 오지 않은 요청은 「실패」가 아니다**(공유계약 C-1 · 멱등 완화 마지막 층).
   *
   * 끄기가 서버에 닿았다면 그 순간부터 현장의 적치 검증이 달라져 있다. 「실패했습니다」로
   * 접으면 사용자는 **끄지 못했다고 믿은 채** 검증 없이 도는 현장을 그대로 둔다. 그리고
   * 쓰기 훅은 호출마다 **새 멱등 키**를 만들어 그대로 다시 누르면 서버에는 다른 요청이다.
   */
  it('전환이 응답 없이 끝나면 확인 창이 두 절 안내를 낸다', async () => {
    const { user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([activationRoute('deactivate', offline)]),
    );

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.click(
      within(ACTIVATION_PANE()).getByRole('button', { name: messages.common.deactivate }),
    );
    await user.click(
      within(activationDialog()).getByRole('button', { name: messages.common.deactivate }),
    );

    expect(
      await within(activationDialog()).findByText(t.notes.activationUnconfirmed),
    ).toBeInTheDocument();
  });

  /** **서버가 거절한 요청은 전달된 것이 확실하다** — 그 자리에 「모른다」를 붙이면 사실을 흐린다. */
  it('서버가 거절한 전환에는 그 안내를 붙이지 않는다', async () => {
    const { user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([
        activationRoute('deactivate', () =>
          jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 }),
        ),
      ]),
    );

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.click(
      within(ACTIVATION_PANE()).getByRole('button', { name: messages.common.deactivate }),
    );
    await user.click(
      within(activationDialog()).getByRole('button', { name: messages.common.deactivate }),
    );

    await screen.findByText(messages.conflict.user);

    expect(screen.queryByText(t.notes.activationUnconfirmed)).not.toBeInTheDocument();
  });

  /** 저장 축에도 같은 갈래가 있다 — 등록·수정 역시 응답 없이 끝날 수 있다. */
  it('저장이 응답 없이 끝나면 폼이 두 절 안내를 낸다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([updateRoute(offline)]));

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.clear(capacityField());
    await user.type(capacityField(), '600');
    await user.click(saveButton());

    expect(await within(formPane()).findByText(t.notes.networkUnconfirmed)).toBeInTheDocument();
  });

  it('서버가 거절한 저장에는 그 안내를 붙이지 않는다', async () => {
    const { user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([
        updateRoute(() => jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 })),
      ]),
    );

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.clear(capacityField());
    await user.type(capacityField(), '600');
    await user.click(saveButton());

    await screen.findByText(messages.conflict.user);

    expect(screen.queryByText(t.notes.networkUnconfirmed)).not.toBeInTheDocument();
  });

  /**
   * ⭐ **문면의 두 절을 잣대로 고정한다**(전례 W-01-12 전기 축과 같은 형태).
   *
   * ① **확인하지 않은 사실을 단언하지 않는다** — 「알 수 없습니다」 ·
   * ② **재시도를 권하지 않는다** — 「…하지 마세요」 · ③ **확인할 자리를 가리킨다** — 「다시 조회」.
   *
   * ⚠ **금지가 확인보다 앞선다.** 확인 뒤로 미루면 확인에 실패한 사용자가 그대로 다시 보낸다.
   */
  it.each([
    ['전환 축', t.notes.activationUnconfirmed, '다시 누르지 마세요'],
    ['저장 축', t.notes.networkUnconfirmed, '다시 저장하지 마세요'],
  ])('%s 안내가 사실 → 금지 → 확인 자리 차례로 적혀 있다', (_axis, note, ban) => {
    expect(note).toContain('알 수 없습니다');
    expect(note).toContain(ban);
    expect(note).toContain(t.actions.reload);

    const factAt = note.indexOf('알 수 없습니다');
    const banAt = note.indexOf(ban);
    const placeAt = note.indexOf(t.actions.reload);

    expect(factAt).toBeLessThan(banAt);
    expect(banAt).toBeLessThan(placeAt);
  });
});

describe('PutawayRuleScreen — 전환이 나가는 중 (G-30)', () => {
  const startDeactivate = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.click(
      within(ACTIVATION_PANE()).getByRole('button', { name: messages.common.deactivate }),
    );
    await user.click(
      within(activationDialog()).getByRole('button', { name: messages.common.deactivate }),
    );
  };

  /**
   * **막을 것은 전역**(G-30). 전환이 나가는 중에 다른 규칙으로 옮기면 앞 요청의 결과가
   * 지금 보는 맥락에 나타난다.
   *
   * ⛔ **음성 단언을 함께 둔다** — 초안 파기 창이 **대신 막아 주는 길**을 닫지 않으면
   * 잠금을 통째로 빼도 이 시험이 통과한다(뮤테이션 M8이 드러낸 형태).
   */
  it('전환이 나가는 중에는 다른 규칙으로 옮겨 가는 길이 잠긴다', async () => {
    const { requests, urls, user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([activationRoute('deactivate')]),
      holdDeactivate,
    );

    await startDeactivate(user);
    await waitFor(() => {
      expect(activationRequests(requests, 'deactivate')).toHaveLength(1);
    });

    const before = countOf(urls, detailPathOf(9003));

    await selectRow(user, ITEM_LABEL, INACTIVE_LOCATION_LABEL);

    expect(currentLocation()).toContain('rule=9001');
    expect(countOf(urls, detailPathOf(9003))).toBe(before);
    expect(screen.queryByText(t.dialog.discardTitle)).not.toBeInTheDocument();
  });

  it('전환이 나가는 중에는 규칙 추가와 쪽 이동도 잠긴다', async () => {
    const { requests, user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([activationRoute('deactivate'), route(RULES_PATH, ruleFixtures, { total: 45 })]),
      holdDeactivate,
    );

    await startDeactivate(user);
    await waitFor(() => {
      expect(activationRequests(requests, 'deactivate')).toHaveLength(1);
    });

    expect(createButton()).toBeDisabled();

    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    expect(currentLocation()).not.toContain('page=2');
  });

  /**
   * ⭐ **가릴 것은 대상에만.** 전환이 나가는 중이라고 **폼의 저장 자리가 「저장 중」이 되면
   * 안 된다** — 사용자가 손대지도 않은 저장을 화면이 진행 중이라고 말하는 것이다.
   * 잠금(`isLocked`) 한 축으로 진행 표시를 재면 정확히 이 결함이 생긴다.
   */
  it('전환이 나가는 중에도 폼의 저장은 진행 표시가 아니라 잠금 사유로 선다', async () => {
    const { requests, user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([activationRoute('deactivate')]),
      holdDeactivate,
    );

    await startDeactivate(user);
    await waitFor(() => {
      expect(activationRequests(requests, 'deactivate')).toHaveLength(1);
    });

    /* 폼은 「남의 요청을 기다린다」고 말한다 — 진행 표시가 돌면 이 사유가 아예 서지 않는다. */
    expect(within(formPane()).getByText(t.actionReasons.saveLockedByOtherSave)).toBeInTheDocument();
    expect(
      within(formPane()).getByRole('button', { name: messages.common.save }),
    ).not.toHaveAttribute('aria-busy', 'true');

    /* 짝 방향 — 진행 표시는 **전환 자리에** 돈다. 없으면 「아무 데도 안 돈다」와 구별되지 않는다. */
    expect(
      within(ACTIVATION_PANE()).getByRole('button', { name: messages.common.deactivate }),
    ).toHaveAttribute('aria-busy', 'true');
  });

  /**
   * ⭐ **전환 진행 표시의 대상 매임**(G-30 「가릴 것은 대상에만」 · 위 시험의 **전환 축 거울**).
   *
   * 바로 위 시험은 「전환이 도는 동안 폼이 조용한가」를 재는데, 그것은 **폼 축**의 매임이다.
   * 전환 축은 그 셈에 들지 않는다 — 대상이 바뀌면 확인 창은 정리 effect가 닫으므로 창 쪽
   * 단언이 아무것도 재지 않고, 실패 매임 시험은 **배너와 잠금 해제**만 본다.
   *
   * 매임이 없으면 9001의 전환이 나가는 중에 주소로 9003으로 옮겼을 때 **손댄 적 없는 9003의
   * 손잡이가 「전환 중」으로 돈다.** 게다가 진행 표시는 잠금보다 **앞**에 보므로 그 갈래에서는
   * 잠금 사유마저 사라진다.
   */
  it('전환이 나가는 중 다른 규칙으로 주소가 바뀌어도 새 대상이 「전환 중」이라 말하지 않는다', async () => {
    const { requests, user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([activationRoute('deactivate')]),
      holdDeactivate,
      '?wh=9201&rule=9003',
    );

    await startDeactivate(user);
    await waitFor(() => {
      expect(activationRequests(requests, 'deactivate')).toHaveLength(1);
    });

    /* 화면 바깥에서 다른 규칙(9003 — 꺼져 있다)으로 옮긴다. */
    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitFor(() => {
      expect(currentLocation()).toContain('rule=9003');
    });

    const button = await waitFor(() =>
      within(ACTIVATION_PANE()).getByRole('button', { name: t.actions.activate }),
    );

    expect(button).not.toHaveAttribute('aria-busy', 'true');
    expect(
      within(ACTIVATION_PANE()).getByText(t.actionReasons.activationLockedByOtherSave),
    ).toBeInTheDocument();
  });

  /**
   * ⭐ **C4-5 · Escape는 막을 수 없다.** native `<dialog>`가 `cancel`을 내고 디자인 시스템이
   * 그것을 닫기 요청으로 무조건 잇는다 — 주소를 건드리지 않고도 창에서 나갈 수 있다.
   *
   * 그러므로 규율은 「닫히지 않게」가 아니라 **「닫혀도 무너지지 않게」**다. 창을 닫는 길이
   * 나가는 중인 요청의 옵저버를 떼면 무효화·성공·잠금이 함께 사라진다.
   */
  it('창을 닫아도 전환의 되먹임이 끊기지 않는다', async () => {
    const { requests, urls, release, user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([activationRoute('deactivate')]),
      holdDeactivate,
    );

    await startDeactivate(user);
    await waitFor(() => {
      expect(activationRequests(requests, 'deactivate')).toHaveLength(1);
    });

    fireEvent(activationDialog(), new Event('cancel', { bubbles: false, cancelable: true }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    /* ① 공동 잠금이 살아 있다 — 요청은 아직 날아가는 중이다. */
    expect(createButton()).toBeDisabled();

    const beforeDetail = countOf(urls, detailPathOf(9001));

    release();

    /* ② 성공이 사라지지 않는다. ③ 무효화가 살아 있다. */
    expect(await screen.findByText(t.toast.deactivated)).toBeInTheDocument();
    await waitFor(() => {
      expect(countOf(urls, detailPathOf(9001))).toBeGreaterThan(beforeDetail);
    });
  });

  /**
   * **결과는 자기 대상보다 오래 살지 않는다.** 붙잡은 요청을 **대상이 바뀐 뒤에** 풀어
   * 그 시점에만 드러나는 가드를 잰다(`release()` 손잡이 · M9가 드러낸 형태).
   */
  it('대상이 바뀐 뒤 도착한 전환 실패가 새 대상에 서지 않는다', async () => {
    const { requests, release, user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([
        activationRoute('deactivate', () =>
          jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 }),
        ),
      ]),
      holdDeactivate,
      '?wh=9201&rule=9003',
    );

    await startDeactivate(user);
    await waitFor(() => {
      expect(activationRequests(requests, 'deactivate')).toHaveLength(1);
    });

    /* 바깥 길로 옮긴다 — 화면 안의 길은 잠겨 있고, 그 잠금 때문에 이 갈래가 주소로만 열린다. */
    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitFor(() => {
      expect(currentLocation()).toContain('rule=9003');
    });

    release();

    await waitFor(() => {
      expect(createButton()).toBeEnabled();
    });
    expect(screen.queryByText(messages.conflict.user)).not.toBeInTheDocument();
  });
});

describe('PutawayRuleScreen — 확인 창이 열린 사이 상태가 뒤집히면', () => {
  /**
   * **열린 창의 뜻은 열 때 정해지고, 대상의 상태는 그 뒤에도 바뀐다.**
   *
   * 「다시 조회」는 잠기지 않고 다른 사람이 먼저 상태를 바꿀 수도 있다. 그때 확인하면
   * 이미 꺼진 것에 `:deactivate`가 나가고, 사용자는 이유를 알 수 없는 거절을 받는다.
   */
  it('끄기 창이 열린 사이 이미 꺼졌으면 보내지 않고 창을 닫는다', async () => {
    let flipped = false;
    const flippingDetail: StubRoute = {
      match: (request) => request.method === 'GET' && isDetailPath(new URL(request.url).pathname),
      respond: () => {
        const body = flipped ? { ...ruleFixtureAt(9001), isActive: false } : ruleFixtureAt(9001);

        flipped = true;

        return jsonResponse(
          { putawayRule: body, editability: { codeEditable: false, referenceCount: 0 } },
          { headers: { ETag: DETAIL_ETAG } },
        );
      },
    };
    const { requests, user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([flippingDetail, activationRoute('deactivate')]),
    );

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.click(
      within(ACTIVATION_PANE()).getByRole('button', { name: messages.common.deactivate }),
    );

    /* 창이 열린 채 상세가 다시 온다 — 그 사이 다른 사람이 이미 껐다. */
    await user.click(screen.getByRole('button', { name: t.actions.reload }));
    await within(ACTIVATION_PANE()).findByRole('button', { name: t.actions.activate });

    await user.click(
      within(activationDialog()).getByRole('button', { name: messages.common.deactivate }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(activationRequests(requests, 'deactivate')).toHaveLength(0);
  });

  /** 짝 방향 — 상태가 그대로면 확인이 그대로 나간다. 안 그러면 「아무것도 안 보낸다」와 같아진다. */
  it('상태가 그대로면 확인이 요청을 보낸다', async () => {
    const { requests, user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([activationRoute('deactivate')]),
    );

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.click(
      within(ACTIVATION_PANE()).getByRole('button', { name: messages.common.deactivate }),
    );
    await user.click(
      within(activationDialog()).getByRole('button', { name: messages.common.deactivate }),
    );

    await waitFor(() => {
      expect(activationRequests(requests, 'deactivate')).toHaveLength(1);
    });
  });
});

/**
 * ⭐ **거두는 것은 초안만이 아니다.**
 *
 * 창·인라인 오류·쓰기 실패는 `resetEditing`이 **편집 대상에 매여** 거둔다(클릭 핸들러가 아니다
 * — 뒤로가기·주소 직접 편집·사이드바는 핸들러를 지나지 않는다). 그 매임이 끊기면 규칙 A에서
 * 연 「사용 중지」 창이 **규칙 B 위에 그대로 남는다** — 그 규칙은 이미 꺼져 있어 낼 수도 없는
 * 조작이고, 그대로 확인을 누르면 확인 창이 말한 것과 다른 일이 일어난다.
 */
describe('PutawayRuleScreen — 주소로 대상이 바뀌면', () => {
  it('열려 있던 확인 창이 함께 걷힌다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes(), undefined, '?wh=9201&rule=9003');

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.click(
      within(ACTIVATION_PANE()).getByRole('button', { name: messages.common.deactivate }),
    );

    /* 짝 양성 — 창이 실제로 열렸다. */
    expect(within(activationDialog()).getByText(t.dialog.deactivateReversible)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    /* 짝 양성 — 새 대상이 실제로 섰다(9003은 꺼져 있어 손잡이가 반대 이름이다). */
    expect(
      await within(ACTIVATION_PANE()).findByRole('button', { name: t.actions.activate }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

/**
 * ⭐ **실패는 창이 닫혀도 갈 곳이 있어야 한다** — 확인 창 안에만 배너를 두면 잃는 갈래.
 *
 * Escape는 막을 수 없고(native `<dialog>`의 `cancel`) **전송 중에도 창이 닫힌다.** 그때 도착한
 * 실패가 화면 어디에도 서지 않으면 성공 토스트도 없고 목록 표식도 그대로라 사용자에게는
 * 「아무 일도 없었다」로 읽히는데, 그 다음 조작이 정확히 금지된 조작이다 — 같은 버튼을 다시
 * 누르면 쓰기 훅이 **새 멱등 키**를 만들어 이중 전송이 열린다.
 */
describe('PutawayRuleScreen — 창이 닫힌 뒤 도착한 전환 실패 (C4-5 실패 축)', () => {
  const offline = (): Response => {
    throw new Error('합성 네트워크 단절');
  };

  const holdDeactivate = (request: Request): boolean =>
    request.method === 'POST' && isActionPath(new URL(request.url).pathname, 'deactivate');

  const startAndEscape = async (
    user: ReturnType<typeof userEvent.setup>,
    requests: Request[],
  ): Promise<void> => {
    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.click(
      within(ACTIVATION_PANE()).getByRole('button', { name: messages.common.deactivate }),
    );
    await user.click(
      within(activationDialog()).getByRole('button', { name: messages.common.deactivate }),
    );
    await waitFor(() => {
      expect(activationRequests(requests, 'deactivate')).toHaveLength(1);
    });

    fireEvent(activationDialog(), new Event('cancel', { bubbles: false, cancelable: true }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  };

  it('전송 중 창을 닫아도 그 뒤 도착한 응답 없음 안내가 전환 구획에 선다', async () => {
    const { requests, release, user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([activationRoute('deactivate', offline)]),
      holdDeactivate,
    );

    await startAndEscape(user, requests);

    release();

    expect(
      await within(ACTIVATION_PANE()).findByText(t.notes.activationUnconfirmed),
    ).toBeInTheDocument();
  });

  /** **서버가 거절한 요청은 전달된 것이 확실하다** — 창 밖 자리에서도 그 안내를 붙이지 않는다. */
  it('창을 닫은 뒤 도착한 서버 거절에는 그 안내가 붙지 않는다', async () => {
    const { requests, release, user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([
        activationRoute('deactivate', () =>
          jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 }),
        ),
      ]),
      holdDeactivate,
    );

    await startAndEscape(user, requests);

    release();

    // 선행 단언 — 거절 사유 자체는 창 밖에 선다(안 그러면 아래 음성이 「아무것도 없다」와 같아진다).
    expect(await within(ACTIVATION_PANE()).findByText(messages.conflict.user)).toBeInTheDocument();
    expect(screen.queryByText(t.notes.activationUnconfirmed)).not.toBeInTheDocument();
  });

  /**
   * ⭐ **자리는 배타다.** 같은 사유가 창과 구획에 겹쳐 서면 사용자가 두 사건으로 읽는다 —
   * 창의 유무가 자리를 가른다.
   */
  it('창이 열려 있는 동안에는 같은 사유가 구획에 겹쳐 서지 않는다', async () => {
    const { user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([
        activationRoute('deactivate', () =>
          jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 }),
        ),
      ]),
    );

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.click(
      within(ACTIVATION_PANE()).getByRole('button', { name: messages.common.deactivate }),
    );
    await user.click(
      within(activationDialog()).getByRole('button', { name: messages.common.deactivate }),
    );

    expect(await within(activationDialog()).findByText(messages.conflict.user)).toBeInTheDocument();
    expect(within(ACTIVATION_PANE()).queryByText(messages.conflict.user)).not.toBeInTheDocument();
  });

  /**
   * ⭐ **다시 열 때 걷지 않는다.** 걷으면 **안내가 막으려던 이중 전송이 안내 없이 열린다** —
   * 그 문장은 「같은 버튼을 바로 다시 누르지 마세요」이고, 다시 누르는 순간이 그 문장을 읽어야
   * 할 바로 그 순간이다.
   */
  it('손잡이를 다시 눌러 창을 열면 그 안내가 사라지지 않고 창으로 옮겨 온다', async () => {
    const { requests, release, user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([activationRoute('deactivate', offline)]),
      holdDeactivate,
    );

    await startAndEscape(user, requests);
    release();
    await within(ACTIVATION_PANE()).findByText(t.notes.activationUnconfirmed);

    await user.click(
      within(ACTIVATION_PANE()).getByRole('button', { name: messages.common.deactivate }),
    );

    expect(within(activationDialog()).getByText(t.notes.activationUnconfirmed)).toBeInTheDocument();
    /* 배타 — 창으로 옮겨 왔으므로 구획에는 더 이상 서지 않는다. */
    expect(
      within(ACTIVATION_PANE()).queryByText(t.notes.activationUnconfirmed),
    ).not.toBeInTheDocument();
  });
});

/**
 * ⭐ **C5-A — 앞선 안내는 「그 갈래」의 것이다.**
 *
 * 창을 열 때 앞선 실패를 걷지 않는 규율(위 describe)은 **같은 손잡이를 다시 누르는** 갈래를
 * 지키려고 세웠다. 그런데 안내를 읽은 사용자가 시키는 대로 「다시 조회」를 눌러 **상태가
 * 뒤집혔음이 확인되면** 그 문장은 두 군데서 거짓이 된다 — 「바뀌었는지 **알 수 없습니다**」
 * (방금 알았다) · 「**같은 버튼**을 바로 다시 누르지 마세요」(지금 누른 것은 반대 버튼이다).
 *
 * 그래서 **갈래가 뒤집힌 때만** 걷는다. 가르는 값은 이미 있는 `sentIntentRef`이며, 이 짝이
 * 그 값의 두 번째 쓸모를 재는 자리다.
 */
describe('PutawayRuleScreen — 응답 없음 안내와 갈래 뒤집힘 (C5-A)', () => {
  const holdDeactivate = (request: Request): boolean =>
    request.method === 'POST' && isActionPath(new URL(request.url).pathname, 'deactivate');

  /**
   * 응답이 오지 않는 끄기. **서버에 닿았는지가 갈래를 가른다** — 닿았으면 다음 「다시 조회」가
   * 뒤집힌 상태를 보고, 닿지 않았으면 같은 상태를 본다. 화면은 어느 쪽인지 모르며, 그 모름이
   * 바로 안내가 말하는 사실이다.
   */
  const unansweredDeactivate = (server: { isActive: boolean }, arrived: boolean): StubRoute =>
    activationRoute('deactivate', () => {
      if (arrived) server.isActive = false;

      throw new Error('합성 네트워크 단절');
    });

  /** 서버의 지금 사실을 그대로 내려 주는 상세. 「다시 조회」가 무엇을 보는지가 여기서 정해진다. */
  const serverDetailRoute = (server: { isActive: boolean }): StubRoute => ({
    match: (request) => request.method === 'GET' && isDetailPath(new URL(request.url).pathname),
    respond: (request) =>
      jsonResponse(
        {
          putawayRule: {
            ...ruleFixtureAt(ruleIdOf(new URL(request.url))),
            isActive: server.isActive,
          },
          editability: { codeEditable: false, reason: 'REFERENCED', referenceCount: 2 },
        },
        { headers: { ETag: DETAIL_ETAG } },
      ),
  });

  /** 끄기를 보내고 창을 닫은 뒤 **응답 없음 안내가 전환 구획에 선 상태**까지 간다. */
  const arriveUnconfirmed = async (
    user: ReturnType<typeof userEvent.setup>,
    requests: Request[],
    release: () => void,
  ): Promise<void> => {
    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.click(
      within(ACTIVATION_PANE()).getByRole('button', { name: messages.common.deactivate }),
    );
    await user.click(
      within(activationDialog()).getByRole('button', { name: messages.common.deactivate }),
    );
    await waitFor(() => {
      expect(activationRequests(requests, 'deactivate')).toHaveLength(1);
    });

    fireEvent(activationDialog(), new Event('cancel', { bubbles: false, cancelable: true }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    release();
    await within(ACTIVATION_PANE()).findByText(t.notes.activationUnconfirmed);
  };

  it('다시 조회로 갈래가 뒤집히면 반대 손잡이의 창에 앞선 안내가 실리지 않는다', async () => {
    const server = { isActive: true };
    const { requests, release, user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([unansweredDeactivate(server, true), serverDetailRoute(server)]),
      holdDeactivate,
    );

    await arriveUnconfirmed(user, requests, release);
    await user.click(screen.getByRole('button', { name: t.actions.reload }));

    /* 짝 양성 — 「다시 조회」가 뒤집힌 사실을 실제로 물어 왔다(손잡이 이름이 반대가 됐다). */
    const activateButton = await within(ACTIVATION_PANE()).findByRole('button', {
      name: t.actions.activate,
    });

    await user.click(activateButton);

    /* 짝 양성 — 창은 실제로 열렸고 켜기 갈래다. 없으면 아래 음성이 「창이 없다」와 같아진다. */
    expect(within(activationDialog()).getByText(t.dialog.activateApplies)).toBeInTheDocument();

    expect(
      within(activationDialog()).queryByText(t.notes.activationUnconfirmed),
    ).not.toBeInTheDocument();
    /* 걷혔다면 구획에도 남지 않는다 — 창으로 옮겨 간 것과 구별한다. */
    expect(
      within(ACTIVATION_PANE()).queryByText(t.notes.activationUnconfirmed),
    ).not.toBeInTheDocument();
    /*
     * ⭐ **배너는 창으로 옮겨 온다** — 구획과 같은 규칙이다(참인 사실은 걷지 않는다).
     * 창을 열며 통째로 걷으면 여기서 운다.
     */
    expect(within(activationDialog()).getByText(messages.httpError.offline)).toBeInTheDocument();
  });

  /**
   * ⭐ **창을 열기 전 — 구획 표면에서도 걷힌다.**
   *
   * 창을 열 때만 걷는 것은 **절반이다.** 안내를 읽고 시키는 대로 「다시 조회」를 누른 사용자는
   * 창을 열기 **전에** 그 구획을 본다. 그 순간 손잡이는 이미 「다시 사용」인데 바로 옆에
   * 「바뀌었는지 **알 수 없습니다** — 같은 버튼을 다시 누르지 마세요」가 서 있으면, 한 화면이
   * **서로 어긋나는 두 사실**을 함께 말한다.
   *
   * ⛔ **걷는 것은 「모른다」는 진술뿐이다.** 배너의 「응답을 받지 못했다」는 여전히 참이므로
   * 남는다 — 그것까지 걷으면 실패가 통째로 사라져 사용자는 아무 일도 없었다고 읽는다.
   */
  it('다시 조회로 갈래가 뒤집히면 구획의 안내도 걷히고 배너는 남는다', async () => {
    const server = { isActive: true };
    const { requests, release, user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([unansweredDeactivate(server, true), serverDetailRoute(server)]),
      holdDeactivate,
    );

    await arriveUnconfirmed(user, requests, release);
    await user.click(screen.getByRole('button', { name: t.actions.reload }));

    /* 짝 양성 — 뒤집힘이 확인됐다(손잡이 이름이 반대가 됐다). 창은 아직 열지 않았다. */
    await within(ACTIVATION_PANE()).findByRole('button', { name: t.actions.activate });

    expect(
      within(ACTIVATION_PANE()).queryByText(t.notes.activationUnconfirmed),
    ).not.toBeInTheDocument();
    /* 배너는 남는다 — 확인된 사실까지 지우지 않는다. */
    expect(within(ACTIVATION_PANE()).getByText(messages.httpError.offline)).toBeInTheDocument();
  });

  /**
   * **짝 방향 — 갈래가 그대로면 남는다.** 이쪽이 무너지면 걷는 조건이 넓어진 것이고, 그때는
   * 안내가 막으려던 이중 전송이 **안내 없이** 열린다(쓰기 훅은 호출마다 새 멱등 키를 만든다).
   * 두 시험의 다른 점은 **서버에 닿았는가** 하나뿐이다.
   */
  it('다시 조회로도 갈래가 그대로면 같은 손잡이의 창에 안내가 실려 온다', async () => {
    const server = { isActive: true };
    const { requests, release, user } = renderScreen(
      WITH_WAREHOUSE,
      allRoutes([unansweredDeactivate(server, false), serverDetailRoute(server)]),
      holdDeactivate,
    );

    await arriveUnconfirmed(user, requests, release);
    await user.click(screen.getByRole('button', { name: t.actions.reload }));

    /* 짝 양성 — 다시 조회가 돌았고 갈래는 그대로다(손잡이 이름이 바뀌지 않았다). */
    const deactivateButton = await within(ACTIVATION_PANE()).findByRole('button', {
      name: messages.common.deactivate,
    });

    /* 위 시험의 거울 — 확인된 것이 없으므로 **구획에서도** 걷히지 않는다. */
    expect(within(ACTIVATION_PANE()).getByText(t.notes.activationUnconfirmed)).toBeInTheDocument();

    await user.click(deactivateButton);

    expect(within(activationDialog()).getByText(t.notes.activationUnconfirmed)).toBeInTheDocument();
    /* 배타 — 창으로 옮겨 왔으므로 구획에는 더 이상 서지 않는다. */
    expect(
      within(ACTIVATION_PANE()).queryByText(t.notes.activationUnconfirmed),
    ).not.toBeInTheDocument();
  });
});

describe('PutawayRuleScreen — 전환 성공 문면 (m-2)', () => {
  /**
   * ⛔ **전환은 폼을 저장하지 않는다.** 이 화면은 **초안이 더러운 채로도 전환할 수 있어**
   * (전환 손잡이에 「고친 것이 있는가」 문이 없다) 저장 축 문면을 그대로 쓰면 사용자가
   * **고치던 값이 저장된 것으로 읽는다.**
   */
  it('끄기 성공은 「저장했습니다」가 아니라 끈 사실을 말한다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([activationRoute('deactivate')]));

    await waitForRows();
    await selectRow(user);
    await waitForEditForm();
    await user.click(
      within(ACTIVATION_PANE()).getByRole('button', { name: messages.common.deactivate }),
    );
    await user.click(
      within(activationDialog()).getByRole('button', { name: messages.common.deactivate }),
    );

    expect(await screen.findByText(t.toast.deactivated)).toBeInTheDocument();
    expect(screen.queryByText(messages.common.saved)).not.toBeInTheDocument();
  });

  /** 짝 방향 — 켜기는 **다른 문장**이다. 한 문장을 돌려 쓰면 어느 쪽에서든 반쯤 틀린다. */
  it('켜기 성공은 켠 사실을 말한다', async () => {
    const { user } = renderScreen(WITH_WAREHOUSE, allRoutes([activationRoute('activate')]));

    await selectInactiveRule(user);
    await user.click(within(ACTIVATION_PANE()).getByRole('button', { name: t.actions.activate }));
    await user.click(within(activationDialog()).getByRole('button', { name: t.actions.activate }));

    expect(await screen.findByText(t.toast.activated)).toBeInTheDocument();
    expect(screen.queryByText(t.toast.deactivated)).not.toBeInTheDocument();
  });
});
