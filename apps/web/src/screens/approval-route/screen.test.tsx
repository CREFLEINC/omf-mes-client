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
  APPROVER_OPTION_LABEL,
  BUSINESS_UNIT_LABEL,
  INACTIVE_BUSINESS_UNIT_LABEL,
  businessUnitFixtures,
  routeFixtures,
  stepFixtures,
  userFixtures,
} from './fixtures';
import { ApprovalRouteScreen } from './screen';

const t = messages.approvalRoute;

const ROUTE = '/system/approval-route';
const ROUTES_PATH = '/app/approval-routes';
const BUSINESS_UNITS_PATH = '/mdm/business-units';
/** 계약에 있으나 **이 화면이 부르지 않아야 하는** 경로. 부를 수 있게 스텁을 둔다. */
const USERS_PATH = '/app/users';

const SELECTED = '?ar=9001';

interface RecordedRequest {
  method: string;
  url: URL;
  /** 실제로 실려 나간 헤더. **보내지 않았음**을 증명하려면 보낼 수 있는 자리를 봐야 한다. */
  headers: Headers;
  /** 쓰기 요청의 본문. 읽기와 본문 없는 액션에는 `null`이다. */
  body: unknown;
}

/**
 * 요청을 기록하면서 스텁 규칙으로 응답한다. 규칙에 없는 요청은 하네스가 던져 스텁 누락을 드러낸다.
 *
 * `hold`가 참을 내는 요청은 **기록한 뒤에** 붙잡아 둔다 — 「기다리는 동안 무엇이 잠기는가」를
 * 판정하려면 응답이 오기 전에 이미 기록돼 있어야 한다.
 *
 * **경로가 아니라 요청으로 고른다.** 쓰기와 상세 조회가 같은 경로를 쓰므로 경로로 붙잡으면
 * 화면이 서기도 전에 멈춘다.
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
    /* 본문은 한 번만 읽을 수 있다 — 복제해 읽어야 스텁이 같은 요청을 다시 다룰 수 있다. */
    const raw = request.method === 'GET' ? '' : await request.clone().text();

    requests.push({
      method: request.method,
      url: new URL(request.url),
      headers: new Headers(request.headers),
      body: raw === '' ? null : (JSON.parse(raw) as unknown),
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

/**
 * 활성 중복 **조준 조회**인가. 목록 조회와 같은 경로를 쓰지만 `size` 상수를 싣는 것이 다르다 —
 * 목록 조회는 서버 기본값을 쓰므로 `size`를 싣지 않는다(`filters.ts`).
 *
 * 두 조회를 갈라 세어야 「목록을 1회 불렀다」와 「조준 조회가 1회 나갔다」가 서로를 가리지 않는다.
 */
const isProbe = (request: Request): boolean =>
  isGet(request, ROUTES_PATH) && new URL(request.url).searchParams.has('size');

const listBody = (
  items: unknown[],
  page: Partial<{ page: number; size: number; total: number }> = {},
) => ({ items, page: { page: 1, size: 20, total: items.length, ...page } });

const listRoute = (
  items: unknown[] = routeFixtures,
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, ROUTES_PATH) && !isProbe(request),
  respond: () => jsonResponse(listBody(items, page)),
});

/** 조준 조회. **어떤 조건으로도 응답한다** — 「부르지 않았다」를 증명하려면 부를 수 있어야 한다. */
const probeRoute = (
  items: unknown[] = [],
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: isProbe,
  respond: () => jsonResponse(listBody(items, page)),
});

const failingProbeRoute = (): StubRoute => ({
  match: isProbe,
  respond: () => jsonResponse({ message: '' }, { status: 500 }),
});

const failingListRoute = (status = 500): StubRoute => ({
  match: (request) => isGet(request, ROUTES_PATH) && !isProbe(request),
  respond: () => jsonResponse({ message: '' }, { status }),
});

/** 상세 경로인가. 목록(`/app/approval-routes`)과 갈라야 한다. */
const isDetailPath = (pathname: string): boolean =>
  /^\/app\/approval-routes\/[^/]+$/.test(pathname);
const isStepsPath = (pathname: string): boolean =>
  /^\/app\/approval-routes\/[^/]+\/steps$/.test(pathname);

/**
 * 상세·단계 경로로 **나간 요청 전부**. 번호 자리가 무엇이든 센다 —
 * `/app/approval-routes/0` 같은 잘못된 경로도 「부르지 않았다」를 깨뜨리는 요청이다.
 */
const detailRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => isDetailPath(request.url.pathname) && request.method === 'GET');
const stepsRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => isStepsPath(request.url.pathname));
const listRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter(
    (request) => request.url.pathname === ROUTES_PATH && !request.url.searchParams.has('size'),
  );
const probeRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter(
    (request) => request.url.pathname === ROUTES_PATH && request.url.searchParams.has('size'),
  );
/** 쓰기로 나간 요청 전부. **경로를 가리지 않고 센다** — 잘못된 경로로 나간 쓰기도 잡아야 한다. */
const writeRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.method !== 'GET');

/**
 * 어느 번호로 불러도 응답한다 — 「부르지 않았다」를 증명하려면 부를 수 있는 스텁이 있어야 한다.
 *
 * **잠금 토큰을 함께 준다.** 계약이 상세 200에 `ETag`를 싣고, 그 토큰이 없으면 쓰기가
 * 「최신 정보를 불러오는 중입니다」로 멈춰 **저장 경로가 아예 열리지 않는다.**
 */
const detailRoute = (route: unknown = routeFixtures[0]): StubRoute => ({
  match: (request) => request.method === 'GET' && isDetailPath(new URL(request.url).pathname),
  respond: () => jsonResponse(route, { headers: { ETag: 'token-0' } }),
});

/**
 * 번호에 맞는 결재선을 돌려준다. **대상이 바뀌는 길을 재려면** 두 대상이 서로 다른 값을
 * 보여야 한다 — 같은 몸통을 주면 「남의 값이 새 대상에 찍혔다」가 드러나지 않는다.
 */
const detailRouteById = (): StubRoute => ({
  match: (request) => request.method === 'GET' && isDetailPath(new URL(request.url).pathname),
  respond: (request) => {
    const id = Number(new URL(request.url).pathname.split('/').pop());
    const found = routeFixtures.find((route) => route.approvalRouteId === id) ?? routeFixtures[0];

    return jsonResponse(found, { headers: { ETag: `token-${String(id)}` } });
  },
});

const failingDetailRoute = (status = 500): StubRoute => ({
  match: (request) => request.method === 'GET' && isDetailPath(new URL(request.url).pathname),
  respond: () => jsonResponse({ message: '' }, { status }),
});

const stepsRoute = (items: unknown[] = stepFixtures): StubRoute => ({
  match: (request) => request.method === 'GET' && isStepsPath(new URL(request.url).pathname),
  respond: () => jsonResponse({ items }),
});

const failingStepsRoute = (status = 500): StubRoute => ({
  match: (request) => request.method === 'GET' && isStepsPath(new URL(request.url).pathname),
  respond: () => jsonResponse({ message: '' }, { status }),
});

/**
 * 단계 전체 치환. **응답에 `ETag`를 싣지 않는다** — 계약에도 목에도 없는 헤더이며,
 * 그래서 성공 뒤 상세를 다시 부르지 않으면 다음 저장이 낡은 토큰으로 나간다.
 */
const stepsReplaceRoute = (saved: unknown[] = stepFixtures): StubRoute => ({
  match: (request) => request.method === 'PUT' && isStepsPath(new URL(request.url).pathname),
  respond: () => jsonResponse({ items: saved }),
});

const failingStepsReplaceRoute = (status: number, body: unknown = { message: '' }): StubRoute => ({
  match: (request) => request.method === 'PUT' && isStepsPath(new URL(request.url).pathname),
  respond: () => jsonResponse(body, { status }),
});

/** 치환으로 나간 요청만. 같은 경로의 조회와 갈라야 「몇 번 저장했는가」가 뜻을 갖는다. */
const stepsReplaceRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.method === 'PUT' && isStepsPath(request.url.pathname));

const businessUnitRoute = (
  items: unknown[] = businessUnitFixtures,
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, BUSINESS_UNITS_PATH),
  respond: () => jsonResponse(listBody(items, page)),
});

const failingBusinessUnitRoute = (): StubRoute => ({
  match: (request) => isGet(request, BUSINESS_UNITS_PATH),
  respond: () => jsonResponse({ message: '' }, { status: 500 }),
});

/**
 * 사용자 목록 — **승인자를 고를 때만** 쓴다. 결재선을 고르기 전에는 나가지 않아야 하므로
 * 부를 수 있게 두어야 그 사실이 증명된다.
 */
const usersRoute = (
  items: unknown[] = userFixtures,
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, USERS_PATH),
  respond: () => jsonResponse(listBody(items, page)),
});

/** 결재선 수정. **본문과 헤더를 검사하는 자리라 응답은 보낸 값과 무관한 서버 값**을 준다. */
const updateRoute = (saved: unknown = routeFixtures[0]): StubRoute => ({
  match: (request) => request.method === 'PUT' && isDetailPath(new URL(request.url).pathname),
  respond: () => jsonResponse(saved),
});

const failingUpdateRoute = (status: number, body: unknown = { message: '' }): StubRoute => ({
  match: (request) => request.method === 'PUT' && isDetailPath(new URL(request.url).pathname),
  respond: () => jsonResponse(body, { status }),
});

const isActionPath = (pathname: string, action: string): boolean =>
  new RegExp(`^/app/approval-routes/[^/]+:${action}$`).test(pathname);

const activationRoute = (action: 'deactivate' | 'activate', saved: unknown): StubRoute => ({
  match: (request) =>
    request.method === 'POST' && isActionPath(new URL(request.url).pathname, action),
  respond: () => jsonResponse(saved, { headers: { ETag: 'action-token' } }),
});

const failingActivationRoute = (
  action: 'deactivate' | 'activate',
  status: number,
  body: unknown = { message: '' },
): StubRoute => ({
  match: (request) =>
    request.method === 'POST' && isActionPath(new URL(request.url).pathname, action),
  respond: () => jsonResponse(body, { status }),
});

const activationRequests = (
  requests: RecordedRequest[],
  action: 'deactivate' | 'activate',
): RecordedRequest[] =>
  requests.filter(
    (request) => request.method === 'POST' && isActionPath(request.url.pathname, action),
  );

/**
 * 상세 조회가 **부를 때마다 새 토큰을 준다.**
 *
 * 연속 저장이 서로 다른 토큰을 싣는지를 재려면 「다시 부르면 새 토큰이 온다」는 서버 쪽 사실이
 * 재현돼야 한다. 몸통은 바꿔 끼울 수 있게 두어 끄기 뒤 사용 여부가 뒤집히는 것까지 재현한다.
 */
const createVersionedDetail = (
  initial: unknown = routeFixtures[0],
): { route: StubRoute; setBody: (next: unknown) => void } => {
  let body = initial;
  let version = 0;

  return {
    route: {
      match: (request) => request.method === 'GET' && isDetailPath(new URL(request.url).pathname),
      respond: () => {
        version += 1;

        return jsonResponse(body, { headers: { ETag: `token-${String(version)}` } });
      },
    },
    setBody: (next) => {
      body = next;
    },
  };
};

const allRoutes = (extra: StubRoute[] = []): StubRoute[] => [
  ...extra,
  probeRoute(),
  listRoute(),
  detailRoute(),
  stepsRoute(),
  businessUnitRoute(),
  usersRoute(),
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
  hold?: (request: Request) => boolean,
): {
  requests: RecordedRequest[];
  release: () => void;
  user: ReturnType<typeof userEvent.setup>;
} => {
  const { fetch, requests, release } = createRecordingFetch(routes, hold);

  renderWithProviders(
    <>
      <ApprovalRouteScreen />
      <LocationProbe />
      <BackProbe />
      <SearchProbe to={navigateTo} />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, release, user: userEvent.setup() };
};

const locationText = (): string => screen.getByTestId('location').textContent ?? '';

const selectRouteButton = (approvalTypeCode: string, businessUnitLabel: string): HTMLElement =>
  screen.getByRole('button', { name: t.actions.selectRow(approvalTypeCode, businessUnitLabel) });

const waitForList = async (): Promise<void> => {
  await screen.findByText('INVENTORY_ADJUSTMENT');
};

const waitForForm = async (): Promise<HTMLElement> => screen.findByLabelText(t.fields.minValue);

const saveButton = (): HTMLElement => screen.getByRole('button', { name: messages.common.save });

/** 값 구간 하한을 고쳐 폼을 더럽힌다. 「고친 것이 없다」 잠금을 푸는 가장 짧은 길이다. */
const dirtyForm = async (user: ReturnType<typeof userEvent.setup>, text = '7'): Promise<void> => {
  const field = await waitForForm();

  await user.clear(field);
  await user.type(field, text);
};

/**
 * 폼의 사업부 칸을 「전 사업부 공통」으로 비운다.
 *
 * **조건 줄에도 같은 이름의 선택칸이 있다** — 폼 구획 안에서 집지 않으면 조건을 고치게 된다.
 */
const clearBusinessUnit = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  const pane = await screen.findByRole('region', { name: t.panes.detail });

  await user.click(within(pane).getByRole('combobox', { name: t.fields.businessUnit }));
  await user.click(screen.getByRole('option', { name: t.values.allBusinessUnits }));
};

describe('ApprovalRouteScreen — 조회 조건', () => {
  it('첫 진입에 목록을 1회 부르고 activeOnly=true를 싣는다', async () => {
    const { requests } = renderScreen(allRoutes());

    await waitForList();

    const calls = listRequests(requests);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url.searchParams.get('activeOnly')).toBe('true');
  });

  it('「미사용 포함」이 켜지면 activeOnly=false를 싣는다 — 파라미터를 빼지 않는다', async () => {
    const { requests } = renderScreen(allRoutes(), '?inactive=1');

    await waitForList();

    const query = listRequests(requests)[0]?.url.searchParams;

    expect(query?.has('activeOnly')).toBe(true);
    expect(query?.get('activeOnly')).toBe('false');
  });

  it('주소의 조건 넷이 그대로 조회에 실린다', async () => {
    const { requests } = renderScreen(
      allRoutes(),
      '?ty=GOODS_ISSUE_DISPOSAL&bu=9101&q=SAMPLE&page=2',
    );

    await waitForList();

    const query = listRequests(requests)[0]?.url.searchParams;

    expect(query?.get('approvalTypeCode')).toBe('GOODS_ISSUE_DISPOSAL');
    expect(query?.get('businessUnitId')).toBe('9101');
    expect(query?.get('q')).toBe('SAMPLE');
    expect(query?.get('page')).toBe('2');
  });

  it('식별자가 아닌 사업부·쪽은 조회에 실리지 않는다', async () => {
    const { requests } = renderScreen(allRoutes(), '?bu=abc&page=-1');

    await waitForList();

    const query = listRequests(requests)[0]?.url.searchParams;

    expect(query?.has('businessUnitId')).toBe(false);
    expect(query?.has('page')).toBe(false);
  });

  it('공백만인 검색어는 주소에도 요청에도 실리지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForList();
    await user.type(screen.getByLabelText(t.fields.q), '   ');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(locationText()).not.toContain('q=');
    });
    for (const request of listRequests(requests)) {
      expect(request.url.searchParams.has('q')).toBe(false);
    }
  });

  it('조건을 바꾸면 첫 쪽으로 되돌리고 고른 결재선을 비운다', async () => {
    const { user } = renderScreen(allRoutes(), '?page=3&ar=9001');

    await waitForList();
    await user.type(screen.getByLabelText(t.fields.q), 'SAMPLE');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(locationText()).toContain('q=SAMPLE');
    });
    expect(locationText()).not.toContain('page=');
    expect(locationText()).not.toContain('ar=');
  });

  it('초기화는 조건을 통째로 비운다', async () => {
    const { user } = renderScreen(
      allRoutes(),
      '?ty=GOODS_ISSUE_DISPOSAL&q=SAMPLE&inactive=1&page=2',
    );

    await waitForList();
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(locationText()).toBe(ROUTE);
    });
  });

  /**
   * **조작 한 번에 히스토리도 한 칸만 는다.** 조건·쪽·선택을 따로 갱신하면 그 사이에
   * 「고른 것도 아니고 첫 쪽도 아닌」 주소가 히스토리에 남아, 뒤로가기가 사용자가 본 적 없는
   * 화면으로 되돌아간다. 히스토리 깊이가 그것을 재는 유일한 수단이다.
   */
  it('조작 한 번에 히스토리가 한 칸만 는다', async () => {
    const { user } = renderScreen(allRoutes(), '?page=3&ar=9001');

    await waitForList();
    await user.type(screen.getByLabelText(t.fields.q), 'SAMPLE');
    await user.click(screen.getByRole('button', { name: messages.common.search }));
    await waitFor(() => {
      expect(locationText()).toContain('q=SAMPLE');
    });

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(locationText()).toBe(`${ROUTE}?page=3&ar=9001`);
    });
  });

  it('쪽을 옮기면 쪽만 바뀌고 고른 결재선이 사라진다', async () => {
    const { user } = renderScreen(
      allRoutes([listRoute(routeFixtures, { total: 45 })]),
      '?q=SAMPLE&ar=9001',
    );

    await waitForList();
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(locationText()).toContain('page=2');
    });
    expect(locationText()).toContain('q=SAMPLE');
    expect(locationText()).not.toContain('ar=');
  });

  it('조건 칩의 ×는 그 조건 하나만 푼다', async () => {
    const { user } = renderScreen(allRoutes(), '?q=SAMPLE&inactive=1');

    await waitForList();
    await user.click(screen.getByRole('button', { name: t.filters.chipRemoveKeyword }));

    await waitFor(() => {
      expect(locationText()).not.toContain('q=SAMPLE');
    });
    expect(locationText()).toContain('inactive=1');
  });

  it('치던 조건이 목록 응답 도착에 되돌아가지 않는다', async () => {
    const routes = allRoutes();
    const { fetch } = createRecordingFetch(routes);
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const holding: StubFetch = async (request) => {
      if (new URL(request.url).pathname === ROUTES_PATH) await gate;

      return fetch(request);
    };

    renderWithProviders(<ApprovalRouteScreen />, { fetch: holding, route: ROUTE });

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(t.fields.q), 'SAMPLE');
    release();
    await waitForList();

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('SAMPLE');
  });
});

