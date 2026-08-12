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
import {
  SECOND_LINE_OF_MULTILINE_REASON,
  contradictoryMyTurnDetail,
  contradictoryNotMyTurnDetail,
  finishedDetail,
  noScreenIdTargetDetail,
  outOfListDetail,
  requestFixtures,
  stalledDetail,
} from './fixtures';
import { ApprovalInboxScreen } from './screen';
import type { ApprovalRequestDetail } from './types';

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

/**
 * 목록. **방법을 가리지 않고 응답한다** — 「쓰기를 보내지 않았다」를 증명하려면 쓰기가
 * 나갔을 때 그것이 **기록되고 응답까지 받아야** 한다. 방법으로 거르면 잘못 나간 쓰기가
 * 스텁 누락으로 터져, 감지기가 잰 것이 「쓰기가 없다」가 아니라 「스텁이 없다」가 된다.
 */
const listRoute = (
  items: unknown[] = requestFixtures,
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isListUrl(new URL(request.url)),
  respond: () => jsonResponse(listBody(items, page)),
});

const failingListRoute = (status = 500): StubRoute => ({
  match: (request) => isListUrl(new URL(request.url)),
  respond: () => jsonResponse({ message: '' }, { status }),
});

/** 대기 건수. **본문은 한 건만 온다** — 화면이 읽는 것은 `page.total`뿐이다. */
const countRoute = (total = 0): StubRoute => ({
  match: (request) => isCountUrl(new URL(request.url)),
  respond: () => jsonResponse({ items: [], page: { page: 1, size: 1, total } }),
});

/**
 * 상세. **어느 번호로 불러도 응답한다** — 「부르지 않았다」를 증명하려면 부를 수 있는
 * 스텁이 있어야 한다. 방법도 가리지 않는다: 쓰기가 잘못 나가면 스텁 누락이 아니라
 * 「쓰기가 나갔다」로 잡혀야 한다.
 */
const detailRoute = (detail: ApprovalRequestDetail = contradictoryMyTurnDetail): StubRoute => ({
  match: (request) => isDetailPath(new URL(request.url).pathname),
  respond: () => jsonResponse(detail),
});

const failingDetailRoute = (status: number): StubRoute => ({
  match: (request) => isDetailPath(new URL(request.url).pathname),
  respond: () => jsonResponse({ message: '' }, { status }),
});

const defaultRoutes = (total = 0): StubRoute[] => [listRoute(), countRoute(total), detailRoute()];

/** 고른 요청 구획. 어떤 갈래에서도 **이 구획 자체는 늘 선다**. */
const detailPane = (): HTMLElement => screen.getByRole('region', { name: t.panes.detail });

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

/**
 * 목록이 도착할 때까지 기다린다.
 *
 * **표 안에서 찾는다** — 같은 요청번호가 아래 구획에도 서므로, 화면 전체에서 찾으면
 * 「목록이 왔다」와 「상세가 왔다」가 서로를 가린다.
 */
