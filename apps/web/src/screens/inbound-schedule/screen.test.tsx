import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigate } from 'react-router';
import { describe, expect, it } from 'vitest';

import { plantToday } from '../../patterns/plant-time';
import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import type { InboundExcess } from './excess-types';
import {
  candidateFixture,
  excessFixture,
  itemDetailFixtures,
  linkedExcessFixture,
  partnerFixtures,
  plantFixtures,
  orderFixtures,
  scheduleFixtures,
  scheduleLine,
  storageLocationFixtures,
} from './fixtures';
import { addDays } from './period';
import { InboundScheduleScreen } from './screen';

const t = messages.inboundSchedule;

const ROUTE = '/logistics/inbound-schedule';
/** server #749 · 장부 P-78 — 입하 예정 = 아직 다 들어오지 않은 P/O 라인. */
/** 왼쪽 표 — P/O 묶음(server #762). */
const LIST_PATH = '/logistics/purchase-orders';
/** 오른쪽 표 — 고른 P/O 의 라인. */
const LINES_PATH = '/logistics/purchase-order-lines';
const PARTNERS_PATH = '/mdm/partners';
const PLANTS_PATH = '/mdm/plants';
const CODE_VALUES_PATH = '/mdm/code-values';
const ITEM_PATH_PREFIX = '/mdm/items/';
/** 초과분 잇기(서버 장부 P-100) — 계약 밖 경로 넷. */
const EXCESS_PATH = '/logistics/inbound-excesses';

/** 참조 목록이 만드는 표시 이름 —「코드 · 이름」이다. 화면이 이 형태로 푼다. */
const SUPPLIER_LABEL = 'SAMPLE-SUP-01 · 합성 공급사 가';
const ITEM_LABEL = 'SAMPLE-ITEM-01 · 합성 품목 가';

/** 「오늘」은 화면이 공장 달력(`plantToday()`)으로 읽는다 — 픽스처도 같은 기준으로 만든다. */
const TODAY = plantToday();
/** 들어왔을 때의 기간 — 오늘 앞뒤 4주. 첫 조회에 실린다. */
const DEFAULT_PERIOD_SEARCH = `expectedReceiptDateFrom=${addDays(TODAY, -28)}&expectedReceiptDateTo=${addDays(TODAY, 28)}`;
const ROWS = orderFixtures(TODAY);
const LINES = scheduleFixtures(TODAY);

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

const failingListRoute = (status: number): StubRoute => ({
  match: (request) => isGet(request, LIST_PATH),
  respond: () => jsonResponse({ message: '' }, { status }),
});

const lookupRoute = (pathname: string, items: unknown[]): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse(listBody(items)),
});

const failingLookupRoute = (pathname: string): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse({ message: '' }, { status: 500 }),
});

/** 품목은 번호로 하나씩 푼다. 픽스처에 없는 번호는 404 — 「목록에 없음」 갈래다. */
const itemDetailRoute = (): StubRoute => ({
  match: (request) =>
    request.method === 'GET' && new URL(request.url).pathname.startsWith(ITEM_PATH_PREFIX),
  respond: (request) => {
    const itemId = Number(new URL(request.url).pathname.slice(ITEM_PATH_PREFIX.length));
    const found = itemDetailFixtures[itemId];

    return found === undefined
      ? jsonResponse({ message: '' }, { status: 404 })
      : jsonResponse(found);
  },
});

const failingItemDetailRoute = (): StubRoute => ({
  match: (request) =>
    request.method === 'GET' && new URL(request.url).pathname.startsWith(ITEM_PATH_PREFIX),
  respond: () => jsonResponse({ message: '' }, { status: 500 }),
});

/** 공통코드 `SL_TYPE` 만 받는다 — 다른 그룹을 부르면 스텁 누락으로 드러난다. */
const storageLocationRoute = (): StubRoute => ({
  match: (request) =>
    isGet(request, CODE_VALUES_PATH) &&
    new URL(request.url).searchParams.get('codeGroupCode') === 'SL_TYPE',
  respond: () => jsonResponse(listBody(storageLocationFixtures)),
});

/** 참조 다섯. 화면이 이름으로 풀 수 있는 정상 상태다. */
/** 고른 P/O 의 라인 — `purchaseOrderId` 로 거른다. */
const linesRoute = (lines: unknown[] = LINES): StubRoute => ({
  match: (request) => isGet(request, LINES_PATH),
  respond: (request) => {
    const id = Number(new URL(request.url).searchParams.get('purchaseOrderId'));

    return jsonResponse(
      listBody(
        lines.filter((line) => (line as { purchaseOrderId: number }).purchaseOrderId === id),
      ),
    );
  },
});

/** 초과분 목록 — `linked` 질의로 안 이은 것·이은 것을 가른다. 기본은 둘 다 비어 있다. */
const excessListRoute = (
  unlinked: InboundExcess[] = [],
  linked: InboundExcess[] = [],
): StubRoute => ({
  match: (request) => isGet(request, EXCESS_PATH),
  respond: (request) =>
    jsonResponse(
      listBody(new URL(request.url).searchParams.get('linked') === 'true' ? linked : unlinked),
    ),
});

const failingExcessListRoute = (status: number): StubRoute => ({
  match: (request) => isGet(request, EXCESS_PATH),
  respond: () => jsonResponse({ message: '' }, { status }),
});

const candidatesRoute = (items: unknown[]): StubRoute => ({
  match: (request) =>
    request.method === 'GET' &&
    /^\/logistics\/inbound-excesses\/\d+\/candidates$/.test(new URL(request.url).pathname),
  respond: () => jsonResponse({ items }),
});