describe('ApprovalRouteScreen — 목록', () => {
  it('사업부 이름과 파생값을 응답 그대로 낸다', async () => {
    renderScreen(allRoutes());

    await waitForList();

    const rows = screen.getAllByRole('row');
    const withUnit = rows.find((row) => within(row).queryByText(BUSINESS_UNIT_LABEL) !== null);

    expect(withUnit).toBeDefined();
    expect(within(withUnit as HTMLElement).getByText('3')).toBeInTheDocument();
  });

  it('사업부를 비운 결재선은 「전 사업부 공통」으로 읽힌다', async () => {
    renderScreen(allRoutes());

    await waitForList();

    expect(screen.getByText(t.values.allBusinessUnits)).toBeInTheDocument();
  });

  it('단계가 0인 결재선에 표식이 선다', async () => {
    renderScreen(allRoutes());

    await waitForList();

    expect(screen.getAllByText(t.values.noSteps).length).toBeGreaterThan(0);
  });

  it('참조가 아직 오지 않은 동안 이름을 「알 수 없음」으로 내지 않는다', async () => {
    const routes = allRoutes();
    const stub = createStubFetch(routes);
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const holding: StubFetch = async (request) => {
      if (new URL(request.url).pathname === BUSINESS_UNITS_PATH) await gate;

      return stub(request);
    };

    renderWithProviders(<ApprovalRouteScreen />, { fetch: holding, route: ROUTE });

    await waitForList();

    expect(screen.getAllByText(t.values.referenceLoading).length).toBeGreaterThan(0);
    expect(screen.queryByText(t.values.unknown)).not.toBeInTheDocument();

    release();
    await screen.findAllByText(BUSINESS_UNIT_LABEL);
  });

  /**
   * **참조를 「미사용 포함」으로 부른다.**
   *
   * 기본 조회는 사용 중인 것만 내려준다 — 결재선은 사업부보다 오래 살므로, 좁혀 받으면
   * 사용 중지된 사업부를 가리키는 결재선이 **「알 수 없음」으로 표기된다.** 그것은
   * *값이 잘못됐다*는 뜻이라 정반대로 읽힌다(#44·#47의 형태).
   */
  it('사업부 참조를 「미사용 포함」으로 부른다', async () => {
    const { requests } = renderScreen(allRoutes());

    await waitForList();

    const calls = requests.filter((request) => request.url.pathname === BUSINESS_UNITS_PATH);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url.searchParams.get('includeInactive')).toBe('true');

    // 짝 방향 — 미사용 사업부를 가리키는 결재선의 이름이 실제로 풀린다.
    expect(await screen.findByText(INACTIVE_BUSINESS_UNIT_LABEL)).toBeInTheDocument();
  });

  /**
   * **서버가 준 쪽이 정본이다.**
   *
   * 주소의 쪽 번호를 표시에 쓰면 서버가 다른 쪽을 돌려줬을 때(범위 밖 요청을 서버가 잘라
   * 첫 쪽을 주는 경우 등) **표시와 내용이 어긋난다.** 계산은 `pagination.ts`가 이미 재므로
   * 여기서는 **컨테이너가 어느 쪽을 넘기는가**(배선)를 잰다.
   */
  it('주소의 쪽과 서버가 준 쪽이 다르면 서버 쪽으로 읽힌다', async () => {
    renderScreen(
      allRoutes([listRoute(routeFixtures, { page: 1, size: 20, total: 45 })]),
      '?page=5',
    );

    await waitForList();

    expect(screen.getByText('1–3 / 전체 45건')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.prevPage })).toBeDisabled();
  });

  it('참조 목록이 잘리면 그 사실을 밝힌다', async () => {
    renderScreen(
      allRoutes([
        businessUnitRoute(businessUnitFixtures, { total: businessUnitFixtures.length + 1 }),
      ]),
    );

    await waitForList();

    expect(await screen.findByText(t.filters.lookupTruncated)).toBeInTheDocument();
  });

  it('참조 조회가 실패해도 「전 사업부 공통」은 흔들리지 않는다', async () => {
    renderScreen(allRoutes([failingBusinessUnitRoute()]));

    await waitForList();

    expect(await screen.findByText(t.filters.lookupFailed)).toBeInTheDocument();
    expect(screen.getByText(t.values.allBusinessUnits)).toBeInTheDocument();
    expect(screen.getAllByText(t.values.referenceFailed).length).toBeGreaterThan(0);
  });

  it('목록 어디에도 내부 번호가 없다', async () => {
    renderScreen(allRoutes());

    await waitForList();

    const table = screen.getByRole('table');

    // 선행 단언 — 이름이 실제로 나와야 「번호가 없다」가 뜻을 갖는다.
    expect(within(table).getAllByText(BUSINESS_UNIT_LABEL).length).toBeGreaterThan(0);
    expect(table.textContent).not.toContain('9001');
    expect(table.textContent).not.toContain('9101');
  });

  it('고정 OpenAPI의 승인 유형을 선택지로 제공한다', async () => {
    const { user } = renderScreen(allRoutes());

    await waitForList();

    await user.click(screen.getByRole('combobox', { name: t.fields.approvalTypeCode }));

    expect(screen.getAllByRole('option')).toHaveLength(9); // 전체 + 고정 enum 8개
    expect(screen.getByRole('option', { name: 'IQC_SKIP' })).toBeInTheDocument();
    expect(screen.queryByText(messages.pendingCode.note)).toBeNull();
  });
});

describe('ApprovalRouteScreen — 고른 결재선', () => {
  it('고르기 전에는 상세도 단계도 부르지 않는다', async () => {
    const { requests } = renderScreen(allRoutes());

    await waitForList();

    // 경로 전체를 센다 — 잘못된 번호로 나간 요청도 「부르지 않았다」를 깨뜨린다.
    expect(detailRequests(requests)).toHaveLength(0);
    expect(stepsRequests(requests)).toHaveLength(0);
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  it('고르면 상세와 단계를 각각 1회 부른다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForList();
    await user.click(selectRouteButton('GOODS_ISSUE_DISPOSAL', BUSINESS_UNIT_LABEL));

    await screen.findByRole('region', { name: t.panes.steps });

    expect(detailRequests(requests)).toHaveLength(1);
    expect(stepsRequests(requests)).toHaveLength(1);
    expect(locationText()).toContain('ar=9001');
  });

  it('고르기는 조건과 쪽을 건드리지 않는다', async () => {
    const { user } = renderScreen(
      allRoutes([listRoute(routeFixtures, { page: 2, total: 45 })]),
      '?q=SAMPLE&page=2',
    );

    await waitForList();
    await user.click(selectRouteButton('GOODS_ISSUE_DISPOSAL', BUSINESS_UNIT_LABEL));

    await waitFor(() => {
      expect(locationText()).toContain('ar=9001');
    });
    expect(locationText()).toContain('q=SAMPLE');
    expect(locationText()).toContain('page=2');
  });

  it('등록 중이면 상세를 부르지 않는다', async () => {
    // `ar`와 `new`는 함께 서지 않는다 — 주소를 손으로 고쳐도 그 규칙이 지켜져야 한다.
    const { requests } = renderScreen(allRoutes(), '?ar=9001&new=1');

    await waitForList();

    expect(detailRequests(requests)).toHaveLength(0);
    expect(stepsRequests(requests)).toHaveLength(0);
  });

  it('상세와 단계를 함께 그린다', async () => {
    renderScreen(allRoutes(), SELECTED);

    // 단계 구획은 상세가 도착해야 선다 — 자리 표시 구획과 이름이 겹치지 않는 유일한 신호다.
    await screen.findByRole('region', { name: t.panes.steps });

    expect(screen.getByText(t.notes.inProgressSome(3))).toBeInTheDocument();
    expect(screen.getByText('합성 승인자1 · 합성부서 가')).toBeInTheDocument();
    expect(screen.getByText(t.values.approverUnknown)).toBeInTheDocument();
  });

  /**
   * 계약이 단계 응답에 승인자의 표시 이름을 실어 보낸다 — 그래서 이름을 **푸는** 조회가 없다.
   * 사용자 목록은 승인자를 **고를 때**만 필요하므로 결재선을 고른 뒤에 **한 번만** 나간다.
   */
  it('단계를 그리는 데 사용자 목록을 다시 부르지 않는다 — 고른 뒤 선택지로 한 번뿐이다', async () => {
    const { requests } = renderScreen(allRoutes(), SELECTED);

    await screen.findByRole('region', { name: t.panes.steps });

    // 선행 단언 — 이름이 실제로 그려져야 「다시 부르지 않았다」가 뜻을 갖는다.
    expect(screen.getByText('합성 승인자1 · 합성부서 가')).toBeInTheDocument();
    await waitFor(() => {
      expect(requests.filter((request) => request.url.pathname === USERS_PATH)).toHaveLength(1);
    });
  });

  /**
   * **미사용 사용자를 고르게 두지 않는다.** 여기서 고른 값은 새 단계로 저장되므로 이미
   * 사용 중지된 사람을 넣으면 그 단계에서 결재가 멈춘다. 계약의 사용자 목록은 기본으로
   * 사용 중인 것만 내려주므로 **「미사용 포함」을 켜지 않는 것**이 그 규칙의 이행이다.
   */
  it('승인자 조회가 「미사용 포함」을 켜지 않는다', async () => {
    const { requests } = renderScreen(allRoutes(), SELECTED);

    await screen.findByRole('region', { name: t.panes.steps });

    const sent = requests.filter((request) => request.url.pathname === USERS_PATH);

    // 선행 단언 — 조회가 실제로 나갔어야 「그 조건을 싣지 않았다」가 뜻을 갖는다.
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url.searchParams.has('includeInactive')).toBe(false);
  });

  /**
   * **잘림 판정의 이음매를 잰다.** 단위(문구 고르기)와 부품(문구 렌더)만 재면 그 사이의
   * `page.total > 받은 건수`가 어느 잣대도 지나지 않는다 — 사업부 참조에는 이 이음매가
   * 이미 서 있다. 밝히지 않으면 사용자는 불완전한 목록을 완전한 것으로 읽고 「그런 사람이
   * 없다」로 결론짓는다.
   */
  it('승인자 목록이 잘리면 그 사실을 밝힌다', async () => {
    renderScreen(
      allRoutes([usersRoute(userFixtures, { total: userFixtures.length + 1 })]),
      SELECTED,
    );

    await screen.findByRole('region', { name: t.panes.steps });

    expect(await screen.findByText(t.notes.approverListTruncated)).toBeInTheDocument();
  });

  /** 짝 방향 — 잘리지 않았으면 밝히지 않는다. 늘 세워 두면 안내가 배경이 된다. */
  it('승인자 목록이 온전하면 잘림 표식이 없다', async () => {
    renderScreen(allRoutes(), SELECTED);

    const pane = await screen.findByRole('region', { name: t.panes.steps });

    // 선행 단언 — 선택지가 실제로 서 있어야 「표식이 없다」가 뜻을 갖는다.
    expect(within(pane).getByRole('combobox', { name: t.fields.approver })).toBeInTheDocument();
    expect(screen.queryByText(t.notes.approverListTruncated)).not.toBeInTheDocument();
  });

  /** 목록만 보는 사용자에게까지 나가면 첫 진입의 조회가 이유 없이 하나 는다. */
  it('결재선을 고르기 전에는 사용자 목록을 부르지 않는다', async () => {
    const { requests } = renderScreen(allRoutes());

    await waitForList();

    // 선행 단언 — 다른 조회는 실제로 나갔어야 「이것만 나가지 않았다」가 뜻을 갖는다.
    expect(listRequests(requests).length).toBeGreaterThan(0);
    expect(requests.filter((request) => request.url.pathname === USERS_PATH)).toHaveLength(0);
  });

  it('상세가 404면 주소의 번호를 정리하고 사유를 밝힌다', async () => {
    renderScreen(allRoutes([failingDetailRoute(404)]), SELECTED);

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeInTheDocument();
    await waitFor(() => {
      expect(locationText()).not.toContain('ar=');
    });
  });

  it('404 안내는 다른 결재선을 고르면 사라진다', async () => {
    const { user } = renderScreen(
      [
        listRoute(),
        {
          match: (request: Request) =>
            request.method === 'GET' && isDetailPath(new URL(request.url).pathname),
          respond: (request: Request) =>
            new URL(request.url).pathname.endsWith('9001')
              ? jsonResponse({ message: '' }, { status: 404 })
              : jsonResponse(routeFixtures[2]),
        },
        stepsRoute(),
        businessUnitRoute(),
        usersRoute(),
      ],
      SELECTED,
    );

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeInTheDocument();

    await user.click(selectRouteButton('INVENTORY_ADJUSTMENT', INACTIVE_BUSINESS_UNIT_LABEL));

    await screen.findByRole('region', { name: t.panes.steps });
    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
  });

  /**
   * **매임 기구의 본체를 재는 자리.**
   *
   * 404 안내는 세 방향으로 재야 뜻이 선다 — 「뜬다」·「사라진다」·**「주소가 정리된 뒤에도 남는다」**.
   * 셋째가 빠지면 매임(`missingContextKey`)을 통째로 지워도 앞 둘이 통과한다.
   *
   * 정리 직후 `isRouteNotFound`는 거짓이 된다(고른 것이 없으니 상세 조회가 성립하지 않는다).
   * 그 순간 안내를 붙잡는 것은 매임뿐이며, 없으면 안내가 **한 프레임 번쩍이고 사라져**
   * 사용자는 자기 선택이 왜 사라졌는지 알 수 없다.
   */
  it('404로 주소의 번호가 정리된 뒤에도 안내가 남는다', async () => {
    renderScreen(allRoutes([failingDetailRoute(404)]), SELECTED);

    // 주소가 먼저 정리되는 것을 기다린다 — **그 뒤가 이 감지기의 자리다.**
    await waitFor(() => {
      expect(locationText()).not.toContain('ar=');
    });

    expect(screen.getByText(t.empty.notFoundTitle)).toBeInTheDocument();
    // 짝 방향 — 「고르지 않았다」로 바뀌어 버리는 것이 이 결함의 실제 모습이다.
    expect(screen.queryByText(t.empty.noSelectionTitle)).not.toBeInTheDocument();
  });

  /**
   * **404 정리는 히스토리를 늘리지 않는다.**
   *
   * 늘리면 뒤로가기가 없는 결재선으로 되돌아가고, 그 자리에서 다시 404가 나 같은 정리가
   * 되풀이된다 — 뒤로가기가 사실상 막힌다. 조건이 다른 주소에서 출발해야 한 칸 뒤가
   * 「처음 주소」인지 「없는 결재선」인지 갈린다.
   */
  it('404 정리가 뒤로가기를 막지 않는다', async () => {
    const { user } = renderScreen(allRoutes([failingDetailRoute(404)]), '?q=SAMPLE', SELECTED);

    await waitForList();
    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeInTheDocument();
    await waitFor(() => {
      expect(locationText()).not.toContain('ar=');
    });

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    // 정리가 자리를 밀어 넣었다면 한 칸 뒤는 처음 주소가 아니라 **없는 결재선**이다.
    await waitFor(() => {
      expect(locationText()).toBe(`${ROUTE}?q=SAMPLE`);
    });
  });

  /**
   * **주소가 바깥에서 바뀌는 길**(뒤로가기·앞으로가기·주소 직접 편집)은 화면의 클릭 핸들러를
   * 지나지 않는다. 안내를 핸들러에서만 거두면 이 길로 들어온 새 조건 위에 앞 대상의 안내가
   * 그대로 서 있게 된다 — 매임을 조건·쪽의 서명으로 세우는 이유다.
   */
  it('404 안내는 주소가 바깥에서 바뀌어도 사라진다', async () => {
    const { user } = renderScreen(allRoutes([failingDetailRoute(404)]), SELECTED, '?q=SAMPLE');

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await waitFor(() => {
      expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
    });
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  /**
   * **안내가 멀쩡한 상세를 덮지 않는다.**
   *
   * 오른쪽 구획은 「찾을 수 없음」을 **맨 앞에서** 본다. 404 정리로 매임이 선 뒤 **조건은
   * 그대로인 채 선택만 다시 붙는 길**(앞으로가기·주소 직접 편집)에서 가드가 없으면,
   * 방금 연 결재선의 내용 대신 「고른 결재선을 찾을 수 없습니다」가 뜬다 — 화면이 거짓말한다.
   *
   * 앞선 감지기는 **서명이 바뀌는 절반**만 지난다. 여기는 서명이 그대로인 절반이다.
   */
  it('404 정리 뒤 같은 조건에서 다른 결재선을 열면 안내가 아니라 내용이 선다', async () => {
    const { user } = renderScreen(
      [
        listRoute(),
        {
          match: (request: Request) =>
            request.method === 'GET' && isDetailPath(new URL(request.url).pathname),
          respond: (request: Request) =>
            new URL(request.url).pathname.endsWith('9001')
              ? jsonResponse({ message: '' }, { status: 404 })
              : jsonResponse(routeFixtures[2]),
        },
        stepsRoute(),
        businessUnitRoute(),
        usersRoute(),
      ],
      SELECTED,
      '?ar=9003',
    );

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeInTheDocument();
    await waitFor(() => {
      expect(locationText()).not.toContain('ar=');
    });

    // 조건은 그대로 두고 선택만 바깥에서 다시 붙인다 — 서명은 바뀌지 않는다.
    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await screen.findByRole('region', { name: t.panes.steps });
    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
  });

  /**
   * **매임 서명은 「지금」 조건이어야 한다.**
   *
   * 지금 코드에는 참조가 없다 — 404 effect가 조건·쪽의 서명을 **의존성에 그대로** 둔다.
   * 이 감지기가 재는 것은 그 사실 하나다: **안내가 매이는 서명이 지금 렌더의 값이어야 한다.**
   * 서명을 참조(`useRef`)로 되돌리면 그 참조를 언제 갱신하는가가 effect 선언 순서에 매인
   * 보이지 않는 규약이 되고, 갱신이 빠지거나 뒤에 서면 첫 렌더의 서명이 굳어 **조건을 한 번이라도
   * 바꾼 뒤의 404에서는 안내가 정리 직후 사라진다.**
   *
   * **다만 참조 형태가 전부 이 감지기에 걸리지는 않는다.** 동기화가 404 effect보다 앞에
   * 서면 여기를 지나가는 형태도 있다(캐시된 404로 다시 들어오는 길) — 잣대로 붙잡히지 않는
   * 형태가 남는다는 것이 참조를 두지 않는 이유다.
   */
  it('조건을 바꾼 뒤 404가 나도 그 조건 위에 안내가 남는다', async () => {
    const { user } = renderScreen(allRoutes([failingDetailRoute(404)]), '', '?q=SAMPLE&ar=9001');

    await waitForList();
    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeInTheDocument();
    await waitFor(() => {
      expect(locationText()).not.toContain('ar=');
    });

    // 첫 렌더의 서명(조건 없음)으로 굳었다면 여기서 안내가 사라진다.
    expect(locationText()).toContain('q=SAMPLE');
    expect(screen.getByText(t.empty.notFoundTitle)).toBeInTheDocument();
  });

  /**
   * **매임 서명에는 쪽도 들어간다.**
   *
   * 주석과 수명 표가 매임을 「조건·**쪽**의 서명」이라 적었다. 조건이 같고 쪽만 바깥에서
   * 바뀌는 길(뒤로가기로 앞 쪽에 돌아가기 · 주소의 `page`만 손으로 고치기)에서 앞 쪽의
   * 안내가 새 쪽 위에 남으면 「안내는 자기 대상보다 오래 살지 않는다」가 이 축에서만 깨진다.
   */
  it('404 안내는 쪽만 바뀌어도 사라진다', async () => {
    const { user } = renderScreen(
      allRoutes([failingDetailRoute(404), listRoute(routeFixtures, { total: 45 })]),
      SELECTED,
      '?page=2',
    );

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeInTheDocument();
    await waitFor(() => {
      expect(locationText()).not.toContain('ar=');
    });

    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await waitFor(() => {
      expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
    });
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  it('404 안내는 조건을 바꾸면 사라진다', async () => {
    const { user } = renderScreen(allRoutes([failingDetailRoute(404)]), SELECTED);

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
    });
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });
});

describe('ApprovalRouteScreen — 다시 조회', () => {
  it('목록만이 아니라 상세와 단계도 함께 부른다', async () => {
    const { requests, user } = renderScreen(allRoutes(), SELECTED);

    await screen.findByRole('region', { name: t.panes.steps });

    const before = {
      list: listRequests(requests).length,
      detail: detailRequests(requests).length,
      steps: stepsRequests(requests).length,
    };

    await user.click(screen.getByRole('button', { name: t.actions.reload }));

    await waitFor(() => {
      expect(listRequests(requests).length).toBe(before.list + 1);
    });
    await waitFor(() => {
      expect(detailRequests(requests).length).toBe(before.detail + 1);
    });
    await waitFor(() => {
      expect(stepsRequests(requests).length).toBe(before.steps + 1);
    });
  });

  /**
   * **참조도 함께 다시 부른다.**
   *
   * 사업부 참조가 실패하면 조건 줄에 「선택지를 불러오지 못했습니다」가 서고 목록의 사업부
   * 칸이 「이름을 불러오지 못했습니다」로 바뀌는데, 그 안내에는 재시도 버튼이 없다.
   * 「다시 조회」의 이 한 줄이 **참조 실패의 유일한 복구 경로**다.
   */
  it('사업부 참조도 함께 다시 부른다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForList();

    const before = requests.filter(
      (request) => request.url.pathname === BUSINESS_UNITS_PATH,
    ).length;

    await user.click(screen.getByRole('button', { name: t.actions.reload }));

    await waitFor(() => {
      expect(
        requests.filter((request) => request.url.pathname === BUSINESS_UNITS_PATH).length,
      ).toBe(before + 1);
    });
  });

  /**
   * **승인자 선택지도 참조다.** 사람이 들고 나는 동안 낡는데, 이 목록에는 재시도 버튼이 없다 —
   * 「다시 조회」가 그 복구 경로다. 결재선을 고른 뒤에만 부르므로 그 안에서 잰다.
   */
  it('승인자 선택지도 함께 다시 부른다', async () => {
    const { requests, user } = renderScreen(allRoutes(), SELECTED);

    await screen.findByRole('region', { name: t.panes.steps });

    const usersCount = (): number =>
      requests.filter((request) => request.url.pathname === USERS_PATH).length;

    // 선행 단언 — 고른 뒤 한 번은 이미 나갔어야 「한 번 더 나갔다」가 뜻을 갖는다.
    await waitFor(() => {
      expect(usersCount()).toBe(1);
    });

    await user.click(screen.getByRole('button', { name: t.actions.reload }));

    await waitFor(() => {
      expect(usersCount()).toBe(2);
    });
  });

  it('참조가 실패해도 「다시 조회」로 이름을 되살릴 수 있다', async () => {
    // 짝 방향 — 복구 경로가 실제로 이름을 되살리는지까지 잰다.
    let hasFailed = false;
    const flakyBusinessUnits: StubRoute = {
      match: (request) => isGet(request, BUSINESS_UNITS_PATH),
      respond: () => {
        if (hasFailed) return jsonResponse(listBody(businessUnitFixtures));
        hasFailed = true;

        return jsonResponse({ message: '' }, { status: 500 });
      },
    };

    const { user } = renderScreen(allRoutes([flakyBusinessUnits]));

    await waitForList();
    expect(await screen.findByText(t.filters.lookupFailed)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.reload }));

    expect(await screen.findByText(BUSINESS_UNIT_LABEL)).toBeInTheDocument();
    expect(screen.queryByText(t.filters.lookupFailed)).not.toBeInTheDocument();
  });

  it('고르지 않았으면 상세·단계를 부르지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForList();
    await user.click(screen.getByRole('button', { name: t.actions.reload }));

    await waitFor(() => {
      expect(listRequests(requests).length).toBe(2);
    });
    expect(detailRequests(requests)).toHaveLength(0);
    expect(stepsRequests(requests)).toHaveLength(0);
  });
});

