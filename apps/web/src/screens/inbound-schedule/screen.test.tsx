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
import {
  itemDetailFixtures,
  partnerFixtures,
  plantFixtures,
  scheduleFixtures,
  storageLocationFixtures,
  uomFixtures,
} from './fixtures';
import { InboundScheduleScreen } from './screen';

const t = messages.inboundSchedule;

const ROUTE = '/logistics/inbound-schedule';
/** server #749 · 장부 P-78 — 입하 예정 = 아직 다 들어오지 않은 P/O 라인. */
const LIST_PATH = '/logistics/purchase-order-lines';
const PARTNERS_PATH = '/mdm/partners';
const PLANTS_PATH = '/mdm/plants';
const UOMS_PATH = '/mdm/uoms';
const CODE_VALUES_PATH = '/mdm/code-values';
const ITEM_PATH_PREFIX = '/mdm/items/';

/** 참조 목록이 만드는 표시 이름 —「코드 · 이름」이다. 화면이 이 형태로 푼다. */
const SUPPLIER_LABEL = 'SAMPLE-SUP-01 · 합성 공급사 가';
const ITEM_LABEL = 'SAMPLE-ITEM-01 · 합성 품목 가';

/** 「오늘」은 화면이 공장 달력(`plantToday()`)으로 읽는다 — 픽스처도 같은 기준으로 만든다. */
const TODAY = plantToday();
const ROWS = scheduleFixtures(TODAY);

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
const lookupRoutes = (): StubRoute[] => [
  lookupRoute(PARTNERS_PATH, partnerFixtures),
  lookupRoute(PLANTS_PATH, plantFixtures),
  lookupRoute(UOMS_PATH, uomFixtures),
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

const listTable = (): HTMLElement => screen.getByRole('table');

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
  it('조건 없이 P/O 라인 목록 요청이 1회 나가고 쿼리가 비어 있다', async () => {
    const { requests } = renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

    const list = requestsTo(requests, LIST_PATH);

    expect(list).toHaveLength(1);
    expect(list[0]?.url.search).toBe('');
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

  it('경로는 그룹 › 탭 묶음 › 화면이고, 제목 아래·조건 아래에 안내 문장을 두지 않는다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

    expect(screen.getByRole('heading', { name: t.title })).toBeInTheDocument();
    const trail = screen.getByRole('navigation', { name: messages.common.shell.breadcrumb });
    expect(
      within(trail)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining(t.breadcrumbRoot),
      expect.stringContaining(t.breadcrumbHub),
      expect.stringContaining(t.title),
    ]);
    // 사용자 지시(2026-10-20)로 걷어 낸 두 문장이 되살아나지 않게 지킨다.
    expect(screen.queryByText(/납기 순으로 봅니다/)).not.toBeInTheDocument();
    expect(screen.queryByText(/비워 두어도 조회됩니다/)).not.toBeInTheDocument();
  });

  it('조회 조건과 목록은 서로 다른 구획이다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

    const filterPane = screen.getByRole('region', { name: t.panes.filter });
    const listPane = screen.getByRole('region', { name: t.panes.list });
    expect(within(filterPane).getByRole('button', { name: messages.common.search })).toBeVisible();
    expect(within(filterPane).queryByRole('table')).not.toBeInTheDocument();
    expect(within(listPane).getByRole('table')).toBeInTheDocument();
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
      expectedReceiptDateFrom: '2026-10-01',
      expectedReceiptDateTo: '2026-10-31',
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
    await user.type(screen.getByLabelText(t.fields.q), 'SAMPLE-PO-0002');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH)).toHaveLength(2);
    });

    expect(currentLocation()).toContain('q=SAMPLE-PO-0002');
    expect(requestsTo(requests, LIST_PATH)[1]?.url.searchParams.get('q')).toBe('SAMPLE-PO-0002');
  });

  /* 「모아서 적용」 — 표시를 바꾸는 것만으로는 조회가 나가지 않고, 「조회」에서 함께 간다. */
  it('「납기 지난 것만」을 켜고 조회하면 overdueOnly=true 가 실린다', async () => {
    const { requests, user } = renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');
    await user.click(screen.getByRole('checkbox', { name: t.fields.overdueOnly }));

    expect(requestsTo(requests, LIST_PATH)).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(requestsTo(requests, LIST_PATH)).toHaveLength(2);
    });

    expect(currentLocation()).toBe(`${ROUTE}?overdue=1`);
    expect(requestsTo(requests, LIST_PATH)[1]?.url.searchParams.get('overdueOnly')).toBe('true');
  });

  it('「미완료만」을 끄고 조회하면 openOnly=false 가 실린다', async () => {
    const { requests, user } = renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

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

    expect(requestsTo(requests, LIST_PATH)[0]?.url.search).toBe('');
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
    expect(screen.getByRole('checkbox', { name: t.fields.overdueOnly })).not.toBeChecked();
  });
});

