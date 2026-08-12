import type { ApiClient } from '@omf-mes/api-client';
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
import { pickRange } from '../../test/date-picker';
import {
  SECOND_LINE_OF_MULTILINE_REASON,
  contradictoryMyTurnDetail,
  contradictoryNotMyTurnDetail,
  decidedDetail,
  finishedDetail,
  noScreenIdTargetDetail,
  outOfListDetail,
  requestFixtures,
  stalledDetail,
} from './fixtures';
import { requestDetailPath } from './queries';
import { ApprovalInboxScreen } from './screen';
import type { ApprovalRequestDetail } from './types';

const t = messages.approvalInbox;

const ROUTE = '/approval/inbox';
const REQUESTS_PATH = '/app/approval-requests';

interface RecordedRequest {
  method: string;
  url: URL;
  /** 보낸 헤더. 잠금 토큰과 멱등 키가 **실제로 실렸는지**는 여기서만 잴 수 있다. */
  headers: Headers;
  /** 보낸 본문(JSON). 본문이 없으면 `undefined`다 — 「빈 객체」와 구분한다. */
  body: unknown;
}

/**
 * 요청을 기록하면서 스텁 규칙으로 응답한다. 규칙에 없는 요청은 하네스가 던져 스텁 누락을 드러낸다.
 *
 * **경로를 가리지 않고 전부 기록한다** — 「부르지 않았다」를 증명하려면 잘못된 경로로 나간
 * 요청도 잡혀야 한다.
 *
 * `hold`가 참을 내는 요청은 **기록한 뒤에** 붙잡아 둔다 — 「기다리는 동안 무엇이 잠기는가」를
 * 재려면 요청이 나간 사실은 이미 보여야 한다.
 */
const createRecordingFetch = (
  routes: StubRoute[],
  hold: (request: Request) => boolean = () => false,
): { fetch: StubFetch; requests: RecordedRequest[]; release: () => void } => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch(routes);

  let release = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const fetch: StubFetch = async (request) => {
    /* 본문은 한 번만 읽을 수 있다 — 복제해 읽어야 스텁이 같은 요청을 다시 다룰 수 있다. */
    const text = await request.clone().text();

    requests.push({
      method: request.method,
      url: new URL(request.url),
      headers: request.headers,
      body: text === '' ? undefined : (JSON.parse(text) as unknown),
    });

    if (hold(request)) await gate;

    return stub(request);
  };

  return { fetch, requests, release };
};

/**
 * 대기 건수 조회인가. **목록과 같은 경로를 쓰지만 조건이 다르다** — 건수는 `myTurnOnly`로
 * 걸러지고 목록의 어느 탭도 그 축을 싣지 않는다(`tabs.ts`).
 *
 * **`size` 유무로 가르지 않는다.** 목록에 쪽 크기 선택이 붙는 날 두 조회가 조용히 뒤섞인다 —
 * 판별식이 「제품이 지금 `size`를 안 싣는다」는 **바뀔 수 있는 구현**에 매이면 안 된다.
 * `myTurnOnly`가 곧 「대기 건수」의 정의다(계약이 그 파라미터를 그렇게 적었다).
 */
const isCountUrl = (url: URL): boolean =>
  url.pathname === REQUESTS_PATH && url.searchParams.has('myTurnOnly');

const isListUrl = (url: URL): boolean =>
  url.pathname === REQUESTS_PATH && !url.searchParams.has('myTurnOnly');

/**
 * 상세 경로로 **나간 요청 전부**. 번호 자리가 무엇이든 센다 — 잘못된 경로도 「부르지 않았다」를 깬다.
 *
 * **액션 경로(`…:approve`·`…:reject`)는 빼고 센다.** 액션 경로도 슬래시로는 한 조각이라
 * 가르지 않으면 결재 요청이 「상세를 불렀다」로 잡혀, 성공 뒤 무효화를 재는 눈금이 무너진다.
 */
const isDetailPath = (pathname: string): boolean =>
  /^\/app\/approval-requests\/[^/:]+$/.test(pathname);

/** 결재 액션 경로. **번호 자리를 가리지 않는다** — 엉뚱한 번호로 나간 결재도 잡혀야 한다. */
const isApprovePath = (pathname: string): boolean =>
  /^\/app\/approval-requests\/[^/]+:approve$/.test(pathname);
const isRejectPath = (pathname: string): boolean =>
  /^\/app\/approval-requests\/[^/]+:reject$/.test(pathname);

const listRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => isListUrl(request.url));
const countRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => isCountUrl(request.url));
const detailRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => isDetailPath(request.url.pathname));
/** 쓰기로 나간 요청 전부. **경로를 가리지 않고 센다** — 잘못된 경로로 나간 쓰기도 잡아야 한다. */
const writeRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.method !== 'GET');
const approveRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => isApprovePath(request.url.pathname));
const rejectRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => isRejectPath(request.url.pathname));

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
/**
 * 상세 200이 실어 오는 잠금 토큰.
 *
 * **이 리소스에서 `ETag`를 주는 응답은 상세 하나뿐이다**(계약 실측) — 목록·건수에는 없다.
 * 그래서 목록·건수 스텁에는 이 헤더를 붙이지 않는다.
 */
const DETAIL_ETAG = '"9"';

const detailRoute = (detail: ApprovalRequestDetail = contradictoryMyTurnDetail): StubRoute => ({
  match: (request) => isDetailPath(new URL(request.url).pathname),
  respond: () => jsonResponse(detail, { headers: { ETag: DETAIL_ETAG } }),
});

const failingDetailRoute = (status: number): StubRoute => ({
  match: (request) => isDetailPath(new URL(request.url).pathname),
  respond: () => jsonResponse({ message: '' }, { status }),
});

const defaultRoutes = (total = 0): StubRoute[] => [listRoute(), countRoute(total), detailRoute()];

/**
 * 결재 200이 실어 오는 토큰. **상세의 것과 다르다** — 쓰기의 `ETag`가 액션 경로에 앉아
 * 상세 토큰이 낡는다는 사실이 이 값의 존재 이유다.
 */
const DECIDED_ETAG = '"10"';

const approveRoute = (detail: ApprovalRequestDetail = decidedDetail): StubRoute => ({
  match: (request) => isApprovePath(new URL(request.url).pathname),
  respond: () => jsonResponse(detail, { headers: { ETag: DECIDED_ETAG } }),
});

