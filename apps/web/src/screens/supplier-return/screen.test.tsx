import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
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
import { pickRange } from '../../test/date-picker';
import {
  goodsReceiptFixtures,
  goodsReceiptLineFixtures,
  INTERNAL_IDS,
  itemFixtures,
  locationFixtures,
  lotFixtures,
  uomFixtures,
  warehouseFixtures,
} from './fixtures';
import { LOT_PAGE_SIZE } from './lookups';
import { SupplierReturnScreen } from './screen';

const t = messages.supplierReturn;

const ROUTE = '/logistics/supplier-return';
const LIST_PATH = '/logistics/goods-receipts';
const DETAIL_PATH = '/logistics/goods-receipts/9001';
const OTHER_DETAIL_PATH = '/logistics/goods-receipts/9002';
const MISSING_DETAIL_PATH = '/logistics/goods-receipts/9003';
/**
 * 계약에 있는 **입고 라인 전용 경로**. **이 화면은 부르지 않는다** — 상세가 라인을 함께 준다.
 * 스텁을 두지 않으면 하네스가 던져 「부르지 않았다」와 「불렀는데 실패했다」가 구분되지 않는다.
 */
const LINES_PATH = '/logistics/goods-receipts/9001/lines';
/** 반품 처리(쓰기)와 그 뒤 회차가 쓸 경로. **이 회차에는 하나도 나가지 않는다.** */
const ISSUES_PATH = '/logistics/goods-issues';
const BALANCES_PATH = '/inventory/balances';
const PARTNERS_PATH = '/mdm/partners';

const WAREHOUSES_PATH = '/mdm/warehouses';
const ITEMS_PATH = '/mdm/items';
const UOMS_PATH = '/mdm/uoms';
const LOTS_PATH = '/trace/lots';
const LOCATIONS_PATH = '/mdm/locations';

/**
 * 라인 전용 경로의 응답에만 있는 수량. 화면이 그 경로를 쓰지 않음을 **두 방향으로** 굳힌다 —
 * ① 그 경로 요청이 0회 ② 이 수량이 화면 어디에도 나타나지 않음.
 */
const LINES_PATH_MARKER_QTY = 777;

const WAREHOUSE_LABEL = 'SAMPLE-WH-01 · 합성 창고 가';
const ITEM_LABEL = 'SAMPLE-ITEM-01 · 합성 품목 가';
const UOM_LABEL = 'SAMPLE-EA · 합성 단위 개';
const LOCATION_LABEL = 'SAMPLE-LOC-A1 · 합성 열 가1';

interface RecordedRequest {
  method: string;
  url: URL;
  /**
   * 쓰기 요청의 본문. 읽기에는 `null`이다.
   *
   * **실제로 나간 요청을 본다.** 이 회차에서는 그 목록에 쓰기가 하나도 없다는 것이 단언이다.
   */
  body: unknown;
}

/**
 * 요청을 기록하면서 스텁 규칙으로 응답한다. 규칙에 없는 요청은 하네스가 던져 스텁 누락을 드러낸다.
 *
 * `hold`에 든 경로는 **기록한 뒤에** 붙잡아 둔다 — 「기다리는 동안 무엇이 보이는가」를
 * 판정하려면 응답이 오기 전에 이미 기록돼 있어야 한다.
 */
const createRecordingFetch = (
  routes: StubRoute[],
  hold: string[] = [],
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
    /* 본문은 한 번만 읽을 수 있다 — 복제해 읽어야 스텁이 같은 요청을 다시 다룰 수 있다. */
    const body: unknown = request.method === 'GET' ? null : await request.clone().json();

    requests.push({ method: request.method, url: new URL(request.url), body });

    if (hold.includes(new URL(request.url).pathname)) await gate;

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

const listBody = (
  items: unknown[],
  page: Partial<{ page: number; size: number; total: number }> = {},
) => ({ items, page: { page: 1, size: 50, total: items.length, ...page } });

const listRoute = (
  items: unknown[] = goodsReceiptFixtures,
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
 * 부를 때마다 **내용이 달라지는** 목록.
 *
 * 다시 부르기가 같은 본문을 돌려주면 캐시가 구조 공유로 **같은 참조를 그대로 유지**해,
 * 「목록 응답이 도착하면 치던 값이 되돌아간다」는 결함이 드러나지 않는다.
 */
const changingListRoute = (): StubRoute => {
  let call = 0;

  return {
    match: (request) => isGet(request, LIST_PATH),
    respond: () => {
      call += 1;

      return jsonResponse(listBody(goodsReceiptFixtures, { total: goodsReceiptFixtures.length + call }));
    },
  };
};

const detailBody = (receiptIndex = 0, lines: unknown[] = goodsReceiptLineFixtures) => ({
  goodsReceipt: goodsReceiptFixtures[receiptIndex],
  lines,
});

const detailRoute = (lines: unknown[] = goodsReceiptLineFixtures): StubRoute => ({
  match: (request) => isGet(request, DETAIL_PATH),
  respond: () => jsonResponse(detailBody(0, lines)),
});

/** 부를 때마다 **입고번호가 달라지는** 상세. 상세가 **실제로 다시 왔는지**를 재는 잣대다. */
const changingDetailRoute = (): StubRoute => {
  let call = 0;

  return {
    match: (request) => isGet(request, DETAIL_PATH),
    respond: () => {
      call += 1;

      return jsonResponse({
        goodsReceipt: {
          ...goodsReceiptFixtures[0],
          statusCode: `SAMPLE_GR_STATUS_CALL_${String(call)}`,
        },
        lines: goodsReceiptLineFixtures,
      });
    },
  };
};

const otherDetailRoute = (): StubRoute => ({
  match: (request) => isGet(request, OTHER_DETAIL_PATH),
  respond: () => jsonResponse({ goodsReceipt: goodsReceiptFixtures[1], lines: [] }),
});

const missingDetailRoute = (): StubRoute => ({
  match: (request) => isGet(request, MISSING_DETAIL_PATH),
  respond: () => jsonResponse({ message: '' }, { status: 404 }),
});

const failingDetailRoute = (status = 500): StubRoute => ({
  match: (request) => isGet(request, DETAIL_PATH),
  respond: () => jsonResponse({ message: '' }, { status }),
});

/** 라인 전용 경로. **부를 수 있게 두는 것이 요점이다** — 부르지 않음을 증명하기 위해서다. */
const linesPathRoute = (): StubRoute => ({
  match: (request) => isGet(request, LINES_PATH),
  respond: () =>
    jsonResponse({
      items: [
        { ...goodsReceiptLineFixtures[0], goodsReceiptLineId: 9411, receiptQty: LINES_PATH_MARKER_QTY },
      ],
    }),
});

/** 이 회차가 부르지 않아야 하는 나머지 경로. 마찬가지로 부를 수 있게 둔다. */
const laterPhaseRoutes = (): StubRoute[] => [
  { match: (request) => isGet(request, BALANCES_PATH), respond: () => jsonResponse(listBody([])) },
  { match: (request) => isGet(request, PARTNERS_PATH), respond: () => jsonResponse(listBody([])) },
  {
    match: (request) => request.method === 'POST' && new URL(request.url).pathname === ISSUES_PATH,
    respond: () => jsonResponse({}, { status: 201 }),
  },
];

const lookupRoute = (
  pathname: string,
  items: unknown[],
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse(listBody(items, page)),
});

/** 자재 LOT은 **품목마다** 부른다 — 요청의 `itemId`에 맞는 것만 돌려준다. */
const lotsRoute = (page?: Partial<{ page: number; size: number; total: number }>): StubRoute => ({
  match: (request) => isGet(request, LOTS_PATH),
  respond: (request) => {
    const itemId = new URL(request.url).searchParams.get('itemId');
    const items =
      itemId === null ? lotFixtures : lotFixtures.filter((lot) => String(lot.itemId) === itemId);

    return jsonResponse(listBody(items, page));
  },
});

const failingLookupRoute = (pathname: string): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse({ message: '' }, { status: 500 }),
});

