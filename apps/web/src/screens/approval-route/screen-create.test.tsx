import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { businessUnitFixtures, createdRouteFixture, routeFixtures } from './fixtures';
import { ApprovalRouteScreen } from './screen';

/**
 * **승인 유형 값 목록이 확정된 뒤의 등록 경로**를 미리 재는 자리.
 *
 * 지금 `code-options.ts`의 배열은 비어 있고(`omf-mes#64`) 그동안 등록 버튼은 잠긴 채다 —
 * 그래서 **등록 요청이 실제로 무엇을 싣고 나가는지**를 다른 어떤 방법으로도 볼 수 없다.
 * 값 목록이 확정되는 회차가 이 파일을 지우는 회차이고, 그때까지 이 파일이
 * 「배열만 채우면 살아난다」를 화면 수준에서 증명한다.
 *
 * **자리표시 상수 하나만 갈아 끼운다.** 요청·응답은 다른 화면 테스트와 똑같이 스텁 fetch가
 * 맡는다 — 계약 왕복을 흉내 내지 않는다.
 */
vi.mock('./code-options', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./code-options')>();

  return { ...actual, PLACEHOLDER_APPROVAL_TYPE_CODES: ['PURCHASE_ORDER', 'GOODS_ISSUE_DISPOSAL'] };
});

const t = messages.approvalRoute;

const ROUTE = '/system/approval-route';
const ROUTES_PATH = '/app/approval-routes';
const BUSINESS_UNITS_PATH = '/mdm/business-units';

interface RecordedRequest {
  method: string;
  url: URL;
  headers: Headers;
  body: unknown;
}

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
    const raw = request.method === 'GET' ? '' : await request.clone().text();

    requests.push({
      method: request.method,
      url: new URL(request.url),
      headers: new Headers(request.headers),
      body: raw === '' ? null : (JSON.parse(raw) as unknown),
    });

    /* 기록한 **뒤에** 붙잡는다 — 기다리는 동안 무엇이 잠기는가를 재려면 이미 기록돼 있어야 한다. */
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

/** 조준 조회는 목록과 같은 경로를 쓰되 `size` 상수를 싣는다. */
const isProbe = (request: Request): boolean =>
  isGet(request, ROUTES_PATH) && new URL(request.url).searchParams.has('size');

const listBody = (items: unknown[]) => ({
  items,
  page: { page: 1, size: 20, total: items.length },
});

const probeRoute = (items: unknown[] = []): StubRoute => ({
  match: isProbe,
  respond: () => jsonResponse(listBody(items)),
});

const createRoute = (saved: unknown = createdRouteFixture): StubRoute => ({
  match: (request) => request.method === 'POST' && new URL(request.url).pathname === ROUTES_PATH,
  /* 계약이 201에 `ETag`를 싣지만 그것은 **컬렉션 경로**에 캡처된다 — 상세 토큰이 되지 않는다. */
  respond: () => jsonResponse(saved, { status: 201, headers: { ETag: 'collection-token' } }),
});

const allRoutes = (extra: StubRoute[] = []): StubRoute[] => [
  ...extra,
  probeRoute(),
  createRoute(),
  {
    match: (request) => isGet(request, ROUTES_PATH) && !isProbe(request),
    respond: () => jsonResponse(listBody(routeFixtures)),
  },
  {
    match: (request) =>
      request.method === 'GET' &&
      /^\/app\/approval-routes\/[^/]+$/.test(new URL(request.url).pathname),
    respond: () => jsonResponse(createdRouteFixture, { headers: { ETag: 'detail-token' } }),
  },
  {
    match: (request) =>
      request.method === 'GET' &&
      /^\/app\/approval-routes\/[^/]+\/steps$/.test(new URL(request.url).pathname),
    respond: () => jsonResponse({ items: [] }),
  },
  {
    match: (request) => isGet(request, BUSINESS_UNITS_PATH),
    respond: () => jsonResponse(listBody(businessUnitFixtures)),
  },
];

