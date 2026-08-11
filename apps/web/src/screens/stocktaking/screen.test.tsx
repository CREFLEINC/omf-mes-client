import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import {
  countDetailBody,
  countFixtures,
  OPENED_COUNT_ID,
  OPENED_COUNT_NO,
  openedCountDetailBody,
  warehouseFixtures,
} from './fixtures';
import { StocktakingScreen } from './screen';
import { OPEN_FIELD_NAMES } from './validation';

const t = messages.stocktaking;

/**
 * **값 목록이 확정된 뒤의 화면**을 이 파일에서 만들어 내기 위한 자리.
 *
 * 자리표시 상수는 지금 **비어 있고**(`code-options.test.ts`가 그 사실을 고정한다) 비어 있는
 * 동안에는 「실사 개시」가 통째로 잠긴다(승인 G1). 그런데 이 PR의 값어치는 **잠금이 풀린 뒤에
 * 무엇이 일어나는가**에 있다 — 요청에 무엇이 실리는지, 전송 중에 무엇이 닫히는지, 성공·실패가
 * 어떻게 보이는지는 배열이 채워진 상태에서만 확인할 수 있다.
 *
 * 그래서 **배열만 갈아 끼운다.** 판정·선택지 만들기·검증은 실물 그대로이고, 바뀌는 것은
 * 「값 목록이 왔다」는 사실 하나다 — 값 목록이 확정되면 실제로 그 한 가지만 달라진다.
 * 매 테스트 앞에서 빈 배열로 되돌려, 아무것도 채우지 않은 테스트는 **지금의 화면**을 본다.
 */
const { codeValues } = vi.hoisted(() => ({
  codeValues: {
    countType: [] as string[],
    status: [] as string[],
    varianceReason: [] as string[],
  },
}));

vi.mock('./code-options', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./code-options')>();

  return { ...actual, PLACEHOLDER_STOCKTAKING_CODES: codeValues };
});

/** 지어낸 합성 코드. **계약의 `@example` 값을 쓰지 않는다** — 예시가 확정 값으로 읽히면 안 된다. */
const SAMPLE_COUNT_TYPE = 'SAMPLE_COUNT_TYPE_D';

const clearCodeLists = (): void => {
  codeValues.countType = [];
  codeValues.status = [];
  codeValues.varianceReason = [];
};

/** 값 목록이 확정된 뒤. **배열만 채운다** — 다른 자리는 손대지 않는다. */
const fillCodeLists = (values: string[] = [SAMPLE_COUNT_TYPE]): void => {
  codeValues.countType = values;
};

beforeEach(clearCodeLists);

const ROUTE = '/logistics/stocktaking';
const LIST_PATH = '/inventory/counts';
const DETAIL_PATH = '/inventory/counts/9001';
const OTHER_DETAIL_PATH = '/inventory/counts/9003';
const OPENED_DETAIL_PATH = `/inventory/counts/${String(OPENED_COUNT_ID)}`;
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
  /**
   * **보낸 헤더를 그대로 담는다.** 「`If-Match`를 보내지 않는다」(C28)는 본문으로는 알 수
   * 없다 — 헤더가 실제로 어떻게 나갔는지 재는 자리가 여기뿐이다.
   */
  headers: Headers;
  /** 읽기에는 본문이 없다. 쓰기만 담는다. */
  body: unknown;
}

/**
 * 요청을 기록하면서 스텁 규칙으로 응답한다. 규칙에 없는 요청은 하네스가 던져 스텁 누락을 드러낸다.
 *
 * `hold`가 고른 요청은 **기록한 뒤에** 붙잡아 둔다 — 「기다리는 동안 무엇이 보이는가」를
 * 판정하려면 응답이 오기 전에 이미 기록돼 있어야 한다.
 *
 * **경로가 아니라 요청으로 고른다.** 실사 목록 조회와 개시가 **같은 경로**(`/inventory/counts`)를
 * 쓰므로 경로만으로 고르면 개시를 붙잡으려다 목록 조회까지 함께 멈춘다 — 그러면 「전송 중」을
 * 만들기 전에 화면이 그려지지 않는다.
 */
const createRecordingFetch = (
  routes: StubRoute[],
  hold: (request: Request) => boolean = () => false,
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
    /* 본문은 한 번만 읽을 수 있다 — 복제해 읽어야 스텁이 그대로 다시 읽을 수 있다. */
    const body: unknown = request.method === 'GET' ? null : await request.clone().json();

    requests.push({
      method: request.method,
      url: new URL(request.url),
      headers: new Headers(request.headers),
      body,
    });

    if (hold(request)) await gate;

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

/**
 * 9003의 상세. **9001과 값이 하나도 겹치지 않는다.**
 *
 * 겹치면 「다른 실사를 골랐는데 앞 실사의 요약이 그대로 보인다」를 값으로 가려낼 수 없다 —
 * 상세 캐시 키가 실사 번호를 잃으면 정확히 그 일이 난다.
 */
const OTHER_DETAIL_BODY = countDetailBody(
  {
    inventoryCountId: 9003,
    inventoryCountNo: 'IC-2026-900013',
    countTypeCode: 'SAMPLE_COUNT_TYPE_B',
    plannedDate: '2026-08-07',
  },
  { plannedCount: 12, countedCount: 7, uncountedCount: 5, varianceCount: 3 },
);

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

const isOpenRequest = (request: Request): boolean =>
  request.method === 'POST' && new URL(request.url).pathname === LIST_PATH;

/** 개시 201 — 만들어진 실사가 **목록 셋 어디에도 없는 번호**로 온다. */
const openRoute = (): StubRoute => ({
  match: isOpenRequest,
  respond: () => jsonResponse(openedCountDetailBody(), { status: 201 }),
});

const failingOpenRoute = (status: number, body: unknown = { message: '' }): StubRoute => ({
  match: isOpenRequest,
  respond: () => jsonResponse(body, { status }),
});

/** 응답 자체가 오지 않는 갈래. **다시 보내면 전표가 두 벌 생기는** 유일한 실패다. */
const offlineOpenRoute = (): StubRoute => ({
  match: isOpenRequest,
  respond: () => {
    throw new TypeError('Failed to fetch');
  },
});

/**
 * 첫 개시는 되고 **둘째 개시가 막히는** 갈래.
 *
 * 결과 구획을 세운 **뒤에** 실패하는 순서를 만드는 유일한 수단이다 — 실패 테스트가 늘 빈
 * 화면에서 시작하면 「실패하면 결과 구획을 비운다」(수명 표 12행)가 아무것도 재지 못한다.
 */
const openThenForbiddenRoute = (): StubRoute => {
  let call = 0;

  return {
    match: isOpenRequest,
    respond: () => {
      call += 1;

      return call === 1
        ? jsonResponse(openedCountDetailBody(), { status: 201 })
        : jsonResponse({ message: '' }, { status: 403 });
    },
  };
};

/** 뒤 PR의 경로들. **부를 수 있게 두는 것이 요점이다** — 부르지 않음을 증명할 수 있어야 한다. */
const futureRoutes = (): StubRoute[] => [
  { match: (request) => isGet(request, LINES_PATH), respond: () => jsonResponse({ items: [], page: { page: 1, size: 200, total: 0 } }) },
  { match: (request) => isGet(request, LOCATIONS_PATH), respond: () => jsonResponse(listBody([])) },
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
  detailRoute(OTHER_DETAIL_PATH, OTHER_DETAIL_BODY),
  /* 개시로 만들어진 실사의 상세 — `ct`가 그리로 옮겨 가면 곧바로 불린다. */
  detailRoute(OPENED_DETAIL_PATH, openedCountDetailBody()),
  missingDetailRoute(),
  warehousesRoute(),
  openRoute(),
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
  hold: (request: Request) => boolean = () => false,
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

/**
 * **한 실사에 매달린 경로로 나간 요청 전부.** 경로 하나만 세면 **잘못된 번호로 나간 요청이
 * 「부르지 않았다」를 통과한다** — `enabled` 가드가 무너지면 번호 자리에 `0`이나 `undefined`가
 * 박힌 경로로 나가는데, `/inventory/counts/9001`만 세는 단언은 그것을 보지 못한다.
 *
 * 계획 §5.2가 「요청 계수는 경로 전체를 센다」로 못 박은 자리이고, M13이 이미 그 형태로
 * 구현돼 있다 — M18도 같은 잣대를 쓴다. 접두에는 상세·라인·마감이 모두 걸리며,
 * 이 PR에서는 셋 다 0이어야 하므로 더 엄한 잣대가 맞다.
 */
const COUNT_SCOPED_PREFIX = '/inventory/counts/';

const countScopedRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname.startsWith(COUNT_SCOPED_PREFIX));

const lastQuery = (requests: RecordedRequest[], pathname: string): URLSearchParams | undefined =>
  requestsTo(requests, pathname).at(-1)?.url.searchParams;

const currentLocation = (): string => screen.getByTestId('location').textContent ?? '';

const listTable = (): HTMLElement => screen.getByRole('table');

/**
 * 구획별 조회기.
 *
 * **PR ②부터 같은 이름의 칸이 두 자리에 선다** — 조건 줄의 「창고」·「실사 유형」은 **좁히는
 * 조건**이고 개시 구획의 그것은 **만들 값**이다. 화면 전체에서 이름으로 찾으면 둘이 섞여,
 * 조건을 검사하는 단언이 개시 폼을 보고 통과할 수 있다.
 */
const listPane = (): HTMLElement => screen.getByRole('region', { name: t.panes.list });

const openPane = (): HTMLElement => screen.getByRole('region', { name: t.panes.open });

const detailPane = (): HTMLElement => screen.getByRole('region', { name: t.panes.detail });

const summaryGroup = (): HTMLElement =>
  screen.getByRole('group', { name: t.detail.summaryLabel });

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

/**
 * **개시 요청만 센다.** 목록 조회와 **경로가 같으므로**(`/inventory/counts`) 경로만 세면
 * 첫 진입의 GET이 「개시가 나갔다」로 읽힌다 — 요청 0회를 증명하는 단언이 전부 무너진다.
 */
const openRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.method === 'POST' && request.url.pathname === LIST_PATH);

