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
  balanceFixtures,
  goodsReceiptFixtures,
  goodsReceiptLineFixtures,
  INTERNAL_IDS,
  itemFixtures,
  locationFixtures,
  lotFixtures,
  ON_HAND_9601,
  uomFixtures,
  warehouseFixtures,
} from './fixtures';
import { LOT_PAGE_SIZE } from './lookups';
import { BALANCE_PAGE_SIZE } from './queries';
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

/**
 * 부를 때마다 **줄 구성이 달라지는** 상세 — 둘째 호출부터 첫 줄이 빠진다.
 *
 * **헤더만 바꾸는 스텁으로는 이 갈래를 재지 못한다.** 캐시의 구조 공유가 내용이 같은 `lines`
 * 배열의 **참조를 그대로 유지**하므로, 되돌림 의존성에 라인 배열을 넣어도 effect가 깨어나지
 * 않는다 — 결함이 있는데 아무도 울지 않는다.
 *
 * 이 상태는 실제로 일어난다: **다른 사람이 그 줄을 먼저 반품한 뒤** 사용자가 「다시 조회」를
 * 누르는 형태다.
 */
const changingLinesRoute = (): StubRoute => {
  let call = 0;

  return {
    match: (request) => isGet(request, DETAIL_PATH),
    respond: () => {
      call += 1;

      return jsonResponse(
        detailBody(0, call === 1 ? goodsReceiptLineFixtures : goodsReceiptLineFixtures.slice(1)),
      );
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
  { match: (request) => isGet(request, PARTNERS_PATH), respond: () => jsonResponse(listBody([])) },
  {
    match: (request) => request.method === 'POST' && new URL(request.url).pathname === ISSUES_PATH,
    respond: () => jsonResponse({}, { status: 201 }),
  },
];

/** 재고 잔액은 **품목마다** 부른다 — 요청의 `itemId`에 맞는 것만 돌려준다. */
const balancesRoute = (
  page?: Partial<{ page: number; size: number; total: number }>,
): StubRoute => ({
  match: (request) => isGet(request, BALANCES_PATH),
  respond: (request) => {
    const itemId = new URL(request.url).searchParams.get('itemId');
    const items = balanceFixtures.filter((balance) => String(balance.itemId) === itemId);

    return jsonResponse(listBody(items, page));
  },
});

const failingBalancesRoute = (): StubRoute => ({
  match: (request) => isGet(request, BALANCES_PATH),
  respond: () => jsonResponse({ message: '' }, { status: 500 }),
});

/**
 * 부를 때마다 **보유 수량이 줄어드는** 잔액 — 다른 사람이 그 LOT을 먼저 반품한 형태다.
 *
 * 「다시 조회」가 잔액을 실제로 다시 부르고 **그 응답을 화면에 반영하는지**를 재려면 값이
 * 달라져야 한다. 같은 본문이 돌아오면 요청 수만 늘고 글자는 그대로라, 응답을 버리는 결함과
 * 구분되지 않는다.
 */
const changingBalancesRoute = (): StubRoute => {
  const callsByItem = new Map<string, number>();

  return {
    match: (request) => isGet(request, BALANCES_PATH),
    respond: (request) => {
      const itemId = new URL(request.url).searchParams.get('itemId') ?? '';
      const call = (callsByItem.get(itemId) ?? 0) + 1;

      callsByItem.set(itemId, call);

      /* 9601은 소유 구분으로 두 줄이라 줄마다 5씩 빠지면 합계가 10 줄어든다. */
      const items = balanceFixtures
        .filter((balance) => String(balance.itemId) === itemId)
        .map((balance) =>
          balance.lotId === 9601
            ? { ...balance, onHandQty: balance.onHandQty - (call - 1) * 5 }
            : balance,
        );

      return jsonResponse(listBody(items));
    },
  };
};

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
  balancesRoute(),
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
  BALANCES_PATH,
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

const selectBox = (ordinal: number): HTMLElement =>
  screen.getByRole('checkbox', { name: t.lineTable.selectLabel(ordinal) });

const qtyBox = (ordinal: number): HTMLElement =>
  screen.getByRole('textbox', { name: t.lineTable.returnQtyLabel(ordinal) });

/** 아래 구획이 그려질 때까지 기다린다 — 참조 이름이 풀린 시점이 그 신호다. */
const openReceipt = async (
  user: ReturnType<typeof userEvent.setup>,
  goodsReceiptNo = 'GR-2026-900001',
): Promise<void> => {
  await selectReceipt(user, goodsReceiptNo);
  await screen.findAllByText(ITEM_LABEL);
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

  /** 거래처는 뒤따르는 회차(반품 정보)의 것이다 — 지금 부르면 쓰지 않는 자료를 받는다. */
  it('거래처를 부르지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);

    expect(requestsTo(requests, PARTNERS_PATH)).toHaveLength(0);
  });

  /**
   * **M25** — 잔액 조회는 고른 전표의 **창고와 품목**이 있어야 성립한다. `enabled`를 없애면
   * 없는 창고의 조건으로 요청이 나가고, 화면이 스스로 만든 실패를 사용자에게 보이게 된다.
   */
  it('전표를 고르기 전에는 잔액을 부르지 않는다', async () => {
    const { requests } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');

    expect(requestsTo(requests, BALANCES_PATH)).toHaveLength(0);
    /* **경로 전체를 센다** — 대체값을 단 다른 경로로 새어 나간 요청도 잡는다. */
    expectNoUnknownPath(requests);
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

  /**
   * **보유 수량도 함께 부른다.** 앞 잣대가 든 피해(「다른 사람이 먼저 반품한다」)로 바뀌는 것은
   * 줄 집합만이 아니라 **그 LOT에 남은 양**이고, **성공한 잔액을 다시 부를 길은 이 버튼뿐이다**
   * (표 아래 「다시 시도」는 조회가 실패했을 때만 그려진다).
   *
   * 낡은 상한은 「보유 수량 …보다 많이 되돌려 보낼 수 없습니다」라는 **사실이 아닌 문장으로
   * 정당한 반품을 막는다** — 승인 13-6이 물리친 바로 그 형태다.
   */
  it('잔액도 함께 부르고 보유 수량이 실제로 갱신된다', async () => {
    const { requests, user } = renderScreen(allRoutes([changingBalancesRoute()]));

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);
    await screen.findAllByText(t.lineTable.onHandQtyPair(ON_HAND_9601, UOM_LABEL));

    const before = requestsTo(requests, BALANCES_PATH).length;

    await refresh(user);

    await waitFor(() => {
      expect(requestsTo(requests, BALANCES_PATH).length).toBeGreaterThan(before);
    });

    /* 값이 실제로 갱신됐는지까지 본다 — 요청 수만 세면 응답을 버리는 결함을 놓친다. */
    await screen.findAllByText(t.lineTable.onHandQtyPair(ON_HAND_9601 - 10, UOM_LABEL));
    expect(
      screen.queryByText(t.lineTable.onHandQtyPair(ON_HAND_9601, UOM_LABEL)),
    ).not.toBeInTheDocument();
  });

  /** 고르지 않았으면 상세 조회가 성립하지 않는다 — 부르면 없는 전표의 경로로 요청이 나간다. */
  it('고르지 않았으면 상세도 잔액도 부르지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes([changingListRoute()]));

    await screen.findByText('GR-2026-900001');
    await refresh(user);

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH)).toHaveLength(2);
    });

    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(0);
    /* 잔액에는 가드가 없다 — 만들어진 조회가 0건이라 **자료 구조가** 이것을 지킨다. */
    expect(requestsTo(requests, BALANCES_PATH)).toHaveLength(0);
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

