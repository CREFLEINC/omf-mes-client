import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import {
  heldLotDetailResponse,
  itemFixtures,
  itemViewFixtures,
  locationFixtures,
  locationViewFixtures,
  lotFixtures,
  lotViewFixtures,
  warehouseFixtures,
} from './fixtures';
import { ProductStockStatusScreen } from './screen';

const t = messages.productStockStatus;

const BALANCES_PATH = '/inventory/balances';
const WAREHOUSES_PATH = '/mdm/warehouses';
const LOCATIONS_PATH = '/mdm/locations';
const ITEMS_PATH = '/mdm/items';
const LOTS_PATH = '/trace/lots';
const LOT_DETAIL_PATH = '/trace/lots/9401';

const ROUTE = '/shipment/product-stock-status';
const WITH_WAREHOUSE = '?wh=9101';
const LOT_VIEW = '?wh=9101&view=lot&item=9301';

const WAREHOUSE_LABEL = 'SAMPLE-WH-01 · 합성 자재창고 가';
const ITEM_LABEL = 'SAMPLE-ITEM-01 · 합성 품목 가';

interface RecordedRequest {
  method: string;
  url: URL;
}

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
) => ({
  items,
  page: { page: 1, size: 50, total: items.length, ...page },
});

const balanceRoute = (): StubRoute => ({
  match: (request) => isGet(request, BALANCES_PATH),
  respond: (request) => {
    const groupBy = new URL(request.url).searchParams.get('groupBy');
    const items =
      groupBy === 'LOT'
        ? lotViewFixtures
        : groupBy === 'LOCATION'
          ? locationViewFixtures
          : itemViewFixtures;

    return jsonResponse(listBody(items));
  },
});

const failingBalanceRoute = (status: number): StubRoute => ({
  match: (request) => isGet(request, BALANCES_PATH),
  respond: () => jsonResponse({ message: '' }, { status }),
});

const lookupRoute = (pathname: string, items: unknown[]): StubRoute => ({
  match: (request) => isGet(request, pathname),
  respond: () => jsonResponse(listBody(items)),
});

const lotDetailRoute = (): StubRoute => ({
  match: (request) => isGet(request, LOT_DETAIL_PATH),
  respond: () => jsonResponse(heldLotDetailResponse),
});

const STANDARD_ROUTES: StubRoute[] = [
  balanceRoute(),
  lookupRoute(WAREHOUSES_PATH, warehouseFixtures),
  lookupRoute(ITEMS_PATH, itemFixtures),
  lookupRoute(LOCATIONS_PATH, locationFixtures),
  lookupRoute(LOTS_PATH, lotFixtures),
  lotDetailRoute(),
];