describe('ApprovalRouteScreen — 빈 상태와 실패', () => {
  it('빈 상태 네 갈래가 서로 다른 안내를 낸다', async () => {
    const titles = new Set([
      t.empty.noResultTitle,
      t.empty.beyondLastTitle,
      t.empty.noSelectionTitle,
      t.empty.noStepsTitle,
    ]);

    expect(titles.size).toBe(4);

    renderScreen(allRoutes([listRoute([])]));

    expect(await screen.findByText(t.empty.noResultTitle)).toBeInTheDocument();
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  it('범위 밖 쪽에는 첫 쪽 안내가 선다', async () => {
    renderScreen(allRoutes([listRoute([], { page: 5, total: 45 })]), '?page=5');

    expect(await screen.findByText(t.empty.beyondLastTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
  });

  it('고른 결재선에 단계가 없으면 그 사실을 낸다', async () => {
    renderScreen(allRoutes([detailRoute(routeFixtures[1]), stepsRoute([])]), '?ar=9002');

    expect(await screen.findByText(t.empty.noStepsTitle)).toBeInTheDocument();
  });

  it('목록 조회 실패는 빈 상태가 아니다', async () => {
    renderScreen(allRoutes([failingListRoute()]));

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
  });

  it('「다시 시도」를 누르면 그 경로를 다시 부른다', async () => {
    const { requests, user } = renderScreen(allRoutes([failingListRoute()]));

    await screen.findByText(messages.httpError.loadTitle);

    const before = listRequests(requests).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(listRequests(requests).length).toBe(before + 1);
    });
  });

  it('단계 조회 실패는 상세를 가리지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes([failingStepsRoute()]), SELECTED);

    await screen.findByRole('region', { name: t.panes.steps });

    // 상세는 그대로 읽힌다 — 한쪽 실패가 다른 쪽을 지우지 않는다.
    const detailPane = screen.getByRole('region', { name: t.panes.detail });

    expect(within(detailPane).getByText('GOODS_ISSUE_DISPOSAL')).toBeInTheDocument();
    expect(within(detailPane).queryByText(messages.httpError.loadTitle)).toBeNull();
    expect(
      within(screen.getByRole('region', { name: t.panes.steps })).getByText(
        messages.httpError.loadTitle,
      ),
    ).toBeInTheDocument();

    const before = stepsRequests(requests).length;
    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(stepsRequests(requests).length).toBe(before + 1);
    });
  });

  it('상세 조회 실패는 404와 다른 안내를 낸다', async () => {
    renderScreen(allRoutes([failingDetailRoute(500)]), SELECTED);

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
    // 500은 주소를 정리하지 않는다 — 그 결재선이 없어진 것이 아니다.
    expect(locationText()).toContain('ar=9001');
  });
});

describe('ApprovalRouteScreen — 이 회차의 경계', () => {
  /** 조회·조건 조작만으로는 쓰기가 나가지 않는다 — 저장은 사용자가 누를 때만 일어난다. */
  it('조회 조작만으로는 쓰기 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes(), SELECTED);

    await screen.findByRole('region', { name: t.panes.steps });
    await user.click(screen.getByRole('button', { name: t.actions.reload }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));
    await waitFor(() => {
      expect(listRequests(requests).length).toBeGreaterThan(1);
    });

    // 선행 단언 — 요청이 실제로 나갔어야 「전부 GET이다」가 뜻을 갖는다.
    expect(requests.length).toBeGreaterThan(0);
    expect(writeRequests(requests)).toHaveLength(0);
  });

  /**
   * 앞 회차에서는 이 자리가 「단계 편집 액션이 아직 없다」였다 — 저장할 수 없는 편집 액션을
   * 미리 내보이지 않는 것이 그때의 경계였다. **이 회차가 그 경계를 옮긴다.**
   */
  it('단계 편집 액션이 선다', async () => {
    renderScreen(allRoutes(), SELECTED);

    const stepPane = await screen.findByRole('region', { name: t.panes.steps });

    // 선행 단언 — 단계가 실제로 그려져야 「편집이 있다」가 그 표를 가리킨다.
    expect(within(stepPane).getByText('합성 승인자1 · 합성부서 가')).toBeInTheDocument();
    expect(within(stepPane).getByRole('button', { name: t.actions.addStep })).toBeInTheDocument();
    expect(within(stepPane).getByRole('button', { name: t.actions.saveSteps })).toBeInTheDocument();
    expect(within(stepPane).getAllByRole('button', { name: '위로 이동' })).toHaveLength(3);
  });

  it('주소로 대상이 바뀌어도 화면이 그 주소를 따른다', async () => {
    const { user } = renderScreen(allRoutes(), '', SELECTED);

    await waitForList();
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await screen.findByRole('region', { name: t.panes.detail });
  });
});

/* ── PR ③ — 등록·수정·사용 전환 ─────────────────────────────────────────────── */

const activationDialog = (): HTMLElement => screen.getByRole('dialog');

const updateRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.method === 'PUT' && isDetailPath(request.url.pathname));

describe('ApprovalRouteScreen — 등록 폼', () => {
  it('「새 결재선」을 누르면 new가 서고 고른 결재선이 풀린다', async () => {
    const { user } = renderScreen(allRoutes(), SELECTED);

    await waitForForm();
    await user.click(screen.getByRole('button', { name: t.actions.create }));

    await waitFor(() => {
      expect(locationText()).toContain('new=1');
    });
    expect(locationText()).not.toContain('ar=');
  });

  /**
   * **등록 중에는 단계 구획이 없다.** 등록 본문에 단계를 실을 수 없고(계약) 치환은 번호를
   * 요구한다 — 붙일 대상이 아직 없는데 구획을 두면 사용자가 여기서 무언가 할 수 있다고 읽는다.
   */
  it('등록 폼에는 단계 구획이 없고 상세·단계를 부르지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForList();
    await user.click(screen.getByRole('button', { name: t.actions.create }));

    expect(await screen.findByRole('region', { name: t.panes.create })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: t.panes.steps })).toBeNull();
    expect(detailRequests(requests)).toHaveLength(0);
    expect(stepsRequests(requests)).toHaveLength(0);
  });

  it('등록 폼에서도 고정 승인 유형을 고를 수 있다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await waitForList();
    await user.click(screen.getByRole('button', { name: t.actions.create }));

    const createPane = await screen.findByRole('region', { name: t.panes.create });
    const approvalType = within(createPane).getByRole('combobox', {
      name: t.fields.approvalTypeCode,
    });
    await user.click(approvalType);
    await user.click(screen.getByRole('option', { name: 'IQC_SKIP' }));

    expect(approvalType).toHaveTextContent('IQC_SKIP');
    expect(within(createPane).queryByText(t.actionReasons.createPendingCode)).toBeNull();
    expect(within(createPane).queryByText(messages.pendingCode.note)).toBeNull();
    expect(writeRequests(requests)).toHaveLength(0);
  });

  /** 잠긴 것은 등록뿐이다 — 짝 방향으로, 이미 있는 결재선은 그대로 고칠 수 있어야 한다. */
  it('등록이 잠겨도 수정은 열려 있다', async () => {
    const { user } = renderScreen(allRoutes(), SELECTED);

    await dirtyForm(user);

    expect(saveButton()).toBeEnabled();
  });

  it('등록 폼을 여는 데 히스토리가 한 칸만 는다', async () => {
    const { user } = renderScreen(allRoutes(), '?q=SAMPLE&ar=9001');

    await waitForForm();
    await user.click(screen.getByRole('button', { name: t.actions.create }));
    await waitFor(() => {
      expect(locationText()).toContain('new=1');
    });

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(locationText()).toBe(`${ROUTE}?q=SAMPLE&ar=9001`);
    });
  });

  /**
   * **같은 주소로는 갱신하지 않는다.** 화면을 바꾸지 않으면서 히스토리 칸만 늘면
   * 뒤로가기가 사용자가 본 적 없는(사실은 똑같은) 자리를 여러 번 지나간다.
   */
  it('「새 결재선」을 두 번 눌러도 히스토리가 한 칸만 는다', async () => {
    const { user } = renderScreen(allRoutes(), '?q=SAMPLE');

    await waitForList();
    await user.click(screen.getByRole('button', { name: t.actions.create }));
    await waitFor(() => {
      expect(locationText()).toContain('new=1');
    });
    await user.click(screen.getByRole('button', { name: t.actions.create }));

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(locationText()).toBe(`${ROUTE}?q=SAMPLE`);
    });
  });

  /** 고치던 값이 새 결재선의 폼에 따라 들어오면 사용자가 그것을 자기가 친 값으로 읽는다. */
  it('고치던 중에 「새 결재선」을 누르면 빈 폼이 선다', async () => {
    const { user } = renderScreen(allRoutes(), SELECTED);

    await dirtyForm(user, '77');
    await user.click(screen.getByRole('button', { name: t.actions.create }));

    const pane = await screen.findByRole('region', { name: t.panes.create });

    expect(within(pane).getByLabelText(t.fields.minValue)).toHaveValue('');
    expect(within(pane).getByLabelText(t.fields.maxValue)).toHaveValue('');
  });

  /** 등록 폼을 닫으면 선택 자리와 등록 표시가 함께 사라진다 — 두 자리는 하나의 자리다. */
  it('등록 폼의 취소가 폼을 닫는다', async () => {
    const { user } = renderScreen(allRoutes());

    await waitForList();
    await user.click(screen.getByRole('button', { name: t.actions.create }));
    await screen.findByRole('region', { name: t.panes.create });

    await user.click(screen.getByRole('button', { name: messages.common.cancel }));

    await waitFor(() => {
      expect(locationText()).not.toContain('new=');
    });
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });
});