describe('SupplierReturnScreen — 보유 수량 조회', () => {
  /**
   * **C20** — 다섯 조건이 전부 실려야 한다. `includeZero`를 빼면 보유가 0인 LOT이 아예 오지
   * 않아 「0이라 없다」와 「잘려서 없다」가 뭉개지고, 화면이 그 줄을 막지 않게 된다(M26).
   */
  it('창고·품목·묶는 축·0 포함·쪽 크기를 함께 싣는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);

    const balances = requestsTo(requests, BALANCES_PATH);

    expect(balances.length).toBeGreaterThan(0);
    expect(Object.fromEntries(balances[0]?.url.searchParams ?? [])).toEqual({
      warehouseId: '9701',
      itemId: '9301',
      groupBy: 'LOT',
      includeZero: 'true',
      size: String(BALANCE_PAGE_SIZE),
    });
  });

  /** 번호 여러 개를 한 번에 받는 조건이 계약에 없다 — **품목마다 한 번**이고 중복은 없앤다. */
  it('품목마다 한 번씩 부르고 같은 품목은 한 번만 부른다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);

    await waitFor(() => {
      expect(
        screen.getAllByText(t.lineTable.onHandQtyPair(ON_HAND_9601, UOM_LABEL)).length,
      ).toBeGreaterThan(0);
    });

    expect(
      requestsTo(requests, BALANCES_PATH)
        .map((request) => request.url.searchParams.get('itemId'))
        .sort(),
    ).toEqual(['9301', '9302']);
  });

  /**
   * **`03_verification_t1_r2.md` 관찰 2** — 「전표를 고른 뒤」 갈래에도 경로 전체를 센다.
   * 스텁 경로가 늘어난 지금은 「스텁이 없어 하네스가 던진다」에만 기댈 수 없다.
   */
  it('전표를 고른 뒤에도 예상 밖 경로로 요청이 나가지 않는다', async () => {
    const { requests, queryClient, user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);

    expectNoUnknownPath(requests);
    expectNoFailedQuery(queryClient);
  });

  /**
   * **미도착을 「확인하지 못함」으로 말하지 않는다**(#47의 갈래 · PR ① R-5와 같은 형태).
   *
   * 훅의 `isLoading` 배선이 끊기면 잔액이 오는 중인 줄이 **상한을 못 구한 줄**로 찍히고,
   * 「막지 않습니다」 안내까지 함께 선다 — 사용자는 화면이 재어 주지 못한다고 읽는데 사실은
   * 오는 중이다. 부품에 값을 넣어 재는 테스트는 이 **계산**을 지나가지 않는다.
   */
  it('잔액이 아직 오지 않은 동안 확인하지 못함으로 내지 않는다', async () => {
    const { release, user } = renderScreen(allRoutes(), '', '', [BALANCES_PATH]);

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);

    expect(screen.getAllByText(t.values.onHandLoading).length).toBe(
      goodsReceiptLineFixtures.length,
    );
    expect(screen.queryByText(t.values.onHandUnknown)).not.toBeInTheDocument();
    expect(screen.queryByText(t.reasons.onHandUnknownNote)).not.toBeInTheDocument();

    release();

    /* 짝 방향 — 도착하면 실제로 수량이 선다(늘 「불러오는 중」이라 통과한 것이 아니다). */
    await waitFor(() => {
      expect(
        screen.getAllByText(t.lineTable.onHandQtyPair(ON_HAND_9601, UOM_LABEL)).length,
      ).toBeGreaterThan(0);
    });
  });

  /** **M23** — 못 구한 상한을 0이나 무제한으로 읽으면 막거나 다 통과한다. */
  it('그 LOT의 잔액이 없는 줄은 확인하지 못함으로 낸다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);

    await screen.findByText(t.values.onHandUnknown);
    expect(screen.getByText(t.reasons.onHandUnknownNote)).toBeInTheDocument();
  });

  /** 같은 LOT이 소유 구분으로 갈려 와도 **더한 값**이 상한이다(80 + 40). */
  it('같은 LOT의 여러 줄을 더해 보인다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);

    await waitFor(() => {
      expect(
        screen.getAllByText(t.lineTable.onHandQtyPair(ON_HAND_9601, UOM_LABEL)).length,
      ).toBeGreaterThan(0);
    });
  });

  it('잔액 조회가 실패하면 사유와 복구 경로가 붙는다', async () => {
    const { requests, user } = renderScreen(allRoutes([failingBalancesRoute()]));

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);

    await screen.findByText(t.reasons.balancesFailed);

    const before = requestsTo(requests, BALANCES_PATH).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, BALANCES_PATH).length).toBeGreaterThan(before);
    });
  });

  /** 잘림은 실패와 갈린다 — 상한으로 쓰지 않는다는 사실을 밝히고 복구 버튼은 붙이지 않는다. */
  it('잔액 목록이 잘리면 상한으로 쓰지 않는다', async () => {
    const { user } = renderScreen(
      allRoutes([balancesRoute({ total: balanceFixtures.length + 1 })]),
    );

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);

    await screen.findByText(t.reasons.balancesTruncated);
    expect(screen.getAllByText(t.values.onHandUnknown).length).toBeGreaterThan(0);
  });

  /** 전표를 바꾸면 **그 전표의 창고**로 다시 부른다 — 앞 창고의 잔액이 상한으로 남으면 안 된다. */
  it('다른 전표를 고르면 그 전표의 창고로 다시 부른다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);
    await selectReceipt(user, 'GR-2026-900002');

    await waitFor(() => {
      expect(screen.getByText(t.empty.noLinesTitle)).toBeInTheDocument();
    });

    /* 9002의 라인이 0건이라 부를 품목이 없다 — 앞 전표의 조건으로 다시 나가지도 않는다. */
    expect(
      requestsTo(requests, BALANCES_PATH).every(
        (request) => request.url.searchParams.get('warehouseId') === '9701',
      ),
    ).toBe(true);
  });
});