describe('InboundScheduleScreen — 표의 칸', () => {
  it('상태가 첫 열이고 공급사·품목은 코드 열과 이름 열로 나뉜다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

    const headers = within(listTable())
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);
    expect(headers).toEqual([
      t.table.receiptStatus,
      t.table.expectedReceiptDate,
      t.table.purchaseOrderNo,
      t.table.lineNo,
      t.table.supplierCode,
      t.table.supplierName,
      t.table.itemCode,
      t.table.itemName,
      t.table.orderedQty,
      t.table.receivedQty,
      t.table.remainingQty,
      t.table.uom,
      t.table.storageLocation,
      t.table.actions,
    ]);
  });

  it('발주번호 칸에는 발주번호만 있다 — ERP 발주번호를 덧붙이지 않는다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

    expect(rowOf('SAMPLE-PO-0001')).not.toHaveTextContent('SAMPLE-ERP-0001');
    expect(cellsOf(rowOf('SAMPLE-PO-0001'))[2]).toBe('SAMPLE-PO-0001');
  });

  it('진행은 미착수·부분 입하·입하 완료로 보인다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

    expect(rowOf('SAMPLE-PO-0001')).toHaveTextContent(t.receiptStatus.NOT_STARTED);
    expect(rowOf('SAMPLE-PO-0002')).toHaveTextContent(t.receiptStatus.PARTIAL);
    expect(rowOf('SAMPLE-PO-0004')).toHaveTextContent(t.receiptStatus.COMPLETED);
  });

  it('수량 셋과 단위가 보인다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

    const cells = within(rowOf('SAMPLE-PO-0002'))
      .getAllByRole('cell')
      .map((cell) => cell.textContent);

    expect(cells).toEqual(expect.arrayContaining(['50', '20', '30']));
    await waitFor(() => {
      expect(rowOf('SAMPLE-PO-0002')).toHaveTextContent('SAMPLE-EA');
    });
  });

  /*
   * **지연 = 남은 수량이 있고 납기가 공장 현지 오늘보다 앞섬**(서버 `overdueOnly` 와 같은 기준).
   * 7301(어제·미착수)만 지연이다 — 7302(오늘)는 당일이라, 7303(어제)은 취소라, 7304는 다 들어와서 아니다.
   */
  it('지연 표식은 납기가 지났고 남은 수량이 있는 라인에만 붙는다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

    expect(within(listTable()).getAllByText(t.values.overdue)).toHaveLength(1);
    // 지연은 첫 열(상태)에 상태 칩과 나란히 붙는다.
    expect(cellsOf(rowOf('SAMPLE-PO-0001'))[0]).toBe(
      `${t.receiptStatus.NOT_STARTED}${t.values.overdue}`,
    );
  });

  it('취소된 라인에는 취소 표식이 붙는다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

    expect(within(listTable()).getAllByText(t.receiptStatus.CANCELLED)).toHaveLength(1);
    expect(rowOf('SAMPLE-PO-0003')).toHaveTextContent(t.receiptStatus.CANCELLED);
  });

  it('납기가 없으면 그렇다고 쓴다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

    expect(rowOf('SAMPLE-PO-0004')).toHaveTextContent(t.values.noDueDate);
  });

  /* 창고는 공통코드 `SL_TYPE` 이름으로 — 없으면 코드를 그대로, 비었으면 대시. */
  it('창고는 이름으로 풀고, 이름이 없으면 코드, 비었으면 대시다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

    await waitFor(() => {
      expect(rowOf('SAMPLE-PO-0001')).toHaveTextContent('합성 자재창고');
    });
    expect(rowOf('SAMPLE-PO-0004')).toHaveTextContent('SAMPLE-SL9');
    expect(rowOf('SAMPLE-PO-0002')).toHaveTextContent(t.values.empty);
  });

  /* 품목은 번호로 하나씩 푼다 — 같은 품목이면 요청도 하나다. */
  it('품목 이름을 이 쪽에 뜬 품목 번호로만 묻는다', async () => {
    const { requests } = renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');
    await waitFor(() => {
      expect(cellsOf(rowOf('SAMPLE-PO-0001')).slice(6, 8)).toEqual([
        'SAMPLE-ITEM-01',
        '합성 품목 가',
      ]);
    });

    const itemPaths = requests
      .map((request) => request.url.pathname)
      .filter((pathname) => pathname.startsWith(ITEM_PATH_PREFIX));

    expect([...itemPaths].sort()).toEqual(['/mdm/items/8301', '/mdm/items/8302']);
    // 없는 품목(404)은 실패가 아니라 「알 수 없음」이다.
    expect(rowOf('SAMPLE-PO-0002')).toHaveTextContent(t.values.unknown);
  });
});