const rejectRoute = (detail: ApprovalRequestDetail = decidedDetail): StubRoute => ({
  match: (request) => isRejectPath(new URL(request.url).pathname),
  respond: () => jsonResponse(detail, { headers: { ETag: DECIDED_ETAG } }),
});

const failingApproveRoute = (status: number, body: unknown = { message: '' }): StubRoute => ({
  match: (request) => isApprovePath(new URL(request.url).pathname),
  respond: () => jsonResponse(body, { status }),
});

/** 응답 자체가 오지 않는 실패. **상태 코드가 없는 갈래**라 던져서 만든다. */
const offlineApproveRoute = (): StubRoute => ({
  match: (request) => isApprovePath(new URL(request.url).pathname),
  respond: () => {
    throw new TypeError('네트워크가 끊겼습니다');
  },
});

/** 결재까지 여는 기본 스텁 한 벌. 앞에 놓은 규칙이 먼저 걸린다. */
const decisionRoutes = (extra: StubRoute[] = []): StubRoute[] => [
  ...extra,
  listRoute(),
  countRoute(),
  detailRoute(),
  approveRoute(),
  rejectRoute(),
];

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
  hold?: (request: Request) => boolean,
): {
  requests: RecordedRequest[];
  release: () => void;
  user: ReturnType<typeof userEvent.setup>;
  apiClient: ApiClient;
} => {
  const { fetch, requests, release } = createRecordingFetch(routes, hold);

  const { apiClient } = renderWithProviders(
    <>
      <ApprovalInboxScreen />
      <LocationProbe />
      <BackProbe />
      <SearchProbe to={navigateTo} />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, release, user: userEvent.setup(), apiClient };
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

    /* 양성 앵커 — 조회가 실제로 나갔다. 이것이 없으면 아래 넷이 공허하게 통과할 수 있다. */
    expect(query?.get('assignedToMe')).toBe('true');

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
    /*
     * **토큰을 꺼낼 경로가 곧 이 조회가 지나간 경로다.** 둘이 갈리면 결재가 토큰을 찾지
     * 못해 요청이 아예 나가지 않는다(「눌러도 아무 일이 없다」).
     */
    expect(requestDetailPath(9001)).toBe(detailRequests(requests)[0]?.url.pathname);
  });

  it('상세 200이 상세 경로에 잠금 토큰을 남긴다 — 결재가 토큰을 얻는 유일한 자리다', async () => {
    const { requests, apiClient } = renderScreen(defaultRoutes(), '?rq=9001');

    await waitFor(() => {
      expect(detailRequests(requests)).toHaveLength(1);
    });

    expect(apiClient.etags.ifMatch(requestDetailPath(9001))).toBe(DETAIL_ETAG);
  });

  it('목록·건수 응답은 토큰을 남기지 않는다 — 목록 행에서 바로 결재할 수 없는 이유다', async () => {
    const { requests, apiClient } = renderScreen(defaultRoutes(3));

    await waitForList();
    await waitFor(() => {
      expect(countRequests(requests)).toHaveLength(1);
    });

    expect(apiClient.etags.ifMatch(REQUESTS_PATH)).toBeUndefined();
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

  /*
   * 위 시험들은 **고르지 않은 상태 → A** 이거나 **A → 같은 A(해제)** 뿐이다.
   * **A가 걸린 채 B를 누르는 길**은 사용자가 가장 자주 밟는 길인데 어느 시험도 지나지 않아,
   * 앞 선택이 그대로 남는 구현(사용자에게는 「눌러도 아무 일이 없다」)이 통과할 수 있었다.
   */
  it('다른 요청을 누르면 선택이 그쪽으로 옮겨간다 — 앞 선택이 남지 않는다', async () => {
    const { requests, user } = renderScreen(defaultRoutes(), '?rq=9001');

    await waitForList();
    await waitFor(() => {
      expect(detailRequests(requests)).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: /SYNTH-REQ-002/ }));

    await waitFor(() => {
      expect(currentLocation()).toContain('rq=9002');
    });
    expect(currentLocation()).not.toContain('rq=9001');

    /* 옮겨간 쪽의 상세를 실제로 부른다 — 주소만 바뀌고 읽는 것이 그대로면 소용이 없다. */
    await waitFor(() => {
      expect(detailRequests(requests)).toHaveLength(2);
    });
    expect(detailRequests(requests)[1]?.url.pathname).toBe(requestDetailPath(9002));
  });

  it('선택을 옮겨도 보이는 행과 조건은 그대로다', async () => {
    const { user } = renderScreen(defaultRoutes(), '?rq=9001&page=2&q=SYNTH&tab=requested');

    await waitForList();
    await user.click(screen.getByRole('button', { name: /SYNTH-REQ-003/ }));

    await waitFor(() => {
      expect(currentLocation()).toContain('rq=9003');
    });
    expect(currentLocation()).toContain('page=2');
    expect(currentLocation()).toContain('q=SYNTH');
    expect(currentLocation()).toContain('tab=requested');
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

describe('조회만 하는 조작', () => {
  /**
   * **읽는 조작은 무엇 하나도 쓰지 않는다.** 결재가 붙은 뒤에도 그대로여야 한다 —
   * 조회·탭·쪽이 쓰기를 부르기 시작하면 사용자가 「보기만 했는데」 결재가 나간다.
   */
  it('조회·탭 전환·다시 조회로는 쓰기가 나가지 않는다', async () => {
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

  /**
   * 차례가 뜻이다 — **무엇을 결재하는가(사유 → 대상) → 어디까지 왔는가 → 결정한다.**
   * 결재 구획이 맨 아래인 이유: 위 셋을 읽고 나서 누르는 것이 이 화면의 일이다.
   */
  it('네 구획이 이 차례로 선다 — 사유가 대상보다 위이고 결재가 맨 아래다', async () => {
    await renderSelected();

    const groups = [...detailPane().querySelectorAll('[role="group"][aria-label]')].map((group) =>
      group.getAttribute('aria-label'),
    );

    expect(groups.filter((label) => label !== t.panes.reason)).toEqual([
      t.panes.request,
      t.panes.target,
      t.panes.progress,
      t.panes.decision,
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
    const { user } = renderScreen(
      [listRoute(), countRoute(), failingDetailRoute(404)],
      '?q=OTHER',
      'rq=9909&q=SYNTH',
    );

    await waitForList();
    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await screen.findByText(t.empty.notFoundTitle);
    await user.click(screen.getByRole('button', { name: '뒤로' }));

    /*
     * **앞자리를 서로 다른 조건으로 둔다.** 정리가 히스토리를 늘렸다면 뒤로가기가 없는
     * 요청을 가리키던 자리로 되돌아가고, 거기서 다시 404가 나 같은 정리가 되풀이되므로
     * 결코 `q=OTHER`로 돌아오지 못한다. 두 자리가 같은 조건이면 밀려난 칸이 보이지 않아
     * 이 시험이 아무것도 재지 못한다.
     */
    await waitFor(() => {
      expect(currentLocation()).toContain('q=OTHER');
    });
    expect(currentLocation()).not.toContain('rq=');
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

  it('거둔 안내가 같은 조건으로 돌아와도 되살아나지 않는다', async () => {
    /*
     * 안내는 「이 조건으로 보고 있던 동안」에 매여 있다. 조작할 때 함께 거두지 않으면
     * 매인 서명이 남아, 탭을 돌아 원래 자리로 오는 것만으로 있지도 않은 실패가 되살아난다.
     */
    const { user } = renderScreen([listRoute(), countRoute(), failingDetailRoute(404)], '?rq=9909');

    await screen.findByText(t.empty.notFoundTitle);
    await user.click(tabFor(t.tabs.requested));
    await screen.findByText(t.empty.noSelectionTitle);

    await user.click(tabFor(t.tabs.pending));

    await waitFor(() => {
      expect(currentLocation()).not.toContain('tab=');
    });
    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeVisible();
  });

  /*
   * 위 두 시험은 **탭 클릭**으로만 조작한다. 그 길은 조작 핸들러를 지나 안내를 먼저 거두므로
   * **첫째 겹**만 재는 셈이다. 안내가 「이 조건으로 보고 있던 동안」이라는 **서명에 매여
   * 있다는 것**은 핸들러를 지나지 않는 길에서만 드러난다 — 주소 직접 편집과 뒤로가기가
   * 그 길이고, 서명 매임이 존재하는 이유도 바로 그 둘이다.
   */
  it('주소를 직접 고쳐 조건이 바뀌어도 없음 안내가 남지 않는다', async () => {
    const { user } = renderScreen(
      [listRoute(), countRoute(), failingDetailRoute(404)],
      '?rq=9909',
      'q=OTHER',
    );

    await screen.findByText(t.empty.notFoundTitle);

    /* 클릭 핸들러를 거치지 않는 길 — 안내를 거두는 자리를 지나지 않는다. */
    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await waitFor(() => {
      expect(currentLocation()).toContain('q=OTHER');
    });
    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeVisible();
  });

  it('뒤로가기로 앞 조건에 돌아가도 없음 안내가 따라오지 않는다', async () => {
    const { user } = renderScreen(
      [listRoute(), countRoute(), failingDetailRoute(404)],
      '?q=OTHER',
      'rq=9909&q=SYNTH',
    );

    await waitForList();
    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await screen.findByText(t.empty.notFoundTitle);

    /* 안내는 `q=SYNTH`로 보고 있던 동안에 매였다. 뒤로가면 앞 조건(`q=OTHER`)이 선다. */
    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).toContain('q=OTHER');
    });
    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeVisible();
  });

  it('볼 권한이 없으면 다른 안내를 내고 고른 번호를 정리하지 않는다', async () => {
    const { requests } = renderScreen(
      [listRoute(), countRoute(), failingDetailRoute(403)],
      '?rq=9909',
    );

    expect(await screen.findByText(t.empty.forbiddenTitle)).toBeVisible();

    /*
     * **「사라지지 않았다」는 가라앉은 뒤에 잰다.** 안내가 뜨자마자 동기로 재면 아직
     * 일어나지 않은 정리를 못 본 채 통과한다 — 짝이 되는 404 시험은 기다려서 재는데
     * 이쪽만 그러지 않으면 「403은 정리하지 않는다」 절반이 통째로 침묵한다.
     * 목록과 건수가 도착할 때까지 두어 여러 렌더와 effect가 지나가게 한다.
     */
    await waitForList();
    await waitFor(() => {
      expect(countRequests(requests)).toHaveLength(1);
    });

    /* 있는데 내 것이 아닌 것이다 — 지우면 무엇을 열려 했는지 잃는다. */
    expect(currentLocation()).toContain('rq=9909');
    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
    expect(screen.getByText(t.empty.forbiddenTitle)).toBeVisible();
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

/* =========================================================================
 * 결재 — 되돌릴 수 없는 쓰기 둘.
 *
 * 부품 시험이 잰 것은 「컨트롤이 잠기는가」였다. 여기서 재는 것은 그 너머다 —
 * **요청이 실제로 나갔는가 · 몇 번 · 어느 경로로 · 어떤 헤더와 본문을 싣고 · 성공한 뒤
 * 무엇이 다시 불리는가.** 단위로는 잡을 수 없는 것들이다.
 * ====================================================================== */

/** 결재할 수 있는 상태(9001 · 서버가 「내 차례」라고 한 요청)까지 세운다. */
const renderDecision = async (
  routes: StubRoute[] = decisionRoutes(),
  search = '?rq=9001',
  navigateTo = '',
  hold?: (request: Request) => boolean,
): Promise<ReturnType<typeof renderScreen>> => {
  const rendered = renderScreen(routes, search, navigateTo, hold);

  await screen.findByRole('group', { name: t.panes.decision });

  return rendered;
};

const decisionPane = (): HTMLElement => screen.getByRole('group', { name: t.panes.decision });
const approveButton = (): HTMLElement =>
  within(decisionPane()).getByRole('button', { name: t.decision.approve });
const rejectButton = (): HTMLElement =>
  within(decisionPane()).getByRole('button', { name: t.decision.reject });
const commentBox = (): HTMLElement => screen.getByLabelText(t.decision.commentLabel);
const confirmDialog = (): HTMLElement => screen.getByRole('dialog');
const confirmButton = (label: string): HTMLElement =>
  within(confirmDialog()).getByRole('button', { name: label });

/** 의견을 적고 반려 창을 연다 — 반려 갈래가 되풀이하는 채비다. */
const openRejectDialog = async (
  user: ReturnType<typeof userEvent.setup>,
  comment = '합성 반려 사유',
): Promise<void> => {
  await user.type(commentBox(), comment);
  await user.click(rejectButton());
};

/** 결재를 붙잡아 둔다. **조회까지 붙잡으면 구획이 서기도 전에 멈춘다.** */
const holdApprove = (request: Request): boolean => isApprovePath(new URL(request.url).pathname);

describe('결재 — 상시 문구', () => {
  /**
   * **자물쇠 문구는 사라지는 자리에 두지 않는다.** 승인이 무엇을 하고 무엇을 하지 않는지는
   * 결재함을 보는 내내 참인 사실이라, 알림처럼 몇 초 뒤 없어지면 다시 확인할 방법이 없다.
   */
  it('버튼 위 상시 자리에 서고 내 차례가 아니어도 사라지지 않는다', async () => {
    await renderDecision(decisionRoutes([detailRoute(contradictoryNotMyTurnDetail)]), '?rq=9003');

    expect(within(decisionPane()).getByText(t.decision.lockNote)).toBeVisible();
    /* 짝 방향 — 그 상태에서 버튼이 실제로 잠겨 있다(문구만 남고 잠금이 풀린 것이 아니다). */
    expect(approveButton()).toBeDisabled();
  });

  it('결재에 성공한 뒤 알림에는 그 문장이 없다', async () => {
    const { user } = await renderDecision();

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));

    const toast = await screen.findByText(t.toast.approved);

    expect(toast.closest('[role="status"], [role="alert"]')?.textContent).not.toContain(
      t.decision.lockNote,
    );
    /* 사라지지 않는 자리에는 그대로 있다 — 「어디에도 없다」로 통과하지 않게 짝을 둔다. */
    expect(within(decisionPane()).getByText(t.decision.lockNote)).toBeVisible();
  });
});

describe('결재 — 내 차례 판정(첫째 겹)', () => {
  /**
   * **서버 값을 따른다.** 이 픽스처는 단계 배열로 다시 계산하면 「내 차례」가 되는데
   * 서버가 아니라고 했다 — 배열을 훑는 코드가 들어오면 여기서 드러난다.
   */
  it('서버가 아니라고 하면 배열로 맞아도 잠기고 요청이 나가지 않는다', async () => {
    const { requests, user } = await renderDecision(
      decisionRoutes([detailRoute(contradictoryNotMyTurnDetail)]),
      '?rq=9003',
    );

    expect(approveButton()).toBeDisabled();
    expect(rejectButton()).toBeDisabled();
    expect(approveButton()).toHaveAccessibleDescription(
      t.decision.blockedNotMyTurn(t.decision.approve),
    );

    await user.click(approveButton());
    await user.click(rejectButton());

    expect(writeRequests(requests)).toHaveLength(0);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  /** 짝 방향 — 서버가 맞다고 하면 배열로 아니어도 열린다. */
  it('서버가 맞다고 하면 배열로 아니어도 승인이 열린다', async () => {
    await renderDecision();

    expect(approveButton()).toBeEnabled();
  });

  /** 승인자가 없어 멈춘 요청도 **오류가 아니라 잠긴 안내**다 — 기다리는 것이 정상이다. */
  it('멈춘 요청에서도 경보를 세우지 않고 사유만 붙인다', async () => {
    await renderDecision(decisionRoutes([detailRoute(stalledDetail)]), '?rq=9004');

    expect(within(decisionPane()).queryByRole('alert')).toBeNull();
    expect(rejectButton()).toHaveAccessibleDescription(
      t.decision.blockedNotMyTurn(t.decision.reject),
    );
  });
});

describe('결재 — 확인 창', () => {
  it('승인을 눌러도 확인하기 전에는 요청이 나가지 않는다', async () => {
    const { requests, user } = await renderDecision();

    await user.click(approveButton());

    expect(confirmDialog()).toBeInTheDocument();
    expect(writeRequests(requests)).toHaveLength(0);
  });

  it('반려도 확인하기 전에는 요청이 나가지 않는다', async () => {
    const { requests, user } = await renderDecision();

    await openRejectDialog(user);

    expect(confirmDialog()).toBeInTheDocument();
    expect(writeRequests(requests)).toHaveLength(0);
  });

  /** 창이 보여 주는 것과 나가는 것이 같은 값에서 온다 — 갈리면 확인의 뜻이 없다. */
  it('창이 구획에 적은 의견을 그대로 보여 준다', async () => {
    const { user } = await renderDecision();

    await user.type(commentBox(), '  합성 승인 의견  ');
    await user.click(approveButton());

    expect(within(confirmDialog()).getByText('합성 승인 의견')).toBeVisible();
  });

  /**
   * **공백만 친 것은 적지 않은 것과 같다** — 창이 그 사실을 말한다.
   *
   * 창이 입력값을 날것 그대로 보이면 이 자리에 빈 칸이 서서 「무언가 적힌 채 승인된다」로
   * 읽힌다. 실제로 나가는 본문에는 `comment` 키가 없다.
   */
  it('공백만 친 의견은 승인 창이 「의견 없음」으로 말한다', async () => {
    const { user } = await renderDecision();

    await user.type(commentBox(), '   ');
    await user.click(approveButton());

    expect(within(confirmDialog()).getByText(t.dialog.noComment)).toBeVisible();
    expect(within(confirmDialog()).queryByText(t.dialog.commentHeading)).toBeNull();
  });

  /** 창 안에 선택칸을 두지 않는다(`omf-mes#45` — 창 본문이 펼침 목록을 자른다). */
  it('두 창 어디에도 선택칸이 없다', async () => {
    const { user } = await renderDecision();

    await user.click(approveButton());
    expect(within(confirmDialog()).queryAllByRole('combobox')).toHaveLength(0);

    await user.click(confirmButton(messages.common.cancel));
    await openRejectDialog(user);

    expect(within(confirmDialog()).queryAllByRole('combobox')).toHaveLength(0);
  });

  /**
   * **창을 닫는 것은 고치러 나가는 길이다**(수명 표 12행). 초안을 비우면 사용자가 방금 적은
   * 반려 사유를 **취소를 누른 대가로** 잃는다.
   */
  it('창을 닫아도 적어 둔 의견이 남는다', async () => {
    const { user } = await renderDecision();

    await openRejectDialog(user);
    await user.click(confirmButton(messages.common.cancel));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(commentBox()).toHaveValue('합성 반려 사유');
  });

  /**
   * **Escape는 막을 수 없다** — native `<dialog>`가 `cancel`을 내고 디자인 시스템이 그것을
   * 닫기 요청으로 무조건 잇는다. 규율은 「닫히지 않게」가 아니라 「닫혀도 무너지지 않게」다.
   */
  it('Escape로 닫혀도 의견이 남고 요청은 나가지 않는다', async () => {
    const { requests, user } = await renderDecision();

    await openRejectDialog(user);
    /*
     * jsdom은 Escape를 native `<dialog>`의 취소로 잇지 않는다 — 브라우저가 내는
     * `cancel` 이벤트를 직접 만들어 **디자인 시스템이 그것을 닫기로 잇는 길**을 잰다.
     */
    fireEvent(confirmDialog(), new Event('cancel', { bubbles: false, cancelable: true }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(commentBox()).toHaveValue('합성 반려 사유');
    expect(writeRequests(requests)).toHaveLength(0);
  });

  /**
   * **보내는 자리가 스스로 한 번 더 본다.** 창이 열린 사이 상세가 다시 와 내 차례가
   * 끝났는데 확인이 그대로 나가면, 서버는 400으로 되돌리고 사용자는 **이유를 알 수 없는
   * 거절**을 본다.
   */
  it('창이 열린 사이 내 차례가 끝나면 보내지 않고 창을 닫는다', async () => {
    let decided = false;
    const flippingDetail: StubRoute = {
      match: (request) => isDetailPath(new URL(request.url).pathname),
      respond: () => {
        const body = decided ? decidedDetail : contradictoryMyTurnDetail;

        decided = true;

        return jsonResponse(body, { headers: { ETag: DETAIL_ETAG } });
      },
    };

    const { requests, user } = await renderDecision(decisionRoutes([flippingDetail]));

    await user.click(approveButton());
    expect(confirmDialog()).toBeInTheDocument();

    /* 창이 열린 채 상세가 다시 온다 — 그 사이 앞 단계가 움직였다. */
    await user.click(screen.getByRole('button', { name: t.actions.reload }));
    await screen.findByText(t.progress.notMyTurn);

    await user.click(confirmButton(t.decision.approve));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(writeRequests(requests)).toHaveLength(0);
  });

  /** 짝 방향 — 상태가 그대로면 확인이 그대로 나간다. 안 그러면 「아무것도 안 보낸다」와 같다. */
  it('상태가 그대로면 확인이 요청을 보낸다', async () => {
    const { requests, user } = await renderDecision();

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));

    await waitFor(() => {
      expect(approveRequests(requests)).toHaveLength(1);
    });
  });
});

describe('결재 — 본문과 헤더', () => {
  it('승인 본문에 빈 의견을 싣지 않는다 — 키 자체가 없다', async () => {
    const { requests, user } = await renderDecision();

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));

    await waitFor(() => {
      expect(approveRequests(requests)).toHaveLength(1);
    });
    expect(approveRequests(requests)[0]?.body).toEqual({});
  });

  /** 짝 방향 — 「늘 빈 객체」로도 위가 통과하므로 차 있는 쪽을 함께 잰다. */
  it('승인 의견이 차 있으면 다듬은 값을 싣는다', async () => {
    const { requests, user } = await renderDecision();

    await user.type(commentBox(), '  합성 승인 의견  ');
    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));

    await waitFor(() => {
      expect(approveRequests(requests)).toHaveLength(1);
    });
    expect(approveRequests(requests)[0]?.body).toEqual({ comment: '합성 승인 의견' });
  });

  it('반려 본문이 다듬은 의견을 싣는다', async () => {
    const { requests, user } = await renderDecision();

    await openRejectDialog(user, '  합성 반려 사유  ');
    await user.click(confirmButton(t.decision.reject));

    await waitFor(() => {
      expect(rejectRequests(requests)).toHaveLength(1);
    });
    expect(rejectRequests(requests)[0]?.body).toEqual({ comment: '합성 반려 사유' });
    /* 승인 경로로 새지 않는다 — 두 조작이 같은 창을 쓰므로 갈림을 함께 잰다. */
    expect(approveRequests(requests)).toHaveLength(0);
  });

  /**
   * **막는 곳이 화면뿐이다.** 목 서버가 공백만인 반려 의견을 200으로 받는다 —
   * 버튼이 이미 막지만 창이 열린 사이 값이 비면 보내는 자리가 걸러야 한다.
   */
  it('창이 열린 사이 의견이 비면 보내지 않고 인라인 오류를 낸다', async () => {
    const { requests, user } = await renderDecision();

    await openRejectDialog(user);

    /* 창 뒤의 입력칸을 화면 밖 경로로 비운다 — 버튼이 만들지 못하는 상태다. */
    fireEvent.change(commentBox(), { target: { value: '   ' } });
    await user.click(confirmButton(t.decision.reject));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(writeRequests(requests)).toHaveLength(0);
    expect(screen.getByText(t.decision.commentRequired)).toBeVisible();
  });

  /**
   * **잠금 토큰은 상세 경로에서만 온다.** 액션 경로로 꺼내면 그 경로의 토큰이 비어 있어
   * 훅이 요청을 만들지 않고 멈춘다 — 「눌러도 아무 일이 없다」가 그 증상이다.
   */
  it('If-Match가 상세 200이 준 토큰이고 멱등 키가 uuid로 실린다', async () => {
    const { requests, user } = await renderDecision();

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));

    await waitFor(() => {
      expect(approveRequests(requests)).toHaveLength(1);
    });

    const sent = approveRequests(requests)[0];

    expect(sent?.headers.get('If-Match')).toBe(DETAIL_ETAG);
    /* 액션 경로가 주는 토큰이 실리면 안 된다 — 그 값은 이 요청 뒤에야 생긴다. */
    expect(sent?.headers.get('If-Match')).not.toBe(DECIDED_ETAG);
    expect(sent?.headers.get('Idempotency-Key')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('반려도 같은 토큰 규약을 지킨다', async () => {
    const { requests, user } = await renderDecision();

    await openRejectDialog(user);
    await user.click(confirmButton(t.decision.reject));

    await waitFor(() => {
      expect(rejectRequests(requests)).toHaveLength(1);
    });
    expect(rejectRequests(requests)[0]?.headers.get('If-Match')).toBe(DETAIL_ETAG);
  });
});

describe('결재 — 성공한 뒤', () => {
  /**
   * **목록·건수·상세가 함께 갱신된다.** 목록만 무효화하면 상세가 낡아 **방금 승인한 요청의
   * 승인 버튼이 다시 활성으로 남고**, 다음 쓰기가 낡은 토큰으로 나가 조용히 409가 된다.
   */
  it('목록·대기 건수·상세를 모두 다시 부른다', async () => {
    const { requests, user } = await renderDecision();

    const before = {
      list: listRequests(requests).length,
      count: countRequests(requests).length,
      detail: detailRequests(requests).length,
    };

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));

    await waitFor(() => {
      expect(listRequests(requests).length).toBeGreaterThan(before.list);
    });
    await waitFor(() => {
      expect(countRequests(requests).length).toBeGreaterThan(before.count);
    });
    await waitFor(() => {
      expect(detailRequests(requests).length).toBeGreaterThan(before.detail);
    });
  });

  it('반려에 성공한 뒤에도 셋을 모두 다시 부른다', async () => {
    const { requests, user } = await renderDecision();

    const before = {
      list: listRequests(requests).length,
      count: countRequests(requests).length,
      detail: detailRequests(requests).length,
    };

    await openRejectDialog(user);
    await user.click(confirmButton(t.decision.reject));

    await waitFor(() => {
      expect(listRequests(requests).length).toBeGreaterThan(before.list);
    });
    await waitFor(() => {
      expect(countRequests(requests).length).toBeGreaterThan(before.count);
    });
    await waitFor(() => {
      expect(detailRequests(requests).length).toBeGreaterThan(before.detail);
    });
  });

  /**
   * **선택을 유지한다.** 승인하면 그 요청은 「내 결재 대기」에서 빠지는데, 그때 `rq`까지
   * 비우면 사용자가 **방금 자기가 무엇을 했는지 확인할 자리**를 잃는다.
   */
  it('고른 요청이 그대로 남고 창이 닫히며 알림이 뜬다', async () => {
    const { user } = await renderDecision();

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));

    expect(await screen.findByText(t.toast.approved)).toBeVisible();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(currentLocation()).toContain('rq=9001');
  });

  /**
   * **응답이 정본이다.** 무효화가 부른 재조회가 도착하기 전까지의 빈 구간을 응답이 메운다 —
   * 그 재조회를 붙잡아 두어 **응답만으로 갱신됐는지**를 가른다.
   */
  it('상세가 결재 응답 그대로 갱신된다 — 재조회를 기다리지 않는다', async () => {
    let served = 0;
    const slowSecondDetail: StubRoute = {
      match: (request) => isDetailPath(new URL(request.url).pathname),
      respond: () => {
        served += 1;

        return jsonResponse(contradictoryMyTurnDetail, { headers: { ETag: DETAIL_ETAG } });
      },
    };

    const { release, user } = await renderDecision(
      decisionRoutes([slowSecondDetail]),
      '?rq=9001',
      '',
      /* 첫 조회는 통과시키고 **무효화가 부른 재조회만** 붙잡는다. */
      (request) => isDetailPath(new URL(request.url).pathname) && served >= 1,
    );

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));

    /* 재조회가 아직 오지 않았는데도 결재 응답의 값이 보인다. */
    expect(await screen.findByText('합성 결재 직후에 남은 의견')).toBeVisible();
    expect(within(decisionPane()).getByText(t.decision.lockNote)).toBeVisible();

    release();
  });

  it('성공한 뒤 의견 입력칸이 비워진다', async () => {
    const { user } = await renderDecision();

    await openRejectDialog(user);
    await user.click(confirmButton(t.decision.reject));

    await screen.findByText(t.toast.rejected);
    expect(commentBox()).toHaveValue('');
  });
});

describe('결재 — 실패 갈래', () => {
  const failing = (status: number, body?: unknown): StubRoute[] =>
    decisionRoutes([failingApproveRoute(status, body)]);

  /** 실패해도 **적은 의견이 남는다** — 다시 치게 만들면 되돌릴 수 없는 조작이 더 위험해진다. */
  const sendAndFail = async (routes: StubRoute[]): Promise<ReturnType<typeof userEvent.setup>> => {
    const { user } = await renderDecision(routes);

    await user.type(commentBox(), '합성 승인 의견');
    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));

    return user;
  };

  it('필드 오류는 그 입력칸에 붙고 의견이 남는다', async () => {
    await sendAndFail(
      failing(400, {
        errors: [{ scope: 'field', field: 'comment', code: 'INVALID', message: '합성 필드 오류' }],
      }),
    );

    expect(await screen.findByText('합성 필드 오류')).toBeVisible();
    expect(commentBox()).toHaveValue('합성 승인 의견');
    /* 창은 닫힌다 — 고칠 자리가 구획이라 열어 두면 손댈 수 없다. */
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('다시 읽어도 풀리지 않는 상태는 그렇게 말한다', async () => {
    await sendAndFail(
      failing(400, {
        errors: [{ scope: 'screen', code: 'STATE_LOCKED', message: '합성 잠금 사유' }],
      }),
    );

    expect(await screen.findByText(messages.stateLocked.title)).toBeVisible();
    expect(screen.getByText('합성 잠금 사유')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: messages.conflict.reloadAction }),
    ).not.toBeInTheDocument();
  });

  it('권한 없음은 다른 문구로 말한다', async () => {
    await sendAndFail(failing(403));

    expect(await screen.findByText(messages.httpError.forbidden)).toBeVisible();
    expect(screen.queryByText(messages.stateLocked.description)).toBeNull();
  });

  it('대상 없음은 일반 실패 문구로 말한다', async () => {
    await sendAndFail(failing(404));

    expect(await screen.findByText(messages.httpError.description)).toBeVisible();
  });

  /** **409에만 「최신 불러오기」가 붙는다** — 다른 실패에 권하면 적어 둔 의견만 버리게 된다. */
  it('충돌에는 최신 불러오기가 붙는다', async () => {
    await sendAndFail(failing(409, { conflictCause: 'user', message: '' }));

    expect(await screen.findByText(messages.conflict.user)).toBeVisible();
    expect(screen.getByRole('button', { name: messages.conflict.reloadAction })).toBeVisible();
  });

  /**
   * **응답을 받지 못한 요청만이 「갔는지 모르는」 요청이다.** 400·403·409는 서버가 답한
   * 것이라 결재가 일어나지 않았음이 확실하다 — 거기까지 이 문장을 붙이면 없는 불안을 만든다.
   */
  it('네트워크 갈래에만 전달 여부 안내가 붙는다', async () => {
    const { user } = await renderDecision(decisionRoutes([offlineApproveRoute()]));

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));

    expect(await screen.findByText(messages.httpError.offline)).toBeVisible();
    expect(screen.getByText(t.decision.deliveryUnknown)).toBeVisible();
  });

  it('충돌에는 전달 여부 안내가 붙지 않는다', async () => {
    await sendAndFail(failing(409, { conflictCause: 'user', message: '' }));

    await screen.findByText(messages.conflict.user);
    expect(screen.queryByText(t.decision.deliveryUnknown)).toBeNull();
  });

  /**
   * **409 뒤의 길이 실제로 열린다.** 「최신 불러오기」가 상세를 다시 불러 **새 토큰**을
   * 확보하지 않으면 다음 시도가 또 409다 — 같은 값이 두 번 실리는지로 판정한다.
   */
  it('최신 불러오기가 상세를 다시 불러 다음 요청의 토큰이 달라진다', async () => {
    let served = 0;
    const rotatingDetail: StubRoute = {
      match: (request) => isDetailPath(new URL(request.url).pathname),
      respond: () => {
        served += 1;

        return jsonResponse(contradictoryMyTurnDetail, {
          headers: { ETag: `"token-${String(served)}"` },
        });
      },
    };

    const { requests, user } = await renderDecision(
      decisionRoutes([
        rotatingDetail,
        {
          match: (request) => isApprovePath(new URL(request.url).pathname),
          respond: () =>
            approveRequests(requests).length === 1
              ? jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 })
              : jsonResponse(decidedDetail, { headers: { ETag: DECIDED_ETAG } }),
        },
      ]),
    );

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));

    const reload = await screen.findByRole('button', { name: messages.conflict.reloadAction });
    const beforeDetail = detailRequests(requests).length;

    await user.click(reload);

    await waitFor(() => {
      expect(detailRequests(requests).length).toBeGreaterThan(beforeDetail);
    });

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));

    await waitFor(() => {
      expect(approveRequests(requests)).toHaveLength(2);
    });

    const [first, second] = approveRequests(requests);

    expect(first?.headers.get('If-Match')).toBe('"token-1"');
    expect(second?.headers.get('If-Match')).not.toBe(first?.headers.get('If-Match'));
  });
});

