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
  buMapFixtures,
  businessUnitFixtures,
  externalCodeFixtures,
  itemFixtures,
  partnerFixtures,
  uomConversionFixtures,
  uomFixtures,
} from './fixtures';
import { ItemExtendedAttrsScreen } from './screen';

const ROUTE = '/master-data/item-extended-attrs';

const ITEMS_PATH = '/mdm/items';
const UOMS_PATH = '/mdm/uoms';
const BUSINESS_UNITS_PATH = '/mdm/business-units';
const buMapsPath = (itemId = 1001): string => `${ITEMS_PATH}/${String(itemId)}/bu-item-maps`;
const uomConversionsPath = (itemId = 1001): string =>
  `${ITEMS_PATH}/${String(itemId)}/uom-conversions`;
const externalCodesPath = (itemId = 1001): string =>
  `${ITEMS_PATH}/${String(itemId)}/external-codes`;
const PARTNERS_PATH = '/mdm/partners';

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

const DEFAULT_PAGE: PageStub = { page: 1, size: 50, total: itemFixtures.length };

const itemListRoute = (items = itemFixtures, pageMeta: PageStub = DEFAULT_PAGE): StubRoute => ({
  match: (request) => isGet(request, ITEMS_PATH),
  respond: () => jsonResponse({ items, page: pageMeta }),
});

/**
 * 품목 상세 — `ETag`가 함께 온다(계약 실측).
 *
 * `editability`는 목 서버가 실제로 주는 어긋난 조합(`codeEditable:false` + `reason:'EDITABLE'`)을
 * 그대로 둔다. **화면이 이 값을 읽지 않는다**는 것이 결정 1이다.
 */
const itemDetailRoute = (itemId = 1001): StubRoute => ({
  match: (request) => isGet(request, `${ITEMS_PATH}/${String(itemId)}`),
  respond: () =>
    jsonResponse(
      {
        item: itemFixtures.find((row) => row.itemId === itemId),
        editability: { codeEditable: false, reason: 'EDITABLE', referenceCount: 3 },
      },
      { headers: { ETag: 'W/"7"' } },
    ),
});

const uomsRoute = (items = uomFixtures): StubRoute => ({
  match: (request) => isGet(request, UOMS_PATH),
  respond: () => jsonResponse({ items, page: { page: 1, size: 50, total: items.length } }),
});

const errorRoute = (pathname: string, status = 500): StubRoute => ({
  match: (request) => new URL(request.url).pathname === pathname,
  respond: () => jsonResponse({ message: '조회에 실패했습니다' }, { status }),
});

const isPut = (request: Request, pathname: string): boolean =>
  request.method === 'PUT' && new URL(request.url).pathname === pathname;

/** 확장 속성 저장 — 성공. 응답에도 `ETag`가 온다(계약 실측). */
const itemSaveRoute = (itemId = 1001): StubRoute => ({
  match: (request) => isPut(request, `${ITEMS_PATH}/${String(itemId)}`),
  respond: () =>
    jsonResponse(
      itemFixtures.find((row) => row.itemId === itemId),
      {
        headers: { ETag: 'W/"8"' },
      },
    ),
});

/** 확장 속성 저장 — 실패. 상태 코드와 본문을 그대로 받는다. */
const itemSaveFailureRoute = (status: number, body: unknown, itemId = 1001): StubRoute => ({
  match: (request) => isPut(request, `${ITEMS_PATH}/${String(itemId)}`),
  respond: () => jsonResponse(body, { status }),
});

/* ── 부속 정보 ─────────────────────────────────────────────────────────────── */

/** 사업부 매핑 목록 — **`ETag`가 없다**(계약 실측). 쪽 나눔도 없다. */
const buMapsRoute = (items = buMapFixtures, itemId = 1001): StubRoute => ({
  match: (request) => isGet(request, buMapsPath(itemId)),
  respond: () => jsonResponse({ items }),
});

/** 사업부 매핑 치환 — 성공. 서버가 행 번호를 새로 매겨 돌려준다. */
const buMapSaveRoute = (items = buMapFixtures, itemId = 1001): StubRoute => ({
  match: (request) => isPut(request, buMapsPath(itemId)),
  respond: () => jsonResponse({ items }),
});

const buMapSaveFailureRoute = (status: number, body: unknown, itemId = 1001): StubRoute => ({
  match: (request) => isPut(request, buMapsPath(itemId)),
  respond: () => jsonResponse(body, { status }),
});

const businessUnitsRoute = (items = businessUnitFixtures): StubRoute => ({
  match: (request) => isGet(request, BUSINESS_UNITS_PATH),
  respond: () => jsonResponse({ items, page: { page: 1, size: 50, total: items.length } }),
});

/**
 * 행 단위 이름 조회(결정 12)의 응답.
 *
 * 픽스처에 없는 번호(9001)는 **404**로 둔다 — 그 행만 「알 수 없음」이 되는지 본다.
 */
const itemDetailByIdRoute = (): StubRoute => ({
  match: (request) =>
    request.method === 'GET' && /^\/mdm\/items\/\d+$/.test(new URL(request.url).pathname),
  respond: (request) => {
    const itemId = Number(new URL(request.url).pathname.split('/').pop());
    const item = itemFixtures.find((row) => row.itemId === itemId);

    if (item === undefined) return jsonResponse({ message: '없는 품목입니다' }, { status: 404 });

    return jsonResponse(
      { item, editability: { codeEditable: false, reason: 'EDITABLE', referenceCount: 3 } },
      { headers: { ETag: 'W/"7"' } },
    );
  },
});

/** 단위 환산 목록 — `ETag`도 쪽 나눔도 없다(계약 실측). */
const uomConversionsRoute = (items = uomConversionFixtures, itemId = 1001): StubRoute => ({
  match: (request) => isGet(request, uomConversionsPath(itemId)),
  respond: () => jsonResponse({ items }),
});

const uomConversionSaveRoute = (items = uomConversionFixtures, itemId = 1001): StubRoute => ({
  match: (request) => isPut(request, uomConversionsPath(itemId)),
  respond: () => jsonResponse({ items }),
});

/** 외부 코드 목록 — `ETag`도 쪽 나눔도 없다(계약 실측). */
const externalCodesRoute = (items = externalCodeFixtures, itemId = 1001): StubRoute => ({
  match: (request) => isGet(request, externalCodesPath(itemId)),
  respond: () => jsonResponse({ items }),
});

const externalCodeSaveRoute = (items = externalCodeFixtures, itemId = 1001): StubRoute => ({
  match: (request) => isPut(request, externalCodesPath(itemId)),
  respond: () => jsonResponse({ items }),
});

const partnersRoute = (items = partnerFixtures): StubRoute => ({
  match: (request) => isGet(request, PARTNERS_PATH),
  respond: () => jsonResponse({ items, page: { page: 1, size: 50, total: items.length } }),
});

/** 부속 정보 탭을 그릴 때 필요한 스텁 한 벌. 하나만 빠져도 하네스가 던진다. */
const subsidiaryRoutes = (): StubRoute[] => [
  itemListRoute(),
  itemDetailByIdRoute(),
  uomsRoute(),
  businessUnitsRoute(),
  partnersRoute(),
  buMapsRoute(),
  uomConversionsRoute(),
  externalCodesRoute(),
];

/** UUID 형식인지. 고정 문자열 멱등 키를 쓰면 서버가 400으로 되돌린다(계약 실측). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 뒤로가기를 눌러 보기 위한 탐침.
 *
 * 하네스가 `MemoryRouter`라 브라우저 히스토리가 없다 — 라우터가 쌓은 칸을 보려면
 * 트리 안에서 `navigate(-1)`을 부르고 그때의 주소를 읽는 수밖에 없다.
 */
interface HistoryProbe {
  search: () => string;
  back: () => void;
}

let probeNavigate: ((delta: number) => void) | null = null;
let probeSearch = '';

const RouterProbe = () => {
  const location = useLocation();

  probeNavigate = useNavigate();
  probeSearch = location.search;

  return null;
};

const renderScreen = (routes: StubRoute[], search = '') => {
  const { fetch, requests } = createRecordingFetch(routes);

  probeNavigate = null;
  probeSearch = '';

  const { queryClient } = renderWithProviders(
    <>
      <ItemExtendedAttrsScreen />
      <RouterProbe />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  const history: HistoryProbe = {
    search: () => probeSearch,
    back: () => {
      act(() => {
        probeNavigate?.(-1);
      });
    },
  };

  return { requests, queryClient, history, user: userEvent.setup() };
};

const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

const itemListPane = (): HTMLElement => screen.getByRole('region', { name: '품목' });
const itemOriginPane = (): HTMLElement => screen.getByRole('region', { name: '품목 원본 정보' });

const selectFirstItem = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: 'SYN-ITEM-01' }));
};

/**
 * 원본 구획의 **내용**이 도착할 때까지 기다린다.
 *
 * 구획 자체는 불러오는 중에도 있다(`role="region"`) — 그 상태에는 입력칸도 버튼도 없어
 * 경계 단언이 헛돈다. 값이 실제로 그려진 뒤에 재야 한다.
 */
const findOriginContent = (): Promise<HTMLElement> => screen.findByLabelText('품목코드');