describe('ApprovalRouteScreen — 수정 저장', () => {
  /**
   * **세 필드를 늘 명시해 싣는다.** `PUT`은 부분 수정이 아니라 보내지 않은 필드가 비워지므로,
   * 생략으로 비우면 「빠뜨린 것」과 「비우려는 것」이 코드에서도 요청에서도 구별되지 않는다.
   */
  it('수정 본문이 세 필드를 늘 명시하고 비운 칸은 null이다', async () => {
    const { requests, user } = renderScreen(allRoutes([updateRoute()]), SELECTED);

    const minField = await waitForForm();

    await user.clear(minField);
    await user.clear(screen.getByLabelText(t.fields.maxValue));
    await user.click(saveButton());

    await waitFor(() => {
      expect(updateRequests(requests)).toHaveLength(1);
    });

    expect(updateRequests(requests)[0]?.body).toEqual({
      businessUnitId: 9101,
      minValue: null,
      maxValue: null,
    });
  });

  it('수정 본문에 승인 유형과 사용 여부를 싣지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes([updateRoute()]), SELECTED);

    await dirtyForm(user);
    await user.click(saveButton());

    await waitFor(() => {
      expect(updateRequests(requests)).toHaveLength(1);
    });

    const body = updateRequests(requests)[0]?.body as Record<string, unknown>;

    expect(Object.keys(body).sort()).toEqual(['businessUnitId', 'maxValue', 'minValue']);
  });

  /**
   * **잠금 토큰은 상세 경로에서 꺼낸다.** `null`로 두면 토큰 없이 나가 서버가 400을 내고,
   * 액션 경로로 꺼내면 언제나 비어 있어 요청이 아예 나가지 않는다.
   */
  it('수정 요청이 상세 경로에서 꺼낸 If-Match와 멱등 키를 싣는다', async () => {
    const versioned = createVersionedDetail();
    const { requests, user } = renderScreen(allRoutes([versioned.route, updateRoute()]), SELECTED);

    await dirtyForm(user);
    await user.click(saveButton());

    await waitFor(() => {
      expect(updateRequests(requests)).toHaveLength(1);
    });

    const sent = updateRequests(requests)[0];

    expect(sent?.headers.get('If-Match')).toBe('token-1');
    expect(sent?.headers.get('Idempotency-Key')).not.toBeNull();
  });

  /**
   * **모든 쓰기 성공 뒤 상세를 다시 부른다.** 계약이 `PUT` 200의 `ETag`를 **선택**으로 두었다 —
   * 토큰을 주지 않는 서버에서 무효화를 빠뜨리면 **두 번째 저장이 낡은 토큰으로 나가 409**다.
   * 그래서 이 스텁은 저장 응답에 토큰을 싣지 않는다.
   */
  it('저장에 성공하면 상세를 다시 불러 두 번째 저장이 새 토큰을 싣는다', async () => {
    const versioned = createVersionedDetail();
    const { requests, user } = renderScreen(allRoutes([versioned.route, updateRoute()]), SELECTED);

    await dirtyForm(user, '7');
    const before = detailRequests(requests).length;

    await user.click(saveButton());
    await waitFor(() => {
      expect(updateRequests(requests)).toHaveLength(1);
    });
    await waitFor(() => {
      expect(detailRequests(requests).length).toBe(before + 1);
    });

    await dirtyForm(user, '8');
    await user.click(saveButton());
    await waitFor(() => {
      expect(updateRequests(requests)).toHaveLength(2);
    });

    const tokens = updateRequests(requests).map((request) => request.headers.get('If-Match'));

    expect(tokens[0]).toBe('token-1');
    expect(tokens[1]).not.toBe(tokens[0]);
  });

  /** 서버가 정본이다 — 보낸 값을 그대로 두면 서버가 조정한 결과를 놓친다. */
  it('저장에 성공하면 초안이 서버 응답으로 다시 선다', async () => {
    const saved = { ...routeFixtures[0], minValue: 42, maxValue: 999 };
    const { user } = renderScreen(allRoutes([updateRoute(saved)]), SELECTED);

    await dirtyForm(user, '7');
    await user.click(saveButton());

    await waitFor(() => {
      expect(screen.getByLabelText(t.fields.minValue)).toHaveValue('42');
    });
    expect(screen.getByLabelText(t.fields.maxValue)).toHaveValue('999');
    // 다시 세웠으므로 고친 것이 없는 상태다.
    expect(screen.getByRole('button', { name: messages.common.save })).toBeDisabled();
  });

  it('고친 것이 없으면 저장이 잠기고 사유가 보인다', async () => {
    renderScreen(allRoutes(), SELECTED);

    await waitForForm();

    expect(saveButton()).toBeDisabled();
    expect(screen.getByText(t.actionReasons.saveNoChanges)).toBeInTheDocument();
  });

  /**
   * **보내는 자리가 스스로 한 번 더 본다.** 값 구간의 형식·짝 제약은 버튼을 잠그지 않는다
   * (입력 도중에 붉은 글씨를 띄우지 않으려는 것이다) — 이 판정이 없으면 목이 200으로 받아
   * 어긋난 구간이 그대로 저장된다.
   */
  it('상한이 하한보다 작으면 저장을 눌러도 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes([updateRoute()]), SELECTED);

    const minField = await waitForForm();

    await user.clear(minField);
    await user.type(minField, '500');
    await user.clear(screen.getByLabelText(t.fields.maxValue));
    await user.type(screen.getByLabelText(t.fields.maxValue), '100');
    await user.click(saveButton());

    expect(await screen.findByText(t.validation.maxLessThanMin)).toBeInTheDocument();
    expect(writeRequests(requests)).toHaveLength(0);
  });

  it('숫자가 아닌 값은 저장되지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes([updateRoute()]), SELECTED);

    const minField = await waitForForm();

    await user.clear(minField);
    await user.type(minField, 'Infinity');
    await user.click(saveButton());

    expect(await screen.findByText(t.validation.valueNotNumber)).toBeInTheDocument();
    expect(writeRequests(requests)).toHaveLength(0);
  });

  /** 비운 칸의 뜻은 **폼 안에서** 읽힌다 — 창을 하나 더 늘리지 않는다(계획 §13-4). */
  it('사업부를 비우면 그 뜻이 폼 안에서 읽힌다', async () => {
    const { user } = renderScreen(allRoutes(), SELECTED);

    await waitForForm();
    expect(screen.queryByText(t.notes.businessUnitEmpty)).not.toBeInTheDocument();

    await clearBusinessUnit(user);

    expect(await screen.findByText(t.notes.businessUnitEmpty)).toBeInTheDocument();
  });
});

