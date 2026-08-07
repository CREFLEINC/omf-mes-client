import type { components } from '@omf-mes/api-client';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigate } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import {
  appUserFixtures,
  businessUnitFixtures,
  departmentFixtures,
  filledUserFixture,
  plantFixtures,
  roleFixtures,
  userDataScopeFixtures,
  userRoleFixtures,
} from './fixtures';
import { UsersRolesScreen } from './screen';
import type { AppUser } from './types';

type Editability = components['schemas']['Editability'];

const ROUTE = '/system/users-roles';

const USERS_PATH = '/app/users';
const ROLES_PATH = '/app/roles';
const DEPARTMENTS_PATH = '/mdm/departments';

const BUSINESS_UNITS_PATH = '/mdm/business-units';
const PLANTS_PATH = '/mdm/plants';

const userRolesPath = (appUserId: number): string => `${USERS_PATH}/${String(appUserId)}/roles`;

const dataScopesPath = (appUserId: number): string =>
  `${USERS_PATH}/${String(appUserId)}/data-scopes`;

interface RecordedRequest {
  method: string;
  url: URL;
  headers: Headers;
  body: string;
}

/** 요청을 기록하면서 스텁 규칙으로 응답한다. 규칙에 없는 요청은 하네스가 던져 스텁 누락을 드러낸다. */
const createRecordingFetch = (
  routes: StubRoute[],
): { fetch: StubFetch; requests: RecordedRequest[] } => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch(routes);

  const fetch: StubFetch = async (request) => {
    requests.push({
      method: request.method,
      url: new URL(request.url),
      headers: new Headers(request.headers),
      body: request.method === 'GET' ? '' : await request.clone().text(),
    });

    return stub(request);
  };

  return { fetch, requests };
};

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

interface PageStub {
  page: number;
  size: number;
  total: number;
}

const DEFAULT_PAGE: PageStub = { page: 1, size: 50, total: appUserFixtures.length };

const userListRoute = (items = appUserFixtures, pageMeta: PageStub = DEFAULT_PAGE): StubRoute => ({
  match: (request) => isGet(request, USERS_PATH),
  respond: () => jsonResponse({ items, page: pageMeta }),
});

const userListErrorRoute = (status: number, body: unknown = { errors: [] }): StubRoute => ({
  match: (request) => isGet(request, USERS_PATH),
  respond: () => jsonResponse(body, { status }),
});

const departmentsRoute = (
  items = departmentFixtures,
  pageMeta: PageStub = { page: 1, size: 50, total: departmentFixtures.length },
): StubRoute => ({
  match: (request) => isGet(request, DEPARTMENTS_PATH),
  respond: () => jsonResponse({ items, page: pageMeta }),
});

/** 역할 선택 목록 — `includeInactive=true`로 받으므로 미사용 역할도 함께 온다. */
const roleLookupRoute = (
  items = roleFixtures,
  pageMeta: PageStub = { page: 1, size: 50, total: roleFixtures.length },
): StubRoute => ({
  match: (request) => isGet(request, ROLES_PATH),
  respond: () => jsonResponse({ items, page: pageMeta }),
});

/** 이 사용자에게 부여된 역할. **쪽 나눔이 없다** — 계약이 `items`만 준다. */
const userRolesRoute = (appUserId = 1001, items = userRoleFixtures): StubRoute => ({
  match: (request) => isGet(request, userRolesPath(appUserId)),
  respond: () => jsonResponse({ items }),
});

const roleAssignRoute = (
  appUserId = 1001,
  respond: (request: Request) => Response = () => jsonResponse({ items: userRoleFixtures }),
): StubRoute => ({
  match: (request) =>
    request.method === 'PUT' && new URL(request.url).pathname === userRolesPath(appUserId),
  respond,
});

const businessUnitsRoute = (
  items = businessUnitFixtures,
  pageMeta: PageStub = { page: 1, size: 50, total: businessUnitFixtures.length },
): StubRoute => ({
  match: (request) => isGet(request, BUSINESS_UNITS_PATH),
  respond: () => jsonResponse({ items, page: pageMeta }),
});

const plantsRoute = (
  items = plantFixtures,
  pageMeta: PageStub = { page: 1, size: 50, total: plantFixtures.length },
): StubRoute => ({
  match: (request) => isGet(request, PLANTS_PATH),
  respond: () => jsonResponse({ items, page: pageMeta }),
});

/** 이 사용자에게 지정된 접근범위. 부여분과 같이 **쪽 나눔이 없다.** */
const userDataScopesRoute = (appUserId = 1001, items = userDataScopeFixtures): StubRoute => ({
  match: (request) => isGet(request, dataScopesPath(appUserId)),
  respond: () => jsonResponse({ items }),
});

const dataScopeReplaceRoute = (
  appUserId = 1001,
  respond: (request: Request) => Response = () => jsonResponse({ items: userDataScopeFixtures }),
): StubRoute => ({
  match: (request) =>
    request.method === 'PUT' && new URL(request.url).pathname === dataScopesPath(appUserId),
  respond,
});

/** 고른 사용자가 있으면 언제나 함께 도는 조회들. 부서 선택 목록과 같은 자리다. */
const roleRoutes = (appUserId = 1001): StubRoute[] => [
  roleLookupRoute(),
  userRolesRoute(appUserId),
  businessUnitsRoute(),
  plantsRoute(),
  userDataScopesRoute(appUserId),
];

const EDITABLE: Editability = { codeEditable: true, reason: 'EDITABLE', referenceCount: 0 };

/** 사용자 상세 — `ETag`가 함께 온다(계약 실측). 저장의 `If-Match`가 이 값에서 나온다. */
const userDetailRoute = (
  appUser: AppUser = filledUserFixture,
  { etag = 'W/"7"', editability = EDITABLE }: { etag?: string | null; editability?: Editability } = {},
): StubRoute => ({
  match: (request) => isGet(request, `${USERS_PATH}/${String(appUser.appUserId)}`),
  respond: () =>
    jsonResponse({ appUser, editability }, etag === null ? {} : { headers: { ETag: etag } }),
});

const userUpdateRoute = (
  appUserId = 1001,
  respond: (request: Request) => Response = () => jsonResponse(filledUserFixture),
): StubRoute => ({
  match: (request) =>
    request.method === 'PUT' && new URL(request.url).pathname === `${USERS_PATH}/${String(appUserId)}`,
  respond,
});

const userCreateRoute = (
  respond: (request: Request) => Response = () =>
    jsonResponse({ ...filledUserFixture, appUserId: 1009 }, { status: 201 }),
): StubRoute => ({
  match: (request) => request.method === 'POST' && new URL(request.url).pathname === USERS_PATH,
  respond,
});

const userDeactivateRoute = (
  appUserId = 1001,
  respond: (request: Request) => Response = () => jsonResponse(filledUserFixture),
): StubRoute => ({
  match: (request) =>
    request.method === 'POST' &&
    new URL(request.url).pathname === `${USERS_PATH}/${String(appUserId)}:deactivate`,
  respond,
});

/** UUID 형식인지. 고정 문자열 멱등 키를 쓰면 서버가 400으로 되돌린다(계약 실측). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 주소를 읽고 **직접 바꿔 보기 위한** 탐침. 하네스가 `MemoryRouter`라
 * 트리 안에서 읽고 옮기는 수밖에 없다.
 *
 * 주소를 직접 옮기는 경로는 뒤로가기·주소 손 편집·공유 링크가 밟는 길이며,
 * 클릭 핸들러가 하는 정리를 하나도 거치지 않는다 — 그래서 따로 밟아 봐야 한다.
 */
let probeSearch = '';
let probeNavigate: ((to: string) => void) | null = null;

const RouterProbe = () => {
  probeSearch = useLocation().search;
  probeNavigate = useNavigate();

  return null;
};