describe('ItemExtendedAttrsScreen — 좌 목록', () => {
  it('화면에 들어오는 즉시 품목을 조회한다 — 계약에 필수 쿼리가 없다', async () => {
    const { requests } = renderScreen([itemListRoute()]);

    expect(await screen.findByRole('button', { name: 'SYN-ITEM-01' })).toBeInTheDocument();
    expect(requestsTo(requests, ITEMS_PATH)).toHaveLength(1);
  });

  it('제목과 탐색경로를 낸다', async () => {
    renderScreen([itemListRoute()]);

    expect(await screen.findByRole('heading', { name: '품목 확장속성' })).toBeInTheDocument();
  });

  it('주소의 조건을 그대로 서버에 싣는다 — 새로고침에 살아남는다', async () => {
    const { requests } = renderScreen([itemListRoute()], '?q=SYN&inactive=1&page=2');

    await waitFor(() => {
      expect(requestsTo(requests, ITEMS_PATH)).toHaveLength(1);
    });

    const query = requestsTo(requests, ITEMS_PATH)[0]!.url.searchParams;
    expect(query.get('q')).toBe('SYN');
    expect(query.get('includeInactive')).toBe('true');
    expect(query.get('page')).toBe('2');
  });

  it('조회 실패에 배너와 다시 시도가 난다', async () => {
    const { requests, user } = renderScreen([errorRoute(ITEMS_PATH)]);

    expect(await screen.findByText('목록을 불러오지 못했습니다')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    await waitFor(() => {
      expect(requestsTo(requests, ITEMS_PATH).length).toBeGreaterThan(1);
    });
  });
});

/**
 * M11 — 품목을 고르기 전에는 우 칸 조회가 0회다.
 *
 * `enabled` 없이 조회하면 경로에 `0`을 실은 상세 요청이 나간다.
 */
describe('ItemExtendedAttrsScreen — 품목 미선택 (M11)', () => {
  it('우 칸 조회 요청이 0회다', async () => {
    const { requests } = renderScreen([itemListRoute()]);

    await screen.findByRole('button', { name: 'SYN-ITEM-01' });

    expect(requestsTo(requests, `${ITEMS_PATH}/1001`)).toHaveLength(0);
    expect(requestsTo(requests, `${ITEMS_PATH}/0`)).toHaveLength(0);
    expect(requestsTo(requests, UOMS_PATH)).toHaveLength(0);
  });

  it('우 칸이 「먼저 고르세요」를 낸다', async () => {
    renderScreen([itemListRoute()]);

    expect(
      await screen.findByText('좌측에서 품목을 고르면 여기에 그 품목의 정보가 보입니다'),
    ).toBeInTheDocument();
  });

  /* 식별자는 1부터 매겨진다 — 어떤 자원도 가리키지 않는 값으로 조회하지 않는다. */
  it('주소의 품목 번호가 이상하면 상세를 조회하지 않는다', async () => {
    const { requests } = renderScreen([itemListRoute()], '?item=abc');

    await screen.findByRole('button', { name: 'SYN-ITEM-01' });

    expect(requests.filter((request) => request.url.pathname.startsWith(`${ITEMS_PATH}/`))).toEqual(
      [],
    );
  });
});

describe('ItemExtendedAttrsScreen — 품목 선택과 원본 구획', () => {
  it('품목을 고르면 주소에 남고 상세를 조회한다', async () => {
    const { requests, history, user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      uomsRoute(),
    ]);

    await selectFirstItem(user);

    await waitFor(() => {
      expect(requestsTo(requests, `${ITEMS_PATH}/1001`)).toHaveLength(1);
    });
    expect(history.search()).toBe('?item=1001');
  });

  it('원본 4열을 값으로 낸다 — 기준 단위는 이름이다', async () => {
    const { user } = renderScreen([itemListRoute(), itemDetailRoute(), uomsRoute()]);

    await selectFirstItem(user);

    const pane = await screen.findByRole('region', { name: '품목 원본 정보' });
    expect(within(pane).getByLabelText('품목코드')).toHaveTextContent('SYN-ITEM-01');
    expect(within(pane).getByLabelText('기준 단위')).toHaveTextContent('SYN-UOM-01 · 합성 단위 A');
  });

  /* 한 조작은 주소 갱신을 한 번만 낸다 — 뒤로가기가 사용자가 본 적 없는 중간 상태로 떨어지지 않는다. */
  it('품목을 고른 뒤 뒤로가기 한 번이면 고르기 전 주소로 돌아온다', async () => {
    const { history, user } = renderScreen([itemListRoute(), itemDetailRoute(), uomsRoute()]);

    await selectFirstItem(user);
    await waitFor(() => {
      expect(history.search()).toBe('?item=1001');
    });

    history.back();

    expect(history.search()).toBe('');
  });

  it('상세 조회 실패에 배너와 다시 시도가 난다', async () => {
    const { requests, user } = renderScreen([
      itemListRoute(),
      errorRoute(`${ITEMS_PATH}/1001`),
      uomsRoute(),
    ]);

    await selectFirstItem(user);

    expect(await screen.findByText('목록을 불러오지 못했습니다')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    await waitFor(() => {
      expect(requestsTo(requests, `${ITEMS_PATH}/1001`).length).toBeGreaterThan(1);
    });
  });

  /* 알리지 않으면 이름이 이유 없이 비어 보이고 사용자는 값이 사라진 줄 안다. */
  it('단위 목록이 잘리면 그 사실을 알린다', async () => {
    const { user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      {
        match: (request) => isGet(request, UOMS_PATH),
        respond: () =>
          jsonResponse({ items: uomFixtures, page: { page: 1, size: 50, total: 999 } }),
      },
    ]);

    await selectFirstItem(user);

    expect(
      await screen.findByText(
        '선택 목록이 일부만 표시됩니다. 찾는 값이 없으면 담당자에게 알려 주세요.',
      ),
    ).toBeInTheDocument();
  });

  it('단위 목록 조회가 실패하면 그 사실을 알린다', async () => {
    const { user } = renderScreen([itemListRoute(), itemDetailRoute(), errorRoute(UOMS_PATH)]);

    await selectFirstItem(user);

    expect(
      await screen.findByText('선택 목록을 불러오지 못했습니다. 지금 저장된 값만 표시됩니다.'),
    ).toBeInTheDocument();
  });
});

/**
 * M01 — 원본 구획에 쓰기 수단이 없다(화면 수준).
 *
 * 이슈 #14 §6의 첫 번째 함정. 서버가 원본 열의 편집을 막지 않으므로 **화면이 경계를 지킨다.**
 */
describe('ItemExtendedAttrsScreen — 원본 구획에 쓰기 수단이 없다 (M01)', () => {
  it('원본 구획에 폼 컨트롤이 0개다', async () => {
    const { user } = renderScreen([itemListRoute(), itemDetailRoute(), uomsRoute()]);

    await selectFirstItem(user);
    await findOriginContent();

    const pane = itemOriginPane();
    expect(within(pane).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(pane).queryAllByRole('combobox')).toHaveLength(0);
    expect(within(pane).queryAllByRole('checkbox')).toHaveLength(0);
    expect(within(pane).queryAllByRole('switch')).toHaveLength(0);
    expect(within(pane).queryAllByRole('spinbutton')).toHaveLength(0);
  });

  it('원본 구획에 저장 버튼이 없다', async () => {
    const { user } = renderScreen([itemListRoute(), itemDetailRoute(), uomsRoute()]);

    await selectFirstItem(user);
    await findOriginContent();

    expect(within(itemOriginPane()).queryAllByRole('button')).toHaveLength(0);
  });
});

/**
 * M12 — 품목 신규 생성 경로가 없다.
 *
 * 계약에 `POST /mdm/items`가 없다. 좌 목록에 「추가」를 두거나 그 요청을 부르면 잡힌다.
 */
describe('ItemExtendedAttrsScreen — 신규 생성 경로가 없다 (M12)', () => {
  it('화면 어디에서도 품목을 만드는 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen([itemListRoute(), itemDetailRoute(), uomsRoute()]);

    await selectFirstItem(user);
    await findOriginContent();

    expect(requests.filter((request) => request.method !== 'GET')).toEqual([]);
  });

  it('좌 목록에 추가 액션이 없다', async () => {
    renderScreen([itemListRoute()]);

    await screen.findByRole('button', { name: 'SYN-ITEM-01' });

    const labels = within(itemListPane())
      .getAllByRole('button')
      .map((button) => button.textContent ?? '');

    expect(labels.some((label) => label.includes('추가'))).toBe(false);
  });
});

/**
 * M07 — 좌 목록 조건 변경이 선택과 쪽을 비운다.
 *
 * 보이는 행이 달라지는데 선택이 남으면 우 칸의 내용이 어디서 온 것인지 알 수 없다.
 */
describe('ItemExtendedAttrsScreen — 선택 수명 (M07)', () => {
  it('조건을 바꾸면 고른 품목과 쪽이 비워진다', async () => {
    const { history, user } = renderScreen(
      [itemListRoute(), itemDetailRoute(), uomsRoute()],
      '?item=1001&page=3',
    );

    await findOriginContent();

    await user.type(screen.getByRole('searchbox', { name: '품목 검색' }), 'SYN');
    await user.click(screen.getByRole('button', { name: '조회' }));

    await waitFor(() => {
      expect(history.search()).toBe('?q=SYN');
    });
  });

  it('미사용 포함을 켜도 고른 품목이 비워진다', async () => {
    const { history, user } = renderScreen(
      [itemListRoute(), itemDetailRoute(), uomsRoute()],
      '?item=1001',
    );

    await findOriginContent();

    await user.click(screen.getByRole('checkbox', { name: '미사용 포함' }));

    await waitFor(() => {
      expect(history.search()).toBe('?inactive=1');
    });
  });

  it('쪽을 옮기면 고른 품목이 비워진다', async () => {
    const { history, user } = renderScreen(
      [itemListRoute(itemFixtures, { page: 1, size: 2, total: 6 }), itemDetailRoute(), uomsRoute()],
      '?item=1001',
    );

    await findOriginContent();

    await user.click(screen.getByRole('button', { name: '다음' }));

    await waitFor(() => {
      expect(history.search()).toBe('?page=2');
    });
  });

  it('조건을 바꾼 뒤에는 우 칸이 다시 「먼저 고르세요」로 돌아온다', async () => {
    const { user } = renderScreen([itemListRoute(), itemDetailRoute(), uomsRoute()], '?item=1001');

    await findOriginContent();

    await user.click(screen.getByRole('checkbox', { name: '미사용 포함' }));

    expect(
      await screen.findByText('좌측에서 품목을 고르면 여기에 그 품목의 정보가 보입니다'),
    ).toBeInTheDocument();
  });
});

/* ── 탭 ─────────────────────────────────────────────────────────────────── */

