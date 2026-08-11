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
import { countDetailBody, countFixtures, warehouseFixtures } from './fixtures';
import { StocktakingScreen } from './screen';

const t = messages.stocktaking;

const ROUTE = '/logistics/stocktaking';
const LIST_PATH = '/inventory/counts';
const DETAIL_PATH = '/inventory/counts/9001';
const OTHER_DETAIL_PATH = '/inventory/counts/9003';
const MISSING_DETAIL_PATH = '/inventory/counts/9999';
const WAREHOUSES_PATH = '/mdm/warehouses';

/**
 * 이 화면이 **뒤 PR에서** 부를 경로들. **지금은 부르지 않는다** — 그것을 증명하려고 스텁을 둔다.
 *
 * 스텁을 두지 않으면 하네스가 던져 「부르지 않았다」와 「불렀는데 실패했다」가 구분되지 않는다.
 * 쓰기 셋을 전부 두는 것이 **C13의 잣대**다 — 기록된 모든 요청의 method가 GET이어야 한다.
 */
const LINES_PATH = '/inventory/counts/9001/lines';
const LOCATIONS_PATH = '/mdm/locations';
const CLOSE_PATH = '/inventory/counts/9001:close';

const WAREHOUSE_LABEL = 'SAMPLE-WH-01 · 합성 창고 가';
const INACTIVE_WAREHOUSE_LABEL = 'SAMPLE-WH-03 · 합성 창고 다';

/**
 * 화면 어디에도 나와서는 안 되는 내부 번호(FK).
 *
 * 픽스처의 번호 대역을 그대로 쓴다 — 업무 번호(`IC-2026-900011`)에 이 문자열이 부분으로
 * 들어가지 않도록 대역을 갈라 두었다.
 */
const INTERNAL_IDS = ['9001', '9002', '9003', '9101', '9102', '9103'];

interface RecordedRequest {
  method: string;
  url: URL;
}

/**
 * 요청을 기록하면서 스텁 규칙으로 응답한다. 규칙에 없는 요청은 하네스가 던져 스텁 누락을 드러낸다.
 *
 * `hold`에 든 경로는 **기록한 뒤에** 붙잡아 둔다 — 「기다리는 동안 무엇이 보이는가」를
 * 판정하려면 응답이 오기 전에 이미 기록돼 있어야 한다.
 */
const createRecordingFetch = (
  routes: StubRoute[],
  hold: string[] = [],
): { fetch: StubFetch; requests: RecordedRequest[]; release: () => void } => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch(routes);
  let release = (): void => {
    /* 아래 Promise 생성자가 곧바로 채운다. */
  };
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const fetch: StubFetch = async (request) => {
    requests.push({ method: request.method, url: new URL(request.url) });

    if (hold.includes(new URL(request.url).pathname)) await gate;

    return stub(request);
  };

  return {
    fetch,
    requests,
    release: () => {
      release();
    },
  };
};

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const listBody = (
  items: unknown[],
  page: Partial<{ page: number; size: number; total: number }> = {},
) => ({ items, page: { page: 1, size: 50, total: items.length, ...page } });

const listRoute = (
  items: unknown[] = countFixtures,
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, LIST_PATH),
  respond: () => jsonResponse(listBody(items, page)),
});

const failingListRoute = (status: number, body: unknown = { message: '' }): StubRoute => ({
  match: (request) => isGet(request, LIST_PATH),
  respond: () => jsonResponse(body, { status }),
});

/**
 * 부를 때마다 **내용이 달라지는** 목록.
 *
 * 다시 부르기가 같은 본문을 돌려주면 캐시가 구조 공유로 **같은 참조를 그대로 유지**해,
 * 「목록 응답이 도착하면 고치던 값이 되돌아간다」는 결함이 드러나지 않는다.
 */
const changingListRoute = (): StubRoute => {
  let call = 0;

  return {
    match: (request) => isGet(request, LIST_PATH),
    respond: () => {
      call += 1;

      return jsonResponse(listBody(countFixtures, { total: countFixtures.length + call }));
    },
  };
};

const detailRoute = (
  pathname = DETAIL_PATH,
  body: unknown = countDetailBody(),
): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse(body),
});

const missingDetailRoute = (): StubRoute => ({
  match: (request) => isGet(request, MISSING_DETAIL_PATH),
  respond: () => jsonResponse({ message: '' }, { status: 404 }),
});

