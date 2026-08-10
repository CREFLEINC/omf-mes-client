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
  inboundReceiptFixtures,
  inboundReceiptLine,
  inboundReceiptLineFixtures,
  itemFixtures,
  lotFixtures,
  partnerFixtures,
  plantFixtures,
  uomFixtures,
} from './fixtures';
import { LOT_PAGE_SIZE } from './lookups';
import { irKeys } from './queries';
import { GoodsReceiptScreen } from './screen';

const t = messages.goodsReceipt;

const ROUTE = '/logistics/goods-receipt';
const LIST_PATH = '/logistics/inbound-receipts';
const DETAIL_PATH = '/logistics/inbound-receipts/9001';
const LINES_PATH = '/logistics/inbound-receipts/9001/lines';
const OTHER_LINES_PATH = '/logistics/inbound-receipts/9002/lines';
/** 이 화면이 PR ②에서 쓸 입고 처리 경로. **지금은 부르지 않는다** — 그것을 증명하려고 스텁을 둔다. */
const GOODS_RECEIPTS_PATH = '/logistics/goods-receipts';
const PARTNERS_PATH = '/mdm/partners';
const PLANTS_PATH = '/mdm/plants';
const ITEMS_PATH = '/mdm/items';
const UOMS_PATH = '/mdm/uoms';
const LOTS_PATH = '/trace/lots';

/**
 * 상세 응답에만 있는 표식. 화면이 입하 상세를 부르지 않는다는 것을 **두 방향으로** 굳힌다 —
 * ① 상세 경로 요청이 0회 ② 이 표식이 화면 어디에도 나타나지 않음.
 * 스텁을 두지 않으면 하네스가 던져 「부르지 않았다」와 「불렀는데 실패했다」가 구분되지 않는다.
 */
const DETAIL_MARKER = 'IR-2026-900001-FROM-DETAIL';

const SUPPLIER_LABEL = 'SAMPLE-SUP-01 · 합성 공급사 가';
const ITEM_LABEL = 'SAMPLE-ITEM-01 · 합성 품목 가';
const PLANT_LABEL = 'SAMPLE-PLT-01 · 합성 공장 가';
const UOM_LABEL = 'SAMPLE-EA · 합성 단위 개';

/**
 * 화면 어디에도 나와서는 안 되는 내부 번호(FK).
 *
 * 픽스처의 번호 대역을 그대로 쓴다 — 업무 번호(`IR-2026-900001`·`LOT-2026-900010`)에
 * 이 문자열이 부분으로 들어가지 않도록 대역을 갈라 두었다.
 */
const INTERNAL_IDS = [
  '9001',
  '9002',
  '9003',
  '9101',
  '9102',
  '9201',
  '9202',
  '9301',
  '9302',
  '9401',
  '9402',
  '9403',
  '9404',
  '9501',
  '9601',
  '9602',
  '9603',
];