describe('ItemExtendedAttrsScreen — 탭', () => {
  /* **만든 탭만 넣는다.** 아직 없는 탭을 목록에 두면 「눌러도 빈 화면」이 생긴다. */
  it('만든 탭만 렌더한다', async () => {
    renderScreen([itemListRoute(), itemDetailRoute(), uomsRoute()], '?item=1001');

    await findOriginContent();

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      '확장 속성',
      '부속 정보',
    ]);
    expect(screen.queryByRole('tab', { name: '자재 명세서' })).not.toBeInTheDocument();
  });

  /* 「먼저 고르세요」를 두 번 쌓으면 무엇을 하라는 안내인지 오히려 흐려진다. */
  it('품목을 고르기 전에는 탭을 렌더하지 않는다', async () => {
    renderScreen([itemListRoute()]);

    await screen.findByRole('button', { name: 'SYN-ITEM-01' });

    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  /* 주소를 손으로 고쳐도 빈 화면이 되지 않아야 한다. */
  it('주소의 탭 값이 이상하면 첫 탭으로 떨어진다', async () => {
    renderScreen([itemListRoute(), itemDetailRoute(), uomsRoute()], '?item=1001&tab=bogus');

    expect(await screen.findByRole('tab', { name: '확장 속성' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  /* 원본 구획이 **탭 밖 맨 위**에 있어야 어느 탭에서도 저장 버튼이 없다는 사실이 보인다(결정 2). */
  it('원본 구획이 탭 밖에 있다', async () => {
    renderScreen([itemListRoute(), itemDetailRoute(), uomsRoute()], '?item=1001');

    await findOriginContent();

    const tabPanel = screen.getByRole('tabpanel');
    expect(within(tabPanel).queryByLabelText('품목코드')).not.toBeInTheDocument();
    expect(within(tabPanel).getByRole('region', { name: '확장 속성' })).toBeInTheDocument();
  });
});

/* ── 확장 속성 저장 ─────────────────────────────────────────────────────── */

const findAttrsPane = async (): Promise<HTMLElement> =>
  screen.findByRole('region', { name: '확장 속성' });

/** 폼을 한 군데 고쳐 저장을 연다. 어느 필드를 고쳐도 결과는 같다. */
const editAndSave = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('보관 조건'), 'X');
  await user.click(screen.getByRole('button', { name: '저장' }));
};

const savedBodies = (requests: RecordedRequest[], itemId = 1001): unknown[] =>
  requests
    .filter(
      (request) =>
        request.method === 'PUT' && request.url.pathname === `${ITEMS_PATH}/${String(itemId)}`,
    )
    .map((request) => JSON.parse(request.body) as unknown);

/** 상세를 몇 번 받았는가. 재조회가 실제로 나갔는지 세는 유일한 근거다. */
const detailGetCount = (requests: RecordedRequest[], itemId = 1001): number =>
  requests.filter(
    (request) =>
      request.method === 'GET' && request.url.pathname === `${ITEMS_PATH}/${String(itemId)}`,
  ).length;

const FORBIDDEN_TEXT = '이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.';
const ERP_SYNC_TEXT =
  '외부 시스템에서 이 항목이 다시 동기화됐습니다. 최신 내용을 불러온 뒤 다시 저장하세요.';
const SHELF_LIFE_REQUIRED_TEXT = '유효기한 관리를 켜면 유효기한(일)을 입력해야 합니다.';

/**
 * M02 — 확장 저장 본문에 원본 4열이 없다.
 * M03 — 본문의 `isActive`가 조회값이다.
 *
 * 서버가 원본 열의 편집을 막지 않는다(계약 실측) — 경계를 지키는 곳이 화면뿐이다.
 */
describe('ItemExtendedAttrsScreen — 저장 본문 (M02·M03)', () => {
  it('계약의 아홉 키만 실린다', async () => {
    const { requests, user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      uomsRoute(),
      itemSaveRoute(),
    ]);

    await selectFirstItem(user);
    await findAttrsPane();
    await editAndSave(user);

    await waitFor(() => {
      expect(savedBodies(requests)).toHaveLength(1);
    });

    expect(Object.keys(savedBodies(requests)[0] as object).sort()).toEqual(
      [
        'fifoPolicyCode',
        'inspectionRequired',
        'isActive',
        'lotControlTypeCode',
        'negativeStockAllowed',
        'openedShelfLifeHours',
        'serialControlTypeCode',
        'shelfLifeDays',
        'storageConditionCode',
      ].sort(),
    );
  });

  it('원본 4열과 번호를 담지 않는다', async () => {
    const { requests, user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      uomsRoute(),
      itemSaveRoute(),
    ]);

    await selectFirstItem(user);
    await findAttrsPane();
    await editAndSave(user);

    await waitFor(() => {
      expect(savedBodies(requests)).toHaveLength(1);
    });

    const body = savedBodies(requests)[0] as Record<string, unknown>;
    for (const key of ['itemCode', 'itemName', 'itemTypeCode', 'baseUomId', 'itemId']) {
      expect(body).not.toHaveProperty(key);
    }
  });

  /* `true`로 굳히면 미사용 품목이 저장하는 순간 조용히 되살아난다. */
  it('미사용 품목을 저장해도 미사용 그대로 실린다', async () => {
    const { requests, user } = renderScreen(
      [itemListRoute(), itemDetailRoute(1003), uomsRoute(), itemSaveRoute(1003)],
      '?item=1003',
    );

    await findAttrsPane();
    await editAndSave(user);

    await waitFor(() => {
      expect(savedBodies(requests, 1003)).toHaveLength(1);
    });

    expect(savedBodies(requests, 1003)[0]).toHaveProperty('isActive', false);
  });

  it('사용 중인 품목은 사용 중으로 실린다', async () => {
    const { requests, user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      uomsRoute(),
      itemSaveRoute(),
    ]);

    await selectFirstItem(user);
    await findAttrsPane();
    await editAndSave(user);

    await waitFor(() => {
      expect(savedBodies(requests)).toHaveLength(1);
    });

    expect(savedBodies(requests)[0]).toHaveProperty('isActive', true);
  });
});

/**
 * M04 — 유효기한 토글 OFF면 `shelfLifeDays`가 널이다.
 * M05 — 토글 ON에 값이 비면 요청이 나가지 않는다.
 */
describe('ItemExtendedAttrsScreen — 유효기한 (M04·M05)', () => {
  it('토글을 끄고 저장하면 널이 실린다', async () => {
    const { requests, user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      uomsRoute(),
      itemSaveRoute(),
    ]);

    await selectFirstItem(user);
    await findAttrsPane();

    await user.click(screen.getByRole('switch', { name: '유효기한 관리' }));
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(savedBodies(requests)).toHaveLength(1);
    });

    expect(savedBodies(requests)[0]).toHaveProperty('shelfLifeDays', null);
  });

  it('토글이 켜져 있는데 값을 비우면 요청이 나가지 않고 인라인 오류가 난다', async () => {
    const { requests, user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      uomsRoute(),
      itemSaveRoute(),
    ]);

    await selectFirstItem(user);
    await findAttrsPane();

    await user.clear(screen.getByLabelText('유효기한(일)'));
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(
      await screen.findByText('유효기한 관리를 켜면 유효기한(일)을 입력해야 합니다.'),
    ).toBeInTheDocument();
    expect(savedBodies(requests)).toHaveLength(0);
  });

  /* 계약 `exclusiveMinimum: 0` — 유효기한(일)과 하한 규칙이 다르다(M06의 화면 쪽 확인). */
  it('개봉 후 유효시간에 0을 넣으면 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      uomsRoute(),
      itemSaveRoute(),
    ]);

    await selectFirstItem(user);
    await findAttrsPane();

    await user.clear(screen.getByLabelText('개봉 후 유효시간(시간)'));
    await user.type(screen.getByLabelText('개봉 후 유효시간(시간)'), '0');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(
      await screen.findByText('개봉 후 유효시간(시간)은 1 이상의 정수로 입력하세요.'),
    ).toBeInTheDocument();
    expect(savedBodies(requests)).toHaveLength(0);
  });
});

/**
 * M14 — 확장 저장에 `If-Match`가 실린다.
 *
 * `etagPath`를 `null`로 주면 토큰 없이 보내고 서버가 400으로 되돌린다(계약 실측 B).
 */
describe('ItemExtendedAttrsScreen — 저장 헤더 (M14)', () => {
  it('상세 조회가 준 토큰을 If-Match로 되돌려 보낸다', async () => {
    const { requests, user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      uomsRoute(),
      itemSaveRoute(),
    ]);

    await selectFirstItem(user);
    await findAttrsPane();
    await editAndSave(user);

    await waitFor(() => {
      expect(savedBodies(requests)).toHaveLength(1);
    });

    const put = requests.find((request) => request.method === 'PUT')!;
    expect(put.headers.get('If-Match')).toBe('W/"7"');
  });

  /* 고정 문자열 멱등 키를 쓰면 서버가 400으로 되돌린다. */
  /**
   * **형식만 보지 않는다.** 고정 문자열도 UUID 형식일 수 있어서, 형식 단언만으로는
   * 「요청마다 새로 만든다」가 지켜지는지 알 수 없다 — 두 번 저장해 값이 서로 다름을 본다.
   * 같은 키가 두 번 가면 서버가 두 번째 저장을 첫 번째의 재시도로 보고 삼킨다.
   */
  it('멱등 키를 요청마다 새로 만든다', async () => {
    const { requests, user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      uomsRoute(),
      itemSaveRoute(),
    ]);

    await selectFirstItem(user);
    await findAttrsPane();
    await editAndSave(user);

    await waitFor(() => {
      expect(savedBodies(requests)).toHaveLength(1);
    });

    // 저장 성공으로 폼이 기준값으로 돌아간다 — 다시 고쳐야 두 번째 저장이 열린다.
    await editAndSave(user);

    await waitFor(() => {
      expect(savedBodies(requests)).toHaveLength(2);
    });

    const keys = requests
      .filter((request) => request.method === 'PUT')
      .map((request) => request.headers.get('Idempotency-Key'));

    expect(keys).toHaveLength(2);
    for (const key of keys) {
      expect(key).toMatch(UUID);
    }
    expect(keys[0]).not.toBe(keys[1]);
  });
});

/**
 * 계획 §5.4 선택 수명 표 3행 — 「품목 선택 **변경**」.
 *
 * 두 방향을 함께 고정한다. 하나만 두면 반대쪽으로 넘어지기 쉬운 자리다 —
 * 「비우지 않는다」만 두면 남의 실패 배너가 남고, 「비운다」만 두면 재클릭이 입력을 지운다.
 */