/**
 * 품목 **하나만** 실패하는 자재 LOT 조회.
 *
 * 품목마다 한 번씩 부르므로 **일부만 실패하는 것이 정상 갈래**다. 그때 집계가 「하나라도
 * 실패하면 실패」가 아니면, 실패한 품목의 LOT이 **「이름 불러오기 실패」가 아니라
 * 「알 수 없음」**으로 찍힌다 — 이 화면이 그 문구를 *값이 잘못됐다는 신호*로 정의해 두었으므로
 * **#47이 그대로 재생산된다.**
 */
const partialFailingLotsRoute = (failingItemId: string): StubRoute => ({
  match: (request) => isGet(request, LOTS_PATH),
  respond: (request) => {
    const itemId = new URL(request.url).searchParams.get('itemId');

    if (itemId === failingItemId) return jsonResponse({ message: '' }, { status: 500 });

    return jsonResponse(listBody(lotFixtures.filter((lot) => String(lot.itemId) === itemId)));
  },
});

/** 참조 다섯. 화면이 이름으로 풀 수 있는 정상 상태다. */
const lookupRoutes = (): StubRoute[] => [
  lookupRoute(WAREHOUSES_PATH, warehouseFixtures),
  lookupRoute(ITEMS_PATH, itemFixtures),
  lookupRoute(UOMS_PATH, uomFixtures),
  lotsRoute(),
  lookupRoute(LOCATIONS_PATH, locationFixtures),
];

/** 이 화면이 닿을 수 있는 경로를 전부 스텁으로 둔 한 벌. */
const allRoutes = (extra: StubRoute[] = []): StubRoute[] => [
  ...extra,
  listRoute(),
  detailRoute(),
  otherDetailRoute(),
  missingDetailRoute(),
  linesPathRoute(),
  ...laterPhaseRoutes(),
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
  hold: string[] = [],
): {
  requests: RecordedRequest[];
  queryClient: QueryClient;
  release: () => void;
  user: ReturnType<typeof userEvent.setup>;
} => {
  const { fetch, requests, release } = createRecordingFetch(routes, hold);

  const { queryClient } = renderWithProviders(
    <>
      <SupplierReturnScreen />
      <LocationProbe />
      <BackProbe />
      <SearchProbe to={navigateTo} />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, queryClient, release, user: userEvent.setup() };
};

const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

/**
 * 이 화면이 부를 수 있는 경로 전부.
 *
 * **여기 없는 경로로 나간 요청은 그 자체가 결함이다** — 경로마다 세는 단언은 **예상 경로 집합
 * 밖으로** 나간 요청을 하나도 보지 못한다. 「고르지 않았는데 상세를 부른다」가 `…/0`처럼
 * 대체값을 단 경로로 나가면 목록 계수에도 상세 계수에도 걸리지 않는다.
 */
const KNOWN_PATHS = [
  LIST_PATH,
  DETAIL_PATH,
  OTHER_DETAIL_PATH,
  MISSING_DETAIL_PATH,
  WAREHOUSES_PATH,
  ITEMS_PATH,
  UOMS_PATH,
  LOTS_PATH,
  LOCATIONS_PATH,
];

/** 확립 규칙 「요청 계수는 경로 전체를 센다」의 단언 형태 — 기록만이 아니라 **판정도** 전체를 본다. */
const expectNoUnknownPath = (requests: RecordedRequest[]): void => {
  expect(
    requests
      .filter((request) => !KNOWN_PATHS.includes(request.url.pathname))
      .map((request) => `${request.method} ${request.url.pathname}`),
  ).toEqual([]);
};

/**
 * 화면이 **쓸모없는 실패를 만들지 않았는가.**
 *
 * 성립하지 않는 조회를 불러 두면 요청이 나가지 않아도 그 쿼리는 실패로 앉는다 — 지금은
 * 아래 구획이 그 실패보다 「아직 고르지 않았다」를 먼저 보아 눈에 띄지 않지만, 갈래 차례가
 * 한 번만 바뀌면 **고르지도 않았는데 실패 배너가 서는** 화면이 된다.
 * 요청 수만 세는 단언은 이 자리를 보지 못한다.
 */