interface RecordedRequest {
  method: string;
  url: URL;
  /**
   * 쓰기 요청의 본문. 읽기에는 `null`이다.
   *
   * **실제로 나간 요청을 본다.** 이 PR에서는 그 목록에 쓰기가 하나도 없다는 것이 단언이다.
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
  items: unknown[] = inboundReceiptFixtures,
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
 * 「고른 전표가 갱신된 결과에 없다」를 실제로 만들어 내는 유일한 방법이다.
 */
const filteringListRoute = (): StubRoute => ({
  match: (request) => isGet(request, LIST_PATH),
  respond: (request) => {
    const q = new URL(request.url).searchParams.get('q');
    const items =
      q === null
        ? inboundReceiptFixtures
        : inboundReceiptFixtures.filter((row) => row.inboundReceiptNo.includes(q));

    return jsonResponse(listBody(items));
  },
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

      return jsonResponse(
        listBody(inboundReceiptFixtures, { total: inboundReceiptFixtures.length + call }),
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

/** 자재 LOT은 **품목마다** 부른다 — 요청의 `itemId`에 맞는 것만 돌려준다. */
const lotsRoute = (): StubRoute => ({
  match: (request) => isGet(request, LOTS_PATH),
  respond: (request) => {
    const itemId = new URL(request.url).searchParams.get('itemId');
    const items =
      itemId === null ? lotFixtures : lotFixtures.filter((lot) => String(lot.itemId) === itemId);

    return jsonResponse(listBody(items));
  },
});

/** 참조 목록 다섯. 화면이 이름으로 풀 수 있는 정상 상태다. */
const lookupRoutes = (): StubRoute[] => [
  lookupRoute(PARTNERS_PATH, partnerFixtures),
  lookupRoute(PLANTS_PATH, plantFixtures),
  lookupRoute(ITEMS_PATH, itemFixtures),
  lookupRoute(UOMS_PATH, uomFixtures),
  lotsRoute(),
];

const failingLookupRoute = (pathname: string): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse({ message: '' }, { status: 500 }),
});

/** 라인 조회. 고른 전표의 줄만 돌려준다. */
const linesRoute = (items: unknown[] = inboundReceiptLineFixtures): StubRoute => ({
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
 * 다시 부르면 **줄 구성이 달라지는** 라인 응답.
 *
 * 전표가 고쳐지거나 다른 사용자가 먼저 처리해 줄이 사라지는 일이 실제로 있다.
 */
const shrinkingLinesRoute = (): StubRoute => {
  let call = 0;

  return {
    match: (request) => isGet(request, LINES_PATH),
    respond: () => {
      call += 1;

      return jsonResponse({
        items: call === 1 ? inboundReceiptLineFixtures : inboundReceiptLineFixtures.slice(1),
      });
    },
  };
};

/**
 * 입하 상세 스텁. **부를 수 있게 두는 것이 요점이다** —
 * 스텁이 없으면 하네스가 던져 「부르지 않았다」를 증명할 수 없다.
 */
const detailRoute = (): StubRoute => ({
  match: (request) => isGet(request, DETAIL_PATH),
  respond: () =>
    jsonResponse({
      inboundReceipt: { ...(inboundReceiptFixtures[0] ?? {}), inboundReceiptNo: DETAIL_MARKER },
      lines: [],
    }),
});

/**
 * 입고 처리(쓰기) 스텁. **부를 수 있게 두는 것이 요점이다** —
 * 「이 PR은 쓰기를 하나도 부르지 않는다」를 증명하려면 부를 수 있는 자리가 있어야 한다.
 */
const goodsReceiptRoute = (): StubRoute => ({
  match: (request) =>
    request.method === 'POST' && new URL(request.url).pathname === GOODS_RECEIPTS_PATH,
  respond: () =>
    jsonResponse({ goodsReceipt: { goodsReceiptNo: 'GR-2026-900001' }, lines: [] }, { status: 201 }),
});

/** 이 화면이 닿을 수 있는 경로를 전부 스텁으로 둔 한 벌. */
const allRoutes = (): StubRoute[] => [
  listRoute(),
  linesRoute(),
  otherLinesRoute(),
  detailRoute(),
  goodsReceiptRoute(),
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
      <GoodsReceiptScreen />
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

const currentLocation = (): string => screen.getByTestId('location').textContent ?? '';

const listTable = (): HTMLElement => screen.getAllByRole('table')[0] as HTMLElement;

const lineTable = (): HTMLElement => screen.getAllByRole('table')[1] as HTMLElement;

const selectReceipt = async (
  user: ReturnType<typeof userEvent.setup>,
  inboundReceiptNo: string,
): Promise<void> => {
  await user.click(screen.getByRole('button', { name: t.actions.selectRow(inboundReceiptNo) }));
};

const selectLine = async (
  user: ReturnType<typeof userEvent.setup>,
  lineNo: number,
): Promise<void> => {
  await user.click(screen.getByRole('button', { name: t.actions.selectLine(lineNo) }));
};

/**
 * 두 구획 어디에도 내부 번호가 새지 않았는지 본다. 짝이 되는 「이름은 보인다」와 함께 쓴다.
 *
 * **주소는 세지 않는다.** 고른 전표·라인의 번호는 주소 키(`ir`·`line`)로 실리는데, 그것은
 * 표시가 아니라 주소 지정 수단이다 — 새로고침·뒤로가기·공유가 같은 대상을 열려면 어딘가에
 * 실려야 하고, 사용자 대면 번호로는 라인 경로를 조립할 수 없다(계약이 내부 번호를 받는다).
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

describe('GoodsReceiptScreen — 첫 진입 조회', () => {
  /*
   * **M01** — 기본 기간을 심으면 첫 요청에 날짜가 실리고, 사용자는 왜 그 기간만 보이는지
   * 화면 어디에서도 읽을 수 없다(W-01-09가 세운 규칙).
   */
  it('목록 요청이 1회 나가고 날짜 조건이 실리지 않는다', async () => {
    const { requests } = renderScreen(allRoutes());

    await screen.findAllByText('IR-2026-900001');

    const list = requestsTo(requests, LIST_PATH);

    expect(list).toHaveLength(1);
    expect(list[0]?.url.searchParams.has('receiptDateFrom')).toBe(false);
    expect(list[0]?.url.searchParams.has('receiptDateTo')).toBe(false);
    /* 짝 방향 — 조건 자체가 하나도 실리지 않는다. */
    expect([...(list[0]?.url.searchParams.keys() ?? [])]).toEqual([]);
  });

  it('조건을 심지 않고 주소를 그대로 둔다', async () => {
    renderScreen(allRoutes());

    await screen.findAllByText('IR-2026-900001');

    expect(currentLocation()).toBe(ROUTE);
  });

  it('결과가 표에 그려지고 배너가 없다', async () => {
    renderScreen(allRoutes());

    await screen.findAllByText('IR-2026-900001');

    expect(within(listTable()).getAllByRole('row')).toHaveLength(
      inboundReceiptFixtures.length + 1,
    );
    expect(screen.queryByText(messages.httpError.loadTitle)).not.toBeInTheDocument();
  });

  /* 상세가 주는 헤더 값은 목록 행에 이미 들어 있다 — 부르면 같은 값을 한 번 더 받는다. */
  it('입하 상세를 부르지 않는다', async () => {
    const { requests } = renderScreen(allRoutes());

    await screen.findAllByText('IR-2026-900001');

    expect(requestsTo(requests, DETAIL_PATH)).toHaveLength(0);
    expect(screen.queryByText(DETAIL_MARKER)).not.toBeInTheDocument();
  });

  /*
   * **M20 · C20** — 이 PR은 대상을 고르는 데까지다. 되돌릴 수 없는 쓰기는 결과 구획과
   * 함께 나가야 하므로(계획 §5.0) 여기서는 어떤 쓰기도 나가지 않는다.
   */
  it('어떤 쓰기 요청도 보내지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findAllByText('IR-2026-900001');
    await selectReceipt(user, 'IR-2026-900001');
    await screen.findAllByText(ITEM_LABEL);
    await selectLine(user, 1);

    await waitFor(() => {
      expect(currentLocation()).toContain('line=9401');
    });

    expect(requestsTo(requests, GOODS_RECEIPTS_PATH)).toHaveLength(0);
    expect(requests.map((request) => request.method)).toEqual(requests.map(() => 'GET'));
    /* 본문이 실린 요청도 없다 — method만 세면 다른 경로의 쓰기를 놓친다. */
    expect(requests.map((request) => request.body)).toEqual(requests.map(() => null));
    /* 짝 방향 — 읽기는 실제로 나갔다(아무 요청도 없어서 통과한 것이 아니다). */
    expect(requests.length).toBeGreaterThan(0);
  });

  /*
   * **M19 · C12** — 라인 표가 쓰는 참조 셋(품목·단위·자재 LOT)은 아래 구획만 쓴다.
   * 그 표 자체가 라인 응답을 기다리므로 미리 받아 둘 이득이 없고, 고르기 전에 부르면
   * 어느 요청이 무엇을 위한 것인지 가릴 수 없고 첫 진입의 요청 수가 이유 없이 는다.
   */
  it('품목·단위·자재 LOT을 전표를 고르기 전에 부르지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findAllByText('IR-2026-900001');

    expect(requestsTo(requests, ITEMS_PATH)).toHaveLength(0);
    expect(requestsTo(requests, UOMS_PATH)).toHaveLength(0);
    expect(requestsTo(requests, LOTS_PATH)).toHaveLength(0);

    // 짝 방향 — 고르면 실제로 부른다(스텁이 있으므로 「부를 수 있었다」가 성립한다).
    await selectReceipt(user, 'IR-2026-900001');

    await waitFor(() => {
      expect(requestsTo(requests, ITEMS_PATH).length).toBeGreaterThan(0);
      expect(requestsTo(requests, UOMS_PATH).length).toBeGreaterThan(0);
      expect(requestsTo(requests, LOTS_PATH).length).toBeGreaterThan(0);
    });
  });

  /*
   * **공장만 미리 받는다.** 제목줄은 **목록 응답만으로** 곧바로 그려지므로(고른 행에 값이 있다)
   * 고른 뒤에 부르기 시작하면 제목줄만 한 박자 늦게 채워진다 — 라인 표가 쓰는 셋과 사정이 다르다.
   */
  it('공급사와 공장은 첫 진입에 부른다', async () => {
    const { requests } = renderScreen(allRoutes());

    await screen.findAllByText('IR-2026-900001');

    expect(requestsTo(requests, PARTNERS_PATH)).toHaveLength(1);
    expect(requestsTo(requests, PLANTS_PATH)).toHaveLength(1);
  });

  /* 자재 LOT은 번호 목록으로 조회할 수단이 없어 **품목마다** 부른다. */
  it('자재 LOT을 라인의 품목마다 한 번씩 부른다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findAllByText('IR-2026-900001');
    await selectReceipt(user, 'IR-2026-900001');

    await waitFor(() => {
      expect(requestsTo(requests, LOTS_PATH)).toHaveLength(2);
    });

    expect(
      requestsTo(requests, LOTS_PATH)
        .map((request) => request.url.searchParams.get('itemId'))
        .sort(),
    ).toEqual(['9301', '9302']);
  });

  /*
   * **R-1의 완화 층** — 자재 LOT은 다섯 중 유일한 거래 기록이라 가장 잘리기 쉽다.
   * 쪽 크기를 실어 잘림 **빈도**를 낮춘다. 보장이 아니므로 잘림 표식이 따로 있다.
   *
   * 짝 방향으로 **다른 참조에는 싣지 않는다**를 함께 단언한다 — 그래야 이 값이
   * 「자재 LOT에만 필요한 완화」임이 고정된다.
   */
  it('자재 LOT에만 쪽 크기를 싣는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findAllByText('IR-2026-900001');
    await selectReceipt(user, 'IR-2026-900001');

    await waitFor(() => {
      expect(requestsTo(requests, LOTS_PATH).length).toBeGreaterThan(0);
    });

    for (const request of requestsTo(requests, LOTS_PATH)) {
      expect(request.url.searchParams.get('size')).toBe(String(LOT_PAGE_SIZE));
    }

    for (const path of [PARTNERS_PATH, PLANTS_PATH, ITEMS_PATH, UOMS_PATH, LIST_PATH]) {
      for (const request of requestsTo(requests, path)) {
        expect(request.url.searchParams.has('size')).toBe(false);
      }
    }
  });