const openButton = (): HTMLElement =>
  within(openPane()).getByRole('button', { name: t.actions.open });

const confirmDialog = (): HTMLElement => screen.getByRole('dialog');

const chooseOption = async (
  user: ReturnType<typeof userEvent.setup>,
  pane: HTMLElement,
  label: string,
  option: string,
): Promise<void> => {
  await user.click(within(pane).getByLabelText(label));
  await user.click(screen.getByRole('option', { name: option }));
};

/** 개시할 수 있는 상태까지 채운다. **값 목록이 채워진 뒤에만 쓸 수 있다**(그전에는 고를 것이 없다). */
const fillOpenDraft = async (
  user: ReturnType<typeof userEvent.setup>,
  plannedDate = '2026-08-12',
): Promise<void> => {
  await chooseOption(user, openPane(), t.fields.countType, SAMPLE_COUNT_TYPE);
  await chooseOption(user, openPane(), t.fields.warehouse, WAREHOUSE_LABEL);

  if (plannedDate !== '') {
    await user.type(within(openPane()).getByLabelText(t.fields.plannedDate), plannedDate);
  }
};

/** 값 목록을 채우고 화면을 띄운 뒤 개시할 수 있는 상태까지 만든다. */
const setupReadyToOpen = async (
  routes: StubRoute[] = allRoutes(),
  search = '',
  navigateTo = '',
  hold: (request: Request) => boolean = () => false,
) => {
  fillCodeLists();

  const rendered = renderScreen(routes, search, navigateTo, hold);

  await waitForList();
  await fillOpenDraft(rendered.user);

  return rendered;
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
   * **M18** — 고른 실사가 없으면 상세를 부를 대상이 없다. `enabled`와 가드를 없애면 번호 자리에
   * `0`이 박힌 경로로 요청이 나간다 — **경로 하나만 세면 그 요청이 「부르지 않았다」를 통과한다.**
   * 그래서 실사에 매달린 경로 전체를 센다(계획 §5.2 · M13과 같은 잣대).
   */
  it('고르지 않았으면 실사에 매달린 어떤 경로도 부르지 않는다', async () => {
    const { requests } = renderScreen(allRoutes());

    await waitForList();

    expect(countScopedRequests(requests)).toHaveLength(0);
    /* 짝 방향 — 목록은 실제로 불렀다(아무 요청도 안 나가서 통과하는 것이 아니다). */
    expect(requestsTo(requests, LIST_PATH)).toHaveLength(1);
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  /*
   * **M13** — **조회하고 고르기만 해서는 어떤 쓰기도 나가지 않는다.** 쓰기 셋과 라인·위치
   * 경로를 스텁으로 두고, **기록된 모든 요청**의 method가 GET인지 본다. 경로 하나만 세면
   * 잘못된 경로로 나간 요청이 「부르지 않았다」를 통과한다.
   *
   * PR ②에서 개시가 붙었으나 그것은 **확인 창을 거쳐야만** 나간다 — 이 흐름에는 그 조작이
   * 없으므로 여전히 전부 읽기여야 한다.
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

    /* **조건 줄 안에서만 센다** — 개시 구획의 실사 유형에도 같은 안내가 붙는다(별개의 자리다). */
    expect(within(listPane()).getAllByText(messages.pendingCode.note)).toHaveLength(2);
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

  /*
   * **고른 실사마다 상세 캐시가 갈린다.** 캐시 키가 실사 번호를 잃으면 다른 실사를 골라도
   * ①새 요청이 나가지 않고 ②앞 실사의 요약 4칸이 그대로 남는다 — 그 숫자가 마감 가능
   * 여부를 정하는 값이라(PR ④) 낡은 채로 남으면 **다른 실사의 요약을 보고 마감을 판단**하게 된다.
   *
   * 두 방향을 함께 단언한다 — 요청이 실제로 나갔는가, 그리고 **그 응답의 값이 보이는가.**
   */
  it('다른 실사를 고르면 그 실사를 새로 부르고 요약이 바뀐다', async () => {
    const { requests, user } = renderScreen(allRoutes(), '?ct=9001');

    await screen.findByRole('group', { name: t.detail.summaryLabel });

    expect(within(summaryGroup()).getByText('40')).toBeInTheDocument();

    await selectCount(user, 'IC-2026-900013');

    await waitFor(() => {
      expect(requestsTo(requests, OTHER_DETAIL_PATH)).toHaveLength(1);
    });

    await waitFor(() => {
      expect(within(summaryGroup()).getByText('12')).toBeInTheDocument();
    });

    const summary = summaryGroup();

    expect(within(summary).getByText('7')).toBeInTheDocument();
    expect(within(summary).getByText('5')).toBeInTheDocument();
    expect(within(summary).getByText('3')).toBeInTheDocument();
    /* 앞 실사의 숫자가 한 칸이라도 남아 있으면 안 된다. */
    expect(within(summary).queryByText('40')).not.toBeInTheDocument();
    expect(within(summary).queryByText('25')).not.toBeInTheDocument();
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
    const { release } = renderScreen(allRoutes(), '', '', (request) =>
      isGet(request, WAREHOUSES_PATH),
    );

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

    /* 표의 두 줄(9001·9003)과 제목줄 하나 — 건수를 못 박아야 「이름이 보인다」가 실제 단언이 된다. */
    expect(screen.getAllByText(WAREHOUSE_LABEL)).toHaveLength(3);
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

    /*
     * **창고를 고르는 자리가 둘이라 둘 다 밝혀야 한다**(PR ②에서 개시 구획이 붙었다).
     * 한쪽만 밝히면 다른 쪽에서는 찾는 창고가 없는 것이 「그런 창고가 없다」로 읽힌다 —
     * 개시 쪽에서 그렇게 읽히면 사용자는 엉뚱한 창고로 되돌릴 수 없는 실사를 만든다.
     */
    expect(within(listPane()).getByText(t.filters.lookupTruncated)).toBeInTheDocument();
    expect(within(openPane()).getByText(t.filters.lookupTruncated)).toBeInTheDocument();
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

    await user.click(within(listPane()).getByLabelText(t.fields.warehouse));

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
  it('고르지 않았으면 다시 조회가 실사에 매달린 경로를 부르지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForList();

    const listBefore = requestsTo(requests, LIST_PATH).length;

    await user.click(screen.getByRole('button', { name: t.actions.refresh }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(listBefore);
    });

    /* 번호 자리가 무엇으로 채워지든 잡는다 — 경로 하나만 세면 `…/0`이 빠져나간다. */
    expect(countScopedRequests(requests)).toHaveLength(0);
  });

  /** 아무것도 하지 않는 동안 요청이 늘지 않는다 — 이 화면은 스스로 갱신하지 않는다. */
  it('아무것도 하지 않으면 요청이 늘지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForList();

    const before = requestsTo(requests, LIST_PATH).length;

    await user.click(within(listPane()).getByLabelText(t.fields.warehouse));
    await user.keyboard('{Escape}');

    expect(requestsTo(requests, LIST_PATH)).toHaveLength(before);
  });
});

describe('StocktakingScreen — 그 실사가 없을 때', () => {
  /*
   * **C15 · 정정 1-2의 「404 안내」 열** — 상세가 404면 주소에서 고른 실사와 위치를 정리하고,
   * **무엇이 왜 사라졌는지**를 안내로 남긴다.
   *
   * **정리가 끝난 뒤에 판정한다.** 정리 전 렌더에서는 상세가 404라는 사실만으로도 안내가
   * 그려지므로, 그 시점에 `findByText`로 해소되는 단언은 **안내의 수명을 재지 못한다** —
   * 안내 상태를 세우지 않아도(또는 세우고 곧바로 지워도) 통과한다.
   * 지켜야 하는 것은 「`ct`가 사라진 뒤에도 안내가 남는가」이고, 그 짝이 「미선택 문구가
   * 나오지 않는가」다. 주소를 지운 뒤 「아직 고르지 않았다」로 되돌아가면 사용자는 자기가
   * 무엇을 눌렀는지 되짚을 수 없다.
   */
  it('상세가 404면 주소를 정리하고 그 뒤에도 안내가 남는다', async () => {
    renderScreen(allRoutes(), '?wh=9101&ct=9999&loc=9701');

    await screen.findByText(t.empty.notFoundTitle);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?wh=9101`);
    });

    expect(screen.getByText(t.empty.notFoundTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noSelectionTitle)).not.toBeInTheDocument();
  });

  /*
   * **M20** — 정리를 클릭 핸들러에 두면 **뒤로가기·앞으로가기·주소 직접 편집이 통째로 샌다.**
   * 화면 바깥에서 주소만 갈아 끼워 그 경로를 만든다.
   *
   * 여기서도 **정리가 끝난 뒤**에 안내의 잔존을 함께 본다 — 두 경로(첫 진입·주소 편집)가
   * 같은 수명을 지켜야 한다.
   */
  it('주소만 바뀌어 없는 실사를 가리켜도 정리되고 안내가 남는다', async () => {
    const { user } = renderScreen(allRoutes(), '', 'ct=9999');

    await waitForList();

    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await screen.findByText(t.empty.notFoundTitle);

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });

    expect(screen.getByText(t.empty.notFoundTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noSelectionTitle)).not.toBeInTheDocument();
  });

  /*
   * **수명 표 1·2·3행의 「404 안내 = 비운다」.** 「세운다」와 「남는다」만 지키면 반쪽이다 —
   * 안내를 거두는 자리가 무너지면, 조건을 바꿔 새 결과를 멀쩡히 받은 뒤에도 아래 구획에
   * 「고른 실사를 찾을 수 없습니다」가 **계속 서 있다.** 그 안내가 무엇을 가리키는지 화면
   * 어디에서도 읽을 수 없고, 거두는 다른 경로는 실사를 다시 고르는 것뿐이다.
   *
   * 세 조작(조건 변경·초기화·쪽 이동)이 **`applyQuery` 한 자리를 함께 지난다.** 그래서
   * 서로 다른 호출부 둘(조건 줄의 「조회」 · 쪽 이동의 「다음」)을 골라 그 자리를 양쪽에서 센다.
   */
  it('404 안내 뒤 조건을 바꿔 조회하면 안내를 거둔다', async () => {
    const { user } = renderScreen(allRoutes(), '?ct=9999');

    await screen.findByText(t.empty.notFoundTitle);

    await user.click(screen.getByRole('checkbox', { name: t.fields.inProgressOnly }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?prog=1`);
    });

    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
    /* 짝 — 아래 구획이 사라지는 것이 아니라 「아직 고르지 않았다」로 돌아온다. */
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  it('404 안내 뒤 쪽을 옮기면 안내를 거둔다', async () => {
    const { user } = renderScreen(
      allRoutes([listRoute(countFixtures, { total: 120 })]),
      '?ct=9999',
    );

    await screen.findByText(t.empty.notFoundTitle);

    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?page=2`);
    });

    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
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

describe('StocktakingScreen — 개시가 잠겨 있는 동안', () => {
  /*
   * **M23 · C19 · 승인 G1** — 실사 유형이 요청 필수인데 값 목록이 확정되지 않았다. 화면이
   * 그럴듯한 값을 지어내면 사용자는 고를 수 있다고 믿는데 서버는 그 값을 모르고, **되돌릴 수
   * 없는 전표**에 그 코드가 실린다 — 그래서 개시가 통째로 잠기고 사유가 보인다.
   */
  it('유형 선택지가 비어 있으면 개시가 잠기고 사유가 보인다', async () => {
    const { requests } = renderScreen(allRoutes());

    await waitForList();

    expect(openButton()).toBeDisabled();
    expect(openButton()).toHaveAccessibleDescription(t.actionReasons.openCodeListPending);
    expect(openRequests(requests)).toHaveLength(0);
  });

  /* 사유는 **감추지 않고 항상 보이는 글자**로 둔다 — 툴팁만으로는 키보드 사용자가 닿을 수 없다. */
  it('잠긴 사유가 화면에 글자로 서 있다', async () => {
    renderScreen(allRoutes());

    await waitForList();

    expect(within(openPane()).getByText(t.actionReasons.openCodeListPending)).toBeInTheDocument();
  });

  /*
   * **C20** — 값 목록이 차도 칸이 비면 잠긴 채이고, **사유가 칸마다 다르다.**
   * 「무엇이 막혔는지」가 갈리지 않으면 사용자가 어디를 고쳐야 하는지 알 수 없다.
   */
  it('값 목록이 차면 사유가 「고르세요」로 바뀐다', async () => {
    fillCodeLists();

    renderScreen(allRoutes());

    await waitForList();

    expect(openButton()).toBeDisabled();
    expect(openButton()).not.toHaveAccessibleDescription(t.actionReasons.openCodeListPending);
    expect(openButton()).toHaveAccessibleDescription(t.actionReasons.openNeedsCountType);
  });

  it('창고만 비면 창고를 가리킨다', async () => {
    fillCodeLists();

    const { user } = renderScreen(allRoutes());

    await waitForList();
    await chooseOption(user, openPane(), t.fields.countType, SAMPLE_COUNT_TYPE);

    expect(openButton()).toBeDisabled();
    expect(openButton()).toHaveAccessibleDescription(t.actionReasons.openNeedsWarehouse);
  });

  it('계획일만 비면 계획일을 가리킨다', async () => {
    fillCodeLists();

    const { user } = renderScreen(allRoutes());

    await waitForList();
    await chooseOption(user, openPane(), t.fields.countType, SAMPLE_COUNT_TYPE);
    await chooseOption(user, openPane(), t.fields.warehouse, WAREHOUSE_LABEL);

    expect(openButton()).toBeDisabled();
    expect(openButton()).toHaveAccessibleDescription(t.actionReasons.openNeedsPlannedDate);
  });

  /*
   * **M19 · C19의 전환** — 값 목록이 확정될 때 고칠 자리가 `code-options.ts`의 배열 하나뿐이라는
   * 것이 이 화면의 설계다. **배열만 채우고 다른 자리를 손대지 않은 채** 개시가 열리는지 고정한다.
   */
  it('선택지가 차고 값을 다 채우면 개시가 열린다', async () => {
    const { requests } = await setupReadyToOpen();

    expect(openButton()).not.toBeDisabled();
    /* 짝 방향 — 열렸다고 저절로 나가지는 않는다. */
    expect(openRequests(requests)).toHaveLength(0);
    expect(within(openPane()).queryByText(t.actionReasons.openCodeListPending)).not.toBeInTheDocument();
  });

  /*
   * **M22 · C22** — 공백만 친 유형 코드를 보내지 않는다. 계약에 코드 `minLength`가 없어
   * **목 서버가 빈 문자열도 201로 통과시킨다**(실측) — 막는 곳이 화면뿐이다.
   */
  it('공백만인 유형 코드를 고르면 잠긴 채로 남는다', async () => {
    /* 값 목록이 공백만 담아 온 상태 — 사용자는 그것을 고를 수 있고, 보이는 글자는 없다. */
    fillCodeLists([' ']);

    const { requests, user } = renderScreen(allRoutes());

    await waitForList();
    await user.click(within(openPane()).getByLabelText(t.fields.countType));

    const options = screen.getAllByRole('option');

    expect(options).toHaveLength(1);

    await user.click(options[0] as HTMLElement);
    await chooseOption(user, openPane(), t.fields.warehouse, WAREHOUSE_LABEL);
    await user.type(within(openPane()).getByLabelText(t.fields.plannedDate), '2026-08-12');

    expect(openButton()).toBeDisabled();
    expect(openButton()).toHaveAccessibleDescription(t.actionReasons.openNeedsCountType);
    expect(openRequests(requests)).toHaveLength(0);
  });

  /*
   * **M-4** — **버튼이 열려 있는데도 보낼 수 없는 상태**가 실제로 있다. 버튼의 잠금은
   * 「비어 있는가」만 보고(`openBlockReason`), 형식·길이는 `validateOpenDraft`가 본다 —
   * 그래서 고른 코드가 상한을 넘으면 **버튼은 열린 채로 남는다.**
   *
   * 그 상태에서 눌렀을 때 **창을 열지 않고 그 칸에 오류를 붙이는 것**이 `requestOpen`의
   * 사전 판정이다. 판정이 없으면 확인 창이 먼저 뜨고, 사용자는 상한을 넘은 코드를 확인한 뒤
   * **되돌릴 수 없는 전표**를 보내려다 서버 400을 받는다 — 확인 창이 거짓 안심을 준다.
   */
  it('버튼이 열려 있어도 코드가 상한을 넘으면 창이 열리지 않는다', async () => {
    const tooLongCode = 'A'.repeat(51);

    fillCodeLists([tooLongCode]);

    const { requests, user } = renderScreen(allRoutes());

    await waitForList();
    await chooseOption(user, openPane(), t.fields.countType, tooLongCode);
    await chooseOption(user, openPane(), t.fields.warehouse, WAREHOUSE_LABEL);
    await user.type(within(openPane()).getByLabelText(t.fields.plannedDate), '2026-08-12');

    /* 짝 방향 — 버튼은 실제로 열려 있다(잠겨 있어서 창이 안 뜨는 것이 아니다). */
    expect(openButton()).not.toBeDisabled();

    await user.click(openButton());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(openPane()).getByText(t.errors.codeTooLong(50))).toBeInTheDocument();
    expect(openRequests(requests)).toHaveLength(0);
  });

  /*
   * **C21의 첫 층** — 계획일 칸이 **달력에 없는 날짜를 값으로 받지 않는다.** 네이티브
   * `type="date"`가 그것을 걸러 값이 비고, 그 뒤는 「계획일을 넣으세요」 사유가 맡는다.
   *
   * 둘째 층인 인라인 오류(`validateOpenDraft`)는 **이 층이 없는 브라우저**를 위한 것이라
   * 여기서는 재지 않는다 — 단위 테스트가 그 판정을 고정한다(M25).
   */
  it('달력에 없는 계획일은 칸이 값으로 받지 않고 잠긴 채로 남는다', async () => {
    fillCodeLists();

    const { requests, user } = renderScreen(allRoutes());

    await waitForList();
    await chooseOption(user, openPane(), t.fields.countType, SAMPLE_COUNT_TYPE);
    await chooseOption(user, openPane(), t.fields.warehouse, WAREHOUSE_LABEL);
    await user.type(within(openPane()).getByLabelText(t.fields.plannedDate), '2026-02-31');

    expect(within(openPane()).getByLabelText(t.fields.plannedDate)).toHaveValue('');
    expect(openButton()).toBeDisabled();
    expect(openButton()).toHaveAccessibleDescription(t.actionReasons.openNeedsPlannedDate);
    expect(openRequests(requests)).toHaveLength(0);
  });
});

describe('StocktakingScreen — 개시 확인 창', () => {
  /*
   * **M24 · C23** — 확인 창이 먼저 뜨고 **확인하기 전에는 요청이 0회**다. 개시는 되돌릴 수
   * 없으므로 버튼에서 곧바로 보내면 사용자가 무엇을 보냈는지 볼 기회 자체가 없다.
   */
  it('개시를 누르면 창이 먼저 뜨고 요청이 나가지 않는다', async () => {
    const { requests, user } = await setupReadyToOpen();

    await user.click(openButton());

    expect(confirmDialog()).toBeInTheDocument();
    expect(openRequests(requests)).toHaveLength(0);
  });

  /*
   * **C24** — 창이 **보낼 값 넷**을 그대로 보인다. 창고는 이름으로 풀려 오고 번호는 어디에도
   * 없다(#44). 블라인드는 읽히는 말로 온다.
   */
  it('창이 초안의 값 넷을 그대로 보인다', async () => {
    const { user } = await setupReadyToOpen();

    await user.click(within(openPane()).getByRole('checkbox', { name: t.fields.blindCount }));
    await user.click(openButton());

    const dialog = confirmDialog();

    expect(within(dialog).getByText(SAMPLE_COUNT_TYPE)).toBeInTheDocument();
    expect(within(dialog).getByText(WAREHOUSE_LABEL)).toBeInTheDocument();
    expect(within(dialog).getByText('2026-08-12')).toBeInTheDocument();
    expect(within(dialog).getByText(t.values.blindYes)).toBeInTheDocument();
    expect(within(dialog).getByText(t.dialog.openIrreversible)).toBeInTheDocument();
    expect(dialog.textContent ?? '').not.toContain('9101');
  });

  /* **C25** — 창 안에 선택칸이 없다(#45가 걸릴 자리를 만들지 않는다). 화면에서도 확인한다. */
  it('창 안에 선택칸이 없다', async () => {
    const { user } = await setupReadyToOpen();

    await user.click(openButton());

    expect(within(confirmDialog()).getByText(SAMPLE_COUNT_TYPE)).toBeInTheDocument();
    expect(within(confirmDialog()).queryAllByRole('combobox')).toHaveLength(0);
  });

  /* 닫으면 요청이 나가지 않고 **초안이 그대로 남는다** — 고칠 것이 있어 닫는 것이다. */
  it('계속 입력을 누르면 창만 닫히고 초안이 남는다', async () => {
    const { requests, user } = await setupReadyToOpen();

    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(openRequests(requests)).toHaveLength(0);
    expect(within(openPane()).getByLabelText(t.fields.countType)).toHaveTextContent(
      SAMPLE_COUNT_TYPE,
    );
  });

  /*
   * **M27 · C27** — 창이 **열린 채 주소로 대상이 바뀌면 창이 닫히고 요청이 0회**다
   * (W-01-10 리뷰 R-1). 뒤로가기·앞으로가기·주소 직접 편집은 클릭 핸들러를 거치지 않으므로
   * 핸들러에 창 닫기를 두면 그 경로가 통째로 샌다.
   */
  it('창이 열린 채 주소로 대상이 바뀌면 창이 닫힌다', async () => {
    const { requests, user } = await setupReadyToOpen(allRoutes(), '', 'ct=9003');

    await user.click(openButton());

    expect(confirmDialog()).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(openRequests(requests)).toHaveLength(0);
  });

  /*
   * **R-3 — 창 수명은 「주소 전체」에 묶인다**(수명 표 1~6행).
   *
   * 위 테스트가 바꾸는 것은 **`ct` 하나**라, effect의 축을 `selectedCountId`로 좁혀도 통과한다 —
   * 그러면 **`ct`가 없는 상태(S0)에서 조건·쪽만 바뀔 때** 창이 그대로 남는다. 수명 표는
   * 조건 변경·초기화·쪽 이동에도 「닫는다」라고 적혀 있으므로 **축마다 하나씩** 센다.
   *
   * 형태는 PR ① R-2(조건 되돌림 6축 `it.each`)가 세운 것을 그대로 쓴다 — **범위 있는 규칙은
   * 잣대도 같은 범위로 세운다.** 좁은 앵커 하나로 갈음하면 잣대가 규칙보다 좁아진다.
   *
   * **`ct`가 없는 주소에서 시작한다** — 그래야 「`ct`가 바뀌어서 닫혔다」로 통과하지 않는다.
   */
  it.each<[string, (user: ReturnType<typeof userEvent.setup>) => Promise<void>]>([
    [
      '조건 변경·조회',
      async (user) => {
        await user.click(
          within(listPane()).getByRole('checkbox', { name: t.fields.inProgressOnly }),
        );
        await user.click(within(listPane()).getByRole('button', { name: messages.common.search }));
      },
    ],
    [
      '초기화',
      async (user) => {
        await user.click(within(listPane()).getByRole('button', { name: messages.common.reset }));
      },
    ],
    [
      '쪽 이동',
      async (user) => {
        await user.click(screen.getByRole('button', { name: t.actions.nextPage }));
      },
    ],
    [
      '실사 고르기',
      async (user) => {
        await selectCount(user, 'IC-2026-900011');
      },
    ],
  ])('창이 열린 채 %s가 일어나면 창이 닫힌다', async (_label, act) => {
    fillCodeLists();

    /* 쪽 이동 축을 위해 갈 곳이 남은 목록을 준다 — 「다음」이 잠겨 있으면 그 축을 못 잰다. */
    const { requests, user } = renderScreen(
      allRoutes([listRoute(countFixtures, { total: 120 })]),
      '?wh=9101',
    );

    await waitForList();
    await fillOpenDraft(user);
    await user.click(openButton());

    /* 짝 방향 — 조작 전에는 실제로 열려 있었다(원래 안 열려서 통과하는 것이 아니다). */
    expect(confirmDialog()).toBeInTheDocument();

    await act(user);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(openRequests(requests)).toHaveLength(0);
  });

  /*
   * 두 겹의 둘째 — **보내는 자리가 스스로 한 번 더 본다**(계획 결정 3의 구현 규칙 4).
   * 창이 열린 사이 초안이 보낼 수 없는 상태가 되면, 창의 확인 버튼을 눌러도 **창을 닫고
   * 보내지 않는다.** 「버튼이 막았으니 여기서는 안 봐도 된다」는 창이 그 사이를 벌려 놓았으므로
   * 성립하지 않는다.
   */
  it('창이 열린 사이 초안이 보낼 수 없게 되면 확인해도 보내지 않는다', async () => {
    const { requests, user } = await setupReadyToOpen();

    await user.click(openButton());

    /* 창이 열린 채 계획일이 비워진다 — 버튼의 판정은 창을 열 때의 것이라 이미 낡았다. */
    await user.clear(within(openPane()).getByLabelText(t.fields.plannedDate));
    await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(openRequests(requests)).toHaveLength(0);
    /* 짝 방향 — 초안은 남아 있어 사용자가 이어서 고칠 수 있다. */
    expect(within(openPane()).getByLabelText(t.fields.countType)).toHaveTextContent(
      SAMPLE_COUNT_TYPE,
    );
  });
});

describe('StocktakingScreen — 개시 요청', () => {
  /*
   * **아래 단언들이 딛고 선 전제를 먼저 고정한다.** 개시로 만들어지는 실사가 목록 셋 가운데
   * 하나와 겹치면 「방금 만든 실사가 지금 조건의 목록에 없어도 아래 구획이 열린다」가 무엇을
   * 재는지 알 수 없게 된다 — 목록에 있어서 열린 것인지 상세가 200이라 열린 것인지 갈리지 않는다.
   */
  it('개시로 만들어지는 실사가 목록 셋과 겹치지 않는다', () => {
    expect(countFixtures.map((count) => count.inventoryCountId)).not.toContain(OPENED_COUNT_ID);
  });

  /*
   * **취소가 개시보다 앞에 선다.** 되돌릴 수 없는 것이 손 가까이 있으면 안 된다 —
   * 두 버튼의 차례가 뒤집히면 서둘러 누르는 손이 개시에 먼저 닿는다.
   */
  it('취소가 실사 개시보다 앞에 선다', async () => {
    await setupReadyToOpen();

    const cancel = within(openPane()).getByRole('button', { name: messages.common.cancel });
    const following = cancel.compareDocumentPosition(openButton()) & Node.DOCUMENT_POSITION_FOLLOWING;

    expect(following).not.toBe(0);
  });

  /*
   * **C28** — 요청 본문이 넷이고 **`If-Match`를 보내지 않는다.** 이 오퍼레이션에는 낙관적
   * 잠금이 아예 없어(실측) 빈 토큰을 실으면 계약 위반이 된다. `Idempotency-Key`는 전 쓰기에
   * 필수라 늘 실린다.
   */
  it('본문이 넷이고 If-Match를 보내지 않는다', async () => {
    const { requests, user } = await setupReadyToOpen();

    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));

    await waitFor(() => {
      expect(openRequests(requests)).toHaveLength(1);
    });

    const sent = openRequests(requests)[0];

    expect(sent?.body).toEqual({
      countTypeCode: SAMPLE_COUNT_TYPE,
      warehouseId: 9101,
      plannedDate: '2026-08-12',
      blindCount: false,
    });
    expect(sent?.headers.has('If-Match')).toBe(false);
    expect(sent?.headers.get('Idempotency-Key')).not.toBeNull();
  });

  /*
   * **C29** — 성공하면 `ct`가 **새 실사로** 옮겨지고, `loc`와 개시 초안이 비고, 결과 구획이
   * 채워지고, 목록이 다시 조회된다. **방금 만든 실사가 지금 조건의 목록에 없어도** 아래 구획이
   * 열린다 — 단계를 목록 소속이 아니라 상세 200으로 판정하기 때문이다(계획 결정 2).
   */
  it('성공하면 새 실사로 옮겨 가고 결과와 요약이 함께 선다', async () => {
    const { requests, user } = await setupReadyToOpen(allRoutes(), '?wh=9101&loc=9701');

    const listBefore = requestsTo(requests, LIST_PATH).filter(
      (request) => request.method === 'GET',
    ).length;

    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?wh=9101&ct=${String(OPENED_COUNT_ID)}`);
    });

    /*
     * 결과 구획이 업무 번호를 내고, **아래 구획 안에** 선다(계획 §5.5 배치) — 바로 위에
     * 그 실사의 제목줄과 요약이 함께 서서 「무엇을 만들었고 지금 어떤 상태인가」가 이어진다.
     */
    expect(
      within(detailPane()).getByRole('status', { name: t.result.label }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('status', { name: t.result.label })).getByText(OPENED_COUNT_NO),
    ).toBeInTheDocument();

    /* 새 실사의 상세를 부르고 그 요약이 아래 구획에 선다(9001의 40·25와 겹치지 않는 숫자다). */
    await waitFor(() => {
      expect(requestsTo(requests, OPENED_DETAIL_PATH)).toHaveLength(1);
    });

    const summary = within(detailPane()).getByRole('group', { name: t.detail.summaryLabel });

    /* 갓 만든 실사라 계획 라인과 미실사가 같은 수다 — 둘 다 그려진다. */
    expect(within(summary).getAllByText('31')).toHaveLength(2);
    /* 앞 실사의 숫자가 남아 있지 않다 — 요약이 실제로 새 실사의 것이다. */
    expect(within(summary).queryByText('40')).not.toBeInTheDocument();

    /* 목록이 다시 조회된다 — 방금 만든 전표가 목록에 나타나야 한다. */
    await waitFor(() => {
      expect(
        requestsTo(requests, LIST_PATH).filter((request) => request.method === 'GET').length,
      ).toBeGreaterThan(listBefore);
    });

    /* 초안이 비워진다 — 남으면 같은 값으로 한 번 더 보낼 수 있다(중복 전송 완화의 한 층). */
    expect(within(openPane()).getByLabelText(t.fields.plannedDate)).toHaveValue('');
    expect(openButton()).toBeDisabled();
  });

  /*
   * **M26 · C26** — 전송 중에는 **대상을 바꾸는 길이 모두 잠기고** 연타해도 요청이 1회다.
   * 열어 두면 사용자가 다른 실사·조건·쪽으로 옮긴 뒤 앞 요청의 결과가 그 맥락에 나타나고,
   * 공통 쓰기 훅이 호출마다 새 멱등 키를 만들어 두 번째 요청이 **새 전표**가 된다.
   */
  it('전송 중에는 대상을 바꿀 수 없고 연타해도 요청이 1회다', async () => {
    const { requests, release, user } = await setupReadyToOpen(
      allRoutes(),
      '',
      '',
      isOpenRequest,
    );

    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));

    await waitFor(() => {
      expect(openRequests(requests)).toHaveLength(1);
    });

    expect(openButton()).toBeDisabled();
    expect(within(listPane()).getByRole('button', { name: messages.common.search })).toBeDisabled();
    expect(
      within(listPane()).getByRole('button', { name: t.actions.selectRow('IC-2026-900011') }),
    ).toBeDisabled();
    expect(within(openPane()).getByLabelText(t.fields.countType)).toBeDisabled();
    /*
     * **취소도 함께 잠긴다.** 이 한 줄이 `requestDiscardOpenDraft`의 핸들러 가드를 「등가」로
     * 분류한 **전제**다 — 그 가드가 닿을 수 없는 것은 이 버튼이 잠겨 있기 때문이므로, 이 겹이
     * 무방비면 **두 겹이 함께 조용히 사라진다.** 그러면 전송 중 취소 → 파기가 결과 구획과
     * 실패 배너를 지워 **지금 무엇이 나가는 중인지 화면이 말하지 못한다.**
     */
    expect(
      within(openPane()).getByRole('button', { name: messages.common.cancel }),
    ).toBeDisabled();

    /* 잠금을 우회하는 길(핸들러 직접 호출)로도 대상이 바뀌지 않는다. */
    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    expect(openRequests(requests)).toHaveLength(1);

    release();

    await waitFor(() => {
      expect(currentLocation()).toContain(`ct=${String(OPENED_COUNT_ID)}`);
    });
  });

  /*
   * **M-5 · M26의 둘째 겹** — 위 테스트가 재는 것은 **컨트롤 잠금**(눈에 보이는 첫째 겹)이다.
   * 그 겹만으로는 모자란 자리가 실재한다: **조건 칩의 ×는 디자인 시스템이 잠금을 받지 않아**
   * (`StatusChipProps`에 `disabled`가 없다 — 실측) 전송 중에도 눌린다.
   *
   * 그 길로 들어오면 조건이 바뀌면서 `ct`가 풀리고, 잠시 뒤 도착한 **앞 요청의 결과가 다른
   * 조건의 맥락에 나타난다.** 그래서 `applyQuery`가 스스로 한 번 더 막는다 — 이 테스트는
   * **경로 가드 단독**을 겨눈다(컨트롤 잠금은 이 경로에 아예 없다).
   */
  it('전송 중에는 잠금을 받지 않는 조건 칩의 ×로도 대상이 바뀌지 않는다', async () => {
    const { requests, release, user } = await setupReadyToOpen(
      allRoutes(),
      '?wh=9101',
      '',
      isOpenRequest,
    );

    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));

    await waitFor(() => {
      expect(openRequests(requests)).toHaveLength(1);
    });

    const before = currentLocation();
    const listBefore = requestsTo(requests, LIST_PATH).filter(
      (request) => request.method === 'GET',
    ).length;
    const removeChip = within(listPane()).getByRole('button', {
      name: t.filters.chipRemoveWarehouse,
    });

    /* 짝 방향 — 이 버튼은 실제로 눌린다(잠겨 있어서 아무 일도 안 나는 것이 아니다). */
    expect(removeChip).not.toBeDisabled();

    await user.click(removeChip);

    expect(currentLocation()).toBe(before);
    expect(
      requestsTo(requests, LIST_PATH).filter((request) => request.method === 'GET'),
    ).toHaveLength(listBefore);

    release();

    await waitFor(() => {
      expect(currentLocation()).toContain(`ct=${String(OPENED_COUNT_ID)}`);
    });
  });
});