/** `:link`·`:unlink` — 본문을 모은다. 응답은 주어진 것(기본 200 한 행). */
const excessWriteRoute = (
  action: 'link' | 'unlink',
  bodies: unknown[],
  respond: () => Response = () => jsonResponse(linkedExcessFixture()),
): StubRoute => ({
  match: (request) =>
    request.method === 'POST' && new URL(request.url).pathname.endsWith(`:${action}`),
  respond: async (request) => {
    const text = await request.clone().text();
    bodies.push(text === '' ? null : JSON.parse(text));

    return respond();
  },
});

const lookupRoutes = (): StubRoute[] => [
  linesRoute(),
  excessListRoute(),
  lookupRoute(PARTNERS_PATH, partnerFixtures),
  lookupRoute(PLANTS_PATH, plantFixtures),
  storageLocationRoute(),
  itemDetailRoute(),
];

/** 주소가 실제로 어떻게 바뀌는지 본다. */
const LocationProbe = () => {
  const location = useLocation();

  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

/** 한 칸 뒤로 간다 — 기억 라우터는 `window.history.back()`이 닿지 않는다. */
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
): { requests: RecordedRequest[]; user: ReturnType<typeof userEvent.setup> } => {
  const { fetch, requests } = createRecordingFetch(routes);

  renderWithProviders(
    <>
      <InboundScheduleScreen />
      <LocationProbe />
      <BackProbe />
    </>,
    { fetch, route: `${ROUTE}${search}` },
  );

  return { requests, user: userEvent.setup() };
};

const requestsTo = (requests: RecordedRequest[], pathname: string): RecordedRequest[] =>
  requests.filter((request) => request.url.pathname === pathname);

const currentLocation = (): string => screen.getByTestId('location').textContent ?? '';

/** 왼쪽 P/O 묶음 표. 발주를 고르면 오른쪽에도 표가 생기므로 구획 안에서 찾는다. */
const listTable = (): HTMLElement =>
  within(screen.getByRole('region', { name: t.panes.orders })).getByRole('table');

/** 오른쪽 라인 구획. */
const linesPane = (): HTMLElement => screen.getByRole('region', { name: t.panes.lines });

/** 상세 조건(기간·공장·발주번호·미완료만·조회 단추)은 접혀 있다 — 그 칸을 쓰는 시험은 먼저 편다. */
const openDetail = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByRole('button', { name: t.quick.detailOpen }));
};

/** 그 행의 칸 글자를 열 순서대로 낸다. 코드 열·이름 열이 나뉘어 있어 칸 단위로 봐야 읽힌다. */
const cellsOf = (row: HTMLElement): (string | null)[] =>
  within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent);

/** 발주번호로 그 행을 찾는다. */
const rowOf = (purchaseOrderNo: string): HTMLElement => {
  const row = within(listTable()).getByText(purchaseOrderNo).closest('tr');
  if (row === null) throw new Error(`${purchaseOrderNo} 행이 없습니다`);

  return row;
};

describe('InboundScheduleScreen — 첫 진입 조회', () => {
  /*
   * **조건이 하나도 없어도 조회한다.** 기본 조건(미완료만)은 서버 기본이라 질의에 싣지 않는다.
   */
  it('들어오면 오늘 앞뒤 4주 납기로 1회 조회한다', async () => {
    const { requests } = renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

    const list = requestsTo(requests, LIST_PATH);

    expect(list).toHaveLength(1);
    // 기본 기간(사용자 지시 2026-10-21)과 쪽 크기만 실린다 — 한 쪽 20줄(사용자 지시 2026-10-20).
    expect(list[0]?.url.search).toBe(`?${DEFAULT_PERIOD_SEARCH}&size=20`);
  });

  /* ASN 경로는 고객사가 쓰지 않아 늘 비어 있었다(server #741) — 더는 부르지 않는다. */
  it('ASN 경로를 부르지 않는다', async () => {
    const { requests } = renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

    expect(requests.some((request) => request.url.pathname.includes('/asns'))).toBe(false);
  });

  it('기본 조건을 주소에 심지 않는다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

    expect(currentLocation()).toBe(ROUTE);
  });

  it('제목·경로 표시와 안내 문장을 두지 않는다 — 탭 이름과 겹친다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

    // 사용자 지시(2026-10-21) — 「입고 관리」 탭이 이미 이름을 보인다.
    expect(screen.queryByRole('heading', { name: t.title })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: messages.common.shell.breadcrumb }),
    ).not.toBeInTheDocument();
    // 사용자 지시(2026-10-20)로 걷어 낸 두 문장이 되살아나지 않게 지킨다.
    expect(screen.queryByText(/납기 순으로 봅니다/)).not.toBeInTheDocument();
    expect(screen.queryByText(/비워 두어도 조회됩니다/)).not.toBeInTheDocument();
  });

  it('라인마다 한 행이 그려지고 배너가 없다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

    expect(within(listTable()).getAllByRole('row')).toHaveLength(ROWS.length + 1);
    expect(screen.queryByText(messages.httpError.loadTitle)).not.toBeInTheDocument();
  });

  /* 이 화면은 조회 전용이다. */
  it('쓰기 요청을 하나도 보내지 않는다', async () => {
    const { requests } = renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

    expect(requests.every((request) => request.method === 'GET')).toBe(true);
  });
});