describe('ItemExtendedAttrsScreen — 품목 선택 변경 (§5.4 3행)', () => {
  it('다른 품목으로 옮기면 저장 실패 배너와 인라인 오류가 사라진다', async () => {
    const { user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      itemDetailRoute(1002),
      uomsRoute(),
      itemSaveFailureRoute(403, { code: 'FORBIDDEN', message: '권한 없음' }),
    ]);

    await selectFirstItem(user);
    await findAttrsPane();

    // 먼저 서버 실패 배너를 세운다.
    await editAndSave(user);
    await screen.findByText(
      '이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.',
    );

    /*
     * 이어서 로컬 검증 오류를 세운다. 요청이 나가지 않으므로 배너가 그대로 남는다.
     *
     * **이 칸을 품목을 옮길 때까지 다시 건드리지 않는다.** 값을 고치면 그 자리에서 오류가
     * 지워져(`changeAttrsValues`) 「품목 변경이 인라인 오류를 지운다」가 검사되지 않는다 —
     * 오류가 이미 없는 상태를 「사라졌다」로 읽는 헛도는 단언이 된다.
     */
    await user.clear(screen.getByLabelText('개봉 후 유효시간(시간)'));
    await user.type(screen.getByLabelText('개봉 후 유효시간(시간)'), '0');
    await user.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('개봉 후 유효시간(시간)은 1 이상의 정수로 입력하세요.');

    await user.click(screen.getByRole('button', { name: 'SYN-ITEM-02' }));

    await waitFor(() => {
      expect(
        screen.queryByText(
          '이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.',
        ),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.queryByText('개봉 후 유효시간(시간)은 1 이상의 정수로 입력하세요.'),
    ).not.toBeInTheDocument();
  });

  /*
   * 재클릭은 「보이는 행이 달라지는」 조작이 아니다 — 비울 근거가 없다.
   * 비우면 저장하지 않은 입력이 조용히 사라진다(계획 §8 위험 7과 같은 부류).
   */
  it('같은 품목을 다시 눌러도 저장하지 않은 입력이 남는다', async () => {
    const { user } = renderScreen([itemListRoute(), itemDetailRoute(), uomsRoute()], '?item=1001');

    await findAttrsPane();

    await user.type(screen.getByLabelText('보관 조건'), 'ZZZ');
    expect(screen.getByLabelText('보관 조건')).toHaveValue('SYN-STORAGE-01ZZZ');

    await user.click(screen.getByRole('button', { name: 'SYN-ITEM-01' }));

    // 값이 서버 값으로 되돌아가면 여기서 잡힌다.
    expect(screen.getByLabelText('보관 조건')).toHaveValue('SYN-STORAGE-01ZZZ');
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled();
  });

  it('같은 품목을 다시 눌러도 주소가 달라지지 않는다', async () => {
    const { history, user } = renderScreen(
      [itemListRoute(), itemDetailRoute(), uomsRoute()],
      '?item=1001',
    );

    await findAttrsPane();

    await user.click(screen.getByRole('button', { name: 'SYN-ITEM-01' }));

    expect(history.search()).toBe('?item=1001');
  });

  /*
   * **초기화는 클릭이 아니라 고른 품목에 묶여 있다.**
   *
   * 클릭 핸들러에만 두면 뒤로가기·주소 직접 편집으로 품목이 바뀔 때 그 핸들러를 거치지 않아
   * 앞 품목의 실패 배너가 그대로 따라온다 — 사용자는 **지금 품목이** 저장에 실패한 줄 안다.
   */
  it('뒤로가기로 품목이 바뀌면 앞 품목의 저장 실패 배너가 따라오지 않는다', async () => {
    const { history, user } = renderScreen(
      [
        itemListRoute(),
        itemDetailRoute(),
        itemDetailRoute(1002),
        uomsRoute(),
        itemSaveFailureRoute(403, { code: 'FORBIDDEN', message: '권한 없음' }),
        itemSaveFailureRoute(403, { code: 'FORBIDDEN', message: '권한 없음' }, 1002),
      ],
      '?item=1001',
    );

    await findAttrsPane();
    await editAndSave(user);
    await screen.findByText(FORBIDDEN_TEXT);

    // 두 번째 품목에서도 실패시켜, 뒤로 돌아갈 때 배너가 **실제로 떠 있게** 만든다.
    await user.click(screen.getByRole('button', { name: 'SYN-ITEM-02' }));
    await findAttrsPane();
    await editAndSave(user);
    await screen.findByText(FORBIDDEN_TEXT);

    history.back();

    await waitFor(() => {
      expect(history.search()).toBe('?item=1001');
    });
    await waitFor(() => {
      expect(screen.queryByText(FORBIDDEN_TEXT)).not.toBeInTheDocument();
    });
  });

  /*
   * 반대 방향 — **고른 품목이 그대로면 비우지 않는다.**
   * 초기화를 「렌더할 때마다」로 넓히면 입력 도중에 값이 사라지므로 짝으로 고정한다.
   * 검색어 칸은 조회를 걸기 전까지 주소를 바꾸지 않는다 — 화면만 다시 그려지는 조작이다.
   */
  it('고른 품목이 그대로면 화면을 다시 그려도 저장하지 않은 입력이 남는다', async () => {
    const { history, user } = renderScreen(
      [itemListRoute(), itemDetailRoute(), uomsRoute()],
      '?item=1001',
    );

    await findAttrsPane();

    await user.type(screen.getByLabelText('보관 조건'), 'ZZZ');
    await user.type(screen.getByRole('searchbox', { name: '품목 검색' }), 'SYN');

    expect(history.search()).toBe('?item=1001');
    expect(screen.getByLabelText('보관 조건')).toHaveValue('SYN-STORAGE-01ZZZ');
  });
});

/**
 * M26 — 충돌 문구가 공통 규약 문구다.
 *
 * 이슈 #14 §4의 「배치 충돌 전용 문구를 두지 않는다」는 **이 화면이 자기 문구를 만들지 않는다**는 뜻이다.
 * 원인 구분은 공통 배너가 이미 갖고 있으므로 그것을 그대로 소비하는 것이 유일한 답이다.
 */
describe('ItemExtendedAttrsScreen — 저장 실패 (M26)', () => {
  const saveAndExpect = async (status: number, body: unknown, expected: string) => {
    const { user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      uomsRoute(),
      itemSaveFailureRoute(status, body),
    ]);

    await selectFirstItem(user);
    await findAttrsPane();
    await editAndSave(user);

    expect(await screen.findByText(expected)).toBeInTheDocument();
  };

  it('외부 재수신 충돌을 공통 문구로 낸다', async () => {
    await saveAndExpect(
      409,
      { conflictCause: 'erpSync', message: '충돌' },
      '외부 시스템에서 이 항목이 다시 동기화됐습니다. 최신 내용을 불러온 뒤 다시 저장하세요.',
    );
  });

  it('다른 사용자와의 충돌을 공통 문구로 낸다', async () => {
    await saveAndExpect(
      409,
      { conflictCause: 'user', message: '충돌' },
      '다른 사용자가 먼저 저장했습니다. 최신 내용을 불러온 뒤 다시 저장하세요.',
    );
  });

  it('권한 없음을 공통 문구로 낸다', async () => {
    await saveAndExpect(
      403,
      { code: 'FORBIDDEN', message: '권한 없음' },
      '이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.',
    );
  });

  it('서버 검증 오류를 그 칸 옆에 낸다', async () => {
    const { user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      uomsRoute(),
      itemSaveFailureRoute(400, {
        code: 'VALIDATION_ERROR',
        message: '검증 실패',
        errors: [
          { scope: 'field', field: 'shelfLifeDays', code: 'REQUIRED', message: '서버 검증 문구' },
        ],
      }),
    ]);

    await selectFirstItem(user);
    await findAttrsPane();
    await editAndSave(user);

    expect(await screen.findByText('서버 검증 문구')).toBeInTheDocument();
  });

  /* 재조회로 풀리는 것은 충돌뿐이다 — 다른 오류에 「최신 불러오기」를 내면 입력만 버리게 된다. */
  it('충돌에만 최신 불러오기를 낸다', async () => {
    const { user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      uomsRoute(),
      itemSaveFailureRoute(403, { code: 'FORBIDDEN', message: '권한 없음' }),
    ]);

    await selectFirstItem(user);
    await findAttrsPane();
    await editAndSave(user);

    await screen.findByText(
      '이 작업을 수행할 권한이 없습니다. 권한이 필요하면 담당자에게 문의하세요.',
    );
    expect(screen.queryByRole('button', { name: '최신 불러오기' })).not.toBeInTheDocument();
  });
});

/**
 * M30 — 저장 성공 후 상세가 무효화된다.
 * 무효화를 빠뜨리면 보관된 토큰이 낡아 그다음 저장이 조용히 막힌다.
 */
describe('ItemExtendedAttrsScreen — 저장 성공 (M30)', () => {
  it('성공하면 목록과 상세를 다시 조회한다', async () => {
    const { requests, user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      uomsRoute(),
      itemSaveRoute(),
    ]);

    await selectFirstItem(user);
    await findAttrsPane();

    const detailsBefore = requestsTo(requests, `${ITEMS_PATH}/1001`).filter(
      (request) => request.method === 'GET',
    ).length;

    await editAndSave(user);

    await waitFor(() => {
      const detailsAfter = requestsTo(requests, `${ITEMS_PATH}/1001`).filter(
        (request) => request.method === 'GET',
      ).length;
      expect(detailsAfter).toBeGreaterThan(detailsBefore);
    });
  });

  it('성공하면 저장이 다시 닫힌다 — 고친 것이 없어진다', async () => {
    const { user } = renderScreen([
      itemListRoute(),
      itemDetailRoute(),
      uomsRoute(),
      itemSaveRoute(),
    ]);

    await selectFirstItem(user);
    await findAttrsPane();
    await editAndSave(user);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    });
  });
});

/**
 * 「취소」 — 기준값으로 되돌리는 조작이다.
 *
 * 세 가지를 한꺼번에 한다(값 복원 · 인라인 오류 소거 · 저장 실패 배너 소거).
 * 셋을 따로 단언해야 하나가 빠졌을 때 어느 것이 빠졌는지 드러난다 —
 * 핸들러를 통째로 비워도 통과하는 상태를 남기지 않는다.
 */
describe('ItemExtendedAttrsScreen — 취소', () => {
  it('고친 값이 기준값으로 돌아온다', async () => {
    const { user } = renderScreen([itemListRoute(), itemDetailRoute(), uomsRoute()], '?item=1001');

    await findAttrsPane();

    await user.type(screen.getByLabelText('보관 조건'), 'ZZZ');
    expect(screen.getByLabelText('보관 조건')).toHaveValue('SYN-STORAGE-01ZZZ');

    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(screen.getByLabelText('보관 조건')).toHaveValue('SYN-STORAGE-01');
  });

  /* 되돌린 뒤에는 고친 것이 없다 — 저장·취소가 다시 닫혀야 상태와 액션이 어긋나지 않는다. */
  it('취소한 뒤에는 저장과 취소가 다시 닫힌다', async () => {
    const { user } = renderScreen([itemListRoute(), itemDetailRoute(), uomsRoute()], '?item=1001');

    await findAttrsPane();

    await user.type(screen.getByLabelText('보관 조건'), 'ZZZ');
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
  });

  it('인라인 오류와 저장 실패 배너가 함께 사라진다', async () => {
    const { user } = renderScreen(
      [
        itemListRoute(),
        itemDetailRoute(),
        uomsRoute(),
        itemSaveFailureRoute(403, { code: 'FORBIDDEN', message: '권한 없음' }),
      ],
      '?item=1001',
    );

    await findAttrsPane();

    // 서버 실패 배너를 먼저 세운다.
    await editAndSave(user);
    await screen.findByText(FORBIDDEN_TEXT);

    // 이어서 로컬 검증 오류를 세운다 — 요청이 나가지 않으므로 배너가 그대로 남는다.
    await user.clear(screen.getByLabelText('유효기한(일)'));
    await user.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText(SHELF_LIFE_REQUIRED_TEXT);

    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(screen.queryByText(SHELF_LIFE_REQUIRED_TEXT)).not.toBeInTheDocument();
    expect(screen.queryByText(FORBIDDEN_TEXT)).not.toBeInTheDocument();
  });
});

/**
 * 「최신 불러오기」 — 저장 충돌을 푸는 **유일한** 경로다.
 *
 * 계약이 덮어쓰기 강제를 제공하지 않으므로 최신 값을 받아 다시 입력하는 수밖에 없다.
 * **상세를 실제로 다시 받는지**가 이 액션의 전부다 — 배너만 사라지고 재조회가 없으면
 * 보관된 잠금 토큰이 낡은 채로 남아 다음 저장이 같은 충돌로 또 막힌다.
 */
describe('ItemExtendedAttrsScreen — 최신 불러오기', () => {
  it('상세를 한 번 더 받는다', async () => {
    const { requests, user } = renderScreen(
      [
        itemListRoute(),
        itemDetailRoute(),
        uomsRoute(),
        itemSaveFailureRoute(409, { conflictCause: 'erpSync', message: '충돌' }),
      ],
      '?item=1001',
    );

    await findAttrsPane();

    await editAndSave(user);
    await screen.findByText(ERP_SYNC_TEXT);

    const before = detailGetCount(requests);

    await user.click(screen.getByRole('button', { name: '최신 불러오기' }));

    await waitFor(() => {
      expect(detailGetCount(requests)).toBe(before + 1);
    });
  });

  it('배너가 사라진다', async () => {
    const { user } = renderScreen(
      [
        itemListRoute(),
        itemDetailRoute(),
        uomsRoute(),
        itemSaveFailureRoute(409, { conflictCause: 'erpSync', message: '충돌' }),
      ],
      '?item=1001',
    );

    await findAttrsPane();

    await editAndSave(user);
    await screen.findByText(ERP_SYNC_TEXT);

    await user.click(screen.getByRole('button', { name: '최신 불러오기' }));

    await waitFor(() => {
      expect(screen.queryByText(ERP_SYNC_TEXT)).not.toBeInTheDocument();
    });
  });
});

