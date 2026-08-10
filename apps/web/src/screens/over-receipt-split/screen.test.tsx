import { messages } from '@omf-mes/i18n';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { QueryClient } from '@tanstack/react-query';
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
  itemFixtures,
  partnerFixtures,
  plantFixtures,
  purchaseOrderFixtures,
  purchaseOrderLineFixtures,
  uomFixtures,
} from './fixtures';
import { poKeys } from './queries';
import { OverReceiptSplitScreen } from './screen';

const t = messages.overReceiptSplit;

const ROUTE = '/logistics/over-receipt-split';
const LIST_PATH = '/logistics/purchase-orders';
const DETAIL_PATH = '/logistics/purchase-orders/9001';
const LINES_PATH = '/logistics/purchase-orders/9001/lines';
const OTHER_LINES_PATH = '/logistics/purchase-orders/9002/lines';
/** 이 화면이 PR ②에서 쓸 등록 경로. **지금은 부르지 않는다** — 그것을 증명하려고 스텁을 둔다. */
const SPLIT_PATH = '/logistics/inbound-receipts:split';
const PARTNERS_PATH = '/mdm/partners';
const PLANTS_PATH = '/mdm/plants';
const ITEMS_PATH = '/mdm/items';
const UOMS_PATH = '/mdm/uoms';

/**
 * 상세 응답에만 있는 표식. 화면이 발주 상세를 부르지 않는다는 것을 **두 방향으로** 굳힌다 —
 * ① 상세 경로 요청이 0회 ② 이 표식이 화면 어디에도 나타나지 않음.
 * 스텁을 두지 않으면 하네스가 던져 「부르지 않았다」와 「불렀는데 실패했다」가 구분되지 않는다.
 */
const DETAIL_MARKER = 'PO-2026-900001-FROM-DETAIL';

const SUPPLIER_LABEL = 'SAMPLE-SUP-01 · 합성 공급사 가';
const ITEM_LABEL = 'SAMPLE-ITEM-01 · 합성 품목 가';
const UOM_LABEL = 'SAMPLE-EA · 합성 단위 개';
const PLANT_LABEL = 'SAMPLE-PLT-01 · 합성 공장 가';

/**
 * 화면 어디에도 나와서는 안 되는 내부 번호(FK).
 *
 * 픽스처의 번호 대역을 그대로 쓴다 — 발주번호(`PO-2026-900001`)에 이 문자열이 부분으로
 * 들어가지 않도록 대역을 갈라 두었다.
 */
const INTERNAL_IDS = ['9001', '9002', '9003', '9101', '9102', '9201', '9401', '9402', '9403'];

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
  items: unknown[] = purchaseOrderFixtures,
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
 * 「고른 발주가 갱신된 결과에 없다」를 실제로 만들어 내는 유일한 방법이다.
 */
const filteringListRoute = (): StubRoute => ({
  match: (request) => isGet(request, LIST_PATH),
  respond: (request) => {
    const q = new URL(request.url).searchParams.get('q');
    const items =
      q === null
        ? purchaseOrderFixtures
        : purchaseOrderFixtures.filter((row) => row.purchaseOrderNo.includes(q));

    return jsonResponse(listBody(items));
  },
});

/**
 * 부를 때마다 **내용이 달라지는** 목록.
 *
 * 다시 부르기가 같은 본문을 돌려주면 캐시가 구조 공유로 **같은 참조를 그대로 유지**해,
 * 「목록 응답을 되돌림 의존성에 넣었다」는 결함이 드러나지 않는다 —
 * 목록이 실제로 달라지는 경우(다른 사용자가 그 사이에 등록했다)를 만들어야 그 결함이 잡힌다.
 */
const changingListRoute = (): StubRoute => {
  let call = 0;

  return {
    match: (request) => isGet(request, LIST_PATH),
    respond: () => {
      call += 1;

      return jsonResponse(
        listBody(purchaseOrderFixtures, { total: purchaseOrderFixtures.length + call }),
      );
    },
  };
};

/**
 * 참조 목록 응답. **`page`를 인자로 받는다** — 기본값(`total === items.length`)만 쓰면
 * 「잘렸다」 갈래가 영영 만들어지지 않아 그 판정이 통째로 검사되지 않는다.
 */
