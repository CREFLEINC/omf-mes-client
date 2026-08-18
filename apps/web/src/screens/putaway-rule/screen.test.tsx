import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import {
  ITEM_LABEL,
  LOCATION_LABEL,
  UOM_LABEL,
  WAREHOUSE_LABEL,
  itemFixtures,
  locationFixtures,
  ruleFixtures,
  uncoveredItemFixtures,
  uomFixtures,
  warehouseFixtures,
} from './fixtures';
import { PutawayRuleScreen } from './screen';

const t = messages.putawayRule;

const RULES_PATH = '/logistics/putaway-rules';
const UNCOVERED_PATH = '/logistics/putaway-rules/uncovered-items';
const WAREHOUSES_PATH = '/mdm/warehouses';
const LOCATIONS_PATH = '/mdm/locations';
const ITEMS_PATH = '/mdm/items';
const UOMS_PATH = '/mdm/uoms';

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
 * 모든 조회를 세울 수 있는 스텁 한 벌.
 *
 * **「부르지 않는다」를 증명하려면 부를 수 있어야 한다.** 스텁을 빼면 하네스가 던져 실패하는데,
 * 그것은 「부르지 않았다」가 아니라 「시험이 준비되지 않았다」를 말한다.
 */
const allRoutes = (overrides: StubRoute[] = []): StubRoute[] => [
  ...overrides,
  route(UNCOVERED_PATH, uncoveredItemFixtures),
  route(RULES_PATH, ruleFixtures),
  route(WAREHOUSES_PATH, warehouseFixtures),
  route(LOCATIONS_PATH, locationFixtures),
  route(ITEMS_PATH, itemFixtures),
  route(UOMS_PATH, uomFixtures),
];

/** 나간 요청을 전부 기록한다. 횟수와 질의값을 셀 자리가 있어야 「부르지 않았다」가 증명된다. */
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

const lastOf = (urls: URL[], pathname: string): URL | undefined =>
  urls.filter((url) => url.pathname === pathname).at(-1);

/** 주소를 읽어 내는 탐침. 조건·쪽·선택이 주소에 실렸는지 잰다. */
const LocationProbe = () => {
  const location = useLocation();

  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

const currentLocation = (): string => screen.getByTestId('location').textContent ?? '';

const renderScreen = (route = '/', routes: StubRoute[] = allRoutes()) => {
  const { fetch, urls } = recordingFetch(routes);
  const result = renderWithProviders(
    <>
      <PutawayRuleScreen />
      <LocationProbe />
    </>,
    { fetch, route },
  );

  return { ...result, urls, user: userEvent.setup() };
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
   * 다시 조회를 눌러도 그 둘은 한 번도 나가지 않아야 한다.
   */
  it('목록도 규칙 없는 품목도 한 번도 부르지 않는다', async () => {
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
    const before = countOf(urls, RULES_PATH);

    await user.click(
      screen.getByRole('button', { name: t.actions.selectRow(ITEM_LABEL, LOCATION_LABEL) }),
    );
    await waitFor(() => {
      expect(currentLocation()).toContain('rule=9001');
    });

    expect(countOf(urls, RULES_PATH)).toBe(before);
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