/* ── 부속 정보 탭 ──────────────────────────────────────────────────────────── */

/**
 * 사업부 매핑 구획의 **표까지** 그려지길 기다린다.
 *
 * 구획 자체는 불러오는 중에도 있다 — 그 상태에는 표가 없어 행을 세는 단언이 헛돈다.
 */
const findBuMapPane = async (): Promise<HTMLElement> => {
  const pane = await screen.findByRole('region', { name: '사업부 매핑' });

  await waitFor(() => {
    expect(
      within(pane).queryByRole('status', { name: '사업부 매핑을 불러오는 중' }),
    ).not.toBeInTheDocument();
  });

  return pane;
};

/** 머리 줄을 뺀 자료 줄 수. 좌 목록 표가 함께 잡히지 않도록 구획 안에서만 센다. */
const buMapRowCount = (pane: HTMLElement): number => within(pane).getAllByRole('row').length - 1;

const buMapBodies = (requests: RecordedRequest[], itemId = 1001): unknown[] =>
  requests
    .filter((request) => request.method === 'PUT' && request.url.pathname === buMapsPath(itemId))
    .map((request) => JSON.parse(request.body) as unknown);

const buMapPuts = (requests: RecordedRequest[], itemId = 1001): RecordedRequest[] =>
  requests.filter(
    (request) => request.method === 'PUT' && request.url.pathname === buMapsPath(itemId),
  );

/** 열려 있는 편집 창. 구획에도 같은 이름의 버튼이 있어 창 안으로 좁혀 찾는다. */
const buMapDialog = (): HTMLElement => screen.getByRole('dialog');

/** 사업부 매핑 한 줄을 창에서 만든다. 확인까지 누르면 **표에만** 반영된다. */
const addBuMapRow = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: '매핑 추가' }));

  const dialog = buMapDialog();

  await user.click(within(dialog).getByLabelText('보내는 사업부'));
  await user.click(screen.getByRole('option', { name: 'SYN-BU-01 · 합성 사업부 A' }));

  await user.click(within(dialog).getByLabelText('받는 사업부'));
  await user.click(screen.getByRole('option', { name: 'SYN-BU-02 · 합성 사업부 B' }));

  await user.type(within(dialog).getByLabelText('대상 품목 검색'), 'SYN');
  await user.click(within(dialog).getByRole('button', { name: '찾기' }));
  await user.click(await within(dialog).findByLabelText('대상 품목'));
  await user.click(screen.getByRole('option', { name: 'SYN-ITEM-01 · 합성 품목 A' }));

  await user.type(within(dialog).getByLabelText('유효 시작'), '2026-05-01');

  await user.click(within(dialog).getByRole('button', { name: '확인' }));
};

/**
 * 부속 자원의 조회는 **부속 정보 탭에 들어왔을 때** 켠다.
 *
 * 품목을 고르기만 하고 확장 속성만 보는 동안 세 목록을 받아 둘 이유가 없다.
 * 하위 탭마다 켜지 않는 이유는 §5.4의 「세 초안은 함께 산다」와 같다 —
 * 하위 탭을 옮길 때마다 새로 받으면 편집 중이던 초안이 서버 응답으로 되감긴다.
 */
