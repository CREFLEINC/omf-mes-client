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
  asnFixtures,
  asnLineFixtures,
  itemFixtures,
  partnerFixtures,
  plantFixtures,
  uomFixtures,
} from './fixtures';
import { InboundScheduleScreen } from './screen';

const t = messages.inboundSchedule;

const ROUTE = '/logistics/inbound-schedule';
const LIST_PATH = '/logistics/asns';
const DETAIL_PATH = '/logistics/asns/7001';
const LINES_PATH = '/logistics/asns/7001/lines';
const PARTNERS_PATH = '/mdm/partners';
const PLANTS_PATH = '/mdm/plants';
const ITEMS_PATH = '/mdm/items';
const UOMS_PATH = '/mdm/uoms';

/**
 * 상세 응답에만 있는 표식. 화면이 상세를 부르지 않는다는 것을 **두 방향으로** 굳힌다 —
 * ① 상세 경로 요청이 0회 ② 이 표식이 화면 어디에도 나타나지 않음.
 * 스텁을 두지 않으면 하네스가 던져 「부르지 않았다」와 「불렀는데 실패했다」가 구분되지 않는다.
 */
const DETAIL_MARKER = 'SAMPLE-ASN-FROM-DETAIL';

/** 참조 목록이 만드는 표시 이름 —「코드 · 이름」이다. 화면이 이 형태로 푼다. */
const SUPPLIER_LABEL = 'SAMPLE-SUP-01 · 합성 공급사 가';

/** 「오늘」은 화면이 `new Date()`로 읽는다 — 픽스처도 같은 기준으로 만들어야 경과 표시가 맞는다. */
const TODAY = new Date();
const ROWS = asnFixtures(TODAY);

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
) => ({ items, page: { page: 1, size: 50, total: items.length, ...page } });

const listRoute = (
  items: unknown[] = ROWS,
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
 * 조건이 걸린 조회에는 그 조건에 맞는 행만 돌려준다.
 * 「고른 건이 갱신된 결과에 없다」를 실제로 만들어 내는 유일한 방법이다.
 */
const filteringListRoute = (): StubRoute => ({
  match: (request) => isGet(request, LIST_PATH),
  respond: (request) => {
    const status = new URL(request.url).searchParams.get('statusCode');
    const items = status === null ? ROWS : ROWS.filter((row) => row.statusCode === status);

    return jsonResponse(listBody(items));
  },
});

const lookupRoute = (pathname: string, items: unknown[]): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse(listBody(items)),
});

/** 참조 목록 넷. 화면이 이름으로 풀 수 있는 정상 상태다. */
const lookupRoutes = (): StubRoute[] => [
  lookupRoute(PARTNERS_PATH, partnerFixtures),
  lookupRoute(PLANTS_PATH, plantFixtures),
  lookupRoute(ITEMS_PATH, itemFixtures),
  lookupRoute(UOMS_PATH, uomFixtures),
];

const failingLookupRoute = (pathname: string): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse({ message: '' }, { status: 500 }),
});

/** 라인 조회. 고른 건의 줄만 돌려준다. */
const linesRoute = (items: unknown[] = asnLineFixtures): StubRoute => ({
  match: (request) => isGet(request, LINES_PATH),
  respond: () => jsonResponse({ items }),
});

const failingLinesRoute = (status = 500): StubRoute => ({
  match: (request) => isGet(request, LINES_PATH),
  respond: () => jsonResponse({ message: '' }, { status }),
});

/**
 * 상세 경로 스텁. **부를 수 있게 두는 것이 요점이다** —
 * 스텁이 없으면 하네스가 던져 「부르지 않았다」를 증명할 수 없다.
 */
const detailRoute = (): StubRoute => ({
  match: (request) => isGet(request, DETAIL_PATH),
  respond: () => jsonResponse({ asn: { ...(ROWS[0] ?? {}), asnNo: DETAIL_MARKER }, lines: [] }),
});