const renderScreen = (routes: StubRoute[], search = '') => {
  const { fetch, requests } = createRecordingFetch(routes);

  probeSearch = '';
  probeNavigate = null;

  renderWithProviders(
    <>
      <UsersRolesScreen />
      <RouterProbe />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  const goTo = (to: string) => {
    act(() => {
      probeNavigate?.(to);
    });
  };

  return { requests, search: () => probeSearch, goTo, user: userEvent.setup() };
};

const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

const userRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requestsTo(requests, USERS_PATH);

const userListPane = (): HTMLElement => screen.getByRole('region', { name: '사용자' });

const waitForUserList = async (requests: RecordedRequest[]): Promise<void> => {
  await waitFor(() => {
    expect(userRequests(requests).length).toBeGreaterThan(0);
  });
  // 우 칸에도 표가 있다(접근범위) — 기다리는 대상을 좌 페인으로 좁힌다.
  await within(userListPane()).findByRole('table');
};

describe('UsersRolesScreen 진입과 조회', () => {
  it('화면에 들어오면 조건 없이 목록을 조회한다', async () => {
    const { requests } = renderScreen([userListRoute(), departmentsRoute()]);

    await waitForUserList(requests);

    const list = userRequests(requests);

    expect(list).toHaveLength(1);
    expect(list[0]?.method).toBe('GET');
  });

  /** 빈 조건을 실어 보내면 「보내지 않음」과 「빈 값을 보냄」 두 상태가 생겨 캐시 키가 갈린다. */
  it('빈 조건·꺼진 확인칸·첫 쪽은 요청에 실리지 않는다', async () => {
    const { requests } = renderScreen([userListRoute(), departmentsRoute()]);

    await waitForUserList(requests);

    const params = userRequests(requests)[0]?.url.searchParams;

    for (const key of ['q', 'departmentId', 'includeInactive', 'page']) {
      expect(params?.has(key)).toBe(false);
    }
  });

  it('머리와 탐색경로가 보인다', async () => {
    const { requests } = renderScreen([userListRoute(), departmentsRoute()]);

    await waitForUserList(requests);

    expect(screen.getByRole('heading', { name: '사용자·역할·권한' })).toBeInTheDocument();
    expect(screen.getByText('시스템 관리')).toBeInTheDocument();
  });
});

describe('UsersRolesScreen 탭', () => {
  /** 자리만 먼저 두면 「탭은 있는데 눌러도 빈 화면인」 상태가 된다. */
  it('만든 탭 하나만 렌더된다', async () => {
    const { requests } = renderScreen([userListRoute(), departmentsRoute()]);

    await waitForUserList(requests);

    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(screen.getByRole('tab', { name: '사용자' })).toBeInTheDocument();
  });

  it('주소에 모르는 탭 값이 와도 첫 탭이 열린다', async () => {
    const { requests } = renderScreen([userListRoute(), departmentsRoute()], '?tab=roles');

    await waitForUserList(requests);

    expect(screen.getByRole('tab', { name: '사용자' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('UsersRolesScreen 조건과 주소', () => {
  it('검색어·부서·미사용 포함이 요청 쿼리에 실리고 주소에도 남는다', async () => {
    const { requests, search, user } = renderScreen([userListRoute(), departmentsRoute()]);

    await waitForUserList(requests);

    await user.type(within(userListPane()).getByLabelText('사용자 검색'), 'syn');
    // 디자인 시스템 `Select`는 네이티브 `<select>`가 아니라 트리거를 누른 뒤 선택지를 누른다.
    await user.click(within(userListPane()).getByLabelText('부서'));
    await user.click(await screen.findByRole('option', { name: /SYN-DEPT-01/ }));
    await user.click(within(userListPane()).getByRole('button', { name: '조회' }));

    await waitFor(() => {
      expect(userRequests(requests).length).toBeGreaterThan(1);
    });

    const params = userRequests(requests).at(-1)?.url.searchParams;

    expect(params?.get('q')).toBe('syn');
    expect(params?.get('departmentId')).toBe('3001');

    expect(new URLSearchParams(search()).get('q')).toBe('syn');
    expect(new URLSearchParams(search()).get('dept')).toBe('3001');
  });

  it('주소로 직접 들어와도 그 조건으로 조회된다 — 새로고침·공유가 같은 결과를 낸다', async () => {
    const { requests } = renderScreen(
      [userListRoute(), departmentsRoute()],
      '?q=syn&dept=3001&inactive=1&page=2',
    );

    await waitForUserList(requests);

    const params = userRequests(requests)[0]?.url.searchParams;

    expect(params?.get('q')).toBe('syn');
    expect(params?.get('departmentId')).toBe('3001');
    expect(params?.get('includeInactive')).toBe('true');
    expect(params?.get('page')).toBe('2');
  });

  /**
   * 주소는 손으로 고쳐지는 자리다. 거르지 않으면 `?dept=abc`가
   * **`departmentId=NaN`을 서버로 보낸다.**
   */
  it('부서 번호가 이상한 주소는 조건에서 빠지고 요청에도 실리지 않는다', async () => {
    const { requests } = renderScreen([userListRoute(), departmentsRoute()], '?dept=abc');

    await waitForUserList(requests);

    const url = userRequests(requests)[0]?.url;

    expect(url?.searchParams.has('departmentId')).toBe(false);
    expect(url?.href).not.toContain('NaN');
  });

  /** 값 목록이 확정되지 않아 고를 값이 없다 — 자리표시 값을 보내면 언제나 0건이 온다. */
  it('상태 조건은 비활성이고 어떤 요청 쿼리에도 나타나지 않는다', async () => {
    const { requests, user } = renderScreen(
      [userListRoute(), departmentsRoute()],
      '?q=syn&dept=3001&inactive=1&page=2',
    );

    await waitForUserList(requests);

    expect(within(userListPane()).getByLabelText('상태')).toBeDisabled();
    expect(screen.getByText(/상태 조건은 상태 코드 목록이 확정되지 않아/)).toBeInTheDocument();

    await user.click(within(userListPane()).getByRole('button', { name: '조회' }));

    await waitFor(() => {
      expect(userRequests(requests).length).toBeGreaterThan(0);
    });

    for (const request of requests) {
      expect(request.url.searchParams.has('statusCode')).toBe(false);
      expect(request.url.href).not.toContain('선택지 준비 중');
      expect(request.url.href).not.toContain(encodeURIComponent('선택지 준비 중'));
    }
  });

  /** 보이는 행이 달라지는데 선택이 남으면 우 칸의 폼이 어디서 온 것인지 알 수 없다. */
  it('조건이 바뀌면 쪽과 선택이 주소에서 사라진다', async () => {
    const { requests, search, user } = renderScreen(
      [userListRoute(), departmentsRoute(), ...roleRoutes()],
      '?page=3&usr=1001',
    );

    await waitForUserList(requests);

    await user.click(within(userListPane()).getByRole('checkbox', { name: '미사용 포함' }));

    await waitFor(() => {
      expect(new URLSearchParams(search()).get('inactive')).toBe('1');
    });

    const params = new URLSearchParams(search());

    expect(params.has('page')).toBe(false);
    expect(params.has('usr')).toBe(false);
    expect(params.has('new')).toBe(false);
  });

  it('등록 폼을 열면 고른 사용자가 주소에서 빠진다 — 둘은 함께 성립하지 않는다', async () => {
    const { requests, search, user } = renderScreen(
      [userListRoute(), departmentsRoute(), ...roleRoutes()],
      '?usr=1001',
    );

    await waitForUserList(requests);

    await user.click(within(userListPane()).getByRole('button', { name: '사용자 추가' }));

    await waitFor(() => {
      expect(new URLSearchParams(search()).get('new')).toBe('user');
    });
    expect(new URLSearchParams(search()).has('usr')).toBe(false);
  });

  it('사용자를 고르면 등록 폼이 주소에서 빠진다', async () => {
    const { requests, search, user } = renderScreen(
      [userListRoute(), departmentsRoute(), ...roleRoutes()],
      '?new=user',
    );

    await waitForUserList(requests);

    await user.click(within(userListPane()).getByRole('button', { name: 'SYN-LOGIN-01' }));

    await waitFor(() => {
      expect(new URLSearchParams(search()).get('usr')).toBe('1001');
    });
    expect(new URLSearchParams(search()).has('new')).toBe(false);
  });
});

describe('UsersRolesScreen 쪽 이동', () => {
  it('마지막 쪽에서는 다음이 비활성이다', async () => {
    const { requests } = renderScreen(
      [userListRoute(appUserFixtures, { page: 2, size: 3, total: 6 }), departmentsRoute()],
      '?page=2',
    );

    await waitForUserList(requests);

    expect(within(userListPane()).getByRole('button', { name: '다음' })).toBeDisabled();
    expect(within(userListPane()).getByRole('button', { name: '이전' })).toBeEnabled();
  });

  it('결과가 0건이면 앞뒤 이동이 모두 막힌다', async () => {
    const { requests } = renderScreen([
      userListRoute([], { page: 1, size: 50, total: 0 }),
      departmentsRoute(),
    ]);

    await waitForUserList(requests);

    expect(within(userListPane()).getByRole('button', { name: '다음' })).toBeDisabled();
    expect(within(userListPane()).getByRole('button', { name: '이전' })).toBeDisabled();
  });

  it('쪽을 옮기면 주소와 요청에 그 쪽이 실린다', async () => {
    const { requests, search, user } = renderScreen([
      userListRoute(appUserFixtures, { page: 1, size: 3, total: 9 }),
      departmentsRoute(),
    ]);

    await waitForUserList(requests);

    await user.click(within(userListPane()).getByRole('button', { name: '다음' }));

    await waitFor(() => {
      expect(new URLSearchParams(search()).get('page')).toBe('2');
    });
    await waitFor(() => {
      expect(userRequests(requests).at(-1)?.url.searchParams.get('page')).toBe('2');
    });
  });

  /** 결과는 있는데 이 쪽에 없다 — 「등록된 것이 없다」로 내면 거짓말이 된다. */
  it('범위 밖 쪽에는 다른 안내가 나온다', async () => {
    const { requests } = renderScreen(
      [userListRoute([], { page: 9, size: 3, total: 6 }), departmentsRoute()],
      '?page=9',
    );

    await waitForUserList(requests);

    expect(screen.getByText('이 쪽에는 결과가 없습니다')).toBeInTheDocument();
    expect(screen.queryByText('등록된 사용자가 없습니다')).not.toBeInTheDocument();
  });
});

describe('UsersRolesScreen 목록 표시', () => {
  it('응답 건수만큼 행이 그려지고 값이 없는 칸은 대시다', async () => {
    const { requests } = renderScreen([userListRoute(), departmentsRoute()]);

    await waitForUserList(requests);

    const table = within(userListPane()).getByRole('table');

    expect(within(table).getAllByRole('row')).toHaveLength(appUserFixtures.length + 1);
    expect(within(table).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('부서 번호가 아니라 이름이 보인다', async () => {
    const { requests } = renderScreen([userListRoute(), departmentsRoute()]);

    await waitForUserList(requests);

    const table = within(userListPane()).getByRole('table');

    await waitFor(() => {
      expect(within(table).getByText('SYN-DEPT-01 · 합성 부서 A')).toBeInTheDocument();
    });
    expect(within(table).queryByText('3001')).not.toBeInTheDocument();
  });

  it('0건이면 빈 상태가 나온다', async () => {
    const { requests } = renderScreen([
      userListRoute([], { page: 1, size: 50, total: 0 }),
      departmentsRoute(),
    ]);

    await waitForUserList(requests);

    expect(screen.getByText('등록된 사용자가 없습니다')).toBeInTheDocument();
  });

  it('선택 목록이 잘리면 안내가 나온다 — 고를 수 없는 값이 있다는 뜻이다', async () => {
    const { requests } = renderScreen([
      userListRoute(),
      departmentsRoute(departmentFixtures, { page: 1, size: 1, total: 99 }),
    ]);

    await waitForUserList(requests);

    expect(await screen.findByText(/선택 목록이 일부만 표시됩니다/)).toBeInTheDocument();
  });

  it('선택 목록 조회가 실패해도 목록은 그대로 보이고 사실을 알린다', async () => {
    const { requests } = renderScreen([
      userListRoute(),
      { match: (request) => isGet(request, DEPARTMENTS_PATH), respond: () => jsonResponse({}, { status: 500 }) },
    ]);

    await waitForUserList(requests);

    expect(await screen.findByText(/선택 목록을 불러오지 못했습니다/)).toBeInTheDocument();
    expect(within(userListPane()).getByRole('table')).toBeInTheDocument();
  });
});

describe('UsersRolesScreen 조회 실패', () => {
  /** 조회 실패는 표·빈 상태 대신 배너가 서는 자리다 — 「없습니다」로 내면 사실과 다른 안내가 된다. */
  it('조회에 실패하면 배너가 서고 표도 빈 상태도 나오지 않는다', async () => {
    const { requests } = renderScreen([userListErrorRoute(500), departmentsRoute()]);

    await waitFor(() => {
      expect(userRequests(requests)).toHaveLength(1);
    });

    expect(await screen.findByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('등록된 사용자가 없습니다')).not.toBeInTheDocument();
    expect(screen.queryByText('조건에 맞는 사용자가 없습니다')).not.toBeInTheDocument();
  });

  /**
   * 조회 실패에서 사용자가 할 수 있는 조치는 재시도뿐이다.
   * **버튼이 있는지만 보면 안 된다** — 눌러도 아무 일이 없으면 사용자를 헛돌게 한다.
   */
  it('「다시 시도」를 누르면 목록을 실제로 다시 조회한다', async () => {
    const { requests, user } = renderScreen([userListErrorRoute(500), departmentsRoute()]);

    await waitFor(() => {
      expect(userRequests(requests)).toHaveLength(1);
    });

    await user.click(await screen.findByRole('button', { name: '다시 시도' }));

    await waitFor(() => {
      expect(userRequests(requests).length).toBeGreaterThan(1);
    });
  });

  /** 서버가 빈 문구를 주는 일이 실제로 있다 — 빈 배너가 아니라 기본 안내가 나와야 한다. */
  it('서버가 빈 문구를 줘도 배너 본문이 비지 않는다', async () => {
    const { requests } = renderScreen([
      userListErrorRoute(500, { message: '', errors: [] }),
      departmentsRoute(),
    ]);

    await waitFor(() => {
      expect(requestsTo(requests, USERS_PATH).length).toBeGreaterThan(0);
    });

    expect(await screen.findByText(/잠시 뒤 다시 시도하세요/)).toBeInTheDocument();
  });

  /**
   * 계약이 「이 화면 자체가 권한 관리 화면이라 진입 자체를 막고 배너로 사유를 표시한다」고 못 박았다.
   * 표·빈 상태를 함께 내면 볼 수 없는 자료가 있는 것처럼 읽힌다.
   */
  it('권한이 없으면 배너만 나오고 표도 빈 상태도 나오지 않는다', async () => {
    const { requests } = renderScreen([userListErrorRoute(403), departmentsRoute()]);

    await waitFor(() => {
      expect(requestsTo(requests, USERS_PATH).length).toBeGreaterThan(0);
    });

    expect(await screen.findByText(/이 작업을 수행할 권한이 없습니다/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('등록된 사용자가 없습니다')).not.toBeInTheDocument();
    expect(screen.queryByText('조건에 맞는 사용자가 없습니다')).not.toBeInTheDocument();
    // 다시 불러도 같은 답이 온다 — 누를 수 있는 조치를 주면 사용자를 헛돌게 한다.
    expect(screen.queryByRole('button', { name: '다시 시도' })).not.toBeInTheDocument();
  });
});

const userFormPane = (): HTMLElement => screen.getByRole('region', { name: '사용자 정보' });

const detailRequests = (requests: RecordedRequest[], appUserId = 1001): RecordedRequest[] =>
  requestsTo(requests, `${USERS_PATH}/${String(appUserId)}`);

const openUserDetail = async (
  extraRoutes: StubRoute[] = [],
  appUser: AppUser = filledUserFixture,
  options: { etag?: string | null; editability?: Editability } = {},
) => {
  const rendered = renderScreen(
    [
      userListRoute(),
      departmentsRoute(),
      userDetailRoute(appUser, options),
      /* 부여분 규칙을 갈아 끼우려는 시험이 먼저 잡도록 기본 규칙을 뒤에 둔다. */
      ...extraRoutes,
      ...roleRoutes(appUser.appUserId),
    ],
    `?usr=${String(appUser.appUserId)}`,
  );

  await screen.findByRole('region', { name: '사용자 정보' });
  await waitFor(() => {
    expect(within(userFormPane()).getByRole('textbox', { name: '이름' })).toBeInTheDocument();
  });

  return rendered;
};

describe('UsersRolesScreen 상세 열기', () => {
  it('로그인 ID를 누르면 주소가 붙고 상세를 조회해 폼이 채워진다', async () => {
    const { requests, search, user } = renderScreen([
      userListRoute(),
      departmentsRoute(),
      userDetailRoute(),
      ...roleRoutes(),
    ]);

    await waitForUserList(requests);
    await user.click(within(userListPane()).getByRole('button', { name: 'SYN-LOGIN-01' }));

    await waitFor(() => {
      expect(new URLSearchParams(search()).get('usr')).toBe('1001');
    });
    await waitFor(() => {
      expect(detailRequests(requests)).toHaveLength(1);
    });

    expect(await within(userFormPane()).findByRole('textbox', { name: '이름' })).toHaveValue(
      '합성 사용자 A',
    );
  });

  /** 새로고침·공유·뒤로가기가 같은 화면을 내야 한다. */
  it('주소로 직접 들어와도 같은 상태가 복원된다', async () => {
    const { requests } = await openUserDetail();

    expect(detailRequests(requests)).toHaveLength(1);
    expect(within(userFormPane()).getByRole('textbox', { name: '이름' })).toHaveValue(
      '합성 사용자 A',
    );
  });

  it('고르기 전에는 폼이 아니라 안내가 나온다', async () => {
    const { requests } = renderScreen([userListRoute(), departmentsRoute()]);

    await waitForUserList(requests);

    expect(
      within(userFormPane()).getByText('좌측에서 사용자를 고르면 여기에 그 사용자의 정보가 보입니다'),
    ).toBeInTheDocument();
    expect(within(userFormPane()).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('사용자 추가는 빈 폼을 열고 상세를 조회하지 않는다', async () => {
    const { requests, user } = renderScreen([userListRoute(), departmentsRoute(), userDetailRoute()]);

    await waitForUserList(requests);
    await user.click(within(userListPane()).getByRole('button', { name: '사용자 추가' }));

    expect(await within(userFormPane()).findByRole('textbox', { name: '로그인 ID' })).toHaveValue('');
    expect(within(userFormPane()).getByRole('textbox', { name: '이름' })).toHaveValue('');
    expect(detailRequests(requests)).toHaveLength(0);
  });

  it('상세 조회가 실패하면 빈 폼 대신 배너가 나온다', async () => {
    const { requests } = renderScreen(
      [
        userListRoute(),
        departmentsRoute(),
        {
          match: (request) => isGet(request, `${USERS_PATH}/1001`),
          respond: () => jsonResponse({}, { status: 500 }),
        },
        ...roleRoutes(),
      ],
      '?usr=1001',
    );

    await waitForUserList(requests);

    expect(await screen.findByText(/잠시 뒤 다시 시도하세요/)).toBeInTheDocument();
    expect(within(userFormPane()).queryByRole('textbox')).not.toBeInTheDocument();
  });
});

describe('UsersRolesScreen 로그인 ID 잠금', () => {
  /** 계약의 수정 본문에 그 키가 아예 없다 — 잠긴 입력칸은 「언젠가 열린다」는 뜻이 된다. */
  it('수정에서는 입력칸이 아니라 값 표기이고 사유가 보인다', async () => {
    await openUserDetail();

    expect(
      within(userFormPane()).queryByRole('textbox', { name: '로그인 ID' }),
    ).not.toBeInTheDocument();
    expect(within(userFormPane()).getByText('SYN-LOGIN-01')).toBeInTheDocument();
    expect(within(userFormPane()).getByText(/로그인 ID는 등록할 때만/)).toBeInTheDocument();
  });

  it('등록에서만 입력칸이다', async () => {
    const { requests, user } = renderScreen([userListRoute(), departmentsRoute(), userCreateRoute()]);

    await waitForUserList(requests);
    await user.click(within(userListPane()).getByRole('button', { name: '사용자 추가' }));

    expect(
      await within(userFormPane()).findByRole('textbox', { name: '로그인 ID' }),
    ).toBeInTheDocument();
  });
});

describe('UsersRolesScreen 수정 저장', () => {
  const saveEdit = async (extraRoutes: StubRoute[] = []) => {
    const rendered = await openUserDetail([userUpdateRoute(), ...extraRoutes]);

    await rendered.user.clear(within(userFormPane()).getByRole('textbox', { name: '이름' }));
    await rendered.user.type(
      within(userFormPane()).getByRole('textbox', { name: '이름' }),
      '합성 사용자 Z',
    );
    await rendered.user.click(within(userFormPane()).getByRole('button', { name: '저장' }));

    return rendered;
  };

  const updateBodyOf = (requests: RecordedRequest[]): Record<string, unknown> => {
    const put = requests.find((request) => request.method === 'PUT');

    expect(put).toBeDefined();

    return JSON.parse(put?.body ?? '{}') as Record<string, unknown>;
  };

  it('수정 본문에 로그인 ID가 없다', async () => {
    const { requests } = await saveEdit();

    await waitFor(() => {
      expect(requests.some((request) => request.method === 'PUT')).toBe(true);
    });
    expect(Object.keys(updateBodyOf(requests))).not.toContain('loginId');
  });

  it('계약이 필수로 둔 이름과 상태 코드가 반드시 실린다', async () => {
    const { requests } = await saveEdit();

    await waitFor(() => {
      expect(requests.some((request) => request.method === 'PUT')).toBe(true);
    });

    const body = updateBodyOf(requests);

    expect(body.userName).toBe('합성 사용자 Z');
    expect(Object.keys(body)).toContain('statusCode');
  });

  /** 화면이 고른 적이 없는 값이다 — 지어내지도, 빼지도 않는다. */
  it('상태 코드는 서버가 준 값이 그대로 되돌아간다', async () => {
    const { requests } = await saveEdit();

    await waitFor(() => {
      expect(requests.some((request) => request.method === 'PUT')).toBe(true);
    });
    expect(updateBodyOf(requests).statusCode).toBe('SYN-STATUS-A');
  });

  it('수정 요청에 멱등 키와 낙관적 잠금 토큰이 둘 다 실린다', async () => {
    const { requests } = await saveEdit();

    await waitFor(() => {
      expect(requests.some((request) => request.method === 'PUT')).toBe(true);
    });

    const put = requests.find((request) => request.method === 'PUT');

    expect(put?.headers.get('Idempotency-Key')).toMatch(UUID);
    // 값은 **상세 경로**가 준 ETag다. 액션 경로로 꺼내면 언제나 비어 있다.
    expect(put?.headers.get('If-Match')).toBe('W/"7"');
  });

  it('저장에 성공하면 목록과 상세를 다시 조회한다', async () => {
    const { requests } = await saveEdit();

    await waitFor(() => {
      expect(userRequests(requests).length).toBeGreaterThan(1);
    });
    await waitFor(() => {
      expect(detailRequests(requests).length).toBeGreaterThan(1);
    });
  });

  /** 빈 If-Match는 계약 위반이라 서버가 400으로 되돌린다 — 보내지 않고 멈춘다. */
  it('잠금 토큰을 확보하지 못했으면 요청을 보내지 않고 안내한다', async () => {
    const { requests, user } = await openUserDetail([userUpdateRoute()], filledUserFixture, {
      etag: null,
    });

    await user.type(within(userFormPane()).getByRole('textbox', { name: '이름' }), 'Z');
    await user.click(within(userFormPane()).getByRole('button', { name: '저장' }));

    expect(await screen.findByText(/최신 정보를 불러오는 중입니다/)).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'PUT')).toBe(false);
  });

  it('검증에 걸리면 인라인 오류가 나오고 요청이 한 건도 나가지 않는다', async () => {
    const { requests, user } = await openUserDetail([userUpdateRoute()]);

    await user.clear(within(userFormPane()).getByRole('textbox', { name: '이름' }));
    await user.clear(within(userFormPane()).getByRole('textbox', { name: '전자우편' }));
    await user.type(within(userFormPane()).getByRole('textbox', { name: '전자우편' }), 'syn.user.a');
    await user.click(within(userFormPane()).getByRole('button', { name: '저장' }));

    expect(await within(userFormPane()).findByText('필수 입력 항목입니다.')).toBeInTheDocument();
    expect(within(userFormPane()).getByText(/전자우편 형식이 아닙니다/)).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'PUT')).toBe(false);
  });

  /** 서버 왕복은 정의상 요청이 나간 뒤다 — C16은 **저장 전에** 막을 것을 요구한다. */
  it('상한을 넘는 길이는 저장 전에 막히고 요청이 나가지 않는다', async () => {
    const { requests, user } = await openUserDetail([userUpdateRoute()]);

    await user.clear(within(userFormPane()).getByRole('textbox', { name: '이름' }));
    // 한 자씩 두드리면 느리다 — 붙여넣기와 같은 경로로 넣는다.
    await user.click(within(userFormPane()).getByRole('textbox', { name: '이름' }));
    await user.paste('가'.repeat(201));
    await user.click(within(userFormPane()).getByRole('button', { name: '저장' }));

    expect(
      await within(userFormPane()).findByText('이름은 200자를 넘을 수 없습니다.'),
    ).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'PUT')).toBe(false);
  });

  it('공백만 넣은 필수 칸도 요청 없이 막힌다', async () => {
    const { requests, user } = await openUserDetail([userUpdateRoute()]);

    await user.clear(within(userFormPane()).getByRole('textbox', { name: '이름' }));
    await user.type(within(userFormPane()).getByRole('textbox', { name: '이름' }), '   ');
    await user.click(within(userFormPane()).getByRole('button', { name: '저장' }));

    expect(await within(userFormPane()).findByText(/공백만으로 지정할 수 없습니다/)).toBeInTheDocument();
    expect(requests.some((request) => request.method === 'PUT')).toBe(false);
  });

  it('고친 것이 없으면 저장이 비활성이다', async () => {
    await openUserDetail([userUpdateRoute()]);

    expect(within(userFormPane()).getByRole('button', { name: '저장' })).toBeDisabled();
  });

  it('취소는 요청을 보내지 않고 값을 기준값으로 되돌린다', async () => {
    const { requests, user } = await openUserDetail([userUpdateRoute()]);

    const before = requests.length;

    await user.type(within(userFormPane()).getByRole('textbox', { name: '이름' }), 'Z');
    await user.click(within(userFormPane()).getByRole('button', { name: '취소' }));

    expect(within(userFormPane()).getByRole('textbox', { name: '이름' })).toHaveValue(
      '합성 사용자 A',
    );
    expect(requests).toHaveLength(before);
  });
});

describe('UsersRolesScreen 저장 실패', () => {
  const validationErrorResponse = (errors: unknown[]): Response =>
    jsonResponse({ errors }, { status: 400 });

  it('아는 필드의 400은 그 칸 옆 인라인으로 나온다', async () => {
    const { user } = await openUserDetail([
      userUpdateRoute(1001, () =>
        validationErrorResponse([
          { scope: 'field', field: 'userName', code: 'REQUIRED', message: '이름을 확인하세요.' },
        ]),
      ),
    ]);

    await user.type(within(userFormPane()).getByRole('textbox', { name: '이름' }), 'Z');
    await user.click(within(userFormPane()).getByRole('button', { name: '저장' }));

    expect(await within(userFormPane()).findByText('이름을 확인하세요.')).toBeInTheDocument();
  });

  /** 서버가 화면이 모르는 필드명을 내려주며, 그것을 버리면 어디에도 표시되지 않는 오류가 생긴다. */
  it('화면이 모르는 필드의 400과 화면 수준 오류는 배너로 나온다', async () => {
    const { user } = await openUserDetail([
      userUpdateRoute(1001, () =>
        validationErrorResponse([
          { scope: 'field', field: 'syntheticUnknown', code: 'RANGE', message: '모르는 칸 오류.' },
          { scope: 'screen', code: 'STATE_LOCKED', message: '화면 수준 오류.' },
        ]),
      ),
    ]);

    await user.type(within(userFormPane()).getByRole('textbox', { name: '이름' }), 'Z');
    await user.click(within(userFormPane()).getByRole('button', { name: '저장' }));

    expect(await within(userFormPane()).findByText('모르는 칸 오류.')).toBeInTheDocument();
    expect(within(userFormPane()).getByText('화면 수준 오류.')).toBeInTheDocument();
  });

  /**
   * 세 원인은 대응 방법이 서로 다르다 — 한 문구로 뭉개면 사용자가 다음 행동을 정할 수 없다.
   * 그래서 **다른 두 원인의 문구가 나오지 않는 것**까지 함께 본다.
   */
  const CONFLICT_CASES = [
    { cause: 'user', phrase: '다른 사용자가 먼저 저장했습니다' },
    { cause: 'erpSync', phrase: '외부 시스템에서 이 항목이 다시 동기화됐습니다' },
    { cause: 'workerLease', phrase: '다른 작업에서 이 항목을 처리하는 중입니다' },
  ] as const;

  for (const { cause, phrase } of CONFLICT_CASES) {
    it(`충돌 원인 ${cause}에는 그 원인만의 문구와 「최신 불러오기」가 나온다`, async () => {
      const { user } = await openUserDetail([
        userUpdateRoute(1001, () =>
          jsonResponse({ conflictCause: cause, message: '' }, { status: 409 }),
        ),
      ]);

      await user.type(within(userFormPane()).getByRole('textbox', { name: '이름' }), 'Z');
      await user.click(within(userFormPane()).getByRole('button', { name: '저장' }));

      expect(await screen.findByText(new RegExp(phrase))).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '최신 불러오기' })).toBeInTheDocument();

      for (const other of CONFLICT_CASES) {
        if (other.cause === cause) continue;
        expect(screen.queryByText(new RegExp(other.phrase))).not.toBeInTheDocument();
      }
    });
  }

  /** 실패에도 폼을 닫으면 사용자는 자기가 무엇을 하려 했는지 잃는다. */
  it('저장에 실패해도 폼이 닫히지 않고 입력값이 남는다', async () => {
    const { user } = await openUserDetail([
      userUpdateRoute(1001, () =>
        validationErrorResponse([{ scope: 'screen', code: 'STATE_LOCKED', message: '막혔습니다.' }]),
      ),
    ]);

    await user.clear(within(userFormPane()).getByRole('textbox', { name: '이름' }));
    await user.type(within(userFormPane()).getByRole('textbox', { name: '이름' }), '합성 사용자 Z');
    await user.click(within(userFormPane()).getByRole('button', { name: '저장' }));

    expect(await within(userFormPane()).findByText('막혔습니다.')).toBeInTheDocument();
    expect(within(userFormPane()).getByRole('textbox', { name: '이름' })).toHaveValue(
      '합성 사용자 Z',
    );
  });
});

describe('UsersRolesScreen 등록', () => {
  const fillCreateForm = async (extraRoutes: StubRoute[] = []) => {
    const rendered = renderScreen([
      userListRoute(),
      departmentsRoute(),
      userDetailRoute(),
      ...extraRoutes,
    ]);

    await waitForUserList(rendered.requests);
    await rendered.user.click(within(userListPane()).getByRole('button', { name: '사용자 추가' }));
    await within(userFormPane()).findByRole('textbox', { name: '로그인 ID' });

    await rendered.user.type(
      within(userFormPane()).getByRole('textbox', { name: '로그인 ID' }),
      'SYN-LOGIN-09',
    );
    await rendered.user.type(
      within(userFormPane()).getByRole('textbox', { name: '이름' }),
      '합성 사용자 Z',
    );

    return rendered;
  };

  const createBodyOf = (requests: RecordedRequest[]): Record<string, unknown> => {
    const post = requests.find(
      (request) => request.method === 'POST' && request.url.pathname === USERS_PATH,
    );

    expect(post).toBeDefined();

    return JSON.parse(post?.body ?? '{}') as Record<string, unknown>;
  };

  it('등록 요청에 멱등 키만 실린다 — 아직 잠글 대상이 없다', async () => {
    const { requests, user } = await fillCreateForm([userCreateRoute()]);

    await user.click(within(userFormPane()).getByRole('button', { name: '사용자 추가' }));

    await waitFor(() => {
      expect(requests.some((request) => request.method === 'POST')).toBe(true);
    });

    const post = requests.find((request) => request.method === 'POST');

    expect(post?.headers.get('Idempotency-Key')).toMatch(UUID);
    expect(post?.headers.get('If-Match')).toBeNull();
  });

  /** 계약이 「미지정 시 서버가 기본값으로 채운다」고 명시했고 화면이 고를 값이 없다. */
  it('등록 본문에 상태 코드가 실리지 않는다', async () => {
    const { requests, user } = await fillCreateForm([userCreateRoute()]);

    await user.click(within(userFormPane()).getByRole('button', { name: '사용자 추가' }));

    await waitFor(() => {
      expect(requests.some((request) => request.method === 'POST')).toBe(true);
    });
    expect(Object.keys(createBodyOf(requests))).not.toContain('statusCode');
    expect(createBodyOf(requests).loginId).toBe('SYN-LOGIN-09');
  });

  it('등록에 성공하면 방금 만든 사용자가 열린다', async () => {
    const { requests, search, user } = await fillCreateForm([
      userCreateRoute(),
      userDetailRoute({ ...filledUserFixture, appUserId: 1009 }),
    ]);

    await user.click(within(userFormPane()).getByRole('button', { name: '사용자 추가' }));

    await waitFor(() => {
      expect(new URLSearchParams(search()).get('usr')).toBe('1009');
    });
    expect(new URLSearchParams(search()).has('new')).toBe(false);
    expect(requests.length).toBeGreaterThan(0);
  });

  it('등록에는 사용 중지가 없다 — 아직 없는 자원을 중지할 수 없다', async () => {
    await fillCreateForm([userCreateRoute()]);

    expect(
      within(userFormPane()).queryByRole('button', { name: '사용 중지' }),
    ).not.toBeInTheDocument();
  });
});

describe('UsersRolesScreen 사용 중지', () => {
  const openDeactivateDialog = async (extraRoutes: StubRoute[] = []) => {
    const rendered = await openUserDetail(extraRoutes);

    await rendered.user.click(within(userFormPane()).getByRole('button', { name: '사용 중지' }));
    await screen.findByRole('dialog');

    return rendered;
  };

  /** 닫힌 창을 남겨 두면 지난 값이 그대로 살아 있다. */
  it('창은 열기 전에는 DOM에 없다', async () => {
    await openUserDetail([userDeactivateRoute()]);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText(/되돌리는 경로가 없습니다/)).not.toBeInTheDocument();
  });

  it('창이 되돌릴 수 없다는 사실을 먼저 밝히고 건수를 내지 않는다', async () => {
    await openDeactivateDialog([userDeactivateRoute()]);

    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText(/되돌리는 경로가 없습니다/)).toBeInTheDocument();
    expect(dialog.textContent).not.toMatch(/\d+\s*건/);
  });

  it('확인 요청에 멱등 키와 상세 경로의 잠금 토큰이 둘 다 실린다', async () => {
    const { requests, user } = await openDeactivateDialog([userDeactivateRoute()]);

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '사용 중지' }));

    await waitFor(() => {
      expect(requests.some((request) => request.url.pathname.endsWith(':deactivate'))).toBe(true);
    });

    const action = requests.find((request) => request.url.pathname.endsWith(':deactivate'));

    expect(action?.headers.get('Idempotency-Key')).toMatch(UUID);
    // 액션 경로에는 ETag가 보관되지 않는다 — 그 경로로 꺼내면 언제나 비어 있다.
    expect(action?.headers.get('If-Match')).toBe('W/"7"');
  });

  it('성공하면 창이 닫히고 목록과 상세를 다시 조회한다', async () => {
    const { requests, user } = await openDeactivateDialog([userDeactivateRoute()]);

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '사용 중지' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(userRequests(requests).length).toBeGreaterThan(1);
    });
  });

  /** 닫으면 사용자는 무엇이 막았는지 모른 채 같은 버튼을 다시 누른다. */
  it('실패하면 창이 닫히지 않고 배너가 창 안에 나온다', async () => {
    const { user } = await openDeactivateDialog([
      userDeactivateRoute(1001, () =>
        jsonResponse(
          { errors: [{ scope: 'screen', code: 'STATE_LOCKED', message: '중지할 수 없습니다.' }] },
          { status: 400 },
        ),
      ),
    ]);

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '사용 중지' }));

    expect(
      await within(screen.getByRole('dialog')).findByText('중지할 수 없습니다.'),
    ).toBeInTheDocument();
  });

  it('이미 미사용인 사용자는 사용 중지가 비활성이고 사유가 보인다', async () => {
    await openUserDetail([userDeactivateRoute(1003)], {
      ...filledUserFixture,
      appUserId: 1003,
      isActive: false,
    });

    expect(within(userFormPane()).getByRole('button', { name: '사용 중지' })).toBeDisabled();
    expect(
      within(userFormPane()).getByText('사용 중지는 이미 미사용인 사용자에게 다시 할 수 없습니다.'),
    ).toBeInTheDocument();
  });
});