const expectNoFailedQuery = (queryClient: QueryClient): void => {
  expect(
    queryClient
      .getQueryCache()
      .getAll()
      .filter((query) => query.state.status === 'error')
      .map((query) => JSON.stringify(query.queryKey)),
  ).toEqual([]);
};

const currentLocation = (): string => screen.getByTestId('location').textContent ?? '';

/**
 * 위·아래 구획의 표를 차례로 집는다.
 *
 * **형 단언으로 누르지 않는다** — 표가 없으면 무엇을 집으려 했는지 말하고 세운다.
 * `as`로 누르면 없을 때 `within(undefined)`가 내는 알아보기 힘든 실패로 바뀐다.
 */
const tableAt = (index: number, label: string): HTMLElement => {
  const table = screen.getAllByRole('table')[index];

  if (table === undefined) throw new Error(`${label} 표가 없다`);

  return table;
};

const listTable = (): HTMLElement => tableAt(0, '입고 전표 목록');

const lineTable = (): HTMLElement => tableAt(1, '입고 라인');

const selectReceipt = async (
  user: ReturnType<typeof userEvent.setup>,
  goodsReceiptNo: string,
): Promise<void> => {
  await user.click(screen.getByRole('button', { name: t.actions.selectRow(goodsReceiptNo) }));
};

const search = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByRole('button', { name: messages.common.search }));
};

const refresh = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByRole('button', { name: t.actions.refresh }));
};

/**
 * 두 구획 어디에도 내부 번호가 새지 않았는지 본다. 짝이 되는 「이름은 보인다」와 함께 쓴다.
 *
 * **주소는 세지 않는다.** 고른 전표의 번호는 주소 키(`gr`)로 실리는데, 그것은 표시가 아니라
 * 주소 지정 수단이다 — 새로고침·뒤로가기·공유가 같은 대상을 열려면 어딘가에 실려야 하고,
 * 사용자 대면 번호로는 상세 경로를 조립할 수 없다(계약이 내부 번호를 받는다).
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

describe('SupplierReturnScreen — 첫 진입 조회', () => {
  /*
   * **M01** — 기본 기간을 심으면 첫 요청에 날짜가 실리고, 사용자는 왜 그 기간만 보이는지
   * 화면 어디에서도 읽을 수 없다(W-01-09가 세운 규칙).
   */
  it('목록 요청이 1회 나가고 조건이 하나도 실리지 않는다', async () => {
    const { requests } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');

    const list = requestsTo(requests, LIST_PATH);

    expect(list).toHaveLength(1);
    expect(list[0]?.url.searchParams.has('receiptDateFrom')).toBe(false);
    expect(list[0]?.url.searchParams.has('receiptDateTo')).toBe(false);
    /* 짝 방향 — 조건 자체가 하나도 실리지 않는다. */
    expect([...(list[0]?.url.searchParams.keys() ?? [])]).toEqual([]);
  });

  it('조건을 심지 않고 주소를 그대로 둔다', async () => {
    renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');

    expect(currentLocation()).toBe(ROUTE);
  });

  it('결과가 표에 그려지고 배너가 없다', async () => {
    renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');

    expect(within(listTable()).getAllByRole('row')).toHaveLength(goodsReceiptFixtures.length + 1);
    expect(screen.queryByText(messages.httpError.loadTitle)).not.toBeInTheDocument();
  });

  /**
   * **M16** — `gr`가 없으면 상세 조회는 성립하지 않는다. 부르면 화면이 스스로 만든 실패를
   * 사용자에게 보이게 된다(W-01-07 Minor의 형태).
   */
  it('전표를 고르기 전에는 상세를 부르지 않는다', async () => {
    const { requests } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');

    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(0);
  });

  /**
   * 라인 표가 쓰는 참조 넷은 아래 구획만 쓴다. 그 표 자체가 상세 응답을 기다리므로 미리
   * 받아 둘 이득이 없고, 고르기 전에 부르면 첫 진입의 요청 수가 이유 없이 는다.
   */
  it('전표를 고르기 전에는 품목·단위·LOT·위치를 부르지 않는다', async () => {
    const { requests } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');

    for (const path of [ITEMS_PATH, UOMS_PATH, LOTS_PATH, LOCATIONS_PATH]) {
      expect(requestsTo(requests, path)).toHaveLength(0);
    }

    /* 짝 방향 — 창고는 첫 진입에 실제로 나갔다(아무것도 안 불러서 통과한 것이 아니다). */
    expect(requestsTo(requests, WAREHOUSES_PATH)).toHaveLength(1);
  });

  /**
   * **C15** — 이 회차는 대상을 보는 데까지다. 되돌릴 수 없는 쓰기는 결과 구획과 함께
   * 나가야 하므로 여기서는 어떤 쓰기도 나가지 않는다.
   */
  it('어떤 쓰기 요청도 보내지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await selectReceipt(user, 'GR-2026-900001');
    await screen.findAllByText(ITEM_LABEL);

    expect(requestsTo(requests, ISSUES_PATH)).toHaveLength(0);
    expect(requests.map((request) => request.method)).toEqual(requests.map(() => 'GET'));
    /* 본문이 실린 요청도 없다 — method만 세면 다른 경로의 쓰기를 놓친다. */
    expect(requests.map((request) => request.body)).toEqual(requests.map(() => null));
    /* 짝 방향 — 읽기는 실제로 나갔다(아무 요청도 없어서 통과한 것이 아니다). */
    expect(requests.length).toBeGreaterThan(0);
  });

  /** 잔액·거래처는 뒤따르는 회차의 것이다 — 지금 부르면 쓰지 않는 자료를 받는다. */
  it('잔액·거래처를 부르지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await selectReceipt(user, 'GR-2026-900001');
    await screen.findAllByText(ITEM_LABEL);

    expect(requestsTo(requests, BALANCES_PATH)).toHaveLength(0);
    expect(requestsTo(requests, PARTNERS_PATH)).toHaveLength(0);
  });
});