describe('ApprovalRouteScreen — 활성 중복 선검사', () => {
  const OTHER_ACTIVE = { ...routeFixtures[0], approvalRouteId: 9005 };

  /**
   * **읽기만 하는 사용자에게는 나가지 않는다.** 고를 때마다 부르면 결재선 하나를 보는 데
   * 목록 경로로 두 번 나가는 화면이 된다 — 판정이 필요한 자리는 저장·켜기 직전뿐이다.
   */
  it('읽기만 하면 조준 조회가 나가지 않는다', async () => {
    const { requests } = renderScreen(allRoutes(), SELECTED);

    await waitForForm();
    // 선행 단언 — 상세가 실제로 왔어야 「부르지 않았다」가 뜻을 갖는다.
    expect(detailRequests(requests).length).toBeGreaterThan(0);
    expect(probeRequests(requests)).toHaveLength(0);
  });

  it('고치기 시작하면 조준 조회가 activeOnly=true와 size를 싣고 1회 나간다', async () => {
    const { requests, user } = renderScreen(allRoutes(), SELECTED);

    await dirtyForm(user);

    await waitFor(() => {
      expect(probeRequests(requests)).toHaveLength(1);
    });

    const query = probeRequests(requests)[0]?.url.searchParams;

    expect(query?.get('approvalTypeCode')).toBe('GOODS_ISSUE_DISPOSAL');
    expect(query?.get('activeOnly')).toBe('true');
    expect(query?.get('size')).toBe('100');
    /* 사업부는 쿼리로 좁히지 않는다 — 「전 사업부 공통」(null)을 표현할 수 없다. */
    expect(query?.has('businessUnitId')).toBe(false);
  });

  it('같은 유형·사업부로 사용 중인 결재선이 있으면 저장 전에 막힌다', async () => {
    const { requests, user } = renderScreen(allRoutes([probeRoute([OTHER_ACTIVE])]), SELECTED);

    await dirtyForm(user);

    expect(await screen.findByText(t.actionReasons.duplicateActive)).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();

    await user.click(saveButton());

    expect(writeRequests(requests)).toHaveLength(0);
  });

  /** 빼지 않으면 자기 자신 때문에 수정이 **늘** 막힌다. */
  it('선검사가 자기 자신을 제외한다', async () => {
    const { requests, user } = renderScreen(allRoutes([probeRoute([routeFixtures[0]])]), SELECTED);

    await dirtyForm(user);
    await waitFor(() => {
      expect(probeRequests(requests)).toHaveLength(1);
    });

    expect(screen.queryByText(t.actionReasons.duplicateActive)).not.toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  /**
   * **사업부를 비우면 `null`인 것끼리만 맞는다.** 계약이 사업부 지정본과 전 사업부 공통본을
   * 다른 결재선으로 본다 — 뭉개면 정당한 공통본 등록이 지정본 때문에 막힌다.
   */
  it('사업부를 비우면 전 사업부 공통본만 중복으로 센다', async () => {
    const { user } = renderScreen(allRoutes([probeRoute([routeFixtures[1]])]), SELECTED);

    await waitForForm();
    await clearBusinessUnit(user);

    expect(await screen.findByText(t.actionReasons.duplicateActive)).toBeInTheDocument();
  });

  it('사업부를 지정하면 전 사업부 공통본은 중복이 아니다', async () => {
    const { requests, user } = renderScreen(allRoutes([probeRoute([routeFixtures[1]])]), SELECTED);

    await dirtyForm(user);
    await waitFor(() => {
      expect(probeRequests(requests)).toHaveLength(1);
    });

    expect(screen.queryByText(t.actionReasons.duplicateActive)).not.toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  /** 판정하지 못한 것은 막을 근거가 아니다 — 계약이 같은 조건을 400으로 다시 검사한다. */
  it('조준 조회가 실패하면 「확인하지 못했습니다」가 뜨고 저장이 막히지 않는다', async () => {
    const { user } = renderScreen(allRoutes([failingProbeRoute()]), SELECTED);

    await dirtyForm(user);

    expect(await screen.findByText(t.notes.duplicateUnknown)).toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  /** 잘린 목록으로 「없다」고 판정하면 있는 중복을 못 본다 — 조용한 잘림을 만들지 않는다. */
  it('조준 조회가 잘리면 판정하지 않고 막지도 않는다', async () => {
    const { user } = renderScreen(allRoutes([probeRoute([OTHER_ACTIVE], { total: 5 })]), SELECTED);

    await dirtyForm(user);

    expect(await screen.findByText(t.notes.duplicateUnknown)).toBeInTheDocument();
    expect(screen.queryByText(t.actionReasons.duplicateActive)).not.toBeInTheDocument();
    expect(saveButton()).toBeEnabled();
  });

  /**
   * **막기만 하면 사용자는 그 기존 결재선을 목록에서 다시 찾아야 한다.**
   * 그 행은 조준 조회가 이미 실어 왔으므로 **추가 조회 없이** 그 번호로 옮긴다.
   */
  it('막혔을 때 기존 결재선으로 옮겨 가고 그 길에 추가 조회가 없다', async () => {
    const { requests, user } = renderScreen(allRoutes([probeRoute([OTHER_ACTIVE])]), SELECTED);

    await dirtyForm(user);
    await screen.findByText(t.actionReasons.duplicateActive);

    await user.click(screen.getByRole('button', { name: t.actions.openExisting }));

    await waitFor(() => {
      expect(locationText()).toContain('ar=9005');
    });
    expect(probeRequests(requests)).toHaveLength(1);
  });
});

describe('ApprovalRouteScreen — 사용 전환', () => {
  const INACTIVE = { ...routeFixtures[0], isActive: false };

  const openDeactivate = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
    await waitForForm();
    await user.click(screen.getByRole('button', { name: messages.common.deactivate }));
  };

  it('확인 창이 먼저 뜨고 확인하기 전에는 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([activationRoute('deactivate', INACTIVE)]),
      SELECTED,
    );

    await openDeactivate(user);

    expect(activationDialog()).toBeInTheDocument();
    expect(writeRequests(requests)).toHaveLength(0);
  });

  /** 창이 말해야 하는 셋 — 무엇이 막히는가 · 진행 중인 것은 어떻게 되는가 · 되돌릴 수 있는가. */
  it('확인 창이 막히는 것·진행 중 건수·되돌릴 수 있음을 밝힌다', async () => {
    const { user } = renderScreen(allRoutes([activationRoute('deactivate', INACTIVE)]), SELECTED);

    await openDeactivate(user);

    const dialog = activationDialog();

    expect(
      within(dialog).getByText(t.dialog.deactivateBlocks('GOODS_ISSUE_DISPOSAL')),
    ).toBeInTheDocument();
    /* 건수는 결재선 응답이 실어 온 값이다 — 화면이 세지 않는다. */
    expect(within(dialog).getByText(t.dialog.deactivateInProgress(3))).toBeInTheDocument();
    expect(within(dialog).getByText(t.dialog.deactivateReversible)).toBeInTheDocument();
    /* #45 — 창 안에 펼침 목록을 두지 않는다. */
    expect(within(dialog).queryAllByRole('combobox')).toHaveLength(0);
  });

  /**
   * **본문이 없다.** 본문을 실으면 `:deactivate`가 415, `:activate`가 400이다.
   * 토큰은 **상세 경로**에서 꺼낸다 — 액션 경로로 꺼내면 언제나 비어 있어 전환이 전부 멈춘다.
   */
  it('끄기 요청이 상세 토큰을 싣고 본문 없이 나간다', async () => {
    const versioned = createVersionedDetail();
    const { requests, user } = renderScreen(
      allRoutes([versioned.route, activationRoute('deactivate', INACTIVE)]),
      SELECTED,
    );

    await openDeactivate(user);
    await user.click(
      within(activationDialog()).getByRole('button', { name: messages.common.deactivate }),
    );

    await waitFor(() => {
      expect(activationRequests(requests, 'deactivate')).toHaveLength(1);
    });

    const sent = activationRequests(requests, 'deactivate')[0];

    expect(sent?.headers.get('If-Match')).toBe('token-1');
    expect(sent?.headers.get('Idempotency-Key')).not.toBeNull();
    expect(sent?.body).toBeNull();
  });

  /**
   * **200의 `ETag`는 액션 경로에 캡처된다** — 상세 경로의 토큰이 낡는다.
   * 성공 뒤 무효화가 없으면 이어지는 켜기가 **같은(낡은) 토큰**을 싣고 나가 409가 된다.
   */
  it('끄기 성공 뒤 상세를 다시 부르고 이어지는 켜기가 새 토큰을 싣는다', async () => {
    const versioned = createVersionedDetail();
    const { requests, user } = renderScreen(
      allRoutes([
        versioned.route,
        probeRoute(),
        activationRoute('deactivate', INACTIVE),
        activationRoute('activate', routeFixtures[0]),
      ]),
      SELECTED,
    );

    await openDeactivate(user);
    versioned.setBody(INACTIVE);

    const before = detailRequests(requests).length;

    await user.click(
      within(activationDialog()).getByRole('button', { name: messages.common.deactivate }),
    );

    await waitFor(() => {
      expect(detailRequests(requests).length).toBe(before + 1);
    });

    /* 끄기가 끝나면 그 자리에 「다시 사용」이 선다. */
    const activateButton = await screen.findByRole('button', { name: t.actions.activate });

    await user.click(activateButton);
    await user.click(within(activationDialog()).getByRole('button', { name: t.actions.activate }));

    await waitFor(() => {
      expect(activationRequests(requests, 'activate')).toHaveLength(1);
    });

    const deactivateToken = activationRequests(requests, 'deactivate')[0]?.headers.get('If-Match');
    const activateToken = activationRequests(requests, 'activate')[0]?.headers.get('If-Match');

    expect(deactivateToken).toBe('token-1');
    expect(activateToken).not.toBe(deactivateToken);
  });

  /** 계약이 단계 0을 400으로 막는다 — 화면이 먼저 막지 않으면 확인 창을 지난 뒤에 거절이 온다. */
  it('단계가 0이면 「다시 사용」이 잠기고 사유가 보이며 요청이 나가지 않는다', async () => {
    const noSteps = { ...routeFixtures[0], isActive: false, stepCount: 0 };
    const { requests, user } = renderScreen(
      allRoutes([detailRoute(noSteps), probeRoute()]),
      SELECTED,
    );

    const button = await screen.findByRole('button', { name: t.actions.activate });

    expect(button).toBeDisabled();
    expect(screen.getByText(t.actionReasons.activateNoSteps)).toBeInTheDocument();

    await user.click(button);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(writeRequests(requests)).toHaveLength(0);
  });

  it('활성 중복이면 「다시 사용」이 잠기고 사유가 보인다', async () => {
    const otherActive = { ...routeFixtures[0], approvalRouteId: 9005 };
    const { requests } = renderScreen(
      allRoutes([detailRoute(INACTIVE), probeRoute([otherActive])]),
      SELECTED,
    );

    expect(await screen.findByText(t.actionReasons.activateDuplicate)).toBeInTheDocument();
    /* 사유가 붙는 순간 버튼 자체가 갈린다 — 앞서 잡아 둔 노드가 아니라 지금 것을 본다. */
    expect(screen.getByRole('button', { name: t.actions.activate })).toBeDisabled();
    expect(writeRequests(requests)).toHaveLength(0);
  });

  /**
   * **켜기는 폼을 저장하지 않는다** — 그러므로 중복 판정의 사업부는 **서버가 준 값**이지
   * 편집 중인 폼 값이 아니다. 두 판정을 한 줄로 합치면 고치던 값 때문에 켜기가 잘못 막히거나
   * 잘못 열린다.
   *
   * 같은 조준 조회 응답 하나로 **저장은 막히고 켜기는 열리는** 것이 그 사실의 증거다 —
   * 저장은 폼 값(9102 · 충돌)을 보고, 켜기는 서버 값(9101 · 충돌 아님)을 본다.
   */
  it('켜기 중복 판정이 폼 값이 아니라 서버 값을 본다', async () => {
    const inactiveWithUnit = { ...routeFixtures[0], isActive: false };
    const clashOnOtherUnit = {
      ...routeFixtures[0],
      approvalRouteId: 9005,
      businessUnitId: 9102,
      isActive: true,
    };
    const { user } = renderScreen(
      allRoutes([detailRoute(inactiveWithUnit), probeRoute([clashOnOtherUnit])]),
      SELECTED,
    );

    /* 선행 단언 — 고치기 전에는 켜기가 열려 있다(서버 사업부 9101에 충돌이 없다). */
    expect(await screen.findByRole('button', { name: t.actions.activate })).toBeEnabled();

    const pane = screen.getByRole('region', { name: t.panes.detail });

    await user.click(within(pane).getByRole('combobox', { name: t.fields.businessUnit }));
    /* 고르는 자리라 미사용 표식이 붙는다 — 빼면 그 사업부가 걸린 결재선을 만들 길이 사라진다. */
    await user.click(
      screen.getByRole('option', {
        name: `${INACTIVE_BUSINESS_UNIT_LABEL}${t.values.inactiveSuffix}`,
      }),
    );

    /* 폼 값(9102)은 충돌이라 **저장은** 막힌다 — 판정이 실제로 돌았다는 증거다. */
    expect(await screen.findByText(t.actionReasons.duplicateActive)).toBeInTheDocument();
    /* 그런데도 **켜기는** 열려 있다 — 켜기가 보는 것은 서버 값이기 때문이다. */
    expect(screen.getByRole('button', { name: t.actions.activate })).toBeEnabled();
    expect(screen.queryByText(t.actionReasons.activateDuplicate)).not.toBeInTheDocument();
  });

  /**
   * **창은 자기 대상보다 오래 살지 않는다.** 살아남으면 앞 결재선을 끄려고 연 창이
   * 다음 결재선을 끈다 — 쓰기 대상은 지금 주소를 읽기 때문이다.
   */
  it('창이 열린 채 주소로 대상이 바뀌면 창이 닫히고 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([activationRoute('deactivate', INACTIVE)]),
      SELECTED,
      '?ar=9002',
    );

    await openDeactivate(user);
    expect(activationDialog()).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(writeRequests(requests)).toHaveLength(0);
  });

  /** 취소는 서버를 부르지 않는다 — 창만 닫힌다. */
  it('확인 창의 취소는 요청을 내지 않는다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([activationRoute('deactivate', INACTIVE)]),
      SELECTED,
    );

    await openDeactivate(user);
    await user.click(
      within(activationDialog()).getByRole('button', { name: messages.common.cancel }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(writeRequests(requests)).toHaveLength(0);
  });

  it('끄기에 성공하면 창이 닫힌다', async () => {
    const versioned = createVersionedDetail();
    const { user } = renderScreen(
      allRoutes([versioned.route, probeRoute(), activationRoute('deactivate', INACTIVE)]),
      SELECTED,
    );

    await openDeactivate(user);
    versioned.setBody(INACTIVE);
    await user.click(
      within(activationDialog()).getByRole('button', { name: messages.common.deactivate }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  /**
   * **실패하면 창을 닫지 않는다.** 닫으면 사용자는 무엇이 막았는지 모른 채 같은 버튼을
   * 다시 누르고, 멱등 키가 호출마다 새로 만들어져(#55) 그 재시도는 새 요청이 된다.
   */
  it('끄기에 실패하면 창이 열린 채 사유가 창 안에 선다', async () => {
    const { user } = renderScreen(
      allRoutes([
        failingActivationRoute('deactivate', 409, { conflictCause: 'user', message: '' }),
      ]),
      SELECTED,
    );

    await openDeactivate(user);
    await user.click(
      within(activationDialog()).getByRole('button', { name: messages.common.deactivate }),
    );

    expect(await screen.findByText(messages.conflict.user)).toBeInTheDocument();
    expect(within(activationDialog()).getByText(messages.conflict.user)).toBeInTheDocument();
  });

  /** 사용 전환은 폼 필드가 아니다 — 켜고 끄는 일이 편집 중인 값을 버릴 이유가 없다. */
  it('끄기 성공이 폼 초안을 건드리지 않는다', async () => {
    const versioned = createVersionedDetail();
    const { user } = renderScreen(
      allRoutes([versioned.route, probeRoute(), activationRoute('deactivate', INACTIVE)]),
      SELECTED,
    );

    await dirtyForm(user, '77');
    await user.click(screen.getByRole('button', { name: messages.common.deactivate }));
    versioned.setBody(INACTIVE);
    await user.click(
      within(activationDialog()).getByRole('button', { name: messages.common.deactivate }),
    );

    await screen.findByRole('button', { name: t.actions.activate });

    expect(screen.getByLabelText(t.fields.minValue)).toHaveValue('77');
  });
});

describe('ApprovalRouteScreen — 전송 중', () => {
  /** 붙잡을 것은 **저장 요청 하나**다 — 상세 조회까지 붙잡으면 폼이 서기도 전에 멈춘다. */
  const holdSave = (request: Request): boolean =>
    request.method === 'PUT' && isDetailPath(new URL(request.url).pathname);

  /**
   * **연타해도 요청은 1회다.** 공통 쓰기 훅이 호출마다 새 멱등 키를 만들어(#55) 두 번 나가면
   * 서버에는 다른 요청으로 보인다 — 화면 차원의 잠금이 그 자리를 막는 첫째 겹이다.
   */
  it('연타해도 요청이 1회이고 컨트롤이 잠긴다', async () => {
    const { requests, release, user } = renderScreen(
      allRoutes([updateRoute()]),
      SELECTED,
      '',
      holdSave,
    );

    await dirtyForm(user);
    await user.click(saveButton());

    await waitFor(() => {
      expect(updateRequests(requests)).toHaveLength(1);
    });

    /* 첫째 겹 — 눈에 보이는 컨트롤이 닫혔다. */
    expect(screen.getByLabelText(t.fields.minValue)).toBeDisabled();
    expect(screen.getByLabelText(t.fields.maxValue)).toBeDisabled();
    expect(saveButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: messages.common.deactivate })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.create })).toBeDisabled();

    await user.click(saveButton());

    expect(updateRequests(requests)).toHaveLength(1);

    release();
    await screen.findByRole('status');
  });

  /**
   * **둘째 겹** — 목록 행의 고르기 버튼은 잠금을 받지 않는다. 그 길로 대상이 바뀌면
   * 앞서 보낸 저장의 결과가 **다른 결재선 맥락에** 나타난다. 첫째 겹이 닿지 않는 자리라
   * 핸들러 가드가 홀로 막는다.
   */
  it('전송 중에는 목록 행으로도 대상이 바뀌지 않는다', async () => {
    const { requests, release, user } = renderScreen(
      allRoutes([updateRoute()]),
      SELECTED,
      '',
      holdSave,
    );

    await dirtyForm(user);
    await user.click(saveButton());
    await waitFor(() => {
      expect(updateRequests(requests)).toHaveLength(1);
    });

    await user.click(selectRouteButton('INVENTORY_ADJUSTMENT', INACTIVE_BUSINESS_UNIT_LABEL));

    expect(locationText()).toContain('ar=9001');
    expect(locationText()).not.toContain('ar=9003');

    release();
    await screen.findByRole('status');
  });
});

describe('ApprovalRouteScreen — 저장 실패 갈래', () => {
  const FIELD_ERROR = {
    errors: [{ scope: 'field', field: 'minValue', code: 'INVALID', message: '합성 필드 오류' }],
  };
  const STATE_LOCKED = {
    errors: [{ scope: 'screen', code: 'STATE_LOCKED', message: '합성 상태 잠금' }],
  };
  const CONFLICT = { conflictCause: 'user', message: '' };

  const saveWith = async (route: StubRoute): Promise<RecordedRequest[]> => {
    const { requests, user } = renderScreen(allRoutes([route]), SELECTED);

    await dirtyForm(user, '77');
    await user.click(saveButton());

    return requests;
  };

  /**
   * 화면이 아는 필드의 오류는 **그 칸 옆으로** 간다 — 배너로 뭉개면 어디를 고칠지 알 수 없다.
   *
   * **「글자가 어딘가 있다」로는 부족하다.** 그 단언만 두면 오류가 배너로 밀려도 통과한다 —
   * `knownFields`를 잘못 채우면 정확히 그 일이 일어난다(입력칸 없는 이름을 채우면 반대로
   * **어디에도 보이지 않는** 오류가 된다 · 계획 결정 16 · W-01-04 정정 4).
   * 그래서 **그 칸의 접근 설명에 붙었는지**를 잰다.
   */
  it('필드 오류가 그 입력칸에 붙고 입력이 남는다', async () => {
    await saveWith(failingUpdateRoute(400, FIELD_ERROR));

    await screen.findByText('합성 필드 오류');

    expect(screen.getByLabelText(t.fields.minValue)).toHaveAccessibleDescription('합성 필드 오류');
    /* 짝 방향 — 오류는 그 칸에만 붙는다. 다른 칸까지 붉어지면 어디를 고칠지 다시 흐려진다. */
    expect(screen.getByLabelText(t.fields.maxValue)).not.toHaveAccessibleDescription(
      '합성 필드 오류',
    );
    expect(screen.getByLabelText(t.fields.minValue)).toHaveValue('77');
  });

  /** 다시 불러와도 풀리지 않는 상태다 — 「최신 불러오기」를 권하면 입력만 버리게 된다. */
  it('상태 잠금은 재시도를 권하지 않는다', async () => {
    await saveWith(failingUpdateRoute(400, STATE_LOCKED));

    expect(await screen.findByText(messages.stateLocked.title)).toBeInTheDocument();
    expect(screen.getByText('합성 상태 잠금')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.conflict.reloadAction })).toBeNull();
  });

  it('권한 없음은 그 사유를 낸다', async () => {
    await saveWith(failingUpdateRoute(403));

    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.conflict.reloadAction })).toBeNull();
  });

  /** 재조회로 풀리는 것은 충돌뿐이다. */
  it('409에만 「최신 불러오기」가 붙는다', async () => {
    await saveWith(failingUpdateRoute(409, CONFLICT));

    expect(await screen.findByText(messages.conflict.user)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: messages.conflict.reloadAction }),
    ).toBeInTheDocument();
  });

  /**
   * **응답이 오지 않은 요청은 「실패」가 아니다**(#55). 훅이 호출마다 새 멱등 키를 만들어
   * 그대로 다시 보내면 서버에는 다른 요청으로 보인다 — 화면이 그 사실을 말한다.
   */
  it('네트워크 갈래에만 「전달됐는지 확인할 수 없습니다」가 붙는다', async () => {
    const offline: StubRoute = {
      match: (request) => request.method === 'PUT' && isDetailPath(new URL(request.url).pathname),
      respond: () => {
        throw new Error('합성 네트워크 끊김');
      },
    };

    await saveWith(offline);

    expect(await screen.findByText(messages.httpError.offline)).toBeInTheDocument();
    expect(screen.getByText(t.notes.networkUnconfirmed)).toBeInTheDocument();
  });

  it('서버가 거절한 갈래에는 그 안내가 붙지 않는다', async () => {
    await saveWith(failingUpdateRoute(409, CONFLICT));

    expect(await screen.findByText(messages.conflict.user)).toBeInTheDocument();
    expect(screen.queryByText(t.notes.networkUnconfirmed)).not.toBeInTheDocument();
  });

  it('실패해도 입력이 남는다', async () => {
    await saveWith(failingUpdateRoute(409, CONFLICT));

    await screen.findByText(messages.conflict.user);
    expect(screen.getByLabelText(t.fields.minValue)).toHaveValue('77');
  });
});