const LocationProbe = () => {
  const location = useLocation();

  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

/**
 * **화면 바깥에서** 주소를 갈아 끼운다. 뒤로가기·앞으로가기·주소 직접 편집이 이 경로다 —
 * 셋 모두 화면의 클릭 핸들러를 거치지 않는다.
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

const listRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter(
    (request) =>
      request.method === 'GET' &&
      request.url.pathname === ROUTES_PATH &&
      !request.url.searchParams.has('size'),
  );

const locationText = (): string => screen.getByTestId('location').textContent ?? '';

const createRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => request.method === 'POST' && request.url.pathname === ROUTES_PATH);

const probeRequests = (requests: RecordedRequest[]): RecordedRequest[] =>
  requests.filter((request) => isProbe(new Request(request.url)));

/** 등록 폼을 열고 승인 유형을 고른 상태까지 간다. */
const openCreateForm = async (
  user: ReturnType<typeof userEvent.setup>,
  approvalTypeCode = 'GOODS_ISSUE_DISPOSAL',
): Promise<HTMLElement> => {
  await screen.findByText('INVENTORY_ADJUSTMENT');
  await user.click(screen.getByRole('button', { name: t.actions.create }));

  const pane = await screen.findByRole('region', { name: t.panes.create });

  await user.click(within(pane).getByRole('combobox', { name: t.fields.approvalTypeCode }));
  await user.click(screen.getByRole('option', { name: approvalTypeCode }));

  return pane;
};

describe('ApprovalRouteScreen(등록) — 값 목록이 차면 등록이 열린다', () => {
  /** **잠금을 상수로 굳히면** 값 목록이 확정돼도 화면이 살아나지 않는다. */
  it('선택지가 차면 자리표시 안내가 사라지고 유형을 고를 수 있다', async () => {
    const { user } = renderScreen(allRoutes());

    const pane = await openCreateForm(user);

    expect(within(pane).queryByText(messages.pendingCode.note)).not.toBeInTheDocument();
    expect(within(pane).queryByText(t.actionReasons.createPendingCode)).not.toBeInTheDocument();
    expect(within(pane).getByRole('button', { name: t.actions.submitCreate })).toBeEnabled();
  });

  it('유형을 고르기 전에는 사유와 함께 잠겨 있다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('INVENTORY_ADJUSTMENT');
    await user.click(screen.getByRole('button', { name: t.actions.create }));

    const pane = await screen.findByRole('region', { name: t.panes.create });

    expect(within(pane).getByRole('button', { name: t.actions.submitCreate })).toBeDisabled();
    expect(within(pane).getByText(t.actionReasons.createNoType)).toBeInTheDocument();
  });
});

describe('ApprovalRouteScreen(등록) — 요청', () => {
  /**
   * **등록에는 `If-Match`가 없다.** 아직 없는 자원이라 잠글 대상이 없고, 상세 경로를 주면
   * 토큰을 찾지 못해 **요청이 나가지 않고 멈춘다**(「등록을 눌러도 아무 일이 없다」).
   */
  it('등록 요청이 멱등 키를 싣고 If-Match는 싣지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    const pane = await openCreateForm(user);

    await user.click(within(pane).getByRole('button', { name: t.actions.submitCreate }));

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(1);
    });

    const sent = createRequests(requests)[0];

    expect(sent?.headers.get('Idempotency-Key')).not.toBeNull();
    expect(sent?.headers.has('If-Match')).toBe(false);
  });

  /** 비운 칸은 **`null`로** 실린다 — 생략으로 비우면 무엇을 보내는지 코드에서 사라진다. */
  it('등록 본문이 네 필드를 명시하고 비운 칸은 null이다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    const pane = await openCreateForm(user);

    await user.click(within(pane).getByRole('button', { name: t.actions.submitCreate }));

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(1);
    });

    expect(createRequests(requests)[0]?.body).toEqual({
      approvalTypeCode: 'GOODS_ISSUE_DISPOSAL',
      businessUnitId: null,
      minValue: null,
      maxValue: null,
    });
  });

  it('값 구간을 채우면 그 값이 실린다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    const pane = await openCreateForm(user);

    await user.type(within(pane).getByLabelText(t.fields.minValue), '0');
    await user.type(within(pane).getByLabelText(t.fields.maxValue), '500');
    await user.click(within(pane).getByRole('button', { name: t.actions.submitCreate }));

    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(1);
    });

    /* 하한 0은 값이다 — 「없음」으로 줄이면 뜻이 바뀐다. */
    expect(createRequests(requests)[0]?.body).toMatchObject({ minValue: 0, maxValue: 500 });
  });
});