describe('UsersRolesScreen 초안 수명', () => {
  /** 편집 중에 캐시가 갱신돼도 값이 되돌아가면 사용자는 자기가 쓰던 것을 잃는다. */
  it('편집 중 목록 캐시가 갱신돼도 폼의 값이 되돌아가지 않는다', async () => {
    const { requests, user } = await openUserDetail([userUpdateRoute()]);

    await user.clear(within(userFormPane()).getByRole('textbox', { name: '이름' }));
    await user.type(within(userFormPane()).getByRole('textbox', { name: '이름' }), '합성 사용자 Z');

    // 목록만 다시 조회한다 — 상세 응답 객체는 그대로다.
    await user.click(within(userListPane()).getByRole('checkbox', { name: '미사용 포함' }));
    await waitFor(() => {
      expect(userRequests(requests).length).toBeGreaterThan(1);
    });

    // 조건이 바뀌면 선택이 사라지는 것이 규칙이라 폼 자체가 닫힌다 — 값이 서버 값으로 되돌아 남지 않는다.
    expect(
      within(userFormPane()).queryByRole('textbox', { name: '이름' }),
    ).not.toBeInTheDocument();
  });

  /**
   * 뒤로가기·주소 손 편집·공유 링크가 밟는 길이다. **클릭 핸들러의 정리를 하나도 거치지 않는다.**
   *
   * 그리고 **한 번 본 사용자로 되돌아가는 경우**를 밟는다 — 상세가 이미 캐시에 있어
   * 「불러오는 중」이 한 번도 지나가지 않는다. 그 빈틈이 없으면 초안을 다시 세우는 판정은
   * **출처 비교뿐**이라, 비교가 없으면 앞 사용자의 값이 그대로 남는다.
   */
  it('이미 본 사용자로 주소를 직접 되돌려도 폼이 그 사용자의 값으로 다시 세워진다', async () => {
    const nameBox = () => within(userFormPane()).getByRole('textbox', { name: '이름' });

    const { goTo, user } = await openUserDetail([
      userDetailRoute({ ...filledUserFixture, appUserId: 1002, userName: '합성 사용자 B' }),
      userRolesRoute(1002, []),
      userDataScopesRoute(1002, []),
    ]);

    // 1002를 한 번 열어 상세를 캐시에 올린다.
    goTo(`${ROUTE}?usr=1002`);
    await waitFor(() => {
      expect(nameBox()).toHaveValue('합성 사용자 B');
    });

    goTo(`${ROUTE}?usr=1001`);
    await waitFor(() => {
      expect(nameBox()).toHaveValue('합성 사용자 A');
    });

    await user.clear(nameBox());
    await user.type(nameBox(), '고치던 값');

    // 캐시가 더워 「불러오는 중」이 지나가지 않는다.
    goTo(`${ROUTE}?usr=1002`);

    await waitFor(() => {
      expect(nameBox()).toHaveValue('합성 사용자 B');
    });
  });

  /**
   * **대상이 그대로인 채 서버 값만 바뀌는 유일한 길**이다. 편집 대상에 묶인 정리는 여기서 돌지 않으므로
   * 초안을 다시 세우는 판정은 **출처 비교뿐**이다.
   *
   * 충돌 배너가 「최신 내용을 불러오면 입력한 내용은 사라집니다」라고 약속하므로,
   * 다시 세우지 않으면 화면이 그 약속을 어긴다 — 사용자는 남의 값 위에 자기 값을 덮어쓰게 된다.
   */
  it('충돌 뒤 「최신 불러오기」를 누르면 폼이 서버의 최신 값으로 다시 세워진다', async () => {
    let serverName = '합성 사용자 A';

    const { requests, user } = renderScreen(
      [
        userListRoute(),
        departmentsRoute(),
        {
          match: (request) => isGet(request, `${USERS_PATH}/1001`),
          respond: () =>
            jsonResponse(
              { appUser: { ...filledUserFixture, userName: serverName }, editability: EDITABLE },
              { headers: { ETag: 'W/"7"' } },
            ),
        },
        userUpdateRoute(1001, () =>
          jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 }),
        ),
      ],
      '?usr=1001',
    );

    await waitForUserList(requests);
    const nameBox = () => within(userFormPane()).getByRole('textbox', { name: '이름' });
    await waitFor(() => {
      expect(nameBox()).toHaveValue('합성 사용자 A');
    });

    await user.clear(nameBox());
    await user.type(nameBox(), '내가 고치던 값');
    await user.click(within(userFormPane()).getByRole('button', { name: '저장' }));
    await screen.findByText(/다른 사용자가 먼저 저장했습니다/);

    // 그동안 남이 저장해 둔 값.
    serverName = '남이 저장한 이름';
    await user.click(screen.getByRole('button', { name: '최신 불러오기' }));

    await waitFor(() => {
      expect(nameBox()).toHaveValue('남이 저장한 이름');
    });
  });

  it('다른 사용자를 고르면 폼이 그 사용자의 값으로 다시 세워진다', async () => {
    const { user } = await openUserDetail([
      userDetailRoute({ ...filledUserFixture, appUserId: 1002, userName: '합성 사용자 B' }),
    ]);

    await user.clear(within(userFormPane()).getByRole('textbox', { name: '이름' }));
    await user.type(within(userFormPane()).getByRole('textbox', { name: '이름' }), '고치던 값');

    await user.click(within(userListPane()).getByRole('button', { name: 'SYN-LOGIN-02' }));

    await waitFor(() => {
      expect(within(userFormPane()).getByRole('textbox', { name: '이름' })).toHaveValue(
        '합성 사용자 B',
      );
    });
  });
});