  /* **C21** — 조회 조건의 상태 선택지는 비어 있고 왜 비어 있는지 안내가 붙는다. */
  it('상태 선택지가 비어 있고 안내가 붙는다', async () => {
    renderScreen(allRoutes());

    await screen.findAllByText('IR-2026-900001');

    const status = screen.getByLabelText(t.fields.status);

    expect(status.getAttribute('aria-describedby')).toBe(
      screen.getByText(messages.pendingCode.note).getAttribute('id'),
    );
  });
});

describe('GoodsReceiptScreen — 조건과 주소', () => {
  /* **M02 · C03** — 조건을 화면 상태로만 들고 있으면 새로고침·공유가 다른 결과를 낸다. */
  it('주소의 조건이 요청 쿼리에 그대로 실린다', async () => {
    const { requests } = renderScreen(
      allRoutes(),
      '?sup=9101&from=2026-08-01&to=2026-08-31&st=SAMPLE_IR_STATUS_A&q=IR-2026',
    );

    await screen.findAllByText('IR-2026-900001');

    const query = requestsTo(requests, LIST_PATH)[0]?.url.searchParams;

    expect(query?.get('supplierId')).toBe('9101');
    expect(query?.get('receiptDateFrom')).toBe('2026-08-01');
    expect(query?.get('receiptDateTo')).toBe('2026-08-31');
    expect(query?.get('statusCode')).toBe('SAMPLE_IR_STATUS_A');
    expect(query?.get('q')).toBe('IR-2026');
  });

  it('조건 줄에서 조회하면 주소와 요청에 함께 나타난다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findAllByText('IR-2026-900001');
    await user.type(screen.getByLabelText(t.fields.q), 'IR-2026-900002');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH)).toHaveLength(2);
    });

    expect(currentLocation()).toContain('q=IR-2026-900002');
    expect(requestsTo(requests, LIST_PATH)[1]?.url.searchParams.get('q')).toBe('IR-2026-900002');
  });

  /*
   * **M03 · C04** — 조건과 쪽을 따로 갱신하면 뒤로가기 기록이 두 칸 늘어
   * 사용자가 뒤로 눌렀는데 같은 자리로 돌아온 것처럼 보인다.
   */
  it('조회 한 번에 히스토리가 한 칸만 늘어난다', async () => {
    const { user } = renderScreen(allRoutes(), '?page=2');

    await screen.findAllByText('IR-2026-900001');
    await user.type(screen.getByLabelText(t.fields.q), 'IR-2026-900002');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(currentLocation()).toContain('q=IR-2026-900002');
    });

    // 한 칸만 늘었으면 뒤로 한 번에 처음 주소로 돌아온다.
    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?page=2`);
    });
  });

  /* **M04** — 조건이 바뀌면 그 결과에 없을 수 있는 선택을 남기지 않는다(수명 표 1행). */
  it('조건 변경이 쪽과 고른 전표·라인을 함께 비운다', async () => {
    const { user } = renderScreen(allRoutes(), '?page=2&ir=9001&line=9401');

    await screen.findAllByText('IR-2026-900001');
    await user.type(screen.getByLabelText(t.fields.q), 'IR-2026');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=IR-2026`);
    });
  });

  it('초기화가 조건과 선택을 모두 비운다', async () => {
    const { user } = renderScreen(allRoutes(), '?sup=9101&q=IR&ir=9001&line=9401');

    await screen.findAllByText('IR-2026-900001');
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  /* **M05** — 쪽을 옮기면 보이는 행이 통째로 달라진다. 앞 쪽의 선택을 남기지 않는다(수명 표 3행). */
  it('쪽 이동이 고른 전표·라인을 비운다', async () => {
    const { user } = renderScreen(
      [
        listRoute(inboundReceiptFixtures, { page: 1, size: 2, total: 6 }),
        linesRoute(),
        otherLinesRoute(),
        detailRoute(),
        goodsReceiptRoute(),
        ...lookupRoutes(),
      ],
      '?sup=9101&ir=9001&line=9401',
    );

    await screen.findAllByText('IR-2026-900001');
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?sup=9101&page=2`);
    });
  });

  /*
   * **M09의 화면 몫** — 정수가 아닌 번호를 그대로 보내면 조회 전체가 400으로 실패하고,
   * 사용자에게는 「조회가 늘 안 된다」로만 보인다.
   */
  it('정수가 아닌 조건과 선택은 요청에 실리지 않는다', async () => {
    const { requests } = renderScreen(allRoutes(), '?sup=abc&page=0&ir=xyz&line=0&from=2026-13-01');

    await screen.findAllByText('IR-2026-900001');

    const query = requestsTo(requests, LIST_PATH)[0]?.url.searchParams;

    expect(query?.has('supplierId')).toBe(false);
    expect(query?.has('page')).toBe(false);
    expect(query?.has('receiptDateFrom')).toBe(false);
    /* 고른 전표가 없는 것으로 읽혀 아래 구획은 「고르면 보인다」다 — 라인 조회도 나가지 않는다. */
    expect(requestsTo(requests, LINES_PATH)).toHaveLength(0);
    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  /*
   * **M15** — 조건 줄 입력이 주소를 바꾸면 글자마다 뒤로가기 기록이 쌓이고,
   * 반쯤 지운 검색어로 요청이 나간다.
   */
  it('조건을 치는 동안 주소가 바뀌지 않고 요청도 늘지 않는다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findAllByText('IR-2026-900001');
    await user.type(screen.getByLabelText(t.fields.q), 'IR-2026-9');

    expect(currentLocation()).toBe(ROUTE);
    expect(requestsTo(requests, LIST_PATH)).toHaveLength(1);
  });

  /*
   * **M14 · #43** — 목록 응답이 도착해 부모가 다시 그려질 때 조건 줄이 참조로 되돌림을
   * 판정하면 **치던 값이 사라진다.** 이 PR에서 사용자가 치는 자리는 조건 줄뿐이고,
   * 같은 형태의 되돌림이 PR ②의 초안에서 다시 나온다.
   */
  it('목록이 다시 도착해도 치던 조건이 사라지지 않는다', async () => {
    const { requests, queryClient, user } = renderScreen([
      changingListRoute(),
      linesRoute(),
      otherLinesRoute(),
      detailRoute(),
      goodsReceiptRoute(),
      ...lookupRoutes(),
    ]);

    await screen.findAllByText('IR-2026-900001');
    /* 첫 응답이 적용된 것을 눈에 보이는 값으로 확인한다 — 전체 건수가 부를 때마다 는다. */
    await screen.findByText(t.pageNav.range(1, 3, 4));

    await user.type(screen.getByLabelText(t.fields.q), 'IR-2026-9');

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: irKeys.lists });
    });

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(1);
    });

    /*
     * **새 응답이 실제로 화면에 적용될 때까지 기다린다.** 요청이 나간 것만 보고 단언하면
     * 다시 그려지기 전에 검사해 **어떤 되돌림 결함도 통과시킨다**(늘 참인 단언).
     */
    await screen.findByText(t.pageNav.range(1, 3, 5));

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('IR-2026-9');
  });
});

describe('GoodsReceiptScreen — 조회 실패', () => {
  /*
   * **M07 · C08** — 실패를 「없습니다」로 내면 사용자가 자료가 없는 줄 알고 조건을 넓힌다.
   * 실제로는 조회 자체가 되지 않은 것이라 무엇을 해도 결과가 같다.
   */
  it('조회 실패는 배너로 내고 빈 상태 문구를 함께 내지 않는다', async () => {
    renderScreen([failingListRoute(500), ...lookupRoutes(), goodsReceiptRoute()]);

    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.beyondLastTitle)).not.toBeInTheDocument();
  });

  it('조회가 실패해도 조건 줄은 남는다', async () => {
    renderScreen([failingListRoute(500), ...lookupRoutes(), goodsReceiptRoute()]);

    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.getByRole('button', { name: messages.common.search })).toBeInTheDocument();
  });

  /* **C08** — 같은 권한으로 다시 불러도 같은 답이 온다. 헛돌게 하지 않는다. */
  it('권한이 없으면 다시 시도를 내지 않는다', async () => {
    renderScreen([failingListRoute(403), ...lookupRoutes(), goodsReceiptRoute()]);

    await screen.findByText(messages.httpError.forbidden);

    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  /* **M08 · C09** — 「버튼이 있다」만 보면 눌러도 아무 일이 없는 버튼을 통과시킨다. */
  it('다시 시도를 누르면 그 경로의 요청 수가 는다', async () => {
    const { requests, user } = renderScreen([
      failingListRoute(500),
      ...lookupRoutes(),
      goodsReceiptRoute(),
    ]);

    await screen.findByText(messages.httpError.loadTitle);

    const before = requestsTo(requests, LIST_PATH).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).length).toBeGreaterThan(before);
    });
  });

  it('라인 조회 실패는 아래 구획의 배너로 낸다', async () => {
    const { user } = renderScreen([
      listRoute(),
      failingLinesRoute(),
      otherLinesRoute(),
      detailRoute(),
      goodsReceiptRoute(),
      ...lookupRoutes(),
    ]);

    await screen.findAllByText('IR-2026-900001');
    await selectReceipt(user, 'IR-2026-900001');

    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.queryByText(t.empty.noLinesTitle)).not.toBeInTheDocument();
  });

  /*
   * 고른 번호는 있는데 목록을 못 받았다. 골격을 내면 **기다리라고 말하는데 기다려서 풀리지 않는다** —
   * 제목줄이 쓰는 전표의 값이 목록 응답에만 있어 구획을 열 수 없다.
   */
  it('목록이 실패하면 고른 전표를 열 수 없다고 밝힌다', async () => {
    renderScreen([failingListRoute(500), ...lookupRoutes(), goodsReceiptRoute()], '?ir=9001');

    await screen.findByText(t.empty.listFailedTitle);

    expect(screen.queryByRole('status', { name: t.loading.lines })).not.toBeInTheDocument();
  });
});

describe('GoodsReceiptScreen — 전표 고르기', () => {
  /* **C10 · C16** — 고르면 라인을 1회 조회하고 그 사실이 주소에 남는다. */
  it('전표를 고르면 라인을 1회 조회하고 주소에 실린다', async () => {
    const { requests, user } = renderScreen(allRoutes());

    await screen.findAllByText('IR-2026-900001');
    await selectReceipt(user, 'IR-2026-900001');

    await screen.findAllByText(ITEM_LABEL);

    expect(requestsTo(requests, LINES_PATH)).toHaveLength(1);
    expect(currentLocation()).toBe(`${ROUTE}?ir=9001`);
  });

  /* 새로고침·공유가 같은 전표를 연다 — 주소만 주어져도 아래 구획이 열린다. */
  it('주소에 고른 전표가 있으면 곧바로 라인이 열린다', async () => {
    renderScreen(allRoutes(), '?ir=9001');

    await screen.findAllByText(ITEM_LABEL);

    expect(screen.getByRole('group', { name: t.summary.label })).toBeInTheDocument();
  });

  /* 고르고 푸는 것은 보이는 행을 바꾸지 않는다(수명 표 4행). */
  it('전표를 고르고 풀어도 조건과 쪽이 그대로다', async () => {
    const { user } = renderScreen(
      [
        listRoute(inboundReceiptFixtures, { page: 2, size: 2, total: 6 }),
        linesRoute(),
        otherLinesRoute(),
        detailRoute(),
        goodsReceiptRoute(),
        ...lookupRoutes(),
      ],
      '?sup=9101&page=2',
    );

    await screen.findAllByText('IR-2026-900001');
    await selectReceipt(user, 'IR-2026-900001');

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?sup=9101&page=2&ir=9001`);
    });

    await user.click(
      screen.getByRole('button', { name: t.actions.deselectRow('IR-2026-900001') }),
    );

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?sup=9101&page=2`);
    });
  });

  /* 다른 전표로 옮기면 앞 전표의 라인 선택은 뜻을 잃는다(수명 표 4행). */
  it('다른 전표를 고르면 고른 라인이 풀린다', async () => {
    const { user } = renderScreen(allRoutes(), '?ir=9001&line=9401');

    await screen.findAllByText(ITEM_LABEL);
    await selectReceipt(user, 'IR-2026-900002');

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?ir=9002`);
    });
  });

  /*
   * **M17 · C18** — 갱신된 결과에 고른 전표가 없으면 주소에서 정리한다.
   * **클릭 핸들러가 아니라 고른 식별자에 묶여야** 주소 직접 편집·뒤로가기에서도 샌다.
   */
  it('결과에 없는 전표는 주소에서 정리된다', async () => {
    renderScreen(
      [
        filteringListRoute(),
        linesRoute(),
        otherLinesRoute(),
        detailRoute(),
        goodsReceiptRoute(),
        ...lookupRoutes(),
      ],
      '?q=IR-2026-900002&ir=9001&line=9401',
    );

    await screen.findByText('IR-2026-900002');

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=IR-2026-900002`);
    });

    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  /*
   * **M18** — 조회를 기다리는 동안에는 행이 비어 있다. 가드가 없으면 「고른 전표가 사라졌다」로
   * 읽혀 아래 구획이 깜빡 닫히고 주소에서 선택이 사라진다.
   */
  it('목록 응답 전에는 고른 전표를 지우지 않는다', async () => {
    const { release } = renderScreen(allRoutes(), '?ir=9001', '', [LIST_PATH]);

    await screen.findByRole('status', { name: t.loading.lines });

    expect(currentLocation()).toBe(`${ROUTE}?ir=9001`);
    expect(screen.queryByText(t.empty.noSelectionTitle)).not.toBeInTheDocument();

    release();

    await screen.findAllByText(ITEM_LABEL);

    expect(currentLocation()).toBe(`${ROUTE}?ir=9001`);
  });
});

describe('GoodsReceiptScreen — 라인 고르기', () => {
  /* **C13 · M12의 화면 몫** — 자재 LOT이 없는 줄은 계약이 요구하는 값을 만들 수 없다. */
  it('자재 LOT이 없는 줄은 고를 수 없고 사유가 보인다', async () => {
    renderScreen(allRoutes(), '?ir=9001');

    await screen.findAllByText(ITEM_LABEL);

    expect(screen.getByRole('button', { name: t.actions.selectLine(3) })).toBeDisabled();
    expect(screen.getByText(t.reasons.lineNoLot)).toBeInTheDocument();
    /* 짝 방향 — 고를 수 있는 줄은 실제로 열려 있다. */
    expect(screen.getByRole('button', { name: t.actions.selectLine(1) })).toBeEnabled();
  });

  /* **C14** — 계약이 `exclusiveMinimum: 0`이라 0도 보낼 수 없다. */
  it('입하 수량이 0 이하인 줄은 고를 수 없고 다른 사유가 보인다', async () => {
    renderScreen(allRoutes(), '?ir=9001');

    await screen.findAllByText(ITEM_LABEL);

    expect(screen.getByRole('button', { name: t.actions.selectLine(4) })).toBeDisabled();
    expect(screen.getByText(t.reasons.lineQtyNotPositive)).toBeInTheDocument();
  });

  it('라인을 고르면 주소에 실리고 고른 줄의 제목줄이 열린다', async () => {
    const { user } = renderScreen(allRoutes(), '?ir=9001');

    await screen.findAllByText(ITEM_LABEL);
    await selectLine(user, 1);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?ir=9001&line=9401`);
    });

    expect(screen.getByRole('group', { name: t.lineSummary.label })).toBeInTheDocument();
    /* 입고 처리 입력이 아직 없다는 사실을 밝힌다 — 비어 있는 아래쪽이 고장으로 읽히지 않게 한다. */
    expect(screen.getByText(t.notes.postPending)).toBeInTheDocument();
  });

  /*
   * **R-2의 짝 방향** — 이 문구는 「접근 불가능한 경계의 안쪽 표지」라 **위치가 곧 뜻**이다.
   * 줄을 고르기 전에도 뜨면 「지금 이 화면에서 할 수 있는 것이 없다」로 읽힌다.
   * 있음만 단언하면 조건을 통째로 지워 늘 내게 만들어도 통과한다.
   */
  it('줄을 고르기 전에는 입고 처리 안내를 내지 않는다', async () => {
    renderScreen(allRoutes(), '?ir=9001');

    // 선행 긍정 — 아래 구획이 실제로 열려 있다(아무것도 안 그려서 통과한 것이 아니다).
    await screen.findAllByText(ITEM_LABEL);

    expect(screen.queryByText(t.notes.postPending)).not.toBeInTheDocument();
  });

  /* **M16 · C15** — 한 줄만 고른다. 둘째를 고르면 앞 선택이 풀린다. */
  it('둘째 줄을 고르면 앞 선택이 풀린다', async () => {
    const { user } = renderScreen(allRoutes(), '?ir=9001');

    await screen.findAllByText(ITEM_LABEL);
    await selectLine(user, 1);

    await waitFor(() => {
      expect(currentLocation()).toContain('line=9401');
    });

    await selectLine(user, 2);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?ir=9001&line=9402`);
    });

    /* 해제 버튼이 하나뿐이다 — 둘이면 두 줄이 함께 골라져 있는 것이다. */
    expect(
      within(lineTable()).getAllByRole('button', { name: /선택 해제$/ }),
    ).toHaveLength(1);
  });

  it('고른 줄을 다시 누르면 풀린다', async () => {
    const { user } = renderScreen(allRoutes(), '?ir=9001&line=9401');

    await screen.findAllByText(ITEM_LABEL);
    await user.click(screen.getByRole('button', { name: t.actions.deselectLine(1) }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?ir=9001`);
    });

    expect(screen.queryByRole('group', { name: t.lineSummary.label })).not.toBeInTheDocument();
  });

  /* 라인을 고르고 푸는 것은 조건·쪽·고른 전표를 건드리지 않는다(수명 표 5행). */
  it('라인 고르기가 조건과 고른 전표를 건드리지 않는다', async () => {
    const { user } = renderScreen(allRoutes(), '?sup=9101&ir=9001');

    await screen.findAllByText(ITEM_LABEL);
    await selectLine(user, 1);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?sup=9101&ir=9001&line=9401`);
    });
  });

  /* **M17의 라인 몫 · C18** — 갱신된 라인에 그 줄이 없으면 주소에서 정리한다. */
  it('라인 목록에 없는 줄은 주소에서 정리된다', async () => {
    renderScreen(allRoutes(), '?ir=9001&line=9499');

    await screen.findAllByText(ITEM_LABEL);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?ir=9001`);
    });
  });

  /* 주소를 손으로 고쳐 고를 수 없는 줄을 가리키는 경우도 같은 자리에서 정리된다. */
  it('고를 수 없는 줄을 가리키면 주소에서 정리된다', async () => {
    renderScreen(allRoutes(), '?ir=9001&line=9403');

    await screen.findAllByText(ITEM_LABEL);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?ir=9001`);
    });

    expect(screen.queryByRole('group', { name: t.lineSummary.label })).not.toBeInTheDocument();
  });

  /* 라인 응답 전에 정리하면 새로고침 직후 고른 줄이 주소에서 사라진다. */
  it('라인 응답 전에는 고른 줄을 지우지 않는다', async () => {
    const { release } = renderScreen(allRoutes(), '?ir=9001&line=9401', '', [LINES_PATH]);

    await screen.findByRole('status', { name: t.loading.lines });

    expect(currentLocation()).toBe(`${ROUTE}?ir=9001&line=9401`);

    release();

    await screen.findAllByText(ITEM_LABEL);

    expect(currentLocation()).toBe(`${ROUTE}?ir=9001&line=9401`);
  });

  /*
   * **C17** — 목록 재조회·참조 도착이 고른 라인을 되돌리면 「고르던 것이 사라진다」가 된다.
   * 이 PR에서 고른 것은 주소가 들고 있어 응답에 반응하지 않는다.
   */
  it('목록이 다시 도착해도 고른 라인이 풀리지 않는다', async () => {
    const { queryClient } = renderScreen(
      [
        changingListRoute(),
        linesRoute(),
        otherLinesRoute(),
        detailRoute(),
        goodsReceiptRoute(),
        ...lookupRoutes(),
      ],
      '?ir=9001&line=9401',
    );

    await screen.findAllByText(ITEM_LABEL);
    await screen.findByText(t.pageNav.range(1, 3, 4));

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: irKeys.lists });
    });

    /* 새 목록이 실제로 적용된 뒤에 본다 — 적용 전에 검사하면 늘 참인 단언이 된다. */
    await screen.findByText(t.pageNav.range(1, 3, 5));

    expect(screen.getByRole('group', { name: t.lineSummary.label })).toBeInTheDocument();
    expect(currentLocation()).toBe(`${ROUTE}?ir=9001&line=9401`);
  });

  /* 라인이 실제로 사라지면 정리된다 — 위 단언이 「늘 참」이 아님을 짝으로 보인다. */
  it('다시 부른 라인에서 사라진 줄은 정리된다', async () => {
    const { queryClient } = renderScreen(
      [
        listRoute(),
        shrinkingLinesRoute(),
        otherLinesRoute(),
        detailRoute(),
        goodsReceiptRoute(),
        ...lookupRoutes(),
      ],
      '?ir=9001&line=9401',
    );

    await screen.findAllByText(ITEM_LABEL);

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: irKeys.lines(9001) });
    });

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?ir=9001`);
    });
  });
});