const failingDetailRoute = (status = 500): StubRoute => ({
  match: (request) => isGet(request, DETAIL_PATH),
  respond: () => jsonResponse({ message: '' }, { status }),
});

const warehousesRoute = (
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, WAREHOUSES_PATH),
  respond: () => jsonResponse(listBody(warehouseFixtures, page)),
});

const failingWarehousesRoute = (): StubRoute => ({
  match: (request) => isGet(request, WAREHOUSES_PATH),
  respond: () => jsonResponse({ message: '' }, { status: 500 }),
});

/** 뒤 PR의 경로들. **부를 수 있게 두는 것이 요점이다** — 부르지 않음을 증명할 수 있어야 한다. */
const futureRoutes = (): StubRoute[] => [
  { match: (request) => isGet(request, LINES_PATH), respond: () => jsonResponse({ items: [], page: { page: 1, size: 200, total: 0 } }) },
  { match: (request) => isGet(request, LOCATIONS_PATH), respond: () => jsonResponse(listBody([])) },
  {
    match: (request) => request.method === 'POST' && new URL(request.url).pathname === LIST_PATH,
    respond: () => jsonResponse(countDetailBody(), { status: 201 }),
  },
  {
    match: (request) => request.method === 'PUT' && new URL(request.url).pathname === LINES_PATH,
    respond: () => jsonResponse({ items: [], page: { page: 1, size: 200, total: 0 } }),
  },
  {
    match: (request) => request.method === 'POST' && new URL(request.url).pathname === CLOSE_PATH,
    respond: () => jsonResponse(countDetailBody()),
  },
];

/** 이 화면이 닿을 수 있는 경로를 전부 스텁으로 둔 한 벌. */
const allRoutes = (extra: StubRoute[] = []): StubRoute[] => [
  ...extra,
  listRoute(),
  detailRoute(),
  detailRoute(OTHER_DETAIL_PATH, countDetailBody({ inventoryCountId: 9003 })),
  missingDetailRoute(),
  warehousesRoute(),
  ...futureRoutes(),
];

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
  hold: string[] = [],
): {
  requests: RecordedRequest[];
  release: () => void;
  user: ReturnType<typeof userEvent.setup>;
} => {
  const { fetch, requests, release } = createRecordingFetch(routes, hold);

  renderWithProviders(
    <>
      <StocktakingScreen />
      <LocationProbe />
      <BackProbe />
      <SearchProbe to={navigateTo} />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, release, user: userEvent.setup() };
};

const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

const lastQuery = (requests: RecordedRequest[], pathname: string): URLSearchParams | undefined =>
  requestsTo(requests, pathname).at(-1)?.url.searchParams;

const currentLocation = (): string => screen.getByTestId('location').textContent ?? '';

const listTable = (): HTMLElement => screen.getByRole('table');

const selectCount = async (
  user: ReturnType<typeof userEvent.setup>,
  inventoryCountNo: string,
): Promise<void> => {
  await user.click(screen.getByRole('button', { name: t.actions.selectRow(inventoryCountNo) }));
};

/**
 * 첫 목록이 그려질 때까지 기다린다. 이 뒤라야 「무엇이 바뀌었는가」를 잴 수 있다.
 *
 * `findAll`을 쓴다 — 고른 실사가 있으면 같은 실사번호가 표와 제목줄에 **둘** 나온다.
 */
const waitForList = async (): Promise<void> => {
  await screen.findAllByText('IC-2026-900011');
};