/**
 * 창·오류의 수명이 **편집 대상**에 묶여 있는지 본다.
 *
 * 클릭 핸들러에만 정리를 두면 뒤로가기·주소 손 편집·공유 링크가 핸들러를 거치지 않고 샌다.
 * 그 경로에서 창이 살아남으면 **A를 중지하려고 연 창이 B를 중지한다** — 쓰기 대상은 지금 주소를
 * 읽기 때문이다. 계약에 되살리는 오퍼레이션이 없어 복구 경로가 없다.
 */
describe('UsersRolesScreen 창·오류의 수명', () => {
  const USER_B: AppUser = { ...filledUserFixture, appUserId: 1002, userName: '합성 사용자 B' };

  const openDialogOnUserA = async (extraRoutes: StubRoute[] = []) => {
    const rendered = await openUserDetail([
      userDetailRoute(USER_B, { etag: 'W/"1002"' }),
      userDeactivateRoute(1001),
      userDeactivateRoute(1002),
      userRolesRoute(1002, []),
      userDataScopesRoute(1002, []),
      ...extraRoutes,
    ]);

    await rendered.user.click(within(userFormPane()).getByRole('button', { name: '사용 중지' }));
    await screen.findByRole('dialog');

    return rendered;
  };

  /** 가장 심각한 갈래 — 어느 경로로 요청이 나갔는지까지 봐야 대상이 갈리는 문제를 잡는다. */
  it('창을 연 채 주소로 다른 사용자에 가면 창이 닫히고 아무 요청도 나가지 않는다', async () => {
    const { requests, goTo } = await openDialogOnUserA();

    goTo(`${ROUTE}?usr=1002`);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(requests.some((request) => request.url.pathname.endsWith(':deactivate'))).toBe(false);
  });

  it('그 뒤 다시 중지하면 지금 보고 있는 사용자에게만 나간다', async () => {
    const { requests, goTo, user } = await openDialogOnUserA();

    goTo(`${ROUTE}?usr=1002`);
    await waitFor(() => {
      expect(within(userFormPane()).getByRole('textbox', { name: '이름' })).toHaveValue(
        '합성 사용자 B',
      );
    });

    await user.click(within(userFormPane()).getByRole('button', { name: '사용 중지' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '사용 중지' }));

    await waitFor(() => {
      expect(requests.some((request) => request.url.pathname.endsWith(':deactivate'))).toBe(true);
    });

    const actions = requests.filter((request) => request.url.pathname.endsWith(':deactivate'));

    expect(actions).toHaveLength(1);
    expect(actions[0]?.url.pathname).toBe('/app/users/1002:deactivate');
    expect(actions[0]?.headers.get('If-Match')).toBe('W/"1002"');
  });

  /** 선택이 사라진 주소에서 창이 남으면 존재하지 않는 번호로 요청이 나간다. */
  it('창을 연 채 선택 없는 주소로 가면 창이 닫히고 번호 없는 요청이 나가지 않는다', async () => {
    const { requests, goTo } = await openDialogOnUserA();

    goTo(ROUTE);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(requests.some((request) => request.url.pathname.includes('/app/users/0'))).toBe(false);
    expect(requests.some((request) => request.url.pathname.endsWith(':deactivate'))).toBe(false);
  });

  it('앞 사용자의 인라인 오류가 다음 사용자의 폼에 따라오지 않는다', async () => {
    const { goTo, user } = await openUserDetail([
      userDetailRoute(USER_B, { etag: 'W/"1002"' }),
      userRolesRoute(1002, []),
      userDataScopesRoute(1002, []),
      userUpdateRoute(),
    ]);

    await user.clear(within(userFormPane()).getByRole('textbox', { name: '이름' }));
    await user.click(within(userFormPane()).getByRole('button', { name: '저장' }));
    await within(userFormPane()).findByText('필수 입력 항목입니다.');

    goTo(`${ROUTE}?usr=1002`);

    await waitFor(() => {
      expect(within(userFormPane()).getByRole('textbox', { name: '이름' })).toHaveValue(
        '합성 사용자 B',
      );
    });
    expect(within(userFormPane()).queryByText('필수 입력 항목입니다.')).not.toBeInTheDocument();
  });

  it('앞 사용자의 저장 실패 배너가 다음 사용자의 폼 위에 남지 않는다', async () => {
    const { goTo, user } = await openUserDetail([
      userDetailRoute(USER_B, { etag: 'W/"1002"' }),
      userRolesRoute(1002, []),
      userDataScopesRoute(1002, []),
      userUpdateRoute(1001, () =>
        jsonResponse(
          { errors: [{ scope: 'screen', code: 'STATE_LOCKED', message: '앞 사용자의 실패.' }] },
          { status: 400 },
        ),
      ),
    ]);

    await user.type(within(userFormPane()).getByRole('textbox', { name: '이름' }), 'Z');
    await user.click(within(userFormPane()).getByRole('button', { name: '저장' }));
    await within(userFormPane()).findByText('앞 사용자의 실패.');

    goTo(`${ROUTE}?usr=1002`);

    await waitFor(() => {
      expect(within(userFormPane()).getByRole('textbox', { name: '이름' })).toHaveValue(
        '합성 사용자 B',
      );
    });
    expect(screen.queryByText('앞 사용자의 실패.')).not.toBeInTheDocument();
  });

  /**
   * 짝이 되는 반대쪽 — **같은 대상이면 닫지 않는다.**
   * 아무 렌더에나 정리가 돌면 창이 열리자마자 사라져 사용자가 확인을 누를 수 없다.
   */
  it('같은 사용자를 다시 고르면 창이 닫히지 않는다', async () => {
    const { goTo } = await openDialogOnUserA();

    goTo(`${ROUTE}?usr=1001`);
    await waitFor(() => {
      expect(within(userFormPane()).getByRole('textbox', { name: '이름' })).toHaveValue(
        '합성 사용자 A',
      );
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  /**
   * 편집 대상 판정의 **등록 폼 쪽 절반**. 고른 사용자가 없는 상태에서 `new`만 켜졌다 꺼지므로
   * 선택 번호만 보면 「아무것도 안 바뀐 것」으로 읽혀 앞선 실패가 그대로 남는다.
   *
   * 등록 폼을 닫는 자리에서 오류를 직접 비우던 코드를 걷어내고 이 규칙에 그 몫을 넘겼으므로,
   * 이 경로가 실제로 정리되는지를 여기서 고정한다.
   */
  it('등록에 실패한 뒤 폼을 닫았다 다시 열면 앞선 실패 배너가 없다', async () => {
    const { requests, user } = renderScreen([
      userListRoute(),
      departmentsRoute(),
      userCreateRoute(() =>
        jsonResponse(
          { errors: [{ scope: 'screen', code: 'STATE_LOCKED', message: '등록이 막혔습니다.' }] },
          { status: 400 },
        ),
      ),
    ]);

    await waitForUserList(requests);
    await user.click(within(userListPane()).getByRole('button', { name: '사용자 추가' }));

    await user.type(
      await within(userFormPane()).findByRole('textbox', { name: '로그인 ID' }),
      'SYN-LOGIN-09',
    );
    await user.type(within(userFormPane()).getByRole('textbox', { name: '이름' }), '합성 사용자 Z');
    await user.click(within(userFormPane()).getByRole('button', { name: '사용자 추가' }));
    await within(userFormPane()).findByText('등록이 막혔습니다.');

    await user.click(within(userFormPane()).getByRole('button', { name: '취소' }));
    await user.click(within(userListPane()).getByRole('button', { name: '사용자 추가' }));

    await within(userFormPane()).findByRole('textbox', { name: '로그인 ID' });
    expect(screen.queryByText('등록이 막혔습니다.')).not.toBeInTheDocument();
    expect(within(userFormPane()).getByRole('textbox', { name: '이름' })).toHaveValue('');
  });

  /**
   * 결과를 기다리는 동안 창이 사라지면 사용자는 무엇이 진행 중인지 잃는다(계획 §12-15 후단).
   *
   * 응답 본문을 끝내지 않는 흐름으로 두어 **요청이 실제로 떠 있는 상태**를 만든다 —
   * 곧바로 응답하면 성공 처리가 끼어들어 「진행 중」을 한 번도 지나가지 않는다.
   */
  it('중지 요청이 진행되는 동안 창이 닫히지 않는다', async () => {
    const neverEndingResponse = (): Response =>
      new Response(
        new ReadableStream({
          start() {
            /* 끝내지 않는다 — 요청이 진행 중인 상태를 유지한다. */
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );

    const { user } = await openUserDetail([
      {
        match: (request) =>
          request.method === 'POST' && new URL(request.url).pathname.endsWith(':deactivate'),
        respond: neverEndingResponse,
      },
    ]);

    await user.click(within(userFormPane()).getByRole('button', { name: '사용 중지' }));
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: '사용 중지' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // 연타로 요청이 두 번 나가지 않는다.
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: '사용 중지' })).toBeDisabled();
  });
});

const roleAssignPane = (): HTMLElement => screen.getByRole('region', { name: '역할 부여' });

const roleCheckbox = (name: string): HTMLElement =>
  within(roleAssignPane()).getByRole('checkbox', { name });

const userRolesRequests = (
  requests: RecordedRequest[],
  appUserId = 1001,
): RecordedRequest[] => requestsTo(requests, userRolesPath(appUserId));

const roleAssignBodyOf = (requests: RecordedRequest[], appUserId = 1001): { roleIds?: number[] } => {
  const put = userRolesRequests(requests, appUserId).find((request) => request.method === 'PUT');

  expect(put).toBeDefined();

  return JSON.parse(put?.body ?? '{}') as { roleIds?: number[] };
};

/** 확인칸이 실제로 그려진 뒤에야 조작할 수 있다 — 선택 목록과 부여분이 둘 다 있어야 한다. */
const openRoleAssign = async (
  extraRoutes: StubRoute[] = [],
  appUser: AppUser = filledUserFixture,
  options: { etag?: string | null } = {},
) => {
  const rendered = await openUserDetail(extraRoutes, appUser, options);

  await screen.findByRole('region', { name: '역할 부여' });
  await waitFor(() => {
    expect(within(roleAssignPane()).getAllByRole('checkbox').length).toBeGreaterThan(0);
  });

  return rendered;
};

describe('UsersRolesScreen 역할 부여', () => {
  it('사용자를 고르면 부여분을 조회하고 체크 상태가 그 결과와 일치한다', async () => {
    const { requests } = await openRoleAssign([roleAssignRoute()]);

    expect(userRolesRequests(requests).filter((request) => request.method === 'GET')).toHaveLength(1);
    expect(roleCheckbox('SYN-ROLE-01 · 합성 역할 A')).toBeChecked();
    expect(roleCheckbox('SYN-ROLE-02 · 합성 역할 B')).not.toBeChecked();
  });

  /** 누구에게 주는 것인지 알 수 없는 자리에 빈 페인을 두면 「여기서 무언가 된다」고 읽힌다. */
  it('고르기 전에는 페인이 없고 부여분을 조회하지도 않는다', async () => {
    const { requests } = renderScreen([userListRoute(), departmentsRoute()]);

    await waitForUserList(requests);

    expect(screen.queryByRole('region', { name: '역할 부여' })).not.toBeInTheDocument();
    expect(userRolesRequests(requests)).toHaveLength(0);
  });

  it('등록 중에는 페인이 없다 — 아직 부여할 대상이 없다', async () => {
    const { requests } = renderScreen([userListRoute(), departmentsRoute()], '?new=user');

    await waitForUserList(requests);

    expect(screen.queryByRole('region', { name: '역할 부여' })).not.toBeInTheDocument();
    expect(userRolesRequests(requests)).toHaveLength(0);
  });

  /** 계약이 전체 치환이다 — 바뀐 것만 실으면 나머지가 전부 회수된다. */
  it('저장 본문이 최종 상태 전체이고 순서는 고른 순서가 아니라 선택 목록 순서다', async () => {
    const { requests, user } = await openRoleAssign([roleAssignRoute()]);

    await user.click(roleCheckbox('SYN-ROLE-02 · 합성 역할 B'));
    await user.click(within(roleAssignPane()).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(userRolesRequests(requests).some((request) => request.method === 'PUT')).toBe(true);
    });
    // 나중에 체크한 5002가 목록 순서에 따라 가운데로 들어간다.
    expect(roleAssignBodyOf(requests).roleIds).toEqual([5001, 5002, 5003]);
  });

  it('체크를 하나 풀어도 나머지가 전부 실린다', async () => {
    const { requests, user } = await openRoleAssign([roleAssignRoute()]);

    await user.click(roleCheckbox('SYN-ROLE-01 · 합성 역할 A'));
    await user.click(within(roleAssignPane()).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(userRolesRequests(requests).some((request) => request.method === 'PUT')).toBe(true);
    });
    expect(roleAssignBodyOf(requests).roleIds).toEqual([5003]);
  });

  /**
   * **부여·회수 형이라 낙관적 잠금이 없다**(계약에 `If-Match` 파라미터 자체가 없다).
   * 마스터 형 쓰기를 그대로 베끼면 계약에 없는 헤더가 나가고, 토큰을 찾지 못해
   * 저장이 **시작조차 하지 않는다**.
   */
  it('치환 요청에 멱등 키가 실리고 잠금 토큰은 실리지 않는다', async () => {
    const { requests, user } = await openRoleAssign([roleAssignRoute()]);

    await user.click(roleCheckbox('SYN-ROLE-02 · 합성 역할 B'));
    await user.click(within(roleAssignPane()).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(userRolesRequests(requests).some((request) => request.method === 'PUT')).toBe(true);
    });

    const put = userRolesRequests(requests).find((request) => request.method === 'PUT');

    expect(put?.headers.get('Idempotency-Key')).toMatch(UUID);
    expect(put?.headers.get('If-Match')).toBeNull();
  });

  /**
   * **낙관적 잠금이 없다는 것은 헤더 하나의 문제가 아니다.** 잠금 토큰을 꺼낼 경로를 넘기면
   * 토큰이 없을 때 훅이 요청을 **보내지 않고 멈춘다** — 저장을 눌러도 아무 일이 없는 상태가 된다.
   * 상세 응답에 `ETag`가 없는 상황이 그 갈래를 드러낸다.
   */
  it('상세에 잠금 토큰이 없어도 치환 저장이 그대로 나간다', async () => {
    const { requests, user } = await openRoleAssign([roleAssignRoute()], filledUserFixture, {
      etag: null,
    });

    await user.click(roleCheckbox('SYN-ROLE-02 · 합성 역할 B'));
    await user.click(within(roleAssignPane()).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(userRolesRequests(requests).some((request) => request.method === 'PUT')).toBe(true);
    });
    expect(within(roleAssignPane()).queryByText(/최신 정보를 불러오는 중입니다/)).not.toBeInTheDocument();
  });

  /** 빼 버리면 저장할 때 그 부여가 조용히 사라진다. */
  it('미사용 역할은 목록에 남고 잠기며 저장 본문에도 그대로 실린다', async () => {
    const { requests, user } = await openRoleAssign([roleAssignRoute()]);

    const inactive = roleCheckbox('SYN-ROLE-03 · 합성 역할 C (미사용)');

    expect(inactive).toBeChecked();
    expect(inactive).toBeDisabled();

    await user.click(roleCheckbox('SYN-ROLE-02 · 합성 역할 B'));
    await user.click(within(roleAssignPane()).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(userRolesRequests(requests).some((request) => request.method === 'PUT')).toBe(true);
    });
    expect(roleAssignBodyOf(requests).roleIds).toContain(5003);
  });

  it('부여되지 않은 미사용 역할은 확인칸이 서지 않는다', async () => {
    await openRoleAssign([roleAssignRoute(), userRolesRoute(1001, [])]);

    expect(
      within(roleAssignPane()).queryByRole('checkbox', { name: /SYN-ROLE-03/ }),
    ).not.toBeInTheDocument();
  });

  it('선택 목록이 잘리면 안내가 나온다 — 고를 수 없는 역할이 있다는 뜻이다', async () => {
    await openRoleAssign([
      roleAssignRoute(),
      roleLookupRoute(roleFixtures, { page: 1, size: 3, total: 9 }),
    ]);

    expect(within(roleAssignPane()).getByText(/선택 목록이 일부만 표시됩니다/)).toBeInTheDocument();
  });

  /** 서버가 조정한 결과를 화면이 그대로 받아야 다음 저장이 옛 상태 위에서 돌지 않는다. */
  it('저장에 성공하면 부여분을 다시 조회하고 서버가 답한 상태로 다시 세운다', async () => {
    const replaced: typeof userRoleFixtures = [{ userRoleId: 7003, appUserId: 1001, roleId: 5002 }];
    let served = userRoleFixtures;

    const { requests, user } = await openRoleAssign([
      {
        match: (request) => isGet(request, userRolesPath(1001)),
        respond: () => jsonResponse({ items: served }),
      },
      roleAssignRoute(1001, () => {
        served = replaced;

        return jsonResponse({ items: replaced });
      }),
    ]);

    await user.click(roleCheckbox('SYN-ROLE-02 · 합성 역할 B'));
    await user.click(within(roleAssignPane()).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(
        userRolesRequests(requests).filter((request) => request.method === 'GET').length,
      ).toBeGreaterThan(1);
    });

    await waitFor(() => {
      expect(roleCheckbox('SYN-ROLE-02 · 합성 역할 B')).toBeChecked();
    });
    // 보낸 것이 아니라 **서버가 답한 것**이 화면에 남는다.
    expect(roleCheckbox('SYN-ROLE-01 · 합성 역할 A')).not.toBeChecked();
  });

  /**
   * **무효화를 넓히면 아무것도 빨개지지 않는다.** 이 치환은 사용자 행도 잠금 토큰도 바꾸지
   * 않으므로(`user_role`에 `version_no`가 없다) 상세·목록을 다시 부를 이유가 없다.
   * 넓히면 왕복 둘이 늘고, 상세 응답이 조금이라도 달라지는 순간 **바로 위 칸에서 편집 중이던
   * 폼이 서버 값으로 되돌아간다.** 「선례와 같게 맞춘다」는 이름의 되돌림을 여기서 잡는다.
   *
   * 무효화는 걸린 조회를 **한 번에** 다시 띄우고 요청은 뜨는 시점에 기록되므로,
   * 부여분 재조회가 기록됐다면 넓힌 무효화의 상세·목록도 이미 기록돼 있다.
   */
  it('치환 저장은 부여분만 다시 조회하고 상세·목록은 다시 부르지 않는다', async () => {
    const { requests, user } = await openRoleAssign([roleAssignRoute()]);

    const grantsBefore = userRolesRequests(requests).filter((r) => r.method === 'GET').length;
    const detailBefore = detailRequests(requests).length;
    const listBefore = userRequests(requests).length;

    await user.click(roleCheckbox('SYN-ROLE-02 · 합성 역할 B'));
    await user.click(within(roleAssignPane()).getByRole('button', { name: '저장' }));

    // 선행 단언 — 무효화가 실제로 돌았는지 먼저 본다. 없으면 아래 비교가 빈 확인이 된다.
    await waitFor(() => {
      expect(userRolesRequests(requests).filter((r) => r.method === 'GET').length).toBeGreaterThan(
        grantsBefore,
      );
    });

    expect(detailRequests(requests)).toHaveLength(detailBefore);
    expect(userRequests(requests)).toHaveLength(listBefore);
  });

  it('취소는 요청을 보내지 않고 체크를 기준값으로 되돌린다', async () => {
    const { requests, user } = await openRoleAssign([roleAssignRoute()]);

    await user.click(roleCheckbox('SYN-ROLE-02 · 합성 역할 B'));

    const before = requests.length;

    await user.click(within(roleAssignPane()).getByRole('button', { name: '취소' }));

    expect(roleCheckbox('SYN-ROLE-02 · 합성 역할 B')).not.toBeChecked();
    expect(roleCheckbox('SYN-ROLE-01 · 합성 역할 A')).toBeChecked();
    expect(requests).toHaveLength(before);
  });

  it('고친 것이 없으면 저장이 비활성이고 사유가 보인다', async () => {
    await openRoleAssign([roleAssignRoute()]);

    expect(within(roleAssignPane()).getByRole('button', { name: '저장' })).toBeDisabled();
    expect(within(roleAssignPane()).getByText(/저장은 고친 내용이 있을 때/)).toBeInTheDocument();
  });

  /** 되돌려 놓았는데 「고쳤다」로 남으면 취소·저장이 사실과 어긋난다. */
  it('켰다가 다시 끄면 고친 것이 없는 상태로 돌아온다', async () => {
    const { user } = await openRoleAssign([roleAssignRoute()]);

    await user.click(roleCheckbox('SYN-ROLE-02 · 합성 역할 B'));
    await user.click(roleCheckbox('SYN-ROLE-02 · 합성 역할 B'));

    expect(within(roleAssignPane()).getByRole('button', { name: '저장' })).toBeDisabled();
  });

  it('다른 사용자를 고르면 체크가 그 사용자의 부여분으로 다시 세워진다', async () => {
    const userB: AppUser = { ...filledUserFixture, appUserId: 1002, userName: '합성 사용자 B' };

    const { goTo } = await openRoleAssign([
      userDetailRoute(userB, { etag: 'W/"1002"' }),
      userRolesRoute(1002, [{ userRoleId: 7010, appUserId: 1002, roleId: 5002 }]),
      userDataScopesRoute(1002, []),
    ]);

    expect(roleCheckbox('SYN-ROLE-01 · 합성 역할 A')).toBeChecked();

    goTo(`${ROUTE}?usr=1002`);

    await waitFor(() => {
      expect(roleCheckbox('SYN-ROLE-02 · 합성 역할 B')).toBeChecked();
    });
    // 앞 사용자의 체크가 남지 않는다.
    expect(roleCheckbox('SYN-ROLE-01 · 합성 역할 A')).not.toBeChecked();
  });

  /**
   * **한 번 본 사용자로 되돌아가는 길**이다. 부여분이 이미 캐시에 있어 「불러오는 중」이
   * 한 번도 지나가지 않는다 — 조회가 비는 순간에 기대는 정리는 이 길을 덮지 못한다.
   * 뒤로가기·주소 손 편집·공유 링크가 밟는다.
   */
  it('이미 본 사용자로 주소를 직접 되돌려도 체크가 그 사용자의 부여분으로 다시 세워진다', async () => {
    const userB: AppUser = { ...filledUserFixture, appUserId: 1002, userName: '합성 사용자 B' };

    const { goTo } = await openRoleAssign([
      userDetailRoute(userB, { etag: 'W/"1002"' }),
      userRolesRoute(1002, [{ userRoleId: 7010, appUserId: 1002, roleId: 5002 }]),
      userDataScopesRoute(1002, []),
    ]);

    // 1002를 한 번 열어 부여분을 캐시에 올린다.
    goTo(`${ROUTE}?usr=1002`);
    await waitFor(() => {
      expect(roleCheckbox('SYN-ROLE-02 · 합성 역할 B')).toBeChecked();
    });

    goTo(`${ROUTE}?usr=1001`);

    await waitFor(() => {
      expect(roleCheckbox('SYN-ROLE-01 · 합성 역할 A')).toBeChecked();
    });
    expect(roleCheckbox('SYN-ROLE-02 · 합성 역할 B')).not.toBeChecked();
  });

  /**
   * 역할 부여와 사용자 정보는 저장 버튼이 서로 다르다. 한쪽을 저장했다고 다른 쪽에서
   * 아직 저장하지 않은 조작이 사라지면 사용자는 자기가 무엇을 잃었는지 모른다.
   */
  it('사용자 정보를 저장해도 아직 저장하지 않은 체크가 남는다', async () => {
    const { requests, user } = await openRoleAssign([roleAssignRoute(), userUpdateRoute()]);

    await user.click(roleCheckbox('SYN-ROLE-02 · 합성 역할 B'));

    await user.type(within(userFormPane()).getByRole('textbox', { name: '이름' }), 'Z');
    await user.click(within(userFormPane()).getByRole('button', { name: '저장' }));

    /*
     * 사용자 저장의 무효화는 이 화면의 사용자 묶음 전체에 걸리므로 **부여분도 실제로 다시 조회된다.**
     * 그 재조회가 일어났음을 먼저 단언해야 「체크가 남았다」가 빈 확인이 되지 않는다.
     */
    await waitFor(() => {
      expect(
        userRolesRequests(requests).filter((request) => request.method === 'GET').length,
      ).toBeGreaterThan(1);
    });

    expect(roleCheckbox('SYN-ROLE-02 · 합성 역할 B')).toBeChecked();
  });
});