describe('SupplierReturnScreen — 주소가 조건을 소유한다', () => {
  /** **M02** — 컴포넌트 상태로만 들고 있으면 새로고침·뒤로가기·공유가 같은 결과를 내지 못한다. */
  it('조회를 누르면 조건이 주소에 실린다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await user.type(screen.getByLabelText(t.fields.q), 'GR-2026');
    await search(user);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR-2026`);
    });
  });

  it('기간을 고르면 주소와 요청에 함께 실린다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await pickRange(user, screen.getByLabelText(t.fields.period), '2026-08-01', '2026-08-05');
    await search(user);

    await waitFor(() => {
      expect(currentLocation()).toContain('from=2026-08-01');
    });

    const list = requestsTo(requests, LIST_PATH);
    const last = list[list.length - 1];

    expect(last?.url.searchParams.get('receiptDateFrom')).toBe('2026-08-01');
    expect(last?.url.searchParams.get('receiptDateTo')).toBe('2026-08-05');
  });

  it('그 주소로 다시 들어가면 같은 조건으로 조회한다', async () => {
    const { requests } = renderScreen(allRoutes(), '?wh=9701&ty=SAMPLE_TY_A&q=GR-2026&page=2');

    await screen.findByText('GR-2026-900001');

    const list = requestsTo(requests, LIST_PATH);

    expect(list).toHaveLength(1);
    expect(Object.fromEntries(list[0]?.url.searchParams ?? [])).toEqual({
      warehouseId: '9701',
      receiptTypeCode: 'SAMPLE_TY_A',
      q: 'GR-2026',
      page: '2',
    });
  });

  /* 주소는 손으로 고쳐지는 자리다 — 이상한 값을 그대로 보내면 조회 전체가 실패한다. */
  it('정수가 아닌 조건은 요청에 실리지 않는다', async () => {
    const { requests } = renderScreen(allRoutes(), '?wh=abc&page=0&gr=xyz&q=%20%20');

    await screen.findByText('GR-2026-900001');

    const list = requestsTo(requests, LIST_PATH);

    expect([...(list[0]?.url.searchParams.keys() ?? [])]).toEqual([]);
    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(0);
  });

  /**
   * **M13** — 입력마다 주소를 갱신하면 글자마다 뒤로가기 기록이 쌓이고, 화면이 조회 조건과
   * 입력을 같은 통로로 다루게 된다.
   */
  it('조건을 치는 동안에는 주소가 바뀌지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await user.type(screen.getByLabelText(t.fields.q), 'GR-2026');

    expect(currentLocation()).toBe(ROUTE);
    expect(requestsTo(requests, LIST_PATH)).toHaveLength(1);
  });

  /**
   * **M03** — 조건과 쪽을 따로 갱신하면 뒤로가기 기록이 두 칸 늘어 사용자가 뒤로 눌렀는데
   * 같은 자리로 돌아온 것처럼 보인다.
   */
  it('조작 한 번에 주소 갱신도 한 번이다', async () => {
    const { user } = renderScreen(allRoutes(), '?page=2');

    await screen.findByText('GR-2026-900001');
    await user.type(screen.getByLabelText(t.fields.q), 'GR');
    await search(user);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR`);
    });

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?page=2`);
    });
  });
});

describe('SupplierReturnScreen — 수명 표', () => {
  /** **M05** — `page`·`gr`를 남기면 좁아진 결과에 없는 전표를 가리킨 채 주소만 남는다. */
  it('조건을 바꾸면 첫 쪽으로 돌아가고 고른 전표가 풀린다', async () => {
    const { user } = renderScreen(allRoutes(), '?page=2&gr=9001');

    /* 고른 전표는 목록 행과 제목줄 둘에서 보인다 — 한 곳만 집으면 집기가 실패한다. */
    await screen.findAllByText('GR-2026-900001');
    await user.type(screen.getByLabelText(t.fields.q), 'GR');
    await search(user);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR`);
    });
  });

  it('초기화가 조건·쪽·고른 전표를 함께 비운다', async () => {
    const { user } = renderScreen(allRoutes(), '?q=GR&page=2&gr=9001');

    await screen.findAllByText('GR-2026-900001');
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  /** **M06** — 쪽을 옮기면 보이는 행이 통째로 바뀐다. 고른 전표가 남으면 화면과 어긋난다. */
  it('쪽을 옮기면 고른 전표가 풀린다', async () => {
    const { user } = renderScreen(
      allRoutes([listRoute(goodsReceiptFixtures, { total: 120 })]),
      '?gr=9001',
    );

    await screen.findAllByText('GR-2026-900001');
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?page=2`);
    });
  });

  /** 고르고 푸는 것은 **보이는 행을 바꾸지 않는다** — 3쪽에서 하나 골랐다고 1쪽으로 튀면 안 된다. */
  it('전표를 골라도 조건과 쪽은 그대로다', async () => {
    const { user } = renderScreen(
      allRoutes([listRoute(goodsReceiptFixtures, { page: 2, total: 120 })]),
      '?q=GR&page=2',
    );

    await screen.findByText('GR-2026-900001');
    await selectReceipt(user, 'GR-2026-900001');

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR&page=2&gr=9001`);
    });
  });

  it('고른 전표를 다시 누르면 풀린다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9001');

    await screen.findAllByText(ITEM_LABEL);
    await user.click(
      screen.getByRole('button', { name: t.actions.deselectRow('GR-2026-900001') }),
    );

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  /**
   * **M12** — 되돌림이 목록 응답에 반응하면 사용자가 조건을 치는 도중에 값이 사라진다(#43).
   * 목록을 **실제로 다시 받은 뒤**에도 치던 값이 남아 있어야 한다.
   */
  it('목록이 다시 도착해도 치던 조건이 사라지지 않는다', async () => {
    const { user } = renderScreen(allRoutes([changingListRoute()]));

    await screen.findByText('GR-2026-900001');
    await user.type(screen.getByLabelText(t.fields.q), 'GR-2026');

    await refresh(user);

    await waitFor(() => {
      expect(screen.getByText(t.pageNav.range(1, 3, 5))).toBeInTheDocument();
    });

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('GR-2026');
  });
});