describe('GoodsReceiptScreen — 빈 상태', () => {
  /* **C07** — 네 갈래이고 사용자가 할 조치가 서로 다르다. */
  it('조건에 맞는 결과가 없으면 결과 없음을 낸다', async () => {
    renderScreen([listRoute([]), ...lookupRoutes(), goodsReceiptRoute()]);

    await screen.findByText(t.empty.noResultTitle);

    expect(screen.queryByText(t.empty.beyondLastTitle)).not.toBeInTheDocument();
  });

  it('결과는 있는데 이 쪽에 없으면 첫 쪽 안내를 낸다', async () => {
    const { user } = renderScreen(
      [listRoute([], { page: 5, size: 50, total: 120 }), ...lookupRoutes(), goodsReceiptRoute()],
      '?page=5',
    );

    await screen.findByText(t.empty.beyondLastTitle);

    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  it('전표를 고르지 않았으면 고르라고 안내한다', async () => {
    renderScreen(allRoutes());

    await screen.findAllByText('IR-2026-900001');

    expect(screen.getByText(t.empty.noSelectionTitle)).toBeInTheDocument();
  });

  it('라인이 없는 전표는 라인 없음을 낸다', async () => {
    renderScreen(allRoutes(), '?ir=9002');

    await screen.findByText(t.empty.noLinesTitle);

    expect(screen.queryByText(t.empty.noSelectionTitle)).not.toBeInTheDocument();
  });
});

describe('GoodsReceiptScreen — 참조 풀이', () => {
  /*
   * **M10 · #47** — 본 자료가 참조 목록보다 먼저 오는 순간이 실제로 있다.
   * 미도착을 「알 수 없음」으로 내면 정상 값이 잘못된 값으로 보인다.
   */
  it('참조가 아직 오지 않았으면 알 수 없음으로 내지 않는다', async () => {
    const { release } = renderScreen(allRoutes(), '', '', [PARTNERS_PATH]);

    await screen.findAllByText('IR-2026-900001');

    expect(within(listTable()).getAllByText(t.values.referenceLoading).length).toBeGreaterThan(0);
    expect(within(listTable()).queryByText(t.values.unknown)).not.toBeInTheDocument();

    release();

    await screen.findAllByText(SUPPLIER_LABEL);
  });

  /*
   * **M11 · #44** — 이름을 못 풀어도 번호를 내지 않는다. 짝 방향으로 「풀린 이름은 보인다」를
   * 함께 단언해 아무것도 안 그려도 통과하지 않게 한다.
   */
  it('참조 다섯이 풀린 뒤에도 내부 번호가 화면에 없다', async () => {
    const { user } = renderScreen(allRoutes(), '?ir=9001');

    await screen.findAllByText(ITEM_LABEL);
    await selectLine(user, 1);

    await screen.findByRole('group', { name: t.lineSummary.label });

    expect(screen.getAllByText(SUPPLIER_LABEL).length).toBeGreaterThan(0);
    expect(screen.getAllByText(PLANT_LABEL).length).toBeGreaterThan(0);
    expect(screen.getAllByText('LOT-2026-900010').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(t.lineTable.receivedQtyPair(100, UOM_LABEL)).length,
    ).toBeGreaterThan(0);

    expectNoInternalIds();
  });

  it('참조 목록에 없는 값은 알 수 없음이고 번호를 내지 않는다', async () => {
    renderScreen(allRoutes());

    await screen.findByText('IR-2026-900002');

    // 9002의 공급사(9102)는 참조 목록에 없다.
    expect(within(listTable()).getByText(t.values.unknown)).toBeInTheDocument();
    expectNoInternalIds();
  });

  it.each([
    ['공급사', PARTNERS_PATH, t.reasons.referencesFailed, t.panes.list],
    ['공장', PLANTS_PATH, t.reasons.lineReferencesFailed, t.panes.lines],
    ['품목', ITEMS_PATH, t.reasons.lineReferencesFailed, t.panes.lines],
    ['단위', UOMS_PATH, t.reasons.lineReferencesFailed, t.panes.lines],
    ['자재 LOT', LOTS_PATH, t.reasons.lineReferencesFailed, t.panes.lines],
  ])(
    '%s 참조가 실패하면 그 이름이 보이는 구획에 사유와 복구 경로가 있다',
    async (_label, path, note, paneName) => {
      renderScreen(
        [
          /* 실패 규칙을 **앞에** 둔다 — 스텁은 먼저 맞는 규칙을 쓴다. */
          failingLookupRoute(path),
          listRoute(),
          linesRoute(),
          otherLinesRoute(),
          detailRoute(),
          goodsReceiptRoute(),
          ...lookupRoutes(),
        ],
        '?ir=9001',
      );

      await screen.findByText(note);

      const pane = screen.getByRole('region', { name: paneName });

      /*
       * 이름 자리에 사유가 실제로 나타나는지 본다. 단위처럼 다른 값과 한 칸에 묶여 나오는
       * 자리가 있어(「100 이름을 불러오지 못했습니다」) 텍스트 노드로 딱 맞춰 찾을 수 없다.
       */
      expect(pane.textContent ?? '').toContain(t.values.referenceFailed);
      expect(
        within(pane).getByRole('button', { name: messages.common.retry }),
      ).toBeInTheDocument();
    },
  );

  /*
   * 복구 경로가 **그 참조를 실제로 다시 부르는지**까지 본다 — 「버튼이 있다」만 보면
   * 눌러도 아무 일이 없는 버튼을 통과시킨다.
   */
  it('아래 구획의 다시 시도가 라인 참조를 다시 부른다', async () => {
    const { requests, user } = renderScreen(
      [
        listRoute(),
        linesRoute(),
        otherLinesRoute(),
        detailRoute(),
        goodsReceiptRoute(),
        lookupRoute(PARTNERS_PATH, partnerFixtures),
        lookupRoute(PLANTS_PATH, plantFixtures),
        lookupRoute(UOMS_PATH, uomFixtures),
        lotsRoute(),
        failingLookupRoute(ITEMS_PATH),
      ],
      '?ir=9001',
    );

    await screen.findByText(t.reasons.lineReferencesFailed);

    const before = requestsTo(requests, ITEMS_PATH).length;

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, ITEMS_PATH).length).toBeGreaterThan(before);
    });
  });

  /*
   * **R-1** — 자재 LOT이 잘리면 그 뒤의 정상 LOT이 「알 수 없음」으로 찍히는데, 이 화면은
   * 그 문구를 「값이 잘못됐다는 신호」로 정의해 두었다. 잘렸다는 사실이 화면에 나와야
   * 사용자가 정상 값을 잘못된 값으로 읽지 않는다.
   */
  it('자재 LOT 목록이 잘리면 라인 구획이 그 사실을 밝힌다', async () => {
    renderScreen(
      [
        listRoute(),
        linesRoute(),
        otherLinesRoute(),
        detailRoute(),
        goodsReceiptRoute(),
        lookupRoute(PARTNERS_PATH, partnerFixtures),
        lookupRoute(PLANTS_PATH, plantFixtures),
        lookupRoute(ITEMS_PATH, itemFixtures),
        lookupRoute(UOMS_PATH, uomFixtures),
        /* 서버가 「전체 500건 중 이만큼」이라고 답한다 — 쪽 크기를 실어도 잘릴 수 있다. */
        lookupRoute(LOTS_PATH, lotFixtures, { total: 500 }),
      ],
      '?ir=9001',
    );

    await screen.findByText(t.reasons.lineReferencesTruncated);
  });

  /* 짝 방향 — 잘리지 않으면 내지 않는다. 늘 뜨는 안내는 읽히지 않는다. */
  it('자재 LOT 목록이 잘리지 않으면 그 안내를 내지 않는다', async () => {
    renderScreen(allRoutes(), '?ir=9001');

    await screen.findAllByText('LOT-2026-900010');

    expect(screen.queryByText(t.reasons.lineReferencesTruncated)).not.toBeInTheDocument();
  });

  /* 잘림을 밝히지 않으면 불완전한 목록을 완전한 것으로 읽는다. */
  it('공급사 선택지가 잘리면 잘림 표식이 붙는다', async () => {
    renderScreen([
      listRoute(),
      linesRoute(),
      otherLinesRoute(),
      detailRoute(),
      goodsReceiptRoute(),
      lookupRoute(PARTNERS_PATH, partnerFixtures, { total: 500 }),
      lookupRoute(PLANTS_PATH, plantFixtures),
      lookupRoute(ITEMS_PATH, itemFixtures),
      lookupRoute(UOMS_PATH, uomFixtures),
      lotsRoute(),
    ]);

    await screen.findByText(t.filters.lookupTruncated);
  });

  /*
   * 라인이 참조보다 먼저 오는 순서를 실제로 만든다 — LOT 이름이 아직 없을 때
   * 「알 수 없음」이 아니라 「이름 불러오는 중」이 보여야 한다.
   */
  it('자재 LOT 이름이 늦게 와도 알 수 없음으로 내지 않는다', async () => {
    /*
     * **품목이 전부 풀리는 줄 하나만 둔다.** 여러 줄을 쓰면 참조 목록에 없는 품목의
     * 「알 수 없음」이 함께 나와, LOT 칸이 무엇을 내는지 이 단언이 가리지 못한다.
     */
    const { release } = renderScreen(
      [
        listRoute(),
        linesRoute([inboundReceiptLine()]),
        otherLinesRoute(),
        detailRoute(),
        goodsReceiptRoute(),
        ...lookupRoutes(),
      ],
      '?ir=9001',
      '',
      [LOTS_PATH],
    );

    await screen.findAllByText(ITEM_LABEL);

    expect(within(lineTable()).getByText(t.values.referenceLoading)).toBeInTheDocument();
    expect(within(lineTable()).queryByText(t.values.unknown)).not.toBeInTheDocument();

    release();

    await screen.findAllByText('LOT-2026-900010');
  });

  /* LOT이 **없는** 것과 이름을 못 푼 것은 다르다 — 없는 줄은 빈 값 표기이고 사유가 따로 붙는다. */
  it('자재 LOT이 없는 줄은 알 수 없음이 아니라 빈 값 표기다', async () => {
    renderScreen(
      [
        listRoute(),
        linesRoute([inboundReceiptLine({ lotId: null })]),
        otherLinesRoute(),
        detailRoute(),
        goodsReceiptRoute(),
        ...lookupRoutes(),
      ],
      '?ir=9001',
    );

    await screen.findAllByText(ITEM_LABEL);

    expect(within(lineTable()).getByText(t.values.empty)).toBeInTheDocument();
    expect(within(lineTable()).queryByText(t.values.unknown)).not.toBeInTheDocument();
    expect(screen.getByText(t.reasons.lineNoLot)).toBeInTheDocument();
  });
});