describe('InboundScheduleScreen — 행 바로가기', () => {
  /*
   * 「초과 입하 분리」는 발주를 주소(`po`)로 받는다 — 발주번호로 좁히고 미완료만을 꺼서
   * 그 발주가 목록에 남아 고른 채로 열리게 한다.
   */
  it('「초과 입하 분리」로 그 발주를 고른 채로 간다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

    const link = within(rowOf('SAMPLE-PO-0001')).getByRole('link', {
      name: t.actions.overReceiptSplitRow('SAMPLE-PO-0001'),
    });
    const href = new URL(link.getAttribute('href') ?? '', 'http://app.test');

    expect(href.pathname).toBe('/logistics/over-receipt-split');
    expect(Object.fromEntries(href.searchParams)).toEqual({
      q: 'SAMPLE-PO-0001',
      open: '0',
      po: '7101',
    });
  });

  it('취소된 라인에는 바로가기가 없다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

    expect(within(rowOf('SAMPLE-PO-0003')).queryByRole('link')).not.toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: messages.common.search })).toBeInTheDocument();

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

describe('InboundScheduleScreen — 참조 값', () => {
  it('참조가 오면 공급사·품목이 이름으로 보인다', async () => {
    renderScreen([listRoute(), ...lookupRoutes()]);

    await screen.findByText('SAMPLE-PO-0001');

    await waitFor(() => {
      expect(cellsOf(rowOf('SAMPLE-PO-0001')).slice(4, 6)).toEqual([
        'SAMPLE-SUP-01',
        '합성 공급사 가',
      ]);
    });
    // 7302의 공급사 번호는 참조 목록에 없다.
    expect(rowOf('SAMPLE-PO-0002')).toHaveTextContent(t.values.unknown);
  });

  it('공급사 목록 조회가 실패하면 사유와 다시 시도를 낸다', async () => {
    const { requests, user } = renderScreen([
      listRoute(),
      failingLookupRoute(PARTNERS_PATH),
      lookupRoute(PLANTS_PATH, plantFixtures),
      lookupRoute(UOMS_PATH, uomFixtures),
      storageLocationRoute(),
      itemDetailRoute(),
    ]);

    await screen.findByText(t.reasons.referencesFailed);

    expect(listTable()).toHaveTextContent(t.values.referenceFailed);

    const before = requestsTo(requests, PARTNERS_PATH).length;
    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    await waitFor(() => {
      expect(requestsTo(requests, PARTNERS_PATH).length).toBeGreaterThan(before);
    });
  });

  /* #44 — 이름으로 풀 수 없어도 내부 번호를 내지 않는다. */
  it('참조를 못 푸는 상태에서도 표에 내부 번호가 보이지 않는다', async () => {
    renderScreen([
      listRoute(),
      failingLookupRoute(PARTNERS_PATH),
      failingLookupRoute(PLANTS_PATH),
      failingLookupRoute(UOMS_PATH),
      storageLocationRoute(),
      failingItemDetailRoute(),
    ]);

    await screen.findByText(t.reasons.referencesFailed);

    const text = listTable().textContent ?? '';

    for (const id of ['8101', '8102', '8201', '8301', '8302', '8501', '7101', '7301']) {
      expect(text).not.toContain(id);
    }
  });
});