describe('SupplierReturnScreen — 전표를 고른 뒤', () => {
  it('상세를 1회 부르고 그 응답의 라인을 그린다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await selectReceipt(user, 'GR-2026-900001');
    await screen.findAllByText(ITEM_LABEL);

    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(1);
    expect(within(lineTable()).getAllByRole('row')).toHaveLength(
      goodsReceiptLineFixtures.length + 1,
    );
  });

  /**
   * **M17** — 계약에 라인 전용 경로가 있으나 상세가 라인을 함께 준다. 부르면 같은 값을
   * 한 번 더 받는다. **경로 전체를 세어** 잘못된 경로로 나간 요청도 잡는다.
   */
  it('라인 전용 경로를 부르지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await selectReceipt(user, 'GR-2026-900001');
    await screen.findAllByText(ITEM_LABEL);

    expect(requestsTo(requests, LINES_PATH)).toHaveLength(0);
    /* 짝 방향 — 그 경로에만 있는 수량이 화면 어디에도 없다. */
    expect(screen.getByRole('region', { name: t.panes.lines }).textContent ?? '').not.toContain(
      String(LINES_PATH_MARKER_QTY),
    );
  });

  it('제목줄이 상세 응답의 값을 낸다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await selectReceipt(user, 'GR-2026-900001');

    const summary = await screen.findByRole('group', { name: t.summary.label });

    expect(summary).toHaveTextContent('GR-2026-900001');
    expect(summary).toHaveTextContent(WAREHOUSE_LABEL);
  });

  /** 위치는 **그 전표의 창고**로 조회한다 — 계약이 창고를 필수 조건으로 둔다. */
  it('위치를 그 전표의 창고로 조회한다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await selectReceipt(user, 'GR-2026-900001');
    await screen.findByText(LOCATION_LABEL);

    const locations = requestsTo(requests, LOCATIONS_PATH);

    expect(locations).toHaveLength(1);
    expect(locations[0]?.url.searchParams.get('warehouseId')).toBe('9701');
  });

  /** LOT은 **품목마다 한 번**이다 — 같은 품목의 줄이 둘이어도 요청은 하나다. */
  it('자재 LOT을 품목마다 한 번씩 부른다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await selectReceipt(user, 'GR-2026-900001');
    await screen.findByText('LOT-2026-900010');

    const lots = requestsTo(requests, LOTS_PATH);

    expect(lots).toHaveLength(2);
    expect(lots.map((request) => request.url.searchParams.get('itemId')).sort()).toEqual([
      '9301',
      '9302',
    ]);
    expect(lots[0]?.url.searchParams.get('size')).toBe(String(LOT_PAGE_SIZE));
  });

  /**
   * **미사용 값을 빼지 않고 받는다.** 빼면 그 값을 참조하는 과거 입고의 이름이 빈 채로
   * 남아 **정상 값이 「알 수 없음」으로 보인다**(#47 계열). 자재 LOT에는 사용 여부 조건
   * 자체가 없어 이 조건이 붙지 않는다.
   */
  it('참조 조회가 미사용까지 받는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await selectReceipt(user, 'GR-2026-900001');
    await screen.findByText(LOCATION_LABEL);

    for (const path of [WAREHOUSES_PATH, ITEMS_PATH, UOMS_PATH, LOCATIONS_PATH]) {
      const sent = requestsTo(requests, path);

      expect(sent).toHaveLength(1);
      expect(sent[0]?.url.searchParams.get('includeInactive')).toBe('true');
    }

    /* 자재 LOT에는 사용 여부가 없다 — 없는 조건을 지어내 싣지 않는다. */
    expect(requestsTo(requests, LOTS_PATH)[0]?.url.searchParams.has('includeInactive')).toBe(false);
  });

  /**
   * **미사용 창고를 선택지에서 빼지 않고 표식만 붙인다** — 빼면 그 창고로 들어온 과거 입고를
   * 조건으로 찾을 방법이 사라진다. 표식이 없으면 사용자가 지금 쓰는 창고와 구분하지 못한다.
   */
  it('미사용 창고를 선택지에 남기고 표식을 붙인다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await user.click(screen.getByLabelText(t.fields.warehouse));

    expect(
      screen.getByText(`SAMPLE-WH-02 · 합성 창고 나${t.values.inactiveSuffix}`),
    ).toBeInTheDocument();
    /* 짝 방향 — 쓰는 창고에는 표식이 붙지 않는다(목록 칸과 선택지 둘에서 보인다). */
    expect(screen.getAllByText(WAREHOUSE_LABEL).length).toBeGreaterThan(0);
    expect(screen.queryByText(`${WAREHOUSE_LABEL}${t.values.inactiveSuffix}`)).not.toBeInTheDocument();
  });

  /** **M14** — 보류 중인 LOT에 표식이 붙고 푸는 수단이 화면 어디에도 없다(착수 이슈 §6). */
  it('보류 중인 LOT에 표식이 붙고 푸는 수단이 없다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await selectReceipt(user, 'GR-2026-900001');

    expect(await screen.findByText(t.values.lotHeld)).toBeInTheDocument();
    expect(screen.getByText(t.notes.lotHold)).toBeInTheDocument();

    for (const button of screen.getAllByRole('button')) {
      expect(button.textContent ?? '').not.toContain('보류 해제');
    }
  });

  /**
   * 계약이 보류 여부를 **선택 필드**로 두었다(실측) — 키가 아예 오지 않는 갈래가 실재한다.
   * **없는 것을 보류로 읽으면 보류가 아닌 LOT에 표식이 붙는다** — 그쪽이 더 나쁜 거짓말이다.
   */
  it('보류 여부가 오지 않으면 표식을 내지 않는다', async () => {
    const { user } = renderScreen(
      allRoutes([
        {
          match: (request) => isGet(request, LOTS_PATH),
          respond: (request) => {
            const itemId = new URL(request.url).searchParams.get('itemId');

            return jsonResponse(
              listBody(
                lotFixtures
                  .filter((lot) => String(lot.itemId) === itemId)
                  .map(({ held: _held, ...rest }) => rest),
              ),
            );
          },
        },
      ]),
    );

    await screen.findByText('GR-2026-900001');
    await selectReceipt(user, 'GR-2026-900001');

    /* 짝 방향 — LOT 이름은 실제로 풀렸다(아무것도 안 그려서 통과한 것이 아니다). */
    expect(await screen.findByText('LOT-2026-900011')).toBeInTheDocument();
    expect(screen.queryByText(t.values.lotHeld)).not.toBeInTheDocument();
    expect(screen.queryByText(t.notes.lotHold)).not.toBeInTheDocument();
  });

  /** **M10 · 짝 방향 단언** — 이름이 실제로 보이고, 두 구획 어디에도 번호가 없다(#44). */
  it('두 구획 어디에도 내부 번호가 없다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await selectReceipt(user, 'GR-2026-900001');

    await screen.findAllByText(ITEM_LABEL);

    expect(screen.getAllByText(WAREHOUSE_LABEL).length).toBeGreaterThan(0);
    expect(screen.getByText(t.lineTable.receiptQtyPair(100, UOM_LABEL))).toBeInTheDocument();
    expectNoInternalIds();
  });

  /**
   * **M09 · #47** — 본 자료가 참조보다 먼저 오면 정상 값이 「알 수 없음」으로 보이는데,
   * 그 문구는 *값이 잘못됐다*는 뜻이라 사용자가 반대로 읽는다.
   */
  it('참조가 아직 오지 않은 동안 알 수 없음으로 내지 않는다', async () => {
    const { release } = renderScreen(allRoutes(), '?gr=9001', '', [ITEMS_PATH]);

    await waitFor(() => {
      /* 품목 칸 셋이 전부 「불러오는 중」이다 — 「알 수 없음」이 아니다. */
      expect(screen.getAllByText(t.values.referenceLoading)).toHaveLength(
        goodsReceiptLineFixtures.length,
      );
    });

    release();

    expect(await screen.findAllByText(ITEM_LABEL)).toHaveLength(2);
  });

  /** **M11 · 조용한 잘림 방지** — 잘린 목록으로 이름을 풀면 정상 값이 잘못된 값으로 보인다. */
  it('참조 목록이 잘리면 그 사실을 밝힌다', async () => {
    const { user } = renderScreen(
      allRoutes([lotsRoute({ total: 99 }), lookupRoute(WAREHOUSES_PATH, warehouseFixtures, { total: 99 })]),
    );

    await screen.findByText('GR-2026-900001');

    expect(screen.getByText(t.filters.lookupTruncated)).toBeInTheDocument();

    await selectReceipt(user, 'GR-2026-900001');

    expect(await screen.findByText(t.reasons.lineReferencesTruncated)).toBeInTheDocument();
  });

  /**
   * **짝 방향** — 잘림을 한 방향으로만 재면 「늘 잘렸다」로 굳어져도 아무도 울지 않는다.
   * 그러면 정상 목록에도 「일부만 왔습니다 … 없어진 것이 아닙니다」가 서서 **화면이 늘
   * 거짓말을 한다.** 잘림을 계산하는 자리는 부등호 한 칸이라 이 방향이 없으면 무방비다.
   */
  it('잘리지 않았으면 그 안내를 내지 않는다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');

    /* 짝 방향의 짝 — 이름은 실제로 풀렸다(아무것도 안 그려서 통과한 것이 아니다). */
    expect(screen.getAllByText(WAREHOUSE_LABEL).length).toBeGreaterThan(0);
    expect(screen.queryByText(t.filters.lookupTruncated)).not.toBeInTheDocument();

    await selectReceipt(user, 'GR-2026-900001');
    await screen.findAllByText(ITEM_LABEL);

    expect(screen.queryByText(t.reasons.lineReferencesTruncated)).not.toBeInTheDocument();
  });

  /**
   * **부분 실패는 실패다.** 품목마다 한 번씩 부르므로 둘 중 하나만 실패하는 것이 정상
   * 갈래인데, 집계가 「전부 실패해야 실패」로 굳으면 실패한 품목의 LOT이 **「알 수 없음」**으로
   * 찍힌다 — 이 화면이 그 문구를 *값이 잘못됐다는 신호*로 정의해 두었으므로 **#47 재생산**이다.
   * 소비자(가드·표시)는 촘촘한데 **생산자(집계)를 지나가는 단언**이 없던 자리다.
   */
  it('품목 하나만 LOT 조회에 실패해도 실패로 낸다', async () => {
    const { user } = renderScreen(allRoutes([partialFailingLotsRoute('9302')]));

    await screen.findByText('GR-2026-900001');
    await selectReceipt(user, 'GR-2026-900001');

    expect(await screen.findByText(t.reasons.lineReferencesFailed)).toBeInTheDocument();
    /* LOT 칸은 「알 수 없음」이 아니라 「이름 불러오기 실패」다. */
    expect(screen.getAllByText(t.values.referenceFailed)).toHaveLength(
      goodsReceiptLineFixtures.length,
    );
    /* 실패 상태에서는 보류 표식도 내지 않는다 — 부분 자료로 단정하지 않는다. */
    expect(screen.queryByText(t.values.lotHeld)).not.toBeInTheDocument();
  });

  /**
   * **위 구획의 #47 자리.** 목록 응답이 창고 응답보다 먼저 오는 것은 흔한 순서이고, 그때
   * 미도착이 「알 수 없음」으로 뭉개지면 **첫 진입에 사용자가 가장 먼저 보는 칸**이 전부
   * 잘못된 값이라는 신호가 된다. 아래 구획(품목)은 재고 있었으나 위 구획만 비어 있었다.
   */
  it('창고 이름이 아직 오지 않은 동안 알 수 없음으로 내지 않는다', async () => {
    const { release } = renderScreen(allRoutes(), '', '', [WAREHOUSES_PATH]);

    await waitFor(() => {
      expect(screen.getAllByText(t.values.referenceLoading)).toHaveLength(
        goodsReceiptFixtures.length,
      );
    });

    expect(screen.queryByText(t.values.unknown)).not.toBeInTheDocument();

    release();

    /* 짝 방향 — 도착하면 실제로 이름이 풀린다. */
    expect(await screen.findAllByText(WAREHOUSE_LABEL)).toHaveLength(1);
  });
});

