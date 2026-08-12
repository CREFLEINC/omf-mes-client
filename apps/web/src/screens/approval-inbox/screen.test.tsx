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
import { pickRange } from '../../test/date-picker';
import { SECOND_LINE_OF_MULTILINE_REASON, requestFixtures } from './fixtures';
import { ApprovalInboxScreen } from './screen';

const t = messages.approvalInbox;

const ROUTE = '/approval/inbox';
const REQUESTS_PATH = '/app/approval-requests';

interface RecordedRequest {
  method: string;
  url: URL;
}

/**
 * 요청을 기록하면서 스텁 규칙으로 응답한다. 규칙에 없는 요청은 하네스가 던져 스텁 누락을 드러낸다.
 *
 * **경로를 가리지 않고 전부 기록한다** — 「부르지 않았다」를 증명하려면 잘못된 경로로 나간
 * 요청도 잡혀야 한다.
 */
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

/**
 * 대기 건수 조회인가. **목록과 같은 경로를 쓰지만 `size`를 싣는 것이 다르다** —
 * 목록은 서버 기본값을 쓰므로 `size`를 싣지 않는다(`filters.ts`).
 *
 * 두 조회를 갈라 세어야 「목록을 1회 불렀다」와 「건수를 1회 불렀다」가 서로를 가리지 않는다.
 */
const isCountUrl = (url: URL): boolean =>
  url.pathname === REQUESTS_PATH && url.searchParams.has('size');

const isListUrl = (url: URL): boolean =>
  url.pathname === REQUESTS_PATH && !url.searchParams.has('size');

/** 상세 경로로 **나간 요청 전부**. 번호 자리가 무엇이든 센다 — 잘못된 경로도 「부르지 않았다」를 깬다. */
const isDetailPath = (pathname: string): boolean =>
  /^\/app\/approval-requests\/[^/]+$/.test(pathname);

const listRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => isListUrl(request.url));
const countRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => isCountUrl(request.url));
const detailRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => isDetailPath(request.url.pathname));
/** 쓰기로 나간 요청 전부. **경로를 가리지 않고 센다** — 잘못된 경로로 나간 쓰기도 잡아야 한다. */
const writeRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.method !== 'GET');

const lastListQuery = (requests: RecordedRequest[]): URLSearchParams | undefined =>
  listRequests(requests).at(-1)?.url.searchParams;

const listBody = (
  items: unknown[],
  page: Partial<{ page: number; size: number; total: number }> = {},
) => ({ items, page: { page: 1, size: 20, total: items.length, ...page } });

const listRoute = (
  items: unknown[] = requestFixtures,
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => request.method === 'GET' && isListUrl(new URL(request.url)),
  respond: () => jsonResponse(listBody(items, page)),
});

const failingListRoute = (status = 500): StubRoute => ({
  match: (request) => request.method === 'GET' && isListUrl(new URL(request.url)),
  respond: () => jsonResponse({ message: '' }, { status }),
});

/** 대기 건수. **본문은 한 건만 온다** — 화면이 읽는 것은 `page.total`뿐이다. */
const countRoute = (total = 0): StubRoute => ({
  match: (request) => request.method === 'GET' && isCountUrl(new URL(request.url)),
  respond: () => jsonResponse({ items: [], page: { page: 1, size: 1, total } }),
});

/**
 * 상세. **어느 번호로 불러도 응답한다** — 「부르지 않았다」를 증명하려면 부를 수 있는
 * 스텁이 있어야 한다.
 */
const detailRoute = (): StubRoute => ({
  match: (request) => isDetailPath(new URL(request.url).pathname),
  respond: () => jsonResponse({ request: requestFixtures[0], steps: [] }),
});

const defaultRoutes = (total = 0): StubRoute[] => [listRoute(), countRoute(total), detailRoute()];

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

/** 한 칸 뒤로 간다. **히스토리가 몇 칸 늘었는지를 판정하는 유일한 수단**이다. */
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
      <ApprovalInboxScreen />
      <LocationProbe />
      <BackProbe />
      <SearchProbe to={navigateTo} />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, user: userEvent.setup() };
};