const lookupRoute = (
  pathname: string,
  items: unknown[],
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse(listBody(items, page)),
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

/** 라인 조회. 고른 발주의 줄만 돌려준다. */
const linesRoute = (items: unknown[] = purchaseOrderLineFixtures): StubRoute => ({
  match: (request) => isGet(request, LINES_PATH),
  respond: () => jsonResponse({ items }),
});

const otherLinesRoute = (): StubRoute => ({
  match: (request) => isGet(request, OTHER_LINES_PATH),
  respond: () => jsonResponse({ items: [] }),
});

const failingLinesRoute = (status = 500): StubRoute => ({
  match: (request) => isGet(request, LINES_PATH),
  respond: () => jsonResponse({ message: '' }, { status }),
});

/**
 * 발주 상세 스텁. **부를 수 있게 두는 것이 요점이다** —
 * 스텁이 없으면 하네스가 던져 「부르지 않았다」를 증명할 수 없다.
 */
const detailRoute = (): StubRoute => ({
  match: (request) => isGet(request, DETAIL_PATH),
  respond: () =>
    jsonResponse({
      purchaseOrder: { ...(purchaseOrderFixtures[0] ?? {}), purchaseOrderNo: DETAIL_MARKER },
      lines: [],
    }),
});

/** 등록 경로 스텁. 같은 이유로 **부를 수 있게** 둔다 — PR ①은 이 경로를 부르지 않는다. */
const splitRoute = (): StubRoute => ({
  match: (request) =>
    request.method === 'POST' && new URL(request.url).pathname === SPLIT_PATH,
  respond: () => jsonResponse({ created: [] }, { status: 201 }),
});

/** 이 화면이 닿을 수 있는 경로를 전부 스텁으로 둔 한 벌. */
const allRoutes = (): StubRoute[] => [
  listRoute(),
  linesRoute(),
  otherLinesRoute(),
  detailRoute(),
  splitRoute(),
  ...lookupRoutes(),
];

/** 주소가 실제로 어떻게 바뀌는지 본다 — 수명 표를 판정할 유일한 근거다. */
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
): {
  requests: RecordedRequest[];
  queryClient: QueryClient;
  user: ReturnType<typeof userEvent.setup>;
} => {
  const { fetch, requests } = createRecordingFetch(routes);

  const { queryClient } = renderWithProviders(
    <>
      <OverReceiptSplitScreen />
      <LocationProbe />
      <BackProbe />
      <SearchProbe to={navigateTo} />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, queryClient, user: userEvent.setup() };
};

/**
 * 응답을 붙잡아 두는 렌더. 「조회를 기다리는 동안」과 「참조가 늦게 오는 순서」를
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
      <OverReceiptSplitScreen />
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

const lineTable = (): HTMLElement => screen.getAllByRole('table')[1] as HTMLElement;

const qtyInput = (lineNo: number): HTMLElement =>
  screen.getByLabelText(t.lineTable.arrivedQtyLabel(lineNo));

const selectPo = async (
  user: ReturnType<typeof userEvent.setup>,
  purchaseOrderNo: string,
): Promise<void> => {
  await user.click(screen.getByRole('button', { name: t.actions.selectRow(purchaseOrderNo) }));
};

/**
 * 두 구획 어디에도 내부 번호가 새지 않았는지 본다. 짝이 되는 「이름은 보인다」와 함께 쓴다.
 *
 * **주소는 세지 않는다.** 고른 발주의 번호는 주소 키(`po`)로 실리는데, 그것은 표시가 아니라
 * 주소 지정 수단이다 — 새로고침·뒤로가기·공유가 같은 발주를 열려면 어딘가에 실려야 하고,
 * 사용자 대면 번호(발주번호)로는 라인 경로를 조립할 수 없다(계약이 내부 번호를 받는다).
 * 여기서 세는 것은 **사람이 읽는 자리**뿐이다.
 */
const expectNoInternalIds = (): void => {
  const panes = [
    screen.getByRole('region', { name: t.panes.list }),
    screen.getByRole('region', { name: t.panes.lines }),
  ];

  for (const pane of panes) {
    for (const id of INTERNAL_IDS) {
      expect(pane.textContent ?? '').not.toContain(id);
    }
  }
};