describe('SupplierReturnScreen — 다시 조회', () => {
  /**
   * **M15** — 목록만 다시 부르면 **갱신된 값과 갱신되지 않은 값이 한 화면에 섞인다**
   * (W-01-07의 Major 지적).
   */
  it('목록과 상세를 함께 부른다', async () => {
    const { requests, user } = renderScreen(allRoutes([changingListRoute(), changingDetailRoute()]));

    await screen.findByText('GR-2026-900001');
    await selectReceipt(user, 'GR-2026-900001');
    await screen.findByText('SAMPLE_GR_STATUS_CALL_1');

    await refresh(user);

    /* 값이 실제로 갱신됐는지까지 본다 — 요청 수만 세면 응답을 버리는 결함을 놓친다. */
    expect(await screen.findByText('SAMPLE_GR_STATUS_CALL_2')).toBeInTheDocument();
    expect(requestsTo(requests, LIST_PATH)).toHaveLength(2);
    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(2);
  });

  /** 고르지 않았으면 상세 조회가 성립하지 않는다 — 부르면 없는 전표의 경로로 요청이 나간다. */
  it('고르지 않았으면 상세를 부르지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes([changingListRoute()]));

    await screen.findByText('GR-2026-900001');
    await refresh(user);

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH)).toHaveLength(2);
    });

    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(0);
  });

  /**
   * 앞 단언은 **상세 경로 하나만** 센다 — 대체값을 단 경로(`…/0`)로 나가면 목록 계수에도
   * 상세 계수에도 걸리지 않는다. 확립 규칙 「요청 계수는 경로 전체를 센다」를 **판정에도**
   * 적용해, 이 화면이 부를 수 있는 경로 **집합 밖**으로 나간 요청을 잡는다.
   */
  it('고르지 않은 채 다시 조회해도 예상 밖 경로로 요청이 나가지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes([changingListRoute()]));

    await screen.findByText('GR-2026-900001');
    await refresh(user);

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH)).toHaveLength(2);
    });

    expectNoUnknownPath(requests);
    /* 짝 방향 — 읽기는 실제로 나갔다(아무 요청도 없어서 통과한 것이 아니다). */
    expect(requests.length).toBeGreaterThan(1);
  });

  /**
   * 요청이 나가지 않는 것만으로는 모자란다. 성립하지 않는 조회를 **불러 두면** 그 쿼리가
   * 실패로 앉고, 지금은 아래 구획이 그 실패보다 「아직 고르지 않았다」를 먼저 보아 눈에
   * 띄지 않는다 — 갈래 차례가 한 번만 바뀌면 **고르지도 않았는데 실패 배너가 서는** 화면이 된다.
   */
  it('고르지 않은 채 다시 조회해도 쓸모없는 실패를 만들지 않는다', async () => {
    const { queryClient, requests, user } = renderScreen(allRoutes([changingListRoute()]));

    await screen.findByText('GR-2026-900001');
    await refresh(user);

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH)).toHaveLength(2);
    });

    expectNoFailedQuery(queryClient);
  });

  /** 「다시 조회」는 값을 버리려고 누르는 것이 아니다 — 조건·쪽·선택을 하나도 바꾸지 않는다. */
  it('조건·쪽·고른 전표를 바꾸지 않는다', async () => {
    const { user } = renderScreen(allRoutes([changingListRoute()]), '?q=GR&page=2&gr=9001');

    await screen.findAllByText(ITEM_LABEL);
    await refresh(user);

    expect(currentLocation()).toBe(`${ROUTE}?q=GR&page=2&gr=9001`);
  });
});

