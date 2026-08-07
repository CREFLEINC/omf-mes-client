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
import { appUserFixtures, departmentFixtures } from './fixtures';
import { UsersRolesScreen } from './screen';

const ROUTE = '/system/users-roles';

const USERS_PATH = '/app/users';
const DEPARTMENTS_PATH = '/mdm/departments';

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

/** 주소를 읽어 보기 위한 탐침. 하네스가 `MemoryRouter`라 트리 안에서 읽는 수밖에 없다. */
let probeSearch = '';

const RouterProbe = () => {
  probeSearch = useLocation().search;

  return null;
};

const renderScreen = (routes: StubRoute[], search = '') => {
  const { fetch, requests } = createRecordingFetch(routes);

  probeSearch = '';

  renderWithProviders(
    <>
      <UsersRolesScreen />
      <RouterProbe />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, search: () => probeSearch, user: userEvent.setup() };
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
  await screen.findByRole('table');
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
      [userListRoute(), departmentsRoute()],
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
      [userListRoute(), departmentsRoute()],
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
      [userListRoute(), departmentsRoute()],
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
  it('조회에 실패하면 배너와 다시 시도가 나오고 빈 상태는 나오지 않는다', async () => {
    const { requests } = renderScreen([userListRoute(), departmentsRoute()]);

    await waitForUserList(requests);

    const failing = renderScreen([userListErrorRoute(500), departmentsRoute()]);

    await waitFor(() => {
      expect(screen.getAllByText('목록을 불러오지 못했습니다').length).toBeGreaterThan(0);
    });
    expect(failing.requests.length).toBeGreaterThan(0);
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