describe('StocktakingScreen — 개시 실패', () => {
  /*
   * **C30** — 실패가 **세 갈래**이고 문구가 서로 다르며 **입력이 남는다.**
   * **409 갈래가 없다** — 이 오퍼레이션에는 낙관적 잠금이 없어 충돌이 나오지 않는다.
   */
  it.each<[string, number, string]>([
    ['검증 실패', 400, '창고를 확인하세요.'],
    ['권한 없음', 403, messages.httpError.forbidden],
  ])('%s면 그 사유를 내고 입력이 남는다', async (_label, status, expected) => {
    const body =
      status === 400
        ? { errors: [{ scope: 'screen', code: 'INVALID', message: '창고를 확인하세요.' }] }
        : { message: '' };

    const { requests, user } = await setupReadyToOpen(
      allRoutes([failingOpenRoute(status, body)]),
    );

    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));

    expect(await screen.findByText(expected)).toBeInTheDocument();

    /* 입력이 남는다 — 실패했는데 지우면 처음부터 다시 친다. */
    expect(within(openPane()).getByLabelText(t.fields.plannedDate)).toHaveValue('2026-08-12');
    expect(openRequests(requests)).toHaveLength(1);

    /* 결과 구획이 서지 않는다 — 앞 성공의 번호가 남으면 오해한다. */
    expect(screen.queryByRole('status', { name: t.result.label })).not.toBeInTheDocument();
    /* 409 갈래가 없다 — 「최신 불러오기」가 뜰 자리가 없다. */
    expect(screen.queryByRole('button', { name: messages.conflict.reloadAction })).not.toBeInTheDocument();
    /*
     * **R-2 · 수명 표 12행** — 실패해도 **확인 창은 닫혀 있다.** 성공 경로에서는 주소가
     * 바뀌면서 창 수명 effect가 우연히 닫아 주지만 **실패 경로에는 그 우연이 없다** —
     * 남으면 실패 배너 위에 활성인 「실사 개시 실행」이 서 있고(전송 중 잠금은 응답이
     * 도착하면 풀린다) 다시 누르는 순간 새 멱등 키로 **두 벌째 전표**가 나간다.
     */
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /*
   * **응답을 받지 못한 갈래에만 한 줄을 더한다**(중복 전송 완화의 셋째 층). 공통 문구는
   * 「다시 시도하세요」로 끝나는데, 확인 없이 다시 보내면 같은 창고에 전표가 두 벌 생긴다.
   */
  it('응답이 오지 않으면 다시 보내기 전에 확인하라고 밝힌다', async () => {
    const { user } = await setupReadyToOpen(allRoutes([offlineOpenRoute()]));

    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));

    expect(await screen.findByText(messages.httpError.offline)).toBeInTheDocument();
    expect(screen.getByText(t.notes.openRecheck)).toBeInTheDocument();
    /* **R-2** — 응답이 오지 않은 갈래에서도 창은 닫혀 있다(여기가 두 벌째 전표에 가장 가깝다). */
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /*
   * **M-6 · 수명 표 12행** — 실패하면 **결과 구획을 비운다.** 이 명제는 **앞선 개시가
   * 성공한 뒤에 실패하는 순서**로만 잴 수 있다 — 빈 화면에서 시작하는 실패 테스트는 결과
   * 구획이 원래 없으므로 아무것도 재지 못한다.
   *
   * 무너지면 방금 만든 실사번호가 **실패 배너 옆에 그대로 서 있고**, 사용자는 둘째 개시도
   * 성공한 것으로 읽는다 — 되돌릴 수 없는 전표를 하나 더 만들려 들 이유가 생긴다.
   */
  it('앞선 개시가 성공한 뒤 실패하면 결과 구획을 거둔다', async () => {
    const { user } = await setupReadyToOpen(allRoutes([openThenForbiddenRoute()]));

    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));

    /* 첫 개시는 성공한다 — 결과 구획이 실제로 선다. */
    expect(
      await screen.findByRole('status', { name: t.result.label }),
    ).toBeInTheDocument();

    /* 성공이 초안을 비웠으므로 둘째 개시를 위해 다시 채운다. */
    await fillOpenDraft(user);
    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));

    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: t.result.label })).not.toBeInTheDocument();

    /*
     * **거두는 것은 「방금 만들었다」는 결과뿐이다.** 첫 실사는 실제로 있고 `ct`가 그것을
     * 가리키므로 제목줄에는 그대로 남는다 — 둘을 뭉개면 「실패했으니 앞서 만든 것도 없다」로
     * 읽히고, 사용자는 있는 전표를 한 번 더 만들려 든다.
     */
    expect(within(detailPane()).getByText(OPENED_COUNT_NO)).toBeInTheDocument();
    /* **R-2** — 둘째 시도가 실패한 뒤에도 창은 닫혀 있다. */
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /*
   * **R-1 · 서버가 준 실패 상태의 수명**(수명 표 「서버 실패」 열).
   *
   * 기존 400 감지기는 응답을 `scope: 'screen'`으로 태워 **배너 갈래만** 지난다 — 그래서
   * `OPEN_FIELD_NAMES` ↔ `OPEN_FORM_FIELDS` ↔ `open-form`의 `fieldErrors[…]`로 이어지는
   * **인라인 배선 전체가 한 번도 실행되지 않았다.** 여기서 `scope: 'field'` 한 갈래를 태워
   * 그 배선의 **세 매듭**을 잇달아 센다.
   *
   * 무너지면 서버가 「창고를 확인하세요」라고 콕 집어 주는데 화면은 그것을 배너로만 내고,
   * 사용자는 **어느 칸이 문제인지 모른 채** 되돌릴 수 없는 개시를 다시 시도한다.
   */
  it('서버가 준 필드 오류가 그 칸에 붙고, 고치면 걷히고, 버리면 배너까지 사라진다', async () => {
    const serverMessage = '창고를 확인하세요.';
    const { user } = await setupReadyToOpen(
      allRoutes([
        failingOpenRoute(400, {
          errors: [
            {
              scope: 'field',
              field: OPEN_FIELD_NAMES.warehouse,
              code: 'INVALID',
              message: serverMessage,
            },
          ],
        }),
      ]),
    );

    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));

    /* ① 그 칸 옆에 선다 — 배너가 아니다. 창고 선택칸이 `invalid`로 표시된다. */
    expect(await within(openPane()).findByText(serverMessage)).toBeInTheDocument();
    expect(within(openPane()).getByLabelText(t.fields.warehouse)).toBeInvalid();
    /*
     * 배너에는 그 문구가 없다 — 인라인으로 소화한 것을 배너로 또 내면 같은 오류가 두 번
     * 보이고, 사용자는 칸이 둘 잘못된 줄 안다.
     */
    expect(within(openPane()).getAllByText(serverMessage)).toHaveLength(1);

    /* ② 그 칸을 다시 고치면 걷힌다 — 남으면 이미 고친 값 옆에 붉은 글씨가 서 있다. */
    await chooseOption(user, openPane(), t.fields.warehouse, WAREHOUSE_LABEL);

    expect(within(openPane()).queryByText(serverMessage)).not.toBeInTheDocument();
    expect(within(openPane()).getByLabelText(t.fields.warehouse)).not.toBeInvalid();
  });

  /*
   * **R-1의 셋째 매듭** — 초안을 버리면 **실패 배너까지 함께 거둔다**(`open.reset()`).
   * 「버린다」는 앞서 한 시도를 통째로 물리는 것이라, 오류가 남으면 무엇이 지금 상태인지
   * 화면이 말할 수 없다. 배너 갈래로 태워 **배너와 필드 오류가 같은 조작에 함께** 사라지는지 본다.
   */
  it('실패한 뒤 초안을 버리면 배너와 필드 오류가 함께 사라진다', async () => {
    const serverMessage = '창고를 확인하세요.';
    const { user } = await setupReadyToOpen(
      allRoutes([
        failingOpenRoute(400, {
          errors: [
            { scope: 'screen', code: 'INVALID', message: '보낼 수 없는 값이 있습니다.' },
            {
              scope: 'field',
              field: OPEN_FIELD_NAMES.warehouse,
              code: 'INVALID',
              message: serverMessage,
            },
          ],
        }),
      ]),
    );

    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));

    /* 짝 방향 — 배너와 인라인이 실제로 **갈려서** 함께 서 있다. */
    expect(await screen.findByText('보낼 수 없는 값이 있습니다.')).toBeInTheDocument();
    expect(within(openPane()).getByText(serverMessage)).toBeInTheDocument();

    await user.click(within(openPane()).getByRole('button', { name: messages.common.cancel }));
    await user.click(screen.getByRole('button', { name: t.actions.discardDraft }));

    expect(screen.queryByText('보낼 수 없는 값이 있습니다.')).not.toBeInTheDocument();
    expect(within(openPane()).queryByText(serverMessage)).not.toBeInTheDocument();
  });

  /* 짝 방향 — 응답이 온 실패에는 그 한 줄을 붙이지 않는다. 붙이면 늘 참인 안내가 된다. */
  it('응답이 온 실패에는 그 안내를 붙이지 않는다', async () => {
    const { user } = await setupReadyToOpen(allRoutes([failingOpenRoute(403)]));

    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));

    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByText(t.notes.openRecheck)).not.toBeInTheDocument();
  });
});