describe('OverReceiptSplitScreen — 첫 진입 조회', () => {
  /*
   * **M01** — 계약 기본이 `false`라 싣지 않으면 이미 입하가 끝난 발주까지 온다.
   * 이 화면의 대상은 아직 받을 것이 남은 발주다.
   */
  it('목록 요청이 1회 나가고 미완료만이 실린다', async () => {
    const { requests } = renderScreen(allRoutes());

    await screen.findByText('PO-2026-900001');

    const list = requestsTo(requests, LIST_PATH);

    expect(list).toHaveLength(1);
    expect(list[0]?.url.searchParams.get('openOnly')).toBe('true');
  });

  it('조건을 심지 않고 주소를 그대로 둔다', async () => {
    renderScreen(allRoutes());

    await screen.findByText('PO-2026-900001');

    expect(currentLocation()).toBe(ROUTE);
  });

  it('결과가 표에 그려지고 배너가 없다', async () => {
    renderScreen(allRoutes());

    await screen.findByText('PO-2026-900001');

    expect(within(listTable()).getAllByRole('row')).toHaveLength(
      purchaseOrderFixtures.length + 1,
    );
    expect(screen.queryByText(messages.httpError.loadTitle)).not.toBeInTheDocument();
  });

  /* 상세가 주는 헤더 값은 목록 행에 이미 들어 있다 — 부르면 같은 값을 한 번 더 받는다. */
  it('발주 상세를 부르지 않는다', async () => {
    const { requests } = renderScreen(allRoutes());

    await screen.findByText('PO-2026-900001');

    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(0);
    expect(screen.queryByText(DETAIL_MARKER)).not.toBeInTheDocument();
  });

  /*
   * **M21** — 단위는 아래 구획만 쓴다. 고르기 전에 부르면 어느 요청이 무엇을 위한 것인지
   * 가릴 수 없고 첫 진입의 요청 수가 이유 없이 는다.
   */
  it('단위 참조를 발주를 고르기 전에 부르지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findByText('PO-2026-900001');

    expect(requestsTo(requests, UOMS_PATH)).toHaveLength(0);

    // 짝 방향 — 고르면 실제로 부른다(스텁이 있으므로 「부를 수 있었다」가 성립한다).
    await selectPo(user, 'PO-2026-900001');

    await waitFor(() => {
      expect(requestsTo(requests, UOMS_PATH).length).toBeGreaterThan(0);
    });
  });
});