describe('SupplierReturnScreen — 줄 선택과 반품 수량', () => {
  /** **M22 · 승인 13-7** — 입고 수량으로 채우면 전량 반품이 기본값처럼 보인다. */
  it('반품 수량 칸이 빈 칸으로 시작한다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);

    expect(qtyBox(1)).toHaveValue('');
    expect(qtyBox(2)).toHaveValue('');
    /* 짝 방향 — 입고 수량은 실제로 그려져 있다(아무것도 안 그려서 통과한 것이 아니다). */
    expect(screen.getByText(t.lineTable.receiptQtyPair(100, UOM_LABEL))).toBeInTheDocument();
  });

  it('줄을 고르고 수량을 치면 요약이 그만큼 늘어난다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);

    expect(screen.getByText(t.selection.none)).toBeInTheDocument();

    await user.click(selectBox(1));
    await user.type(qtyBox(1), '10');

    expect(screen.getByText(t.selection.summary(1, 10, UOM_LABEL))).toBeInTheDocument();
  });

  it('고른 줄을 다시 누르면 풀린다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);

    await user.click(selectBox(1));
    await user.click(selectBox(1));

    expect(selectBox(1)).not.toBeChecked();
    expect(screen.getByText(t.selection.none)).toBeInTheDocument();
  });

  /** **M21** — 계약이 `exclusiveMinimum: 0`이라 0도 보낼 수 없다. */
  it('수량 0을 인라인 오류로 막는다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);

    await user.click(selectBox(1));
    await user.type(qtyBox(1), '0');

    expect(screen.getByText(t.errors.qtyNotPositive)).toBeInTheDocument();
    expect(screen.getByText(t.reasons.selectQtyInvalid)).toBeInTheDocument();
  });

  it('숫자가 아닌 글자를 인라인 오류로 막는다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);

    await user.click(selectBox(1));
    await user.type(qtyBox(1), '열개');

    expect(screen.getByText(t.errors.qtyNotNumber)).toBeInTheDocument();
  });

  /** **M24** — 상한 비교가 없으면 보유보다 많은 수량이 그대로 나간다. */
  it('보유 수량을 넘으면 인라인 오류로 막는다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);

    await waitFor(() => {
      expect(
        screen.getAllByText(t.lineTable.onHandQtyPair(ON_HAND_9601, UOM_LABEL)).length,
      ).toBeGreaterThan(0);
    });

    await user.click(selectBox(1));
    await user.type(qtyBox(1), '121');

    expect(screen.getByText(t.errors.qtyOverOnHand(ON_HAND_9601))).toBeInTheDocument();
    expect(screen.getByText(t.reasons.selectQtyInvalid)).toBeInTheDocument();
  });

  it('상한과 같은 값은 막지 않는다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);

    await waitFor(() => {
      expect(
        screen.getAllByText(t.lineTable.onHandQtyPair(ON_HAND_9601, UOM_LABEL)).length,
      ).toBeGreaterThan(0);
    });

    await user.click(selectBox(1));
    await user.type(qtyBox(1), String(ON_HAND_9601));

    expect(screen.queryByText(t.errors.qtyOverOnHand(ON_HAND_9601))).not.toBeInTheDocument();
    expect(screen.getByText(t.selection.summary(1, ON_HAND_9601, UOM_LABEL))).toBeInTheDocument();
  });

  /**
   * **승인 13-6 · C23** — 상한을 확인하지 못한 줄은 **막지 않는다.** 막으면 LOT이 많은
   * 창고에서 정당한 반품이 영영 불가능해진다.
   */
  it('상한을 확인하지 못한 줄은 아무리 큰 수량이어도 막지 않는다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);

    await screen.findByText(t.values.onHandUnknown);

    await user.click(selectBox(2));
    await user.type(qtyBox(2), '999999');

    for (const reason of [t.reasons.selectQtyInvalid, t.reasons.selectQtyMissing, t.reasons.selectNone]) {
      expect(screen.queryByText(reason)).not.toBeInTheDocument();
    }
  });

  /** **C25** — 고른 줄만 수량이 필수다. 고르지 않은 줄이 비어 있어도 막히지 않는다. */
  it('고르지 않은 줄의 빈 수량은 막지 않는다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);

    await user.click(selectBox(1));
    await user.type(qtyBox(1), '10');

    expect(qtyBox(2)).toHaveValue('');
    expect(screen.queryByText(t.reasons.selectQtyMissing)).not.toBeInTheDocument();
  });

  /** **C26 · M29** — 고를 수 없는 줄은 잠기고 사유가 함께 보인다. */
  it('고를 수 없는 줄은 사유와 함께 잠긴다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);

    expect(selectBox(3)).toBeDisabled();
    expect(qtyBox(3)).toBeDisabled();
    /* 잠긴 줄이 **체크된 채로** 보이면 화면이 요약과 어긋난 두 말을 한다. */
    expect(selectBox(3)).not.toBeChecked();
    expect(screen.getByText(t.reasons.lineQtyNotPositive)).toBeInTheDocument();
  });

  /** 줄마다 값을 따로 들고 있는다 — 한 줄을 치면 다른 줄이 지워지는 일이 없어야 한다. */
  it('한 줄에 쳐도 다른 줄의 값이 남는다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);

    await user.type(qtyBox(1), '10');
    await user.type(qtyBox(2), '5');

    expect(qtyBox(1)).toHaveValue('10');
    expect(qtyBox(2)).toHaveValue('5');
  });

  /** **C32** — 무엇을 얼마나 보낼지 정할 뿐, 이 회차에도 쓰기가 나가지 않는다. */
  it('줄을 고르고 수량을 쳐도 쓰기 요청이 없다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);

    await user.click(selectBox(1));
    await user.type(qtyBox(1), '10');

    expect(requestsTo(requests, ISSUES_PATH)).toHaveLength(0);
    expect(requests.map((request) => request.method)).toEqual(requests.map(() => 'GET'));
    expect(requests.map((request) => request.body)).toEqual(requests.map(() => null));
    expect(requests.length).toBeGreaterThan(0);
  });

  /** 반품을 보내는 버튼이 아직 없다 — 결과를 볼 수 없는 채로 재고가 움직여서는 안 된다. */
  it('반품을 보내는 버튼이 없다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);

    for (const button of screen.getAllByRole('button')) {
      expect(button.textContent ?? '').not.toContain('반품 처리');
    }
  });

  it('줄을 골라도 두 구획 어디에도 내부 번호가 없다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);

    await user.click(selectBox(1));
    await user.type(qtyBox(1), '10');

    expect(screen.getAllByText(ITEM_LABEL).length).toBeGreaterThan(0);
    expectNoInternalIds();
  });
});