describe('ApprovalRouteScreen(등록) — 성공한 뒤', () => {
  /**
   * **주소 갱신은 한 번뿐이다**(`new` 해제 + `ar` 설정을 한 patch로). 두 번 갱신하면 그 사이에
   * 「고른 것도 만드는 것도 아닌」 주소가 히스토리에 남아, 뒤로가기가 사용자가 본 적 없는
   * 화면으로 떨어진다.
   */
  it('새 결재선을 열고 히스토리가 한 칸만 는다', async () => {
    const { user } = renderScreen(allRoutes());

    const pane = await openCreateForm(user);

    await user.click(within(pane).getByRole('button', { name: t.actions.submitCreate }));

    await waitFor(() => {
      expect(locationText()).toContain('ar=9004');
    });
    expect(locationText()).not.toContain('new=');

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(locationText()).toContain('new=1');
    });
  });

  /**
   * **등록 직후는 늘 「사용 중인데 단계가 0인 결재선」이다**(계획 결정 15) — 계약이 등록
   * 본문에 단계를 받지 않고 신규는 항상 사용 중이다. 그 유형의 상신은 그 순간 400이므로
   * 화면이 무엇을 더 해야 하는지 말한다.
   */
  it('단계 구획이 빈 상태로 열리고 무엇을 더 해야 하는지 말한다', async () => {
    const { user } = renderScreen(allRoutes());

    const pane = await openCreateForm(user);

    await user.click(within(pane).getByRole('button', { name: t.actions.submitCreate }));

    expect(await screen.findByText(t.empty.noStepsTitle)).toBeInTheDocument();
    expect(screen.getByText(t.empty.noStepsDescription)).toBeInTheDocument();
  });

  /** 새 결재선의 상세를 부른다 — **그 조회가 잠금 토큰을 확보한다**(201의 토큰은 컬렉션 경로에 있다). */
  it('새 결재선의 상세를 부른다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    const pane = await openCreateForm(user);

    await user.click(within(pane).getByRole('button', { name: t.actions.submitCreate }));

    await waitFor(() => {
      expect(
        requests.filter((request) => request.url.pathname === '/app/approval-routes/9004'),
      ).not.toHaveLength(0);
    });
  });
});

describe('ApprovalRouteScreen(등록) — 활성 중복 선검사', () => {
  /** 등록에는 뺄 자기 행이 없다 — 조준 조회가 낸 사용 중 결재선은 모두 중복이다. */
  it('같은 유형·사업부로 사용 중인 결재선이 있으면 등록 전에 막힌다', async () => {
    const clash = { ...createdRouteFixture, approvalRouteId: 9007, businessUnitId: null };
    const { requests, user } = renderScreen(allRoutes([probeRoute([clash])]));

    const pane = await openCreateForm(user);

    expect(await screen.findByText(t.actionReasons.duplicateActive)).toBeInTheDocument();
    expect(within(pane).getByRole('button', { name: t.actions.submitCreate })).toBeDisabled();
    expect(createRequests(requests)).toHaveLength(0);
  });

  it('유형을 고른 뒤에야 조준 조회가 나간다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findByText('INVENTORY_ADJUSTMENT');
    await user.click(screen.getByRole('button', { name: t.actions.create }));

    const pane = await screen.findByRole('region', { name: t.panes.create });

    expect(probeRequests(requests)).toHaveLength(0);

    /* 조건 줄에도 같은 이름의 선택칸이 있다 — 폼 구획 안에서 집는다. */
    await user.click(within(pane).getByRole('combobox', { name: t.fields.approvalTypeCode }));
    await user.click(screen.getByRole('option', { name: 'GOODS_ISSUE_DISPOSAL' }));

    await waitFor(() => {
      expect(probeRequests(requests)).toHaveLength(1);
    });
    expect(probeRequests(requests)[0]?.url.searchParams.get('approvalTypeCode')).toBe(
      'GOODS_ISSUE_DISPOSAL',
    );
  });
});

describe('ApprovalRouteScreen(등록) — 성공 뒤 목록', () => {
  /**
   * **등록도 「모든 쓰기 성공 뒤 무효화한다」의 네 조작 중 하나다**(계획 결정 12).
   *
   * 등록에는 잠금 토큰이 없어 무효화를 빠뜨려도 다음 저장이 죽지는 않는다 — 그래서 토큰을
   * 재는 감지기들이 이 자리를 지나친다. 남는 결함은 **왼쪽 목록이 방금 만든 결재선을 담지
   * 못한 채로 있는 것**이고, 사용자에게는 「등록했다는데 목록에 없다」로 보인다.
   */
  it('등록에 성공하면 목록이 다시 와서 방금 만든 결재선을 담는다', async () => {
    let created = false;
    const growingList: StubRoute = {
      match: (request) => isGet(request, ROUTES_PATH) && !isProbe(request),
      respond: () =>
        jsonResponse(listBody(created ? [...routeFixtures, createdRouteFixture] : routeFixtures)),
    };
    const markCreated: StubRoute = {
      match: (request) =>
        request.method === 'POST' && new URL(request.url).pathname === ROUTES_PATH,
      respond: () => {
        created = true;

        return jsonResponse(createdRouteFixture, {
          status: 201,
          headers: { ETag: 'collection-token' },
        });
      },
    };

    const { requests, user } = renderScreen(allRoutes([markCreated, growingList]));

    const pane = await openCreateForm(user);
    const before = listRequests(requests).length;

    await user.click(within(pane).getByRole('button', { name: t.actions.submitCreate }));

    await waitFor(() => {
      expect(listRequests(requests).length).toBeGreaterThan(before);
    });

    /* 요청이 한 번 더 나간 것으로 그치지 않고 **목록에 실제로 서는지**까지 본다. */
    const listPane = screen.getByRole('region', { name: t.panes.list });

    await waitFor(() => {
      expect(within(listPane).getByText('GOODS_ISSUE_DISPOSAL')).toBeInTheDocument();
    });
  });
});