describe('SupplierReturnScreen — 없는 전표', () => {
  /**
   * **M19** — 정리를 클릭 핸들러에 두면 뒤로가기·앞으로가기·주소 직접 편집이 통째로 샌다.
   * 여기서는 **주소에 실려 들어온** 번호라 클릭 핸들러가 아예 지나가지 않는다.
   */
  it('상세가 404면 고른 번호를 주소에서 정리하고 사유를 밝힌다', async () => {
    renderScreen(allRoutes(), '?gr=9003');

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeInTheDocument();

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  /** 주소를 바꿔 들어온 경우도 같은 경로다 — 화면의 핸들러를 거치지 않는다. */
  it('주소로 없는 번호를 넣어도 정리된다', async () => {
    const { user } = renderScreen(allRoutes(), '', 'gr=9003');

    await screen.findByText('GR-2026-900001');
    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeInTheDocument();

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  /**
   * 주소에서 번호를 지우고 나면 「아직 고르지 않았다」와 글자가 같아진다 —
   * 사용자가 자기가 무엇을 눌렀는지 되짚을 수 없으므로 안내를 붙들고 있는다.
   */
  it('다시 고르면 그 안내를 거둔다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9003');

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeInTheDocument();

    await selectReceipt(user, 'GR-2026-900001');

    await waitFor(() => {
      expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
    });
  });

  /**
   * 앞 단언은 **버튼 클릭**으로만 다시 고른다 — 그 길은 클릭 핸들러가 안내를 거두므로
   * effect가 없어도 지나간다. effect가 **유일한 방어**인 것은 주소 경로(뒤로가기·앞으로가기·
   * 주소 직접 편집)뿐이고, 거기서 안내가 남으면 **유효한 전표의 제목줄과 라인 표가 통째로
   * 가려진다** — 화면이 있는 것을 없다고 말하게 된다(W-01-10 R-1이 지목한 형태).
   */
  it('주소로 유효한 번호를 넣어도 그 안내를 거둔다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9003', 'gr=9001');

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeInTheDocument();

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });

    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    /* 짝 방향 — 안내가 사라질 뿐 아니라 고른 전표가 실제로 열린다. */
    expect(await screen.findByRole('group', { name: t.summary.label })).toBeInTheDocument();
    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
  });

  /**
   * **수명 표 1~3행의 「404 안내」 열(비운다).** 앞의 두 단언은 전표를 **다시 고르는** 길만
   * 재는데, 그 길은 클릭 핸들러와 effect가 이중으로 덮고 있다. 「404 안내를 비운다」를
   * 실제로 지키는 자리는 **조건 변경·초기화·쪽 이동이 함께 지나는 `applyQuery` 하나**이고
   * 그 하나가 무방비였다 — 무너지면 새 결과가 위에 멀쩡히 그려지는데 아래에는 「찾을 수
   * 없습니다」가 계속 서 있다.
   *
   * (같은 형태가 W-01-04 PR #61에서 지적되고 고쳐진 적이 있다 — 재발 자리다.)
   */
  it('새로 조회하면 404 안내를 거둔다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9003');

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeInTheDocument();

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });

    await user.type(screen.getByLabelText(t.fields.q), 'GR');
    await search(user);

    /* 안내가 사라지고 「아직 고르지 않았다」로 돌아온다 — 초기화·쪽 이동도 같은 자리를 지난다. */
    expect(await screen.findByText(t.empty.noSelectionTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
  });

  /**
   * **정리가 뒤로가기 기록을 늘리지 않는다.** 늘리면 뒤로 눌렀을 때 없는 전표를 가리키는
   * 주소로 되돌아가 같은 정리가 되풀이되고, 사용자는 **앞 화면으로 빠져나갈 수 없다.**
   */
  it('404 정리가 뒤로가기 기록을 늘리지 않는다', async () => {
    const { user } = renderScreen(allRoutes(), '?q=GR', 'gr=9003');

    await screen.findByText('GR-2026-900001');
    await user.click(screen.getByRole('button', { name: '주소 이동' }));

    expect(await screen.findByText(t.empty.notFoundTitle)).toBeInTheDocument();

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    /* 한 칸 뒤로 가면 **없는 전표 주소가 아니라** 그 앞의 조회 상태로 돌아간다. */
    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=GR`);
    });
  });

  /** 404가 아닌 실패는 다시 시도로 풀릴 수 있다 — 배너와 복구 경로를 함께 낸다. */
  it('404가 아닌 상세 실패는 배너와 다시 시도로 낸다', async () => {
    const { requests, user } = renderScreen(
      [
        failingDetailRoute(),
        listRoute(),
        otherDetailRoute(),
        missingDetailRoute(),
        linesPathRoute(),
        ...laterPhaseRoutes(),
        ...lookupRoutes(),
      ],
      '?gr=9001',
    );

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.notFoundTitle)).not.toBeInTheDocument();
    expect(currentLocation()).toBe(`${ROUTE}?gr=9001`);

    await user.click(
      within(screen.getByRole('region', { name: t.panes.lines })).getByRole('button', {
        name: messages.common.retry,
      }),
    );

    await waitFor(() => {
      expect(requestsTo(requests, DETAIL_PATH).length).toBeGreaterThan(1);
    });
  });
});

describe('SupplierReturnScreen — 빈 상태 네 갈래', () => {
  it('목록에 결과가 없으면 그 사실을 낸다', async () => {
    renderScreen(allRoutes([listRoute([])]));

    expect(await screen.findByText(t.empty.noResultTitle)).toBeInTheDocument();
  });

  it('쪽 밖이면 첫 쪽으로 가는 길을 낸다', async () => {
    const { user } = renderScreen(allRoutes([listRoute([], { page: 9, total: 120 })]), '?page=9');

    expect(await screen.findByText(t.empty.beyondLastTitle)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  it('전표를 고르기 전에는 아래 구획이 그 사실을 낸다', async () => {
    renderScreen(allRoutes());

    expect(await screen.findByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  it('그 전표에 라인이 없으면 표의 빈 상태가 맡는다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900002');
    await selectReceipt(user, 'GR-2026-900002');

    /* **M18** — 빈 상태가 표 **안에** 있어야 `Table.empty`가 닿을 수 있는 가지다. */
    expect(await screen.findByText(t.empty.noLinesTitle)).toBeInTheDocument();
    expect(within(lineTable()).getByText(t.empty.noLinesTitle)).toBeInTheDocument();
  });
});

describe('SupplierReturnScreen — 조회 실패', () => {
  /** **M07** — 실패를 「없습니다」로 내면 사용자가 자료가 없는 줄 알고 조건을 넓힌다. */
  it('목록 조회 실패는 배너로 내고 빈 상태 문구를 함께 내지 않는다', async () => {
    renderScreen(allRoutes([failingListRoute(500)]));

    expect(await screen.findByText(messages.httpError.loadTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.beyondLastTitle)).not.toBeInTheDocument();
  });

  /** 조건 줄은 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */
  it('실패해도 조건 줄은 남는다', async () => {
    renderScreen(allRoutes([failingListRoute(500)]));

    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.getByLabelText(t.fields.q)).toBeInTheDocument();
  });

  /** **M08** — 버튼만 두고 다시 부르지 않으면 사용자가 눌러도 아무 일이 없다. */
  it('「다시 시도」가 그 경로를 실제로 다시 부른다', async () => {
    const { requests, user } = renderScreen(allRoutes([failingListRoute(500)]));

    await screen.findByText(messages.httpError.loadTitle);

    const before = requestsTo(requests, LIST_PATH).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(before);
    });
  });

  it('참조 실패에는 사유와 복구 경로가 붙는다', async () => {
    renderScreen(allRoutes([failingLookupRoute(WAREHOUSES_PATH)]));

    await screen.findByText('GR-2026-900001');

    expect(screen.getByText(t.reasons.referencesFailed)).toBeInTheDocument();
    expect(screen.getAllByText(t.values.referenceFailed).length).toBe(goodsReceiptFixtures.length);
  });
});

describe('SupplierReturnScreen — 값 목록이 확정되지 않은 코드', () => {
  /** **C16** — 값을 지어내면 서버가 모르는 코드가 조건에 실려 결과가 늘 비어 보인다. */
  it('입고 유형·상태 선택지가 비어 있고 왜 비었는지 밝힌다', async () => {
    renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');

    expect(screen.getByLabelText(t.fields.receiptType)).toHaveTextContent(
      messages.pendingCode.placeholder,
    );
    expect(screen.getByLabelText(t.fields.status)).toHaveTextContent(
      messages.pendingCode.placeholder,
    );
    expect(screen.getAllByText(messages.pendingCode.note).length).toBe(2);
  });
});