const waitForList = async (): Promise<void> => {
  await waitFor(() => {
    expect(within(requestTable()).getByText('SYNTH-REQ-001')).toBeInTheDocument();
  });
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

    const table = within(requestTable());

    expect(table.getByText('SAMPLE-TYPE-B')).toBeInTheDocument();
    expect(table.getAllByText('합성 상신자1').length).toBe(2);
    /* 상신 일시는 **시각까지** 보인다 — 날짜만 그리면 여기서 멈춘다. */
    expect(table.getByText('2026-08-06 14:20')).toBeInTheDocument();
    /* 사유는 첫 줄만 온다 — 전문이 새면 여기서 드러난다. */
    expect(screen.queryByText(SECOND_LINE_OF_MULTILINE_REASON)).not.toBeInTheDocument();
  });

  /**
   * 확정 필드 목록을 화면 수준에서도 고정한다 — 부품 시험만으로는 컨테이너가 다른 표를
   * 끼워 넣어도 드러나지 않는다.
   */
  it('목록이 확정된 여섯 열로만 그려진다', async () => {
    renderScreen(defaultRoutes());

    await waitForList();

    const headers = within(requestTable())
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);

    expect(headers).toEqual([
      t.fields.approvalRequestNo,
      t.fields.approvalTypeCode,
      t.fields.requestedByName,
      t.fields.requestedAt,
      t.fields.status,
      t.fields.reason,
    ]);
    /* 대상 표시명은 응답에 실려 오지만 목록의 값이 아니다. */
    expect(within(requestTable()).queryByText('합성 대상 문서 나')).not.toBeInTheDocument();
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

  /*
   * 수명 표 3행의 「조건 유지」. 탭은 「누구의 것인가」이고 조건은 「무엇인가」다 —
   * 축을 바꿨다고 방금 좁힌 범위를 버리면 사용자가 같은 조건을 다시 친다.
   */
  it('탭을 옮겨도 조건은 그대로다', async () => {
    const { requests, user } = renderScreen(defaultRoutes(), '?q=SYNTH&ty=SAMPLE-TYPE-A');

    await waitForList();
    await user.click(tabFor(t.tabs.requested));

    await waitFor(() => {
      expect(lastListQuery(requests)?.get('requestedByMe')).toBe('true');
    });

    expect(currentLocation()).toContain('q=SYNTH');
    expect(lastListQuery(requests)?.get('q')).toBe('SYNTH');
    expect(lastListQuery(requests)?.get('approvalTypeCode')).toBe('SAMPLE-TYPE-A');
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

  /*
   * 수명 표 1·2행의 「탭 유지」. 조건은 탭 안에서 좁히는 것이라, 조건을 고쳤다고 보던 자리가
   * 바뀌면 사용자가 남의 결재함으로 튕겨 나간다.
   */
  it('조건을 바꾸거나 초기화해도 보고 있던 탭은 그대로다', async () => {
    const { requests, user } = renderScreen(defaultRoutes(), '?tab=requested&q=SYNTH');

    await waitForList();
    await user.type(screen.getByLabelText(t.fields.q), '-002');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(currentLocation()).toContain('q=SYNTH-002');
    });
    expect(currentLocation()).toContain('tab=requested');

    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?tab=requested`);
    });
    expect(lastListQuery(requests)?.get('requestedByMe')).toBe('true');
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

  it('식별자가 아닌 고른 요청 번호로는 상세를 부르지 않는다', async () => {
    const { requests } = renderScreen(defaultRoutes(), '?rq=xyz');

    await waitForList();

    /* 짝 방향 — 목록은 실제로 나갔다. */
    expect(listRequests(requests)).toHaveLength(1);
    expect(detailRequests(requests)).toHaveLength(0);
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeVisible();
  });
});

describe('쪽 이동', () => {
  /**
   * **서버가 준 쪽이 정본이다.**
   *
   * 주소의 쪽 번호를 표시에 쓰면 서버가 다른 쪽을 돌려줬을 때(범위 밖 요청을 서버가 잘라
   * 첫 쪽을 주는 경우 등) **표시와 내용이 어긋난다** — 사용자는 5쪽을 보고 있다고 읽는데
   * 화면에는 1쪽의 행이 서 있다. 계산은 `pagination.ts`가 이미 재므로 여기서는
   * **컨테이너가 어느 쪽을 넘기는가**(배선)를 잰다.
   */
  it('주소의 쪽과 서버가 준 쪽이 다르면 서버 쪽으로 읽힌다', async () => {
    renderScreen(
      [listRoute(requestFixtures, { page: 1, size: 20, total: 45 }), countRoute(), detailRoute()],
      '?page=5',
    );

    await waitForList();

    /* 서버가 첫 쪽을 줬으므로 범위도 첫 쪽의 것이고 이전으로 갈 수 없다. */
    expect(screen.getByText('1–4 / 전체 45건')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.prevPage })).toBeDisabled();
  });

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

  /* 수명 표 4행의 「탭 유지」. 쪽은 지금 보고 있는 목록 안의 자리다. */
  it('쪽을 옮겨도 보고 있던 탭은 그대로다', async () => {
    const { requests, user } = renderScreen(
      [listRoute(requestFixtures, { total: 120 }), countRoute(), detailRoute()],
      '?tab=requested',
    );

    await waitForList();
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(currentLocation()).toContain('page=2');
    });
    expect(currentLocation()).toContain('tab=requested');
    expect(lastListQuery(requests)?.get('requestedByMe')).toBe('true');
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
    const { requests, user } = renderScreen(defaultRoutes(), '?tab=requested&page=2&q=SYNTH');

    await waitForList();

    const before = listRequests(requests).length;

    await user.click(screen.getByRole('button', { name: /SYNTH-REQ-001/ }));

    await waitFor(() => {
      expect(currentLocation()).toContain('rq=9001');
    });
    /* 조건·탭·쪽 셋 다 그대로다 — 고르기는 목록을 다시 부르지 않는다(수명 표 5행). */
    expect(currentLocation()).toContain('page=2');
    expect(currentLocation()).toContain('tab=requested');
    expect(currentLocation()).toContain('q=SYNTH');
    expect(listRequests(requests)).toHaveLength(before);
  });

  it('고르기 전에는 상세를 부르지 않는다 — 경로를 가리지 않고 센다', async () => {
    const { requests } = renderScreen(defaultRoutes(3));

    await waitForList();
    await waitFor(() => {
      expect(countRequests(requests)).toHaveLength(1);
    });

    expect(detailRequests(requests)).toHaveLength(0);
  });

  it('고르면 그 요청의 상세를 한 번 부른다', async () => {
    const { requests, user } = renderScreen(defaultRoutes());

    await waitForList();
    await user.click(screen.getByRole('button', { name: /SYNTH-REQ-001/ }));

    await waitFor(() => {
      expect(detailRequests(requests)).toHaveLength(1);
    });
    expect(detailRequests(requests)[0]?.url.pathname).toBe('/app/approval-requests/9001');
  });

  it('고르기를 풀면 상세를 다시 부르지 않는다', async () => {
    const { requests, user } = renderScreen(defaultRoutes(), '?rq=9001');

    await waitForList();
    await waitFor(() => {
      expect(detailRequests(requests)).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: /SYNTH-REQ-001/ }));

    await waitFor(() => {
      expect(currentLocation()).not.toContain('rq=');
    });
    expect(detailRequests(requests)).toHaveLength(1);
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

  it('고른 요청이 있으면 상세도 함께 부른다 — 갱신된 목록 옆에 낡은 상세가 서면 안 된다', async () => {
    const { requests, user } = renderScreen(defaultRoutes(3), '?rq=9001');

    await waitForList();
    await waitFor(() => {
      expect(detailRequests(requests)).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: t.actions.reload }));

    await waitFor(() => {
      expect(detailRequests(requests)).toHaveLength(2);
    });
    expect(listRequests(requests)).toHaveLength(2);
    expect(countRequests(requests)).toHaveLength(2);
  });

  it('고르지 않았으면 상세는 부를 대상이 없다', async () => {
    const { requests, user } = renderScreen(defaultRoutes(3));

    await waitForList();
    await user.click(screen.getByRole('button', { name: t.actions.reload }));

    await waitFor(() => {
      expect(listRequests(requests)).toHaveLength(2);
    });
    expect(detailRequests(requests)).toHaveLength(0);
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
    const { requests, user } = renderScreen(defaultRoutes(3), '?rq=9001');

    await waitForList();
    await waitFor(() => {
      expect(detailRequests(requests)).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: t.actions.reload }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));
    await user.click(tabFor(t.tabs.requested));

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

describe('고른 요청 — 정보·대상·진행', () => {
  const renderSelected = async (
    detail: ApprovalRequestDetail = contradictoryMyTurnDetail,
    search = '?rq=9001',
  ): Promise<void> => {
    renderScreen([listRoute(), countRoute(), detailRoute(detail)], search);

    await waitForList();
    await screen.findByRole('group', { name: t.panes.progress });
  };

  it('세 구획이 이 차례로 선다 — 사유가 대상보다 위다', async () => {
    await renderSelected();

    const groups = [...detailPane().querySelectorAll('[role="group"][aria-label]')].map((group) =>
      group.getAttribute('aria-label'),
    );

    expect(groups.filter((label) => label !== t.panes.reason)).toEqual([
      t.panes.request,
      t.panes.target,
      t.panes.progress,
    ]);
  });

  it('사유 전문이 보이고 목록이 자른 둘째 줄이 여기서는 살아 있다', async () => {
    await renderSelected();

    const reason = screen.getByRole('group', { name: t.panes.reason });

    expect([...reason.children].map((line) => line.textContent)).toEqual([
      '합성 사유 첫 줄',
      SECOND_LINE_OF_MULTILINE_REASON,
    ]);
  });

  it('상세·대상·진행 어디에도 내부 번호가 없다', async () => {
    await renderSelected();

    const text = detailPane().textContent ?? '';

    /* 짝 방향 — 사람이 읽는 값은 실제로 그려진다. */
    expect(text).toContain('SYNTH-REQ-001');
    expect(text).toContain('합성 상신자1');
    expect(text).toContain('합성 승인자1');

    for (const internal of ['9001', '9301', '9401', '9501']) {
      expect(text).not.toContain(internal);
    }
  });

  it('대상 표시명을 그대로 내고 유형 코드로 이름을 지어내지 않는다', async () => {
    await renderSelected();

    const target = screen.getByRole('group', { name: t.panes.target });

    expect(within(target).getByText('합성 대상 문서 가')).toBeVisible();
    expect(target.textContent).not.toContain('SAMPLE-TARGET-A');
    expect(within(target).getByText(t.target.note)).toBeVisible();
  });

  it('빈 매핑표에서는 열기가 잠기고 그 갈래의 사유가 붙는다', async () => {
    await renderSelected();

    const open = screen.getByRole('button', { name: t.target.open });

    expect(open).toBeDisabled();
    expect(open).toHaveAccessibleDescription(t.target.blockedUnmapped);
  });

  it('열 수 없다고 온 대상은 그 사실로 잠긴다', async () => {
    await renderSelected(finishedDetail, '?rq=9002');

    expect(screen.getByRole('button', { name: t.target.open })).toHaveAccessibleDescription(
      t.target.blockedNotOpenable,
    );
  });

  it('화면 ID가 오지 않은 대상은 또 다른 사유로 잠긴다', async () => {
    await renderSelected(noScreenIdTargetDetail);

    expect(screen.getByRole('button', { name: t.target.open })).toHaveAccessibleDescription(
      t.target.blockedNoScreenId,
    );
  });

  it('대상 표시명이 비어 오면 번호를 대신 내지 않는다', async () => {
    await renderSelected(contradictoryNotMyTurnDetail, '?rq=9003');

    const target = screen.getByRole('group', { name: t.panes.target });

    expect(within(target).getByText(t.values.unknownTarget)).toBeVisible();
    expect(target.textContent).not.toContain('9403');
  });
});

describe('고른 요청 — 순차 판정은 서버 값이다', () => {
  const renderDetail = async (detail: ApprovalRequestDetail, search: string): Promise<void> => {
    renderScreen([listRoute(), countRoute(), detailRoute(detail)], search);

    await screen.findByRole('group', { name: t.panes.progress });
  };

  it('현재 단계가 서버가 준 번호다 — 단계 배열로 다시 세지 않는다', async () => {
    /* 모순 픽스처: 서버 2 / 3, 배열로 다시 세면 1이다. */
    await renderDetail(contradictoryMyTurnDetail, '?rq=9001');

    const progress = screen.getByRole('group', { name: t.panes.progress });

    expect(within(progress).getByText(t.progress.position(2, 3))).toBeVisible();
    expect(within(progress).queryByText(t.progress.position(1, 3))).not.toBeInTheDocument();
  });

  it('현재 단계가 전체보다 커도 그대로 낸다', async () => {
    await renderDetail(contradictoryNotMyTurnDetail, '?rq=9003');

    expect(screen.getByText(t.progress.position(2, 1))).toBeVisible();
  });

  it('끝난 요청은 종료라고 적고 0으로 메우지 않는다', async () => {
    await renderDetail(finishedDetail, '?rq=9002');

    expect(screen.getByText(t.progress.finished(2))).toBeVisible();
  });

  it('내 차례가 서버 값이다 — 배열로는 아닌데 서버가 맞다고 한 경우', async () => {
    await renderDetail(contradictoryMyTurnDetail, '?rq=9001');

    expect(screen.getByText(t.progress.myTurn)).toBeVisible();
    expect(screen.queryByText(t.progress.notMyTurn)).not.toBeInTheDocument();
  });

  it('내 차례가 서버 값이다 — 배열로는 맞는데 서버가 아니라고 한 경우', async () => {
    await renderDetail(contradictoryNotMyTurnDetail, '?rq=9003');

    expect(screen.getByText(t.progress.notMyTurn)).toBeVisible();
    expect(screen.queryByText(t.progress.myTurn)).not.toBeInTheDocument();
  });

  it('결재 결과·시각·의견을 응답 값 그대로 낸다', async () => {
    await renderDetail(contradictoryMyTurnDetail, '?rq=9001');

    const progress = screen.getByRole('group', { name: t.panes.progress });

    expect(within(progress).getByText('SAMPLE-DECISION-APPROVED')).toBeVisible();
    expect(within(progress).getByText('2026-08-06 15:02')).toBeVisible();
    expect(within(progress).getByText('합성 결재 의견 하나')).toBeVisible();
  });

  it('세로로 그리고 결재된 단계의 노드가 번호로 덮인다', async () => {
    await renderDetail(contradictoryMyTurnDetail, '?rq=9001');

    const progress = screen.getByRole('group', { name: t.panes.progress });
    const list = progress.querySelector('ol');

    expect(list).toHaveAttribute('data-orientation', 'vertical');
    expect(progress.querySelector('li[data-status] span[aria-hidden="true"]')?.textContent).toBe(
      '1',
    );
  });

  it('반려 자리표시가 빈 동안에는 어떤 단계도 반려로 그려지지 않는다', async () => {
    await renderDetail(finishedDetail, '?rq=9002');

    const progress = screen.getByRole('group', { name: t.panes.progress });
    const items = [...progress.querySelectorAll('li[data-status]')];

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.getAttribute('data-status'))).toEqual(['complete', 'complete']);
  });

  it('승인자 이름이 없어 멈춘 요청은 오류가 아니라 안내다', async () => {
    await renderDetail(stalledDetail, '?rq=9004');

    const progress = screen.getByRole('group', { name: t.panes.progress });

    expect(within(progress).queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(messages.httpError.loadTitle)).not.toBeInTheDocument();
    expect(within(progress).getByText(t.values.unknownApprover)).toBeVisible();
    expect(within(progress).getByText(t.progress.waitingCurrent)).toBeVisible();
    expect(progress.textContent).not.toContain('9501');
  });
});

describe('고름 ≠ 보임 — 주소가 가리키는 것을 읽을 수 있는가', () => {
  it('상세가 오기 전에도 빈 구간이 남지 않는다', () => {
    renderScreen(defaultRoutes(), '?rq=9001');

    expect(screen.getByRole('status', { name: t.loading.detail })).toBeInTheDocument();
  });

  it('목록에 없는 요청이어도 읽을 수 있으면 그대로 보인다', async () => {
    renderScreen([listRoute(), countRoute(), detailRoute(outOfListDetail)], '?rq=9909');

    await waitForList();

    expect(await within(detailPane()).findByText('SYNTH-REQ-909')).toBeVisible();
    /* 목록이 그 요청을 담지 않았다는 것이 이 시험의 전제다. */
    expect(within(requestTable()).queryByText('SYNTH-REQ-909')).not.toBeInTheDocument();
  });

  it('없는 요청이면 안내를 내고 주소에서 그 번호를 정리한다', async () => {
    const { requests } = renderScreen(
      [listRoute(), countRoute(), failingDetailRoute(404)],
      '?rq=9909&q=SYNTH',
    );

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeVisible();
    await waitFor(() => {
      expect(currentLocation()).not.toContain('rq=');
    });
    /* 조건은 그대로다 — 정리하는 것은 고른 번호 하나뿐이다. */
    expect(currentLocation()).toContain('q=SYNTH');
    expect(screen.queryByText(t.empty.noSelectionTitle)).not.toBeInTheDocument();
    expect(detailRequests(requests)).toHaveLength(1);
  });

  it('없는 요청을 정리해도 히스토리가 늘지 않는다', async () => {
    const { user } = renderScreen([listRoute(), countRoute(), failingDetailRoute(404)], '?rq=9909');

    await screen.findByText(t.empty.notFoundTitle);
    await user.click(screen.getByRole('button', { name: '뒤로' }));

    /* 정리가 히스토리를 늘렸다면 뒤로가기가 같은 자리(rq=9909)로 되돌아간다. */
    await waitFor(() => {
      expect(currentLocation()).not.toContain('rq=9909');
    });
  });

  it('조건을 바꾸면 없음 안내를 거둔다 — 안내가 가리킬 것이 없어진다', async () => {
    const { user } = renderScreen([listRoute(), countRoute(), failingDetailRoute(404)], '?rq=9909');

    await screen.findByText(t.empty.notFoundTitle);
    await user.click(tabFor(t.tabs.requested));

    await waitFor(() => {
      expect(screen.getByText(t.empty.noSelectionTitle)).toBeVisible();
    });
    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
  });

  it('볼 권한이 없으면 다른 안내를 내고 고른 번호를 정리하지 않는다', async () => {
    renderScreen([listRoute(), countRoute(), failingDetailRoute(403)], '?rq=9909');

    expect(await screen.findByText(t.empty.forbiddenTitle)).toBeVisible();
    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
    /* 있는데 내 것이 아닌 것이다 — 지우면 무엇을 열려 했는지 잃는다. */
    expect(currentLocation()).toContain('rq=9909');
  });

  it('볼 권한이 없을 때는 다시 시도를 내지 않는다', async () => {
    renderScreen([listRoute(), countRoute(), failingDetailRoute(403)], '?rq=9909');

    await screen.findByText(t.empty.forbiddenTitle);

    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('그 밖의 실패는 배너와 다시 시도이고, 누르면 상세를 다시 부른다', async () => {
    const { requests, user } = renderScreen(
      [listRoute(), countRoute(), failingDetailRoute(500)],
      '?rq=9001',
    );

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeVisible();
    expect(currentLocation()).toContain('rq=9001');

    const before = detailRequests(requests).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(detailRequests(requests).length).toBe(before + 1);
    });
  });

  it('상세가 실패해도 목록과 조건 줄은 살아 있다', async () => {
    renderScreen([listRoute(), countRoute(), failingDetailRoute(500)], '?rq=9001');

    await screen.findByText(messages.httpError.loadTitle);
    await waitForList();

    expect(screen.getByRole('button', { name: messages.common.search })).toBeInTheDocument();
  });
});