describe('ApprovalRouteScreen(등록) — 실패 배너의 매임', () => {
  const REJECTED = {
    errors: [{ scope: 'screen', code: 'SYNTH_REJECTED', message: '합성 등록 거절' }],
  };

  const failingCreateRoute = (): StubRoute => ({
    match: (request) => request.method === 'POST' && new URL(request.url).pathname === ROUTES_PATH,
    respond: () => jsonResponse(REJECTED, { status: 400 }),
  });

  /**
   * **매임을 이름 하나로 세우는 이득이 여기 있다**(전례 PR #91 R3-6).
   *
   * 등록 갈래에서는 고른 결재선 번호가 **내내 없다** — 정리를 그 번호에만 매면 등록 폼을
   * 닫았다 다시 열어도 앞선 거절 사유가 새 폼 위에 그대로 선다. 「고른 결재선과 등록 폼은
   * 함께 성립하지 않는 하나의 자리」라는 규칙은 두 자리를 **한 이름**으로 볼 때만 성립한다.
   *
   * **핸들러를 거치지 않는 길로 잰다.** 「취소」는 스스로 배너를 거두므로 그 길로는 매임이
   * 옳은지 알 수 없다 — 뒤로가기·주소 직접 편집이 effect가 존재하는 이유다.
   */
  it('등록 실패 배너가 폼을 닫았다 다시 열면 사라진다', async () => {
    const { user } = renderScreen(allRoutes([failingCreateRoute()]), '', '');

    const pane = await openCreateForm(user);

    await user.click(within(pane).getByRole('button', { name: t.actions.submitCreate }));
    expect(await screen.findByText('합성 등록 거절')).toBeInTheDocument();

    /* 화면 바깥에서 등록 표시를 떨군다 — 클릭 핸들러를 지나지 않는 길이다. */
    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await waitFor(() => {
      expect(locationText()).not.toContain('new=');
    });

    await user.click(screen.getByRole('button', { name: t.actions.create }));

    const reopened = await screen.findByRole('region', { name: t.panes.create });

    // 선행 단언 — 폼이 실제로 다시 섰어야 「배너가 없다」가 뜻을 갖는다.
    expect(within(reopened).getByRole('button', { name: t.actions.submitCreate })).toBeDisabled();
    expect(screen.queryByText('합성 등록 거절')).not.toBeInTheDocument();
  });
});

describe('ApprovalRouteScreen(등록) — 전송 중 바깥 주소 이동', () => {
  const holdCreate = (request: Request): boolean =>
    request.method === 'POST' && new URL(request.url).pathname === ROUTES_PATH;

  /**
   * **등록의 결과는 새로 생긴 자원이지 그때 보던 대상이 아니다.**
   *
   * 대상이 바뀌었다고 이 되먹임을 버리면 결재선은 서버에 만들어졌는데 화면은 토스트도,
   * 이동도, 목록 갱신도 하지 않는다 — 계획 결정 15가 막으려던 「사용 중인데 단계가 0인
   * 결재선」이 아무도 모르게 남는다.
   */
  it('등록이 나가는 중에 대상이 바뀌어도 잠금이 살아 있고 만든 결재선으로 옮겨 간다', async () => {
    const { requests, release, user } = renderScreen(allRoutes(), '', '', holdCreate);

    const pane = await openCreateForm(user);

    await user.click(within(pane).getByRole('button', { name: t.actions.submitCreate }));
    await waitFor(() => {
      expect(createRequests(requests)).toHaveLength(1);
    });

    /* 바깥에서 등록 표시를 떨군다 — 잠금 문을 지나지 않는 길이다. */
    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await waitFor(() => {
      expect(locationText()).not.toContain('new=');
    });

    /* 공동 잠금이 살아 있다 — 요청은 아직 날아가는 중이다. */
    expect(screen.getByRole('button', { name: t.actions.create })).toBeDisabled();

    release();

    expect(await screen.findByText(messages.common.created)).toBeInTheDocument();
    await waitFor(() => {
      expect(locationText()).toContain('ar=9004');
    });
  });
});
