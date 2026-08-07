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

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['확장 속성']);
    expect(screen.queryByRole('tab', { name: '부속 정보' })).not.toBeInTheDocument();
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