describe('InboundScheduleScreen — 조건과 주소', () => {
  it('주소의 조건이 요청 쿼리에 그대로 실린다', async () => {
    const { requests } = renderScreen(
      [listRoute(), ...lookupRoutes()],
      '?from=2026-10-01&to=2026-10-31&supplier=8101&plant=8201&item=8301&q=SAMPLE-PO&open=0&overdue=1',
    );

    await screen.findByText('SAMPLE-PO-0001');

    const query = requestsTo(requests, LIST_PATH)[0]?.url.searchParams;

    expect(Object.fromEntries(query ?? [])).toEqual({
      size: '20',
      // 지연은 납기 기간을 싣지 않는다(사용자 지시 2026-10-21).
      supplierId: '8101',
      plantId: '8201',
      itemId: '8301',
      q: 'SAMPLE-PO',
      openOnly: 'false',
      overdueOnly: 'true',
    });
  });

  it('발주번호를 검색하면 주소와 요청에 함께 나타난다', async () => {
    const { requests, user } = renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');
    await openDetail(user);
    await user.type(screen.getByLabelText(t.fields.q), 'SAMPLE-PO-0002');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH)).toHaveLength(2);
    });

    expect(currentLocation()).toContain('q=SAMPLE-PO-0002');
    expect(requestsTo(requests, LIST_PATH)[1]?.url.searchParams.get('q')).toBe('SAMPLE-PO-0002');
  });

  /* 같은 조건이 두 곳에 있지 않게 — 지연은 빠른 조회 줄에만 있다(사용자 지시 2026-10-21). */
  it('상세 조건에는 「납기 지난 것만」이 없다', async () => {
    const { user } = renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');
    await openDetail(user);

    expect(screen.queryByRole('checkbox', { name: t.fields.overdueOnly })).not.toBeInTheDocument();
  });

  it('「미완료만」을 끄고 조회하면 openOnly=false 가 실린다', async () => {
    const { requests, user } = renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');
    await openDetail(user);

    const openOnly = screen.getByRole('checkbox', { name: t.fields.openOnly });
    expect(openOnly).toBeChecked();

    await user.click(openOnly);
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH)).toHaveLength(2);
    });

    expect(currentLocation()).toBe(`${ROUTE}?open=0`);
    expect(requestsTo(requests, LIST_PATH)[1]?.url.searchParams.get('openOnly')).toBe('false');
  });

  /* 조작 한 번에 주소 갱신도 한 번이다 — 조건과 쪽을 따로 갱신하면 뒤로가기 기록이 두 칸 는다. */
  it('조회하면 첫 쪽으로 돌아가고 히스토리가 한 칸만 는다', async () => {
    const { user } = renderScreen([listRoute(ROWS, { total: 120 }), ...lookupRoutes()], '?page=2');

    await screen.findByText('SAMPLE-PO-0001');
    await openDetail(user);
    await user.type(screen.getByLabelText(t.fields.q), 'SAMPLE');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?q=SAMPLE`);
    });

    await user.click(screen.getByRole('button', { name: '뒤로' }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?page=2`);
    });
  });

  /* 정수가 아닌 번호를 그대로 보내면 조회 전체가 400으로 실패한다. */
  it('정수가 아닌 참조 조건은 버리고 조회한다', async () => {
    const { requests } = renderScreen(
      [listRoute(), ...lookupRoutes()],
      '?supplier=abc&plant=-1&item=1.5&page=0',
    );

    await screen.findByText('SAMPLE-PO-0001');

    expect(requestsTo(requests, LIST_PATH)[0]?.url.search).toBe(
      `?${DEFAULT_PERIOD_SEARCH}&size=20`,
    );
  });

  /*
   * **없는 날짜는 보내지 않는다.** 서버가 400 `INVALID` 로 막는다 — 사용자에게는
   * 「조회가 늘 실패한다」로만 보인다. 사유는 조건 줄이 밝힌다.
   */
  it('없는 날짜가 주소에 있으면 요청을 보내지 않고 「조회하지 않았다」를 낸다', async () => {
    const { requests } = renderScreen([listRoute(), ...lookupRoutes()], '?from=2026-02-31');

    await screen.findByText(t.reasons.periodInvalid);

    expect(requestsTo(requests, LIST_PATH)).toHaveLength(0);
    expect(screen.getByText(t.empty.notQueriedTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
  });

  it('뒤집힌 기간도 요청을 보내지 않는다', async () => {
    const { requests } = renderScreen(
      [listRoute(), ...lookupRoutes()],
      '?from=2026-10-31&to=2026-10-01',
    );

    await screen.findByText(t.reasons.periodReversed);

    expect(requestsTo(requests, LIST_PATH)).toHaveLength(0);
  });

  it('걸린 조건이 이름으로 칩이 되고, 칩을 지우면 그 조건만 풀린다', async () => {
    const { requests, user } = renderScreen(
      [listRoute(), ...lookupRoutes()],
      '?supplier=8101&plant=8201&item=8301',
    );

    expect(await screen.findByText(t.filters.chipSupplier(SUPPLIER_LABEL))).toBeInTheDocument();
    expect(
      await screen.findByText(t.filters.chipPlant('SAMPLE-PLT-01 · 합성 공장 가')),
    ).toBeInTheDocument();
    expect(await screen.findByText(t.filters.chipItem(ITEM_LABEL))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.filters.chipRemovePlant }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?supplier=8101&item=8301`);
    });

    expect(requestsTo(requests, LIST_PATH).at(-1)?.url.searchParams.has('plantId')).toBe(false);
  });

  it('초기화하면 기본 조건으로 돌아간다', async () => {
    const { user } = renderScreen(
      [listRoute(), ...lookupRoutes()],
      '?from=2026-10-01&supplier=8101&open=0&overdue=1&page=2',
    );

    await screen.findByText('SAMPLE-PO-0001');
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });

    expect(screen.getByRole('checkbox', { name: t.fields.openOnly })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: t.quick.overdue })).not.toBeChecked();
  });
});

describe('InboundScheduleScreen — 표의 칸', () => {
  it('발주번호 칸에는 발주번호만 있다 — ERP 발주번호를 덧붙이지 않는다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

    expect(rowOf('SAMPLE-PO-0001')).not.toHaveTextContent('SAMPLE-ERP-0001');
    expect(cellsOf(rowOf('SAMPLE-PO-0001'))[2]).toBe('SAMPLE-PO-0001');
  });

  it('상태는 지연·정상 둘만 보인다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

    // 사용자 지시(2026-10-21) — 미착수·부분 입하는 왼쪽 표에서 말하지 않는다.
    expect(cellsOf(rowOf('SAMPLE-PO-0001'))[0]).toBe(t.values.overdue);
    expect(cellsOf(rowOf('SAMPLE-PO-0002'))[0]).toBe(t.values.onTrack);
    // 끝난 발주(취소·입하 완료)는 「—」 — 지연·정상 둘만 말한다.
    expect(cellsOf(rowOf('SAMPLE-PO-0003'))[0]).toBe(t.values.empty);
    expect(cellsOf(rowOf('SAMPLE-PO-0004'))[0]).toBe(t.values.empty);
  });

  /*
   * **지연 = 남은 수량이 있고 납기가 공장 현지 오늘보다 앞섬**(서버 `overdueOnly` 와 같은 기준).
   * 7301(어제·미착수)만 지연이다 — 7302(오늘)는 당일이라, 7303(어제)은 취소라, 7304는 다 들어와서 아니다.
   */
  it('지연 표식은 납기가 지났고 남은 수량이 있는 라인에만 붙는다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

    expect(within(listTable()).getAllByText(t.values.overdue)).toHaveLength(1);
  });

  it('납기가 없으면 그렇다고 쓴다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

    expect(rowOf('SAMPLE-PO-0004')).toHaveTextContent(t.values.noDueDate);
  });

  /* 창고는 공통코드 `SL_TYPE` 이름으로 — 없으면 코드를 그대로, 비었으면 대시. */

  /* 품목은 번호로 하나씩 푼다 — 같은 품목이면 요청도 하나다. */
});

describe('InboundScheduleScreen — 행 바로가기', () => {
  /*
   * 「초과 입하 분리」는 발주를 주소(`po`)로 받는다 — 발주번호로 좁히고 미완료만을 꺼서
   * 그 발주가 목록에 남아 고른 채로 열리게 한다.
   */

  it('고른 발주의 「초과 입하 분리」는 그 발주를 고른 채로 간다 — 라인마다 되풀이하지 않는다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()], '?po=7101');

    await within(linesPane()).findByText('SAMPLE-ITEM-01');

    const links = within(linesPane()).getAllByRole('link', {
      name: t.actions.overReceiptSplitRow('SAMPLE-PO-0001'),
    });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute(
      'href',
      '/logistics/over-receipt-split?q=SAMPLE-PO-0001&open=0&po=7101',
    );
  });

  it('취소된 발주에는 바로가기가 없다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()], '?po=7103');

    await within(linesPane()).findByRole('table');
    expect(within(linesPane()).getByText('SAMPLE-PO-0003')).toBeInTheDocument();

    expect(within(linesPane()).queryByRole('link')).not.toBeInTheDocument();
  });

  /* 「자재 입고 처리」는 발주를 주소로 받지 않는다 — 열어도 그 발주가 서지 않아 바로가기를 두지 않는다. */
  it('「자재 입고 처리」 바로가기는 두지 않는다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

    const hrefs = within(listTable())
      .queryAllByRole('link')
      .map((link) => link.getAttribute('href') ?? '');

    expect(hrefs.some((href) => href.startsWith('/logistics/goods-receipt'))).toBe(false);
  });
});

describe('InboundScheduleScreen — 쪽 이동과 빈 상태', () => {
  it('쪽을 옮기면 주소와 요청이 함께 바뀐다', async () => {
    const { requests, user } = renderScreen([listRoute(ROWS, { total: 120 }), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?page=2`);
    });

    expect(requestsTo(requests, LIST_PATH)[1]?.url.searchParams.get('page')).toBe('2');
  });

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

  it('조회했는데 0건이면 「결과 없음」이다', async () => {
    renderScreen([listRoute([], { total: 0 }), ...lookupRoutes()]);

    expect(await screen.findByText(t.empty.noResultTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.notQueriedTitle)).not.toBeInTheDocument();
  });
});