describe('StocktakingScreen — 첫 진입 조회', () => {
  /*
   * **M01** — 기본 기간을 심으면 첫 요청에 날짜가 실리고, 사용자는 왜 그 기간만 보이는지
   * 화면 어디에서도 읽을 수 없다(W-01-09가 세운 규칙).
   */
  it('목록 요청이 1회 나가고 조건이 하나도 실리지 않는다', async () => {
    const { requests } = renderScreen(allRoutes());

    await waitForList();

    const list = requestsTo(requests, LIST_PATH);

    expect(list).toHaveLength(1);
    expect(list[0]?.url.searchParams.has('plannedDateFrom')).toBe(false);
    expect(list[0]?.url.searchParams.has('plannedDateTo')).toBe(false);
    /* 짝 방향 — 조건 자체가 하나도 실리지 않는다. */
    expect([...(list[0]?.url.searchParams.keys() ?? [])]).toEqual([]);
  });

  it('조건을 심지 않고 주소를 그대로 둔다', async () => {
    renderScreen(allRoutes());

    await waitForList();

    expect(currentLocation()).toBe(ROUTE);
  });

  it('결과가 표에 그려지고 배너가 없다', async () => {
    renderScreen(allRoutes());

    await waitForList();

    expect(within(listTable()).getAllByRole('row')).toHaveLength(countFixtures.length + 1);
    expect(screen.queryByText(messages.httpError.loadTitle)).not.toBeInTheDocument();
  });

  /** 창고는 목록 표의 칸이 곧바로 쓰는 이름이라 첫 진입에 함께 받는다. */
  it('창고 목록을 1회 조회하고 미사용까지 받는다', async () => {
    const { requests } = renderScreen(allRoutes());

    await waitForList();

    const warehouses = requestsTo(requests, WAREHOUSES_PATH);

    expect(warehouses).toHaveLength(1);
    expect(warehouses[0]?.url.searchParams.get('includeInactive')).toBe('true');
  });

  /*
   * **M18** — 고른 실사가 없으면 상세를 부를 대상이 없다. `enabled`를 없애면 `ct` 없이도
   * 상세 경로로 요청이 나간다(그 경로는 번호 없이는 만들어지지도 않는다).
   */
  it('고르지 않았으면 상세를 부르지 않는다', async () => {
    const { requests } = renderScreen(allRoutes());

    await waitForList();

    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(0);
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  /*
   * **M13** — 이 PR에서 화면이 보내는 요청은 **전부 읽기다.** 쓰기 셋과 라인·위치 경로를
   * 스텁으로 두고, **기록된 모든 요청**의 method가 GET인지 본다. 경로 하나만 세면 잘못된
   * 경로로 나간 요청이 「부르지 않았다」를 통과한다.
   */
  it('어떤 쓰기 요청도 보내지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForList();
    await selectCount(user, 'IC-2026-900011');
    await screen.findByRole('group', { name: t.detail.summaryLabel });

    expect(requests).not.toHaveLength(0);
    expect(requests.map((request) => request.method)).toEqual(requests.map(() => 'GET'));
    expect(requestsTo(requests, LINES_PATH)).toHaveLength(0);
    expect(requestsTo(requests, LOCATIONS_PATH)).toHaveLength(0);
    expect(requestsTo(requests, CLOSE_PATH)).toHaveLength(0);
  });

  /*
   * **C14** — 값 목록이 확정되지 않아 조건의 실사 유형·상태 선택지가 비어 있다.
   * 화면 수준에서도 그 안내가 실제로 붙는지 본다.
   */
  it('실사 유형·상태 선택지가 비어 있고 안내가 붙는다', async () => {
    renderScreen(allRoutes());

    await waitForList();

    expect(screen.getAllByText(messages.pendingCode.note)).toHaveLength(2);
  });
});

describe('StocktakingScreen — 조건과 주소', () => {
  /* **M02** — 조건을 컴포넌트 상태로만 들고 있으면 새로고침·공유가 같은 결과를 내지 못한다. */
  it('조건을 걸면 주소와 요청에 함께 실린다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForList();

    await user.click(screen.getByRole('checkbox', { name: t.fields.inProgressOnly }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?prog=1`);
    });

    await waitFor(() => {
      expect(lastQuery(requests, LIST_PATH)?.get('inProgressOnly')).toBe('true');
    });
  });

  /* **C03** — 그 주소로 다시 들어가면 같은 조건으로 조회한다. */
  it('주소로 들어가면 그 조건으로 조회한다', async () => {
    const { requests } = renderScreen(
      allRoutes(),
      '?wh=9101&from=2026-08-01&to=2026-08-31&ty=SAMPLE_COUNT_TYPE_A&st=SAMPLE_COUNT_STATUS_A&prog=1',
    );

    await waitForList();

    const query = lastQuery(requests, LIST_PATH);

    expect(query?.get('warehouseId')).toBe('9101');
    expect(query?.get('plannedDateFrom')).toBe('2026-08-01');
    expect(query?.get('plannedDateTo')).toBe('2026-08-31');
    expect(query?.get('countTypeCode')).toBe('SAMPLE_COUNT_TYPE_A');
    expect(query?.get('statusCode')).toBe('SAMPLE_COUNT_STATUS_A');
    expect(query?.get('inProgressOnly')).toBe('true');
  });

  /*
   * **C06** — 주소는 손으로 고쳐지는 자리다. 정수가 아닌 번호를 그대로 실으면 `NaN`이 요청에
   * 실려 조회 전체가 실패하는데, 사용자에게는 「조회가 늘 안 된다」로만 보인다.
   */
  it('이상한 주소값을 요청에 싣지 않는다', async () => {
    const { requests } = renderScreen(allRoutes(), '?wh=abc&page=0&ct=xyz&loc=0&prog=maybe');

    await waitForList();

    const query = lastQuery(requests, LIST_PATH);

    expect([...(query?.keys() ?? [])]).toEqual([]);
    /* 짝 방향 — 고르지 않은 것으로 읽혀 상세도 부르지 않는다. */
    expect(requests.filter((request) => request.url.pathname.startsWith('/inventory/counts/'))).toHaveLength(0);
  });

  /*
   * **M04** — 조건이 바뀌면 고른 실사가 새 결과에 없을 수 있다. `page`·`ct`·`loc`를 남기면
   * 아래 구획이 없는 실사를 가리킨 채 주소만 남는다(수명 표 1행).
   */
  it('조건 변경이 첫 쪽으로 되돌리고 고른 실사·위치를 비운다', async () => {
    const { user } = renderScreen(allRoutes(), '?page=2&ct=9001&loc=9701');

    await waitForList();

    await user.click(screen.getByRole('checkbox', { name: t.fields.inProgressOnly }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?prog=1`);
    });
  });

  it('초기화가 조건과 선택을 모두 비운다', async () => {
    const { user } = renderScreen(allRoutes(), '?wh=9101&prog=1&page=3&ct=9001&loc=9701');

    await waitForList();

    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  /*
   * **M03** — 조건과 쪽을 따로 갱신하면 뒤로가기 기록이 두 칸 늘어, 뒤로 눌렀는데 같은 자리로
   * 돌아온 것처럼 보인다. 한 칸 뒤로 갔을 때 **처음 주소**로 돌아오는지가 그 잣대다.
   */
  it('조작당 주소 갱신이 1회다', async () => {
    const { user } = renderScreen(allRoutes(), '?page=2');

    await waitForList();

    await user.click(screen.getByRole('checkbox', { name: t.fields.inProgressOnly }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?prog=1`);
    });

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?page=2`);
    });
  });

  /* **M15** — 고치는 동안 주소가 바뀌면 글자마다 뒤로가기 기록이 쌓이고 요청도 그만큼 나간다. */
  it('조건을 고치는 동안에는 주소가 바뀌지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForList();

    const before = requestsTo(requests, LIST_PATH).length;

    await user.click(screen.getByRole('checkbox', { name: t.fields.inProgressOnly }));

    expect(currentLocation()).toBe(ROUTE);
    expect(requestsTo(requests, LIST_PATH)).toHaveLength(before);
  });

  /*
   * **M14** — 목록 응답이 도착할 때마다 조건 줄을 되돌리면 사용자가 고르던 값이 사라진다(#43).
   * 응답 본문이 매번 달라 캐시가 새 참조를 내려 주는 상태에서 검사한다.
   */
  it('목록이 다시 도착해도 고치던 조건이 사라지지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes([changingListRoute()]));

    await waitForList();

    await user.click(screen.getByRole('checkbox', { name: t.fields.inProgressOnly }));

    const before = requestsTo(requests, LIST_PATH).length;

    await user.click(screen.getByRole('button', { name: t.actions.refresh }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(before);
    });

    expect(screen.getByRole('checkbox', { name: t.fields.inProgressOnly })).toBeChecked();
  });
});