describe('ProductStockStatusScreen', () => {
  it('창고를 고르기 전에는 조회하지 않는다', async () => {
    const { requests, fetch } = createRecordingFetch(STANDARD_ROUTES);
    renderWithProviders(<ProductStockStatusScreen />, { route: ROUTE, fetch });

    expect(screen.getByText(t.empty.notQueriedTitle)).toBeInTheDocument();
    expect(requests.some((request) => request.url.pathname === BALANCES_PATH)).toBe(false);
  });

  it('창고가 있으면 목록을 내려받고 요약은 불러올 수 없음으로 낸다', async () => {
    renderWithProviders(<ProductStockStatusScreen />, {
      route: `${ROUTE}${WITH_WAREHOUSE}`,
      fetch: createStubFetch(STANDARD_ROUTES),
    });

    await waitFor(() => expect(screen.getByText(ITEM_LABEL)).toBeInTheDocument());
    expect(screen.getAllByText(t.summary.unavailableMark)).toHaveLength(5);
    expect(screen.getByText(t.summary.unavailable)).toBeInTheDocument();
  });

  it('묶기를 LOT별로 바꾸면 groupBy=LOT으로 다시 조회한다', async () => {
    const { requests, fetch } = createRecordingFetch(STANDARD_ROUTES);
    const user = userEvent.setup();

    renderWithProviders(<ProductStockStatusScreen />, { route: `${ROUTE}${LOT_VIEW}`, fetch });

    await waitFor(() => expect(screen.getByText('SAMPLE-LOT-0001')).toBeInTheDocument());

    const balanceRequests = requests.filter((request) => request.url.pathname === BALANCES_PATH);
    expect(balanceRequests.at(-1)?.url.searchParams.get('groupBy')).toBe('LOT');
    void user;
  });

  it('품목이 없으면 LOT별 묶기가 품목별로 되돌아간다', async () => {
    renderWithProviders(<ProductStockStatusScreen />, {
      route: `${ROUTE}?wh=9101&view=lot`,
      fetch: createStubFetch(STANDARD_ROUTES),
    });

    await waitFor(() => expect(screen.getByText(ITEM_LABEL)).toBeInTheDocument());
    expect(screen.getByText(t.reasons.lotViewNeedsItem)).toBeInTheDocument();
  });

  it('가용만을 켜고 조회하면 inventoryStatusCode=AVAILABLE로 요청한다', async () => {
    const { requests, fetch } = createRecordingFetch(STANDARD_ROUTES);
    const user = userEvent.setup();

    renderWithProviders(<ProductStockStatusScreen />, {
      route: `${ROUTE}${WITH_WAREHOUSE}`,
      fetch,
    });

    await waitFor(() => expect(screen.getByText(ITEM_LABEL)).toBeInTheDocument());

    await user.click(screen.getByLabelText(t.fields.availableOnly));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      const last = requests.filter((request) => request.url.pathname === BALANCES_PATH).at(-1);
      expect(last?.url.searchParams.get('inventoryStatusCode')).toBe('AVAILABLE');
    });
  });

  it('품목 조건을 고르고 조회하면 itemId로 요청한다', async () => {
    const { requests, fetch } = createRecordingFetch(STANDARD_ROUTES);
    const user = userEvent.setup();

    renderWithProviders(<ProductStockStatusScreen />, {
      route: `${ROUTE}${WITH_WAREHOUSE}`,
      fetch,
    });

    await waitFor(() => expect(screen.getByText(ITEM_LABEL)).toBeInTheDocument());

    await user.click(screen.getByLabelText(t.fields.item));
    await user.click(screen.getByRole('option', { name: ITEM_LABEL }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      const last = requests.filter((request) => request.url.pathname === BALANCES_PATH).at(-1);
      expect(last?.url.searchParams.get('itemId')).toBe('9301');
    });
  });

  it('LOT별 보기에서 행을 고르면 아래 구획에 해제되지 않은 보류와 Lot Status 링크가 열린다', async () => {
    const user = userEvent.setup();

    renderWithProviders(<ProductStockStatusScreen />, {
      route: `${ROUTE}${LOT_VIEW}`,
      fetch: createStubFetch(STANDARD_ROUTES),
    });

    await waitFor(() => expect(screen.getByText('SAMPLE-LOT-0001')).toBeInTheDocument());

    const detailPane = screen.getByRole('region', { name: t.panes.detail });
    expect(within(detailPane).getByText(t.empty.noSelectionTitle)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.selectRow('SAMPLE-LOT-0001') }));

    await waitFor(() =>
      expect(within(detailPane).getByText(t.detail.heading('SAMPLE-LOT-0001'))).toBeInTheDocument(),
    );
    expect(within(detailPane).getByText('SAMPLE_HOLD_R_A')).toBeInTheDocument();

    const link = within(detailPane).getByRole('link', { name: t.actions.lotStatusLink });
    expect(link).toHaveAttribute('href', '/quality/lot-status-transition');
  });

  it('목록 조회가 실패하면 실패 배너를 내고 결과 없음으로 오인시키지 않는다', async () => {
    renderWithProviders(<ProductStockStatusScreen />, {
      route: `${ROUTE}${WITH_WAREHOUSE}`,
      fetch: createStubFetch([
        failingBalanceRoute(500),
        lookupRoute(WAREHOUSES_PATH, warehouseFixtures),
        lookupRoute(ITEMS_PATH, itemFixtures),
        lookupRoute(LOCATIONS_PATH, locationFixtures),
      ]),
    });

    await waitFor(() => expect(screen.getByText(messages.httpError.loadTitle)).toBeInTheDocument());
    expect(screen.queryByText(t.empty.noResultTitle)).not.toBeInTheDocument();
  });

  it('새로고침은 조건을 하나도 바꾸지 않고 같은 조회를 다시 한다', async () => {
    const { requests, fetch } = createRecordingFetch(STANDARD_ROUTES);
    const user = userEvent.setup();

    renderWithProviders(<ProductStockStatusScreen />, {
      route: `${ROUTE}${WITH_WAREHOUSE}`,
      fetch,
    });

    await waitFor(() => expect(screen.getByText(ITEM_LABEL)).toBeInTheDocument());
    const before = requests.filter((request) => request.url.pathname === BALANCES_PATH).length;

    await user.click(screen.getByRole('button', { name: t.actions.refresh }));

    await waitFor(() => {
      const after = requests.filter((request) => request.url.pathname === BALANCES_PATH).length;
      expect(after).toBeGreaterThan(before);
    });
  });
});