describe('ItemExtendedAttrsScreen — 부속 조회 시점', () => {
  it('확장 속성 탭에서는 부속을 조회하지 않는다', async () => {
    const { requests } = renderScreen(subsidiaryRoutes(), '?item=1001');

    await findOriginContent();

    expect(requestsTo(requests, buMapsPath())).toHaveLength(0);
    expect(requestsTo(requests, BUSINESS_UNITS_PATH)).toHaveLength(0);
  });

  /* 계약이 경로에 `itemId`를 요구한다 — `enabled` 없이 부르면 `0`을 실은 요청이 나간다. */
  it('품목을 고르기 전에는 부속 탭 주소여도 조회하지 않는다', async () => {
    const { requests } = renderScreen(subsidiaryRoutes(), '?tab=sub');

    await screen.findByRole('button', { name: 'SYN-ITEM-01' });

    expect(requestsTo(requests, buMapsPath())).toHaveLength(0);
    expect(requestsTo(requests, buMapsPath(0))).toHaveLength(0);
  });

  it('부속 정보 탭에 들어가면 사업부 매핑을 조회한다', async () => {
    const { requests } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    await findBuMapPane();

    await waitFor(() => {
      expect(requestsTo(requests, buMapsPath())).toHaveLength(1);
    });
  });

  /* 하위 탭을 옮길 때마다 새로 받으면 초안이 서버 응답으로 되감긴다. */
  it('하위 탭을 옮겨도 사업부 매핑을 다시 받지 않는다', async () => {
    const { requests, user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    await findBuMapPane();
    await waitFor(() => {
      expect(requestsTo(requests, buMapsPath())).toHaveLength(1);
    });

    await user.click(screen.getByRole('tab', { name: '단위 환산' }));
    await user.click(screen.getByRole('tab', { name: '사업부 매핑' }));

    expect(requestsTo(requests, buMapsPath())).toHaveLength(1);
  });
});

describe('ItemExtendedAttrsScreen — 부속 하위 탭', () => {
  it('하위 탭 셋을 낸다', async () => {
    renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    await findBuMapPane();

    const subTabs = screen.getAllByRole('tab').map((tab) => tab.textContent);
    expect(subTabs).toContain('사업부 매핑');
    expect(subTabs).toContain('단위 환산');
    expect(subTabs).toContain('외부 코드');
  });

  /* 「빈 조건·기본값은 키 자체를 두지 않는다」를 하위 탭에도 적용한다. */
  it('기본 하위 탭은 주소에 쓰지 않고, 다른 하위 탭은 주소에 남는다', async () => {
    const { history, user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    await findBuMapPane();
    expect(history.search()).toBe('?item=1001&tab=sub');

    await user.click(screen.getByRole('tab', { name: '외부 코드' }));

    await waitFor(() => {
      expect(history.search()).toBe('?item=1001&tab=sub&sub=ext');
    });
  });

  /* 주소를 손으로 고쳐도 빈 화면이 되지 않아야 한다. */
  it('주소의 하위 탭 값이 이상하면 첫 하위 탭으로 떨어진다', async () => {
    renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub&sub=bogus');

    expect(await screen.findByRole('tab', { name: '사업부 매핑' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  /* 조건을 고칠 때마다 첫 하위 탭으로 튕기면 어디를 보고 있었는지 잃는다. */
  it('조건을 바꿔도 하위 탭이 남는다', async () => {
    const { history, user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub&sub=ext');

    await findOriginContent();

    await user.click(screen.getByRole('checkbox', { name: '미사용 포함' }));

    await waitFor(() => {
      expect(history.search()).toBe('?tab=sub&sub=ext&inactive=1');
    });
  });
});

/**
 * M09 — 탭 변경이 **아무것도 비우지 않는다.**
 *
 * 앞선 화면(W-06-06)은 탭마다 좌 목록이 통째로 달라 전부 비웠다. 여기는 반대다 —
 * 세 탭이 전부 「지금 고른 품목」의 다른 면이라 비울 근거가 없다.
 * W-06-06의 규칙을 그대로 옮기는 뮤테이션이 여기서 잡힌다.
 */
describe('ItemExtendedAttrsScreen — 탭 변경이 아무것도 비우지 않는다 (M09)', () => {
  it('탭을 옮겨도 고른 품목과 조건이 그대로다', async () => {
    const { history, user } = renderScreen(subsidiaryRoutes(), '?q=SYN&item=1001');

    await findOriginContent();

    await user.click(screen.getByRole('tab', { name: '부속 정보' }));

    await waitFor(() => {
      expect(history.search()).toBe('?q=SYN&item=1001&tab=sub');
    });
    expect(await screen.findByLabelText('품목코드')).toHaveTextContent('SYN-ITEM-01');
  });

  it('탭을 옮겨도 확장 폼의 저장하지 않은 입력이 남는다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001');

    await findAttrsPane();

    await user.type(screen.getByLabelText('보관 조건'), 'ZZZ');

    await user.click(screen.getByRole('tab', { name: '부속 정보' }));
    await findBuMapPane();
    await user.click(screen.getByRole('tab', { name: '확장 속성' }));

    expect(await screen.findByLabelText('보관 조건')).toHaveValue('SYN-STORAGE-01ZZZ');
  });

  /* 탭을 옮겼다고 저장 실패 배너까지 지우면 사용자가 실패 사실을 못 본 채 넘어간다. */
  it('탭을 옮겨도 저장 실패 배너가 남는다', async () => {
    const { user } = renderScreen(
      [
        ...subsidiaryRoutes(),
        itemSaveFailureRoute(403, { code: 'FORBIDDEN', message: '권한 없음' }),
      ],
      '?item=1001',
    );

    await findAttrsPane();
    await editAndSave(user);
    await screen.findByText(FORBIDDEN_TEXT);

    await user.click(screen.getByRole('tab', { name: '부속 정보' }));
    await findBuMapPane();
    await user.click(screen.getByRole('tab', { name: '확장 속성' }));

    expect(await screen.findByText(FORBIDDEN_TEXT)).toBeInTheDocument();
  });
});

/**
 * M10 · C12 — 탭을 떠났다 돌아와도 **저장하지 않은 초안이 남는다.**
 *
 * 초안을 탭 안 페인이 소유하면 탭을 옮기는 순간 언마운트되어 조용히 사라진다.
 * 그래서 초안은 화면이 소유한다(§5.4).
 */
describe('ItemExtendedAttrsScreen — 초안 수명 (M10·C12)', () => {
  it('탭을 떠났다 돌아와도 만든 줄이 남는다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    const pane = await findBuMapPane();
    await addBuMapRow(user);

    expect(buMapRowCount(pane)).toBe(3); // 서버 2 + 새로 만든 1

    await user.click(screen.getByRole('tab', { name: '확장 속성' }));
    await findAttrsPane();
    await user.click(screen.getByRole('tab', { name: '부속 정보' }));

    expect(buMapRowCount(await findBuMapPane())).toBe(3);
  });

  it('하위 탭을 떠났다 돌아와도 만든 줄이 남는다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    await findBuMapPane();
    await addBuMapRow(user);

    await user.click(screen.getByRole('tab', { name: '외부 코드' }));
    await user.click(screen.getByRole('tab', { name: '사업부 매핑' }));

    expect(buMapRowCount(await findBuMapPane())).toBe(3);
  });

  /*
   * M08 — 반대 방향. 품목이 달라지면 초안은 남을 자리가 없다.
   * 남기면 **다른 품목의 부속 행**을 지금 품목에 저장하게 된다.
   */
  it('품목을 바꾸면 초안이 비워진다 (M08)', async () => {
    const { user } = renderScreen(
      [...subsidiaryRoutes(), buMapsRoute([], 1002)],
      '?item=1001&tab=sub',
    );

    const pane = await findBuMapPane();
    await addBuMapRow(user);
    expect(buMapRowCount(pane)).toBe(3);

    await user.click(screen.getByRole('button', { name: 'SYN-ITEM-02' }));

    await waitFor(() => {
      expect(screen.getByText('등록된 사업부 매핑이 없습니다')).toBeInTheDocument();
    });
  });

  /*
   * **열려 있던 편집 창도 함께 닫힌다.**
   *
   * 초안·폼은 조회 응답에서 다시 세워지므로 스스로 낫지만 **열린 창은 낫지 않는다** —
   * 남겨 두면 앞 품목의 줄을 지금 품목의 표에 확인해 넣게 된다.
   * 창이 떠 있는 동안 좌 목록은 덮여 있으므로 주소로만 품목이 바뀔 수 있다.
   */
  it('품목이 바뀌면 열려 있던 편집 창이 닫힌다 (M08)', async () => {
    const { history, user } = renderScreen(
      [...subsidiaryRoutes(), buMapsRoute([], 1002), uomConversionsRoute([], 1002)],
      '?item=1002&tab=sub',
    );

    await findBuMapPane();
    await user.click(screen.getByRole('button', { name: 'SYN-ITEM-01' }));

    await findBuMapPane();
    await user.click(screen.getByRole('button', { name: '매핑 추가' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    history.back();

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.queryByLabelText('보내는 사업부')).not.toBeInTheDocument();
  });

  /* 뒤로가기도 같은 규칙이다 — 초기화가 클릭 핸들러에만 있으면 이 경로가 새어 나간다. */
  it('뒤로가기로 품목이 바뀌어도 초안이 따라오지 않는다 (M08)', async () => {
    const { history, user } = renderScreen(
      [...subsidiaryRoutes(), buMapsRoute([], 1002)],
      '?item=1002&tab=sub',
    );

    await findBuMapPane();
    await screen.findByText('등록된 사업부 매핑이 없습니다');

    await user.click(screen.getByRole('button', { name: 'SYN-ITEM-01' }));
    const pane = await findBuMapPane();
    await addBuMapRow(user);
    expect(buMapRowCount(pane)).toBe(3);

    history.back();

    await waitFor(() => {
      expect(history.search()).toBe('?item=1002&tab=sub');
    });
    await waitFor(() => {
      expect(screen.getByText('등록된 사업부 매핑이 없습니다')).toBeInTheDocument();
    });
  });
});

/**
 * C08·C09·C10 · M15·M16·M17·M18 — 전체 치환의 본문·횟수·헤더.
 *
 * 서버가 남는 키를 막지 않으므로(계약 실측) 경계를 지키는 곳이 화면뿐이다.
 */
describe('ItemExtendedAttrsScreen — 사업부 매핑 치환 (M15~M18)', () => {
  it('치환 본문에 서버 식별자와 itemId가 없다 (M15·M16)', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), buMapSaveRoute()],
      '?item=1001&tab=sub',
    );

    const pane = await findBuMapPane();
    await addBuMapRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(buMapBodies(requests)).toHaveLength(1);
    });

    const body = buMapBodies(requests)[0] as { maps: Record<string, unknown>[] };
    expect(body.maps).toHaveLength(3);

    for (const map of body.maps) {
      expect(Object.keys(map).sort()).toEqual([
        'effectiveFrom',
        'effectiveTo',
        'fromBusinessUnitId',
        'toBusinessUnitId',
        'toItemId',
      ]);
    }
  });

  /* 계약: 「fromItemId 는 경로의 itemId 로 고정한다」 — 경로가 정본이다. */
  it('경로에 품목 번호가 실리고 본문에는 실리지 않는다 (M16)', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), buMapSaveRoute()],
      '?item=1001&tab=sub',
    );

    const pane = await findBuMapPane();
    await addBuMapRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(buMapPuts(requests)).toHaveLength(1);
    });

    expect(buMapPuts(requests)[0]?.url.pathname).toBe('/mdm/items/1001/bu-item-maps');
    expect(buMapPuts(requests)[0]?.body).not.toContain('fromItemId');
    expect(buMapPuts(requests)[0]?.body).not.toContain('itemId');
  });

  /*
   * M17 — **`If-Match`가 실리지 않는다.** 계약에 이 쓰기의 그 파라미터 자체가 없고,
   * 목록 조회가 `ETag`를 주지 않아 `etagPath`에 상세 경로를 주면 요청이 멈춘다.
   */
  it('치환 저장이 1회이고 If-Match가 실리지 않는다 (M17)', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), buMapSaveRoute()],
      '?item=1001&tab=sub',
    );

    const pane = await findBuMapPane();
    await addBuMapRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(buMapPuts(requests)).toHaveLength(1);
    });

    const put = buMapPuts(requests)[0]!;
    expect(put.headers.get('If-Match')).toBeNull();
    expect(put.headers.get('Idempotency-Key')).toMatch(UUID);
  });

  /*
   * M18 — 행을 전부 지우면 **빈 배열**을 보낸다.
   * 요청을 생략하면 「지우려 했는데 그대로 남는」 상태가 된다.
   */
  it('행을 전부 지우면 빈 배열을 보낸다 (M18)', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), buMapSaveRoute([])],
      '?item=1001&tab=sub',
    );

    const pane = await findBuMapPane();

    for (const button of within(pane).getAllByRole('button', { name: /매핑 삭제$/ })) {
      await user.click(button);
    }
    // 빈 표에는 빈 상태 줄이 들어가므로 줄 수가 아니라 빈 상태 문구로 잰다.
    expect(within(pane).getByText('등록된 사업부 매핑이 없습니다')).toBeInTheDocument();

    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(buMapBodies(requests)).toHaveLength(1);
    });

    expect(buMapBodies(requests)[0]).toEqual({ maps: [] });
  });

  it('성공하면 목록을 다시 조회한다', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), buMapSaveRoute()],
      '?item=1001&tab=sub',
    );

    await findBuMapPane();
    await waitFor(() => {
      expect(requestsTo(requests, buMapsPath())).toHaveLength(1);
    });

    await addBuMapRow(user);
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(requestsTo(requests, buMapsPath()).filter((r) => r.method === 'GET')).toHaveLength(2);
    });
  });

  /*
   * 창의 확인은 **저장이 아니다.** 확인만으로 요청이 나가면 전체 치환이라는 규약이 깨지고,
   * 사용자가 표를 확인하기 전에 서버가 바뀐다.
   */
  it('창의 확인만으로는 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), buMapSaveRoute()],
      '?item=1001&tab=sub',
    );

    await findBuMapPane();
    await addBuMapRow(user);

    expect(buMapPuts(requests)).toHaveLength(0);
  });

  /* 되돌리기는 서버가 준 목록으로 되돌리는 것이다 — 화면 수준에서 실제로 되돌아가는지 본다. */
  it('취소하면 만든 줄이 사라지고 저장이 다시 닫힌다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    const pane = await findBuMapPane();
    await addBuMapRow(user);
    expect(buMapRowCount(pane)).toBe(3);

    await user.click(within(pane).getByRole('button', { name: '취소' }));

    expect(buMapRowCount(pane)).toBe(2);
    expect(within(pane).getByRole('button', { name: '저장' })).toBeDisabled();
  });

  /* 저장 실패는 이 화면 전용 문구를 만들지 않는다 — 공통 배너를 그대로 소비한다(M26). */
  it('403이 공통 배너 문구로 난다 (M26)', async () => {
    const { user } = renderScreen(
      [
        ...subsidiaryRoutes(),
        buMapSaveFailureRoute(403, { code: 'FORBIDDEN', message: '권한 없음' }),
      ],
      '?item=1001&tab=sub',
    );

    const pane = await findBuMapPane();
    await addBuMapRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    expect(await screen.findByText(FORBIDDEN_TEXT)).toBeInTheDocument();
  });

  /*
   * 이 쓰기에는 낙관적 잠금이 없다 — 충돌이라는 갈래 자체가 없으므로
   * 「최신 불러오기」를 내면 사용자에게 없는 원인을 짚어 주게 된다.
   */
  it('부속 저장 실패에는 최신 불러오기를 내지 않는다', async () => {
    const { user } = renderScreen(
      [
        ...subsidiaryRoutes(),
        buMapSaveFailureRoute(403, { code: 'FORBIDDEN', message: '권한 없음' }),
      ],
      '?item=1001&tab=sub',
    );

    const pane = await findBuMapPane();
    await addBuMapRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await screen.findByText(FORBIDDEN_TEXT);
    expect(screen.queryByRole('button', { name: '최신 불러오기' })).not.toBeInTheDocument();
  });
});

/**
 * 편집 창은 **열 때만 마운트한다.**
 * 디자인 시스템 `Dialog`는 닫혀도 내용이 DOM에 남아, 항상 렌더하면 지난 값이 살아 있다.
 */