describe('UsersRolesScreen 역할 부여 저장 실패', () => {
  const screenErrorRoute = (appUserId = 1001): StubRoute =>
    roleAssignRoute(appUserId, () =>
      jsonResponse(
        { errors: [{ scope: 'screen', code: 'STATE_LOCKED', message: '이 변경은 허용되지 않습니다.' }] },
        { status: 400 },
      ),
    );

  /**
   * 화면이 무엇을 막을지 정하지 않으므로 **이 배너가 사용자가 거부 이유를 아는 유일한 자리**다
   * (계획 결정 4). 삼키면 저장이 조용히 실패한 것처럼 보인다.
   */
  it('서버가 거부하면 화면 수준 오류가 배너로 나온다', async () => {
    const { user } = await openRoleAssign([screenErrorRoute()]);

    await user.click(roleCheckbox('SYN-ROLE-02 · 합성 역할 B'));
    await user.click(within(roleAssignPane()).getByRole('button', { name: '저장' }));

    expect(
      await within(roleAssignPane()).findByText('이 변경은 허용되지 않습니다.'),
    ).toBeInTheDocument();
  });

  /** 실패했다고 서버 값으로 되돌리면 사용자는 자기가 무엇을 하려 했는지 잃는다. */
  it('거부돼도 고친 체크가 그대로 남고 바로 다시 저장할 수 있다', async () => {
    const { requests, user } = await openRoleAssign([screenErrorRoute()]);

    await user.click(roleCheckbox('SYN-ROLE-02 · 합성 역할 B'));
    await user.click(within(roleAssignPane()).getByRole('button', { name: '저장' }));

    await within(roleAssignPane()).findByText('이 변경은 허용되지 않습니다.');

    expect(roleCheckbox('SYN-ROLE-02 · 합성 역할 B')).toBeChecked();

    await user.click(within(roleAssignPane()).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(
        userRolesRequests(requests).filter((request) => request.method === 'PUT'),
      ).toHaveLength(2);
    });
  });
});