describe('ApprovalRouteScreen — 배너 매임과 초안 수명', () => {
  const CONFLICT = { conflictCause: 'user', message: '' };

  const failThenSelect = async (
    extra: StubRoute[] = [],
  ): Promise<{
    requests: RecordedRequest[];
    user: ReturnType<typeof userEvent.setup>;
  }> => {
    const { requests, user } = renderScreen(
      allRoutes([...extra, failingUpdateRoute(409, CONFLICT)]),
      SELECTED,
    );

    await dirtyForm(user, '77');
    await user.click(saveButton());
    await screen.findByText(messages.conflict.user);

    return { requests, user };
  };

  /** **배너는 자기 대상보다 오래 살지 않는다** — 결재선 B에 결재선 A의 거절 사유가 서면 안 된다. */
  it('실패 배너가 대상이 바뀌면 사라진다', async () => {
    const { user } = await failThenSelect();

    await user.click(selectRouteButton('INVENTORY_ADJUSTMENT', INACTIVE_BUSINESS_UNIT_LABEL));

    await waitFor(() => {
      expect(screen.queryByText(messages.conflict.user)).not.toBeInTheDocument();
    });
  });

  /** 뒤로가기·주소 직접 편집은 클릭 핸들러를 거치지 않는다 — 그 길에서도 거둬져야 한다. */
  it('주소로 대상이 바뀌어도 실패 배너가 사라진다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([failingUpdateRoute(409, CONFLICT)]),
      SELECTED,
      '?ar=9002',
    );

    await dirtyForm(user, '77');
    await user.click(saveButton());
    await screen.findByText(messages.conflict.user);
    expect(updateRequests(requests)).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await waitFor(() => {
      expect(screen.queryByText(messages.conflict.user)).not.toBeInTheDocument();
    });
  });

  /** **너무 지우지도 않는다** — 값을 고치는 동안 사라지면 사용자가 무엇을 고쳐야 할지 잃는다. */
  it('실패 배너가 폼 입력에는 남는다', async () => {
    const { user } = await failThenSelect();

    await user.type(screen.getByLabelText(t.fields.maxValue), '9');

    expect(screen.getByText(messages.conflict.user)).toBeInTheDocument();
  });

  /**
   * **렌더마다·응답마다 지워지지도 않는다.** 정리 effect의 의존성에 응답을 넣거나 배열을
   * 비우면 배너가 서자마자 사라져 사용자가 이유를 볼 수 없다.
   *
   * **응답이 실제로 달라져야 이 감지기가 뜻을 갖는다.** 같은 값을 돌려주면 캐시가 객체
   * 동일성을 지켜 주어(구조 공유) 「응답을 의존성에 넣었다」는 오류가 드러나지 않는다.
   */
  it('실패 배너가 다른 응답이 도착해도 남는다', async () => {
    let hits = 0;
    const changingDetail: StubRoute = {
      match: (request) => request.method === 'GET' && isDetailPath(new URL(request.url).pathname),
      respond: () => {
        hits += 1;

        return jsonResponse(
          { ...routeFixtures[0], inProgressCount: hits },
          { headers: { ETag: `token-${String(hits)}` } },
        );
      },
    };

    const { user } = await failThenSelect([changingDetail]);

    const beforeHits = hits;

    await user.click(screen.getByRole('button', { name: t.actions.reload }));

    /* 상세가 **다른 값**으로 다시 도착한 것을 먼저 확인한다. */
    await waitFor(() => {
      expect(hits).toBeGreaterThan(beforeHits);
    });
    await waitFor(() => {
      expect(screen.getByText(t.notes.inProgressSome(hits))).toBeInTheDocument();
    });

    expect(screen.getByText(messages.conflict.user)).toBeInTheDocument();
  });

  /**
   * **#43** — 초안은 응답 객체가 아니라 **대상 키**에 매여 있다. 응답 배열이나 파생 객체에
   * 매면 목록이 갱신될 때마다 치던 값이 사라진다.
   */
  it('폼 초안이 응답 도착에 되돌아가지 않는다', async () => {
    const { user } = renderScreen(allRoutes(), SELECTED);

    await dirtyForm(user, '77');
    await user.click(screen.getByRole('button', { name: t.actions.reload }));

    await waitFor(() => {
      expect(screen.getByLabelText(t.fields.minValue)).toHaveValue('77');
    });
    expect(screen.getByLabelText(t.fields.minValue)).toHaveValue('77');
  });

  /** 대상이 바뀌면 초안은 새 대상의 값으로 다시 선다 — 앞 결재선의 값이 남으면 안 된다. */
  it('대상이 바뀌면 초안이 새 결재선의 값으로 다시 선다', async () => {
    const { user } = renderScreen(allRoutes([detailRoute(routeFixtures[2])]), SELECTED);

    await dirtyForm(user, '77');
    await user.click(selectRouteButton('INVENTORY_ADJUSTMENT', INACTIVE_BUSINESS_UNIT_LABEL));

    await waitFor(() => {
      expect(screen.getByLabelText(t.fields.minValue)).toHaveValue('0');
    });
  });

  /** 되돌리면 친 값이 사라진다 — 되돌릴 수 없는 조작 앞에 한 걸음을 둔다. */
  it('취소는 파기를 확인한 뒤에 되돌린다', async () => {
    const { requests, user } = renderScreen(allRoutes(), SELECTED);

    await dirtyForm(user, '77');
    await user.click(screen.getByRole('button', { name: messages.common.cancel }));

    expect(await screen.findByText(messages.common.discardChangesConfirm)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.minValue)).toHaveValue('77');

    await user.click(screen.getByRole('button', { name: t.actions.discardDraft }));

    await waitFor(() => {
      expect(screen.getByLabelText(t.fields.minValue)).toHaveValue('100');
    });
    /* 파기는 **서버를 부르지 않는다**. */
    expect(writeRequests(requests)).toHaveLength(0);
  });

  it('계속 편집을 고르면 친 값이 그대로 남는다', async () => {
    const { user } = renderScreen(allRoutes(), SELECTED);

    await dirtyForm(user, '77');
    await user.click(screen.getByRole('button', { name: messages.common.cancel }));
    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));

    await waitFor(() => {
      expect(screen.queryByText(messages.common.discardChangesConfirm)).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText(t.fields.minValue)).toHaveValue('77');
  });
});

/**
 * **전송 중에 주소가 바깥에서 바뀌는 길** — 뒤로가기·앞으로가기·주소 직접 편집.
 *
 * 이 길은 화면의 클릭 핸들러를 지나지 않아 전송 중 잠금 문(`applyUserNavigation`)에 걸리지
 * 않는다. 그래서 대상이 바뀌고, 그때 배너·창 정리가 깨어난다 — 그 정리가 **나가는 중인
 * 요청까지 끊으면** 무효화·성공·실패·공동 잠금이 통째로 사라진다.
 *
 * **끊는 것과 감추는 것은 다르다.** 규칙(「결과는 자기 대상보다 오래 살지 않는다」)이 요구하는
 * 것은 *보이지 않는 것*이지 *일어나지 않는 것*이 아니다 — 서버에는 이미 갔다.
 */
