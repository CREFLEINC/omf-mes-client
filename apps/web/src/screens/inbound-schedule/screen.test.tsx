import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigate } from 'react-router';
import { describe, expect, it } from 'vitest';

import { plantToday } from '../../patterns/plant-time';
import { SessionProvider, type Session } from '../../patterns/session';
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import type { UnallocatedLine } from './excess-types';
import {
  candidateFixture,
  excessFixture,
  itemDetailFixtures,
  labelPendingProgress,
  lotProgress,
  partnerFixtures,
  plantFixtures,
  orderFixtures,
  orderSummary,
  progressFixtures,
  scheduleFixtures,
  scheduleLine,
  stageCountsFixture,
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
/** 초과분 발주 연결(서버 장부 P-115 입하 ↔ P/O 배정) — 계약 밖 경로 셋. */
const EXCESS_PATH = '/logistics/inbound-unallocated';
const CANDIDATES_PATH = /^\/logistics\/inbound-receipt-lines\/\d+\/allocation-candidates$/;
const ALLOCATIONS_PATH = /^\/logistics\/inbound-receipt-lines\/(\d+)\/allocations$/;
/** 입고 진행(계약 대기) — 발주 하나의 LOT 단계 · 묶음별 수 · IQC 의뢰. */
const PROGRESS_PATH = /^\/logistics\/purchase-orders\/(\d+)\/inbound-progress$/;
const STAGE_COUNTS_PATH = '/logistics/purchase-orders:inbound-stage-counts';
const IQC_REQUEST_PATH = '/quality/inspection-requests';

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

/** 초과분이 남은 입하 줄 목록(서버 「미배정」). 기본은 비어 있다. */
const excessListRoute = (unlinked: UnallocatedLine[] = []): StubRoute => ({
  match: (request) => isGet(request, EXCESS_PATH),
  respond: () => jsonResponse(listBody(unlinked)),
});

const failingExcessListRoute = (status: number): StubRoute => ({
  match: (request) => isGet(request, EXCESS_PATH),
  respond: () => jsonResponse({ message: '' }, { status }),
});

const candidatesRoute = (items: unknown[]): StubRoute => ({
  match: (request) =>
    request.method === 'GET' && CANDIDATES_PATH.test(new URL(request.url).pathname),
  respond: () => jsonResponse({ items }),
});

/** 연결(서버 「배정」) — 본문을 모은다. 응답은 주어진 것(기본 201 배정 한 몫). */
const allocationWriteRoute = (
  bodies: unknown[],
  respond: () => Response = () =>
    jsonResponse(
      {
        inboundReceiptPoAllocationId: 9702,
        inboundReceiptLineId: 9411,
        allocatedQty: 30,
        allocatedAt: '2026-10-21T03:00:00.000Z',
        orderLine: {
          purchaseOrderLineId: 7301,
          purchaseOrderId: 7101,
          purchaseOrderNo: 'SAMPLE-PO-0001',
          erpPurchaseOrderNo: 'SAMPLE-ERP-0001',
          lineNo: 1,
        },
      },
      { status: 201 },
    ),
): StubRoute => ({
  match: (request) =>
    request.method === 'POST' && ALLOCATIONS_PATH.test(new URL(request.url).pathname),
  respond: async (request) => {
    const text = await request.clone().text();
    bodies.push(text === '' ? null : JSON.parse(text));

    return respond();
  },
});

/** 발주 7101 의 LOT 진행. 다른 발주는 비어 있다. */
const progressRoute = (items: unknown[] = progressFixtures): StubRoute => ({
  match: (request) => request.method === 'GET' && PROGRESS_PATH.test(new URL(request.url).pathname),
  respond: (request) => {
    const id = Number(PROGRESS_PATH.exec(new URL(request.url).pathname)?.[1]);

    return jsonResponse({ items: id === 7101 ? items : [] });
  },
});

const failingProgressRoute = (status: number): StubRoute => ({
  match: (request) => request.method === 'GET' && PROGRESS_PATH.test(new URL(request.url).pathname),
  respond: () => jsonResponse({ message: '' }, { status }),
});

const stageCountsRoute = (counts: unknown = stageCountsFixture): StubRoute => ({
  match: (request) => isGet(request, STAGE_COUNTS_PATH),
  respond: () => jsonResponse({ counts }),
});

const failingStageCountsRoute = (status: number): StubRoute => ({
  match: (request) => isGet(request, STAGE_COUNTS_PATH),
  respond: () => jsonResponse({ message: '' }, { status }),
});

/** `POST /quality/inspection-requests` — 본문을 모은다. */
const iqcRequestRoute = (bodies: unknown[]): StubRoute => ({
  match: (request) =>
    request.method === 'POST' && new URL(request.url).pathname === IQC_REQUEST_PATH,
  respond: async (request) => {
    bodies.push(JSON.parse(await request.clone().text()));

    return jsonResponse(
      { inspectionRequestId: 7899, inspectionRequestNo: 'SAMPLE-IQ-0099', statusCode: 'REQUESTED' },
      { status: 201 },
    );
  },
});

/**
 * 참조 다섯 + **앞선 서버**(진행 경로를 모른다 — 404). 지금까지의 시험은 모두 이 상태에서 돈다 —
 * 진행 자료가 있는 상태는 `progressRoutes()` 를 **앞에** 둔다(먼저 맞는 규칙이 이긴다).
 */
const lookupRoutes = (): StubRoute[] => [
  linesRoute(),
  excessListRoute(),
  failingProgressRoute(404),
  failingStageCountsRoute(404),
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
  session: Session = SYNTHETIC_SESSION,
): { requests: RecordedRequest[]; user: ReturnType<typeof userEvent.setup> } => {
  const { fetch, requests } = createRecordingFetch(routes);

  renderWithProviders(
    <SessionProvider>
      <InboundScheduleScreen />
      <LocationProbe />
      <BackProbe />
    </SessionProvider>,
    { fetch, route: `${ROUTE}${search}`, session },
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

  it('이름은 화면 막대에 한 번만 서고 경로 표시와 안내 문장은 두지 않는다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

    // 사용자 지시(2026-10-21) — 이름은 한 곳만. 탭을 합친 뒤(2026-10-23)에는 화면 막대의 「입고 관리」가 그 자리다.
    expect(screen.getAllByRole('heading', { name: t.title })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('입고 관리');
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

/** 「입하 등록」 창이 읽는 발주 상세 — 머리와 라인을 함께 준다(창은 발주 번호 하나로 선다). */
const PER_LINE_PATH = '/logistics/inbound-receipts:per-line';

/** 라벨 미부착 사유 코드 — 「라벨 없음」 하나. */
const lotReasonRoute = (): StubRoute => ({
  match: (request) =>
    isGet(request, CODE_VALUES_PATH) &&
    new URL(request.url).searchParams.get('codeGroupCode') === 'SUBSTITUTE_LOT_REASON',
  respond: () => jsonResponse(listBody([{ code: 'NO_LABEL', name: '라벨 없음' }])),
});

/** 품목마다 입하 한 건 — 보낸 본문을 담고, 줄 수만큼 입하번호를 돌려준다. */
const perLineRoute = (bodies: unknown[]): StubRoute => ({
  match: (request) => request.method === 'POST' && new URL(request.url).pathname === PER_LINE_PATH,
  respond: async (request) => {
    const body = JSON.parse(await request.clone().text()) as { lines: unknown[] };
    bodies.push(body);

    return jsonResponse(
      {
        created: body.lines.map((_, index) => ({
          inboundReceipt: {
            inboundReceiptId: 7590 + index,
            inboundReceiptNo: `SAMPLE-IR-009${String(index)}`,
            statusCode: 'REGISTERED',
          },
          lines: [{ inboundReceiptLineId: 9490 + index, lineNo: 1 }],
        })),
      },
      { status: 201 },
    );
  },
});

/** 첫 번째는 응답을 잃은 것처럼 실패(503)하고 그다음부터 받는다 — 보낸 멱등 키와 본문을 담는다. */
const flakyPerLineRoute = (calls: { key: string | null; body: unknown }[]): StubRoute => ({
  match: (request) => request.method === 'POST' && new URL(request.url).pathname === PER_LINE_PATH,
  respond: async (request) => {
    const body = JSON.parse(await request.clone().text()) as { lines: unknown[] };
    calls.push({ key: request.headers.get('Idempotency-Key'), body });
    if (calls.length === 1) return jsonResponse({ message: '' }, { status: 503 });

    return jsonResponse(
      {
        created: body.lines.map((_, index) => ({
          inboundReceipt: {
            inboundReceiptId: 7590 + index,
            inboundReceiptNo: `SAMPLE-IR-009${String(index)}`,
            statusCode: 'REGISTERED',
          },
          lines: [{ inboundReceiptLineId: 9490 + index, lineNo: 1 }],
        })),
      },
      { status: 201 },
    );
  },
});

/** 발주 7101 의 라인 셋 — 미착수 100 · 부분 입하 50 중 20 · 다 받음 10. */
const RECEIVE_LINES = [
  scheduleLine({ expectedReceiptDate: TODAY }),
  scheduleLine({
    expectedReceiptDate: TODAY,
    purchaseOrderLineId: 7306,
    lineNo: 2,
    itemId: 8302,
    itemCode: 'SAMPLE-ITEM-02',
    itemName: '합성 품목 나',
    orderedQty: 50,
    receivedQty: 20,
    remainingQty: 30,
    receiptStatusCode: 'PARTIAL',
  }),
  scheduleLine({
    expectedReceiptDate: TODAY,
    purchaseOrderLineId: 7307,
    lineNo: 3,
    itemId: 8303,
    itemCode: 'SAMPLE-ITEM-03',
    itemName: '합성 품목 다',
    orderedQty: 10,
    receivedQty: 10,
    remainingQty: 0,
    receiptStatusCode: 'COMPLETED',
  }),
];

/*
 * 입하 등록 — **라인 표에서 바로 받는다**(사용자 지시 2026-10-24 · PDA 「라벨 미부착 일괄 입하」와 같은 길). 옛 「입하 등록」
 * 창은 걷었다. 체크한 품목은 남은 수량 그대로 한꺼번에, 행을 누르면 그 품목만 수량을 정해 받는다. 확인 창을 한 번 거치고
 * `:per-line` 으로 보낸다(입하번호는 품목마다 하나).
 */
describe('InboundScheduleScreen — 입하 등록(라인 표)', () => {
  const routes = (bodies: unknown[] = []): StubRoute[] => [
    linesRoute(RECEIVE_LINES),
    lotReasonRoute(),
    perLineRoute(bodies),
    listRoute(),
    ...lookupRoutes(),
  ];
  const lineRow = (code: string): HTMLElement => {
    const row = within(linesPane()).getByText(code).closest('tr');
    if (row === null) throw new Error(`${code} 줄이 없습니다`);

    return row;
  };

  it('체크하면 입하 수량이 받은 뒤의 수로 파랗게 미리 보이고, 다 받은 줄은 체크할 수 없다', async () => {
    const { user } = renderScreen(routes(), '?po=7101');

    await within(linesPane()).findByText('SAMPLE-ITEM-01');
    const submit = within(linesPane()).getByRole('button', { name: t.receive.submit });
    expect(submit).toBeDisabled();
    expect(
      within(linesPane()).getByRole('checkbox', { name: t.receive.selectRow(3) }),
    ).toBeDisabled();

    await user.click(within(linesPane()).getByRole('checkbox', { name: t.receive.selectRow(1) }));

    const filled = lineRow('SAMPLE-ITEM-01').querySelectorAll('.po-board-filled');
    expect(Array.from(filled).map((node) => node.textContent)).toEqual(['100', '0']);
    expect(within(linesPane()).getByText(t.receive.checkedCount(1))).toBeInTheDocument();
    expect(submit).toBeEnabled();
  });

  it('「모두 선택」은 부분 입하 줄을 빼고 고르고 그 수를 알린다', async () => {
    const { user } = renderScreen(routes(), '?po=7101');

    await within(linesPane()).findByText('SAMPLE-ITEM-01');
    await user.click(within(linesPane()).getByRole('checkbox', { name: t.receive.selectAll }));

    expect(
      within(linesPane()).getByRole('checkbox', { name: t.receive.selectRow(1) }),
    ).toBeChecked();
    expect(
      within(linesPane()).getByRole('checkbox', { name: t.receive.selectRow(2) }),
    ).not.toBeChecked();
    expect(within(linesPane()).getByText(t.receive.partialSkipped(1))).toBeInTheDocument();
  });

  it('체크한 품목 입하 등록 → 확인 창 → 등록하면 품목마다 입하 한 건으로(:per-line) 라벨 미부착 · 남은 수량 그대로 보낸다', async () => {
    const bodies: unknown[] = [];
    const { user } = renderScreen(routes(bodies), '?po=7101');

    await within(linesPane()).findByText('SAMPLE-ITEM-01');
    await user.click(within(linesPane()).getByRole('checkbox', { name: t.receive.selectRow(1) }));
    await user.click(within(linesPane()).getByRole('checkbox', { name: t.receive.selectRow(2) }));
    await user.click(within(linesPane()).getByRole('button', { name: t.receive.submit }));

    const dialog = await screen.findByRole('dialog', { name: t.receive.confirm.title });
    expect(within(dialog).getByText(t.receive.confirm.lead(2))).toBeInTheDocument();
    expect(within(dialog).getByText(t.receive.confirm.labelNote)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: t.receive.confirm.register }));

    await waitFor(() => {
      expect(bodies).toHaveLength(1);
    });
    const body = bodies[0] as { lines: Record<string, unknown>[]; supplierId: number };
    expect(body.supplierId).toBe(8101);
    expect(body.lines).toEqual([
      expect.objectContaining({
        purchaseOrderLineId: 7301,
        receivedQty: 100,
        supplierLotNo: null,
        supplierLotMissing: true,
        supplierLotLabelAttached: false,
        substituteLotReasonCode: 'NO_LABEL',
      }),
      expect.objectContaining({ purchaseOrderLineId: 7306, receivedQty: 30 }),
    ]);
    expect(body.lines.some((line) => 'excessQty' in line)).toBe(false);
    expect(
      await within(linesPane()).findByText(t.receive.done(2, 'SAMPLE-IR-0090')),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: t.receive.confirm.title })).toBeNull();
  });

  it('응답을 잃고 다시 「등록」을 누르면 같은 멱등 키 · 같은 입하 일시로 보낸다(입하가 두 번 서지 않는다)', async () => {
    const calls: { key: string | null; body: unknown }[] = [];
    const { user } = renderScreen(
      [
        linesRoute(RECEIVE_LINES),
        lotReasonRoute(),
        flakyPerLineRoute(calls),
        listRoute(),
        ...lookupRoutes(),
      ],
      '?po=7101',
    );

    await within(linesPane()).findByText('SAMPLE-ITEM-01');
    await user.click(within(linesPane()).getByRole('checkbox', { name: t.receive.selectRow(1) }));
    await user.click(within(linesPane()).getByRole('button', { name: t.receive.submit }));
    const dialog = await screen.findByRole('dialog', { name: t.receive.confirm.title });

    await user.click(within(dialog).getByRole('button', { name: t.receive.confirm.register }));
    await waitFor(() => {
      expect(calls).toHaveLength(1);
    });
    await waitFor(() => {
      expect(
        within(dialog).getByRole('button', { name: t.receive.confirm.register }),
      ).toBeEnabled();
    });
    await user.click(within(dialog).getByRole('button', { name: t.receive.confirm.register }));

    await waitFor(() => {
      expect(calls).toHaveLength(2);
    });
    const [first, second] = calls;
    expect(second?.key).toBe(first?.key);
    expect((second?.body as { receiptDatetime: string }).receiptDatetime).toBe(
      (first?.body as { receiptDatetime: string }).receiptDatetime,
    );
    expect(
      await within(linesPane()).findByText(t.receive.done(1, 'SAMPLE-IR-0090')),
    ).toBeInTheDocument();
  });

  it('행을 누르면 그 품목만 수량을 정해 받고, 정량 한도를 넘는 몫은 초과분으로 미리 보이고 실린다', async () => {
    const bodies: unknown[] = [];
    const { user } = renderScreen(routes(bodies), '?po=7101');

    await within(linesPane()).findByText('SAMPLE-ITEM-01');
    await user.click(within(lineRow('SAMPLE-ITEM-01')).getByText('합성 품목 가'));

    const input = within(linesPane()).getByRole('textbox', { name: t.receive.qtyLabel(1) });
    expect(input).toHaveValue('100');

    await user.clear(input);
    await user.type(input, '120');
    expect(lineRow('SAMPLE-ITEM-01')).toHaveTextContent(t.receive.excessTag('20'));

    await user.click(within(linesPane()).getByRole('button', { name: t.receive.submitRow }));
    const dialog = await screen.findByRole('dialog', { name: t.receive.confirm.title });
    expect(within(dialog).getByText(t.receive.confirm.excess('20'))).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: t.receive.confirm.register }));

    await waitFor(() => {
      expect(bodies).toHaveLength(1);
    });
    expect((bodies[0] as { lines: unknown[] }).lines).toEqual([
      expect.objectContaining({ purchaseOrderLineId: 7301, receivedQty: 120, excessQty: 20 }),
    ]);
    expect(
      await within(linesPane()).findByText(t.receive.done(1, 'SAMPLE-IR-0090'), { exact: false }),
    ).toBeInTheDocument();

    await user.click(within(linesPane()).getByRole('button', { name: t.receive.goExcess }));
    expect(currentLocation()).toContain('excessReceipt=SAMPLE-IR-0090');
    expect(currentLocation()).toContain('excessReceiptLine=9490');
  });

  it('다 받은 줄도 행을 눌러 받으면 전부 초과분이다', async () => {
    const { user } = renderScreen(routes(), '?po=7101');

    await within(linesPane()).findByText('SAMPLE-ITEM-03');
    await user.click(
      within(linesPane()).getByRole('button', { name: t.receive.editRow('SAMPLE-ITEM-03') }),
    );

    const input = within(linesPane()).getByRole('textbox', { name: t.receive.qtyLabel(3) });
    expect(input).toHaveValue('');
    await user.type(input, '5');
    expect(lineRow('SAMPLE-ITEM-03')).toHaveTextContent(t.receive.excessTag('5'));
  });

  it('취소된 발주에는 등록 단추가 없다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()], '?po=7103');

    await within(linesPane()).findByRole('table');
    expect(within(linesPane()).queryByRole('button', { name: t.receive.submit })).toBeNull();
  });

  it('입하 등록 권한(W-01-03)이 없으면 체크 열 · 행 편집 · 등록 단추가 없다', async () => {
    renderScreen(routes(), '?po=7101', { ...SYNTHETIC_SESSION, permissions: ['W-01-09'] });

    await within(linesPane()).findByText('SAMPLE-ITEM-01');

    expect(within(linesPane()).queryByRole('checkbox')).toBeNull();
    expect(within(linesPane()).queryByRole('button', { name: t.receive.submit })).toBeNull();
    expect(
      within(linesPane()).queryByRole('button', { name: t.receive.editRow('SAMPLE-ITEM-01') }),
    ).toBeNull();
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
    /* 첫 칸은 체크 칸이다. */
    expect(cellsOf(within(lineTable).getAllByRole('row')[1] as HTMLElement).slice(3, 5)).toEqual([
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
      /* 체크 열 — 머리칸은 「모두 선택」 체크(글자 없음). */
      '',
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
      '',
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
        allocationWriteRoute(bodies),
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
    /* 그 입하 줄의 초과분 전부를 싣는다. */
    expect(bodies).toEqual([{ purchaseOrderLineId: 7301, qty: 30 }]);
    expect(
      requests.some(
        (request) =>
          request.method === 'POST' &&
          request.url.pathname === '/logistics/inbound-receipt-lines/9411/allocations',
      ),
    ).toBe(true);
  });

  it('라인을 고르기 전에는 「연결」이 잠기고 무엇을 고를지 말한다', async () => {
    const { user } = renderScreen(
      [
        excessListRoute([
          excessFixture(),
          excessFixture({ inboundReceiptLineId: 9412, lineNo: 2 }),
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

  it('「입하 등록」에서 건너온 전표의 초과분은 앞에 서고 「방금 등록」이 붙는다', async () => {
    renderScreen(
      [
        excessListRoute([
          excessFixture({ inboundReceiptLineId: 9410, inboundReceiptNo: 'SAMPLE-IR-0000' }),
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

  it('창에는 미연결 목록 하나만 있다 — 「연결됨」 탭 · 연결 해제는 없고, 원 발주 칸은 이미 들어간 발주 라인이다', async () => {
    renderScreen(
      [
        excessListRoute([
          excessFixture(),
          /* 다 초과분이라 들어간 발주가 없는 줄. */
          excessFixture({
            inboundReceiptLineId: 9412,
            inboundReceiptNo: 'SAMPLE-IR-0002',
            unallocatedQty: 130,
            allocations: [],
          }),
        ]),
        listRoute(),
        ...lookupRoutes(),
      ],
      '?excess=1',
    );

    const dialog = await screen.findByRole('dialog', { name: te.title });
    const table = (await within(dialog).findAllByRole('table'))[0] as HTMLElement;
    const rows = await within(table).findAllByRole('row');

    expect(
      within(rows[1] as HTMLElement).getByText(te.orderLine('SAMPLE-PO-0099', 1)),
    ).toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).getByText('130 SAMPLE-EA')).toBeInTheDocument();
    expect(within(dialog).queryByRole('tab')).toBeNull();
    expect(within(dialog).getAllByRole('button', { name: te.actions.link })).toHaveLength(1);
  });

  it('고객사급 · 무상샘플 입하 줄은 이을 발주가 없어 서버에 빼 달라고 부른다(초과입하 · 긴급입하는 남긴다)', async () => {
    const { requests } = renderScreen(
      [excessListRoute([excessFixture()]), listRoute(), ...lookupRoutes()],
      '?po=7101',
    );

    await within(linesPane()).findByText('SAMPLE-ITEM-01');

    const [list] = requestsTo(requests, EXCESS_PATH);
    expect(list?.url.searchParams.get('excludeExceptionTypeCode')).toBe(
      'CUSTOMER_SUPPLY,FREE_SAMPLE',
    );
  });

  it('연결이 막히면(남은 초과분을 넘음) 서버 사유를 배너로 내고 창은 열린 채다', async () => {
    const { user } = renderScreen(
      [
        excessListRoute([excessFixture()]),
        candidatesRoute([candidateFixture()]),
        allocationWriteRoute([], () =>
          jsonResponse(
            {
              errors: [
                {
                  scope: 'field',
                  field: 'qty',
                  code: 'RANGE',
                  message: '받은 수량 중 배정하지 않은 몫을 넘습니다.',
                },
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

    expect(
      await within(dialog).findByText('받은 수량 중 배정하지 않은 몫을 넘습니다.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: te.title })).toBeInTheDocument();
  });
});

describe('InboundScheduleScreen — 입고 진행(LOT 줄 · 단계 칩 · 진행 열)', () => {
  const tg = messages.goodsReceipt;
  /** 왼쪽 표 — 묶음 수를 실은 줄(7101 · 7102)과 싣지 않은 줄(7103 · 7104), 미착수인데 LOT 이 없는 7105. */
  const ROWS_WITH_STAGES = [
    orderSummary({ expectedReceiptDate: TODAY, inboundStageCounts: { INSPECTION: 2, RECEIPT: 1 } }),
    orderSummary({
      purchaseOrderId: 7102,
      purchaseOrderNo: 'SAMPLE-PO-0002',
      expectedReceiptDate: TODAY,
      receiptStatusCode: 'PARTIAL',
      inboundStageCounts: {},
    }),
    orderSummary({
      purchaseOrderId: 7103,
      purchaseOrderNo: 'SAMPLE-PO-0003',
      expectedReceiptDate: TODAY,
    }),
    orderSummary({
      purchaseOrderId: 7105,
      purchaseOrderNo: 'SAMPLE-PO-0005',
      expectedReceiptDate: TODAY,
      inboundStageCounts: {},
    }),
  ];
  const progressRoutes = (
    rows: unknown[] = ROWS_WITH_STAGES,
    bodies: unknown[] = [],
    items: unknown[] = progressFixtures,
    counts: unknown = stageCountsFixture,
  ): StubRoute[] => [
    /* 발주 7101 의 라인 둘 — LOT 다섯이 7301 · 7302 아래로 갈린다. */
    linesRoute([
      scheduleLine({ expectedReceiptDate: TODAY }),
      scheduleLine({
        expectedReceiptDate: TODAY,
        purchaseOrderLineId: 7302,
        lineNo: 2,
        itemId: 8302,
        itemCode: 'SAMPLE-ITEM-02',
        itemName: '합성 품목 나',
      }),
    ]),
    progressRoute(items),
    stageCountsRoute(counts),
    iqcRequestRoute(bodies),
    listRoute(rows),
    ...lookupRoutes(),
  ];
  const lotRow = (lotNo: string): HTMLElement => {
    const row = within(linesPane()).getByText(lotNo).closest('tr');
    if (row === null) throw new Error(`${lotNo} 줄이 없습니다`);

    return row;
  };

  it('서버가 진행 경로를 모르면(404) 라인만 선다 — 단계 칩 · 진행 열 · 다음 할 일 열 · 실패 안내가 없다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()], '?po=7101');

    await screen.findByText('SAMPLE-ITEM-01');

    expect(screen.queryByRole('group', { name: t.stage.label })).toBeNull();
    expect(within(listTable()).queryByRole('columnheader', { name: t.table.progress })).toBeNull();
    expect(within(linesPane()).queryByRole('button', { name: /LOT/ })).toBeNull();
    expect(screen.queryByText(t.lot.loadFailed)).toBeNull();
  });

  it('진행 조회가 다른 이유로 실패하면 라인은 그대로 두고 한 줄로 알린다', async () => {
    renderScreen(
      [failingProgressRoute(500), stageCountsRoute(), listRoute(), ...lookupRoutes()],
      '?po=7101',
    );

    await screen.findByText('SAMPLE-ITEM-01');
    expect(await screen.findByText(t.lot.loadFailed)).toBeInTheDocument();
  });

  it('라인 아래에 그 라인의 LOT 줄이 입하 순서로 서고, 단계 칩 · 근거 · 다음 할 일 · 적치 위치가 보인다', async () => {
    renderScreen(progressRoutes(), '?po=7101');

    await screen.findByText('SAMPLE|LOT|0001');

    const pane = linesPane();
    const rows = within(pane).getAllByRole('row');
    const texts = rows.map((row) => row.textContent ?? '');
    const indexOf = (needle: string): number => texts.findIndex((text) => text.includes(needle));

    /* 라인 1 → 그 LOT 넷(입하 일시 순) → 라인 2 → 그 LOT 하나. */
    expect(indexOf('SAMPLE-ITEM-01')).toBeLessThan(indexOf('SAMPLE|LOT|0004'));
    expect(indexOf('SAMPLE|LOT|0004')).toBeLessThan(indexOf('SAMPLE|LOT|0001'));
    expect(indexOf('SAMPLE|LOT|0001')).toBeLessThan(indexOf('SAMPLE|LOT|0002'));
    expect(indexOf('SAMPLE|LOT|0002')).toBeLessThan(indexOf('SAMPLE|LOT|0003'));
    expect(indexOf('SAMPLE|LOT|0003')).toBeLessThan(indexOf('SAMPLE|LOT|0005'));

    /* 단계 칩 — 서버 코드의 번역. 근거 — 서버가 준 값만. */
    expect(lotRow('SAMPLE|LOT|0002')).toHaveTextContent(t.stage.code.INSPECTION_REQUIRED);
    expect(lotRow('SAMPLE|LOT|0001')).toHaveTextContent(t.stage.code.INSPECTION_REQUESTED);
    expect(lotRow('SAMPLE|LOT|0001')).toHaveTextContent('의뢰 SAMPLE-IQ-0001 · 2026.10.20');
    expect(lotRow('SAMPLE|LOT|0003')).toHaveTextContent(t.stage.code.RECEIPT_READY);
    expect(lotRow('SAMPLE|LOT|0003')).toHaveTextContent(t.lot.evidence.accepted('2026.10.21'));
    expect(lotRow('SAMPLE|LOT|0005')).toHaveTextContent(t.stage.code.INSPECTION_HELD);
    expect(lotRow('SAMPLE|LOT|0005')).toHaveTextContent('합성 보류 사유');
    expect(lotRow('SAMPLE|LOT|0004')).toHaveTextContent(t.stage.code.COMPLETED);
    expect(lotRow('SAMPLE|LOT|0004')).toHaveTextContent('입고 SAMPLE-GR-0001 · 2026.10.19');
    expect(lotRow('SAMPLE|LOT|0004')).toHaveTextContent('SAMPLE-A-01 · 합성 위치 가');
    expect(lotRow('SAMPLE|LOT|0004')).toHaveTextContent(t.lot.receivedOn('2026.10.19'));

    /* 다음 할 일 — 서버가 준 것만 단추다. 검사 화면으로 가는 링크는 없다. */
    expect(
      within(pane).getByRole('button', { name: t.actions.postReceiptRow('SAMPLE|LOT|0003') }),
    ).toBeInTheDocument();
    expect(
      within(pane).getByRole('button', { name: t.actions.requestIqcRow('SAMPLE|LOT|0002') }),
    ).toBeInTheDocument();
    expect(within(pane).getAllByRole('button', { name: /입고 처리|IQC 의뢰 요청/ })).toHaveLength(
      2,
    );
    expect(within(pane).queryByRole('link')).toBeNull();

    /* 발주 머리의 「진행」. */
    expect(
      within(pane).getByText(t.stage.groupCount(t.stage.group.INSPECTION, 2)),
    ).toBeInTheDocument();
  });

  it('라벨 미부착 입하 줄은 「라벨 발행 대기」 · 「라벨 미부착」 · 입하번호 · 「POP에서 라벨 발행」으로 서고 단추가 없다', async () => {
    renderScreen(
      progressRoutes(ROWS_WITH_STAGES, [], [...progressFixtures, labelPendingProgress()], {
        ...stageCountsFixture,
        LABEL: 1,
      }),
      '?po=7101',
    );

    const missing = await within(linesPane()).findByText(t.lot.labelMissing);
    const row = missing.closest('tr');
    if (row === null) throw new Error('라벨 미부착 줄이 없습니다');

    expect(row).toHaveTextContent(t.stage.code.LABEL_PENDING);
    expect(row).toHaveTextContent(t.lot.evidence.receiptNo('SAMPLE-IR-0006'));
    expect(row).toHaveTextContent(t.lot.receivedOn('2026.10.22'));
    expect(row).toHaveTextContent(t.lot.issueLabelOnPop);
    expect(within(row).queryByRole('button')).toBeNull();

    /* 칩 줄 맨 앞에 라벨 발행 대기가 선다. */
    const chips = screen.getByRole('group', { name: t.stage.label });
    expect(within(chips).getAllByRole('button')[0]).toHaveTextContent(
      t.stage.groupCount(t.stage.group.LABEL, 1),
    );
  });

  it('라인의 손잡이는 그 라인의 LOT 만, 머리의 손잡이는 전부를 접고 편다', async () => {
    const { user } = renderScreen(progressRoutes(), '?po=7101');

    await screen.findByText('SAMPLE|LOT|0001');
    const pane = linesPane();

    await user.click(within(pane).getByRole('button', { name: t.actions.collapseLine(1) }));
    expect(within(pane).queryByText('SAMPLE|LOT|0001')).toBeNull();
    expect(within(pane).getByText('SAMPLE|LOT|0005')).toBeInTheDocument();
    expect(within(pane).getByRole('button', { name: t.actions.expandLine(1) })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    await user.click(within(pane).getByRole('button', { name: t.actions.collapseAll }));
    expect(within(pane).queryByText('SAMPLE|LOT|0005')).toBeNull();

    await user.click(within(pane).getByRole('button', { name: t.actions.expandAll }));
    expect(within(pane).getByText('SAMPLE|LOT|0001')).toBeInTheDocument();
    expect(within(pane).getByText('SAMPLE|LOT|0005')).toBeInTheDocument();
  });

  it('라인 표의 머리칸을 누르면 오름 → 내림 → 해제로 정렬되고, LOT 줄은 제 라인을 따라간다', async () => {
    const { user } = renderScreen(progressRoutes(), '?po=7101');

    await screen.findByText('SAMPLE|LOT|0001');
    const pane = linesPane();
    const order = (): string[] =>
      within(pane)
        .getAllByRole('row')
        .map((row) => row.textContent ?? '')
        .flatMap((text) => {
          const hit = /SAMPLE-ITEM-0\d|SAMPLE\|LOT\|000\d/.exec(text);

          return hit === null ? [] : [hit[0]];
        });
    const header = (): HTMLElement =>
      within(pane).getByRole('columnheader', { name: new RegExp(t.table.itemCode) });

    expect(order()[0]).toBe('SAMPLE-ITEM-01');

    await user.click(within(header()).getByRole('button'));
    expect(header()).toHaveAttribute('aria-sort', 'ascending');
    expect(order()[0]).toBe('SAMPLE-ITEM-01');

    await user.click(within(header()).getByRole('button'));
    expect(header()).toHaveAttribute('aria-sort', 'descending');
    /* 라인 2 와 그 LOT 하나가 먼저, 그 뒤 라인 1 과 그 LOT 넷(입하 순 그대로). */
    expect(order()).toEqual([
      'SAMPLE-ITEM-02',
      'SAMPLE|LOT|0005',
      'SAMPLE-ITEM-01',
      'SAMPLE|LOT|0004',
      'SAMPLE|LOT|0001',
      'SAMPLE|LOT|0002',
      'SAMPLE|LOT|0003',
    ]);

    await user.click(within(header()).getByRole('button'));
    expect(header()).not.toHaveAttribute('aria-sort', 'descending');
    expect(order()[0]).toBe('SAMPLE-ITEM-01');
  });

  it('라인 표의 「상태」도 정렬된다 — 입하 흐름 순서(미착수 → 부분 입하 → 입하 완료 → 취소)', async () => {
    const { user } = renderScreen(
      [
        linesRoute([
          scheduleLine({ expectedReceiptDate: TODAY, receiptStatusCode: 'COMPLETED' }),
          scheduleLine({
            expectedReceiptDate: TODAY,
            purchaseOrderLineId: 7302,
            lineNo: 2,
            itemCode: 'SAMPLE-ITEM-02',
            receiptStatusCode: 'NOT_STARTED',
          }),
        ]),
        progressRoute([]),
        stageCountsRoute(),
        listRoute(ROWS_WITH_STAGES),
        ...lookupRoutes(),
      ],
      '?po=7101',
    );

    await screen.findByText('SAMPLE-ITEM-02');
    const pane = linesPane();
    const header = (): HTMLElement =>
      within(pane).getByRole('columnheader', { name: new RegExp(t.table.receiptStatus) });
    const codes = (): string[] =>
      within(pane)
        .getAllByRole('row')
        .flatMap((row) => /SAMPLE-ITEM-0\d/.exec(row.textContent ?? '')?.[0] ?? []);

    expect(codes()).toEqual(['SAMPLE-ITEM-01', 'SAMPLE-ITEM-02']);

    await user.click(within(header()).getByRole('button'));
    expect(header()).toHaveAttribute('aria-sort', 'ascending');
    expect(codes()).toEqual(['SAMPLE-ITEM-02', 'SAMPLE-ITEM-01']);
  });

  it('LOT 줄은 No. ~ 발주 수량 네 칸을 한 칸으로 합쳐 LOT 번호와 근거를 낸다', async () => {
    renderScreen(progressRoutes(), '?po=7101');

    await screen.findByText('SAMPLE|LOT|0001');

    const cells = Array.from(lotRow('SAMPLE|LOT|0001').querySelectorAll('td'));
    const merged = cells.find((cell) => cell.colSpan === 4);

    expect(merged).toHaveTextContent('SAMPLE|LOT|0001');
    expect(merged).toHaveTextContent('의뢰 SAMPLE-IQ-0001 · 2026.10.20');
    expect(cells.filter((cell) => cell.hidden)).toHaveLength(3);
    /* 라인 줄은 합치지 않는다. */
    const lineRow = within(linesPane()).getByText('SAMPLE-ITEM-01').closest('tr');
    expect(
      Array.from(lineRow?.querySelectorAll('td') ?? []).every((cell) => cell.colSpan === 1),
    ).toBe(true);
  });

  it('초과분을 다른 발주에 연결한 입하 줄은 입하 수량 칸에 이 발주 몫을, 근거에 줄 전체를 낸다', async () => {
    const linked = lotProgress({
      lotNo: 'SAMPLE|LOT|0009',
      receivedQty: 1425,
      allocatedQty: 100,
      receivableQty: 1425,
    });
    renderScreen(progressRoutes(ROWS_WITH_STAGES, [], [linked]), '?po=7101');

    await screen.findByText('SAMPLE|LOT|0009');

    const shown = Array.from(lotRow('SAMPLE|LOT|0009').querySelectorAll('td'))
      .filter((cell) => !cell.hidden)
      .map((cell) => cell.textContent);
    expect(shown).toContain('100');
    expect(shown).not.toContain('1,425');
    expect(lotRow('SAMPLE|LOT|0009')).toHaveTextContent(
      t.lot.evidence.wholeQty('1,425', 'SAMPLE-EA'),
    );
  });

  it('막대의 단추로 발주 목록을 왼쪽으로 완전히 접고 펴며, 접힘은 브라우저에 남는다', async () => {
    const { user } = renderScreen(progressRoutes(), '?po=7101');

    await screen.findByText('SAMPLE|LOT|0001');
    const split = (): Element | null => document.querySelector('.po-board-split');

    await user.click(screen.getByRole('button', { name: t.listCollapse }));
    expect(split()).toHaveAttribute('data-left-collapsed', 'true');
    expect(screen.getByRole('button', { name: t.listExpand })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    /* 접은 동안은 끌 것이 없다 — 끌기 막대가 서지 않는다. */
    expect(screen.queryByRole('separator', { name: t.splitter })).toBeNull();
    expect(
      Object.entries(window.localStorage).some(
        ([key, value]) => key.endsWith(':collapsed') && value === '1',
      ),
    ).toBe(true);

    await user.click(screen.getByRole('button', { name: t.listExpand }));
    expect(split()).not.toHaveAttribute('data-left-collapsed');
    expect(screen.getByRole('separator', { name: t.splitter })).toBeInTheDocument();
  });

  it('왼쪽 표에 「진행」 열이 서고 가장 뒤처진 단계 이름만 낸다(수 · 외 N 없음) — LOT 없는 미착수는 「입하 전」, 끝난 것은 「—」', async () => {
    renderScreen(progressRoutes(), '');

    await screen.findByText('SAMPLE-PO-0001');

    expect(
      within(listTable()).getByRole('columnheader', { name: t.table.progress }),
    ).toBeInTheDocument();
    expect(rowOf('SAMPLE-PO-0001')).toHaveTextContent(t.stage.group.INSPECTION);
    expect(rowOf('SAMPLE-PO-0001')).not.toHaveTextContent(
      t.stage.groupCount(t.stage.group.INSPECTION, 2),
    );
    expect(rowOf('SAMPLE-PO-0001')).not.toHaveTextContent('외 1');
    expect(rowOf('SAMPLE-PO-0001')).not.toHaveTextContent(t.stage.group.RECEIPT);
    expect(rowOf('SAMPLE-PO-0005')).toHaveTextContent(t.stage.beforeReceipt);
    expect(rowOf('SAMPLE-PO-0002')).not.toHaveTextContent(t.stage.beforeReceipt);
  });

  it('탭 줄 단계 칩을 누르면 stage 조건이 주소와 목록 요청에 실리고(건수 요청에는 안 실린다) 다시 누르면 풀린다', async () => {
    const { requests, user } = renderScreen(progressRoutes(), '');

    const chips = await screen.findByRole('group', { name: t.stage.label });
    expect(chips).toHaveTextContent(t.stage.groupCount(t.stage.group.RECEIPT, 5));
    expect(chips).toHaveTextContent(t.stage.groupCount(t.stage.group.HELD, 2));
    /* 앞선 서버는 라벨 발행 대기를 세지 않는다 — 그 칩만 빠진다. */
    expect(chips).not.toHaveTextContent(t.stage.group.LABEL);

    await user.click(
      within(chips).getByRole('button', { name: t.stage.filterOn(t.stage.group.RECEIPT) }),
    );

    await waitFor(() => {
      expect(currentLocation()).toContain('stage=RECEIPT');
    });
    await waitFor(() => {
      expect(
        requestsTo(requests, LIST_PATH).some(
          (request) => request.url.searchParams.get('inboundStage') === 'RECEIPT',
        ),
      ).toBe(true);
    });
    expect(
      requestsTo(requests, STAGE_COUNTS_PATH).every(
        (request) => !request.url.searchParams.has('inboundStage'),
      ),
    ).toBe(true);

    await user.click(
      within(chips).getByRole('button', { name: t.stage.filterOff(t.stage.group.RECEIPT) }),
    );
    await waitFor(() => {
      expect(currentLocation()).not.toContain('stage=');
    });
  });

  it('발주 표의 머리칸을 누르면 정렬이 주소와 목록 요청에 실리고(건수 요청에는 안 실린다) 첫 쪽부터 다시 받는다', async () => {
    const { requests, user } = renderScreen(progressRoutes(), '?page=2&po=7101');

    /* 발주번호가 왼쪽 표와 오른쪽 머리에 둘 다 선다. */
    await screen.findAllByText('SAMPLE-PO-0001');
    const header = (): HTMLElement =>
      within(listTable()).getByRole('columnheader', {
        name: new RegExp(t.table.expectedReceiptDate),
      });
    const lastListQuery = (): URLSearchParams | undefined =>
      requestsTo(requests, LIST_PATH).at(-1)?.url.searchParams;

    await user.click(within(header()).getByRole('button'));
    await waitFor(() => {
      expect(currentLocation()).toContain('sort=expectedReceiptDate');
    });
    expect(currentLocation()).toContain('dir=asc');
    expect(currentLocation()).not.toContain('page=');
    /* 고른 발주는 남는다 — 정렬은 결과를 바꾸지 않는다. */
    expect(currentLocation()).toContain('po=7101');
    await waitFor(() => {
      expect(lastListQuery()?.get('sort')).toBe('expectedReceiptDate,asc');
    });
    expect(lastListQuery()?.has('sortDirection')).toBe(false);
    expect(header()).toHaveAttribute('aria-sort', 'ascending');

    await user.click(within(header()).getByRole('button'));
    await waitFor(() => {
      expect(currentLocation()).toContain('dir=desc');
    });
    await waitFor(() => {
      expect(lastListQuery()?.get('sort')).toBe('expectedReceiptDate,desc');
    });

    await user.click(within(header()).getByRole('button'));
    await waitFor(() => {
      expect(currentLocation()).not.toContain('sort=');
    });
    expect(
      requestsTo(requests, STAGE_COUNTS_PATH).every(
        (request) => !request.url.searchParams.has('sort'),
      ),
    ).toBe(true);
  });

  it('「IQC 의뢰 요청」을 누르면 그 LOT 하나의 수입검사 의뢰를 보내고 결과를 표 위에 알린다', async () => {
    const bodies: unknown[] = [];
    const { user } = renderScreen(progressRoutes(ROWS_WITH_STAGES, bodies), '?po=7101');

    await screen.findByText('SAMPLE|LOT|0002');
    await user.click(
      screen.getByRole('button', { name: t.actions.requestIqcRow('SAMPLE|LOT|0002') }),
    );

    await waitFor(() => {
      expect(bodies).toHaveLength(1);
    });
    expect(bodies[0]).toMatchObject({
      inspectionTypeCode: 'IQC',
      targetTypeCode: 'LOT',
      targetId: 7702,
      businessDate: TODAY,
    });
    expect(
      await screen.findByText(t.lot.requested('SAMPLE|LOT|0002', 'SAMPLE-IQ-0099')),
    ).toBeInTheDocument();
  });

  it('「입고 처리」를 누르면 그 LOT 의 창이 주소로 열리고, 취소하면 주소에서 빠진다', async () => {
    const detailRoute: StubRoute = {
      match: (request) => isGet(request, '/logistics/inbound-receipts/7501'),
      respond: () =>
        jsonResponse({
          inboundReceipt: {
            inboundReceiptId: 7501,
            inboundReceiptNo: 'SAMPLE-IR-0001',
            supplierId: 8101,
            plantId: 8201,
            receiptDatetime: '2026-10-21T10:00:00+09:00',
            statusCode: 'CONFIRMED',
          },
          lines: [
            {
              inboundReceiptLineId: 7603,
              inboundReceiptId: 7501,
              lineNo: 1,
              itemId: 8301,
              receivedQty: 20,
              uomId: 8501,
              supplierLotMissing: false,
              inspectionRequired: false,
              statusCode: 'CONFIRMED',
              lotId: 7703,
              supplierLotLabelAttached: true,
              receivableQty: 20,
            },
          ],
        }),
    };
    const emptyListRoute = (pathname: string): StubRoute => ({
      match: (request) => isGet(request, pathname),
      respond: () => jsonResponse(listBody([])),
    });
    const { user } = renderScreen(
      [
        detailRoute,
        emptyListRoute('/mdm/warehouses'),
        emptyListRoute('/mdm/locations'),
        ...progressRoutes(),
        emptyListRoute(CODE_VALUES_PATH),
      ],
      '?po=7101',
    );

    await screen.findByText('SAMPLE|LOT|0003');
    await user.click(
      screen.getByRole('button', { name: t.actions.postReceiptRow('SAMPLE|LOT|0003') }),
    );

    expect(currentLocation()).toContain('post=7703');
    const dialog = await screen.findByRole('dialog', { name: tg.panel.title });
    expect(dialog).toHaveTextContent('SAMPLE|LOT|0003');
    expect(dialog).toHaveTextContent('SAMPLE-PO-0001');
    expect(await within(dialog).findByText('SAMPLE-IR-0001')).toBeInTheDocument();
    /* 검사 화면으로 가는 링크는 창에도 없다. */
    expect(within(dialog).queryByRole('link')).toBeNull();

    await user.click(within(dialog).getByRole('button', { name: messages.common.cancel }));
    await waitFor(() => {
      expect(currentLocation()).not.toContain('post=');
    });
  });

  it('입고 처리 권한(W-01-10)이 없으면 「입고 처리」 단추가 없고 「IQC 의뢰 요청」은 남는다', async () => {
    renderScreen(progressRoutes(), '?po=7101', {
      ...SYNTHETIC_SESSION,
      permissions: ['W-01-09', 'W-01-03'],
    });

    await screen.findByText('SAMPLE|LOT|0003');

    expect(
      screen.queryByRole('button', { name: t.actions.postReceiptRow('SAMPLE|LOT|0003') }),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: t.actions.requestIqcRow('SAMPLE|LOT|0002') }),
    ).toBeInTheDocument();
  });
});
