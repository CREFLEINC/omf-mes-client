import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
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
  expiredLotDetail,
  heldLotDetail,
  itemFixtures,
  itemViewFixtures,
  locationFixtures,
  locationViewFixtures,
  lotFixtures,
  lotViewFixtures,
  partnerFixtures,
  plainLotDetail,
  uomFixtures,
  warehouseFixtures,
} from './fixtures';
import { StockStatusScreen } from './screen';
import type { LotDetailView } from './types';

const t = messages.stockStatus;

const ROUTE = '/logistics/stock-status';
const BALANCES_PATH = '/inventory/balances';
const WAREHOUSES_PATH = '/mdm/warehouses';
const LOCATIONS_PATH = '/mdm/locations';
const ITEMS_PATH = '/mdm/items';
const LOTS_PATH = '/trace/lots';
const UOMS_PATH = '/mdm/uoms';
const PARTNERS_PATH = '/mdm/partners';
const LOT_DETAIL_PATH = '/trace/lots/9401';

/** 창고가 걸린 주소. 이 화면은 창고 없이는 조회하지 않으므로 대부분의 검사가 여기서 시작한다. */
const WITH_WAREHOUSE = '?wh=9101';

/** LOT별 보기가 열리는 주소. 이 보기는 품목을 고른 뒤에만 열린다(계획 결정 11). */
const LOT_VIEW = '?wh=9101&view=lot&item=9301';

const WAREHOUSE_LABEL = 'SAMPLE-WH-01 · 합성 자재창고 가';
const ITEM_LABEL = 'SAMPLE-ITEM-01 · 합성 품목 가';

interface RecordedRequest {
  method: string;
  url: URL;
}

/** 요청을 기록하면서 스텁 규칙으로 응답한다. 규칙에 없는 요청은 하네스가 던져 스텁 누락을 드러낸다. */
const createRecordingFetch = (
  routes: StubRoute[],
): { fetch: StubFetch; requests: RecordedRequest[] } => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch(routes);

  const fetch: StubFetch = async (request) => {
    requests.push({ method: request.method, url: new URL(request.url) });

    return stub(request);
  };

  return { fetch, requests };
};

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const listBody = (
  items: unknown[],
  page: Partial<{ page: number; size: number; total: number }> = {},
) => ({ items, page: { page: 1, size: 50, total: items.length, ...page } });

/**
 * 잔액 조회. **`groupBy`에 맞는 줄을 돌려준다** — 목 서버는 `groupBy`를 무시하지만(§6.3 실측)
 * 보기 3종의 차이는 여기서 스텁으로 판정한다.
 */
const balanceRoute = (
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, BALANCES_PATH),
  respond: (request) => {
    const groupBy = new URL(request.url).searchParams.get('groupBy');
    const items =
      groupBy === 'LOT'
        ? lotViewFixtures
        : groupBy === 'LOCATION'
          ? locationViewFixtures
          : itemViewFixtures;

    return jsonResponse(listBody(items, page));
  },
});

const fixedBalanceRoute = (
  items: unknown[],
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, BALANCES_PATH),
  respond: () => jsonResponse(listBody(items, page)),
});

const failingBalanceRoute = (status: number, body: unknown = { message: '' }): StubRoute => ({
  match: (request) => isGet(request, BALANCES_PATH),
  respond: () => jsonResponse(body, { status }),
});

/**
 * 참조 목록 응답. **`page`를 인자로 받는다** — 기본값(`total === items.length`)만 쓰면
 * 「잘렸다」 갈래가 영영 만들어지지 않아 그 판정이 통째로 검사되지 않는다.
 */
const lookupRoute = (
  pathname: string,
  items: unknown[],
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse(listBody(items, page)),
});

/** 서버에 더 있는데 앞쪽만 받은 상태. 「잘림」을 만들어 내는 유일한 방법이다. */
const truncatedLookupRoute = (pathname: string, items: unknown[]): StubRoute =>
  lookupRoute(pathname, items, { total: items.length + 1 });

const failingLookupRoute = (pathname: string): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse({ message: '' }, { status: 500 }),
});

/**
 * 참조 목록 여섯. **부를 수 있게 전부 두는 것이 요점이다** —
 * 스텁이 없으면 하네스가 던져 「부르지 않았다」를 증명할 수 없다(M23·C27).
 */
const lookupRoutes = (): StubRoute[] => [
  lookupRoute(WAREHOUSES_PATH, warehouseFixtures),
  lookupRoute(LOCATIONS_PATH, locationFixtures),
  lookupRoute(ITEMS_PATH, itemFixtures),
  lookupRoute(LOTS_PATH, lotFixtures),
  lookupRoute(UOMS_PATH, uomFixtures),
  lookupRoute(PARTNERS_PATH, partnerFixtures),
];

/** 스텁이 응답할 상세 경로. 목록(`/trace/lots`)과 갈라야 한다. */
const isLotDetailPath = (pathname: string): boolean => /^\/trace\/lots\/\d+$/.test(pathname);

/**
 * 상세 경로로 **나간 요청 전부**. 번호 자리가 무엇이든 센다 —
 * `/trace/lots/null` 같은 잘못된 경로도 「부르지 않았다」를 깨뜨리는 요청이다.
 */
const lotDetailRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname.startsWith(`${LOTS_PATH}/`));

/**
 * LOT 상세. **어느 번호로 불러도 응답한다** — 「부르지 않았다」를 증명하려면 부를 수 있는
 * 스텁이 있어야 한다(계획 §12-6). 화면 타입 그대로를 본문으로 준다:
 * 응답 → 화면 타입 변환은 `types.test.ts`가 계약 모양으로 따로 검사한다.
 */
const lotDetailRoute = (detail: LotDetailView): StubRoute => ({
  match: (request) => request.method === 'GET' && isLotDetailPath(new URL(request.url).pathname),
  respond: () => jsonResponse(detail),
});

const failingLotDetailRoute = (status = 500): StubRoute => ({
  match: (request) => request.method === 'GET' && isLotDetailPath(new URL(request.url).pathname),
  respond: () => jsonResponse({ message: '' }, { status }),
});

/** 유효기한 표식은 「오늘」에 매인다 — 화면과 픽스처가 같은 날을 본다. */
const TODAY = new Date();

/** 주소가 실제로 어떻게 바뀌는지 본다 — 수명 표를 판정할 유일한 근거다. */
const LocationProbe = () => {
  const location = useLocation();

  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

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
  routes: StubRoute[],
  search = '',
  navigateTo = '',
): { requests: RecordedRequest[]; user: ReturnType<typeof userEvent.setup> } => {
  const { fetch, requests } = createRecordingFetch(routes);

  renderWithProviders(
    <>
      <StockStatusScreen />
      <LocationProbe />
      <BackProbe />
      <SearchProbe to={navigateTo} />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, user: userEvent.setup() };
};

/**
 * 응답을 붙잡아 두는 렌더. 「조회를 기다리는 동안」과 「참조 목록이 늦게 오는 순서」를
 * 실제로 만들어야 그 사이의 표기를 판정할 수 있다.
 */
const renderScreenHolding = (
  routes: StubRoute[],
  hold: string[],
  search = '',
): { release: () => void; user: ReturnType<typeof userEvent.setup> } => {
  const stub = createStubFetch(routes);
  let release = (): void => {
    /* 아래 Promise 생성자가 곧바로 채운다. */
  };
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const fetch: StubFetch = async (request) => {
    if (hold.includes(new URL(request.url).pathname)) await gate;

    return stub(request);
  };

  renderWithProviders(
    <>
      <StockStatusScreen />
      <LocationProbe />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { release, user: userEvent.setup() };
};

const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

const lastQuery = (requests: RecordedRequest[], pathname: string): URLSearchParams | undefined =>
  requestsTo(requests, pathname).at(-1)?.url.searchParams;

const currentLocation = (): string => screen.getByTestId('location').textContent ?? '';

const balanceTable = (): HTMLElement => screen.getByRole('table');

const headerNames = (): string[] =>
  within(balanceTable())
    .getAllByRole('columnheader')
    .map((cell) => cell.textContent ?? '');

/**
 * 지금 정렬 표시가 켜져 있는 머리글. **`aria-sort`로 본다** — 주소의 `sort` 키만 보면
 * 「주소에는 있는데 표에는 표시되지 않는」 어긋남을 그대로 통과시킨다.
 */
const sortedHeaderNames = (): string[] =>
  within(balanceTable())
    .getAllByRole('columnheader')
    .filter((cell) => {
      const direction = cell.getAttribute('aria-sort');

      return direction !== null && direction !== 'none';
    })
    .map((cell) => cell.textContent ?? '');

describe('StockStatusScreen — 창고를 고르기 전', () => {
  /*
   * **창고 필수는 이 화면의 규칙이지 계약의 규칙이 아니다**(계획 결정 5).
   * 그래도 화면에서는 필수이므로 고르기 전에는 요청이 한 번도 나가지 않는다.
   */
  it('잔액 요청이 0회다', async () => {
    const { requests } = renderScreen([balanceRoute(), ...lookupRoutes()]);

    await screen.findByText(t.empty.notQueriedTitle);

    expect(requestsTo(requests, BALANCES_PATH)).toHaveLength(0);
  });

  /*
   * **조회하지 않은 것을 「없습니다」로 말하지 않는다.** 요청이 나가지 않았는데 결과 없음을 내면
   * 사용자가 자료가 없는 줄 알고 조건을 더 넓힌다 — 무엇을 해도 결과가 같다.
   */
  it('「결과 없음」·「쪽 밖」이 아니라 「아직 조회하지 않았다」를 낸다', async () => {
    renderScreen([balanceRoute(), ...lookupRoutes()]);

    await screen.findByText(t.empty.notQueriedTitle);

    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.beyondLastTitle)).not.toBeInTheDocument();
  });

  it('조회 버튼이 잠기고 사유가 보인다', async () => {
    renderScreen([balanceRoute(), ...lookupRoutes()]);

    await screen.findByText(t.reasons.warehouseRequired);

    expect(screen.getByRole('button', { name: messages.common.search })).toBeDisabled();
  });

  /*
   * **매달린 참조는 조건 전에 부르지 않는다.** 창고 없이 위치를 부르면 계약이 400을 준다
   * (`warehouseId`가 필수다). LOT은 품목과 보기 둘 다 걸려야 열린다.
   */
  it('위치·LOT 참조를 부르지 않는다', async () => {
    const { requests } = renderScreen([balanceRoute(), ...lookupRoutes()]);

    await screen.findByText(t.empty.notQueriedTitle);

    expect(requestsTo(requests, LOCATIONS_PATH)).toHaveLength(0);
    expect(requestsTo(requests, LOTS_PATH)).toHaveLength(0);
    // 선행 단언 — 매달리지 않은 참조는 실제로 불렀다. 「아직 아무것도 안 왔다」와 구분된다.
    expect(requestsTo(requests, WAREHOUSES_PATH)).toHaveLength(1);
    expect(requestsTo(requests, ITEMS_PATH)).toHaveLength(1);
  });

  it('자리표시 조건을 주소에 심지 않는다', async () => {
    renderScreen([balanceRoute(), ...lookupRoutes()]);

    await screen.findByText(t.empty.notQueriedTitle);

    expect(currentLocation()).toBe(ROUTE);
  });
});

