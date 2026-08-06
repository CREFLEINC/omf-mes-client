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
import { itemFixtures, uomFixtures } from './fixtures';
import { ItemExtendedAttrsScreen } from './screen';

const ROUTE = '/master-data/item-extended-attrs';

const ITEMS_PATH = '/mdm/items';
const UOMS_PATH = '/mdm/uoms';

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