describe('ApprovalRouteScreen — 전송 중 바깥 주소 이동', () => {
  const holdUpdate = (request: Request): boolean =>
    request.method === 'PUT' && isDetailPath(new URL(request.url).pathname);
  const holdDeactivate = (request: Request): boolean =>
    request.method === 'POST' && isActionPath(new URL(request.url).pathname, 'deactivate');

  const createButton = (): HTMLElement => screen.getByRole('button', { name: t.actions.create });

  it('수정이 나가는 중에 대상이 바뀌어도 잠금·무효화·성공 알림이 살아 있다', async () => {
    const { requests, release, user } = renderScreen(
      allRoutes([detailRouteById(), updateRoute()]),
      SELECTED,
      '?ar=9003',
      holdUpdate,
    );

    await dirtyForm(user, '77');
    await user.click(saveButton());
    await waitFor(() => {
      expect(updateRequests(requests)).toHaveLength(1);
    });

    /* 바깥에서 대상을 갈아 끼운다 — 잠금 문을 지나지 않는 길이다. */
    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitFor(() => {
      expect(locationText()).toContain('ar=9003');
    });

    /* ① 공동 잠금이 살아 있다 — 요청은 아직 날아가는 중이다. */
    expect(createButton()).toBeDisabled();

    const beforeDetail = detailRequests(requests).length;

    release();

    /* ② 성공이 사라지지 않는다. */
    expect(await screen.findByText(messages.common.saved)).toBeInTheDocument();
    /* ③ 무효화가 살아 있다 — 이것이 없으면 다음 저장이 낡은 토큰으로 나간다. */
    await waitFor(() => {
      expect(detailRequests(requests).length).toBeGreaterThan(beforeDetail);
    });
  });

  /** **남의 값을 새 대상의 초안에 찍지 않는다** — 되먹임은 그 요청이 겨눈 대상에 맨다. */
  it('수정 결과가 새 대상의 폼을 덮지 않는다', async () => {
    const saved = { ...routeFixtures[0], minValue: 42, maxValue: 999 };
    const { requests, release, user } = renderScreen(
      allRoutes([detailRouteById(), updateRoute(saved)]),
      SELECTED,
      '?ar=9003',
      holdUpdate,
    );

    await dirtyForm(user, '77');
    await user.click(saveButton());
    await waitFor(() => {
      expect(updateRequests(requests)).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await screen.findByText(t.notes.approvalTypeFixed);

    release();
    await screen.findByText(messages.common.saved);

    /* 9003의 하한은 0이다 — 9001에 보낸 저장의 응답(42)이 여기 앉으면 안 된다. */
    await waitFor(() => {
      expect(screen.getByLabelText(t.fields.minValue)).toHaveValue('0');
    });
  });

  /** 실패도 같은 자리에서 사라진다 — 400·403·409가 배너 없이 증발하면 안 된다. */
  it('수정이 실패해도 그 결과가 삼켜지지 않고 잠금이 제때 풀린다', async () => {
    const { requests, release, user } = renderScreen(
      allRoutes([
        detailRouteById(),
        failingUpdateRoute(409, { conflictCause: 'user', message: '' }),
      ]),
      SELECTED,
      '?ar=9003',
      holdUpdate,
    );

    await dirtyForm(user, '77');
    await user.click(saveButton());
    await waitFor(() => {
      expect(updateRequests(requests)).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    expect(createButton()).toBeDisabled();

    release();

    /* 잠금이 **도착한 뒤에** 풀린다 — 끊어서가 아니라 끝나서 풀리는 것이다. */
    await waitFor(() => {
      expect(createButton()).toBeEnabled();
    });
    /* 그러나 남의 대상의 거절 사유를 이 화면에 세우지는 않는다 — 감추는 것이 규칙이다. */
    expect(screen.queryByText(messages.conflict.user)).not.toBeInTheDocument();
  });

  it('끄기가 나가는 중에 대상이 바뀌어도 잠금·무효화·성공 알림이 살아 있다', async () => {
    const { requests, release, user } = renderScreen(
      allRoutes([
        detailRouteById(),
        activationRoute('deactivate', { ...routeFixtures[0], isActive: false }),
      ]),
      SELECTED,
      '?ar=9003',
      holdDeactivate,
    );

    await waitForForm();
    await user.click(screen.getByRole('button', { name: messages.common.deactivate }));
    await user.click(
      within(activationDialog()).getByRole('button', { name: messages.common.deactivate }),
    );
    await waitFor(() => {
      expect(activationRequests(requests, 'deactivate')).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitFor(() => {
      expect(locationText()).toContain('ar=9003');
    });

    expect(createButton()).toBeDisabled();

    const beforeDetail = detailRequests(requests).length;

    release();

    expect(await screen.findByText(messages.common.saved)).toBeInTheDocument();
    await waitFor(() => {
      expect(detailRequests(requests).length).toBeGreaterThan(beforeDetail);
    });
  });
});

describe('ApprovalRouteScreen — 확인 창이 열린 사이 상태가 뒤집히면', () => {
  /**
   * **열린 창의 뜻은 열 때 정해지고, 대상의 상태는 그 뒤에도 바뀐다.**
   *
   * 「다시 조회」는 잠기지 않고 다른 사람이 먼저 상태를 바꿀 수도 있다. 그때 폼의 액션은
   * 반대쪽으로 바뀌지만 **열린 창의 뜻은 그대로**라, 확인하면 이미 꺼진 것에 `:deactivate`가,
   * 이미 켜진 것에 `:activate`가 나간다 — 뒤엣것은 계약이 400으로 막아 **사용자가 이유를 알
   * 수 없는 거절**이 된다.
   */
  it('끄기 창이 열린 사이 이미 꺼졌으면 보내지 않고 창을 닫는다', async () => {
    let flipped = false;
    const flippingDetail: StubRoute = {
      match: (request) => request.method === 'GET' && isDetailPath(new URL(request.url).pathname),
      respond: () => {
        const body = flipped ? { ...routeFixtures[0], isActive: false } : routeFixtures[0];

        flipped = true;

        return jsonResponse(body, { headers: { ETag: 'token-0' } });
      },
    };

    const { requests, user } = renderScreen(
      allRoutes([
        flippingDetail,
        probeRoute(),
        activationRoute('deactivate', { ...routeFixtures[0], isActive: false }),
      ]),
      SELECTED,
    );

    await waitForForm();
    await user.click(screen.getByRole('button', { name: messages.common.deactivate }));
    expect(activationDialog()).toBeInTheDocument();

    /* 창이 열린 채 상세가 다시 온다 — 그 사이 다른 사람이 이미 껐다. */
    await user.click(screen.getByRole('button', { name: t.actions.reload }));
    await screen.findByRole('button', { name: t.actions.activate });

    await user.click(
      within(activationDialog()).getByRole('button', { name: messages.common.deactivate }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(writeRequests(requests)).toHaveLength(0);
  });

  /** 짝 방향 — 상태가 그대로면 확인이 그대로 나간다. 안 그러면 「아무것도 안 보낸다」와 같아진다. */
  it('상태가 그대로면 확인이 요청을 보낸다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([activationRoute('deactivate', { ...routeFixtures[0], isActive: false })]),
      SELECTED,
    );

    await waitForForm();
    await user.click(screen.getByRole('button', { name: messages.common.deactivate }));
    await user.click(
      within(activationDialog()).getByRole('button', { name: messages.common.deactivate }),
    );

    await waitFor(() => {
      expect(activationRequests(requests, 'deactivate')).toHaveLength(1);
    });
  });
});

describe('ApprovalRouteScreen — 「확인하지 못했습니다」의 범위', () => {
  /** 밝힐 때만 밝힌다 — 구경만 하는 사용자에게 저장 안내를 띄우지 않는다. */
  it('꺼진 결재선을 고르기만 하면 조준 조회가 실패해도 안내가 뜨지 않는다', async () => {
    const { requests } = renderScreen(
      allRoutes([detailRoute({ ...routeFixtures[0], isActive: false }), failingProbeRoute()]),
      SELECTED,
    );

    // 선행 단언 — 조준 조회는 실제로 나갔고(켜기 판정에 필요하다) 실패했다.
    await screen.findByRole('button', { name: t.actions.activate });
    await waitFor(() => {
      expect(probeRequests(requests)).toHaveLength(1);
    });

    expect(screen.queryByText(t.notes.duplicateUnknown)).not.toBeInTheDocument();
  });

  it('고치기 시작하면 그 안내가 선다', async () => {
    const { user } = renderScreen(
      allRoutes([detailRoute({ ...routeFixtures[0], isActive: false }), failingProbeRoute()]),
      SELECTED,
    );

    await dirtyForm(user, '77');

    expect(await screen.findByText(t.notes.duplicateUnknown)).toBeInTheDocument();
  });
});

describe('ApprovalRouteScreen — 전송 중 확인 창에서 나가기', () => {
  const holdDeactivate = (request: Request): boolean =>
    request.method === 'POST' && isActionPath(new URL(request.url).pathname, 'deactivate');

  /**
   * **Escape는 막을 수 없다.** native `<dialog>`가 `cancel`을 내고 디자인 시스템이 그것을
   * 닫기 요청으로 무조건 잇는다 — 주소를 건드리지 않고도 창에서 나갈 수 있다.
   *
   * 그러므로 규율은 「닫히지 않게」가 아니라 **「닫혀도 무너지지 않게」**다. 창을 닫는 길이
   * 나가는 중인 요청의 옵저버를 떼면, 대상 이동과 똑같이 무효화·성공·잠금이 함께 사라진다 —
   * 이 화면의 토큰 수명 표가 「반드시 부른다」고 적은 재조회가 그때 빠진다.
   */
  it('창을 닫아도 전환의 되먹임이 끊기지 않는다', async () => {
    const versioned = createVersionedDetail();
    const { requests, release, user } = renderScreen(
      allRoutes([
        versioned.route,
        probeRoute(),
        activationRoute('deactivate', { ...routeFixtures[0], isActive: false }),
      ]),
      SELECTED,
      '',
      holdDeactivate,
    );

    await waitForForm();
    await user.click(screen.getByRole('button', { name: messages.common.deactivate }));
    await user.click(
      within(activationDialog()).getByRole('button', { name: messages.common.deactivate }),
    );
    await waitFor(() => {
      expect(activationRequests(requests, 'deactivate')).toHaveLength(1);
    });

    versioned.setBody({ ...routeFixtures[0], isActive: false });

    /* 창에서 나간다 — 주소는 그대로다. */
    fireEvent(activationDialog(), new Event('cancel', { bubbles: false, cancelable: true }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    /* ① 공동 잠금이 살아 있다 — 요청은 아직 날아가는 중이다. */
    expect(screen.getByRole('button', { name: t.actions.create })).toBeDisabled();

    const beforeDetail = detailRequests(requests).length;

    release();

    /* ② 성공이 사라지지 않는다. ③ 무효화가 살아 있다. */
    expect(await screen.findByText(messages.common.saved)).toBeInTheDocument();
    await waitFor(() => {
      expect(detailRequests(requests).length).toBeGreaterThan(beforeDetail);
    });
  });
});

describe('ApprovalRouteScreen — 되먹임의 매임은 실패에도 같은 축이다', () => {
  const CONFLICT = { conflictCause: 'user', message: '' };

  const holdUpdate = (request: Request): boolean =>
    request.method === 'PUT' && isDetailPath(new URL(request.url).pathname);

  /**
   * **「감추는 것이 규칙이다」를 과잉 적용하지 않는다.**
   *
   * 보내는 사이에 다른 결재선을 들렀다 **돌아왔다면** 그 거절 사유는 남의 것이 아니라
   * **지금 보는 대상의 것**이다. 성공 갈래는 「그 요청이 겨눈 대상」과 지금 대상을 견주는데
   * 실패 갈래만 한 번 세워지면 내려가지 않는 깃발로 가리면, 있는 것이 안 보인다.
   */
  it('들렀다 돌아온 대상의 거절 사유는 그대로 선다', async () => {
    const { requests, release, user } = renderScreen(
      allRoutes([detailRouteById(), failingUpdateRoute(409, CONFLICT)]),
      SELECTED,
      '?ar=9003',
      holdUpdate,
    );

    await dirtyForm(user, '77');
    await user.click(saveButton());
    await waitFor(() => {
      expect(updateRequests(requests)).toHaveLength(1);
    });

    /*
     * 9001 → 9003 → 다시 9001. 도착 시점의 대상은 처음과 같다.
     *
     * **오갈 때 둘 다 바깥 길을 쓴다** — 전송 중에는 화면 안의 길(목록 행)이 잠겨 있고,
     * 바로 그 잠금 때문에 이 갈래가 **뒤로가기로만** 열린다.
     */
    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitFor(() => {
      expect(locationText()).toContain('ar=9003');
    });
    await user.click(screen.getByRole('button', { name: '뒤로' }));
    await waitFor(() => {
      expect(locationText()).toContain('ar=9001');
    });

    release();

    expect(await screen.findByText(messages.conflict.user)).toBeInTheDocument();
  });

  /**
   * 짝 방향 — **인라인 오류도 같은 문을 지난다.** 배너만 감추면 새 대상의 칸 옆에
   * 남의 오류가 붙어, 사용자가 고치지도 않은 값이 잘못됐다고 읽는다.
   */
  it('남의 필드 오류가 새 대상의 칸에 붙지 않는다', async () => {
    const FIELD_ERROR = {
      errors: [{ scope: 'field', field: 'minValue', code: 'INVALID', message: '합성 필드 오류' }],
    };
    const { requests, release, user } = renderScreen(
      allRoutes([detailRouteById(), failingUpdateRoute(400, FIELD_ERROR)]),
      SELECTED,
      '?ar=9003',
      holdUpdate,
    );

    await dirtyForm(user, '77');
    await user.click(saveButton());
    await waitFor(() => {
      expect(updateRequests(requests)).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await screen.findByText(t.notes.approvalTypeFixed);

    release();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: t.actions.create })).toBeEnabled();
    });

    // 선행 단언 — 9003의 폼이 실제로 서 있다.
    expect(screen.getByLabelText(t.fields.minValue)).toHaveValue('0');
    expect(screen.queryByText('합성 필드 오류')).not.toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.minValue)).not.toHaveAccessibleDescription(
      '합성 필드 오류',
    );
  });
});

/* ── PR ④ — 단계 편집·치환 저장 ─────────────────────────────────────────────── */

/**
 * 넷째 쓰기다. 앞 셋과 **낙관적 잠금 규약이 다르다** — 하위 컬렉션의 쓰기인데 토큰이 부모의
 * 것이고, 200 응답에 `ETag`가 아예 없다. 그래서 「성공 뒤 상세를 다시 부른다」가 여기서는
 * 선택이 아니라 유일한 토큰 확보 경로다.
 */

const stepPane = async (): Promise<HTMLElement> =>
  screen.findByRole('region', { name: t.panes.steps });

const addStepButton = (): HTMLElement => screen.getByRole('button', { name: t.actions.addStep });

/** **단계 표의 줄만 센다** — 화면에는 결재선 목록 표가 함께 서 있어 바깥에서 세면 둘이 섞인다. */
const stepRows = (): HTMLElement[] =>
  within(screen.getByRole('region', { name: t.panes.steps })).getAllByRole('row');
const saveStepsButton = (): HTMLElement =>
  screen.getByRole('button', { name: t.actions.saveSteps });

/** 추가 줄에서 승인자를 골라 한 단계를 더한다. 표를 더럽히는 가장 짧은 길이다. */
const addStep = async (
  user: ReturnType<typeof userEvent.setup>,
  label = APPROVER_OPTION_LABEL,
): Promise<void> => {
  const pane = await stepPane();

  await user.click(within(pane).getByRole('combobox', { name: t.fields.approver }));
  await user.click(screen.getByRole('option', { name: label }));
  await user.click(addStepButton());
};

/** 단계 하나짜리 결재선. 「마지막 한 단계는 지울 수 없다」를 재는 자리다. */
const singleStepFixture = [stepFixtures[0]];

describe('ApprovalRouteScreen — 단계 편집', () => {
  /**
   * **더한 단계는 맨 뒤에 선다.**
   *
   * 이 화면에서 **배열 위치가 곧 단계 번호**다(계약: 배열 순서가 `stepNo` 1..N이 된다).
   * 앞에 끼우면 방금 넣은 승인자가 **1단계**가 되는데, 표는 「순서 1」로 정직하게 그리고
   * 저장도 성공한다 — 사용자는 마지막에 넣은 사람이 맨 앞 결재자가 된 것을 **저장한 뒤에야**
   * 알고, 결재선에는 물리 삭제 경로가 없다. 그래서 **줄 수만 세지 않고 자리를 본다.**
   */
  it('승인자를 골라 단계를 더하면 맨 뒤에 한 줄이 는다', async () => {
    const { user } = renderScreen(allRoutes(), SELECTED);

    await stepPane();
    expect(stepRows()).toHaveLength(stepFixtures.length + 1);

    await addStep(user);

    expect(stepRows()).toHaveLength(stepFixtures.length + 2);
    expect(screen.getByText('합성 승인자4')).toBeInTheDocument();
    /* 머리글이 첫 줄이므로 마지막 줄이 곧 마지막 단계다. */
    expect(within(stepRows().at(-1) as HTMLElement).getByText('합성 승인자4')).toBeInTheDocument();
    /* 짝 방향 — 앞줄은 그대로다. 뒤에 붙였다는 것은 앞을 밀지 않았다는 뜻이기도 하다. */
    expect(
      within(stepRows()[1] as HTMLElement).getByText('합성 승인자1 · 합성부서 가'),
    ).toBeInTheDocument();
  });

  /** **그 행만** 지운다 — 옆줄이 함께 사라지면 사용자는 저장하기 전까지 알 수 없다. */
  it('단계를 지우면 그 줄만 사라진다', async () => {
    const { user } = renderScreen(allRoutes(), SELECTED);

    await stepPane();
    await user.click(screen.getByRole('button', { name: t.actions.removeStep(2) }));

    expect(screen.queryByText('합성 승인자2 · 합성부서 나')).not.toBeInTheDocument();
    expect(screen.getByText('합성 승인자1 · 합성부서 가')).toBeInTheDocument();
    expect(screen.getByText(t.values.approverUnknown)).toBeInTheDocument();
  });

  /**
   * **마지막 한 단계는 지울 수 없다.** 저장 잠금(단계 0)보다 한 걸음 앞선 방어다 —
   * 지운 뒤에 「저장할 수 없다」고 말하면 사용자는 이미 화면에서 그것을 잃은 뒤다.
   */
  it('단계가 하나뿐이면 삭제가 잠기고 사유가 그 버튼의 설명이 된다', async () => {
    renderScreen(allRoutes([stepsRoute(singleStepFixture)]), SELECTED);

    await stepPane();

    const button = screen.getByRole('button', { name: t.actions.removeStep(1) });

    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(t.actionReasons.stepRemoveLast);
  });

  it('순서 이동이 표에 보이는 차례를 바꾼다', async () => {
    const { user } = renderScreen(allRoutes(), SELECTED);

    await stepPane();
    await user.click(screen.getAllByRole('button', { name: '아래로 이동' })[0] as HTMLElement);

    const rows = stepRows();

    expect(
      within(rows[1] as HTMLElement).getByText('합성 승인자2 · 합성부서 나'),
    ).toBeInTheDocument();
    expect(
      within(rows[2] as HTMLElement).getByText('합성 승인자1 · 합성부서 가'),
    ).toBeInTheDocument();
  });

  /** 같은 사람이 다른 자격으로 두 번 결재하는 것은 정당할 수 있다 — 경고만 하고 막지 않는다. */
  it('이미 있는 승인자를 또 넣으면 경고가 서되 저장이 열린다', async () => {
    const { user } = renderScreen(allRoutes(), SELECTED);

    await stepPane();
    await addStep(user, '합성 승인자1 · sample.user1');

    expect(screen.getAllByText(t.notes.approverDuplicateWarning)).toHaveLength(2);
    expect(saveStepsButton()).toBeEnabled();
  });
});

describe('ApprovalRouteScreen — 단계 치환 저장', () => {
  /** **보내는 배열이 곧 최종 순서 전체다.** 표에 보이는 차례와 본문의 차례가 같아야 한다. */
  it('치환 본문이 표에 보이는 순서 그대로다', async () => {
    const { requests, user } = renderScreen(allRoutes([stepsReplaceRoute()]), SELECTED);

    await stepPane();
    await user.click(screen.getAllByRole('button', { name: '아래로 이동' })[0] as HTMLElement);
    await user.click(saveStepsButton());

    await waitFor(() => {
      expect(stepsReplaceRequests(requests)).toHaveLength(1);
    });

    expect(stepsReplaceRequests(requests)[0]?.body).toEqual({
      steps: [
        { approverTypeCode: 'USER', approverUserId: 9302 },
        { approverTypeCode: 'USER', approverUserId: 9301 },
        { approverTypeCode: 'USER', approverUserId: 9303 },
      ],
    });
  });

  /**
   * **순서 값과 1차 미사용 필드를 싣지 않고 구분은 상수다.** 목은 셋을 다 200으로 받는다 —
   * 막는 곳이 화면뿐이라 실제로 나간 본문을 본다.
   */
  it('치환 본문에 순서·역할·부서가 없고 구분이 늘 사용자다', async () => {
    const { requests, user } = renderScreen(allRoutes([stepsReplaceRoute()]), SELECTED);

    await stepPane();
    await addStep(user);
    await user.click(saveStepsButton());

    await waitFor(() => {
      expect(stepsReplaceRequests(requests)).toHaveLength(1);
    });

    const body = stepsReplaceRequests(requests)[0]?.body as { steps: Record<string, unknown>[] };

    expect(body.steps).toHaveLength(4);
    for (const step of body.steps) {
      expect(Object.keys(step).sort()).toEqual(['approverTypeCode', 'approverUserId']);
      expect(step.approverTypeCode).toBe('USER');
    }
    /*
     * **더한 승인자가 본문의 맨 뒤다.** 배열 위치가 곧 단계 번호이므로, 앞에 끼우면 방금 넣은
     * 사람이 1단계로 저장된다 — 표에서 자리를 보는 단언과 짝이다(그쪽은 보이는 것, 이쪽은 나가는 것).
     */
    expect(body.steps.at(-1)?.approverUserId).toBe(9304);
    expect(body.steps.map((step) => step.approverUserId)).toEqual([9301, 9302, 9303, 9304]);
  });

  /**
   * **잠금 토큰은 결재선 상세 경로에서 꺼낸다**(계약: `If-Match`는 결재선의 판 번호다).
   * 다른 화면의 하위 컬렉션 치환은 `If-Match`가 아예 없어 `null`이었다 — 그 형태를 그대로
   * 베끼면 여기서는 토큰 없이 나가 400이다.
   */
  it('치환 요청이 상세 경로에서 꺼낸 If-Match와 멱등 키를 싣는다', async () => {
    const versioned = createVersionedDetail();
    const { requests, user } = renderScreen(
      allRoutes([versioned.route, stepsReplaceRoute()]),
      SELECTED,
    );

    await stepPane();
    await addStep(user);
    await user.click(saveStepsButton());

    await waitFor(() => {
      expect(stepsReplaceRequests(requests)).toHaveLength(1);
    });

    const sent = stepsReplaceRequests(requests)[0];

    expect(sent?.headers.get('If-Match')).toBe('token-1');
    expect(sent?.headers.get('Idempotency-Key')).not.toBeNull();
  });

  /**
   * **치환 200에 `ETag`가 없다.** 서버가 그 저장으로 결재선의 판 번호를 올리는지 계약이
   * 밝히지 않으므로 성공 뒤 상세를 반드시 다시 부른다 — 빠뜨리면 두 번째 저장이 조용히 409다.
   */
  it('저장에 성공하면 상세를 다시 불러 두 번째 저장이 새 토큰을 싣는다', async () => {
    const versioned = createVersionedDetail();
    const { requests, user } = renderScreen(
      allRoutes([versioned.route, stepsReplaceRoute()]),
      SELECTED,
    );

    await stepPane();
    await addStep(user);
    await user.click(saveStepsButton());
    await screen.findByText(messages.common.saved);

    await addStep(user, '합성 승인자5 · sample.user5');
    await waitFor(() => {
      expect(saveStepsButton()).toBeEnabled();
    });
    await user.click(saveStepsButton());

    await waitFor(() => {
      expect(stepsReplaceRequests(requests)).toHaveLength(2);
    });

    const sent = stepsReplaceRequests(requests);

    expect(sent[0]?.headers.get('If-Match')).toBe('token-1');
    expect(sent[1]?.headers.get('If-Match')).not.toBe(sent[0]?.headers.get('If-Match'));
  });

  /** **서버 응답이 정본이다.** 보낸 값을 그대로 두면 서버가 조정한 결과를 놓친다. */
  it('저장에 성공하면 서버 응답으로 단계 초안을 다시 세운다', async () => {
    const saved = [
      { ...stepFixtures[0], approverName: '합성 승인자9', approverDepartmentName: '합성부서 다' },
    ];
    const { user } = renderScreen(allRoutes([stepsReplaceRoute(saved)]), SELECTED);

    await stepPane();
    await user.click(screen.getByRole('button', { name: t.actions.removeStep(3) }));
    await user.click(saveStepsButton());

    expect(await screen.findByText('합성 승인자9 · 합성부서 다')).toBeInTheDocument();
    /* 보낸 값(2줄)이 아니라 응답(1줄)이 남는다. */
    await waitFor(() => {
      expect(stepRows()).toHaveLength(2);
    });
  });

  /**
   * 빈 배열은 계약이 400으로 막고 화면도 막는다 — **둘은 목적이 다르므로 어느 하나를 등가로
   * 보고 지우지 않는다.** 여기서는 요청이 **아예 나가지 않는 것**을 잰다.
   */
  it('단계가 0이면 저장이 잠기고 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(
      allRoutes([stepsRoute([]), stepsReplaceRoute()]),
      SELECTED,
    );

    await stepPane();

    const button = saveStepsButton();

    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(t.actionReasons.stepSaveNoSteps);

    await user.click(button);

    expect(stepsReplaceRequests(requests)).toHaveLength(0);
  });

  /**
   * 계약이 승인자 번호를 필수로 두지 않아 목이 200으로 받는다 — **막는 곳이 화면뿐이다.**
   * 그런 행은 서버가 준 단계에서 실제로 온다.
   */
  it('승인자를 확인할 수 없는 행이 있으면 저장이 잠기고 요청이 나가지 않는다', async () => {
    const broken = [stepFixtures[0], { ...stepFixtures[1], approverUserId: undefined }];
    const { requests, user } = renderScreen(
      allRoutes([stepsRoute(broken), stepsReplaceRoute()]),
      SELECTED,
    );

    await stepPane();
    /* 고친 것이 있어야 「고친 내용이 없다」가 아니라 이 사유가 드러난다. */
    await user.click(screen.getAllByRole('button', { name: '아래로 이동' })[0] as HTMLElement);

    const button = saveStepsButton();

    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(t.actionReasons.stepSaveApproverMissing);

    await user.click(button);

    expect(stepsReplaceRequests(requests)).toHaveLength(0);
  });

  /**
   * **두 저장이 한 벌의 잠금 토큰을 나눠 쓴다.** 폼을 먼저 저장하면 단계 저장이 싣고 있던
   * 토큰이 낡아 그다음이 조용히 409다 — 순서를 강제하는 편이 그 실패를 설명하는 것보다 낫다.
   */
  it('결재선 폼이 더러우면 단계 저장이 잠기고 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes([stepsReplaceRoute()]), SELECTED);

    await stepPane();
    await user.click(screen.getAllByRole('button', { name: '아래로 이동' })[0] as HTMLElement);

    // 선행 단언 — 폼이 깨끗한 동안에는 저장이 열려 있어야 이 감지기가 뜻을 갖는다.
    expect(saveStepsButton()).toBeEnabled();

    await dirtyForm(user);

    const button = saveStepsButton();

    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(t.actionReasons.stepSaveFormDirty);

    await user.click(button);

    expect(stepsReplaceRequests(requests)).toHaveLength(0);
  });

  /**
   * **사용자 마스터는 결재선 쓰기의 무효화 범위 밖이다.** 결재선을 저장했다고 사람이 들고
   * 나지는 않는다 — 같은 뿌리 키에 두면 저장할 때마다 쓰지도 않을 조회가 하나씩 더 나간다.
   */
  it('단계를 저장해도 사용자 목록을 다시 부르지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes([stepsReplaceRoute()]), SELECTED);

    await stepPane();
    await waitFor(() => {
      expect(requests.filter((request) => request.url.pathname === USERS_PATH)).toHaveLength(1);
    });

    await user.click(screen.getAllByRole('button', { name: '아래로 이동' })[0] as HTMLElement);
    await user.click(saveStepsButton());
    await screen.findByText(messages.common.saved);

    /* 상세는 다시 온다 — 그것과 견주어야 「사용자 목록만 그대로다」가 뜻을 갖는다. */
    await waitFor(() => {
      expect(detailRequests(requests).length).toBeGreaterThan(1);
    });
    expect(requests.filter((request) => request.url.pathname === USERS_PATH)).toHaveLength(1);
  });

  /** **승인자가 사용 중지여도 막지 않는다** — 막으면 다른 단계를 고치는 것까지 불가능해진다. */
  it('사용 중지된 승인자가 있어도 저장할 수 있다', async () => {
    const { requests, user } = renderScreen(allRoutes([stepsReplaceRoute()]), SELECTED);

    await stepPane();

    // 선행 단언 — 경고가 실제로 서 있어야 「그래도 저장된다」가 뜻을 갖는다.
    expect(screen.getByText(t.notes.approverInactiveWarning)).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: '아래로 이동' })[0] as HTMLElement);
    await user.click(saveStepsButton());

    await waitFor(() => {
      expect(stepsReplaceRequests(requests)).toHaveLength(1);
    });
  });

  it('저장에 실패하면 사유가 구획 안에 서고 초안이 남는다', async () => {
    const { user } = renderScreen(
      allRoutes([failingStepsReplaceRoute(409, { conflictCause: 'user', message: '' })]),
      SELECTED,
    );

    await stepPane();
    await user.click(screen.getByRole('button', { name: t.actions.removeStep(3) }));
    await user.click(saveStepsButton());

    expect(await screen.findByText(messages.conflict.user)).toBeInTheDocument();
    /* 지운 줄이 되돌아오지 않는다 — 실패는 초안을 버릴 이유가 아니다. */
    expect(stepRows()).toHaveLength(3);
  });
});