describe('StocktakingScreen — 쪽 이동', () => {
  /* **M05** — 쪽이 바뀌면 보이는 행이 통째로 달라진다. 고른 실사를 남기면 그 실사가 화면에 없다. */
  it('쪽 이동이 쪽만 옮기고 고른 실사·위치를 비운다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([listRoute(countFixtures, { total: 120 })]),
      '?wh=9101&ct=9001&loc=9701',
    );

    await waitForList();

    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?wh=9101&page=2`);
    });

    await waitFor(() => {
      expect(lastQuery(requests, LIST_PATH)?.get('page')).toBe('2');
    });
  });

  it('쪽 밖이면 첫 쪽 안내를 내고 첫 쪽으로 되돌린다', async () => {
    const { user } = renderScreen(allRoutes([listRoute([], { page: 3, total: 10 })]), '?page=3');

    await screen.findByText(t.empty.beyondLastTitle);

    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  /* **C07** — 결과가 없는 것과 쪽 밖인 것은 사용자가 할 조치가 다르다. */
  it('결과가 없으면 조건을 줄이라고 안내한다', async () => {
    renderScreen(allRoutes([listRoute([])]));

    await screen.findByText(t.empty.noResultTitle);

    expect(screen.queryByText(t.empty.beyondLastTitle)).not.toBeInTheDocument();
  });
});

describe('StocktakingScreen — 조회 실패', () => {
  /*
   * **M07** — 실패를 「없습니다」로 내면 사용자가 자료가 없는 줄 알고 조건을 넓힌다.
   * 실제로는 조회 자체가 되지 않은 것이라 무엇을 해도 결과가 같다.
   */
  it('조회 실패는 배너로 내고 빈 상태 문구를 함께 내지 않는다', async () => {
    renderScreen(allRoutes([failingListRoute(500)]));

    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.beyondLastTitle)).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('권한이 없으면 다시 시도를 내지 않는다', async () => {
    renderScreen(allRoutes([failingListRoute(403)]));

    await screen.findByText(messages.httpError.forbidden);

    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  /* **M09** — 버튼만 두고 다시 부르기를 잇지 않으면 눌러도 아무 일이 없다. 요청 수로 잰다. */
  it('다시 시도를 누르면 그 경로의 요청 수가 는다', async () => {
    const { requests, user } = renderScreen(allRoutes([failingListRoute(500)]));

    await screen.findByText(messages.httpError.loadTitle);

    const before = requestsTo(requests, LIST_PATH).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(before);
    });
  });
});

describe('StocktakingScreen — 실사 고르기와 요약', () => {
  /*
   * **C10** — 고르면 상세를 1회 부르고, 요약 4칸은 **서버가 준 숫자 그대로**다.
   * 라인을 부르지 않는다는 것이 「화면이 세지 않는다」의 구조적 근거다.
   */
  it('실사를 고르면 상세를 1회 부르고 요약 4칸을 그대로 보인다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForList();
    await selectCount(user, 'IC-2026-900011');

    const summary = await screen.findByRole('group', { name: t.detail.summaryLabel });

    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(1);
    expect(within(summary).getByText('40')).toBeInTheDocument();
    expect(within(summary).getByText('25')).toBeInTheDocument();
    expect(within(summary).getByText('15')).toBeInTheDocument();
    expect(within(summary).getByText('6')).toBeInTheDocument();
    expect(requestsTo(requests, LINES_PATH)).toHaveLength(0);
  });

  it('고르면 주소에 실사 번호가 실리고 쪽이 유지된다', async () => {
    const { user } = renderScreen(allRoutes([listRoute(countFixtures, { total: 120 })]), '?page=2');

    await waitForList();
    await selectCount(user, 'IC-2026-900011');

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?page=2&ct=9001`);
    });
  });

  it('다시 누르면 선택이 풀리고 아래 구획이 닫힌다', async () => {
    const { user } = renderScreen(allRoutes(), '?ct=9001');

    await screen.findByRole('group', { name: t.detail.summaryLabel });

    await user.click(
      screen.getByRole('button', { name: t.actions.deselectRow('IC-2026-900011') }),
    );

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });

    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  /*
   * **S1의 근거가 목록 소속이 아니라 상세 200이다**(계획 결정 2). 목록 소속으로 판정하면
   * 조건이 좁아 목록에 없는 실사를 고른 상태가 지워진다 — 개시 직후(PR ②)에 그 일이 실제로 난다.
   */
  it('목록에 없는 실사도 상세가 200이면 열린다', async () => {
    renderScreen(allRoutes([listRoute([])]), '?ct=9001');

    await screen.findByRole('group', { name: t.detail.summaryLabel });

    expect(screen.getByText(t.empty.noResultTitle)).toBeInTheDocument();
    expect(currentLocation()).toBe(`${ROUTE}?ct=9001`);
  });

  it('상세 조회가 404가 아닌 실패면 배너와 다시 시도를 낸다', async () => {
    const { requests, user } = renderScreen(allRoutes([failingDetailRoute(500)]), '?ct=9001');

    await screen.findByText(messages.httpError.loadTitle);

    const before = requestsTo(requests, DETAIL_PATH).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, DETAIL_PATH).length).toBeGreaterThan(before);
    });
    /* 고른 실사를 주소에서 지우지 않는다 — 다시 시도로 풀릴 수 있는 실패다. */
    expect(currentLocation()).toBe(`${ROUTE}?ct=9001`);
  });

  /* **C18** — 블라인드 여부와 상태 코드가 제목줄에서 읽힌다. */
  it('제목줄이 블라인드와 상태 코드를 읽히는 값으로 보인다', async () => {
    renderScreen(
      allRoutes([detailRoute(DETAIL_PATH, countDetailBody({ blindCount: true }))]),
      '?ct=9001',
    );

    const heading = await screen.findByRole('group', { name: t.detail.label });

    expect(within(heading).getByText('예')).toBeInTheDocument();
    expect(within(heading).getByText('SAMPLE_COUNT_STATUS_A')).toBeInTheDocument();
    expect(screen.getByText(t.detail.blindNote)).toBeInTheDocument();
  });
});