describe('결재 — 실패 배너가 매인 대상', () => {
  const failOnce = (): StubRoute[] =>
    decisionRoutes([failingApproveRoute(409, { conflictCause: 'user', message: '' })]);

  const sendFailingApprove = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));
    await screen.findByText(messages.conflict.user);
  };

  /** **안 지움** — 대상이 바뀌면 앞 요청의 판정이 남아 있어서는 안 된다. */
  it('다른 요청으로 옮기면 사라진다', async () => {
    const { user } = await renderDecision(failOnce());

    await sendFailingApprove(user);

    await user.click(screen.getByRole('button', { name: t.actions.selectRow('SYNTH-REQ-002') }));

    await waitFor(() => {
      expect(screen.queryByText(messages.conflict.user)).toBeNull();
    });
  });

  /**
   * **너무 지움** — 정리 의존성에 초안을 넣으면 의견을 한 글자 칠 때마다 사유가 사라진다.
   * 사용자는 그 사유를 **보면서** 고쳐야 한다.
   */
  it('의견을 고쳐도 남는다', async () => {
    const { user } = await renderDecision(failOnce());

    await sendFailingApprove(user);
    await user.type(commentBox(), '가');

    expect(screen.getByText(messages.conflict.user)).toBeVisible();
  });

  /**
   * **창을 여닫아도 남는다**(수명 표 11·12행). 지난 시도가 실패한 것은 아직 참이고,
   * 보낼 때 공통 쓰기 훅이 스스로 지운다 — 열자마자 지우면 창을 닫은 뒤 **왜 다시 보내려
   * 했는지**가 사라지고, 닫을 때 지우면 취소를 누른 대가로 사유를 잃는다.
   */
  it('창을 다시 열고 닫아도 남는다', async () => {
    const { user } = await renderDecision(failOnce());

    await sendFailingApprove(user);

    await user.click(approveButton());
    expect(within(confirmDialog()).queryByText(messages.conflict.user)).toBeNull();
    expect(screen.getByText(messages.conflict.user)).toBeVisible();

    await user.click(confirmButton(messages.common.cancel));

    expect(screen.getByText(messages.conflict.user)).toBeVisible();
  });

  /**
   * **늘 지움** — 정리 의존성에 응답 객체를 넣거나 배열을 없애면 배너가 아예 보이지 않는다.
   *
   * **다시 그려진 것을 눈으로 확인한 뒤에 잰다.** 「요청이 늘었다」까지만 기다리면 응답이
   * 도착하기 전에 단언이 끝나, 정리가 도는 자리를 지나치지 않은 채 통과할 수 있다.
   */
  it('다시 조회로 상세가 새로 와도 남는다', async () => {
    let served = 0;
    const changingDetail: StubRoute = {
      match: (request) => isDetailPath(new URL(request.url).pathname),
      respond: () => {
        served += 1;

        return jsonResponse(
          served === 1
            ? contradictoryMyTurnDetail
            : {
                ...contradictoryMyTurnDetail,
                steps: [
                  { ...contradictoryMyTurnDetail.steps[0], decisionComment: '합성 재조회 뒤 의견' },
                ],
              },
          { headers: { ETag: DETAIL_ETAG } },
        );
      },
    };

    const { user } = await renderDecision(
      decisionRoutes([
        changingDetail,
        failingApproveRoute(409, { conflictCause: 'user', message: '' }),
      ]),
    );

    await sendFailingApprove(user);
    await user.click(screen.getByRole('button', { name: t.actions.reload }));

    /* 새 상세가 실제로 그려졌다 — 여기까지 와야 정리 effect가 도는 자리를 지났다. */
    expect(await screen.findByText('합성 재조회 뒤 의견')).toBeVisible();
    expect(screen.getByText(messages.conflict.user)).toBeVisible();
  });
});

