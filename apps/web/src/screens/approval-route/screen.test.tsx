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
  BUSINESS_UNIT_LABEL,
  INACTIVE_BUSINESS_UNIT_LABEL,
  businessUnitFixtures,
  routeFixtures,
  stepFixtures,
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
) => ({ items, page: { page: 1, size: 20, total: items.length, ...page } });

const listRoute = (
  items: unknown[] = routeFixtures,
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, ROUTES_PATH),
  respond: () => jsonResponse(listBody(items, page)),
});

const failingListRoute = (status = 500): StubRoute => ({
  match: (request) => isGet(request, ROUTES_PATH),
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
  requests.filter((request) => isDetailPath(request.url.pathname));
const stepsRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => isStepsPath(request.url.pathname));
const listRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === ROUTES_PATH);

/** 어느 번호로 불러도 응답한다 — 「부르지 않았다」를 증명하려면 부를 수 있는 스텁이 있어야 한다. */
const detailRoute = (route: unknown = routeFixtures[0]): StubRoute => ({
  match: (request) => request.method === 'GET' && isDetailPath(new URL(request.url).pathname),
  respond: () => jsonResponse(route),
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

/** 사용자 목록. **이 화면은 부르지 않아야 한다** — 부를 수 있게 두어야 그 사실이 증명된다. */
const usersRoute = (): StubRoute => ({
  match: (request) => isGet(request, USERS_PATH),
  respond: () => jsonResponse(listBody([])),
});

const allRoutes = (extra: StubRoute[] = []): StubRoute[] => [
  ...extra,
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
): { requests: RecordedRequest[]; user: ReturnType<typeof userEvent.setup> } => {
  const { fetch, requests } = createRecordingFetch(routes);

  renderWithProviders(
    <>
      <ApprovalRouteScreen />
      <LocationProbe />
      <BackProbe />
      <SearchProbe to={navigateTo} />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, user: userEvent.setup() };
};

const locationText = (): string => screen.getByTestId('location').textContent ?? '';

const selectRouteButton = (approvalTypeCode: string, businessUnitLabel: string): HTMLElement =>
  screen.getByRole('button', { name: t.actions.selectRow(approvalTypeCode, businessUnitLabel) });

const waitForList = async (): Promise<void> => {
  await screen.findByText('SAMPLE-TYPE-B');
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
    const { requests } = renderScreen(allRoutes(), '?ty=SAMPLE-TYPE-A&bu=9101&q=SAMPLE&page=2');

    await waitForList();

    const query = listRequests(requests)[0]?.url.searchParams;

    expect(query?.get('approvalTypeCode')).toBe('SAMPLE-TYPE-A');
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
    const { user } = renderScreen(allRoutes(), '?ty=SAMPLE-TYPE-A&q=SAMPLE&inactive=1&page=2');

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

  it('승인 유형 선택지가 비어 있고 왜 비었는지 밝힌다', async () => {
    renderScreen(allRoutes());

    await waitForList();

    expect(screen.getByText(messages.pendingCode.note)).toBeInTheDocument();
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
    await user.click(selectRouteButton('SAMPLE-TYPE-A', BUSINESS_UNIT_LABEL));

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
    await user.click(selectRouteButton('SAMPLE-TYPE-A', BUSINESS_UNIT_LABEL));

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

  it('단계를 그리는 데 사용자 목록을 부르지 않는다', async () => {
    const { requests } = renderScreen(allRoutes(), SELECTED);

    await screen.findByRole('region', { name: t.panes.steps });

    // 선행 단언 — 이름이 실제로 그려져야 「부르지 않았다」가 뜻을 갖는다.
    expect(screen.getByText('합성 승인자1 · 합성부서 가')).toBeInTheDocument();
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

    await user.click(selectRouteButton('SAMPLE-TYPE-B', INACTIVE_BUSINESS_UNIT_LABEL));

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
   * 404 effect는 의존성을 하나로 두려고 서명을 참조로 읽는다. 그 참조를 갱신하는 동기화가
   * 빠지거나 404 effect **뒤에** 서면, 참조에 첫 렌더의 서명이 굳어 **조건을 한 번이라도
   * 바꾼 뒤의 404에서는 안내가 정리 직후 사라진다.**
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

    expect(within(detailPane).getByText('SAMPLE-TYPE-A')).toBeInTheDocument();
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
  it('어떤 쓰기 요청도 보내지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes(), SELECTED);

    await screen.findByRole('region', { name: t.panes.steps });
    await user.click(screen.getByRole('button', { name: t.actions.reload }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));
    await waitFor(() => {
      expect(listRequests(requests).length).toBeGreaterThan(1);
    });

    // 선행 단언 — 요청이 실제로 나갔어야 「전부 GET이다」가 뜻을 갖는다.
    expect(requests.length).toBeGreaterThan(0);
    for (const request of requests) expect(request.method).toBe('GET');
  });

  it('주소로 대상이 바뀌어도 화면이 그 주소를 따른다', async () => {
    const { user } = renderScreen(allRoutes(), '', SELECTED);

    await waitForList();
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await screen.findByRole('region', { name: t.panes.detail });
  });
});