/** 주소가 실제로 어떻게 바뀌는지 본다 — 자리표시 기간이 심기는지 판정할 유일한 근거다. */
const LocationProbe = () => {
  const location = useLocation();

  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

/**
 * **화면 바깥에서** 주소를 갈아 끼운다. 뒤로가기·앞으로가기·주소 직접 편집이 이 경로다 —
 * 셋 모두 화면의 클릭 핸들러를 거치지 않고 검색 파라미터만 바뀐다.
 *
 * 화면은 `useSearchParams`가 주는 값만 읽으므로 **셋을 구분하지 못한다.**
 * 그래서 이 한 부품이 세 경로를 모두 대신한다 — 정리 절차가 핸들러에 들어 있으면 여기서 샌다.
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
      <InboundScheduleScreen />
      <LocationProbe />
      <BackProbe />
      <SearchProbe to={navigateTo} />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, user: userEvent.setup() };
};

/**
 * 응답을 붙잡아 두는 렌더. 「조회를 기다리는 동안」과 「참조 목록이 늦게 오는 순서」를
 * 실제로 만들어야 그 사이의 표기를 판정할 수 있다.
 *
 * `hold`에 든 경로만 붙잡고 나머지는 곧바로 응답한다.
 */
const renderScreenHolding = (
  routes: StubRoute[],
  hold: string[],
  search = '',
): { release: () => void; user: ReturnType<typeof userEvent.setup> } => {
  const stub = createStubFetch(routes);
  let release = (): void => {
    /* 아래 Promise 생성자가 곧바로 채운다. */
  };
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const fetch: StubFetch = async (request) => {
    if (hold.includes(new URL(request.url).pathname)) await gate;

    return stub(request);
  };

  renderWithProviders(
    <>
      <InboundScheduleScreen />
      <LocationProbe />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { release, user: userEvent.setup() };
};

const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

const currentLocation = (): string => screen.getByTestId('location').textContent ?? '';

const listTable = (): HTMLElement => screen.getAllByRole('table')[0] as HTMLElement;

describe('InboundScheduleScreen — 첫 진입 조회', () => {
  /*
   * **조건이 하나도 없어도 조회한다**(이슈 #20 §6 — 이 경로는 파티션 테이블이 아니다).
   * 빈 화면으로 시작하지 않는다.
   */
  it('조건 없이 목록 요청이 1회 나가고 쿼리가 비어 있다', async () => {
    const { requests } = renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-ASN-0001');

    const list = requestsTo(requests, LIST_PATH);

    expect(list).toHaveLength(1);
    expect(list[0]?.url.search).toBe('');
  });

  /* 기본 기간을 심으면 「기간이 필수」로 읽히고, 필수가 아니라는 사실이 화면에서 사라진다. */
  it('자리표시 기간을 주소에 심지 않는다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-ASN-0001');

    expect(currentLocation()).toBe(ROUTE);
  });

  it('결과가 표에 그려지고 배너가 없다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-ASN-0001');

    expect(within(listTable()).getAllByRole('row')).toHaveLength(ROWS.length + 1);
    expect(screen.queryByText(messages.httpError.loadTitle)).not.toBeInTheDocument();
  });

  /* 이 화면은 조회 전용이다 — 계약에 쓰기 오퍼레이션이 하나도 없다. */
  it('쓰기 요청을 하나도 보내지 않는다', async () => {
    const { requests } = renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-ASN-0001');

    expect(requests.every((request) => request.method === 'GET')).toBe(true);
  });
});