const currentLocation = (): string => screen.getByTestId('location').textContent ?? '';

const requestTable = (): HTMLElement => screen.getByRole('table');

const tabFor = (label: string): HTMLElement => screen.getByRole('tab', { name: new RegExp(label) });

const waitForList = async (): Promise<void> => {
  await screen.findByText('SYNTH-REQ-001');
};

describe('첫 진입', () => {
  it('목록과 대기 건수를 한 번씩 부른다', async () => {
    const { requests } = renderScreen(defaultRoutes(3));

    await waitForList();

    await waitFor(() => {
      expect(countRequests(requests)).toHaveLength(1);
    });
    expect(listRequests(requests)).toHaveLength(1);
  });

  it('기본 탭이 「내 결재 대기」이고 계약이 그 탭이라 적은 조합을 싣는다', async () => {
    const { requests } = renderScreen(defaultRoutes());

    await waitForList();

    const query = lastListQuery(requests);

    expect(query?.get('assignedToMe')).toBe('true');
    expect(query?.get('pendingOnly')).toBe('true');
    expect(query?.get('requestedByMe')).toBeNull();
    /* 대기 건수의 조건이 목록에 새지 않는다 — 두 수는 근거가 다르다. */
    expect(query?.get('myTurnOnly')).toBeNull();
    expect(tabFor(t.tabs.pending)).toHaveAttribute('aria-selected', 'true');
  });

  it('조건이 없으면 조건을 싣지 않는다 — 생략이 곧 「거르지 않음」이다', async () => {
    const { requests } = renderScreen(defaultRoutes());

    await waitForList();

    expect([...(lastListQuery(requests)?.keys() ?? [])].sort()).toEqual([
      'assignedToMe',
      'pendingOnly',
    ]);
  });

  it('목록 값이 화면에 보인다', async () => {
    renderScreen(defaultRoutes());

    await waitForList();

    expect(within(requestTable()).getByText('합성 대상 문서 나')).toBeInTheDocument();
    /* 사유는 첫 줄만 온다 — 전문이 새면 여기서 드러난다. */
    expect(screen.queryByText(SECOND_LINE_OF_MULTILINE_REASON)).not.toBeInTheDocument();
  });
});