/**
 * 초안이 매인 대상 — **배너와 같은 축(`decisionTargetKey`)이지만 다른 값이다.**
 *
 * 배너는 「보낸 대상과 지금 대상이 같은가」로도 한 번 걸러지지만 초안은 그렇지 않다 —
 * 정리가 도는 자리가 없으면 **앞 요청에 쓴 반려 사유가 다음 요청에 그대로 실린다.**
 */
describe('결재 — 의견 초안이 매인 대상', () => {
  it('다른 요청으로 옮기면 적어 둔 의견이 남지 않는다', async () => {
    const { user } = await renderDecision();

    await user.type(commentBox(), '9001에만 해당하는 합성 반려 사유');
    await user.click(screen.getByRole('button', { name: t.actions.selectRow('SYNTH-REQ-002') }));

    await waitFor(() => {
      expect(currentLocation()).toContain('rq=9002');
    });
    expect(commentBox()).toHaveValue('');
  });

  /** 짝 방향 — 같은 요청을 보는 동안에는 지워지지 않는다(응답이 다시 와도 그렇다). */
  it('같은 요청을 보는 동안 다시 조회해도 의견이 남는다', async () => {
    const { requests, user } = await renderDecision();

    await user.type(commentBox(), '합성 반려 사유');

    const before = detailRequests(requests).length;

    await user.click(screen.getByRole('button', { name: t.actions.reload }));
    await waitFor(() => {
      expect(detailRequests(requests).length).toBeGreaterThan(before);
    });

    expect(commentBox()).toHaveValue('합성 반려 사유');
  });

  /** 앞 요청의 창이 살아남으면 **그 창이 다음 요청을 결재한다** — 대상이 바뀌면 닫는다. */
  it('창이 열린 채 주소로 대상이 바뀌면 창이 닫히고 요청이 나가지 않는다', async () => {
    const { requests, user } = await renderDecision(decisionRoutes(), '?rq=9001', 'rq=9002');

    await openRejectDialog(user);
    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(writeRequests(requests)).toHaveLength(0);
    expect(commentBox()).toHaveValue('');
  });
});