describe('StocktakingScreen — 참조 풀이', () => {
  /*
   * **M10 · #47** — 참조가 본 조회보다 늦게 오는 순간이 실제로 있다. 그때 「알 수 없음」을 내면
   * *값이 잘못됐다*는 뜻이 되어 사용자에게 반대로 읽힌다.
   */
  it('참조가 아직 오지 않았으면 알 수 없음으로 내지 않는다', async () => {
    const { release } = renderScreen(allRoutes(), '', '', [WAREHOUSES_PATH]);

    await waitForList();

    expect(screen.getAllByText(t.values.referenceLoading)).toHaveLength(countFixtures.length);
    expect(screen.queryByText(t.values.unknown)).not.toBeInTheDocument();

    release();

    await screen.findAllByText(WAREHOUSE_LABEL);
  });

  /*
   * **M11 · #44** — 이름을 못 풀어도 번호를 내지 않는다. 9002의 창고(9102)는 참조 목록에 없다.
   * 짝 방향으로 「이름이 보인다」를 함께 단언한다 — 아무것도 안 그려도 통과하지 않게.
   */
  it('이름을 못 풀어도 화면 어디에도 내부 번호가 없다', async () => {
    const { user } = renderScreen(allRoutes());

    await waitForList();
    await selectCount(user, 'IC-2026-900011');
    await screen.findByRole('group', { name: t.detail.summaryLabel });

    expect(screen.getAllByText(WAREHOUSE_LABEL)).not.toHaveLength(0);
    expect(screen.getByText(t.values.unknown)).toBeInTheDocument();

    const panes = [
      screen.getByRole('region', { name: t.panes.list }),
      screen.getByRole('region', { name: t.panes.detail }),
    ];

    for (const pane of panes) {
      for (const id of INTERNAL_IDS) {
        expect(pane.textContent ?? '').not.toContain(id);
      }
    }
  });

  /*
   * **C12** — 목록이 앞쪽만 오면 고를 수 없는 값이 생기는데, 밝히지 않으면 사용자가
   * 「그런 창고가 없다」로 결론짓는다.
   */
  it('창고 목록이 잘리면 그 사실을 밝힌다', async () => {
    renderScreen(allRoutes([warehousesRoute({ total: 40 })]));

    await waitForList();

    expect(screen.getByText(t.filters.lookupTruncated)).toBeInTheDocument();
  });

  it('참조 조회가 실패하면 사유를 내고 다시 시도가 요청을 늘린다', async () => {
    const { requests, user } = renderScreen(allRoutes([failingWarehousesRoute()]));

    await waitForList();

    expect(screen.getByText(t.reasons.warehouseReferenceFailed)).toBeInTheDocument();

    const before = requestsTo(requests, WAREHOUSES_PATH).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, WAREHOUSES_PATH).length).toBeGreaterThan(before);
    });
  });

  /** 미사용 창고를 선택지에서 빼지 않고 표식만 붙인다 — 빼면 그 실사를 찾을 방법이 사라진다. */
  it('미사용 창고를 선택지에 남기고 표식을 붙인다', async () => {
    const { user } = renderScreen(allRoutes());

    await waitForList();

    await user.click(screen.getByLabelText(t.fields.warehouse));

    expect(
      screen.getByText(`${INACTIVE_WAREHOUSE_LABEL}${t.values.inactiveSuffix}`),
    ).toBeInTheDocument();
  });
});