describe('StockStatusScreen — 창고를 고른 뒤', () => {
  it('잔액 요청이 1회 나가고 창고가 실린다', async () => {
    const { requests } = renderScreen([balanceRoute(), ...lookupRoutes()], WITH_WAREHOUSE);

    await screen.findByText(ITEM_LABEL);

    const list = requestsTo(requests, BALANCES_PATH);

    expect(list).toHaveLength(1);
    expect(list[0]?.url.searchParams.get('warehouseId')).toBe('9101');
  });

  /* 기본값을 실으면 같은 조회의 요청 URL이 두 가지가 된다. */
  it('기본값(page·size·groupBy·includeZero)을 싣지 않는다', async () => {
    const { requests } = renderScreen([balanceRoute(), ...lookupRoutes()], WITH_WAREHOUSE);

    await screen.findByText(ITEM_LABEL);

    const query = lastQuery(requests, BALANCES_PATH);

    for (const key of ['page', 'size', 'groupBy', 'includeZero']) {
      expect(query?.has(key)).toBe(false);
    }
  });

  it('주소의 조건이 요청 쿼리에 그대로 실린다', async () => {
    const { requests } = renderScreen(
      [balanceRoute(), ...lookupRoutes()],
      '?wh=9101&item=9301&lot=9401&loc=9201&qs=SAMPLE_Q_A&is=SAMPLE_I_A&own=SAMPLE_OWN_A&zero=true',
    );

    await screen.findAllByText(ITEM_LABEL);

    const query = lastQuery(requests, BALANCES_PATH);

    expect(query?.get('warehouseId')).toBe('9101');
    expect(query?.get('itemId')).toBe('9301');
    expect(query?.get('lotId')).toBe('9401');
    expect(query?.get('locationId')).toBe('9201');
    expect(query?.get('qualityStatusCode')).toBe('SAMPLE_Q_A');
    expect(query?.get('inventoryStatusCode')).toBe('SAMPLE_I_A');
    expect(query?.get('ownershipTypeCode')).toBe('SAMPLE_OWN_A');
    expect(query?.get('includeZero')).toBe('true');
  });

  /*
   * 정수가 아닌 번호를 그대로 보내면 조회 전체가 400으로 실패한다.
   * **`0`도 번호가 아니다** — 통과시키면 `itemId=0` 같은 값이 그대로 실린다.
   */
  it('정수가 아닌 번호 조건은 버리고 조회한다', async () => {
    const { requests } = renderScreen(
      [balanceRoute(), ...lookupRoutes()],
      '?wh=9101&item=0&lot=1.5&loc=-3&page=0',
    );

    await screen.findByText(ITEM_LABEL);

    const query = lastQuery(requests, BALANCES_PATH);

    expect(query?.has('itemId')).toBe(false);
    expect(query?.has('lotId')).toBe(false);
    expect(query?.has('locationId')).toBe(false);
    expect(query?.has('page')).toBe(false);
  });

  /* 창고가 없으면 조회 자체가 없다 — 잘못된 주소로 들어와도 요청이 나가지 않는다. */
  it('창고가 정수가 아니면 조회하지 않는다', async () => {
    const { requests } = renderScreen([balanceRoute(), ...lookupRoutes()], '?wh=abc&item=9301');

    await screen.findByText(t.empty.notQueriedTitle);

    expect(requestsTo(requests, BALANCES_PATH)).toHaveLength(0);
  });

  /*
   * **`0`이 창고 필수 세 겹을 뚫던 자리다.** 타입·`enabled`·잠긴 버튼이 막는 것은
   * 「비어 있음」이지 「0」이 아니라, `warehouseId=0` 요청이 실제로 나갔다.
   */
  it('창고가 0이면 조회하지 않는다', async () => {
    const { requests } = renderScreen([balanceRoute(), ...lookupRoutes()], '?wh=0');

    await screen.findByText(t.empty.notQueriedTitle);

    expect(requestsTo(requests, BALANCES_PATH)).toHaveLength(0);
  });

  /* 이 화면은 조회 전용이다 — 계약에 쓰기 경로가 있어도 부르지 않는다. */
  it('쓰기 요청을 하나도 보내지 않는다', async () => {
    const { requests } = renderScreen([balanceRoute(), ...lookupRoutes()], WITH_WAREHOUSE);

    await screen.findByText(ITEM_LABEL);

    expect(requests.every((request) => request.method === 'GET')).toBe(true);
  });

  it('조건 줄에서 조회하면 주소와 요청에 함께 나타난다', async () => {
    const { requests, user } = renderScreen([balanceRoute(), ...lookupRoutes()], WITH_WAREHOUSE);

    await screen.findByText(ITEM_LABEL);

    await user.click(screen.getByLabelText(t.fields.item));
    await user.click(screen.getByRole('option', { name: ITEM_LABEL }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(requestsTo(requests, BALANCES_PATH)).toHaveLength(2);
    });

    expect(currentLocation()).toContain('item=9301');
    expect(lastQuery(requests, BALANCES_PATH)?.get('itemId')).toBe('9301');
  });

  /*
   * **조작 한 번에 주소 갱신도 한 번이다.** 조건과 쪽을 따로 갱신하면 뒤로가기 기록이 두 칸 늘어
   * 사용자가 뒤로 눌렀는데 같은 자리로 돌아온 것처럼 보인다.
   */
  it('조회 한 번에 히스토리가 한 칸만 늘어난다', async () => {
    const { user } = renderScreen(
      [balanceRoute({ total: 120 }), ...lookupRoutes()],
      `${WITH_WAREHOUSE}&page=2`,
    );

    await screen.findAllByText(ITEM_LABEL);

    await user.click(screen.getByLabelText(t.fields.item));
    await user.click(screen.getByRole('option', { name: ITEM_LABEL }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(currentLocation()).toContain('item=9301');
    });

    // 한 칸만 늘었으면 뒤로 한 번에 처음 주소로 돌아온다.
    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}${WITH_WAREHOUSE}&page=2`);
    });
  });

  /*
   * 창고까지 비운다 — 남기면 「초기화했는데 조회가 열려 있다」가 되어 상태가 어중간해진다.
   *
   * **정렬도 함께 없앤다**(수명 표 3행 — 검증 1회차 F2 정정). 초기화는 첫 진입과 같은 상태로
   * 되돌리는 것인데, 보기 기본 열을 주소에 써 넣으면 첫 진입으로는 만들 수 없는 상태가 생기고
   * **요청이 0회인 표**에 「정렬됨」이 보조기술로 읽힌다.
   */
  it('초기화가 창고·정렬까지 비우고 그 뒤 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(
      [balanceRoute(), ...lookupRoutes()],
      `${WITH_WAREHOUSE}&item=9301&zero=true&sort=onHandQty`,
    );

    await screen.findAllByText(ITEM_LABEL);

    // 선행 단언 — 초기화 전에는 그 열이 실제로 정렬 표시를 갖는다.
    expect(sortedHeaderNames()).toEqual([t.table.onHandQty]);

    const before = requestsTo(requests, BALANCES_PATH).length;

    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(screen.getByText(t.empty.notQueriedTitle)).toBeInTheDocument();
    });

    for (const key of ['wh=', 'item=', 'zero=', 'sort=']) {
      expect(currentLocation()).not.toContain(key);
    }

    // 조회가 0회인 표가 「정렬됨」을 말하지 않는다.
    expect(sortedHeaderNames()).toEqual([]);
    expect(requestsTo(requests, BALANCES_PATH)).toHaveLength(before);
  });

  /*
   * **짝이 되는 방향** — 초기화 뒤 상태가 첫 진입과 같다. 「초기화」라는 낱말이 약속하는 것이다.
   */
  it('초기화 뒤 주소가 첫 진입과 같다', async () => {
    const { user } = renderScreen(
      [balanceRoute(), ...lookupRoutes()],
      `${WITH_WAREHOUSE}&item=9301&sort=onHandQty&page=2`,
    );

    await screen.findAllByText(ITEM_LABEL);

    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });
});

describe('StockStatusScreen — 보기 전환', () => {
  it('보기 탭 셋이 있다', async () => {
    renderScreen([balanceRoute(), ...lookupRoutes()], WITH_WAREHOUSE);

    await screen.findAllByText(ITEM_LABEL);

    const tabs = screen.getByRole('tablist', { name: t.views.label });

    expect(within(tabs).getAllByRole('tab')).toHaveLength(3);
  });

  /* 계약 기본값이 `ITEM`이라 싣지 않는다. */
  it('품목별 보기는 groupBy를 싣지 않고 주소에도 적지 않는다', async () => {
    const { requests } = renderScreen([balanceRoute(), ...lookupRoutes()], WITH_WAREHOUSE);

    await screen.findAllByText(ITEM_LABEL);

    expect(lastQuery(requests, BALANCES_PATH)?.has('groupBy')).toBe(false);
    expect(currentLocation()).not.toContain('view=');
  });

  it('위치별로 바꾸면 주소와 요청에 함께 실린다', async () => {
    const { requests, user } = renderScreen([balanceRoute(), ...lookupRoutes()], WITH_WAREHOUSE);

    await screen.findAllByText(ITEM_LABEL);

    await user.click(screen.getByRole('tab', { name: t.views.location }));

    await waitFor(() => {
      expect(currentLocation()).toContain('view=location');
    });

    expect(lastQuery(requests, BALANCES_PATH)?.get('groupBy')).toBe('LOCATION');
  });

  it('LOT별로 바꾸면 groupBy=LOT이 실린다', async () => {
    const { requests, user } = renderScreen(
      [balanceRoute(), ...lookupRoutes()],
      `${WITH_WAREHOUSE}&item=9301`,
    );

    await screen.findAllByText(ITEM_LABEL);

    await user.click(screen.getByRole('tab', { name: t.views.lot }));

    await waitFor(() => {
      expect(lastQuery(requests, BALANCES_PATH)?.get('groupBy')).toBe('LOT');
    });
  });

  /* 주소는 손으로 고쳐지는 자리다. 모르는 값을 요청에 실으면 계약 열거값 밖이라 400이다. */
  it('모르는 보기 값은 품목별로 읽고 요청에 싣지 않는다', async () => {
    const { requests } = renderScreen(
      [balanceRoute(), ...lookupRoutes()],
      `${WITH_WAREHOUSE}&view=xyz`,
    );

    await screen.findAllByText(ITEM_LABEL);

    expect(lastQuery(requests, BALANCES_PATH)?.has('groupBy')).toBe(false);
    expect(screen.getByRole('tab', { name: t.views.item })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  /*
   * **수명 표 1행** — 축을 바꿨다고 조건을 버리면 사용자가 방금 좁힌 범위가 사라진다.
   * 계약 실측상 조건 전부가 세 `groupBy` 값에서 동일하게 받아들여진다.
   */
  it('보기를 바꿔도 조건이 남는다', async () => {
    const { requests, user } = renderScreen(
      [balanceRoute(), ...lookupRoutes()],
      `${WITH_WAREHOUSE}&item=9301&zero=true`,
    );

    await screen.findAllByText(ITEM_LABEL);

    await user.click(screen.getByRole('tab', { name: t.views.location }));

    await waitFor(() => {
      expect(currentLocation()).toContain('view=location');
    });

    expect(currentLocation()).toContain('wh=9101');
    expect(currentLocation()).toContain('item=9301');
    expect(currentLocation()).toContain('zero=true');

    const query = lastQuery(requests, BALANCES_PATH);

    expect(query?.get('warehouseId')).toBe('9101');
    expect(query?.get('itemId')).toBe('9301');
    expect(query?.get('includeZero')).toBe('true');
  });

  /* **수명 표 1행** — 축이 바뀌면 줄 자체가 달라져 3쪽의 뜻이 달라진다. */
  it('보기를 바꾸면 첫 쪽으로 돌아간다', async () => {
    const { user } = renderScreen(
      [balanceRoute({ total: 300 }), ...lookupRoutes()],
      `${WITH_WAREHOUSE}&page=3`,
    );

    await screen.findAllByText(ITEM_LABEL);

    await user.click(screen.getByRole('tab', { name: t.views.location }));

    await waitFor(() => {
      expect(currentLocation()).toContain('view=location');
    });

    expect(currentLocation()).not.toContain('page=');
  });

  /*
   * **수명 표 1행** — 정렬 열은 보기마다 있고 없다. 그대로 가져가면 계약은 받지만 표에
   * 그 열이 없어 정렬 표시가 어디에도 나타나지 않는다.
   */
  it('보기를 바꾸면 정렬이 그 보기의 기본값이 된다', async () => {
    const { requests, user } = renderScreen(
      [balanceRoute(), ...lookupRoutes()],
      `${WITH_WAREHOUSE}&sort=onHandQty`,
    );

    await screen.findAllByText(ITEM_LABEL);

    await user.click(screen.getByRole('tab', { name: t.views.location }));

    await waitFor(() => {
      expect(currentLocation()).toContain('view=location');
    });

    expect(currentLocation()).toContain('sort=locationCode');
    expect(lastQuery(requests, BALANCES_PATH)?.get('sort')).toBe('locationCode');
  });

  /*
   * **LOT별 보기는 품목을 고른 뒤에만 연다**(계획 결정 11). LOT을 번호 여러 개로 조회할
   * 수단이 없어 품목이 이름을 풀 범위를 정한다 — 열어 두면 표가 「알 수 없음」으로 덮인다.
   */
  it('품목이 없으면 LOT별 탭이 잠기고 사유가 보인다', async () => {
    renderScreen([balanceRoute(), ...lookupRoutes()], WITH_WAREHOUSE);

    await screen.findAllByText(ITEM_LABEL);

    /* 디자인 시스템 `Tabs`는 `aria-disabled`로 잠근다(실측) — 탭 로빙에서 건너뛴다. */
    expect(screen.getByRole('tab', { name: t.views.lot })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(t.reasons.lotViewNeedsItem)).toBeInTheDocument();
  });

  it('잠긴 LOT별 탭을 눌러도 보기가 바뀌지 않는다', async () => {
    const { requests, user } = renderScreen([balanceRoute(), ...lookupRoutes()], WITH_WAREHOUSE);

    await screen.findAllByText(ITEM_LABEL);

    await user.click(screen.getByRole('tab', { name: t.views.lot }));

    expect(currentLocation()).not.toContain('view=lot');
    expect(lastQuery(requests, BALANCES_PATH)?.has('groupBy')).toBe(false);
  });

  it('품목을 고르면 LOT별 탭이 열린다', async () => {
    renderScreen([balanceRoute(), ...lookupRoutes()], `${WITH_WAREHOUSE}&item=9301`);

    await screen.findAllByText(ITEM_LABEL);

    expect(screen.getByRole('tab', { name: t.views.lot })).not.toHaveAttribute('aria-disabled');
    expect(screen.queryByText(t.reasons.lotViewNeedsItem)).not.toBeInTheDocument();
  });

  /* 표를 세 벌 그리면 같은 자료가 세 번 렌더되고 접근성 트리에 표가 셋이 된다. */
  it('활성 보기의 표만 그린다', async () => {
    renderScreen([balanceRoute(), ...lookupRoutes()], WITH_WAREHOUSE);

    await screen.findAllByText(ITEM_LABEL);

    expect(screen.getAllByRole('table')).toHaveLength(1);
  });
});

describe('StockStatusScreen — 정렬', () => {
  /*
   * **서버 정렬이다** — 계약이 전체 결과를 정렬해 쪽을 다시 나눠 준다.
   * 방향을 받는 파라미터가 계약에 없으므로 방향을 뜻하는 키를 만들지 않는다.
   */
  it('머리글을 누르면 열만 실리고 방향 키가 실리지 않는다', async () => {
    const { requests, user } = renderScreen([balanceRoute(), ...lookupRoutes()], WITH_WAREHOUSE);

    await screen.findAllByText(ITEM_LABEL);

    await user.click(screen.getByRole('button', { name: t.table.onHandQty }));

    await waitFor(() => {
      expect(currentLocation()).toContain('sort=onHandQty');
    });

    const query = lastQuery(requests, BALANCES_PATH);

    expect(query?.get('sort')).toBe('onHandQty');

    for (const key of ['direction', 'order', 'sortDirection', 'desc', 'asc']) {
      expect(query?.has(key)).toBe(false);
    }
  });

  /* **W-01-09와 반대다** — 서버 정렬이라 전체 순서가 바뀌어 3쪽의 뜻이 달라진다. */
  it('정렬을 바꾸면 첫 쪽으로 돌아간다', async () => {
    const { user } = renderScreen(
      [balanceRoute({ total: 300 }), ...lookupRoutes()],
      `${WITH_WAREHOUSE}&page=3`,
    );

    await screen.findAllByText(ITEM_LABEL);

    await user.click(screen.getByRole('button', { name: t.table.onHandQty }));

    await waitFor(() => {
      expect(currentLocation()).toContain('sort=onHandQty');
    });

    expect(currentLocation()).not.toContain('page=');
  });

  /*
   * 사이클이 **「없음 → 이 열로 정렬 → 해제」 두 상태**다.
   * 계약이 방향을 받지 않아 내림차순을 표기해도 서버가 그렇게 정렬해 주지 않는다.
   */
  it('같은 머리글을 다시 누르면 정렬이 풀리고 내림차순으로 들어가지 않는다', async () => {
    const { requests, user } = renderScreen(
      [balanceRoute(), ...lookupRoutes()],
      `${WITH_WAREHOUSE}&sort=onHandQty`,
    );

    await screen.findAllByText(ITEM_LABEL);

    await user.click(screen.getByRole('button', { name: t.table.onHandQty }));

    await waitFor(() => {
      expect(currentLocation()).not.toContain('sort=');
    });

    expect(lastQuery(requests, BALANCES_PATH)?.has('sort')).toBe(false);
  });

  /* 계약 열거값 밖은 400이다. 주소는 손으로 고쳐지는 자리다. */
  it('계약에 없는 정렬 열은 요청에 싣지 않는다', async () => {
    const { requests } = renderScreen(
      [balanceRoute(), ...lookupRoutes()],
      `${WITH_WAREHOUSE}&sort=nope`,
    );

    await screen.findAllByText(ITEM_LABEL);

    expect(lastQuery(requests, BALANCES_PATH)?.has('sort')).toBe(false);
  });

  /* 계약은 받지만 그 보기의 표에 열이 없어 정렬 표시가 어디에도 나타나지 않는다. */
  it('그 보기의 열이 아닌 정렬은 싣지 않는다', async () => {
    const { requests } = renderScreen(
      [balanceRoute(), ...lookupRoutes()],
      `${WITH_WAREHOUSE}&sort=locationCode`,
    );

    await screen.findAllByText(ITEM_LABEL);

    expect(lastQuery(requests, BALANCES_PATH)?.has('sort')).toBe(false);
  });

  /*
   * **요청이 0회인 표가 「정렬됨」을 말하지 않는다**(리뷰 m-2).
   *
   * 주소 규칙은 바뀌지 않았다 — 수명 표 2행(조건 변경·조회에서 `sort` 유지)이 승인된 정본이라
   * 주소의 `sort`는 그대로 둔다. 다만 창고를 고르기 전에는 정렬할 결과가 없으므로
   * **표시 계층에서** 정렬 표시를 내지 않는다. 아니면 보조기술이 빈 표를 「보유 기준 오름차순
   * 정렬됨」으로 읽는다.
   */
  it('창고를 고르기 전에는 표가 정렬 표시를 내지 않는다', async () => {
    renderScreen([balanceRoute(), ...lookupRoutes()], '?sort=onHandQty');

    await screen.findByText(t.empty.notQueriedTitle);

    expect(sortedHeaderNames()).toEqual([]);
    /* 주소는 손대지 않는다 — 창고를 고르면 그 정렬로 조회된다. */
    expect(currentLocation()).toContain('sort=onHandQty');
  });

  /* 짝 방향 — 조회한 표에서는 같은 정렬이 실제로 표시된다. */
  it('조회하면 같은 정렬이 표에 표시된다', async () => {
    renderScreen([balanceRoute(), ...lookupRoutes()], `${WITH_WAREHOUSE}&sort=onHandQty`);

    await screen.findAllByText(ITEM_LABEL);

    expect(sortedHeaderNames()).toEqual([t.table.onHandQty]);
  });
});

describe('StockStatusScreen — 쪽 이동', () => {
  it('쪽을 옮기면 주소와 요청이 함께 바뀐다', async () => {
    const { requests, user } = renderScreen(
      [balanceRoute({ total: 120 }), ...lookupRoutes()],
      WITH_WAREHOUSE,
    );

    await screen.findAllByText(ITEM_LABEL);

    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(currentLocation()).toContain('page=2');
    });

    expect(lastQuery(requests, BALANCES_PATH)?.get('page')).toBe('2');
  });

  /* 기본값을 주소에 적으면 같은 화면의 주소가 두 가지가 된다. */
  it('첫 쪽으로 돌아오면 page 키가 주소에서 사라진다', async () => {
    const { user } = renderScreen(
      [balanceRoute({ page: 2, total: 120 }), ...lookupRoutes()],
      `${WITH_WAREHOUSE}&page=2`,
    );

    await screen.findAllByText(ITEM_LABEL);

    await user.click(screen.getByRole('button', { name: t.actions.prevPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}${WITH_WAREHOUSE}`);
    });
  });

  /* 결과는 있는데 이 쪽에는 없다 — 「결과가 없다」와 사용자가 할 조치가 다르다. */
  it('쪽 밖이면 첫 쪽으로 가는 안내가 보인다', async () => {
    const { user } = renderScreen(
      [fixedBalanceRoute([], { page: 9, total: 45 }), ...lookupRoutes()],
      `${WITH_WAREHOUSE}&page=9`,
    );

    await screen.findByText(t.empty.beyondLastTitle);

    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}${WITH_WAREHOUSE}`);
    });
  });

  /* 짝이 되는 방향 — 실제로 조회했는데 0건이면 「결과 없음」이 맞다. */
  it('조회했는데 0건이면 「결과 없음」이고 「아직 조회하지 않았다」가 아니다', async () => {
    renderScreen([fixedBalanceRoute([], { total: 0 }), ...lookupRoutes()], WITH_WAREHOUSE);

    await screen.findByText(t.empty.noResultTitle);

    expect(screen.queryByText(t.empty.notQueriedTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.beyondLastTitle)).not.toBeInTheDocument();
  });
});

describe('StockStatusScreen — 조회 실패', () => {
  /* 실패를 「없습니다」로 보이면 사용자가 자료가 없는 줄 안다. */
  it('배너와 다시 시도가 나오고 빈 상태 안내가 나오지 않는다', async () => {
    const { requests, user } = renderScreen(
      [failingBalanceRoute(500), ...lookupRoutes()],
      WITH_WAREHOUSE,
    );

    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.notQueriedTitle)).not.toBeInTheDocument();

    const before = requestsTo(requests, BALANCES_PATH).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, BALANCES_PATH).length).toBeGreaterThan(before);
    });
  });

  it('권한이 없으면 다시 시도를 내지 않는다', async () => {
    renderScreen([failingBalanceRoute(403), ...lookupRoutes()], WITH_WAREHOUSE);

    await screen.findByText(messages.httpError.forbidden);

    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  /*
   * 401은 **403과 갈리고 500과 같은 갈래로 흐른다.** 이 앱에는 인증 만료 특례가 없어
   * 지금은 500과 동작이 같은데, **같다는 사실 자체를 고정한다.**
   */
  it('인증 만료(401)는 403이 아니라 500과 같은 갈래로 흐른다', async () => {
    renderScreen([failingBalanceRoute(401), ...lookupRoutes()], WITH_WAREHOUSE);

    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.getByRole('button', { name: messages.common.retry })).toBeInTheDocument();
    expect(screen.queryByText(messages.httpError.forbidden)).not.toBeInTheDocument();
  });

  it('연결이 끊기면 그 사유를 낸다', async () => {
    renderScreen(
      [
        {
          match: (request) => isGet(request, BALANCES_PATH),
          respond: () => {
            throw new TypeError('네트워크 연결 실패');
          },
        },
        ...lookupRoutes(),
      ],
      WITH_WAREHOUSE,
    );

    expect(await screen.findByText(messages.httpError.offline)).toBeInTheDocument();
  });

  /* 조회에 실패했으면 조건 줄은 남는다 — 조건을 고칠 수단이 사라지면 안 된다. */
  it('조회에 실패해도 조건 줄과 보기 탭이 남는다', async () => {
    renderScreen([failingBalanceRoute(500), ...lookupRoutes()], WITH_WAREHOUSE);

    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.getByRole('button', { name: messages.common.search })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: t.views.label })).toBeInTheDocument();
  });
});

describe('StockStatusScreen — 참조 값의 네 갈래', () => {
  it('참조 목록이 오면 이름으로 보인다', async () => {
    renderScreen([balanceRoute(), ...lookupRoutes()], WITH_WAREHOUSE);

    expect(await screen.findAllByText(ITEM_LABEL)).not.toHaveLength(0);
  });

  /*
   * **#47이 되살아나는 자리다.** 본 자료가 참조 목록보다 먼저 도착하는 순서를 실제로 만들어,
   * 그 사이에 정상 값이 「알 수 없음」으로 보이지 않는지 본다.
   */
  it('참조 목록이 늦게 오면 그 사이는 로딩 표기이고 「알 수 없음」이 아니다', async () => {
    const { release } = renderScreenHolding(
      [balanceRoute(), ...lookupRoutes()],
      [ITEMS_PATH, UOMS_PATH, PARTNERS_PATH],
      WITH_WAREHOUSE,
    );

    await screen.findByText(t.values.negativeOnHand);

    expect(balanceTable()).toHaveTextContent(t.values.referenceLoading);
    expect(balanceTable()).not.toHaveTextContent(t.values.unknown);

    release();

    expect(await screen.findAllByText(ITEM_LABEL)).not.toHaveLength(0);
  });

  it('참조 목록에 없는 번호는 「알 수 없음」이다', async () => {
    renderScreen([balanceRoute(), ...lookupRoutes()], WITH_WAREHOUSE);

    await screen.findAllByText(ITEM_LABEL);

    // 9302 품목이 참조 목록에 없다.
    expect(balanceTable()).toHaveTextContent(t.values.unknown);
  });

  /*
   * **#44 — 이름으로 풀 수 없어도 내부 번호를 내지 않는다.**
   * 「이름이 보인다」가 아니라 「실패 표기가 보인다」를 선행으로 짝지어, 아무것도 안 그려도
   * 통과하는 단언이 되지 않게 한다.
   */
  it('참조를 못 푸는 상태에서도 화면에 내부 번호가 보이지 않는다', async () => {
    renderScreen(
      [
        balanceRoute(),
        failingLookupRoute(WAREHOUSES_PATH),
        failingLookupRoute(LOCATIONS_PATH),
        failingLookupRoute(ITEMS_PATH),
        failingLookupRoute(LOTS_PATH),
        failingLookupRoute(UOMS_PATH),
        failingLookupRoute(PARTNERS_PATH),
      ],
      `${WITH_WAREHOUSE}&item=9301&loc=9201`,
    );

    await screen.findByText(t.reasons.filterReferencesFailed);

    expect(screen.getAllByText(t.values.referenceFailed)).not.toHaveLength(0);

    /*
     * 화면이 소유한 구획만 본다 — 주소를 보여 주는 검사용 부품(`LocationProbe`)에는
     * 조건의 번호가 그대로 들어 있어 함께 훑으면 늘 실패한다.
     */
    const text = screen.getByRole('region', { name: t.panes.list }).textContent ?? '';

    for (const id of ['9101', '9201', '9301', '9302', '9501', '9601']) {
      expect(text).not.toContain(id);
    }
  });

  /*
   * **「버튼이 있다」로는 모자란다** — 눌렀을 때 그 경로를 실제로 다시 부르는지까지 본다.
   * 조건 줄이 소유하는 참조 넷을 함께 다시 부른다(문구가 적은 대상과 같아야 한다).
   */
  it('조건 줄의 다시 시도가 창고·위치·품목·LOT을 함께 다시 부른다', async () => {
    const { requests, user } = renderScreen(
      [
        balanceRoute(),
        failingLookupRoute(WAREHOUSES_PATH),
        lookupRoute(LOCATIONS_PATH, locationFixtures),
        lookupRoute(ITEMS_PATH, itemFixtures),
        lookupRoute(LOTS_PATH, lotFixtures),
        lookupRoute(UOMS_PATH, uomFixtures),
        lookupRoute(PARTNERS_PATH, partnerFixtures),
      ],
      `${WITH_WAREHOUSE}&item=9301&view=lot`,
    );

    await screen.findByText(t.reasons.filterReferencesFailed);

    const before = {
      warehouses: requestsTo(requests, WAREHOUSES_PATH).length,
      locations: requestsTo(requests, LOCATIONS_PATH).length,
      items: requestsTo(requests, ITEMS_PATH).length,
      lots: requestsTo(requests, LOTS_PATH).length,
    };

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, WAREHOUSES_PATH).length).toBeGreaterThan(before.warehouses);
    });
    expect(requestsTo(requests, LOCATIONS_PATH).length).toBeGreaterThan(before.locations);
    expect(requestsTo(requests, ITEMS_PATH).length).toBeGreaterThan(before.items);
    expect(requestsTo(requests, LOTS_PATH).length).toBeGreaterThan(before.lots);
  });

  /* 목록 구획이 소유하는 참조 둘. 조건 줄의 넷과 자리가 갈린다(계획 결정 9). */
  it('목록 구획의 다시 시도가 단위·소유처를 함께 다시 부른다', async () => {
    const { requests, user } = renderScreen(
      [
        balanceRoute(),
        lookupRoute(WAREHOUSES_PATH, warehouseFixtures),
        lookupRoute(LOCATIONS_PATH, locationFixtures),
        lookupRoute(ITEMS_PATH, itemFixtures),
        lookupRoute(LOTS_PATH, lotFixtures),
        failingLookupRoute(UOMS_PATH),
        lookupRoute(PARTNERS_PATH, partnerFixtures),
      ],
      WITH_WAREHOUSE,
    );

    await screen.findByText(t.reasons.listReferencesFailed);

    // 조건 줄은 자기 사유를 내지 않는다 — 그 참조들은 멀쩡하다.
    expect(screen.queryByText(t.reasons.filterReferencesFailed)).not.toBeInTheDocument();

    const before = {
      uoms: requestsTo(requests, UOMS_PATH).length,
      partners: requestsTo(requests, PARTNERS_PATH).length,
    };

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, UOMS_PATH).length).toBeGreaterThan(before.uoms);
    });
    expect(requestsTo(requests, PARTNERS_PATH).length).toBeGreaterThan(before.partners);
  });
});

describe('StockStatusScreen — 매달린 참조', () => {
  /* 계약이 `warehouseId`를 필수로 요구한다 — 창고를 고른 뒤에야 부를 수 있다. */
  it('위치 참조는 창고를 고른 뒤에만 부른다', async () => {
    const { requests } = renderScreen([balanceRoute(), ...lookupRoutes()], WITH_WAREHOUSE);

    await screen.findAllByText(ITEM_LABEL);

    expect(requestsTo(requests, LOCATIONS_PATH)).toHaveLength(1);
    expect(lastQuery(requests, LOCATIONS_PATH)?.get('warehouseId')).toBe('9101');
  });

  /* 품목만으로는 열리지 않는다 — 보기까지 LOT별이어야 LOT 이름이 쓰인다. */
  it('LOT 참조는 품목만 골라서는 부르지 않는다', async () => {
    const { requests } = renderScreen(
      [balanceRoute(), ...lookupRoutes()],
      `${WITH_WAREHOUSE}&item=9301`,
    );

    await screen.findAllByText(ITEM_LABEL);

    expect(requestsTo(requests, LOTS_PATH)).toHaveLength(0);
  });

  it('품목을 고르고 LOT별 보기여야 LOT 참조를 부른다', async () => {
    const { requests } = renderScreen(
      [balanceRoute(), ...lookupRoutes()],
      `${WITH_WAREHOUSE}&item=9301&view=lot`,
    );

    await screen.findAllByText(ITEM_LABEL);

    await waitFor(() => {
      expect(requestsTo(requests, LOTS_PATH)).toHaveLength(1);
    });
    expect(lastQuery(requests, LOTS_PATH)?.get('itemId')).toBe('9301');
  });

  /*
   * **품목 없이 LOT별 보기에 서 있는 상태를 만들지 않는다**(계획 결정 11).
   *
   * 「LOT 참조를 부르지 않는다」만 단언하면 **항상-참에 가깝다** — 부르지 않은 채로
   * LOT 묶음 조회만 나가면 표의 LOT 칸이 전부 「알 수 없음」이 되는데, 그것이 바로
   * 결정 11이 막으려던 #47 금지 표기다. 그래서 **표시 결과를 짝으로** 단언한다.
   */
  it('품목 없이 LOT별 주소로 들어오면 품목별로 읽고 LOT 참조를 부르지 않는다', async () => {
    const { requests } = renderScreen(
      [balanceRoute(), ...lookupRoutes()],
      `${WITH_WAREHOUSE}&view=lot`,
    );

    await screen.findAllByText(ITEM_LABEL);

    expect(requestsTo(requests, LOTS_PATH)).toHaveLength(0);

    // 짝 단언 ① — 보기가 품목별로 읽힌다. LOT 묶음 조회 자체가 나가지 않는다.
    expect(screen.getByRole('tab', { name: t.views.item })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(lastQuery(requests, BALANCES_PATH)?.has('groupBy')).toBe(false);

    // 짝 단언 ② — 이름이 보이고, 「값이 잘못됐다」를 뜻하는 표기가 표를 덮지 않는다.
    expect(within(balanceTable()).getAllByText(ITEM_LABEL)).not.toHaveLength(0);
    expect(within(balanceTable()).queryByText(t.values.noLot)).not.toBeInTheDocument();
  });

  /*
   * **마우스만으로 닿는 경로다**(주소 편집이 필요 없다) — LOT별 보기에서 품목 조건 칩의 ×를
   * 누르면 품목이 사라진다. 이때도 같은 규칙이 적용돼 품목별로 되읽혀야 한다.
   */
  it('LOT별 보기에서 품목 칩을 제거하면 품목별로 되읽힌다', async () => {
    const { requests, user } = renderScreen(
      [balanceRoute(), ...lookupRoutes()],
      `${WITH_WAREHOUSE}&item=9301&view=lot`,
    );

    // 선행 단언 — 품목이 있는 동안에는 LOT 이름이 실제로 풀린다.
    expect(await screen.findByText('SAMPLE-LOT-0001')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.filters.chipRemoveItem }));

    await waitFor(() => {
      expect(currentLocation()).not.toContain('item=');
    });

    // **못 푸는 LOT 이름이 표를 덮을 자리 자체가 사라진다** — 열이 없어진다.
    await waitFor(() => {
      expect(headerNames()).not.toContain(t.table.lot);
    });

    expect(lastQuery(requests, BALANCES_PATH)?.has('groupBy')).toBe(false);
    expect(screen.getByRole('tab', { name: t.views.item })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.queryByText('SAMPLE-LOT-0001')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: t.views.lot })).toHaveAttribute('aria-disabled', 'true');
  });
});

/**
 * **부모 조건이 빠지면 종속 조건도 함께 뜻을 잃는다.**
 *
 * 이 화면은 두 종속 관계를 이미 선언해 두었다 — LOT은 품목에, 위치는 창고에 매달린다
 * (조건 줄의 안내 문구가 그렇게 말하고 `enabled`가 그렇게 부른다). 그런데 **조건 값 자체**는
 * 부모가 빠져도 남아, 요청에 계속 실리면서 칩은 「알 수 없음」으로 보였다.
 *
 * 이 저장소에서 「알 수 없음」은 뜻이 확정된 낱말이다 — 「이름 목록은 왔는데 그 안에 없다,
 * 즉 **값이 잘못됐다**」. 정상적으로 걸려 있고 결과를 좁히고 있는 조건에 그 표를 붙이면
 * 사용자는 결과가 좁아진 이유를 알 수 없고 걸린 값을 잘못된 것으로 읽는다(#47과 같은 갈래).
 */
describe('StockStatusScreen — 부모가 빠진 종속 조건', () => {
  /** 리뷰 실측 경로 (a) — 마우스만으로 닿는다. */
  it('품목 칩을 빼면 LOT 조건이 요청에서도 칩에서도 사라진다', async () => {
    const { requests, user } = renderScreen(
      [balanceRoute(), ...lookupRoutes()],
      `${WITH_WAREHOUSE}&item=9301&lot=9401&view=lot`,
    );

    // 선행 단언 — 품목이 있는 동안에는 LOT 조건이 실제로 걸려 있고 이름으로 보인다.
    expect(await screen.findByText('LOT: SAMPLE-LOT-0001')).toBeInTheDocument();
    expect(lastQuery(requests, BALANCES_PATH)?.get('lotId')).toBe('9401');

    await user.click(screen.getByRole('button', { name: t.filters.chipRemoveItem }));

    await waitFor(() => {
      expect(lastQuery(requests, BALANCES_PATH)?.has('lotId')).toBe(false);
    });

    expect(screen.queryByText(/^LOT: /)).not.toBeInTheDocument();
    expect(screen.queryByText(`LOT: ${t.values.unknown}`)).not.toBeInTheDocument();
  });

  /** 리뷰 실측 경로 (b) — 위치는 창고에 매달린다. */
  it('창고 칩을 빼면 위치 조건이 칩에서 사라진다', async () => {
    const { requests, user } = renderScreen(
      [balanceRoute(), ...lookupRoutes()],
      `${WITH_WAREHOUSE}&loc=9201`,
    );

    // 선행 단언 — 창고가 있는 동안에는 위치 조건이 걸려 있고 이름으로 보인다.
    expect(await screen.findByText('위치: SAMPLE-LOC-01 · 합성 위치 가')).toBeInTheDocument();
    expect(lastQuery(requests, BALANCES_PATH)?.get('locationId')).toBe('9201');

    await user.click(screen.getByRole('button', { name: t.filters.chipRemoveWarehouse }));

    await waitFor(() => {
      expect(screen.getByText(t.empty.notQueriedTitle)).toBeInTheDocument();
    });

    expect(screen.queryByText(/^위치: /)).not.toBeInTheDocument();
    expect(screen.queryByText(`위치: ${t.values.unknown}`)).not.toBeInTheDocument();
  });

  /*
   * **어긋남이 쌓이지 않는다.** 부모를 다시 채워도 뜻을 잃은 종속 조건이 되살아나지 않는다 —
   * 되살아나면 사용자가 지운 적 없는 조건이 갑자기 결과를 좁힌다.
   */
  it('품목을 다시 골라도 빠졌던 LOT 조건이 되살아나지 않는다', async () => {
    const { requests, user } = renderScreen(
      [balanceRoute(), ...lookupRoutes()],
      `${WITH_WAREHOUSE}&item=9301&lot=9401&view=lot`,
    );

    await screen.findByText('LOT: SAMPLE-LOT-0001');

    await user.click(screen.getByRole('button', { name: t.filters.chipRemoveItem }));

    await waitFor(() => {
      expect(screen.queryByText(/^LOT: /)).not.toBeInTheDocument();
    });

    await user.click(screen.getByLabelText(t.fields.item));
    await user.click(await screen.findByRole('option', { name: ITEM_LABEL }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(currentLocation()).toContain('item=9301');
    });

    expect(currentLocation()).not.toContain('lot=');
    expect(lastQuery(requests, BALANCES_PATH)?.has('lotId')).toBe(false);
    expect(screen.queryByText(/^LOT: /)).not.toBeInTheDocument();
  });

  /*
   * **LOT 이름을 내는 자리가 있으면 반드시 부른다.** 「쓰지 않으면 부르지 않는다」의 뒷면이며,
   * 한쪽만 지키면 부르지 않는 참조의 이름을 「알 수 없음」으로 확정 표시하게 된다.
   * LOT 조건 칩은 **품목별 보기에서도** LOT 이름을 낸다.
   */
  it('품목별 보기라도 LOT 조건이 걸려 있으면 LOT 참조를 부르고 이름으로 낸다', async () => {
    const { requests } = renderScreen(
      [balanceRoute(), ...lookupRoutes()],
      `${WITH_WAREHOUSE}&item=9301&lot=9401`,
    );

    expect(await screen.findByText('LOT: SAMPLE-LOT-0001')).toBeInTheDocument();
    expect(requestsTo(requests, LOTS_PATH)).toHaveLength(1);
    expect(screen.queryByText(`LOT: ${t.values.unknown}`)).not.toBeInTheDocument();
    /*
     * **선택칸 안내가 훅과 같은 값을 본다.** 다르면 선택지는 채워졌는데 그 아래 안내는
     * 「고르면 채워집니다」라고 말하는 어긋남이 생긴다 — 여기가 정확히 그 상태다
     * (품목별 보기인데 LOT 조건이 걸려 참조를 부른다).
     */
    expect(screen.queryByText(t.filters.lotNeedsItem)).not.toBeInTheDocument();
  });
});

describe('StockStatusScreen — 참조 선택지의 한계', () => {
  /*
   * 아래 「잘렸으면 밝힌다」의 **선행 단언**이다. 이것이 없으면 그 문구가
   * 늘 떠 있는 것인지 잘렸을 때만 뜨는 것인지 구분되지 않는다.
   */
  it('목록이 다 왔으면 잘림 안내를 내지 않는다', async () => {
    renderScreen([balanceRoute(), ...lookupRoutes()], WITH_WAREHOUSE);

    await screen.findAllByText(ITEM_LABEL);

    expect(screen.queryByText(t.filters.lookupTruncated)).not.toBeInTheDocument();
  });

  it('참조 목록이 잘리면 조건 줄이 그 사실을 밝힌다', async () => {
    renderScreen(
      [
        balanceRoute(),
        truncatedLookupRoute(WAREHOUSES_PATH, warehouseFixtures),
        lookupRoute(LOCATIONS_PATH, locationFixtures),
        lookupRoute(ITEMS_PATH, itemFixtures),
        lookupRoute(LOTS_PATH, lotFixtures),
        lookupRoute(UOMS_PATH, uomFixtures),
        lookupRoute(PARTNERS_PATH, partnerFixtures),
      ],
      WITH_WAREHOUSE,
    );

    expect(await screen.findByText(t.filters.lookupTruncated)).toBeInTheDocument();
  });

  /*
   * **미사용 값을 선택지에서 빼지 않는다** — 과거 재고가 미사용 품목을 참조할 수 있어
   * 빼면 그 재고를 조건으로 찾을 방법이 사라진다. 대신 표식을 붙여 고를 때 알 수 있게 한다.
   * **표 칸에는 붙이지 않는다** — 선택지와 표를 함께 확인해 그 차이를 값으로 고정한다.
   */
  it('미사용 참조는 선택지에만 표식이 붙고 표 칸에는 붙지 않는다', async () => {
    const { user } = renderScreen([balanceRoute(), ...lookupRoutes()], WITH_WAREHOUSE);

    await screen.findAllByText(ITEM_LABEL);

    expect(balanceTable()).not.toHaveTextContent(t.values.inactiveSuffix.trim());

    await user.click(screen.getByLabelText(t.fields.item));

    expect(
      screen.getByRole('option', {
        name: `SAMPLE-ITEM-09 · 합성 품목 자${t.values.inactiveSuffix}`,
      }),
    ).toBeInTheDocument();
    // 사용 중인 값에는 붙지 않는다 — 표식이 늘 붙으면 뜻이 없다.
    expect(screen.getByRole('option', { name: ITEM_LABEL })).toBeInTheDocument();
  });
});

describe('StockStatusScreen — 코드 선택지', () => {
  /*
   * 값 목록이 확정되지 않아(omf-mes#64) 자리표시가 비어 있다 — 선택지는 조회 결과에서 만든다.
   */
  it('조회 결과에서 관측한 코드가 선택지가 된다', async () => {
    const { user } = renderScreen([balanceRoute(), ...lookupRoutes()], WITH_WAREHOUSE);

    await screen.findAllByText(ITEM_LABEL);

    await user.click(screen.getByLabelText(t.fields.qualityStatus));

    expect(screen.getByRole('option', { name: 'SAMPLE_Q_A' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'SAMPLE_Q_B' })).toBeInTheDocument();
  });

  /*
   * 남기지 않으면 조건을 걸어 좁힌 순간 그 값이 결과에서 사라져 **해제할 방법이 없어진다.**
   */
  it('결과에 없는 걸린 코드도 선택지에 남아 해제할 수 있다', async () => {
    const { user } = renderScreen(
      [balanceRoute(), ...lookupRoutes()],
      `${WITH_WAREHOUSE}&qs=SAMPLE_Q_Z`,
    );

    await screen.findAllByText(ITEM_LABEL);

    await user.click(screen.getByLabelText(t.fields.qualityStatus));

    expect(screen.getByRole('option', { name: 'SAMPLE_Q_Z' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: t.filters.all })).toBeInTheDocument();
  });
});

describe('StockStatusScreen — 조건 초안의 수명', () => {
  /*
   * **#43이 되살아나는 자리다.** 조건 줄에서 값을 고르는 도중 목록 응답이 도착하면 화면이
   * 다시 그려지고, 되돌림을 참조로 판정하면 그 순간 고르던 값이 사라진다.
   */
  it('고르는 도중 목록 응답이 도착해도 값이 사라지지 않는다', async () => {
    const { release, user } = renderScreenHolding(
      [balanceRoute(), ...lookupRoutes()],
      [BALANCES_PATH],
      WITH_WAREHOUSE,
    );

    await screen.findByLabelText(t.fields.item);

    await user.click(screen.getByLabelText(t.fields.item));
    await user.click(await screen.findByRole('option', { name: ITEM_LABEL }));

    release();

    await screen.findAllByText(ITEM_LABEL);

    expect(screen.getByLabelText(t.fields.item)).toHaveTextContent(ITEM_LABEL);
    // 아직 조회하지 않았으므로 주소는 그대로다.
    expect(currentLocation()).toBe(`${ROUTE}${WITH_WAREHOUSE}`);
  });

  /* 짝이 되는 방향 — 주소가 실제로 바뀌면 조건 줄도 그 값으로 되돌아간다. */
  it('바깥에서 주소가 바뀌면 조건 줄이 따라간다', async () => {
    const { user } = renderScreen(
      [balanceRoute(), ...lookupRoutes()],
      WITH_WAREHOUSE,
      'wh=9101&item=9301',
    );

    await screen.findAllByText(ITEM_LABEL);

    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await waitFor(() => {
      expect(screen.getByLabelText(t.fields.item)).toHaveTextContent(ITEM_LABEL);
    });
  });
});

describe('StockStatusScreen — 기준 시각과 새로고침', () => {
  /*
   * 재고는 **조회 시점의 스냅샷**이다. 밝히지 않으면 사용자가 실시간으로 읽는다.
   * 응답이 도착한 시각을 쓴다 — 렌더 시각을 쓰면 아무것도 안 했는데 시각이 계속 바뀐다.
   */
  it('조회한 뒤 기준 시각이 보이고 다시 그려도 값이 바뀌지 않는다', async () => {
    const { user } = renderScreen([balanceRoute(), ...lookupRoutes()], WITH_WAREHOUSE);

    await screen.findAllByText(ITEM_LABEL);

    const asOf = await screen.findByTestId('as-of');
    const first = asOf.textContent;

    expect(first).toMatch(/^기준 \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);

    // 조건 줄을 건드려 화면을 여러 번 다시 그린다.
    await user.click(screen.getByLabelText(t.fields.qualityStatus));
    await user.keyboard('{Escape}');

    expect(screen.getByTestId('as-of').textContent).toBe(first);
  });

  /*
   * **기준 시각을 live 영역으로 두지 않는다.** `<output>`은 암묵적으로 `role="status"`라
   * 쪽 이동·정렬 변경·새로고침마다 시각이 낭독된다 — 조회가 끝났음은 표의 빈 상태가 이미
   * 알리므로 같은 사정이 두 번 읽힌다. 되돌리면 이 두 단언이 함께 깨진다.
   */
  it('기준 시각이 live 영역이 아니다', async () => {
    renderScreen([balanceRoute(), ...lookupRoutes()], WITH_WAREHOUSE);

    await screen.findAllByText(ITEM_LABEL);

    const asOf = await screen.findByTestId('as-of');

    expect(asOf.tagName).toBe('SPAN');
    expect(screen.queryAllByRole('status')).not.toContain(asOf);
  });

  it('조회하기 전에는 기준 시각을 내지 않는다', async () => {
    renderScreen([balanceRoute(), ...lookupRoutes()]);

    await screen.findByText(t.empty.notQueriedTitle);

    expect(screen.queryByTestId('as-of')).not.toBeInTheDocument();
  });

  /* 새로고침은 **같은 조회를 다시 하는 것**이다. 무언가를 비우면 조건 변경으로 둔갑한다. */
  it('새로고침이 같은 조회를 다시 하고 주소를 바꾸지 않는다', async () => {
    const { requests, user } = renderScreen(
      [balanceRoute({ total: 120 }), ...lookupRoutes()],
      `${WITH_WAREHOUSE}&item=9301&sort=onHandQty&page=2`,
    );

    await screen.findAllByText(ITEM_LABEL);

    const before = currentLocation();
    const requestCount = requestsTo(requests, BALANCES_PATH).length;

    await user.click(screen.getByRole('button', { name: t.actions.refresh }));

    await waitFor(() => {
      expect(requestsTo(requests, BALANCES_PATH).length).toBeGreaterThan(requestCount);
    });

    expect(currentLocation()).toBe(before);

    const query = lastQuery(requests, BALANCES_PATH);

    expect(query?.get('warehouseId')).toBe('9101');
    expect(query?.get('itemId')).toBe('9301');
    expect(query?.get('sort')).toBe('onHandQty');
    expect(query?.get('page')).toBe('2');
  });

  /*
   * **자동으로 갱신되지 않는다**(이슈 #21 §5 — 대시보드가 아니다).
   * 아무것도 하지 않는 동안 요청이 늘지 않음을 값으로 고정한다.
   */
  it('아무것도 하지 않으면 요청이 늘지 않는다', async () => {
    const { requests, user } = renderScreen([balanceRoute(), ...lookupRoutes()], WITH_WAREHOUSE);

    await screen.findAllByText(ITEM_LABEL);

    const before = requestsTo(requests, BALANCES_PATH).length;

    // 화면을 여러 번 다시 그려도 재조회가 일어나지 않는다.
    await user.click(screen.getByLabelText(t.fields.qualityStatus));
    await user.keyboard('{Escape}');
    await user.click(screen.getByLabelText(t.fields.inventoryStatus));
    await user.keyboard('{Escape}');

    expect(requestsTo(requests, BALANCES_PATH)).toHaveLength(before);
  });
});

describe('StockStatusScreen — 요약과 집계', () => {
  /*
   * **요약 카드 5종을 만들지 않는다**(계획 결정 7). 줄마다 `uomId`가 달라 더하면 값이 틀리고,
   * 「필터 전체 기준」을 내려면 모든 쪽을 받아 더해야 해 요청이 N회가 된다.
   */
  it('합계 행이 없다', async () => {
    renderScreen([balanceRoute(), ...lookupRoutes()], WITH_WAREHOUSE);

    await screen.findAllByText(ITEM_LABEL);

    expect(balanceTable().querySelector('tfoot')).toBeNull();
  });

  /* 서버가 준 가용(77)이 보유−예약−피킹−보류(85)와 다르다 — 다시 계산하면 이 단언이 깨진다. */
  it('가용 수량을 서버가 준 값 그대로 그린다', async () => {
    renderScreen([balanceRoute(), ...lookupRoutes()], WITH_WAREHOUSE);

    await screen.findAllByText(ITEM_LABEL);

    expect(within(balanceTable()).getAllByText('77')).not.toHaveLength(0);
    expect(within(balanceTable()).queryByText('85')).not.toBeInTheDocument();
  });
});

/**
 * LOT별 보기의 첫 줄을 고른다. 주소·요청·구획을 판정하는 공통 앞자락이다.
 * 목록이 도착해 버튼이 생길 때까지 기다린다 — 아래 구획의 빈 상태는 목록보다 먼저 나온다.
 */
const selectFirstLot = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(
    await screen.findByRole('button', { name: t.actions.selectRow('SAMPLE-LOT-0001') }),
  );
};

const detailPane = (): HTMLElement => screen.getByRole('region', { name: t.panes.detail });

/** 상세 구획에도 표가 있어 목록의 표는 위 구획 안에서 찾는다. */
const listPane = (): HTMLElement => screen.getByRole('region', { name: t.panes.list });

describe('StockStatusScreen — LOT 고르기', () => {
  /* 고르기 전에는 부를 대상이 없다 — 화면에 들어온 것만으로 생기는 조회가 아니다. */
  it('고르기 전에는 상세를 부르지 않고 「고른 LOT이 없습니다」를 낸다', async () => {
    const { requests } = renderScreen(
      [balanceRoute(), lotDetailRoute(heldLotDetail(TODAY)), ...lookupRoutes()],
      LOT_VIEW,
    );

    await screen.findByText(t.empty.noSelectionTitle);

    expect(lotDetailRequests(requests)).toHaveLength(0);
  });

  it('고르면 주소에 sel이 붙고 상세를 1회 부른다', async () => {
    const { requests, user } = renderScreen(
      [balanceRoute(), lotDetailRoute(heldLotDetail(TODAY)), ...lookupRoutes()],
      LOT_VIEW,
    );

    await selectFirstLot(user);

    await waitFor(() => {
      expect(requestsTo(requests, LOT_DETAIL_PATH)).toHaveLength(1);
    });

    expect(currentLocation()).toContain('sel=9401');
    /* 번호는 경로 조각으로만 쓴다 — 잔액 요청 쿼리에 실리지 않는다. */
    expect(lastQuery(requests, BALANCES_PATH)?.has('sel')).toBe(false);
  });

  /*
   * **렌더마다 다시 부르지 않는다.** 화면을 여러 번 다시 그려도 같은 LOT의 상세는 한 번이다 —
   * 캐시 키가 렌더마다 새로 만들어지면 목록을 훑는 동안 요청이 계속 늘어난다.
   */
  it('다시 그려도 상세 요청이 늘지 않는다', async () => {
    const { requests, user } = renderScreen(
      [balanceRoute(), lotDetailRoute(heldLotDetail(TODAY)), ...lookupRoutes()],
      LOT_VIEW,
    );

    await selectFirstLot(user);

    await waitFor(() => {
      expect(requestsTo(requests, LOT_DETAIL_PATH)).toHaveLength(1);
    });

    await user.click(screen.getByLabelText(t.fields.qualityStatus));
    await user.keyboard('{Escape}');

    expect(requestsTo(requests, LOT_DETAIL_PATH)).toHaveLength(1);
  });

  /*
   * **고르기는 보이는 줄을 바꾸지 않는다**(수명 표 6행). 3쪽에서 고른 LOT의 상세를 보는 동안
   * 목록이 1쪽으로 튀면 사용자가 돌아갈 자리를 잃는다.
   */
  it('고르기가 쪽·조건·보기·정렬을 바꾸지 않는다', async () => {
    const { requests, user } = renderScreen(
      [balanceRoute({ total: 300 }), lotDetailRoute(heldLotDetail(TODAY)), ...lookupRoutes()],
      `${LOT_VIEW}&sort=onHandQty&page=3`,
    );

    await screen.findByRole('button', { name: t.actions.selectRow('SAMPLE-LOT-0001') });

    const listRequests = requestsTo(requests, BALANCES_PATH).length;

    await selectFirstLot(user);

    await waitFor(() => {
      expect(currentLocation()).toContain('sel=9401');
    });

    expect(currentLocation()).toContain('page=3');
    expect(currentLocation()).toContain('sort=onHandQty');
    expect(currentLocation()).toContain('view=lot');
    expect(currentLocation()).toContain('item=9301');
    /* 목록을 다시 부르지 않는다 — 조회 조건이 하나도 바뀌지 않았다. */
    expect(requestsTo(requests, BALANCES_PATH)).toHaveLength(listRequests);
  });

  it('다시 누르면 선택이 풀리고 구획이 되돌아간다', async () => {
    const { user } = renderScreen(
      [balanceRoute(), lotDetailRoute(heldLotDetail(TODAY)), ...lookupRoutes()],
      LOT_VIEW,
    );

    await selectFirstLot(user);

    await screen.findByText(t.detail.quantitiesNote);

    await user.click(
      screen.getByRole('button', { name: t.actions.deselectRow('SAMPLE-LOT-0001') }),
    );

    await screen.findByText(t.empty.noSelectionTitle);

    expect(currentLocation()).not.toContain('sel=');
  });

  /* 보기를 바꾸면 고른 LOT이 새 결과에 없다 — 수명 표 1행이 `sel`을 함께 비운다. */
  it('보기를 바꾸면 상세 구획이 사라진다', async () => {
    const { user } = renderScreen(
      [balanceRoute(), lotDetailRoute(heldLotDetail(TODAY)), ...lookupRoutes()],
      LOT_VIEW,
    );

    await selectFirstLot(user);

    await screen.findByText(t.detail.quantitiesNote);

    await user.click(screen.getByRole('tab', { name: t.views.item }));

    await waitFor(() => {
      expect(currentLocation()).not.toContain('sel=');
    });

    expect(screen.queryByRole('region', { name: t.panes.detail })).not.toBeInTheDocument();
  });

  /* 품목별·위치별에는 고를 대상이 없다 — 구획을 두면 할 수 없는 일을 시키는 안내가 된다. */
  it('품목별 보기에는 상세 구획이 없다', async () => {
    renderScreen(
      [balanceRoute(), lotDetailRoute(heldLotDetail(TODAY)), ...lookupRoutes()],
      WITH_WAREHOUSE,
    );

    await screen.findAllByText(ITEM_LABEL);

    expect(screen.queryByRole('region', { name: t.panes.detail })).not.toBeInTheDocument();
  });
});

describe('StockStatusScreen — 고른 LOT의 수명', () => {
  /*
   * **갱신된 결과에 없는 선택은 정리한다**(수명 표 7행). 정리를 클릭 핸들러에 두면
   * 뒤로가기·앞으로가기·주소 직접 편집이 통째로 샌다 — 여기서는 화면 **바깥에서** 주소를
   * 갈아 끼워 그 경로를 만든다.
   */
  it('결과에 없는 LOT을 주소로 넣으면 sel이 사라진다', async () => {
    const { user } = renderScreen(
      [balanceRoute(), lotDetailRoute(heldLotDetail(TODAY)), ...lookupRoutes()],
      LOT_VIEW,
      'wh=9101&view=lot&item=9301&sel=9999',
    );

    await screen.findByText(t.empty.noSelectionTitle);

    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await waitFor(() => {
      expect(currentLocation()).not.toContain('sel=');
    });

    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  /* 짝 방향 — 결과에 있는 LOT은 주소로 들어와도 살아남는다. */
  it('결과에 있는 LOT을 주소로 넣으면 상세가 열린다', async () => {
    renderScreen(
      [balanceRoute(), lotDetailRoute(heldLotDetail(TODAY)), ...lookupRoutes()],
      `${LOT_VIEW}&sel=9401`,
    );

    expect(await screen.findByText(t.detail.quantitiesNote)).toBeInTheDocument();
    expect(currentLocation()).toContain('sel=9401');
  });

  /*
   * **응답이 도착하기 전에는 지우지 않는다.** 기다리는 동안에는 줄이 비어 있어, 가드가 없으면
   * 「고른 LOT이 사라졌다」로 읽혀 구획이 깜빡 닫히고 주소의 `sel`까지 날아간다.
   */
  it('목록 응답 전에는 선택을 지우지 않는다', async () => {
    const { release } = renderScreenHolding(
      [balanceRoute(), lotDetailRoute(heldLotDetail(TODAY)), ...lookupRoutes()],
      [BALANCES_PATH],
      `${LOT_VIEW}&sel=9401`,
    );

    await screen.findByRole('status', { name: t.loading.lotDetail });

    expect(currentLocation()).toContain('sel=9401');
    expect(screen.queryByText(t.empty.noSelectionTitle)).not.toBeInTheDocument();

    release();

    expect(await screen.findByText(t.detail.quantitiesNote)).toBeInTheDocument();
    expect(currentLocation()).toContain('sel=9401');
  });

  /*
   * **LOT별 보기가 아니면 `sel`은 가리킬 줄이 없다.** 읽는 자리에서 그렇게 판정하지 않으면
   * 화면에 없는 LOT의 상세를 한 번 부르고 나서 지우게 된다 — 사용자에게는 아무 일도 없는데
   * 요청만 하나 늘어난다.
   */
  it('품목별 보기의 주소에 sel이 남아 있어도 상세를 부르지 않는다', async () => {
    const { requests } = renderScreen(
      [balanceRoute(), lotDetailRoute(heldLotDetail(TODAY)), ...lookupRoutes()],
      `${WITH_WAREHOUSE}&sel=9401`,
    );

    await screen.findAllByText(ITEM_LABEL);

    expect(lotDetailRequests(requests)).toHaveLength(0);
    /* 주소는 고쳐 쓰지 않는다 — 보기를 되돌리면 그 선택이 되살아난다. */
    expect(currentLocation()).toContain('sel=9401');
  });

  /* 주소는 손으로 고쳐지는 자리다 — `/trace/lots/0`을 부르지 않는다. */
  it('번호가 아닌 sel로는 상세를 부르지 않는다', async () => {
    const { requests } = renderScreen(
      [balanceRoute(), lotDetailRoute(heldLotDetail(TODAY)), ...lookupRoutes()],
      `${LOT_VIEW}&sel=0`,
    );

    await screen.findByText(t.empty.noSelectionTitle);

    expect(lotDetailRequests(requests)).toHaveLength(0);
  });
});

describe('StockStatusScreen — LOT 상세의 내용', () => {
  it('수량 다섯과 보류·외부 식별자를 낸다', async () => {
    renderScreen(
      [balanceRoute(), lotDetailRoute(heldLotDetail(TODAY)), ...lookupRoutes()],
      `${LOT_VIEW}&sel=9401`,
    );

    await screen.findByText(t.detail.quantitiesNote);

    const pane = within(detailPane());

    for (const label of [
      t.detail.onHandQty,
      t.detail.reservedQty,
      t.detail.pickedQty,
      t.detail.blockedQty,
      t.detail.availableQty,
    ]) {
      expect(pane.getByText(label)).toBeInTheDocument();
    }

    expect(pane.getByText(t.detail.holds.wholeLot)).toBeInTheDocument();
    expect(pane.getByText('SAMPLE-EXT-0001')).toBeInTheDocument();
  });

  /*
   * **기한이 지나도 보류를 걸지 않는다**(이슈 §4 미결 5 — 정책 미정). 표식만 내고,
   * 그 상태에서 나간 요청이 전부 읽기임을 값으로 고정한다.
   */
  it('기한이 지난 LOT을 열어도 쓰기 요청이 없다', async () => {
    const { requests } = renderScreen(
      [balanceRoute(), lotDetailRoute(expiredLotDetail(TODAY)), ...lookupRoutes()],
      `${LOT_VIEW}&sel=9401`,
    );

    expect(await screen.findByText(t.detail.expiryPassed)).toBeInTheDocument();
    expect(requests.every((request) => request.method === 'GET')).toBe(true);
  });

  /* 짝 방향 — 유효기한이 없는 LOT에는 표식이 붙지 않는다. */
  it('유효기한이 없으면 표식이 붙지 않는다', async () => {
    renderScreen(
      [balanceRoute(), lotDetailRoute(plainLotDetail()), ...lookupRoutes()],
      `${LOT_VIEW}&sel=9401`,
    );

    await screen.findByText(t.detail.quantitiesNote);

    expect(screen.queryByText(t.detail.expiryPassed)).not.toBeInTheDocument();
    expect(screen.queryByText(t.detail.expirySoon)).not.toBeInTheDocument();
  });

  /* 목록에 없는 수량 둘이 여기서 나온다(계획 결정 13-2) — 열 폭 예산이 목록에 다섯을 못 담는다. */
  it('예약·피킹은 목록이 아니라 상세에서만 보인다', async () => {
    renderScreen(
      [balanceRoute(), lotDetailRoute(heldLotDetail(TODAY)), ...lookupRoutes()],
      `${LOT_VIEW}&sel=9401`,
    );

    await screen.findByText(t.detail.quantitiesNote);

    expect(within(detailPane()).getByText(t.detail.reservedQty)).toBeInTheDocument();
    expect(within(listPane()).getByRole('table').textContent?.includes(t.detail.reservedQty)).toBe(
      false,
    );
  });
});

describe('StockStatusScreen — 상세 조회 실패', () => {
  /*
   * **상세가 실패해도 위 목록은 그대로 보인다.** 실패한 것은 고른 LOT 한 벌뿐인데
   * 화면 전체를 덮으면 사용자가 목록까지 못 쓰게 된다.
   */
  it('배너가 상세 구획에만 나오고 목록은 남는다', async () => {
    renderScreen(
      [balanceRoute(), failingLotDetailRoute(), ...lookupRoutes()],
      `${LOT_VIEW}&sel=9401`,
    );

    const retry = await screen.findByRole('button', { name: messages.common.retry });

    expect(detailPane()).toContainElement(retry);
    /* 위 목록이 여전히 그려져 있다. */
    expect(
      within(within(listPane()).getByRole('table')).getAllByText('SAMPLE-LOT-0001').length,
    ).toBeGreaterThan(0);
  });

  /* 실패를 「없습니다」로 말하지 않는다 — 자료가 없는 줄 알고 다른 LOT을 찾게 된다. */
  it('실패를 빈 상태로 말하지 않는다', async () => {
    renderScreen(
      [balanceRoute(), failingLotDetailRoute(), ...lookupRoutes()],
      `${LOT_VIEW}&sel=9401`,
    );

    await screen.findByRole('region', { name: t.panes.detail });
    await screen.findByRole('button', { name: messages.common.retry });

    expect(screen.queryByText(t.empty.noSelectionTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(t.detail.holds.emptyTitle)).not.toBeInTheDocument();
  });

  /* 권한이 없으면 다시 시도가 사용자가 할 수 있는 조치가 아니다. */
  it('권한이 없으면 다시 시도를 내지 않는다', async () => {
    renderScreen(
      [balanceRoute(), failingLotDetailRoute(403), ...lookupRoutes()],
      `${LOT_VIEW}&sel=9401`,
    );

    const pane = within(await screen.findByRole('region', { name: t.panes.detail }));

    expect(await pane.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(pane.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  /* 목록이 실패하면 낼 수량이 없다 — 배너가 이미 사유와 복구를 냈다. */
  it('목록이 실패하면 상세 구획을 내지 않는다', async () => {
    renderScreen(
      [failingBalanceRoute(500), lotDetailRoute(heldLotDetail(TODAY)), ...lookupRoutes()],
      `${LOT_VIEW}&sel=9401`,
    );

    await screen.findByRole('button', { name: messages.common.retry });

    expect(screen.queryByRole('region', { name: t.panes.detail })).not.toBeInTheDocument();
  });
});