describe('ItemExtendedAttrsScreen — 사업부 매핑 편집 창', () => {
  it('열기 전에는 창의 입력칸이 DOM에 없다', async () => {
    renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    await findBuMapPane();

    expect(screen.queryByLabelText('보내는 사업부')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('닫으면 창의 입력칸이 DOM에서 사라진다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    await findBuMapPane();
    await user.click(screen.getByRole('button', { name: '매핑 추가' }));
    expect(screen.getByLabelText('보내는 사업부')).toBeInTheDocument();

    await user.click(within(buMapDialog()).getByRole('button', { name: '취소' }));

    expect(screen.queryByLabelText('보내는 사업부')).not.toBeInTheDocument();
  });

  /* 창이 서버 값을 그대로 들고 열려야 사용자가 무엇을 고치는지 안다. */
  it('수정을 누르면 그 줄의 값이 창에 들어온다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    const pane = await findBuMapPane();
    await user.click(within(pane).getAllByRole('button', { name: /매핑 수정$/ })[0]!);

    expect(within(buMapDialog()).getByLabelText('유효 시작')).toHaveValue('2026-01-01');
  });

  /* 로컬 검증에서 막힌 줄은 표에 들어가지 않는다 — 저장 시점에야 거부되면 안 된다. */
  it('같은 사업부를 고르면 표에 들어가지 않는다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    await findBuMapPane();
    await user.click(screen.getByRole('button', { name: '매핑 추가' }));

    const dialog = buMapDialog();
    await user.click(within(dialog).getByLabelText('보내는 사업부'));
    await user.click(screen.getByRole('option', { name: 'SYN-BU-01 · 합성 사업부 A' }));
    await user.click(within(dialog).getByLabelText('받는 사업부'));
    await user.click(screen.getByRole('option', { name: 'SYN-BU-01 · 합성 사업부 A' }));
    await user.type(within(dialog).getByLabelText('유효 시작'), '2026-05-01');

    await user.click(within(dialog).getByRole('button', { name: '확인' }));

    expect(
      screen.getByText('보내는 사업부와 받는 사업부는 서로 달라야 합니다.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

/** 결정 12 — 번호를 화면에 내지 않는다. 행마다 상세를 부르되 캐시 키를 공유한다. */
describe('ItemExtendedAttrsScreen — 대상 품목 이름 (결정 12)', () => {
  it('대상 품목을 번호가 아니라 이름으로 낸다', async () => {
    renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    await findBuMapPane();

    expect(await screen.findByText('SYN-ITEM-02 · 합성 품목 B')).toBeInTheDocument();
    expect(screen.queryByText('1002')).not.toBeInTheDocument();
  });

  /* 한 행이 실패했다고 나머지 행까지 이름을 잃으면 안 된다. */
  it('이름을 얻지 못한 행만 「알 수 없음」이다', async () => {
    renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    await findBuMapPane();

    expect(await screen.findByText('알 수 없음')).toBeInTheDocument();
    expect(screen.getByText('SYN-ITEM-02 · 합성 품목 B')).toBeInTheDocument();
    expect(screen.queryByText('9001')).not.toBeInTheDocument();
  });

  /*
   * 고른 품목의 상세와 **같은 캐시 키**를 쓴다 — 같은 번호를 두 번 받지 않는다.
   * 여기서 1002는 표의 행이 가리키는 품목이고, 좌 목록에도 있다.
   */
  it('같은 품목을 여러 번 받지 않는다', async () => {
    const { requests } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    await findBuMapPane();
    await screen.findByText('SYN-ITEM-02 · 합성 품목 B');

    expect(requestsTo(requests, `${ITEMS_PATH}/1002`)).toHaveLength(1);
  });
});

/* ── 부속 정보 · 단위 환산 ─────────────────────────────────────────────────── */

const findUomConversionPane = async (): Promise<HTMLElement> => {
  const pane = await screen.findByRole('region', { name: '단위 환산' });

  await waitFor(() => {
    expect(
      within(pane).queryByRole('status', { name: '단위 환산을 불러오는 중' }),
    ).not.toBeInTheDocument();
  });

  return pane;
};

const uomConversionBodies = (requests: RecordedRequest[], itemId = 1001): unknown[] =>
  requests
    .filter(
      (request) => request.method === 'PUT' && request.url.pathname === uomConversionsPath(itemId),
    )
    .map((request) => JSON.parse(request.body) as unknown);

const uomConversionPuts = (requests: RecordedRequest[], itemId = 1001): RecordedRequest[] =>
  requests.filter(
    (request) => request.method === 'PUT' && request.url.pathname === uomConversionsPath(itemId),
  );

/** 단위 환산 하위 탭으로 옮긴다. */
const openUomConversionTab = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('tab', { name: '단위 환산' }));

  return findUomConversionPane();
};

/** 단위 환산 한 줄을 창에서 만든다. 확인까지 누르면 표에만 반영된다. */
const addUomConversionRow = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: '환산 추가' }));

  const dialog = screen.getByRole('dialog');

  await user.click(within(dialog).getByLabelText('변환 전 단위'));
  await user.click(screen.getByRole('option', { name: 'SYN-UOM-01 · 합성 단위 A' }));

  await user.click(within(dialog).getByLabelText('변환 후 단위'));
  await user.click(screen.getByRole('option', { name: 'SYN-UOM-03 · 합성 단위 C' }));

  await user.type(within(dialog).getByLabelText('환산 비율'), '1.5');
  await user.type(within(dialog).getByLabelText('유효 시작'), '2026-05-01');

  await user.click(within(dialog).getByRole('button', { name: '확인' }));
};

describe('ItemExtendedAttrsScreen — 단위 환산 조회 시점', () => {
  it('확장 속성 탭에서는 단위 환산을 조회하지 않는다', async () => {
    const { requests } = renderScreen(subsidiaryRoutes(), '?item=1001');

    await findOriginContent();

    expect(requestsTo(requests, uomConversionsPath())).toHaveLength(0);
  });

  /* 세 초안이 함께 살아야 하므로 부속 탭에 들어올 때 셋을 함께 받는다(§5.4). */
  it('부속 정보 탭에 들어가면 사업부 매핑과 함께 조회한다', async () => {
    const { requests } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    await findBuMapPane();

    await waitFor(() => {
      expect(requestsTo(requests, uomConversionsPath())).toHaveLength(1);
    });
  });
});

/**
 * C08·C09·C10 · M15~M18 — 단위 환산의 전체 치환.
 *
 * 세 부속 자원이 **같은 규칙**을 지킨다. 하나만 검사하면 나머지 둘이 규칙을 어겨도 드러나지 않아
 * 자원마다 같은 단언을 되풀이한다(결정 6 — 셋은 서로를 알지 않는다).
 */
describe('ItemExtendedAttrsScreen — 단위 환산 치환 (M15~M18)', () => {
  it('치환 본문에 서버 식별자와 itemId가 없다 (M15·M16)', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), uomConversionSaveRoute()],
      '?item=1001&tab=sub&sub=uom',
    );

    const pane = await findUomConversionPane();
    await addUomConversionRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(uomConversionBodies(requests)).toHaveLength(1);
    });

    const body = uomConversionBodies(requests)[0] as { conversions: Record<string, unknown>[] };
    expect(body.conversions).toHaveLength(3);

    for (const conversion of body.conversions) {
      expect(Object.keys(conversion).sort()).toEqual([
        'conversionRate',
        'effectiveFrom',
        'effectiveTo',
        'fromUomId',
        'toUomId',
      ]);
    }
    expect(uomConversionPuts(requests)[0]?.body).not.toContain('itemId');
  });

  it('치환 저장이 1회이고 If-Match가 실리지 않는다 (M17)', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), uomConversionSaveRoute()],
      '?item=1001&tab=sub&sub=uom',
    );

    const pane = await findUomConversionPane();
    await addUomConversionRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(uomConversionPuts(requests)).toHaveLength(1);
    });

    const put = uomConversionPuts(requests)[0]!;
    expect(put.url.pathname).toBe('/mdm/items/1001/uom-conversions');
    expect(put.headers.get('If-Match')).toBeNull();
    expect(put.headers.get('Idempotency-Key')).toMatch(UUID);
  });

  it('행을 전부 지우면 빈 배열을 보낸다 (M18)', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), uomConversionSaveRoute([])],
      '?item=1001&tab=sub&sub=uom',
    );

    const pane = await findUomConversionPane();

    for (const button of within(pane).getAllByRole('button', { name: /환산 삭제$/ })) {
      await user.click(button);
    }
    expect(within(pane).getByText('등록된 단위 환산이 없습니다')).toBeInTheDocument();

    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(uomConversionBodies(requests)).toHaveLength(1);
    });

    expect(uomConversionBodies(requests)[0]).toEqual({ conversions: [] });
  });

  /* 소수점 여덟 자리는 값의 일부다 — 옮기다 잃으면 사용자가 넣지 않은 값이 저장된다. */
  it('소수점 여덟 자리가 본문까지 그대로 간다', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), uomConversionSaveRoute()],
      '?item=1001&tab=sub&sub=uom',
    );

    const pane = await findUomConversionPane();
    await user.click(within(pane).getAllByRole('button', { name: /환산 수정$/ })[1]!);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '확인' }));
    await user.click(within(pane).getAllByRole('button', { name: /환산 삭제$/ })[0]!);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(uomConversionBodies(requests)).toHaveLength(1);
    });

    const body = uomConversionBodies(requests)[0] as { conversions: { conversionRate: number }[] };
    expect(body.conversions[0]?.conversionRate).toBe(0.00012345);
  });

  it('창의 확인만으로는 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), uomConversionSaveRoute()],
      '?item=1001&tab=sub&sub=uom',
    );

    await findUomConversionPane();
    await addUomConversionRow(user);

    expect(uomConversionPuts(requests)).toHaveLength(0);
  });

  it('취소하면 만든 줄이 사라지고 저장이 다시 닫힌다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub&sub=uom');

    const pane = await findUomConversionPane();
    await addUomConversionRow(user);
    expect(within(pane).getAllByRole('row')).toHaveLength(4);

    await user.click(within(pane).getByRole('button', { name: '취소' }));

    expect(within(pane).getAllByRole('row')).toHaveLength(3);
    expect(within(pane).getByRole('button', { name: '저장' })).toBeDisabled();
  });

  it('성공하면 목록을 다시 조회한다', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), uomConversionSaveRoute()],
      '?item=1001&tab=sub&sub=uom',
    );

    const pane = await findUomConversionPane();
    await waitFor(() => {
      expect(requestsTo(requests, uomConversionsPath())).toHaveLength(1);
    });

    await addUomConversionRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(
        requestsTo(requests, uomConversionsPath()).filter((r) => r.method === 'GET'),
      ).toHaveLength(2);
    });
  });

  /*
   * **한 자원을 저장해도 나머지 둘은 다시 받지 않는다.**
   * 함께 무효화하면 편집 중이던 다른 초안이 서버 응답으로 되감긴다.
   */
  it('단위 환산 저장이 사업부 매핑을 다시 받게 하지 않는다', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), uomConversionSaveRoute()],
      '?item=1001&tab=sub&sub=uom',
    );

    const pane = await findUomConversionPane();
    await waitFor(() => {
      expect(requestsTo(requests, buMapsPath())).toHaveLength(1);
    });

    await addUomConversionRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(uomConversionPuts(requests)).toHaveLength(1);
    });
    expect(requestsTo(requests, buMapsPath())).toHaveLength(1);
  });
});

/**
 * §5.4 — **세 초안은 서로 다른 자원이라 함께 산다.**
 * 하위 탭을 옮기는 것은 「보이는 행이 달라지는」 조작이 아니다.
 */