describe('OverReceiptSplitScreen — 조건과 주소', () => {
  /* **M02** — 조건을 화면 상태로만 들고 있으면 새로고침·공유가 다른 결과를 낸다. */
  it('주소의 조건이 요청 쿼리에 그대로 실린다', async () => {
    const { requests } = renderScreen(allRoutes(), '?sup=9101&q=PO-2026-9&open=0');

    await screen.findByText('PO-2026-900001');

    const query = requestsTo(requests, LIST_PATH)[0]?.url.searchParams;

    expect(query?.get('supplierId')).toBe('9101');
    expect(query?.get('q')).toBe('PO-2026-9');
    expect(query?.has('openOnly')).toBe(false);
  });

  it('조건 줄에서 조회하면 주소와 요청에 함께 나타난다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findByText('PO-2026-900001');
    await user.type(screen.getByLabelText(t.fields.q), 'PO-2026-900002');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH)).toHaveLength(2);
    });

    expect(currentLocation()).toContain('q=PO-2026-900002');
    expect(requestsTo(requests, LIST_PATH)[1]?.url.searchParams.get('q')).toBe('PO-2026-900002');
  });

  /*
   * **M03** — 조건과 쪽을 따로 갱신하면 뒤로가기 기록이 두 칸 늘어
   * 사용자가 뒤로 눌렀는데 같은 자리로 돌아온 것처럼 보인다.
   */
  it('조회 한 번에 히스토리가 한 칸만 늘어난다', async () => {
    const { user } = renderScreen(allRoutes(), '?page=2');

    await screen.findByText('PO-2026-900001');
    await user.type(screen.getByLabelText(t.fields.q), 'PO-2026-900002');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(currentLocation()).toContain('q=PO-2026-900002');
    });

    // 한 칸만 늘었으면 뒤로 한 번에 처음 주소로 돌아온다.
    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?page=2`);
    });
  });

  /* **M06의 화면 몫** — 정수가 아닌 번호를 그대로 보내면 조회 전체가 400으로 실패한다. */
  it('정수가 아닌 조건과 쪽은 요청에 실리지 않는다', async () => {
    const { requests } = renderScreen(allRoutes(), '?sup=abc&page=0');

    await screen.findByText('PO-2026-900001');

    const query = requestsTo(requests, LIST_PATH)[0]?.url.searchParams;

    expect(query?.has('supplierId')).toBe(false);
    expect(query?.has('page')).toBe(false);
  });

  /* 알 수 없는 `po`는 「고르지 않았다」로 본다 — 라인 조회가 나가면 404가 돌아온다. */
  it('알 수 없는 po는 고르지 않은 것으로 보고 라인을 부르지 않는다', async () => {
    const { requests } = renderScreen(allRoutes(), '?po=xyz');

    await screen.findByText(t.empty.noSelectionTitle);

    expect(requestsTo(requests, LINES_PATH)).toHaveLength(0);
  });

  it('초기화는 조건을 기본으로 되돌린다', async () => {
    const { user } = renderScreen(allRoutes(), '?sup=9101&q=PO-2026-9&open=0');

    await screen.findByText('PO-2026-900001');
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });
});

describe('OverReceiptSplitScreen — 쪽 이동', () => {
  it('쪽을 옮기면 주소와 요청이 함께 바뀐다', async () => {
    const { requests, user } = renderScreen([
      listRoute(purchaseOrderFixtures, { total: 120 }),
      ...allRoutes().slice(1),
    ]);

    await screen.findByText('PO-2026-900001');
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(currentLocation()).toContain('page=2');
    });

    expect(requestsTo(requests, LIST_PATH)[1]?.url.searchParams.get('page')).toBe('2');
  });

  /* 기본값을 주소에 적으면 같은 화면의 주소가 두 가지가 된다. */
  it('첫 쪽으로 돌아오면 page 키가 주소에서 사라진다', async () => {
    const { user } = renderScreen(
      [listRoute(purchaseOrderFixtures, { page: 2, total: 120 }), ...allRoutes().slice(1)],
      '?page=2',
    );

    await screen.findByText('PO-2026-900001');
    await user.click(screen.getByRole('button', { name: t.actions.prevPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  /* **M07의 화면 몫** — 결과는 있는데 이 쪽에는 없다. 「결과가 없다」와 조치가 다르다. */
  it('쪽 밖이면 첫 쪽으로 가는 안내가 보인다', async () => {
    const { user } = renderScreen(
      [listRoute([], { page: 9, total: 45 }), ...allRoutes().slice(1)],
      '?page=9',
    );

    await screen.findByText(t.empty.beyondLastTitle);

    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  it('결과가 0건이면 빈 상태 안내가 보인다', async () => {
    renderScreen([listRoute([], { total: 0 }), ...allRoutes().slice(1)]);

    expect(await screen.findByText(t.empty.noResultTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.beyondLastTitle)).not.toBeInTheDocument();
  });
});

describe('OverReceiptSplitScreen — 조회 실패', () => {
  /*
   * **M08** — 실패를 「없습니다」로 내면 사용자가 자료가 없는 줄 알고 조건을 넓힌다.
   * 실제로는 조회 자체가 되지 않은 것이라 무엇을 해도 결과가 같다.
   */
  it('조회에 실패하면 배너가 나오고 빈 상태 문구는 나오지 않는다', async () => {
    renderScreen([failingListRoute(500), ...allRoutes().slice(1)]);

    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.beyondLastTitle)).not.toBeInTheDocument();
  });

  /* **M09** — 「버튼이 있다」만 보면 눌러도 아무 일이 없는 버튼을 통과시킨다. */
  it('다시 시도를 누르면 그 경로의 요청 수가 는다', async () => {
    const { requests, user } = renderScreen([failingListRoute(500), ...allRoutes().slice(1)]);

    await screen.findByText(messages.httpError.loadTitle);

    const before = requestsTo(requests, LIST_PATH).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(before);
    });
  });

  it('권한이 없으면 다시 시도를 내지 않는다', async () => {
    renderScreen([failingListRoute(403), ...allRoutes().slice(1)]);

    await screen.findByText(messages.httpError.forbidden);

    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('라인 조회에 실패하면 아래 구획에 배너가 나온다', async () => {
    const { requests, user } = renderScreen([
      listRoute(),
      failingLinesRoute(),
      otherLinesRoute(),
      detailRoute(),
      splitRoute(),
      ...lookupRoutes(),
    ]);

    await screen.findByText('PO-2026-900001');
    await selectPo(user, 'PO-2026-900001');

    await screen.findByText(messages.httpError.loadTitle);

    const before = requestsTo(requests, LINES_PATH).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, LINES_PATH).length).toBeGreaterThan(before);
    });
  });
});

describe('OverReceiptSplitScreen — 발주를 고르면 라인이 보인다', () => {
  it('라인을 1회 부르고 네 수치가 보인다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findByText('PO-2026-900001');
    await selectPo(user, 'PO-2026-900001');

    await screen.findByText(t.lineTable.orderedPair(100, 40));

    expect(requestsTo(requests, LINES_PATH)).toHaveLength(1);
    expect(within(lineTable()).getByText(t.lineTable.remainingPair(60, 5))).toBeInTheDocument();
    expect(currentLocation()).toContain('po=9001');
  });

  /* 보이는 행이 그대로다 — 3쪽에서 하나 골랐다고 1쪽으로 튀면 안 된다(수명 표 4행). */
  it('고르는 것이 쪽과 조건을 건드리지 않는다', async () => {
    const { user } = renderScreen(
      [listRoute(purchaseOrderFixtures, { page: 2, total: 120 }), ...allRoutes().slice(1)],
      '?q=PO-2026-9&page=2',
    );

    await screen.findByText('PO-2026-900001');
    await selectPo(user, 'PO-2026-900001');

    await waitFor(() => {
      expect(currentLocation()).toContain('po=9001');
    });

    expect(currentLocation()).toContain('q=PO-2026-9');
    expect(currentLocation()).toContain('page=2');
  });

  it('다시 누르면 선택이 풀리고 아래 구획이 닫힌다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('PO-2026-900001');
    await selectPo(user, 'PO-2026-900001');

    await screen.findByText(t.lineTable.orderedPair(100, 40));

    await user.click(
      screen.getByRole('button', { name: t.actions.deselectRow('PO-2026-900001') }),
    );

    await screen.findByText(t.empty.noSelectionTitle);

    expect(currentLocation()).not.toContain('po=');
  });

  /* 아래 구획의 빈 상태 두 갈래 — 안 고름 / 라인 없음. */
  it('라인이 하나도 없는 발주는 「고르지 않았다」와 다르게 말한다', async () => {
    const { user } = renderScreen([
      listRoute(),
      linesRoute([]),
      otherLinesRoute(),
      detailRoute(),
      splitRoute(),
      ...lookupRoutes(),
    ]);

    await screen.findByText('PO-2026-900001');
    await selectPo(user, 'PO-2026-900001');

    await screen.findByText(t.empty.noLinesTitle);

    expect(screen.queryByText(t.empty.noSelectionTitle)).not.toBeInTheDocument();
  });

  /*
   * **M20** — 응답을 기다리는 동안 빈 목록으로 판정하면 아래 구획이 깜빡 닫히고,
   * 주소의 `po`까지 지워져 새로고침으로 연 화면이 저절로 접힌다.
   */
  it('목록 응답 전에는 고른 발주를 지우지 않는다', async () => {
    const { release } = renderScreenHolding(allRoutes(), [LIST_PATH], '?po=9001');

    await screen.findByRole('status', { name: t.loading.lines });

    expect(currentLocation()).toContain('po=9001');
    expect(screen.queryByText(t.empty.noSelectionTitle)).not.toBeInTheDocument();

    release();

    await screen.findByText(t.lineTable.orderedPair(100, 40));

    expect(currentLocation()).toContain('po=9001');
  });
});

describe('OverReceiptSplitScreen — 참조 표기 네 갈래', () => {
  it('넷을 모두 이름으로 풀고 어디에도 내부 번호가 없다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('PO-2026-900001');
    await selectPo(user, 'PO-2026-900001');

    await screen.findByText(t.lineTable.orderedPair(100, 40));

    // 짝 방향 — 이름이 실제로 보인다(아무것도 안 그려도 통과하지 않게 한다).
    expect(within(listTable()).getAllByText(SUPPLIER_LABEL).length).toBeGreaterThan(0);
    expect(within(lineTable()).getAllByText(ITEM_LABEL).length).toBeGreaterThan(0);
    expect(screen.getAllByText(t.lineTable.uomNote(UOM_LABEL)).length).toBeGreaterThan(0);
    expect(screen.getByText(PLANT_LABEL)).toBeInTheDocument();

    expectNoInternalIds();
  });

  /*
   * **M12** — 본 자료가 참조보다 먼저 오는 순간이 실제로 있다(#47).
   * 그때 「알 수 없음」을 내면 정상 값이 잘못된 값으로 읽힌다.
   */
  it('참조가 늦게 와도 그동안 「알 수 없음」이라 하지 않는다', async () => {
    const { release } = renderScreenHolding(allRoutes(), [PARTNERS_PATH]);

    await screen.findByText('PO-2026-900001');

    expect(within(listTable()).getAllByText(t.values.referenceLoading).length).toBeGreaterThan(0);
    expect(within(listTable()).queryByText(t.values.unknown)).not.toBeInTheDocument();

    release();

    // 짝 방향 — 도착하면 이름으로 바뀐다.
    await waitFor(() => {
      expect(within(listTable()).getAllByText(SUPPLIER_LABEL).length).toBeGreaterThan(0);
    });
  });

  /* **M13** — 이름을 못 풀어도 내부 번호를 내지 않는다(#44). */
  it('목록에 없는 참조도 번호가 아니라 문구로 낸다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('PO-2026-900002');
    await selectPo(user, 'PO-2026-900001');

    await screen.findByText(t.lineTable.orderedPair(100, 40));

    // 공급사 9102(목록에 없음)와 품목 9302(목록에 없음)가 함께 이 갈래로 간다.
    expect(screen.getAllByText(t.values.unknown).length).toBeGreaterThan(1);
    expectNoInternalIds();
  });

  it('참조 조회가 실패하면 그 구획이 사유와 복구 수단을 낸다', async () => {
    const { requests, user } = renderScreen([
      listRoute(),
      linesRoute(),
      otherLinesRoute(),
      detailRoute(),
      splitRoute(),
      failingLookupRoute(PARTNERS_PATH),
      lookupRoute(PLANTS_PATH, plantFixtures),
      lookupRoute(ITEMS_PATH, itemFixtures),
      lookupRoute(UOMS_PATH, uomFixtures),
    ]);

    await screen.findByText('PO-2026-900001');
    await screen.findByText(t.reasons.referencesFailed);

    const before = requestsTo(requests, PARTNERS_PATH).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, PARTNERS_PATH).length).toBeGreaterThan(before);
    });
  });

  /* 아래 구획의 셋 중 하나만 실패해도 그 구획이 안내를 낸다. */
  it('단위만 실패해도 아래 구획이 안내와 복구 수단을 낸다', async () => {
    const { requests, user } = renderScreen([
      listRoute(),
      linesRoute(),
      otherLinesRoute(),
      detailRoute(),
      splitRoute(),
      lookupRoute(PARTNERS_PATH, partnerFixtures),
      lookupRoute(PLANTS_PATH, plantFixtures),
      lookupRoute(ITEMS_PATH, itemFixtures),
      failingLookupRoute(UOMS_PATH),
    ]);

    await screen.findByText('PO-2026-900001');
    await selectPo(user, 'PO-2026-900001');

    await screen.findByText(t.reasons.lineReferencesFailed);

    const before = requestsTo(requests, UOMS_PATH).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, UOMS_PATH).length).toBeGreaterThan(before);
    });
  });

  /* 선택지가 잘렸으면 사용자가 「그런 공급사가 없다」로 결론짓지 않게 밝힌다. */
  it('공급사 선택지가 잘렸으면 조건 줄이 그 사실을 밝힌다', async () => {
    renderScreen([
      listRoute(),
      linesRoute(),
      otherLinesRoute(),
      detailRoute(),
      splitRoute(),
      lookupRoute(PARTNERS_PATH, partnerFixtures, { total: partnerFixtures.length + 1 }),
      lookupRoute(PLANTS_PATH, plantFixtures),
      lookupRoute(ITEMS_PATH, itemFixtures),
      lookupRoute(UOMS_PATH, uomFixtures),
    ]);

    expect(await screen.findByText(t.filters.lookupTruncated)).toBeInTheDocument();
  });
});

describe('OverReceiptSplitScreen — 도착 수량과 가르기', () => {
  const selectAndWait = async (
    user: ReturnType<typeof userEvent.setup>,
  ): Promise<void> => {
    await screen.findByText('PO-2026-900001');
    await selectPo(user, 'PO-2026-900001');
    await screen.findByText(t.lineTable.orderedPair(100, 40));
  };

  /* 한도(잔량 60 + 허용 5)와 꼭 같은 도착은 전부 정량분이다. */
  it('한도와 같은 수량은 전부 정량분으로 갈린다', async () => {
    const { user } = renderScreen(allRoutes());

    await selectAndWait(user);
    await user.type(qtyInput(1), '65');

    expect(within(lineTable()).getByText(t.lineTable.splitPair(65, 0))).toBeInTheDocument();
  });

  it('한도를 넘으면 넘은 몫만 초과분으로 갈린다', async () => {
    const { user } = renderScreen(allRoutes());

    await selectAndWait(user);
    await user.type(qtyInput(1), '66');

    expect(within(lineTable()).getByText(t.lineTable.splitPair(65, 1))).toBeInTheDocument();
  });

  /* 여러 줄 중 일부만 채우는 것이 정상 경로다 — 나머지 줄은 「이번에 받지 않는다」이다. */
  it('일부 줄만 채워도 그 줄만 갈린다', async () => {
    const { user } = renderScreen(allRoutes());

    await selectAndWait(user);
    await user.type(qtyInput(2), '12');

    expect(within(lineTable()).getByText(t.lineTable.splitPair(0, 12))).toBeInTheDocument();
    expect(within(lineTable()).getAllByText(t.values.notSplit)).toHaveLength(2);
  });

  /* 전 라인이 정량 안쪽인 경우와 전 라인이 초과뿐인 경우가 둘 다 정상 입력이다. */
  it('세 줄을 모두 채우면 세 줄이 모두 갈린다', async () => {
    const { user } = renderScreen(allRoutes());

    await selectAndWait(user);
    await user.type(qtyInput(1), '10');
    await user.type(qtyInput(2), '3');
    await user.type(qtyInput(3), '8');

    expect(within(lineTable()).getByText(t.lineTable.splitPair(10, 0))).toBeInTheDocument();
    expect(within(lineTable()).getByText(t.lineTable.splitPair(0, 3))).toBeInTheDocument();
    // 잔량이 음수인 줄이다 — 허용치 5까지가 정량분이다.
    expect(within(lineTable()).getByText(t.lineTable.splitPair(5, 3))).toBeInTheDocument();
    expect(within(lineTable()).queryByText(t.values.notSplit)).not.toBeInTheDocument();
  });

  /* **M17의 화면 몫** — 잘못 친 값이 계산에 들어가면 정량·초과가 둘 다 `NaN`이 된다. */
  it('0을 치면 사유가 붙고 그 줄은 갈리지 않는다', async () => {
    const { user } = renderScreen(allRoutes());

    await selectAndWait(user);
    await user.type(qtyInput(1), '0');

    expect(await screen.findByText(t.errors.qtyNotPositive)).toBeInTheDocument();
    expect(within(lineTable()).getAllByText(t.values.notSplit)).toHaveLength(3);
  });

  /* **M18의 화면 몫** — 빈 칸은 「이번에 받지 않는다」이지 잘못이 아니다. */
  it('비워 두면 오류가 아니다', async () => {
    const { user } = renderScreen(allRoutes());

    await selectAndWait(user);

    expect(screen.queryByText(t.errors.qtyNotPositive)).not.toBeInTheDocument();
    expect(screen.queryByText(t.errors.qtyNotNumber)).not.toBeInTheDocument();
  });

  /* 지웠다 다시 치는 도중에도 값이 튀지 않아야 한다. */
  it('쳤다가 지우면 오류가 사라지고 다시 갈리지 않는다', async () => {
    const { user } = renderScreen(allRoutes());

    await selectAndWait(user);
    await user.type(qtyInput(1), '0');

    expect(await screen.findByText(t.errors.qtyNotPositive)).toBeInTheDocument();

    await user.clear(qtyInput(1));

    await waitFor(() => {
      expect(screen.queryByText(t.errors.qtyNotPositive)).not.toBeInTheDocument();
    });
  });
});

describe('OverReceiptSplitScreen — 초안의 수명', () => {
  const selectAndType = async (
    user: ReturnType<typeof userEvent.setup>,
    text = '66',
  ): Promise<void> => {
    await screen.findByText('PO-2026-900001');
    await selectPo(user, 'PO-2026-900001');
    await screen.findByText(t.lineTable.orderedPair(100, 40));
    await user.type(qtyInput(1), text);
  };

  /* **M11** — 입력마다 주소를 바꾸면 글자 하나에 뒤로가기 기록이 한 칸씩 쌓인다. */
  it('수량 입력이 주소를 바꾸지 않는다', async () => {
    const { user } = renderScreen(allRoutes());

    await selectAndType(user);

    expect(currentLocation()).toBe(`${ROUTE}?po=9001`);
  });

  /*
   * **M10** — 되돌림을 목록 응답이나 파생 객체에 반응시키면, 목록이 다시 오는 순간
   * 사용자가 치던 수량이 사라진다(#43의 입력 형).
   */
  it('목록을 다시 불러 내용이 달라져도 치던 수량이 사라지지 않는다', async () => {
    const { requests, queryClient, user } = renderScreen([
      changingListRoute(),
      ...allRoutes().slice(1),
    ]);

    await selectAndType(user);

    const before = requestsTo(requests, LIST_PATH).length;

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: poKeys.lists });
    });

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(before);
    });

    // 짝 방향 — 목록이 실제로 갱신됐다(같은 응답이면 참조가 그대로라 결함이 드러나지 않는다).
    await screen.findByText(
      t.pageNav.range(1, purchaseOrderFixtures.length, purchaseOrderFixtures.length + 2),
    );

    expect(qtyInput(1)).toHaveValue(66);
  });

  /* 같은 자리의 다른 경로 — 참조가 늦게 도착해 부모가 다시 그려질 때다. */
  it('참조가 늦게 도착해도 치던 수량이 사라지지 않는다', async () => {
    const { release, user } = renderScreenHolding(allRoutes(), [PARTNERS_PATH], '?po=9001');

    await screen.findByText(t.lineTable.orderedPair(100, 40));
    await user.type(qtyInput(1), '66');

    release();

    await waitFor(() => {
      expect(screen.getAllByText(SUPPLIER_LABEL).length).toBeGreaterThan(0);
    });

    expect(qtyInput(1)).toHaveValue(66);
  });

  /*
   * **M04** — 조건이 바뀌면 그 수량은 뜻을 잃는다. 초안이 남으면 다른 발주의 라인에
   * 앞 발주의 수량이 실린다.
   */
  it('조건을 바꾸면 쪽·선택·초안이 함께 비워진다', async () => {
    const { user } = renderScreen([
      filteringListRoute(),
      ...allRoutes().slice(1),
    ], '?page=2');

    await selectAndType(user);

    await user.type(screen.getByLabelText(t.fields.q), 'PO-2026-9');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await screen.findByText(t.empty.noSelectionTitle);

    expect(currentLocation()).toBe(`${ROUTE}?q=PO-2026-9`);
  });

  /* **M05** — 다른 쪽에는 다른 행이 온다. 초안이 남으면 없는 라인의 수량이 남는다. */
  it('쪽을 옮기면 선택과 초안이 함께 비워진다', async () => {
    const { user } = renderScreen([
      listRoute(purchaseOrderFixtures, { total: 120 }),
      ...allRoutes().slice(1),
    ]);

    await selectAndType(user);

    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await screen.findByText(t.empty.noSelectionTitle);

    expect(currentLocation()).toBe(`${ROUTE}?page=2`);
  });

  /* 다른 발주를 고르면 그 발주의 라인으로 초안이 새로 만들어진다(수명 표 4행). */
  it('다른 발주를 고르면 앞 발주의 수량이 남지 않는다', async () => {
    const { user } = renderScreen(allRoutes());

    await selectAndType(user);
    await selectPo(user, 'PO-2026-900002');

    await screen.findByText(t.empty.noLinesTitle);

    expect(currentLocation()).toContain('po=9002');
    expect(screen.queryByLabelText(t.lineTable.arrivedQtyLabel(1))).not.toBeInTheDocument();
  });

  /*
   * **M19** — 갱신된 결과에 고른 발주가 없으면 주소에서 정리한다.
   * **주소 직접 편집·뒤로가기가 이 경로다** — 정리를 클릭 핸들러에 두면 통째로 샌다.
   */
  it('결과에 없는 선택은 주소가 밖에서 바뀌어도 정리된다', async () => {
    const { user } = renderScreen(
      [filteringListRoute(), ...allRoutes().slice(1)],
      '',
      'q=PO-2026-900002&po=9001',
    );

    await screen.findByText('PO-2026-900001');
    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    await waitFor(() => {
      expect(currentLocation()).not.toContain('po=');
    });

    expect(currentLocation()).toContain('q=PO-2026-900002');
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });
});

describe('OverReceiptSplitScreen — PR ①에는 쓰기가 없다', () => {
  /*
   * **M22** — 이 화면은 등록을 아직 갖지 않는다. 라우트에 붙지 않는 이유도 같다.
   * **경로 전체로 센다** — 어느 한 조작에서만 새는 쓰기를 놓치지 않으려면
   * 조회·쪽 이동·고르기·수량 입력을 모두 지난 뒤에 판정해야 한다.
   */
  it('조회부터 수량 입력까지 어떤 쓰기 요청도 보내지 않는다', async () => {
    const { requests, user } = renderScreen([
      listRoute(purchaseOrderFixtures, { total: 120 }),
      ...allRoutes().slice(1),
    ]);

    await screen.findByText('PO-2026-900001');

    await user.type(screen.getByLabelText(t.fields.q), 'PO-2026-9');
    await user.click(screen.getByRole('button', { name: messages.common.search }));
    await waitFor(() => {
      expect(currentLocation()).toContain('q=PO-2026-9');
    });

    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));
    await waitFor(() => {
      expect(currentLocation()).toContain('page=2');
    });

    await selectPo(user, 'PO-2026-900001');
    await screen.findByText(t.lineTable.orderedPair(100, 40));
    await user.type(qtyInput(1), '66');

    // 짝 방향 — 실제로 요청이 여럿 나갔다(아무것도 안 부르고 통과하지 않게 한다).
    expect(requests.length).toBeGreaterThan(4);
    expect(requests.every((request) => request.method === 'GET')).toBe(true);
    expect(requestsTo(requests, SPLIT_PATH)).toHaveLength(0);
  });

  /* 세 모드 버튼과 결과 구획은 PR ②의 것이다 — 반쪽 등록 수단을 두지 않는다. */
  it('등록·취소 버튼을 두지 않는다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('PO-2026-900001');
    await selectPo(user, 'PO-2026-900001');
    await screen.findByText(t.lineTable.orderedPair(100, 40));

    expect(screen.queryByRole('button', { name: messages.common.save })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.cancel })).not.toBeInTheDocument();
  });
});