describe('결재 — 전송 중', () => {
  /**
   * **연타해도 요청은 1회다.** 공통 쓰기 훅이 호출마다 새 멱등 키를 만들어(`omf-mes#55`)
   * 두 번 나가면 서버에는 **다른 요청 둘**로 보인다 — 화면의 잠금이 그 자리를 막는 첫째 겹이다.
   */
  it('연타해도 요청이 1회이고 컨트롤이 잠긴다', async () => {
    const { requests, release, user } = await renderDecision(
      decisionRoutes(),
      '?rq=9001',
      '',
      holdApprove,
    );

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));

    await waitFor(() => {
      expect(approveRequests(requests)).toHaveLength(1);
    });

    /* 첫째 겹 — 눈에 보이는 컨트롤이 닫혔다. */
    expect(commentBox()).toBeDisabled();
    expect(approveButton()).toBeDisabled();
    expect(rejectButton()).toBeDisabled();
    expect(confirmButton(t.decision.approve)).toBeDisabled();

    await user.click(confirmButton(t.decision.approve));

    expect(approveRequests(requests)).toHaveLength(1);

    release();
    await screen.findByText(t.toast.approved);
  });

  /**
   * **둘째 겹** — 탭·목록 행·조건 칩·쪽은 잠금을 받지 않는다. 그 길로 대상이 바뀌면
   * 나가는 중인 결재의 결과가 **다른 요청의 맥락에** 나타난다.
   */
  it('탭·목록 행·쪽으로도 대상이 바뀌지 않는다', async () => {
    const { requests, release, user } = await renderDecision(
      [listRoute(requestFixtures, { total: 120 }), countRoute(), detailRoute(), approveRoute()],
      '?rq=9001',
      '',
      holdApprove,
    );

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));
    await waitFor(() => {
      expect(approveRequests(requests)).toHaveLength(1);
    });

    await user.click(tabFor(t.tabs.requested));
    await user.click(screen.getByRole('button', { name: t.actions.selectRow('SYNTH-REQ-002') }));
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    expect(currentLocation()).toContain('rq=9001');
    expect(currentLocation()).not.toContain('tab=requested');
    expect(currentLocation()).not.toContain('page=2');

    release();
    await screen.findByText(t.toast.approved);
  });

  /**
   * **바깥에서 주소가 바뀌는 길** — 뒤로가기·앞으로가기·주소 직접 편집은 잠금 문을 지나지
   * 않는다. 그때 창·배너 정리가 깨어나는데, 그 정리가 **나가는 중인 요청까지 끊으면**
   * 무효화·성공·잠금 해제가 통째로 사라진다. 서버에는 이미 갔는데 화면만 없던 일로 친다.
   */
  it('전송 중 주소로 대상이 바뀌어도 무효화와 성공이 살아 있다', async () => {
    const { requests, release, user } = await renderDecision(
      decisionRoutes(),
      '?rq=9001',
      'rq=9002',
      holdApprove,
    );

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));
    await waitFor(() => {
      expect(approveRequests(requests)).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitFor(() => {
      expect(currentLocation()).toContain('rq=9002');
    });

    /* ① 창이 닫혔다 — 열린 채로 두면 다음 요청을 결재하는 창이 된다. */
    expect(screen.queryByRole('dialog')).toBeNull();
    /* ② 공동 잠금이 살아 있다 — 요청은 아직 날아가는 중이다. */
    expect(approveButton()).toBeDisabled();

    const beforeList = listRequests(requests).length;

    release();

    /* ③ 성공이 사라지지 않는다. */
    expect(await screen.findByText(t.toast.approved)).toBeVisible();
    /* ④ 무효화가 살아 있다 — 없으면 다음 결재가 낡은 토큰으로 나간다. */
    await waitFor(() => {
      expect(listRequests(requests).length).toBeGreaterThan(beforeList);
    });
    /* ⑤ 남의 결과를 새 대상에 찍지 않는다. */
    expect(screen.queryByText('합성 결재 직후에 남은 의견')).toBeNull();
  });

  /**
   * **실패도 자기 대상보다 오래 살지 않는다.**
   *
   * 나가는 중인 쓰기는 끊지 않으므로(`resetIfIdle`) 대상이 바뀐 뒤에 실패가 도착한다.
   * 그것을 그대로 그리면 **9001의 거절 사유가 9002를 보는 화면에** 선다 — 사용자는 자기가
   * 건드린 적 없는 요청이 거절된 줄 안다. 정리 effect는 그 순간 나가는 중이라 비켜 갔고,
   * 막는 것은 「도착한 결과가 지금 대상의 것인가」 하나뿐이다.
   */
  it('전송 중 대상이 바뀌면 뒤늦게 온 실패가 새 대상에 서지 않는다', async () => {
    const { requests, release, user } = await renderDecision(
      decisionRoutes([failingApproveRoute(409, { conflictCause: 'user', message: '' })]),
      '?rq=9001',
      'rq=9002',
      holdApprove,
    );

    await user.click(approveButton());
    await user.click(confirmButton(t.decision.approve));
    await waitFor(() => {
      expect(approveRequests(requests)).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitFor(() => {
      expect(currentLocation()).toContain('rq=9002');
    });

    release();

    /* 잠금이 풀린 것으로 실패가 도착한 것을 안다 — 도착 전에 단언하면 늘 통과한다. */
    await waitFor(() => {
      expect(approveButton()).toBeEnabled();
    });
    expect(screen.queryByText(messages.conflict.user)).toBeNull();
  });
});