describe('SupplierReturnScreen — 줄 초안의 수명', () => {
  /**
   * **M27 · #43 — 내용이 같은 응답이 다시 온 갈래.**
   *
   * 되돌림 의존성에 **상세 응답 객체**가 들어가면 이 갈래에서 값이 사라진다. 다만 캐시의
   * 구조 공유 때문에 **`lines` 배열의 참조는 그대로 유지**되므로, 라인 배열을 넣은 형태는
   * 이 잣대를 지나간다 — 그 갈래는 바로 아래 테스트가 맡는다.
   */
  it('다시 조회해도 고른 줄과 친 수량이 남는다', async () => {
    const { user } = renderScreen(allRoutes([changingListRoute(), changingDetailRoute()]));

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);

    await user.click(selectBox(1));
    await user.type(qtyBox(1), '10');

    await refresh(user);

    /* 상세가 실제로 다시 왔다 — 응답이 안 바뀌어서 통과한 것이 아니다. */
    await screen.findByText('SAMPLE_GR_STATUS_CALL_2');

    expect(qtyBox(1)).toHaveValue('10');
    expect(selectBox(1)).toBeChecked();
  });

  /**
   * **M27 · #43 — 줄 구성이 실제로 달라진 갈래**(수명 표 10행 · 계획 결정 8).
   *
   * 「다시 조회」는 값을 버리려고 누르는 것이 아니다. 사라진 줄의 초안은 **표에 있는 줄만
   * 세는 것**으로 걸러지므로 **지우지 않아도 된다** — 지우면 다른 사람이 그 전표의 다른 줄을
   * 먼저 반품한 것만으로 **사용자가 치던 수량이 말없이 사라진다.**
   *
   * 앞 줄이 빠져 **표시 순번이 하나 당겨지는데도** 초안이 그 줄에 그대로 매여 있어야 한다 —
   * 초안의 키가 자리가 아니라 라인 번호임을 함께 잰다.
   */
  it('줄 하나가 사라져도 남은 줄에 친 수량이 살아 있다', async () => {
    const { user } = renderScreen(allRoutes([changingListRoute(), changingLinesRoute()]));

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);

    await user.click(selectBox(2));
    await user.type(qtyBox(2), '10');

    await refresh(user);

    /* 줄이 실제로 하나 빠졌다 — 같은 응답이 다시 와서 통과한 것이 아니다. */
    await waitFor(() => {
      expect(screen.getAllByRole('textbox', { name: /번째 줄 반품 수량$/ })).toHaveLength(
        goodsReceiptLineFixtures.length - 1,
      );
    });

    expect(qtyBox(1)).toHaveValue('10');
    expect(selectBox(1)).toBeChecked();
    expect(screen.getByText(t.selection.summary(1, 10, UOM_LABEL))).toBeInTheDocument();
  });

  /** 참조·잔액이 늦게 도착해도 초안을 건드리지 않는다(수명 표 9행). */
  it('잔액이 늦게 도착해도 친 수량이 사라지지 않는다', async () => {
    const { release, user } = renderScreen(allRoutes(), '', '', [BALANCES_PATH]);

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);

    await user.type(qtyBox(1), '10');

    release();

    await waitFor(() => {
      expect(
        screen.getAllByText(t.lineTable.onHandQtyPair(ON_HAND_9601, UOM_LABEL)).length,
      ).toBeGreaterThan(0);
    });

    expect(qtyBox(1)).toHaveValue('10');
  });

  /** 대상이 바뀌면 앞 전표의 수량은 뜻을 잃는다(수명 표 4행) — 남으면 남의 전표의 수량이 실린다. */
  it('다른 전표를 고르면 초안이 비워진다', async () => {
    const { user } = renderScreen(allRoutes());

    await screen.findByText('GR-2026-900001');
    await openReceipt(user);

    await user.click(selectBox(1));
    await user.type(qtyBox(1), '10');

    await selectReceipt(user, 'GR-2026-900002');
    await screen.findByText(t.empty.noLinesTitle);

    await selectReceipt(user, 'GR-2026-900001');
    await screen.findAllByText(ITEM_LABEL);

    expect(qtyBox(1)).toHaveValue('');
    expect(selectBox(1)).not.toBeChecked();
  });

  /**
   * **주소를 바꾸는 길이 클릭 핸들러만이 아니다.** 뒤로가기·앞으로가기·주소 직접 편집은
   * 핸들러를 거치지 않으므로, 비우기를 핸들러에 두면 그 경로가 통째로 샌다.
   */
  it('주소로 대상을 바꿔도 초안이 비워진다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9001', '?gr=9002');

    await screen.findAllByText(ITEM_LABEL);

    await user.click(selectBox(1));
    await user.type(qtyBox(1), '10');

    await user.click(screen.getByRole('button', { name: '주소 이동' }));
    await screen.findByText(t.empty.noLinesTitle);

    await user.click(screen.getByRole('button', { name: t.actions.selectRow('GR-2026-900001') }));
    await screen.findAllByText(ITEM_LABEL);

    expect(qtyBox(1)).toHaveValue('');
    expect(selectBox(1)).not.toBeChecked();
  });

  /** 조건을 바꾸면 `gr`가 풀리고 초안도 함께 비워진다(수명 표 1행). */
  it('조건을 바꾸면 초안이 비워진다', async () => {
    const { user } = renderScreen(allRoutes(), '?gr=9001');

    await screen.findAllByText(ITEM_LABEL);

    await user.click(selectBox(1));
    await user.type(qtyBox(1), '10');

    await user.type(screen.getByLabelText(t.fields.q), 'GR-2026');
    await search(user);

    await screen.findByText(t.empty.noSelectionTitle);

    await user.click(screen.getByRole('button', { name: t.actions.selectRow('GR-2026-900001') }));
    await screen.findAllByText(ITEM_LABEL);

    expect(qtyBox(1)).toHaveValue('');
    expect(selectBox(1)).not.toBeChecked();
  });
});
