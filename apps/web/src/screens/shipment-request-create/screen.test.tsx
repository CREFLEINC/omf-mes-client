import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import {
  itemFixtures,
  partnerFixtures,
  salesOrderDetailFixture,
  salesOrderListFixtures,
  uomFixtures,
} from './fixtures';
import { ShipmentRequestCreateScreen } from './screen';

const t = messages.shipmentRequestCreate;

const LIST_PATH = '/logistics/sales-orders';
const DETAIL_PATH = '/logistics/sales-orders/8101';
const PARTNERS_PATH = '/mdm/partners';
const ITEMS_PATH = '/mdm/items';
const UOMS_PATH = '/mdm/uoms';
const BALANCES_PATH = '/inventory/balances';

const ROUTE = '/shipment/shipment-request-create';

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const listBody = (items: unknown[]) => ({
  items,
  page: { page: 1, size: 50, total: items.length },
});

/** 이 화면이 부르는 참조 조회 전부에 응답하는 기본 경로 목록. */
const baseRoutes = (): StubRoute[] => [
  {
    match: (request) => isGet(request, LIST_PATH),
    respond: () => jsonResponse(listBody(salesOrderListFixtures)),
  },
  {
    match: (request) => isGet(request, DETAIL_PATH),
    respond: () => jsonResponse(salesOrderDetailFixture),
  },
  {
    match: (request) => isGet(request, PARTNERS_PATH),
    respond: () => jsonResponse(listBody(partnerFixtures)),
  },
  {
    match: (request) => isGet(request, ITEMS_PATH),
    respond: () => jsonResponse(listBody(itemFixtures)),
  },
  {
    match: (request) => isGet(request, UOMS_PATH),
    respond: () => jsonResponse(listBody(uomFixtures)),
  },
  {
    match: (request) => isGet(request, BALANCES_PATH),
    respond: (request) => {
      const itemId = Number(new URL(request.url).searchParams.get('itemId'));

      return jsonResponse(listBody([{ itemId, availableQty: 60, ownershipTypeCode: 'OWNED' }]));
    },
  },
];

describe('ShipmentRequestCreateScreen — 좌측 목록(완료 조건 C1)', () => {
  it('목록을 불러와 표에 낸다', async () => {
    renderWithProviders(<ShipmentRequestCreateScreen />, {
      fetch: createStubFetch(baseRoutes()),
      route: ROUTE,
    });

    expect(await screen.findByText('SAMPLE-SO-0001')).toBeInTheDocument();
    expect(screen.getByText('SAMPLE-SO-0002')).toBeInTheDocument();
  });

  it('조회를 누르면 조건이 실린 요청을 다시 보낸다', async () => {
    const requests: URL[] = [];
    const routes = baseRoutes();
    const fetch = createStubFetch(
      routes.map((route) => ({
        ...route,
        respond: (request) => {
          if (isGet(request, LIST_PATH)) requests.push(new URL(request.url));

          return route.respond(request);
        },
      })),
    );

    const user = userEvent.setup();

    renderWithProviders(<ShipmentRequestCreateScreen />, { fetch, route: ROUTE });
    await screen.findByText('SAMPLE-SO-0001');

    await user.click(screen.getByRole('checkbox', { name: t.filters.unassignedOnly }));
    await user.click(screen.getByRole('button', { name: t.filters.search }));

    await waitFor(() => {
      expect(requests.some((url) => url.searchParams.get('unassignedOnly') === 'true')).toBe(true);
    });
  });
});

describe('ShipmentRequestCreateScreen — 지시서 경유(완료 조건 C2)', () => {
  it('지시서를 고르면 고객·납품처가 잠기고 잔여 라인이 채워진다', async () => {
    const user = userEvent.setup();

    renderWithProviders(<ShipmentRequestCreateScreen />, {
      fetch: createStubFetch(baseRoutes()),
      route: ROUTE,
    });

    await user.click(
      await screen.findByRole('button', { name: t.table.selectRow('SAMPLE-SO-0001') }),
    );

    const headerPane = await screen.findByRole('region', { name: t.panes.header });
    const linesPane = screen.getByRole('region', { name: t.panes.lines });

    /* 고객·납품처는 값 표기다 — 선택칸이 아니다. */
    expect(within(headerPane).getByText('SAMPLE-CUST-01 · 합성 고객 가')).toBeInTheDocument();
    expect(within(headerPane).getByText('SAMPLE-SHIP-01 · 합성 납품처 가')).toBeInTheDocument();
    expect(within(headerPane).queryByRole('combobox', { name: /고객/ })).not.toBeInTheDocument();

    /* 라인 8602(잔여 0)는 빠지고 8601(잔여 80)만 남는다. */
    expect(within(linesPane).getByText('SAMPLE-ITEM-01 · 합성 품목 가')).toBeInTheDocument();
    expect(within(linesPane).queryByText('SAMPLE-ITEM-02 · 합성 품목 나')).not.toBeInTheDocument();
  });
});