/**
 * 이슈 §6이 요구한 두 잠금(자기 자신의 권한 회수 금지 · 마지막 한 사람 회수 금지)을
 * **화면이 판정할 근거가 계약에 하나도 없다** — 지금 로그인한 사람이 누구인지, 어느 역할이
 * 특별한지, 그 역할을 가진 사람이 몇이나 남는지 알려 주는 오퍼레이션이 없다.
 *
 * 그래서 화면은 **아무것도 선제 차단하지 않고** 서버 거부를 옮기기만 한다(계획 결정 4).
 * 이 묶음은 그 「하지 않음」을 고정한다 — 선제 차단을 넣는 것이 곧 결함이다.
 * 선의로 들어오는 결함이라 사람이 검토로 잡기 어려운 자리다.
 */
describe('UsersRolesScreen 역할 부여 — 화면이 잠금을 판정하지 않는다', () => {
  it('사용 중인 역할의 확인칸은 하나도 비활성이 아니다', async () => {
    await openRoleAssign([roleAssignRoute()]);

    expect(roleCheckbox('SYN-ROLE-01 · 합성 역할 A')).toBeEnabled();
    expect(roleCheckbox('SYN-ROLE-02 · 합성 역할 B')).toBeEnabled();
  });

  /** 확인칸만 열어 두고 저장에서 회수를 걸러 내는 갈래는 체크 상태만 봐서는 잡히지 않는다. */
  it('이미 부여된 역할을 풀면 그 회수가 실제로 요청에 실린다', async () => {
    const { requests, user } = await openRoleAssign([roleAssignRoute()]);

    await user.click(roleCheckbox('SYN-ROLE-01 · 합성 역할 A'));
    await user.click(within(roleAssignPane()).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(userRolesRequests(requests).some((request) => request.method === 'PUT')).toBe(true);
    });
    expect(roleAssignBodyOf(requests).roleIds).not.toContain(5001);
  });

  it('부여분이 하나뿐인 사용자도 그 마지막 하나를 풀어 빈 배열을 보낼 수 있다', async () => {
    const { requests, user } = await openRoleAssign([
      roleAssignRoute(),
      userRolesRoute(1001, [{ userRoleId: 7001, appUserId: 1001, roleId: 5001 }]),
    ]);

    await user.click(roleCheckbox('SYN-ROLE-01 · 합성 역할 A'));
    await user.click(within(roleAssignPane()).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(userRolesRequests(requests).some((request) => request.method === 'PUT')).toBe(true);
    });
    expect(roleAssignBodyOf(requests).roleIds).toEqual([]);
  });

  /** 거부를 학습해 그 역할을 잠그면 화면이 서버를 흉내 내기 시작한다. */
  it('서버가 거부해도 화면이 그 역할을 잠그지 않는다', async () => {
    const { user } = await openRoleAssign([
      roleAssignRoute(1001, () =>
        jsonResponse(
          { errors: [{ scope: 'screen', code: 'STATE_LOCKED', message: '이 변경은 허용되지 않습니다.' }] },
          { status: 400 },
        ),
      ),
    ]);

    await user.click(roleCheckbox('SYN-ROLE-01 · 합성 역할 A'));
    await user.click(within(roleAssignPane()).getByRole('button', { name: '저장' }));

    await within(roleAssignPane()).findByText('이 변경은 허용되지 않습니다.');

    expect(roleCheckbox('SYN-ROLE-01 · 합성 역할 A')).toBeEnabled();
    expect(roleCheckbox('SYN-ROLE-02 · 합성 역할 B')).toBeEnabled();
  });
});