describe('ItemExtendedAttrsScreen — 하위 탭 사이의 초안 수명', () => {
  it('두 하위 탭의 초안이 동시에 살아 있다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    const buPane = await findBuMapPane();
    await addBuMapRow(user);
    expect(buMapRowCount(buPane)).toBe(3);

    const uomPane = await openUomConversionTab(user);
    await addUomConversionRow(user);
    expect(within(uomPane).getAllByRole('row')).toHaveLength(4);

    await user.click(screen.getByRole('tab', { name: '사업부 매핑' }));

    expect(buMapRowCount(await findBuMapPane())).toBe(3);
  });

  /* 반대 방향 — 품목이 달라지면 **셋 다** 비워진다. */
  it('품목을 바꾸면 두 하위 탭의 초안이 함께 비워진다', async () => {
    const { user } = renderScreen(
      [...subsidiaryRoutes(), buMapsRoute([], 1002), uomConversionsRoute([], 1002)],
      '?item=1001&tab=sub',
    );

    await findBuMapPane();
    await addBuMapRow(user);
    await openUomConversionTab(user);
    await addUomConversionRow(user);

    await user.click(screen.getByRole('button', { name: 'SYN-ITEM-02' }));

    await waitFor(() => {
      expect(screen.getByText('등록된 단위 환산이 없습니다')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('tab', { name: '사업부 매핑' }));
    await waitFor(() => {
      expect(screen.getByText('등록된 사업부 매핑이 없습니다')).toBeInTheDocument();
    });
  });
});

/* ── 부속 정보 · 외부 코드 ─────────────────────────────────────────────────── */

const findExternalCodePane = async (): Promise<HTMLElement> => {
  const pane = await screen.findByRole('region', { name: '외부 코드' });

  await waitFor(() => {
    expect(
      within(pane).queryByRole('status', { name: '외부 코드를 불러오는 중' }),
    ).not.toBeInTheDocument();
  });

  return pane;
};

const externalCodeBodies = (requests: RecordedRequest[], itemId = 1001): unknown[] =>
  requests
    .filter(
      (request) => request.method === 'PUT' && request.url.pathname === externalCodesPath(itemId),
    )
    .map((request) => JSON.parse(request.body) as unknown);

const externalCodePuts = (requests: RecordedRequest[], itemId = 1001): RecordedRequest[] =>
  requests.filter(
    (request) => request.method === 'PUT' && request.url.pathname === externalCodesPath(itemId),
  );

/** 외부 코드 한 줄을 창에서 만든다. 확인까지 누르면 표에만 반영된다. */
const addExternalCodeRow = async (
  user: ReturnType<typeof userEvent.setup>,
  systemCode = 'SYN-EXT-09',
) => {
  await user.click(screen.getByRole('button', { name: '외부 코드 추가' }));

  const dialog = screen.getByRole('dialog');

  await user.type(within(dialog).getByLabelText('외부 시스템'), systemCode);
  await user.type(within(dialog).getByLabelText('외부 품목코드'), 'SYN-EXT-ITEM-09');

  await user.click(within(dialog).getByRole('button', { name: '확인' }));
};

describe('ItemExtendedAttrsScreen — 외부 코드 조회 시점', () => {
  it('확장 속성 탭에서는 외부 코드와 거래처를 조회하지 않는다', async () => {
    const { requests } = renderScreen(subsidiaryRoutes(), '?item=1001');

    await findOriginContent();

    expect(requestsTo(requests, externalCodesPath())).toHaveLength(0);
    expect(requestsTo(requests, PARTNERS_PATH)).toHaveLength(0);
  });

  it('부속 정보 탭에 들어가면 셋을 함께 조회한다', async () => {
    const { requests } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    await findBuMapPane();

    await waitFor(() => {
      expect(requestsTo(requests, externalCodesPath())).toHaveLength(1);
    });
    expect(requestsTo(requests, buMapsPath())).toHaveLength(1);
    expect(requestsTo(requests, uomConversionsPath())).toHaveLength(1);
  });
});

/** C08·C09·C10 · M15~M18 — 외부 코드의 전체 치환. 셋째 자원도 같은 규칙을 지킨다. */
describe('ItemExtendedAttrsScreen — 외부 코드 치환 (M15~M18)', () => {
  it('치환 본문에 서버 식별자와 itemId가 없다 (M15·M16)', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), externalCodeSaveRoute()],
      '?item=1001&tab=sub&sub=ext',
    );

    const pane = await findExternalCodePane();
    await addExternalCodeRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(externalCodeBodies(requests)).toHaveLength(1);
    });

    const body = externalCodeBodies(requests)[0] as { externalCodes: Record<string, unknown>[] };
    expect(body.externalCodes).toHaveLength(3);

    for (const code of body.externalCodes) {
      expect(Object.keys(code).sort()).toEqual([
        'externalItemCode',
        'externalSystemCode',
        'partnerId',
      ]);
    }
    expect(externalCodePuts(requests)[0]?.body).not.toContain('itemId');
  });

  it('치환 저장이 1회이고 If-Match가 실리지 않는다 (M17)', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), externalCodeSaveRoute()],
      '?item=1001&tab=sub&sub=ext',
    );

    const pane = await findExternalCodePane();
    await addExternalCodeRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(externalCodePuts(requests)).toHaveLength(1);
    });

    const put = externalCodePuts(requests)[0]!;
    expect(put.url.pathname).toBe('/mdm/items/1001/external-codes');
    expect(put.headers.get('If-Match')).toBeNull();
    expect(put.headers.get('Idempotency-Key')).toMatch(UUID);
  });

  it('행을 전부 지우면 빈 배열을 보낸다 (M18)', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), externalCodeSaveRoute([])],
      '?item=1001&tab=sub&sub=ext',
    );

    const pane = await findExternalCodePane();

    for (const button of within(pane).getAllByRole('button', { name: /외부 코드 삭제$/ })) {
      await user.click(button);
    }
    expect(within(pane).getByText('등록된 외부 코드가 없습니다')).toBeInTheDocument();

    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(externalCodeBodies(requests)).toHaveLength(1);
    });

    expect(externalCodeBodies(requests)[0]).toEqual({ externalCodes: [] });
  });

  /* 계약이 「비우면 (전체)」를 널로 표현한다(A-7) — 빈 문자열을 그대로 보내면 형식 위반이다. */
  it('거래처를 비운 줄은 널로 실린다', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), externalCodeSaveRoute()],
      '?item=1001&tab=sub&sub=ext',
    );

    const pane = await findExternalCodePane();
    await addExternalCodeRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(externalCodeBodies(requests)).toHaveLength(1);
    });

    const body = externalCodeBodies(requests)[0] as {
      externalCodes: { externalSystemCode: string; partnerId: number | null }[];
    };
    const added = body.externalCodes.find((code) => code.externalSystemCode === 'SYN-EXT-09');
    expect(added?.partnerId).toBeNull();
  });

  it('창의 확인만으로는 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), externalCodeSaveRoute()],
      '?item=1001&tab=sub&sub=ext',
    );

    await findExternalCodePane();
    await addExternalCodeRow(user);

    expect(externalCodePuts(requests)).toHaveLength(0);
  });

  it('취소하면 만든 줄이 사라지고 저장이 다시 닫힌다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub&sub=ext');

    const pane = await findExternalCodePane();
    await addExternalCodeRow(user);
    expect(within(pane).getAllByRole('row')).toHaveLength(4);

    await user.click(within(pane).getByRole('button', { name: '취소' }));

    expect(within(pane).getAllByRole('row')).toHaveLength(3);
    expect(within(pane).getByRole('button', { name: '저장' })).toBeDisabled();
  });

  it('성공하면 목록을 다시 조회한다', async () => {
    const { requests, user } = renderScreen(
      [...subsidiaryRoutes(), externalCodeSaveRoute()],
      '?item=1001&tab=sub&sub=ext',
    );

    const pane = await findExternalCodePane();
    await waitFor(() => {
      expect(requestsTo(requests, externalCodesPath())).toHaveLength(1);
    });

    await addExternalCodeRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    await waitFor(() => {
      expect(
        requestsTo(requests, externalCodesPath()).filter((r) => r.method === 'GET'),
      ).toHaveLength(2);
    });
  });

  it('403이 공통 배너 문구로 난다 (M26)', async () => {
    const { user } = renderScreen(
      [
        ...subsidiaryRoutes(),
        {
          match: (request: Request) => isPut(request, externalCodesPath()),
          respond: () => jsonResponse({ code: 'FORBIDDEN', message: '권한 없음' }, { status: 403 }),
        },
      ],
      '?item=1001&tab=sub&sub=ext',
    );

    const pane = await findExternalCodePane();
    await addExternalCodeRow(user);
    await user.click(within(pane).getByRole('button', { name: '저장' }));

    expect(await screen.findByText(FORBIDDEN_TEXT)).toBeInTheDocument();
  });
});

/**
 * M29 — **이 화면 최대의 중복 함정**을 화면 수준에서 잡는다.
 * `COALESCE(partner_id,0)` 접기(A-7) — 거래처를 비운 두 줄은 서버에게 같은 짝이다.
 */
describe('ItemExtendedAttrsScreen — 외부 코드 중복 (M29)', () => {
  it('거래처를 비운 같은 외부 시스템 줄은 표에 들어가지 않는다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub&sub=ext');

    const pane = await findExternalCodePane();

    /* 픽스처 5502가 거래처를 비운 `SYN-EXT-02`다 — 같은 코드를 거래처 없이 하나 더 만든다. */
    await addExternalCodeRow(user, 'SYN-EXT-02');

    expect(screen.getByText(/거래처를 비운 줄끼리도 같은 줄로 봅니다/)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(within(pane).getAllByRole('row')).toHaveLength(3);
  });

  /* 반대 방향 — 거래처가 다르면 같은 외부 시스템이어도 만들 수 있다. */
  it('거래처가 다르면 같은 외부 시스템 줄을 만들 수 있다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub&sub=ext');

    const pane = await findExternalCodePane();

    await user.click(screen.getByRole('button', { name: '외부 코드 추가' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('외부 시스템'), 'SYN-EXT-02');
    await user.click(within(dialog).getByLabelText('거래처'));
    await user.click(screen.getByRole('option', { name: 'SYN-PARTNER-01 · 합성 거래처 A' }));
    await user.type(within(dialog).getByLabelText('외부 품목코드'), 'SYN-EXT-ITEM-09');
    await user.click(within(dialog).getByRole('button', { name: '확인' }));

    expect(within(pane).getAllByRole('row')).toHaveLength(4);
  });
});

/**
 * §5.4 — 세 초안이 **함께 산다.** 하위 탭 셋을 모두 고친 뒤 왕복해도 남아야 하고,
 * 품목이 바뀌면 셋 다 비워져야 한다.
 */
describe('ItemExtendedAttrsScreen — 부속 초안 세 벌 (C12)', () => {
  it('세 하위 탭의 초안이 동시에 살아 있다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub');

    await findBuMapPane();
    await addBuMapRow(user);

    await openUomConversionTab(user);
    await addUomConversionRow(user);

    await user.click(screen.getByRole('tab', { name: '외부 코드' }));
    const extPane = await findExternalCodePane();
    await addExternalCodeRow(user);

    expect(within(extPane).getAllByRole('row')).toHaveLength(4);

    await user.click(screen.getByRole('tab', { name: '단위 환산' }));
    expect(within(await findUomConversionPane()).getAllByRole('row')).toHaveLength(4);

    await user.click(screen.getByRole('tab', { name: '사업부 매핑' }));
    expect(buMapRowCount(await findBuMapPane())).toBe(3);
  });

  it('확장 속성 탭을 다녀와도 세 초안이 남는다', async () => {
    const { user } = renderScreen(subsidiaryRoutes(), '?item=1001&tab=sub&sub=ext');

    await findExternalCodePane();
    await addExternalCodeRow(user);

    await user.click(screen.getByRole('tab', { name: '확장 속성' }));
    await findAttrsPane();
    await user.click(screen.getByRole('tab', { name: '부속 정보' }));

    expect(within(await findExternalCodePane()).getAllByRole('row')).toHaveLength(4);
  });

  it('품목을 바꾸면 세 초안이 함께 비워진다 (M08)', async () => {
    const { user } = renderScreen(
      [
        ...subsidiaryRoutes(),
        buMapsRoute([], 1002),
        uomConversionsRoute([], 1002),
        externalCodesRoute([], 1002),
      ],
      '?item=1001&tab=sub&sub=ext',
    );

    await findExternalCodePane();
    await addExternalCodeRow(user);

    await user.click(screen.getByRole('button', { name: 'SYN-ITEM-02' }));

    await waitFor(() => {
      expect(screen.getByText('등록된 외부 코드가 없습니다')).toBeInTheDocument();
    });
  });
});