describe('ShipmentRequestCreateScreen — 단독 생성(완료 조건 C3)', () => {
  it('단독 생성을 시작하면 고객·납품처가 선택칸이고 라인을 추가·삭제할 수 있다', async () => {
    const user = userEvent.setup();

    renderWithProviders(<ShipmentRequestCreateScreen />, {
      fetch: createStubFetch(baseRoutes()),
      route: ROUTE,
    });

    await user.click(await screen.findByRole('button', { name: t.actions.startStandalone }));

    const headerPane = await screen.findByRole('region', { name: t.panes.header });

    expect(within(headerPane).getByRole('combobox', { name: /고객/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.removeLine(1) })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: t.actions.addLine }));

    expect(screen.getByRole('button', { name: t.actions.removeLine(1) })).toBeEnabled();
    expect(screen.getByRole('button', { name: t.actions.removeLine(2) })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: t.actions.removeLine(2) }));

    expect(screen.queryByRole('button', { name: t.actions.removeLine(2) })).not.toBeInTheDocument();
  });
});

describe('ShipmentRequestCreateScreen — 배정 수량 검증(완료 조건 C4)', () => {
  it('배정 수량이 요청 수량을 넘으면 인라인 오류로 막힌다', async () => {
    const user = userEvent.setup();

    renderWithProviders(<ShipmentRequestCreateScreen />, {
      fetch: createStubFetch(baseRoutes()),
      route: ROUTE,
    });

    await user.click(await screen.findByRole('button', { name: t.actions.startStandalone }));

    await user.click(screen.getByLabelText(t.lineTable.itemLabel(1)));
    await user.click(await screen.findByRole('option', { name: 'SAMPLE-ITEM-01 · 합성 품목 가' }));

    const requestedInput = screen.getByLabelText(t.lineTable.requestedQtyLabel(1));

    await user.type(requestedInput, '10');

    const allocatedInput = screen.getByLabelText(t.lineTable.allocatedQtyLabel(1));

    await user.type(allocatedInput, '11');

    expect(await screen.findByText(t.errors.allocatedQtyOverRequested(10))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.submit })).toBeDisabled();
  });
});

describe('ShipmentRequestCreateScreen — 고객 LOT 요구 길이 검증', () => {
  it('200자를 넘으면 인라인 오류를 보이고 편성을 막는다', async () => {
    const user = userEvent.setup();

    renderWithProviders(<ShipmentRequestCreateScreen />, {
      fetch: createStubFetch(baseRoutes()),
      route: ROUTE,
    });

    await user.click(
      await screen.findByRole('button', { name: t.table.selectRow('SAMPLE-SO-0001') }),
    );

    const submitButton = screen.getByRole('button', { name: t.actions.submit });

    await user.type(
      screen.getByLabelText(t.lineTable.customerLotRequirementLabel(1)),
      '가'.repeat(201),
    );

    expect(
      await screen.findByText(t.errors.customerLotRequirementTooLong(200)),
    ).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
    expect(
      document.getElementById(submitButton.getAttribute('aria-describedby') ?? ''),
    ).toHaveTextContent(t.actionReasons.lineInvalid);
  });
});

describe('ShipmentRequestCreateScreen — 지시서 가져오기(완료 조건 C7)', () => {
  it('항상 비활성이고 사유가 붙어 있다', async () => {
    renderWithProviders(<ShipmentRequestCreateScreen />, {
      fetch: createStubFetch(baseRoutes()),
      route: ROUTE,
    });

    const importButton = await screen.findByRole('button', { name: t.actions.importOrderFile });

    expect(importButton).toBeDisabled();
    expect(importButton).toHaveAttribute('aria-describedby');

    const describedById = importButton.getAttribute('aria-describedby');

    expect(describedById).not.toBeNull();
    expect(document.getElementById(describedById ?? '')).toHaveTextContent(
      t.actionReasons.importFileNotSupported,
    );
  });
});

describe('ShipmentRequestCreateScreen — 시간대 입력란 없음(완료 조건 C8)', () => {
  it('날짜만 있고 시간 입력칸이 없다', async () => {
    const user = userEvent.setup();

    renderWithProviders(<ShipmentRequestCreateScreen />, {
      fetch: createStubFetch(baseRoutes()),
      route: ROUTE,
    });

    await user.click(await screen.findByRole('button', { name: t.actions.startStandalone }));

    expect(screen.getByLabelText(t.fields.requestedShipDate)).toBeInTheDocument();
    expect(screen.queryByLabelText(/시간/)).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });
});