const dataScopePane = (): HTMLElement => screen.getByRole('region', { name: '데이터 접근범위' });

const dataScopeRows = (): HTMLElement[] =>
  within(within(dataScopePane()).getByRole('table')).getAllByRole('row').slice(1);

const dataScopeRequests = (requests: RecordedRequest[], appUserId = 1001): RecordedRequest[] =>
  requestsTo(requests, dataScopesPath(appUserId));

const dataScopeBodyOf = (
  requests: RecordedRequest[],
): { scopes?: Record<string, unknown>[] } => {
  const put = dataScopeRequests(requests).find((request) => request.method === 'PUT');

  expect(put).toBeDefined();

  return JSON.parse(put?.body ?? '{}') as { scopes?: Record<string, unknown>[] };
};

const openDataScopes = async (
  extraRoutes: StubRoute[] = [],
  options: { etag?: string | null } = {},
) => {
  const rendered = await openUserDetail(extraRoutes, filledUserFixture, options);

  await screen.findByRole('region', { name: '데이터 접근범위' });
  await waitFor(() => {
    expect(within(dataScopePane()).getByRole('table')).toBeInTheDocument();
  });

  return rendered;
};

const waitForDataScopePut = async (requests: RecordedRequest[]): Promise<void> => {
  await waitFor(() => {
    expect(dataScopeRequests(requests).some((request) => request.method === 'PUT')).toBe(true);
  });
};