describe('InboundScheduleScreen — 조회 실패', () => {
  /* 실패를 「없습니다」로 보이면 사용자가 자료가 없는 줄 안다. */
  it('조회에 실패하면 배너와 다시 시도가 나오고 빈 상태 안내는 나오지 않는다', async () => {
    const { requests, user } = renderScreen([failingListRoute(500), ...lookupRoutes()]);

    await screen.findByText(messages.httpError.loadTitle);

    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
    // 조건을 고칠 수단은 남는다.
    expect(screen.getByRole('button', { name: t.quick.detailOpen })).toBeInTheDocument();
    expect(screen.getByLabelText(t.quick.item)).toBeInTheDocument();

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
});

describe('InboundScheduleScreen — 두 표', () => {
  it('왼쪽 발주 묶음 표와 오른쪽 라인 구획이 따로 있고, 조건 구획에는 표가 없다', async () => {
    const { user } = renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');
    await openDetail(user);

    const filterPane = screen.getByRole('region', { name: t.panes.filter });
    expect(within(filterPane).getByRole('button', { name: messages.common.search })).toBeVisible();
    expect(within(filterPane).queryByRole('table')).not.toBeInTheDocument();
    expect(listTable()).toBeInTheDocument();
    // 고르기 전에는 오른쪽이 「고르세요」다.
    expect(within(linesPane()).getByText(t.empty.noOrderTitle)).toBeInTheDocument();
  });

  it('발주 줄의 아무 칸이나 누르면 그 발주의 상세가 보인다', async () => {
    const { user } = renderScreen([listRoute(), linesRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0002');
    await user.click(within(rowOf('SAMPLE-PO-0002')).getByText('합성 공급사 다'));

    await waitFor(() => {
      expect(currentLocation()).toContain('po=7102');
    });
    expect(within(linesPane()).getByText('SAMPLE-PO-0002')).toBeInTheDocument();
  });

  it('왼쪽 표는 상태·납기·발주번호·공급사명·미입고 품목이다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

    expect(
      within(listTable())
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual([
      t.table.receiptStatus,
      t.table.expectedReceiptDate,
      t.table.purchaseOrderNo,
      t.table.supplierName,
      t.table.openLines,
      t.table.orderDate,
    ]);
    expect(cellsOf(rowOf('SAMPLE-PO-0002')).slice(3, 5)).toEqual(['합성 공급사 다', '1 / 3']);
    // 납기는 YYYY.MM.DD(사용자 지시 2026-10-21).
    expect(cellsOf(rowOf('SAMPLE-PO-0002'))[1]).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
  });

  /* 회귀 — #762 앞선 서버는 묶음 칸·이름 칸을 아예 주지 않는다. 화면이 죽지 않고 「—」로 남는다. */
  it('묶음 칸·이름 칸이 없는 응답에서도 죽지 않고 「—」를 낸다', async () => {
    const bare = {
      purchaseOrderId: 7101,
      purchaseOrderNo: 'SAMPLE-PO-0001',
      supplierId: 8101,
      plantId: 8201,
      orderDate: '2026-10-01',
      expectedReceiptDate: TODAY,
      statusCode: 'CONFIRMED',
    };
    const bareLine = { ...LINES[0], itemCode: undefined, itemName: undefined, uomCode: undefined };
    renderScreen([listRoute([bare]), linesRoute([bareLine]), ...lookupRoutes()]);

    await screen.findByRole('button', { name: t.actions.selectOrder('SAMPLE-PO-0001') });

    const cells = cellsOf(rowOf('SAMPLE-PO-0001'));
    expect(cells[0]).toBe(t.values.empty);
    expect(cells.slice(3, 5)).toEqual([t.values.empty, t.values.empty]);
    const lineTable = await within(linesPane()).findByRole('table');
    expect(cellsOf(within(lineTable).getAllByRole('row')[1] as HTMLElement).slice(2, 4)).toEqual([
      t.values.empty,
      t.values.empty,
    ]);
  });

  it('발주번호를 누르면 주소에 실리고 오른쪽에 그 발주의 라인이 다 보인다', async () => {
    const { requests, user } = renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');
    await user.click(screen.getByRole('button', { name: t.actions.selectOrder('SAMPLE-PO-0002') }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?po=7102`);
    });
    expect(
      screen.getByRole('button', { name: t.actions.selectOrder('SAMPLE-PO-0002') }),
    ).toHaveAttribute('aria-current', 'true');

    const lineRequest = requestsTo(requests, LINES_PATH).at(-1);
    // 다 들어온 라인까지 보이도록 미완료만을 끈다(서버 기본은 미완료만).
    expect(Object.fromEntries(lineRequest?.url.searchParams ?? [])).toEqual({
      purchaseOrderId: '7102',
      openOnly: 'false',
      size: '200',
    });

    const lineTable = await within(linesPane()).findByRole('table');
    expect(
      within(lineTable)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual([
      t.table.receiptStatus,
      t.table.lineNo,
      t.table.itemCode,
      t.table.itemName,
      t.table.orderedQty,
      t.table.receivedQty,
      t.table.remainingQty,
      t.table.uom,
      t.table.storageLocation,
    ]);
    // 7302 — 부분 입하 · 창고 없음. 이름 칸은 라인 응답에서 온다(품목을 따로 부르지 않는다).
    expect(cellsOf(within(lineTable).getAllByRole('row')[1] as HTMLElement)).toEqual([
      t.receiptStatus.PARTIAL,
      '2',
      'SAMPLE-ITEM-01',
      '합성 품목 가',
      '50',
      '20',
      '30',
      'SAMPLE-EA',
      t.values.empty,
    ]);
    expect(requests.some((request) => request.url.pathname.startsWith(ITEM_PATH_PREFIX))).toBe(
      false,
    );
  });

  it('결과가 하나뿐이면 저절로 골라 라인을 보인다', async () => {
    renderScreen([listRoute(ROWS.slice(0, 1)), ...lookupRoutes()]);

    expect(await within(linesPane()).findByText('SAMPLE-ITEM-01')).toBeInTheDocument();
  });

  it('창고는 이름으로 풀고, 이름이 없으면 코드다', async () => {
    renderScreen(
      [
        listRoute(),
        linesRoute([
          scheduleLine({ purchaseOrderLineId: 7311, lineNo: 1 }),
          scheduleLine({
            purchaseOrderLineId: 7312,
            lineNo: 2,
            erpStorageLocationCode: 'SAMPLE-SL9',
          }),
        ]),
        ...lookupRoutes(),
      ],
      '?po=7101',
    );

    await within(linesPane()).findAllByText('SAMPLE-ITEM-01');

    await waitFor(() => {
      expect(within(linesPane()).getByText('합성 자재창고')).toBeInTheDocument();
    });
    expect(within(linesPane()).getByText('SAMPLE-SL9')).toBeInTheDocument();
  });

  it('품목코드로 찾았으면 오른쪽에서 그 품목 라인을 표시한다', async () => {
    renderScreen(
      [
        listRoute(ROWS.slice(0, 1)),
        linesRoute([
          scheduleLine({ purchaseOrderLineId: 7311, lineNo: 1 }),
          scheduleLine({
            purchaseOrderLineId: 7312,
            lineNo: 2,
            itemId: 8302,
            itemCode: 'SAMPLE-ITEM-02',
          }),
        ]),
        ...lookupRoutes(),
      ],
      '?item=8301',
    );

    await within(linesPane()).findByText('SAMPLE-ITEM-02');

    const marked = within(linesPane()).getAllByText(t.values.matchedLine);
    expect(marked).toHaveLength(1);
    expect(marked[0]?.closest('tr')).toHaveTextContent('SAMPLE-ITEM-01');
  });

  it('공급사 목록을 못 받으면 공급업체 칸 아래에 알린다', async () => {
    renderScreen([listRoute(), failingLookupRoute(PARTNERS_PATH), ...lookupRoutes()]);

    expect(await screen.findByText(t.filters.lookupFailed)).toBeInTheDocument();
  });

  /* #44 — 두 표 어디에도 내부 번호(7100·7300·8100대)가 글자로 서지 않는다. */
  it('표에 내부 번호가 보이지 않는다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()], '?po=7101');

    await within(linesPane()).findByText('SAMPLE-ITEM-01');

    const text = `${listTable().textContent ?? ''}${linesPane().textContent ?? ''}`;
    expect(text).not.toMatch(/\b(71\d\d|73\d\d|8[1-5]\d\d)\b/);
  });
});

describe('InboundScheduleScreen — 빠른 조회', () => {
  const ITEMS_PATH = '/mdm/items';

  /** 품목 검색(`GET /mdm/items?q=`) — 스캔 값이 품목코드라고 보고 찾는다. */
  const itemSearchRoute = (items: unknown[]): StubRoute => ({
    match: (request) => isGet(request, ITEMS_PATH),
    respond: () => jsonResponse(listBody(items)),
  });

  const itemRow = (itemId: number, itemCode: string) => ({
    itemId,
    itemCode,
    itemName: '합성 품목',
    itemTypeCode: 'RAW',
    isActive: true,
  });

  it('들어오자마자 품목코드 칸에 커서가 있다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

    expect(screen.getByLabelText(t.quick.item)).toHaveFocus();
  });

  it('스캔한 값이 품목코드와 정확히 맞으면 그 품목으로 바로 조회하고 칸을 비운다', async () => {
    const { requests, user } = renderScreen([
      listRoute(),
      itemSearchRoute([itemRow(8302, 'SAMPLE-ITEM-012'), itemRow(8301, 'SAMPLE-ITEM-01')]),
      ...lookupRoutes(),
    ]);

    await screen.findByText('SAMPLE-PO-0001');
    await user.type(screen.getByLabelText(t.quick.item), 'sample-item-01{Enter}');

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?item=8301`);
    });
    expect(requestsTo(requests, LIST_PATH).at(-1)?.url.searchParams.get('itemId')).toBe('8301');
    expect(screen.getByLabelText(t.quick.item)).toHaveValue('');
  });

  /* Enter 없이 「조회」를 눌러도 친 품목코드로 찾는다(2026-10-21 보고). */
  it('품목코드를 치고 「조회」를 눌러도 그 품목으로 조회한다', async () => {
    const { requests, user } = renderScreen([
      listRoute(),
      itemSearchRoute([itemRow(8301, 'SAMPLE-ITEM-01')]),
      ...lookupRoutes(),
    ]);

    await screen.findByText('SAMPLE-PO-0001');
    await user.type(screen.getByLabelText(t.quick.item), 'SAMPLE-ITEM-01');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).at(-1)?.url.searchParams.get('itemId')).toBe('8301');
    });
    expect(screen.getByLabelText(t.quick.item)).toHaveValue('');
  });

  it('맞는 품목이 없으면 칸 아래에 알리고 조회하지 않는다', async () => {
    const { user } = renderScreen([listRoute(), itemSearchRoute([]), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');
    await user.type(screen.getByLabelText(t.quick.item), 'NOPE{Enter}');

    expect(await screen.findByText(t.quick.scanNotFound('NOPE'))).toBeInTheDocument();
    expect(currentLocation()).toBe(ROUTE);
  });

  it('여럿이 걸리면 그 값으로 찾아 둔 품목 선택 창을 연다', async () => {
    const { user } = renderScreen([
      listRoute(),
      itemSearchRoute([itemRow(8301, 'SAMPLE-ITEM-01A'), itemRow(8302, 'SAMPLE-ITEM-01B')]),
      ...lookupRoutes(),
    ]);

    await screen.findByText('SAMPLE-PO-0001');
    await user.type(screen.getByLabelText(t.quick.item), 'SAMPLE-ITEM{Enter}');

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByDisplayValue('SAMPLE-ITEM')).toBeInTheDocument();
  });

  it('공급업체 후보를 고르면 바로 그 공급사로 조회한다', async () => {
    const { user } = renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');
    // 후보 목록에서 고른 것은 칸 글자가 후보 하나와 같아지는 것으로 온다.
    await user.type(screen.getByLabelText(t.quick.supplier), SUPPLIER_LABEL);

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?supplier=8101`);
    });
  });

  it('「오늘 도착」 확인칸은 납기를 오늘 하루로 걸고, 끄면 기본 기간으로 돌아간다', async () => {
    const { user } = renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');
    await user.click(screen.getByRole('checkbox', { name: t.quick.today }));

    await waitFor(() => {
      expect(currentLocation()).toBe(`${ROUTE}?from=${TODAY}&to=${TODAY}`);
    });
    expect(screen.getByRole('checkbox', { name: t.quick.today })).toBeChecked();

    // 풀면 기본 기간(오늘 앞뒤 4주)으로 돌아간다 — 기본은 주소에 적지 않는다.
    await user.click(screen.getByRole('checkbox', { name: t.quick.today }));
    await waitFor(() => {
      expect(currentLocation()).toBe(ROUTE);
    });
  });

  /* 날짜만 「조회」를 기다리면 뒤이은 품목코드 조회가 옛 기간으로 나간다(2026-10-21 보고). */
  it('납기를 바꾸면 조회 단추 없이 바로 그 기간으로 조회한다', async () => {
    const { requests, user } = renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');
    const from = screen.getByLabelText(t.fields.periodFrom);
    await user.clear(from);
    await user.type(from, '2026-01-05');

    await waitFor(() => {
      expect(
        requestsTo(requests, LIST_PATH).at(-1)?.url.searchParams.get('expectedReceiptDateFrom'),
      ).toBe('2026-01-05');
    });
  });

  it('「지연」은 켜는 즉시 납기 기간과 상관없이 지연만 조회한다', async () => {
    const { requests, user } = renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');
    await user.click(screen.getByRole('checkbox', { name: t.quick.overdue }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH).at(-1)?.url.search).toBe('?overdueOnly=true&size=20');
    });
  });

  it('상세 조건은 접혀 있고, 걸린 상세 조건이 있으면 펼친 채로 들어온다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()], `?q=SAMPLE`);

    await screen.findByText('SAMPLE-PO-0001');

    expect(screen.getByRole('button', { name: t.quick.detailClose })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByLabelText(t.fields.q)).toBeVisible();
  });
});

describe('InboundScheduleScreen — 발주일과 폭 조절', () => {
  it('발주 목록 마지막 열과 상세 머리에 발주일이 YYYY.MM.DD 로 보인다', async () => {
    const { user } = renderScreen([listRoute(), linesRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0002');
    expect(cellsOf(rowOf('SAMPLE-PO-0002')).at(-1)).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);

    await user.click(within(rowOf('SAMPLE-PO-0002')).getByText('합성 공급사 다'));

    const head = await within(linesPane()).findByText(t.detail.orderDate);
    expect(head.nextElementSibling?.textContent).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
  });

  it('두 표 사이 막대를 키보드로 옮기면 비율이 바뀐다', async () => {
    const { user } = renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');
    const splitter = screen.getByRole('separator', { name: t.splitter });
    const before = Number(splitter.getAttribute('aria-valuenow'));

    splitter.focus();
    await user.keyboard('{ArrowRight}{ArrowRight}');

    expect(Number(splitter.getAttribute('aria-valuenow'))).toBe(before + 4);
  });
});

describe('InboundScheduleScreen — 초과분 발주 연결', () => {
  const te = t.excess;
  const QTY = '30 SAMPLE-EA';
  const ORDER_LINE = te.orderLine('SAMPLE-PO-0001', 1);

  it('미연결 초과분이 없으면 탭 줄 끝 단추는 이름만 있고 수가 붙지 않는다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    expect(await screen.findByRole('button', { name: te.entry })).toBeInTheDocument();
  });

  it('미연결 초과분이 있으면 단추에 그 수가 붙고, 누르면 창이 주소로 열리고 닫으면 주소에서 빠진다', async () => {
    const { user } = renderScreen([
      excessListRoute([excessFixture()]),
      listRoute(),
      ...lookupRoutes(),
    ]);

    await user.click(
      await screen.findByRole('button', { name: `${te.entry} — ${te.entryCount(1)}` }),
    );

    const dialog = await screen.findByRole('dialog', { name: te.title });
    expect(currentLocation()).toContain('excess=1');
    /* 고를 것이 하나뿐이라 저절로 골랐다 — 다음 할 일은 발주 라인 선택이다. */
    expect(await within(dialog).findByText(te.blocked.noLine)).toBeInTheDocument();

    /* 닫기는 창 머리의 단추 하나다(디자인 시스템) — 아래에는 할 일(연결)만 둔다. */
    await user.click(within(dialog).getByRole('button', { name: messages.common.close }));

    await waitFor(() => {
      expect(currentLocation()).not.toContain('excess');
    });
  });

  it.each([403, 404])(
    '초과분 경로가 %i 이면 단추도 「초과분」 칸도 서지 않는다',
    async (status) => {
      renderScreen([failingExcessListRoute(status), listRoute(), ...lookupRoutes()], '?po=7101');

      await within(linesPane()).findByText('SAMPLE-ITEM-01');

      expect(screen.queryByRole('button', { name: new RegExp(te.entry) })).toBeNull();
      expect(within(linesPane()).queryByRole('columnheader', { name: te.lineColumn })).toBeNull();
    },
  );

  it('맞는 초과분이 없는 발주에는 「초과분」 칸이 서지 않는다', async () => {
    renderScreen(
      [excessListRoute([excessFixture({ itemId: 8999 })]), listRoute(), ...lookupRoutes()],
      '?po=7101',
    );

    await within(linesPane()).findByText('SAMPLE-ITEM-01');
    await screen.findByRole('button', { name: `${te.entry} — ${te.entryCount(1)}` });

    expect(within(linesPane()).queryByRole('columnheader', { name: te.lineColumn })).toBeNull();
  });

  it('라인의 「연결」을 누르면 그 초과분·라인을 고른 채로 열리고, 「연결」만 누르면 된다', async () => {
    const bodies: unknown[] = [];
    const { requests, user } = renderScreen(
      [
        excessListRoute([excessFixture()]),
        candidatesRoute([
          /* 수량 일치 후보가 따로 있어도 사람이 라인에서 고른 줄이 남는다. */
          candidateFixture({
            purchaseOrderLineId: 7388,
            purchaseOrderId: 7188,
            purchaseOrderNo: 'SAMPLE-PO-0088',
            roomQty: 30,
            exactMatch: true,
          }),
          candidateFixture(),
        ]),
        excessWriteRoute('link', bodies),
        listRoute(),
        ...lookupRoutes(),
      ],
      '?po=7101',
    );

    await user.click(
      await within(linesPane()).findByRole('button', { name: te.lineLinkableLabel(1, QTY) }),
    );

    const dialog = await screen.findByRole('dialog', { name: te.title });
    expect(await within(dialog).findByText(te.confirmLink(QTY, ORDER_LINE))).toBeInTheDocument();
    /* 후보 표식 — 수량 일치 · 선택한 발주. */
    expect(within(dialog).getByText(te.candidates.exact)).toBeInTheDocument();
    expect(within(dialog).getByText(te.candidates.current)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: te.actions.link }));

    expect(await within(dialog).findByText(te.done.linked(QTY, ORDER_LINE))).toBeInTheDocument();
    expect(bodies).toEqual([{ purchaseOrderLineId: 7301 }]);
    expect(
      requests.some(
        (request) =>
          request.method === 'POST' && request.url.pathname === `${EXCESS_PATH}/9501:link`,
      ),
    ).toBe(true);
  });

  it('라인을 고르기 전에는 「연결」이 잠기고 무엇을 고를지 말한다', async () => {
    const { user } = renderScreen(
      [
        excessListRoute([
          excessFixture(),
          excessFixture({ inboundReceiptExcessId: 9502, lineNo: 2 }),
        ]),
        candidatesRoute([
          candidateFixture(),
          candidateFixture({ purchaseOrderLineId: 7302, lineNo: 2 }),
        ]),
        listRoute(),
        ...lookupRoutes(),
      ],
      '?excess=1',
    );

    const dialog = await screen.findByRole('dialog', { name: te.title });
    expect(await within(dialog).findByText(te.blocked.noExcess)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: te.actions.link })).toBeDisabled();

    await user.click(
      within(dialog).getByRole('button', { name: te.pickExcess('SAMPLE-IR-0001', 2) }),
    );

    expect(await within(dialog).findByText(te.blocked.noLine)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: te.actions.link })).toBeDisabled();

    await user.click(
      await within(dialog).findByRole('button', { name: te.pickLine('SAMPLE-PO-0001', 2) }),
    );

    expect(
      within(dialog).getByText(te.confirmLink(QTY, te.orderLine('SAMPLE-PO-0001', 2))),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: te.actions.link })).toBeEnabled();
  });

  it('후보가 없으면 연결할 발주 라인이 없다고 말한다', async () => {
    renderScreen(
      [excessListRoute([excessFixture()]), candidatesRoute([]), listRoute(), ...lookupRoutes()],
      '?excess=1',
    );

    const dialog = await screen.findByRole('dialog', { name: te.title });

    expect(await within(dialog).findByText(te.candidates.emptyTitle)).toBeInTheDocument();
  });

  it('「초과 입하 분리」에서 건너온 전표의 초과분은 앞에 서고 「방금 등록」이 붙는다', async () => {
    renderScreen(
      [
        excessListRoute([
          excessFixture({ inboundReceiptExcessId: 9500, inboundReceiptNo: 'SAMPLE-IR-0000' }),
          excessFixture(),
        ]),
        candidatesRoute([candidateFixture()]),
        listRoute(),
        ...lookupRoutes(),
      ],
      '?excess=1&excessReceipt=SAMPLE-IR-0001',
    );

    const dialog = await screen.findByRole('dialog', { name: te.title });
    const table = (await within(dialog).findAllByRole('table'))[0] as HTMLElement;
    const firstRow = (await within(table).findAllByRole('row'))[1] as HTMLElement;

    expect(within(firstRow).getByText('SAMPLE-IR-0001')).toBeInTheDocument();
    expect(within(firstRow).getByText(te.justRegistered)).toBeInTheDocument();
    /* 그 전표의 초과분이 하나뿐이라 골라 두고, 후보도 하나뿐이라 골라 둔다. */
    expect(await within(dialog).findByText(te.confirmLink(QTY, ORDER_LINE))).toBeInTheDocument();
  });

  it('연결된 초과분은 「연결됨」으로 보이고, 눌러 연 창에서 해제할 수 있다', async () => {
    const bodies: unknown[] = [];
    const { user } = renderScreen(
      [
        excessListRoute([], [linkedExcessFixture()]),
        excessWriteRoute('unlink', bodies, () => jsonResponse(excessFixture())),
        listRoute(),
        ...lookupRoutes(),
      ],
      '?po=7101',
    );

    await user.click(
      await within(linesPane()).findByRole('button', { name: te.lineLinkedLabel(1, QTY) }),
    );

    const dialog = await screen.findByRole('dialog', { name: te.title });
    expect(await within(dialog).findByText(te.confirmUnlink(QTY, ORDER_LINE))).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: te.actions.unlink }));

    expect(await within(dialog).findByText(te.done.unlinked(QTY, ORDER_LINE))).toBeInTheDocument();
    expect(bodies).toEqual([null]);
  });

  it('연결이 막히면(이미 연결됨) 서버 사유를 배너로 내고 창은 열린 채다', async () => {
    const { user } = renderScreen(
      [
        excessListRoute([excessFixture()]),
        candidatesRoute([candidateFixture()]),
        excessWriteRoute('link', [], () =>
          jsonResponse(
            {
              errors: [
                { scope: 'screen', code: 'STATE_LOCKED', message: '이미 연결된 초과분입니다.' },
              ],
            },
            { status: 400 },
          ),
        ),
        listRoute(),
        ...lookupRoutes(),
      ],
      '?excess=1',
    );

    const dialog = await screen.findByRole('dialog', { name: te.title });
    await within(dialog).findByText(te.confirmLink(QTY, ORDER_LINE));
    await user.click(within(dialog).getByRole('button', { name: te.actions.link }));

    expect(await within(dialog).findByText('이미 연결된 초과분입니다.')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: te.title })).toBeInTheDocument();
  });
});