describe('StocktakingScreen — 다시 조회', () => {
  /*
   * **M17** — 목록만 다시 부르면 요약 4칸이 낡은 채로 남아 갱신된 값과 갱신되지 않은 값이
   * 한 화면에 섞인다(W-01-07의 Major 지적). 요약은 마감 가능 여부를 정하는 값이라(PR ④)
   * 낡으면 그 판단 자체가 낡는다.
   */
  it('고른 실사가 있으면 목록과 상세를 함께 다시 부른다', async () => {
    const { requests, user } = renderScreen(allRoutes(), '?ct=9001');

    await screen.findByRole('group', { name: t.detail.summaryLabel });

    const listBefore = requestsTo(requests, LIST_PATH).length;
    const detailBefore = requestsTo(requests, DETAIL_PATH).length;
    const before = currentLocation();

    await user.click(screen.getByRole('button', { name: t.actions.refresh }));

    await waitFor(() => {
      expect(requestsTo(requests, DETAIL_PATH).length).toBeGreaterThan(detailBefore);
    });

    expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(listBefore);
    /* 다시 조회는 조건·선택을 하나도 바꾸지 않는다(수명 표 10행). */
    expect(currentLocation()).toBe(before);
  });

  /*
   * 짝 방향 — **고른 실사가 없으면 상세를 부를 대상이 없다.** 이 단언이 없으면
   * 「전부 다시 부른다」가 「아무 때나 부른다」로 넓어져도 드러나지 않는다.
   */
  it('고르지 않았으면 다시 조회가 상세를 부르지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForList();

    const listBefore = requestsTo(requests, LIST_PATH).length;

    await user.click(screen.getByRole('button', { name: t.actions.refresh }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(listBefore);
    });

    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(0);
  });

  /** 아무것도 하지 않는 동안 요청이 늘지 않는다 — 이 화면은 스스로 갱신하지 않는다. */
  it('아무것도 하지 않으면 요청이 늘지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForList();

    const before = requestsTo(requests, LIST_PATH).length;

    await user.click(screen.getByLabelText(t.fields.warehouse));
    await user.keyboard('{Escape}');

    expect(requestsTo(requests, LIST_PATH)).toHaveLength(before);
  });
});