describe('ApprovalRouteScreen — 단계 초안 수명', () => {
  /**
   * **응답 도착이 초안을 되돌리면 「고치던 순서가 사라진다」가 재현된다.** 초안은 응답 객체가
   * 아니라 대상 키에 매여 있다.
   */
  it('다시 조회로 단계가 다시 와도 고친 순서가 남는다', async () => {
    const { requests, user } = renderScreen(allRoutes(), SELECTED);

    await stepPane();
    await user.click(screen.getAllByRole('button', { name: '아래로 이동' })[0] as HTMLElement);

    const before = stepsRequests(requests).length;

    await user.click(screen.getByRole('button', { name: t.actions.reload }));
    await waitFor(() => {
      expect(stepsRequests(requests).length).toBeGreaterThan(before);
    });

    expect(
      within(stepRows()[1] as HTMLElement).getByText('합성 승인자2 · 합성부서 나'),
    ).toBeInTheDocument();
  });

  /**
   * **서버가 다른 내용을 준 재조회에도 되돌아가지 않는다.**
   *
   * 앞 감지기는 **같은 내용**의 재조회까지만 문다 — 캐시가 구조 공유로 객체 동일성을 지켜
   * 주기 때문에, 응답을 의존성 삼아 초안을 다시 세우는 형태(현실에서 가장 흔한 오류)가
   * 그 잣대를 그대로 지나간다. **내용이 실제로 달라진 재조회**로 재야 그 형태가 붙잡힌다.
   */
  it('서버가 다른 단계를 준 재조회도 고치던 순서를 덮지 않는다', async () => {
    let stepHits = 0;
    const changingSteps: StubRoute = {
      match: (request) => request.method === 'GET' && isStepsPath(new URL(request.url).pathname),
      respond: () => {
        stepHits += 1;

        /* 두 번째부터는 **한 줄만** 준다 — 초안을 덮으면 표가 1줄로 줄어 곧바로 드러난다. */
        return jsonResponse({ items: stepHits === 1 ? stepFixtures : [stepFixtures[0]] });
      },
    };
    let detailHits = 0;
    const changingDetail: StubRoute = {
      match: (request) => request.method === 'GET' && isDetailPath(new URL(request.url).pathname),
      respond: () => {
        detailHits += 1;

        return jsonResponse(
          { ...routeFixtures[0], inProgressCount: detailHits },
          { headers: { ETag: `token-${String(detailHits)}` } },
        );
      },
    };

    const { user } = renderScreen(allRoutes([changingSteps, changingDetail]), SELECTED);

    await stepPane();
    await user.click(screen.getAllByRole('button', { name: '아래로 이동' })[0] as HTMLElement);

    await user.click(screen.getByRole('button', { name: t.actions.reload }));

    /* 선행 단언 — 다시 조회가 실제로 끝났고 서버가 **다른 자료**를 줬다. */
    await waitFor(() => {
      expect(screen.getByText(t.notes.inProgressSome(detailHits))).toBeInTheDocument();
    });
    expect(stepHits).toBeGreaterThan(1);

    /* 그런데도 고치던 순서가 그대로다 — 초안은 응답이 아니라 대상 키에 매여 있다. */
    expect(stepRows()).toHaveLength(stepFixtures.length + 1);
    expect(
      within(stepRows()[1] as HTMLElement).getByText('합성 승인자2 · 합성부서 나'),
    ).toBeInTheDocument();
  });

  /** 폼과 단계는 **다른 오퍼레이션**이다 — 한쪽을 고치는 중에 다른 쪽이 되돌아가면 안 된다. */
  it('폼을 고쳐도 단계 초안이 그대로다', async () => {
    const { user } = renderScreen(allRoutes(), SELECTED);

    await stepPane();
    await user.click(screen.getByRole('button', { name: t.actions.removeStep(3) }));
    await dirtyForm(user);

    expect(stepRows()).toHaveLength(3);
  });

  it('대상이 바뀌면 단계 초안이 서버 값으로 다시 선다', async () => {
    const { user } = renderScreen(allRoutes([detailRouteById()]), SELECTED, '?ar=9003');

    await stepPane();
    await user.click(screen.getByRole('button', { name: t.actions.removeStep(3) }));
    expect(stepRows()).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitFor(() => {
      expect(locationText()).toContain('ar=9003');
    });

    await waitFor(() => {
      expect(stepRows()).toHaveLength(stepFixtures.length + 1);
    });
  });

  /**
   * 추가 줄에서 고른 승인자는 그 구획 안에만 있는 값이라 수명 표에 열이 없다 —
   * 대신 **대상이 바뀌면 구획째 다시 선다.** 앞 결재선에 넣으려던 사람이 다음 결재선의
   * 추가 줄에 남아 있으면, 사용자는 그것을 자기가 고른 것으로 읽는다.
   */
  it('대상이 바뀌면 추가 줄에서 고르던 승인자가 사라진다', async () => {
    const { user } = renderScreen(allRoutes([detailRouteById()]), SELECTED, '?ar=9003');

    /*
     * **먼저 두 대상을 모두 받아 둔다.** 새 대상의 상세가 아직 없으면 구획이 자리 표시로
     * 바뀌었다가 다시 서면서 추가 줄이 저절로 비는데, 그러면 이 감지기가 재는 것이
     * 「대상에 매인 구획」이 아니라 「조회가 늦다」는 사정이 된다.
     */
    await stepPane();
    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitFor(() => {
      expect(locationText()).toContain('ar=9003');
    });
    await user.click(screen.getByRole('button', { name: '뒤로' }));
    await waitFor(() => {
      expect(locationText()).toContain('ar=9001');
    });

    const pane = await stepPane();

    await user.click(within(pane).getByRole('combobox', { name: t.fields.approver }));
    await user.click(screen.getByRole('option', { name: APPROVER_OPTION_LABEL }));

    // 선행 단언 — 실제로 골라져 있어야 「사라졌다」가 뜻을 갖는다.
    expect(within(pane).getByRole('combobox', { name: t.fields.approver })).toHaveTextContent(
      APPROVER_OPTION_LABEL,
    );

    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitFor(() => {
      expect(locationText()).toContain('ar=9003');
    });

    expect(
      within(screen.getByRole('region', { name: t.panes.steps })).getByRole('combobox', {
        name: t.fields.approver,
      }),
    ).not.toHaveTextContent(APPROVER_OPTION_LABEL);
  });

  /** 창이 묻는 것은 「이 결재선을 고치던 것」 전체다 — 폼만 되돌리면 단계 순서가 남는다. */
  it('파기가 두 초안을 함께 되돌린다', async () => {
    const { user } = renderScreen(allRoutes(), SELECTED);

    await stepPane();
    await user.click(screen.getByRole('button', { name: t.actions.removeStep(3) }));
    await dirtyForm(user);
    await user.click(screen.getByRole('button', { name: messages.common.cancel }));
    await user.click(screen.getByRole('button', { name: t.actions.discardDraft }));

    await waitFor(() => {
      expect(stepRows()).toHaveLength(stepFixtures.length + 1);
    });
    expect(screen.getByLabelText(t.fields.minValue)).toHaveValue('100');
  });
});

/**
 * **넷째 배너의 매임.** 「배너·결과는 자기 대상보다 오래 살지 않는다」는 이 저장소가 반복
 * 결함으로 못 박은 부류이고 폼 배너에는 짝이 셋 서 있는데, 이 회차가 만든 단계 배너에는
 * 하나도 없었다 — 계획 §11.3의 뮤테이션 목록에도, 실행 담당의 훑기에도 빠졌던 자리다.
 *
 * **양방향으로 잰다.** 한 방향만 재면 「아예 안 지운다」와 「아무 때나 지운다」 중 하나가
 * 반드시 통과한다.
 */
describe('ApprovalRouteScreen — 단계 배너의 매임', () => {
  const CONFLICT = { conflictCause: 'user', message: '' };

  const failStepsSave = async (
    search = SELECTED,
    navigateTo = '',
  ): Promise<{ user: ReturnType<typeof userEvent.setup> }> => {
    const { user } = renderScreen(
      allRoutes([detailRouteById(), failingStepsReplaceRoute(409, CONFLICT)]),
      search,
      navigateTo,
    );

    await stepPane();
    await user.click(screen.getAllByRole('button', { name: '아래로 이동' })[0] as HTMLElement);
    await user.click(saveStepsButton());
    await screen.findByText(messages.conflict.user);

    return { user };
  };

  /**
   * **안 지움 쪽.** 대상이 바뀌는 동안은 「내 것이 아니다」가 배너를 감추지만, 그것만으로는
   * 훅에 남은 실패가 사라지지 않는다 — **돌아오면 다시 선다.** 그러면 결재선 B를 들렀다 온
   * 사용자에게 손대지도 않은 거절 사유가 서 있게 된다.
   */
  it('단계 실패 배너가 대상을 떠났다 돌아와도 살아 있지 않다', async () => {
    const { user } = await failStepsSave(SELECTED, '?ar=9003');

    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitFor(() => {
      expect(locationText()).toContain('ar=9003');
    });

    // 선행 단언 — 떠난 자리에서는 감춰져 있어야 「돌아와도 없다」가 뜻을 갖는다.
    expect(screen.queryByText(messages.conflict.user)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '뒤로' }));
    await waitFor(() => {
      expect(locationText()).toContain('ar=9001');
    });
    await stepPane();

    expect(screen.queryByText(messages.conflict.user)).not.toBeInTheDocument();
  });

  /**
   * **너무 지움 쪽.** 단계를 더 고치는 동안 사유가 사라지면 사용자는 무엇 때문에 거절당했는지
   * 잃는다 — 그 사유를 읽으면서 고치는 것이 이 배너가 서 있는 이유다.
   */
  it('단계 실패 배너가 단계를 더 고쳐도 남는다', async () => {
    const { user } = await failStepsSave();

    await user.click(screen.getAllByRole('button', { name: '아래로 이동' })[1] as HTMLElement);
    expect(screen.getByText(messages.conflict.user)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.removeStep(1) }));
    expect(screen.getByText(messages.conflict.user)).toBeInTheDocument();

    await addStep(user);
    expect(screen.getByText(messages.conflict.user)).toBeInTheDocument();
  });
});

describe('ApprovalRouteScreen — 단계 저장이 나가는 중', () => {
  const holdStepsReplace = (request: Request): boolean =>
    request.method === 'PUT' && isStepsPath(new URL(request.url).pathname);

  /** 넷째 쓰기도 공동 잠금에 든다 — 동시에 나가면 뒤엣것이 반드시 409다. */
  it('단계 저장 중에는 결재선 폼의 저장도 잠긴다', async () => {
    const { requests, release, user } = renderScreen(
      allRoutes([stepsReplaceRoute()]),
      SELECTED,
      '',
      holdStepsReplace,
    );

    await stepPane();
    await user.click(screen.getAllByRole('button', { name: '아래로 이동' })[0] as HTMLElement);
    await user.click(saveStepsButton());
    await waitFor(() => {
      expect(stepsReplaceRequests(requests)).toHaveLength(1);
    });

    expect(screen.getByRole('button', { name: t.actions.create })).toBeDisabled();
    expect(screen.getByLabelText(t.fields.minValue)).toBeDisabled();

    release();
    await screen.findByText(messages.common.saved);
  });

  /**
   * **네 쓰기의 잣대를 대칭으로 둔다.** 앞 세 쓰기에는 「연타해도 요청이 1회」가 서 있는데
   * 넷째에만 없으면, 잠금이 이 쓰기에서만 풀려도 아무도 모른다.
   */
  it('연타해도 치환 요청이 1회이고 단계 구획이 잠긴다', async () => {
    const { requests, release, user } = renderScreen(
      allRoutes([stepsReplaceRoute()]),
      SELECTED,
      '',
      holdStepsReplace,
    );

    await stepPane();
    await user.click(screen.getAllByRole('button', { name: '아래로 이동' })[0] as HTMLElement);
    await user.click(saveStepsButton());
    await waitFor(() => {
      expect(stepsReplaceRequests(requests)).toHaveLength(1);
    });

    /* 첫째 겹 — 이 구획에서 눈에 보이는 것들이 닫혔다. */
    expect(saveStepsButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.removeStep(1) })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: t.fields.approver })).toBeDisabled();

    await user.click(saveStepsButton());

    expect(stepsReplaceRequests(requests)).toHaveLength(1);

    release();
    await screen.findByText(messages.common.saved);
  });

  /**
   * **끊는 것과 감추는 것은 다르다.** 대상이 바뀌어도 나가는 중인 요청은 끊지 않는다 —
   * 끊으면 무효화·성공·공동 잠금이 함께 사라져 서버에는 갔는데 화면만 없던 일로 친다.
   */
  it('나가는 중에 대상이 바뀌어도 잠금·무효화·성공 알림이 살아 있다', async () => {
    const { requests, release, user } = renderScreen(
      allRoutes([detailRouteById(), stepsReplaceRoute()]),
      SELECTED,
      '?ar=9003',
      holdStepsReplace,
    );

    await stepPane();
    await user.click(screen.getAllByRole('button', { name: '아래로 이동' })[0] as HTMLElement);
    await user.click(saveStepsButton());
    await waitFor(() => {
      expect(stepsReplaceRequests(requests)).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitFor(() => {
      expect(locationText()).toContain('ar=9003');
    });

    /* ① 공동 잠금이 살아 있다 — 요청은 아직 날아가는 중이다. */
    expect(screen.getByRole('button', { name: t.actions.create })).toBeDisabled();

    const beforeDetail = detailRequests(requests).length;

    release();

    /* ② 성공이 사라지지 않는다. */
    expect(await screen.findByText(messages.common.saved)).toBeInTheDocument();
    /* ③ 무효화가 살아 있다 — 이것이 없으면 다음 저장이 낡은 토큰으로 나간다. */
    await waitFor(() => {
      expect(detailRequests(requests).length).toBeGreaterThan(beforeDetail);
    });
  });

  /** **남의 순서를 새 대상의 표에 찍지 않는다** — 되먹임은 그 요청이 겨눈 대상에 맨다. */
  it('단계 저장 결과가 새 대상의 표를 덮지 않는다', async () => {
    const saved = [
      { ...stepFixtures[0], approverName: '합성 승인자9', approverDepartmentName: '합성부서 다' },
    ];
    const { requests, release, user } = renderScreen(
      allRoutes([detailRouteById(), stepsReplaceRoute(saved)]),
      SELECTED,
      '?ar=9003',
      holdStepsReplace,
    );

    await stepPane();
    await user.click(screen.getAllByRole('button', { name: '아래로 이동' })[0] as HTMLElement);
    await user.click(saveStepsButton());
    await waitFor(() => {
      expect(stepsReplaceRequests(requests)).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitFor(() => {
      expect(locationText()).toContain('ar=9003');
    });

    release();
    await screen.findByText(messages.common.saved);

    expect(screen.queryByText('합성 승인자9 · 합성부서 다')).not.toBeInTheDocument();
  });
});