describe('StocktakingScreen — 개시 초안의 수명', () => {
  /*
   * **#43** — 이 화면의 개시 초안에는 **되돌림 effect가 아예 없다.** 목록 응답이 도착해도
   * 치던 값이 사라지지 않는다(수명 표 9행). 목록을 부를 때마다 내용이 달라지는 스텁을 쓴다 —
   * 같은 본문이 오면 캐시가 참조를 그대로 유지해 결함이 드러나지 않는다.
   */
  it('목록 응답이 도착해도 개시 초안이 남는다', async () => {
    fillCodeLists();

    const { user } = renderScreen(allRoutes([changingListRoute()]));

    await waitForList();
    await fillOpenDraft(user);

    await user.click(screen.getByRole('button', { name: t.actions.refresh }));

    await waitFor(() => {
      expect(openButton()).not.toBeDisabled();
    });
    expect(within(openPane()).getByLabelText(t.fields.plannedDate)).toHaveValue('2026-08-12');
    expect(within(openPane()).getByLabelText(t.fields.countType)).toHaveTextContent(
      SAMPLE_COUNT_TYPE,
    );
  });

  /*
   * **수명 표 1~5행** — 조건을 바꾸거나 실사를 골라도 개시 초안은 남는다. 개시 초안이 가리키는
   * 것은 **만들 실사**이지 위에서 고른 실사가 아니다 — 조건을 좁혀 창고를 찾아본 뒤 그 창고로
   * 개시하는 것이 정상 경로라, 목록을 만지는 동안 입력이 사라지면 그 경로가 막힌다.
   */
  it('조건을 바꾸거나 실사를 골라도 개시 초안이 남는다', async () => {
    const { user } = await setupReadyToOpen();

    await user.click(within(listPane()).getByRole('checkbox', { name: t.fields.inProgressOnly }));
    await user.click(within(listPane()).getByRole('button', { name: messages.common.search }));
    await selectCount(user, 'IC-2026-900011');

    await screen.findByRole('group', { name: t.detail.summaryLabel });

    expect(within(openPane()).getByLabelText(t.fields.plannedDate)).toHaveValue('2026-08-12');
    expect(openButton()).not.toBeDisabled();
  });

  /*
   * **수명 표 17행** — 취소는 초안을 버린다. **버리기 전에 확인을 받는다**(계획 결정 15):
   * 친 값이 말없이 사라지면 무엇을 잃었는지도 알 수 없다.
   */
  it('취소를 누르면 파기 확인 창을 거쳐 초안이 비워진다', async () => {
    const { user } = await setupReadyToOpen();

    await user.click(within(openPane()).getByRole('button', { name: messages.common.cancel }));

    expect(screen.getByText(messages.common.discardChangesConfirm)).toBeInTheDocument();
    /* 확인하기 전에는 아직 남아 있다. */
    expect(within(openPane()).getByLabelText(t.fields.plannedDate)).toHaveValue('2026-08-12');

    await user.click(screen.getByRole('button', { name: t.actions.discardDraft }));

    expect(within(openPane()).getByLabelText(t.fields.plannedDate)).toHaveValue('');
    expect(openButton()).toBeDisabled();
  });

  /* 아무것도 잃지 않는 조작에까지 확인을 받으면 확인 창이 의미를 잃고 읽지 않고 누르게 된다. */
  it('버릴 것이 없으면 확인 창을 띄우지 않는다', async () => {
    fillCodeLists();

    const { user } = renderScreen(allRoutes());

    await waitForList();
    await user.click(within(openPane()).getByRole('button', { name: messages.common.cancel }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('StocktakingScreen — 결과 구획의 수명', () => {
  const openOne = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
    await user.click(openButton());
    await user.click(screen.getByRole('button', { name: t.actions.confirmOpen }));
    await screen.findByRole('status', { name: t.result.label });
  };

  /*
   * **수명 표 1~4행** — 결과는 「방금 **이 실사를** 개시했다」이지 「이 실사가 개시된 것이다」가
   * 아니다. 대상이 바뀌었는데 남으면 사용자는 방금 고른 실사를 방금 만든 것으로 읽는다.
   */
  it('다른 실사를 고르면 결과 구획이 사라진다', async () => {
    const { user } = await setupReadyToOpen();

    await openOne(user);
    await selectCount(user, 'IC-2026-900013');

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: t.result.label })).not.toBeInTheDocument();
    });
  });

  /* 주소로 대상이 바뀌는 길(뒤로가기·직접 편집)도 같은 규칙이 닿아야 한다. */
  it('주소로 대상이 바뀌어도 결과 구획이 사라진다', async () => {
    const { user } = await setupReadyToOpen(allRoutes(), '', 'ct=9003');

    await openOne(user);
    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: t.result.label })).not.toBeInTheDocument();
    });
  });

  /* **수명 표 10행** — 「다시 조회」는 값을 버리려고 누르는 것이 아니다. 결과가 남는다. */
  it('다시 조회해도 결과 구획이 남는다', async () => {
    const { user } = await setupReadyToOpen();

    await openOne(user);
    await user.click(screen.getByRole('button', { name: t.actions.refresh }));

    expect(screen.getByRole('status', { name: t.result.label })).toBeInTheDocument();
  });
});