describe('StocktakingScreen — 그 실사가 없을 때', () => {
  /*
   * **C15** — 상세가 404면 주소에서 고른 실사와 위치를 정리하고, **무엇이 왜 사라졌는지**를
   * 안내로 남긴다. 정리만 하고 말하지 않으면 「아직 고르지 않았다」와 구분되지 않는다.
   */
  it('상세가 404면 고른 실사·위치를 주소에서 정리하고 안내한다', async () => {
    renderScreen(allRoutes(), '?wh=9101&ct=9999&loc=9701');

    await screen.findByText(t.empty.notFoundTitle);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?wh=9101`);
    });
  });

  /*
   * **M20** — 정리를 클릭 핸들러에 두면 **뒤로가기·앞으로가기·주소 직접 편집이 통째로 샌다.**
   * 화면 바깥에서 주소만 갈아 끼워 그 경로를 만든다.
   */
  it('주소만 바뀌어 없는 실사를 가리켜도 정리된다', async () => {
    const { user } = renderScreen(allRoutes(), '', 'ct=9999');

    await waitForList();

    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await screen.findByText(t.empty.notFoundTitle);

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  /* 정리한 뒤 다른 실사를 고르면 앞의 안내를 거둔다 — 남으면 요약 옆에 「없습니다」가 함께 선다. */
  it('다시 고르면 없음 안내를 거둔다', async () => {
    const { user } = renderScreen(allRoutes(), '?ct=9999');

    await screen.findByText(t.empty.notFoundTitle);

    await selectCount(user, 'IC-2026-900011');

    await screen.findByRole('group', { name: t.detail.summaryLabel });

    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
  });
});