describe('탭', () => {
  it('「내가 올린 것」으로 옮기면 축이 바뀐다', async () => {
    const { requests, user } = renderScreen(defaultRoutes());

    await waitForList();
    await user.click(tabFor(t.tabs.requested));

    await waitFor(() => {
      expect(listRequests(requests)).toHaveLength(2);
    });

    const query = lastListQuery(requests);

    expect(query?.get('requestedByMe')).toBe('true');
    expect(query?.get('assignedToMe')).toBeNull();
    expect(query?.get('pendingOnly')).toBeNull();
    expect(currentLocation()).toContain('tab=requested');
  });

  it('탭 전환이 쪽과 고른 요청을 비운다', async () => {
    const { user } = renderScreen(defaultRoutes(), '?page=3&rq=9001');

    await waitForList();
    await user.click(tabFor(t.tabs.requested));

    await waitFor(() => {
      expect(currentLocation()).toContain('tab=requested');
    });
    expect(currentLocation()).not.toContain('page=');
    expect(currentLocation()).not.toContain('rq=');
  });

  it('탭 전환 한 번에 히스토리가 한 칸만 늘어난다', async () => {
    const { user } = renderScreen(defaultRoutes(), '?page=3');

    await waitForList();
    await user.click(tabFor(t.tabs.requested));

    await waitFor(() => {
      expect(currentLocation()).toContain('tab=requested');
    });

    // 한 칸만 늘었으면 뒤로 한 번에 처음 주소로 돌아온다.
    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?page=3`);
    });
  });

  it('「전체」 탭을 그리지 않는다', async () => {
    renderScreen(defaultRoutes());

    await waitForList();

    /* 선행 단언 — 그릴 탭이 실제로 있어야 「없다」가 뜻을 갖는다. */
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.queryByRole('tab', { name: new RegExp(t.tabs.all) })).not.toBeInTheDocument();
  });

  it('주소로 「전체」를 가리켜도 조건 없는 조회가 나가지 않는다', async () => {
    const { requests } = renderScreen(defaultRoutes(), '?tab=all');

    await waitForList();

    const query = lastListQuery(requests);

    expect(query?.get('assignedToMe')).toBe('true');
    expect(tabFor(t.tabs.pending)).toHaveAttribute('aria-selected', 'true');
  });
});

describe('대기 건수', () => {
  it('전용 조회로 한 번만 부르고 크기를 1로 싣는다', async () => {
    const { requests } = renderScreen(defaultRoutes(3));

    await waitForList();

    await waitFor(() => {
      expect(countRequests(requests)).toHaveLength(1);
    });

    const query = countRequests(requests)[0]?.url.searchParams;

    expect(query?.get('myTurnOnly')).toBe('true');
    expect(query?.get('size')).toBe('1');
  });

  it('뱃지가 전용 조회의 전체 건수를 낸다 — 쪽 안의 행 수를 세지 않는다', async () => {
    renderScreen(defaultRoutes(7));

    await waitForList();

    /* 목록은 4건인데 대기는 7건이다. 행을 세면 4가 나온다. */
    expect(await screen.findByLabelText(t.tabs.pendingBadge(7))).toHaveTextContent('7');
  });

  it('0건이면 뱃지를 내지 않는다', async () => {
    renderScreen(defaultRoutes(0));

    await waitForList();

    await waitFor(() => {
      expect(screen.queryByLabelText(t.tabs.pendingBadge(0))).not.toBeInTheDocument();
    });
    expect(tabFor(t.tabs.pending)).toHaveTextContent(t.tabs.pending);
  });

  it('99를 넘으면 줄여 내되 접근 이름은 실제 수를 말한다', async () => {
    renderScreen(defaultRoutes(120));

    await waitForList();

    expect(await screen.findByLabelText(t.tabs.pendingBadge(120))).toHaveTextContent('99+');
  });

  it('탭을 옮겨도 같은 값이다 — 지금 보지 않는 곳의 대기를 알리는 것이 뱃지의 목적이다', async () => {
    const { user } = renderScreen(defaultRoutes(7));

    await waitForList();
    await user.click(tabFor(t.tabs.requested));

    expect(await screen.findByLabelText(t.tabs.pendingBadge(7))).toBeInTheDocument();
  });
});

describe('조회 조건', () => {
  it('조건이 주소와 요청에 함께 실린다', async () => {
    const { requests, user } = renderScreen(defaultRoutes());

    await waitForList();

    await user.type(screen.getByLabelText(t.fields.q), 'SYNTH-REQ-002');
    await pickRange(user, screen.getByLabelText(t.fields.period), '2026-07-20', '2026-07-25');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(listRequests(requests).length).toBeGreaterThan(1);
    });

    expect(currentLocation()).toContain('q=SYNTH-REQ-002');
    expect(currentLocation()).toContain('from=2026-07-20');

    const query = lastListQuery(requests);

    expect(query?.get('q')).toBe('SYNTH-REQ-002');
    expect(query?.get('requestedAtFrom')).toBe('2026-07-20');
    expect(query?.get('requestedAtTo')).toBe('2026-07-25');
  });

  it('주소로 들어오면 같은 조건으로 조회한다', async () => {
    const { requests } = renderScreen(
      defaultRoutes(),
      '?ty=SAMPLE-TYPE-A&st=SAMPLE-STATUS-OPEN&q=SYNTH',
    );

    await waitForList();

    const query = lastListQuery(requests);

    expect(query?.get('approvalTypeCode')).toBe('SAMPLE-TYPE-A');
    expect(query?.get('statusCode')).toBe('SAMPLE-STATUS-OPEN');
    expect(query?.get('q')).toBe('SYNTH');
  });

  it('조건 변경이 첫 쪽으로 되돌리고 고른 요청을 비운다', async () => {
    const { user } = renderScreen(defaultRoutes(), '?page=2&rq=9001');

    await waitForList();

    await user.type(screen.getByLabelText(t.fields.q), 'SYNTH');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(currentLocation()).toContain('q=SYNTH');
    });
    expect(currentLocation()).not.toContain('page=');
    expect(currentLocation()).not.toContain('rq=');
  });

  it('초기화가 조건을 비운다', async () => {
    const { user } = renderScreen(defaultRoutes(), '?q=SYNTH&ty=SAMPLE-TYPE-A&page=2');

    await waitForList();
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  it('조건 칩의 ×가 그 조건만 푼다', async () => {
    const { user } = renderScreen(defaultRoutes(), '?q=SYNTH&from=2026-08-01&to=2026-08-31');

    await waitForList();
    await user.click(screen.getByRole('button', { name: t.filters.chipRemovePeriod }));

    await waitFor(() => {
      expect(currentLocation()).not.toContain('from=');
    });
    expect(currentLocation()).not.toContain('to=');
    expect(currentLocation()).toContain('q=SYNTH');
  });

  it('뜻이 없는 주소 값은 요청에 실리지 않는다', async () => {
    const { requests } = renderScreen(
      defaultRoutes(),
      '?page=abc&rq=xyz&from=2026-02-31&to=&q=%20%20',
    );

    await waitForList();

    const query = lastListQuery(requests);

    expect(query?.get('page')).toBeNull();
    expect(query?.get('requestedAtFrom')).toBeNull();
    expect(query?.get('requestedAtTo')).toBeNull();
    expect(query?.get('q')).toBeNull();
  });
});

describe('쪽 이동', () => {
  it('쪽만 옮기고 고른 요청을 비운다', async () => {
    const { requests, user } = renderScreen(
      [listRoute(requestFixtures, { total: 120 }), countRoute(), detailRoute()],
      '?q=SYNTH&rq=9001',
    );

    await waitForList();
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(currentLocation()).toContain('page=2');
    });
    expect(currentLocation()).toContain('q=SYNTH');
    expect(currentLocation()).not.toContain('rq=');
    expect(lastListQuery(requests)?.get('page')).toBe('2');
  });
});

describe('요청 고르기', () => {
  it('요청번호를 누르면 주소에 실리고 안내가 사라진다', async () => {
    const { user } = renderScreen(defaultRoutes());

    await waitForList();

    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /SYNTH-REQ-001/ }));

    await waitFor(() => {
      expect(currentLocation()).toContain('rq=9001');
    });
    expect(screen.queryByText(t.empty.noSelectionTitle)).not.toBeInTheDocument();
  });

  it('같은 요청을 다시 누르면 선택이 풀린다', async () => {
    const { user } = renderScreen(defaultRoutes(), '?rq=9001');

    await waitForList();
    await user.click(screen.getByRole('button', { name: /SYNTH-REQ-001/ }));

    await waitFor(() => {
      expect(currentLocation()).not.toContain('rq=');
    });
  });

  it('고르는 것이 보이는 행을 바꾸지 않는다', async () => {
    const { requests, user } = renderScreen(defaultRoutes(), '?page=2&q=SYNTH');

    await waitForList();

    const before = listRequests(requests).length;

    await user.click(screen.getByRole('button', { name: /SYNTH-REQ-001/ }));

    await waitFor(() => {
      expect(currentLocation()).toContain('rq=9001');
    });
    expect(currentLocation()).toContain('page=2');
    expect(listRequests(requests)).toHaveLength(before);
  });

  it('이 회차에는 상세를 부르지 않는다 — 골라도 마찬가지다', async () => {
    const { requests, user } = renderScreen(defaultRoutes());

    await waitForList();
    await user.click(screen.getByRole('button', { name: /SYNTH-REQ-001/ }));

    await waitFor(() => {
      expect(currentLocation()).toContain('rq=9001');
    });
    expect(detailRequests(requests)).toHaveLength(0);
  });
});

describe('빈 상태와 조회 실패', () => {
  it('결과가 없으면 표의 빈 자리가 맡는다', async () => {
    renderScreen([listRoute([]), countRoute(), detailRoute()]);

    expect(await screen.findByText(t.empty.noResultTitle)).toBeInTheDocument();
    /* 바깥에서 0건을 가르면 표의 빈 자리가 닿을 수 없는 가지가 된다. */
    expect(requestTable()).toBeInTheDocument();
  });

  it('쪽 밖은 결과 없음과 다른 안내다', async () => {
    renderScreen([listRoute([], { page: 9, total: 45 }), countRoute(), detailRoute()], '?page=9');

    expect(await screen.findByText(t.empty.beyondLastTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
  });

  it('고르기 전에는 아래 구획이 고르라고 안내한다', async () => {
    renderScreen(defaultRoutes());

    await waitForList();

    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  it('조회 실패는 빈 상태가 아니다', async () => {
    renderScreen([failingListRoute(), countRoute(), detailRoute()]);

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('실패해도 조건 줄과 탭은 남는다 — 조건을 고칠 수단이 사라지면 안 된다', async () => {
    renderScreen([failingListRoute(), countRoute(), detailRoute()]);

    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.getByRole('button', { name: messages.common.search })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('다시 시도를 누르면 그 경로의 요청 수가 는다', async () => {
    const { requests, user } = renderScreen([failingListRoute(), countRoute(), detailRoute()]);

    await screen.findByText(messages.httpError.loadTitle);

    const before = listRequests(requests).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(listRequests(requests).length).toBe(before + 1);
    });
  });

  it('권한 없음에는 다시 시도를 내지 않는다', async () => {
    renderScreen([failingListRoute(403), countRoute(), detailRoute()]);

    expect(await screen.findByText(messages.httpError.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });
});

describe('다시 조회', () => {
  it('목록과 대기 건수를 함께 부른다 — 한쪽만 부르면 갱신된 값과 낡은 값이 섞인다', async () => {
    const { requests, user } = renderScreen(defaultRoutes(3));

    await waitForList();
    await waitFor(() => {
      expect(countRequests(requests)).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: t.actions.reload }));

    await waitFor(() => {
      expect(listRequests(requests)).toHaveLength(2);
    });
    expect(countRequests(requests)).toHaveLength(2);
  });

  it('아무 조건도 비우지 않는다 — 새로고침이 조건 변경으로 둔갑하면 안 된다', async () => {
    const { user } = renderScreen(defaultRoutes(), '?q=SYNTH&page=2&rq=9001');

    await waitForList();
    await user.click(screen.getByRole('button', { name: t.actions.reload }));

    expect(currentLocation()).toBe(`${ROUTE}?q=SYNTH&page=2&rq=9001`);
  });
});

describe('이 회차의 경계', () => {
  it('어떤 쓰기 요청도 보내지 않는다', async () => {
    const { requests, user } = renderScreen(defaultRoutes(3));

    await waitForList();

    await user.click(tabFor(t.tabs.requested));
    await user.click(screen.getByRole('button', { name: messages.common.search }));
    await user.click(screen.getByRole('button', { name: t.actions.reload }));

    await waitFor(() => {
      expect(listRequests(requests).length).toBeGreaterThan(1);
    });

    expect(writeRequests(requests)).toHaveLength(0);
    for (const request of requests) expect(request.method).toBe('GET');
  });

  it('선택지가 비어도 조회·탭 전환·쪽 이동이 열려 있다', async () => {
    const { requests, user } = renderScreen([
      listRoute(requestFixtures, { total: 120 }),
      countRoute(),
      detailRoute(),
    ]);

    await waitForList();

    expect(screen.getAllByText(messages.pendingCode.note).length).toBe(2);

    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(lastListQuery(requests)?.get('page')).toBe('2');
    });

    await user.click(tabFor(t.tabs.requested));

    await waitFor(() => {
      expect(lastListQuery(requests)?.get('requestedByMe')).toBe('true');
    });
  });
});