describe('InboundScheduleScreen — 조건과 주소', () => {
  it('주소의 조건이 요청 쿼리에 그대로 실린다', async () => {
    const { requests } = renderScreen(
      [listRoute(), ...lookupRoutes()],
      '?from=2026-08-01&to=2026-08-31&supplier=8101&status=SAMPLE_STATUS_A&item=8301&q=SAMPLE-ASN',
    );

    await screen.findByText('SAMPLE-ASN-0001');

    const query = requestsTo(requests, LIST_PATH)[0]?.url.searchParams;

    expect(query?.get('expectedArrivalDateFrom')).toBe('2026-08-01');
    expect(query?.get('expectedArrivalDateTo')).toBe('2026-08-31');
    expect(query?.get('supplierId')).toBe('8101');
    expect(query?.get('statusCode')).toBe('SAMPLE_STATUS_A');
    expect(query?.get('itemId')).toBe('8301');
    expect(query?.get('q')).toBe('SAMPLE-ASN');
  });

  it('조건 줄에서 조회하면 주소와 요청에 함께 나타난다', async () => {
    const { requests, user } = renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-ASN-0001');
    await user.type(screen.getByLabelText(t.fields.q), 'SAMPLE-ASN-0002');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH)).toHaveLength(2);
    });

    expect(currentLocation()).toContain('q=SAMPLE-ASN-0002');
    expect(requestsTo(requests, LIST_PATH)[1]?.url.searchParams.get('q')).toBe('SAMPLE-ASN-0002');
  });

  /*
   * **조작 한 번에 주소 갱신도 한 번이다.** 조건과 쪽을 따로 갱신하면 뒤로가기 기록이 두 칸 늘어
   * 사용자가 뒤로 눌렀는데 같은 자리로 돌아온 것처럼 보인다.
   */
  it('조회 한 번에 히스토리가 한 칸만 늘어난다', async () => {
    const { user } = renderScreen([listRoute(), ...lookupRoutes()], '?page=2');

    await screen.findByText('SAMPLE-ASN-0001');
    await user.type(screen.getByLabelText(t.fields.q), 'SAMPLE-ASN-0002');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(currentLocation()).toContain('q=SAMPLE-ASN-0002');
    });

    // 한 칸만 늘었으면 뒤로 한 번에 처음 주소로 돌아온다.
    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?page=2`);
    });
  });

  /* 정수가 아닌 번호를 그대로 보내면 조회 전체가 400으로 실패한다. */
  it('정수가 아닌 참조 조건은 버리고 조회한다', async () => {
    const { requests } = renderScreen(
      [listRoute(), ...lookupRoutes()],
      '?supplier=abc&item=1.5&page=0',
    );

    await screen.findByText('SAMPLE-ASN-0001');

    const query = requestsTo(requests, LIST_PATH)[0]?.url.searchParams;

    expect(query?.has('supplierId')).toBe(false);
    expect(query?.has('itemId')).toBe(false);
    expect(query?.has('page')).toBe(false);
  });

  /* 한쪽만 채운 기간은 계약이 허용한다 — 막으면 쓸 수 있는 조회를 화면이 잠근다. */
  it('한쪽만 채운 기간으로도 조회가 나간다', async () => {
    const { requests } = renderScreen([listRoute(), ...lookupRoutes()], '?from=2026-08-01');

    await screen.findByText('SAMPLE-ASN-0001');

    const query = requestsTo(requests, LIST_PATH)[0]?.url.searchParams;

    expect(query?.get('expectedArrivalDateFrom')).toBe('2026-08-01');
    expect(query?.has('expectedArrivalDateTo')).toBe(false);
  });

  /*
   * **없는 날짜는 보내지 않는다.** 그대로 보내면 400이 돌아오고 사용자에게는
   * 「조회가 늘 실패한다」로만 보인다. 사유는 조건 줄이 밝힌다.
   */
  it('없는 날짜가 주소에 있으면 요청을 보내지 않고 사유를 낸다', async () => {
    const { requests } = renderScreen([listRoute(), ...lookupRoutes()], '?from=2026-02-31');

    await screen.findByText(t.reasons.periodInvalid);

    expect(requestsTo(requests, LIST_PATH)).toHaveLength(0);
  });

  it('뒤집힌 기간도 요청을 보내지 않는다', async () => {
    const { requests } = renderScreen(
      [listRoute(), ...lookupRoutes()],
      '?from=2026-08-31&to=2026-08-01',
    );

    await screen.findByText(t.reasons.periodReversed);

    expect(requestsTo(requests, LIST_PATH)).toHaveLength(0);
  });
});

describe('InboundScheduleScreen — 쪽 이동', () => {
  it('쪽을 옮기면 주소와 요청이 함께 바뀐다', async () => {
    const { requests, user } = renderScreen([listRoute(ROWS, { total: 120 }), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-ASN-0001');
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(currentLocation()).toContain('page=2');
    });

    expect(requestsTo(requests, LIST_PATH)[1]?.url.searchParams.get('page')).toBe('2');
  });

  /* 기본값을 주소에 적으면 같은 화면의 주소가 두 가지가 된다. */
  it('첫 쪽으로 돌아오면 page 키가 주소에서 사라진다', async () => {
    const { user } = renderScreen(
      [listRoute(ROWS, { page: 2, total: 120 }), ...lookupRoutes()],
      '?page=2',
    );

    await screen.findByText('SAMPLE-ASN-0001');
    await user.click(screen.getByRole('button', { name: t.actions.prevPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  /* 결과는 있는데 이 쪽에는 없다 — 「결과가 없다」와 안내가 갈려야 할 조치가 드러난다. */
  it('쪽 밖이면 첫 쪽으로 가는 안내가 보인다', async () => {
    const { user } = renderScreen(
      [listRoute([], { page: 9, total: 45 }), ...lookupRoutes()],
      '?page=9',
    );

    await screen.findByText(t.empty.beyondLastTitle);

    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  it('결과가 0건이면 빈 상태 안내가 보인다', async () => {
    renderScreen([listRoute([], { total: 0 }), ...lookupRoutes()]);

    expect(await screen.findByText(t.empty.noResultTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.beyondLastTitle)).not.toBeInTheDocument();
  });
});

describe('InboundScheduleScreen — 조회 실패', () => {
  /* 실패를 「없습니다」로 보이면 사용자가 자료가 없는 줄 안다. */
  it('조회에 실패하면 배너와 다시 시도가 나오고 빈 상태 안내는 나오지 않는다', async () => {
    const { requests, user } = renderScreen([failingListRoute(500), ...lookupRoutes()]);

    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();

    const before = requestsTo(requests, LIST_PATH).length;
    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(before);
    });
  });

  it('권한이 없으면 다시 시도를 내지 않는다', async () => {
    renderScreen([failingListRoute(403), ...lookupRoutes()]);

    await screen.findByText(messages.httpError.forbidden);

    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  /*
   * 401은 **403과 갈리고 500과 같은 갈래로 흐른다.** 이 앱에는 인증 만료 특례가 없어
   * 지금은 500과 동작이 같은데, **같다는 사실 자체를 고정한다** —
   * 특례가 조용히 생기면 이 테스트가 먼저 걸린다.
   */
  it('인증 만료(401)는 403이 아니라 500과 같은 갈래로 흐른다', async () => {
    renderScreen([failingListRoute(401), ...lookupRoutes()]);

    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.getByRole('button', { name: messages.common.retry })).toBeInTheDocument();
    expect(screen.queryByText(messages.httpError.forbidden)).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
  });

  it('연결이 끊기면 그 사유를 낸다', async () => {
    renderScreen([
      {
        match: (request) => isGet(request, LIST_PATH),
        respond: () => {
          throw new TypeError('네트워크 연결 실패');
        },
      },
      ...lookupRoutes(),
    ]);

    expect(await screen.findByText(messages.httpError.offline)).toBeInTheDocument();
  });

  /* 조회에 실패했으면 조건 줄은 남는다 — 조건을 고칠 수단이 사라지면 안 된다. */
  it('조회에 실패해도 조건 줄은 남는다', async () => {
    renderScreen([failingListRoute(500), ...lookupRoutes()]);

    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.getByRole('button', { name: messages.common.search })).toBeInTheDocument();
  });
});

describe('InboundScheduleScreen — 참조 값의 세 갈래', () => {
  it('참조 목록이 오면 이름으로 보인다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    expect(await screen.findAllByText(SUPPLIER_LABEL)).not.toHaveLength(0);
  });

  /*
   * **#47이 되살아나는 자리다.** 본 자료가 참조 목록보다 먼저 도착하는 순서를 실제로 만들어,
   * 그 사이에 정상 값이 「알 수 없음」으로 보이지 않는지 본다.
   */
  it('참조 목록이 늦게 오면 그 사이는 로딩 표기이고 「알 수 없음」이 아니다', async () => {
    const { release } = renderScreenHolding(
      [listRoute(), ...lookupRoutes()],
      [PARTNERS_PATH, PLANTS_PATH, ITEMS_PATH],
    );

    await screen.findByText('SAMPLE-ASN-0001');

    expect(listTable()).toHaveTextContent(t.values.referenceLoading);
    expect(listTable()).not.toHaveTextContent(t.values.unknown);

    release();

    expect(await screen.findAllByText(SUPPLIER_LABEL)).not.toHaveLength(0);
  });

  it('참조 목록에 없는 번호는 「알 수 없음」이다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findAllByText(SUPPLIER_LABEL);

    // 7002의 공급사 번호가 참조 목록에 없다.
    expect(listTable()).toHaveTextContent(t.values.unknown);
  });

  it('참조 목록 조회가 실패하면 사유와 다시 시도를 낸다', async () => {
    const { requests, user } = renderScreen([
      listRoute(),
      failingLookupRoute(PARTNERS_PATH),
      lookupRoute(PLANTS_PATH, plantFixtures),
      lookupRoute(ITEMS_PATH, itemFixtures),
      lookupRoute(UOMS_PATH, uomFixtures),
    ]);

    await screen.findByText(t.reasons.referencesFailed);

    expect(listTable()).toHaveTextContent(t.values.referenceFailed);

    const before = requestsTo(requests, PARTNERS_PATH).length;
    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, PARTNERS_PATH).length).toBeGreaterThan(before);
    });
  });

  /*
   * **#44 — 이름으로 풀 수 없어도 내부 번호를 내지 않는다.** 세 갈래 어디에서도 마찬가지다.
   * 이 단언이 화면 전체(표·칩·제목줄)를 훑는다.
   */
  it('참조를 못 푸는 상태에서도 화면에 내부 번호가 보이지 않는다', async () => {
    renderScreen(
      [
        listRoute(),
        failingLookupRoute(PARTNERS_PATH),
        failingLookupRoute(PLANTS_PATH),
        failingLookupRoute(ITEMS_PATH),
        failingLookupRoute(UOMS_PATH),
      ],
      '?supplier=8101&item=8301',
    );

    await screen.findByText(t.reasons.referencesFailed);

    const text = listTable().textContent ?? '';

    for (const id of ['8101', '8102', '8201', '8202', '7001', '7002', '7003']) {
      expect(text).not.toContain(id);
    }
  });
});

describe('InboundScheduleScreen — 조건 초안의 수명', () => {
  /*
   * **#43이 되살아나는 자리다.** 조건 줄에 값을 치는 도중 목록 응답이 도착하면 화면이 다시 그려지고,
   * 되돌림을 참조로 판정하면 그 순간 치던 값이 사라진다.
   */
  it('치는 도중 목록 응답이 도착해도 값이 사라지지 않는다', async () => {
    const { release, user } = renderScreenHolding([listRoute(), ...lookupRoutes()], [LIST_PATH]);

    await user.type(screen.getByLabelText(t.fields.q), 'SAMPLE-ASN-0002');

    release();

    await screen.findByText('SAMPLE-ASN-0001');

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('SAMPLE-ASN-0002');
  });

  /* 짝이 되는 방향 — 주소가 실제로 바뀌면 조건 줄도 그 값으로 되돌아간다. */
  it('바깥에서 주소가 바뀌면 조건 줄이 따라간다', async () => {
    const { user } = renderScreen(
      [filteringListRoute(), ...lookupRoutes()],
      '',
      'q=SAMPLE-ASN-0003',
    );

    await screen.findByText('SAMPLE-ASN-0001');
    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await waitFor(() => {
      expect(screen.getByLabelText(t.fields.q)).toHaveValue('SAMPLE-ASN-0003');
    });
  });
});

/** 첫 행(7001)을 고른다. 라인 픽스처가 그 건의 줄이다. */
const selectFirstRow = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByRole('button', { name: t.actions.selectRow('SAMPLE-ASN-0001') }));
};

describe('InboundScheduleScreen — 건 고르기', () => {
  it('한 건을 고르면 주소에 sel이 붙고 라인이 보인다', async () => {
    const { user } = renderScreen([listRoute(), linesRoute(), detailRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-ASN-0001');
    await selectFirstRow(user);

    await screen.findByRole('group', { name: t.summary.label });

    expect(currentLocation()).toContain('sel=7001');
  });

  /*
   * **상세 경로를 부르지 않는다**(계획 결정 7). 제목줄에 필요한 값은 목록 응답의 행에 이미 있어
   * 상세를 부르면 같은 값을 한 번 더 받는다. 스텁을 두고도 0회여야 「부르지 않는다」가 증명된다.
   */
  it('라인 요청이 1회 나가고 상세 요청은 0회다', async () => {
    const { requests, user } = renderScreen([
      listRoute(),
      linesRoute(),
      detailRoute(),
      ...lookupRoutes(),
    ]);

    await screen.findByText('SAMPLE-ASN-0001');
    await selectFirstRow(user);
    await screen.findByRole('group', { name: t.summary.label });

    expect(requestsTo(requests, LINES_PATH)).toHaveLength(1);
    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(0);
    expect(screen.queryByText(DETAIL_MARKER)).not.toBeInTheDocument();
  });

  /*
   * **단위 참조는 아래 표만 쓴다.** 고르기 전에 부르면 첫 진입의 요청 수가 이유 없이 늘고,
   * 뒤따르는 W-01 화면들이 이 골격을 복제하므로 여기서 풀리면 도메인 전체에서 풀린다.
   *
   * 나머지 참조 셋이 이미 온 것을 함께 단언한다 — 그래야 「단위만 늦다」와
   * 「아직 아무것도 안 왔다」가 구분된다.
   */
  it('단위 참조는 고르기 전에는 부르지 않고 고른 뒤에 1회 부른다', async () => {
    const { requests, user } = renderScreen([
      listRoute(),
      linesRoute(),
      detailRoute(),
      ...lookupRoutes(),
    ]);

    await screen.findByText('SAMPLE-ASN-0001');

    expect(requestsTo(requests, PARTNERS_PATH)).toHaveLength(1);
    expect(requestsTo(requests, ITEMS_PATH)).toHaveLength(1);
    expect(requestsTo(requests, UOMS_PATH)).toHaveLength(0);

    await selectFirstRow(user);
    await screen.findByRole('group', { name: t.summary.label });

    expect(requestsTo(requests, UOMS_PATH)).toHaveLength(1);
  });

  /* 렌더마다 다시 부르면 표를 훑는 동안 요청이 계속 나간다. */
  it('다시 그려져도 라인 요청이 늘지 않는다', async () => {
    const { requests, user } = renderScreen([
      listRoute(),
      linesRoute(),
      detailRoute(),
      ...lookupRoutes(),
    ]);

    await screen.findByText('SAMPLE-ASN-0001');
    await selectFirstRow(user);
    await screen.findByRole('group', { name: t.summary.label });

    // 조건 줄을 건드려 화면을 여러 번 다시 그린다.
    await user.type(screen.getByLabelText(t.fields.q), 'SAMPLE');

    expect(requestsTo(requests, LINES_PATH)).toHaveLength(1);
  });

  /*
   * **고르기·해제는 보이는 행을 바꾸지 않는다**(수명 규칙 3행). 쪽까지 되돌리면
   * 3쪽에서 한 건 골랐다는 이유로 1쪽으로 튄다.
   */
  it('고르기가 쪽과 조건을 바꾸지 않는다', async () => {
    const { user } = renderScreen(
      [listRoute(ROWS, { page: 2, total: 120 }), linesRoute(), detailRoute(), ...lookupRoutes()],
      '?page=2&q=SAMPLE',
    );

    await screen.findByText('SAMPLE-ASN-0001');
    await selectFirstRow(user);

    await waitFor(() => {
      expect(currentLocation()).toContain('sel=7001');
    });

    expect(currentLocation()).toContain('page=2');
    expect(currentLocation()).toContain('q=SAMPLE');
  });

  it('해제하면 sel만 빠지고 쪽과 조건은 그대로다', async () => {
    const { user } = renderScreen(
      [listRoute(ROWS, { page: 2, total: 120 }), linesRoute(), detailRoute(), ...lookupRoutes()],
      '?page=2&q=SAMPLE&sel=7001',
    );

    await screen.findByRole('group', { name: t.summary.label });
    await user.click(
      screen.getByRole('button', { name: t.actions.deselectRow('SAMPLE-ASN-0001') }),
    );

    await waitFor(() => {
      expect(currentLocation()).not.toContain('sel=');
    });

    expect(currentLocation()).toContain('page=2');
    expect(currentLocation()).toContain('q=SAMPLE');
  });
});

describe('InboundScheduleScreen — 고른 건의 수명', () => {
  /* 결과가 통째로 달라진다 — 고른 건이 새 결과에 없을 수 있다(수명 규칙 1행). */
  it('조건을 바꾸면 쪽이 1로 돌아가고 sel이 사라진다', async () => {
    const { user } = renderScreen(
      [filteringListRoute(), linesRoute(), detailRoute(), ...lookupRoutes()],
      '?page=2&sel=7001',
    );

    // 고른 건은 위 표와 제목줄 두 자리에 나온다 — 위 표 안으로 좁혀 기다린다.
    await waitFor(() => {
      expect(within(listTable()).getByText('SAMPLE-ASN-0001')).toBeInTheDocument();
    });
    await user.type(screen.getByLabelText(t.fields.q), 'SAMPLE');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(currentLocation()).toContain('q=SAMPLE');
    });

    expect(currentLocation()).not.toContain('sel=');
    expect(currentLocation()).not.toContain('page=');
  });

  /* 다른 행이 온다 — 고른 건은 그 쪽에 없다(수명 규칙 2행). */
  it('쪽을 옮기면 sel이 사라진다', async () => {
    const { user } = renderScreen(
      [listRoute(ROWS, { total: 120 }), linesRoute(), detailRoute(), ...lookupRoutes()],
      '?sel=7001',
    );

    await screen.findByRole('group', { name: t.summary.label });
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(currentLocation()).toContain('page=2');
    });

    expect(currentLocation()).not.toContain('sel=');
  });

  /*
   * **정리를 클릭 핸들러가 아니라 고른 식별자에 묶는다.** 뒤로가기·앞으로가기·주소 직접 편집은
   * 핸들러를 거치지 않고 `sel`만 바꾸므로, 핸들러에 두면 그 경로가 통째로 샌다.
   */
  it('갱신된 결과에 고른 건이 없으면 sel이 주소에서 사라진다', async () => {
    const { user } = renderScreen(
      [filteringListRoute(), linesRoute(), detailRoute(), ...lookupRoutes()],
      '',
      'status=SAMPLE_STATUS_B&sel=7001',
    );

    await screen.findByText('SAMPLE-ASN-0001');
    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    // 7001은 상태가 다르므로 갱신된 결과에 없다.
    await waitFor(() => {
      expect(currentLocation()).not.toContain('sel=');
    });

    expect(currentLocation()).toContain('status=SAMPLE_STATUS_B');
  });

  /*
   * **받은 결과가 있을 때만 판정한다.** 조회를 기다리는 동안에는 행이 비어 있어,
   * 가드가 없으면 「고른 건이 사라졌다」로 읽혀 아래 표가 깜빡 닫힌다.
   */
  it('응답이 도착하기 전에는 sel을 지우지 않는다', async () => {
    const { release } = renderScreenHolding(
      [listRoute(), linesRoute(), detailRoute(), ...lookupRoutes()],
      [LIST_PATH],
      '?sel=7001',
    );

    await waitFor(() => {
      expect(currentLocation()).toContain('sel=7001');
    });

    release();

    await waitFor(() => {
      expect(within(listTable()).getByText('SAMPLE-ASN-0001')).toBeInTheDocument();
    });

    expect(currentLocation()).toContain('sel=7001');
  });
});

describe('InboundScheduleScreen — 라인 표', () => {
  it('고르기 전에는 안내만 보인다', async () => {
    renderScreen([listRoute(), linesRoute(), detailRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-ASN-0001');

    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  it('라인이 0건이면 아래 표에 빈 상태 안내가 보인다', async () => {
    renderScreen([listRoute(), linesRoute([]), detailRoute(), ...lookupRoutes()], '?sel=7001');

    expect(await screen.findByText(t.empty.noLinesTitle)).toBeInTheDocument();
  });

  /* 위 표가 함께 사라지면 다른 건을 고를 수단까지 없어진다. */
  it('라인 조회에 실패하면 아래 자리에 배너가 보이고 위 표는 그대로다', async () => {
    renderScreen([listRoute(), failingLinesRoute(), detailRoute(), ...lookupRoutes()], '?sel=7001');

    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.getByText('SAMPLE-ASN-0001')).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noLinesTitle)).not.toBeInTheDocument();
  });

  it('무발주 줄도 아래 표에 남는다', async () => {
    renderScreen([listRoute(), linesRoute(), detailRoute(), ...lookupRoutes()], '?sel=7001');

    await screen.findByRole('group', { name: t.summary.label });

    const lineTable = screen.getAllByRole('table')[1] as HTMLElement;

    expect(within(lineTable).getAllByRole('row')).toHaveLength(asnLineFixtures.length + 1);
  });
});