describe('UsersRolesScreen 데이터 접근범위', () => {
  it('사용자를 고르면 접근범위를 조회하고 표가 그 결과와 일치한다', async () => {
    const { requests } = await openDataScopes([dataScopeReplaceRoute()]);

    expect(dataScopeRequests(requests).filter((request) => request.method === 'GET')).toHaveLength(1);
    expect(dataScopeRows()).toHaveLength(2);
    expect(
      within(dataScopeRows()[0] as HTMLElement).getByText('SYN-BU-01 · 합성 사업부 A'),
    ).toBeInTheDocument();
  });

  /** 빈 축은 「고르지 않음」이 아니라 그 축 전체를 뜻하는 고른 값이다. */
  it('빈 축이 「(전체)」로 보인다', async () => {
    await openDataScopes([dataScopeReplaceRoute()]);

    expect(within(dataScopeRows()[1] as HTMLElement).getByText('(전체)')).toBeInTheDocument();
  });

  it('고르기 전에는 페인이 없고 접근범위를 조회하지도 않는다', async () => {
    const { requests } = renderScreen([userListRoute(), departmentsRoute()]);

    await waitForUserList(requests);

    expect(screen.queryByRole('region', { name: '데이터 접근범위' })).not.toBeInTheDocument();
    expect(dataScopeRequests(requests)).toHaveLength(0);
  });

  it('등록 중에는 페인이 없다', async () => {
    const { requests } = renderScreen([userListRoute(), departmentsRoute()], '?new=user');

    await waitForUserList(requests);

    expect(screen.queryByRole('region', { name: '데이터 접근범위' })).not.toBeInTheDocument();
  });

  /** 확인이 저장이면 사용자는 창을 닫는 순간 저장된 줄 안다. */
  it('창의 확인은 서버를 부르지 않고 표에만 반영된다', async () => {
    const { requests, user } = await openDataScopes([dataScopeReplaceRoute()]);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const before = requests.length;

    await user.click(within(dataScopePane()).getByRole('button', { name: '범위 추가' }));

    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByLabelText('사업부'));
    await user.click(await screen.findByRole('option', { name: 'SYN-BU-02 · 합성 사업부 B' }));
    await user.click(within(dialog).getByLabelText('공장'));
    await user.click(await screen.findByRole('option', { name: 'SYN-PLT-02 · 합성 공장 B' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '확인' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(dataScopeRows()).toHaveLength(3);
    expect(requests).toHaveLength(before);
  });

  /**
   * 계약의 요청 항목은 두 축뿐이다. **빈 축은 키를 빼지 않고 널을 명시한다** —
   * 여기서 빈 축은 사용자가 고른 「(전체)」다.
   */
  it('저장 본문에 식별자가 없고 빈 축이 널로 실린다', async () => {
    const { requests, user } = await openDataScopes([dataScopeReplaceRoute()]);

    await user.click(
      within(dataScopePane()).getByRole('button', {
        name: 'SYN-BU-01 · 합성 사업부 A · SYN-PLT-01 · 합성 공장 A 범위 삭제',
      }),
    );
    await user.click(within(dataScopePane()).getByRole('button', { name: '저장' }));

    await waitForDataScopePut(requests);

    const scopes = dataScopeBodyOf(requests).scopes ?? [];

    expect(scopes).toEqual([{ businessUnitId: 2002, plantId: null }]);
    expect(Object.keys(scopes[0] ?? {})).toEqual(['businessUnitId', 'plantId']);
  });

  it('저장 요청에 멱등 키가 실리고 잠금 토큰은 실리지 않는다', async () => {
    const { requests, user } = await openDataScopes([dataScopeReplaceRoute()]);

    await user.click(
      within(dataScopePane()).getByRole('button', {
        name: 'SYN-BU-02 · 합성 사업부 B · (전체) 범위 삭제',
      }),
    );
    await user.click(within(dataScopePane()).getByRole('button', { name: '저장' }));

    await waitForDataScopePut(requests);

    const put = dataScopeRequests(requests).find((request) => request.method === 'PUT');

    expect(put?.headers.get('Idempotency-Key')).toMatch(UUID);
    expect(put?.headers.get('If-Match')).toBeNull();
  });

  /** 헤더가 아니라 **저장이 시작조차 하지 않는** 갈래다 — 역할 부여와 같은 자리다. */
  it('상세에 잠금 토큰이 없어도 치환 저장이 그대로 나간다', async () => {
    const { requests, user } = await openDataScopes([dataScopeReplaceRoute()], { etag: null });

    await user.click(
      within(dataScopePane()).getByRole('button', {
        name: 'SYN-BU-02 · 합성 사업부 B · (전체) 범위 삭제',
      }),
    );
    await user.click(within(dataScopePane()).getByRole('button', { name: '저장' }));

    await waitForDataScopePut(requests);
    expect(within(dataScopePane()).queryByText(/최신 정보를 불러오는 중입니다/)).not.toBeInTheDocument();
  });

  /** 전체 회수도 정상 조작이다 — 「보낼 것이 없다」로 요청을 건너뛰면 지울 수가 없다. */
  it('줄을 전부 지우고 저장하면 빈 배열이 실린다', async () => {
    const { requests, user } = await openDataScopes([dataScopeReplaceRoute()]);

    for (const name of [
      'SYN-BU-01 · 합성 사업부 A · SYN-PLT-01 · 합성 공장 A 범위 삭제',
      'SYN-BU-02 · 합성 사업부 B · (전체) 범위 삭제',
    ]) {
      await user.click(within(dataScopePane()).getByRole('button', { name }));
    }

    expect(within(dataScopePane()).getByText('지정된 접근범위가 없습니다')).toBeInTheDocument();

    await user.click(within(dataScopePane()).getByRole('button', { name: '저장' }));

    await waitForDataScopePut(requests);
    expect(dataScopeBodyOf(requests).scopes).toEqual([]);
  });

  it('저장에 성공하면 접근범위를 다시 조회하고 서버가 답한 상태로 다시 세운다', async () => {
    const replaced = [{ userDataScopeId: 9010, appUserId: 1001, businessUnitId: 2002, plantId: null }];
    let served = userDataScopeFixtures;

    const { requests, user } = await openDataScopes([
      {
        match: (request) => isGet(request, dataScopesPath(1001)),
        respond: () => jsonResponse({ items: served }),
      },
      dataScopeReplaceRoute(1001, () => {
        served = replaced;

        return jsonResponse({ items: replaced });
      }),
    ]);

    await user.click(
      within(dataScopePane()).getByRole('button', {
        name: 'SYN-BU-01 · 합성 사업부 A · SYN-PLT-01 · 합성 공장 A 범위 삭제',
      }),
    );
    await user.click(within(dataScopePane()).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(
        dataScopeRequests(requests).filter((request) => request.method === 'GET').length,
      ).toBeGreaterThan(1);
    });
    await waitFor(() => {
      expect(dataScopeRows()).toHaveLength(1);
    });
  });

  /** 역할 부여와 같은 자리다 — 이 치환도 사용자 행과 잠금 토큰을 바꾸지 않는다. */
  it('치환 저장은 접근범위만 다시 조회하고 상세·목록은 다시 부르지 않는다', async () => {
    const { requests, user } = await openDataScopes([dataScopeReplaceRoute()]);

    const scopesBefore = dataScopeRequests(requests).filter((r) => r.method === 'GET').length;
    const detailBefore = detailRequests(requests).length;
    const listBefore = userRequests(requests).length;

    await user.click(
      within(dataScopePane()).getByRole('button', {
        name: 'SYN-BU-02 · 합성 사업부 B · (전체) 범위 삭제',
      }),
    );
    await user.click(within(dataScopePane()).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(dataScopeRequests(requests).filter((r) => r.method === 'GET').length).toBeGreaterThan(
        scopesBefore,
      );
    });

    expect(detailRequests(requests)).toHaveLength(detailBefore);
    expect(userRequests(requests)).toHaveLength(listBefore);
  });

  it('취소는 요청을 보내지 않고 표를 기준값으로 되돌린다', async () => {
    const { requests, user } = await openDataScopes([dataScopeReplaceRoute()]);

    await user.click(
      within(dataScopePane()).getByRole('button', {
        name: 'SYN-BU-02 · 합성 사업부 B · (전체) 범위 삭제',
      }),
    );

    expect(dataScopeRows()).toHaveLength(1);

    const before = requests.length;

    await user.click(within(dataScopePane()).getByRole('button', { name: '취소' }));

    expect(dataScopeRows()).toHaveLength(2);
    expect(requests).toHaveLength(before);
  });

  it('고친 것이 없으면 저장이 비활성이고 사유가 보인다', async () => {
    await openDataScopes([dataScopeReplaceRoute()]);

    expect(within(dataScopePane()).getByRole('button', { name: '저장' })).toBeDisabled();
    expect(within(dataScopePane()).getByText(/저장은 고친 내용이 있을 때/)).toBeInTheDocument();
  });

  it('다른 사용자를 고르면 표가 그 사용자의 접근범위로 다시 세워진다', async () => {
    const userB: AppUser = { ...filledUserFixture, appUserId: 1002, userName: '합성 사용자 B' };

    const { goTo } = await openDataScopes([
      userDetailRoute(userB, { etag: 'W/"1002"' }),
      userRolesRoute(1002, []),
      userDataScopesRoute(1002, [
        { userDataScopeId: 9020, appUserId: 1002, businessUnitId: null, plantId: 4002 },
      ]),
    ]);

    expect(dataScopeRows()).toHaveLength(2);

    goTo(`${ROUTE}?usr=1002`);

    await waitFor(() => {
      expect(dataScopeRows()).toHaveLength(1);
    });
    expect(
      within(dataScopeRows()[0] as HTMLElement).getByText('SYN-PLT-02 · 합성 공장 B'),
    ).toBeInTheDocument();
  });

  /** 한 번 본 사용자로 되돌아가는 길 — 접근범위가 캐시에 있어 조회가 비는 순간이 없다. */
  it('이미 본 사용자로 주소를 직접 되돌려도 표가 그 사용자의 접근범위로 다시 세워진다', async () => {
    const userB: AppUser = { ...filledUserFixture, appUserId: 1002, userName: '합성 사용자 B' };

    const { goTo } = await openDataScopes([
      userDetailRoute(userB, { etag: 'W/"1002"' }),
      userRolesRoute(1002, []),
      userDataScopesRoute(1002, [
        { userDataScopeId: 9020, appUserId: 1002, businessUnitId: null, plantId: 4002 },
      ]),
    ]);

    goTo(`${ROUTE}?usr=1002`);
    await waitFor(() => {
      expect(dataScopeRows()).toHaveLength(1);
    });

    goTo(`${ROUTE}?usr=1001`);

    await waitFor(() => {
      expect(dataScopeRows()).toHaveLength(2);
    });
    expect(
      within(dataScopeRows()[0] as HTMLElement).getByText('SYN-BU-01 · 합성 사업부 A'),
    ).toBeInTheDocument();
  });

  /** 초안이 사라진 뒤에 창만 남으면 그 창의 확인이 어느 줄을 고치는 것인지 알 수 없다. */
  it('창을 연 채 다른 사용자로 옮기면 창이 닫힌다', async () => {
    const userB: AppUser = { ...filledUserFixture, appUserId: 1002, userName: '합성 사용자 B' };

    const { goTo, user } = await openDataScopes([
      userDetailRoute(userB, { etag: 'W/"1002"' }),
      userRolesRoute(1002, []),
      userDataScopesRoute(1002, []),
    ]);

    await user.click(within(dataScopePane()).getByRole('button', { name: '범위 추가' }));
    await screen.findByRole('dialog');

    goTo(`${ROUTE}?usr=1002`);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

describe('UsersRolesScreen 데이터 접근범위 — 만들 수 없는 줄', () => {
  /**
   * 계약의 `ck_user_data_scope_target`이 두 축 중 하나 이상을 요구한다.
   * **목 서버는 둘 다 널인 본문에도 200을 준다** — 화면이 막지 않으면
   * 실서버에 붙기 전까지 아무도 이 결함을 보지 못한다.
   */
  it('두 축이 모두 비면 확인이 비활성이고 줄이 만들어지지 않으며 요청도 나가지 않는다', async () => {
    const { requests, user } = await openDataScopes([dataScopeReplaceRoute()]);

    const before = requests.length;

    await user.click(within(dataScopePane()).getByRole('button', { name: '범위 추가' }));

    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByRole('button', { name: '확인' })).toBeDisabled();
    expect(
      within(dialog).getByText('확인은 사업부와 공장 중 적어도 하나를 고른 뒤에 누를 수 있습니다.'),
    ).toBeInTheDocument();
    expect(dataScopeRows()).toHaveLength(2);
    expect(requests).toHaveLength(before);
  });

  /** 유일 제약이 빈 축을 접어 판정한다 — 사업부만 고른 두 줄은 서버에게 같은 짝이다. */
  it('이미 있는 범위와 겹치는 줄은 확인이 비활성이다', async () => {
    const { user } = await openDataScopes([dataScopeReplaceRoute()]);

    await user.click(within(dataScopePane()).getByRole('button', { name: '범위 추가' }));

    const dialog = await screen.findByRole('dialog');

    // 이미 「합성 사업부 B · (전체)」 줄이 있다 — 빈 공장은 0으로 접혀 같은 짝이 된다.
    await user.click(within(dialog).getByLabelText('사업부'));
    await user.click(await screen.findByRole('option', { name: 'SYN-BU-02 · 합성 사업부 B' }));

    expect(within(screen.getByRole('dialog')).getByRole('button', { name: '확인' })).toBeDisabled();
    expect(
      within(screen.getByRole('dialog')).getByText(/이미 있는 범위와 겹치지 않을 때/),
    ).toBeInTheDocument();
  });

  it('겹치지 않는 짝으로 고치면 확인이 다시 열린다', async () => {
    const { user } = await openDataScopes([dataScopeReplaceRoute()]);

    await user.click(within(dataScopePane()).getByRole('button', { name: '범위 추가' }));

    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByLabelText('사업부'));
    await user.click(await screen.findByRole('option', { name: 'SYN-BU-02 · 합성 사업부 B' }));
    await user.click(within(screen.getByRole('dialog')).getByLabelText('공장'));
    await user.click(await screen.findByRole('option', { name: 'SYN-PLT-02 · 합성 공장 B' }));

    expect(within(screen.getByRole('dialog')).getByRole('button', { name: '확인' })).toBeEnabled();
  });
});

describe('UsersRolesScreen 데이터 접근범위 저장 실패', () => {
  const rejectRoute = (code: string, message: string): StubRoute =>
    dataScopeReplaceRoute(1001, () =>
      jsonResponse({ errors: [{ scope: 'screen', code, message }] }, { status: 400 }),
    );

  /** 서버가 백스톱으로 막는 자리다 — 화면이 삼키면 저장이 조용히 실패한 것처럼 보인다. */
  it('서버가 거부하면 배너가 서고 표의 줄이 사라지지 않는다', async () => {
    const { user } = await openDataScopes([rejectRoute('PAIR', '범위를 확인하세요.')]);

    await user.click(
      within(dataScopePane()).getByRole('button', {
        name: 'SYN-BU-02 · 합성 사업부 B · (전체) 범위 삭제',
      }),
    );
    await user.click(within(dataScopePane()).getByRole('button', { name: '저장' }));

    expect(await within(dataScopePane()).findByText('범위를 확인하세요.')).toBeInTheDocument();
    // 사용자가 지운 줄이 되살아나지 않는다 — 실패에 초안을 되돌리면 한 일을 잃는다.
    expect(dataScopeRows()).toHaveLength(1);
  });

  it('거부된 뒤에도 바로 다시 저장할 수 있다', async () => {
    const { requests, user } = await openDataScopes([
      rejectRoute('UNIQUE_VIOLATION', '이미 있는 범위입니다.'),
    ]);

    await user.click(
      within(dataScopePane()).getByRole('button', {
        name: 'SYN-BU-02 · 합성 사업부 B · (전체) 범위 삭제',
      }),
    );
    await user.click(within(dataScopePane()).getByRole('button', { name: '저장' }));

    await within(dataScopePane()).findByText('이미 있는 범위입니다.');

    await user.click(within(dataScopePane()).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(
        dataScopeRequests(requests).filter((request) => request.method === 'PUT'),
      ).toHaveLength(2);
    });
  });
});
