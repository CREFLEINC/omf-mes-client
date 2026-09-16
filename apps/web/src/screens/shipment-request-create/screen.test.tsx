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
import { ITEM_SEARCH_MIN_LENGTH } from './lookups';
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

/**
 * **품목 검색**(SHIP-FINAL-01 P6).
 *
 * ⛔ **첫 쪽만으로는 편성이 통째로 막힌다.** 계약이 코드 오름차순으로 쪽을 나눠 주는데 화면이
 *    첫 쪽만 옵션으로 실어, 그 너머의 품목은 고를 방법이 **아예 없었다** — 실측에서 시나리오
 *    제품이 목록에 서지 않아 지시서를 만들 수 없었다. 잘림 안내는 그 사실을 말할 뿐 길을 주지
 *    않는다.
 */
describe('ShipmentRequestCreateScreen — 품목 검색(P6)', () => {
  /** 첫 쪽 밖의 품목. 검색으로만 닿는다. */
  const FAR_ITEM = { itemId: 8399, itemCode: 'SAMPLE-ITEM-99', itemName: '합성 먼 품목', isActive: true };
  const FAR_LABEL = `${FAR_ITEM.itemCode} · ${FAR_ITEM.itemName}`;

  /**
   * 검색어가 있으면 그 결과를, 없으면 첫 쪽을 준다.
   *
   * ⚠ `total` 을 실제 건수보다 크게 두어 **잘림**을 만든다 — 서버가 쪽을 나눴다는 사실이
   *   화면에 그대로 드러나야 한다.
   */
  const itemRoutes = (options: { truncated?: boolean } = {}): StubRoute[] =>
    baseRoutes().map((route) =>
      route === undefined
        ? route
        : {
            ...route,
            respond: (request: Request) => {
              if (!isGet(request, ITEMS_PATH)) return route.respond(request);

              const term = new URL(request.url).searchParams.get('q');
              const items = term === null ? itemFixtures : [FAR_ITEM];

              return jsonResponse({
                items,
                page: {
                  page: 1,
                  size: 50,
                  total: options.truncated === true ? items.length + 7 : items.length,
                },
              });
            },
          },
    );

  const startStandalone = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
    await user.click(await screen.findByRole('button', { name: t.actions.startStandalone }));
    await screen.findByRole('region', { name: t.panes.lines });
  };

  it('검색어를 치면 그 결과로 선택지가 바뀐다', async () => {
    const user = userEvent.setup();

    renderWithProviders(<ShipmentRequestCreateScreen />, {
      fetch: createStubFetch(itemRoutes()),
      route: ROUTE,
    });

    await startStandalone(user);
    await user.type(screen.getByLabelText(t.lineTable.itemSearchLabel(1)), 'ITEM-99');
    await user.click(await screen.findByRole('combobox', { name: t.lineTable.itemLabel(1) }));

    expect(await screen.findByRole('option', { name: FAR_LABEL })).toBeInTheDocument();
    /* 첫 쪽 품목은 이제 후보가 아니다 — 목록이 «바뀌는» 것이지 더해지는 것이 아니다. */
    expect(
      screen.queryByRole('option', { name: 'SAMPLE-ITEM-01 · 합성 품목 가' }),
    ).not.toBeInTheDocument();
  });

  /* ⛔ 「왜 아무 일도 안 일어나는가」를 밝힌다 — 감추면 고장으로 읽는다(공유계약 G-9). */
  it('한 글자로는 검색하지 않고 그 사실을 적는다', async () => {
    const user = userEvent.setup();
    const seen: string[] = [];
    const routes = itemRoutes().map((route) => ({
      ...route,
      respond: (request: Request) => {
        if (isGet(request, ITEMS_PATH)) {
          const term = new URL(request.url).searchParams.get('q');

          if (term !== null) seen.push(term);
        }

        return route.respond(request);
      },
    }));

    renderWithProviders(<ShipmentRequestCreateScreen />, {
      fetch: createStubFetch(routes),
      route: ROUTE,
    });

    await startStandalone(user);
    await user.type(screen.getByLabelText(t.lineTable.itemSearchLabel(1)), 'S');

    expect(
      await screen.findByText(t.lineTable.itemSearchTooShort(ITEM_SEARCH_MIN_LENGTH)),
    ).toBeInTheDocument();
    expect(seen).toEqual([]);
  });

  it('검색 결과도 잘렸으면 그 사실을 그대로 적는다', async () => {
    const user = userEvent.setup();

    renderWithProviders(<ShipmentRequestCreateScreen />, {
      fetch: createStubFetch(itemRoutes({ truncated: true })),
      route: ROUTE,
    });

    await startStandalone(user);
    await user.type(screen.getByLabelText(t.lineTable.itemSearchLabel(1)), 'ITEM-99');

    expect(await screen.findByText(t.filters.lookupTruncated)).toBeInTheDocument();
  });

  /*
   * ⛔ **고른 값이 목록에서 사라지지 않는다.** 검색으로 고른 뒤 검색어를 지우면 선택지는 첫
   *    쪽으로 돌아가는데, 고른 품목이 첫 쪽에 없으면 «값은 남았는데 화면에는 안 고른 것처럼»
   *    보인다 — 그대로 저장하면 담당이 보지 못한 품목이 요청에 실린다(사용자 지시 2026-09-17).
   */
  it('검색으로 고른 뒤 검색어를 지워도 고른 품목이 남는다', async () => {
    const user = userEvent.setup();

    renderWithProviders(<ShipmentRequestCreateScreen />, {
      fetch: createStubFetch(itemRoutes()),
      route: ROUTE,
    });

    await startStandalone(user);

    const search = screen.getByLabelText(t.lineTable.itemSearchLabel(1));
    await user.type(search, 'ITEM-99');
    await user.click(await screen.findByRole('combobox', { name: t.lineTable.itemLabel(1) }));
    await user.click(await screen.findByRole('option', { name: FAR_LABEL }));

    await user.clear(search);

    /* 검색어가 사라져 선택지는 첫 쪽으로 돌아간다 — 첫 쪽 품목이 다시 후보다. */
    await user.click(screen.getByRole('combobox', { name: t.lineTable.itemLabel(1) }));
    expect(
      await screen.findByRole('option', { name: 'SAMPLE-ITEM-01 · 합성 품목 가' }),
    ).toBeInTheDocument();
    /* ⭐ 그런데도 고른 품목은 목록에 남아 있다 — 첫 쪽에 없는 값인데도. */
    expect(screen.getByRole('option', { name: FAR_LABEL })).toBeInTheDocument();
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

    /*
     * 지시서를 고르면 라인이 서버에서 온다 — 클릭이 돌아온 시점에 아직 없다. 동기 조회로
     * 집으면 기계가 밀릴 때만 못 찾아, 화면은 멀쩡한데 시험이 간헐로 깨진다.
     */
    const lotInput = await screen.findByLabelText(t.lineTable.customerLotRequirementLabel(1));
    const submitButton = screen.getByRole('button', { name: t.actions.submit });

    await user.type(lotInput, '가'.repeat(201));

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
