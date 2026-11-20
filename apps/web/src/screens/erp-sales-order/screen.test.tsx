import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { pickRange } from '../../test/date-picker';
import { ErpSalesOrderScreen } from './screen';

const t = messages.erpSalesOrder;
const exact = (request: Request, path: string): boolean => new URL(request.url).pathname === path;
const page = (items: unknown[]) => ({ items, page: { page: 1, size: 200, total: items.length } });

const order = {
  salesOrderId: 801,
  salesOrderNo: 'SYN-SO-801',
  erpSalesOrderNo: 'SYN-ERP-SO-801',
  customerId: 4101,
  shipToPartnerId: 4102,
  orderDate: '2026-10-02',
  statusCode: 'RECEIVED',
  /* 서버 #737 · 장부 P-67 — 계약에 없는 ERP 원본 칸. 수주 뷰는 값이 없으면 키를 뺀다. */
  erpOrderTypeCode: 'SYN-SOT1',
  erpMovementTypeCode: 'SYN-MOV1',
  erpSalesGroupCode: 'SYN-SG1',
};
const line = {
  salesOrderLineId: 8011,
  lineNo: 1,
  itemId: 7101,
  orderedQty: 120,
  uomId: 8101,
  requestedDeliveryDate: '2026-10-20',
  shippedQty: 20,
  erpStorageLocationCode: 'SYN-SL1',
};

/** 공통코드 — 그룹마다 따로 답한다. 이 화면이 부를 그룹이 아니면 스텁이 던진다. */
const CODE_VALUES: Record<string, { code: string; codeName: string; isActive?: boolean }[]> = {
  /* 서버 장부 P-68 — 시드의 수주 상태. */
  SALES_ORDER_STATUS: [
    { code: 'RECEIVED', codeName: '수신' },
    { code: 'CANCELLED', codeName: '취소' },
  ],
  SO_TYPE: [{ code: 'SYN-SOT1', codeName: '합성 수주유형' }],
  SALE_GROUP: [{ code: 'SYN-SG1', codeName: '합성 영업그룹', isActive: false }],
  SL_TYPE: [{ code: 'SYN-SL1', codeName: '합성 창고' }],
};

const exactCodeValues = (request: Request): boolean => exact(request, '/mdm/code-values');

const references: StubRoute[] = [
  {
    match: exactCodeValues,
    respond: (request) => {
      const group = new URL(request.url).searchParams.get('codeGroupCode') ?? '';
      const values = CODE_VALUES[group];
      if (values === undefined) throw new Error(`스텁에 없는 코드 그룹입니다: ${group}`);
      return jsonResponse(
        page(
          values.map((value, index) => ({
            codeValueId: index + 1,
            displayOrder: index + 1,
            isActive: true,
            ...value,
          })),
        ),
      );
    },
  },
  {
    match: (request) => exact(request, '/mdm/partners'),
    respond: () =>
      jsonResponse(
        page([
          { partnerId: 4101, partnerCode: 'SYN-CUS', partnerName: '합성 고객', isActive: true },
          { partnerId: 4102, partnerCode: 'SYN-SHIP', partnerName: '합성 납품처', isActive: true },
        ]),
      ),
  },
  {
    match: (request) => exact(request, '/mdm/uoms'),
    respond: () =>
      jsonResponse(page([{ uomId: 8101, uomCode: 'SYN-EA', uomName: 'each', isActive: true }])),
  },
  {
    match: (request) => exact(request, '/mdm/items/7101'),
    respond: () =>
      jsonResponse({ item: { itemId: 7101, itemCode: 'SYN-ITEM', itemName: '합성 품목' } }),
  },
];

const normalRoutes: StubRoute[] = [
  ...references,
  {
    match: (request) => exact(request, '/logistics/sales-orders'),
    respond: () => jsonResponse({ items: [order], page: { page: 1, size: 25, total: 1 } }),
  },
  {
    match: (request) => exact(request, '/logistics/sales-orders/801'),
    respond: () => jsonResponse({ ...order, lines: [line] }),
  },
];

/** 라인 표 첫 행의 마지막 두 칸 — 창고 · 취소. 열 이름 「취소」와 표지 「취소」가 겹쳐 글로 찾지 않는다. */
const storageAndCancelCells = (linesPane: HTMLElement): (string | null)[] => {
  const row = within(linesPane).getAllByRole('row')[1] as HTMLElement;
  return within(row)
    .getAllByRole('cell')
    .slice(-2)
    .map((cell) => cell.textContent);
};

const detailValue = (label: string): string | null | undefined =>
  within(screen.getByRole('region', { name: t.panes.detail }))
    .getByText(label)
    .closest('div')
    ?.querySelector('dd')?.textContent;

const recordingFetch = (routes: StubRoute[]): { fetch: StubFetch; requests: Request[] } => {
  const requests: Request[] = [];
  const stub = createStubFetch(routes);
  return {
    requests,
    fetch: async (request) => {
      requests.push(request);
      return stub(request);
    },
  };
};

/** 주소의 조건을 읽는 탐침 — 진행 단추가 주소로 가는지 본다. */
const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
};

const listUrls = (requests: Request[]): URL[] =>
  requests
    .map((request) => new URL(request.url))
    .filter((url) => url.pathname === '/logistics/sales-orders');

describe('ErpSalesOrderScreen', () => {
  it('주소의 조건으로 목록을 부르고, 고른 뒤에만 상세·라인을 이름으로 풀어 보인다', async () => {
    const { fetch, requests } = recordingFetch(normalRoutes);
    renderWithProviders(<ErpSalesOrderScreen />, {
      fetch,
      route: '/?customer=4101&unassigned=1&q=SYN',
    });
    const user = userEvent.setup();

    const select = await screen.findByRole('button', { name: t.actions.select('SYN-SO-801') });
    const listUrl = requests
      .map((request) => new URL(request.url))
      .find((url) => url.pathname === '/logistics/sales-orders');
    expect(listUrl?.searchParams.get('customerId')).toBe('4101');
    expect(listUrl?.searchParams.get('unassignedOnly')).toBe('true');
    expect(listUrl?.searchParams.get('q')).toBe('SYN');
    expect(
      requests.some((r) => new URL(r.url).pathname.startsWith('/logistics/sales-orders/')),
    ).toBe(false);
    const listPane = screen.getByRole('region', { name: t.panes.list });
    expect(await within(listPane).findByText('SYN-CUS · 합성 고객')).toBeInTheDocument();
    /* ERP 원번호·납품처는 수주번호·고객사와 겹쳐 보이지 않는다. */
    expect(within(listPane).queryByText('SYN-ERP-SO-801')).not.toBeInTheDocument();
    expect(within(listPane).queryByText('SYN-SHIP · 합성 납품처')).not.toBeInTheDocument();
    /* 상태·ERP 원본 코드는 공통코드 이름으로(서버 장부 P-67 · P-68). */
    expect(await within(listPane).findByText('수신')).toBeInTheDocument();
    expect(await within(listPane).findByText('합성 수주유형')).toBeInTheDocument();
    expect(await within(listPane).findByText('합성 영업그룹')).toBeInTheDocument();
    const codeGroups = requests
      .map((request) => new URL(request.url))
      .filter((url) => url.pathname === '/mdm/code-values');
    expect(codeGroups.every((url) => url.searchParams.get('includeInactive') === 'true')).toBe(
      true,
    );
    /* 창고는 라인에만 있다 — 고르기 전에는 부르지 않는다. */
    expect(codeGroups.map((url) => url.searchParams.get('codeGroupCode'))).not.toContain('SL_TYPE');

    await user.click(select);
    const linesPane = await screen.findByRole('region', { name: t.panes.lines });
    expect(await within(linesPane).findByText('SYN-ITEM · 합성 품목')).toBeInTheDocument();
    expect(await within(linesPane).findByText('SYN-EA')).toBeInTheDocument();
    /* 잔량 = 수주 120 - 출하 20. */
    expect(within(linesPane).getByText('100')).toBeInTheDocument();
    expect(await within(linesPane).findByText('합성 창고')).toBeInTheDocument();
    /* 취소 칸이 없으면(키 없음) 취소되지 않은 라인. */
    expect(storageAndCancelCells(linesPane)).toEqual(['합성 창고', t.values.missing]);
    expect(detailValue(t.fields.status)).toBe('수신');
    expect(detailValue(t.fields.orderType)).toBe('합성 수주유형');
    expect(detailValue(t.fields.salesGroup)).toBe('합성 영업그룹');
    /* 이동 유형은 코드 그룹이 없어 원본 그대로. */
    expect(detailValue(t.fields.movementType)).toBe('SYN-MOV1');
    const detailPane = screen.getByRole('region', { name: t.panes.detail });
    expect(within(detailPane).queryByText('SYN-ERP-SO-801')).not.toBeInTheDocument();
    expect(within(detailPane).queryByText('SYN-SHIP · 합성 납품처')).not.toBeInTheDocument();

    expect(requests.every((request) => request.method === 'GET')).toBe(true);
    expect(screen.queryByRole('button', { name: /저장|수정|삭제|등록/ })).not.toBeInTheDocument();
    /* 읽기 전용 안내 문구는 두지 않는다 — 수정 컨트롤이 없는 것으로 충분하다. */
    expect(screen.queryByText(/수정할 수 없습니다/)).not.toBeInTheDocument();
  });

  it('진행은 기본 전체라 조건을 싣지 않고, 미완료·완료는 누르는 즉시 다른 조건을 지킨 채 목록 요청과 주소에 싣는다', async () => {
    const { fetch, requests } = recordingFetch(normalRoutes);
    renderWithProviders(
      <>
        <ErpSalesOrderScreen />
        <LocationProbe />
      </>,
      { fetch, route: '/?customer=4101&unassigned=1&page=2' },
    );
    const user = userEvent.setup();

    await screen.findByRole('button', { name: t.actions.select('SYN-SO-801') });
    expect(listUrls(requests)[0]?.searchParams.has('progress')).toBe(false);
    /* 진행은 「조건 더보기」 안에 있다. */
    await user.click(screen.getByRole('button', { name: messages.common.filterMore.open }));
    const group = screen.getByRole('group', { name: t.progress.group });
    const button = (name: string) => within(group).getByRole('button', { name });
    expect(button(t.progress.all)).toHaveAttribute('aria-pressed', 'true');

    await user.click(button(t.progress.open));
    await waitFor(() =>
      expect(listUrls(requests).at(-1)?.searchParams.get('progress')).toBe('OPEN'),
    );
    const open = listUrls(requests).at(-1);
    expect(open?.searchParams.get('customerId')).toBe('4101');
    expect(open?.searchParams.get('unassignedOnly')).toBe('true');
    expect(open?.searchParams.get('page')).toBe('1');
    expect(screen.getByTestId('location')).toHaveTextContent(
      /^\?customer=4101&unassigned=1&progress=open$/,
    );
    expect(button(t.progress.open)).toHaveAttribute('aria-pressed', 'true');

    await user.click(button(t.progress.done));
    await waitFor(() =>
      expect(listUrls(requests).at(-1)?.searchParams.get('progress')).toBe('COMPLETED'),
    );
    expect(screen.getByTestId('location')).toHaveTextContent(/progress=done$/);
  });

  it('진행은 「조건 더보기」에 접혀 있고, 전체가 아니면 칩으로 알리며 × 는 전체로 되돌려 다시 조회한다', async () => {
    const { fetch, requests } = recordingFetch(normalRoutes);
    renderWithProviders(
      <>
        <ErpSalesOrderScreen />
        <LocationProbe />
      </>,
      { fetch, route: '/?q=SYN&progress=done' },
    );
    const user = userEvent.setup();
    const removeProgress = messages.common.filterMore.remove(t.fields.progress);

    await screen.findByRole('button', { name: t.actions.select('SYN-SO-801') });
    expect(screen.queryByRole('group', { name: t.progress.group })).toBeNull();
    expect(screen.getByText(t.filters.chip(t.fields.progress, t.progress.done))).toBeVisible();

    await user.click(screen.getByRole('button', { name: removeProgress }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\?q=SYN$/));
    expect(listUrls(requests).at(-1)?.searchParams.has('progress')).toBe(false);
    expect(screen.queryByRole('button', { name: removeProgress })).toBeNull();
  });

  it('진행 열은 출하 진행을 표지로 보이고, 칸이 없는 응답은 「-」로 보인다', async () => {
    const withProgress = { ...order, shipStatusCode: 'COMPLETED', lineCount: 2, openLineCount: 0 };
    const withoutProgress = { ...order, salesOrderId: 802, salesOrderNo: 'SYN-SO-802' };
    const { fetch } = recordingFetch([
      ...references,
      {
        match: (request) => exact(request, '/logistics/sales-orders'),
        respond: () =>
          jsonResponse({
            items: [withProgress, withoutProgress],
            page: { page: 1, size: 25, total: 2 },
          }),
      },
    ]);
    renderWithProviders(<ErpSalesOrderScreen />, { fetch });

    const listPane = await screen.findByRole('region', { name: t.panes.list });
    expect(
      await within(listPane).findByRole('columnheader', { name: t.fields.progress }),
    ).toBeInTheDocument();
    const rowOf = async (orderNo: string) =>
      (await within(listPane).findByRole('button', { name: t.actions.select(orderNo) })).closest(
        'tr',
      ) as HTMLElement;
    expect(
      within(await rowOf('SYN-SO-801')).getByText(t.progress.status.COMPLETED),
    ).toBeInTheDocument();
    expect(within(await rowOf('SYN-SO-802')).getByText(t.values.missing)).toBeInTheDocument();
  });

  it('상세에 라인이 없으면 빈 라인 안내를 낸다', async () => {
    const { fetch } = recordingFetch([
      ...references,
      {
        match: (request) => exact(request, '/logistics/sales-orders'),
        respond: () => jsonResponse({ items: [order], page: { page: 1, size: 25, total: 1 } }),
      },
      {
        match: (request) => exact(request, '/logistics/sales-orders/801'),
        respond: () => jsonResponse(order),
      },
    ]);
    renderWithProviders(<ErpSalesOrderScreen />, { fetch, route: '/?sel=801' });

    const linesPane = await screen.findByRole('region', { name: t.panes.lines });
    expect(within(linesPane).getByText(t.empty.linesTitle)).toBeInTheDocument();
  });

  it('상태는 「조건 더보기」 안의 공통코드 선택지로 거르고, 주소의 상태를 조건에 싣는다', async () => {
    const { fetch, requests } = recordingFetch(normalRoutes);
    renderWithProviders(<ErpSalesOrderScreen />, { fetch, route: '/?status=RECEIVED' });
    const user = userEvent.setup();

    await screen.findByRole('button', { name: t.actions.select('SYN-SO-801') });
    const listUrls = () =>
      requests
        .map((request) => new URL(request.url))
        .filter((url) => url.pathname === '/logistics/sales-orders');
    expect(listUrls()[0]?.searchParams.get('statusCode')).toBe('RECEIVED');

    /* 상태는 「조건 더보기」에 접혀 있다 — 펼쳐야 칸이 보인다. */
    expect(screen.queryByRole('combobox', { name: t.fields.status })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: messages.common.filterMore.open }));

    /* 글로 적는 칸이 아니라 선택지다. */
    expect(screen.queryByRole('textbox', { name: t.fields.status })).not.toBeInTheDocument();
    const status = screen.getByRole('combobox', { name: t.fields.status });
    await waitFor(() => expect(status).toHaveTextContent('수신'));
    await user.click(status);
    await user.click(await screen.findByRole('option', { name: '취소' }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() =>
      expect(listUrls().at(-1)?.searchParams.get('statusCode')).toBe('CANCELLED'),
    );
  });

  it('접힌 조건(상태 · 미편성만)만 칩으로 알리고, ×는 그 조건만 풀어 다시 조회한다', async () => {
    const { fetch, requests } = recordingFetch(normalRoutes);
    renderWithProviders(
      <>
        <ErpSalesOrderScreen />
        <LocationProbe />
      </>,
      { fetch, route: '/?customer=4101&status=RECEIVED&unassigned=1' },
    );
    const user = userEvent.setup();
    const removeOf = (label: string) =>
      screen.queryByRole('button', { name: messages.common.filterMore.remove(label) });

    await screen.findByRole('button', { name: t.actions.select('SYN-SO-801') });
    /* 코드가 아니라 선택지 이름으로. 보이는 칸(고객사)은 칩으로 겹쳐 적지 않는다. */
    expect(await screen.findByText(t.filters.chip(t.fields.status, '수신'))).toBeVisible();
    expect(removeOf(t.fields.unassignedOnly)).toBeVisible();
    expect(removeOf(t.fields.customer)).toBeNull();
    expect(screen.queryByRole('checkbox', { name: t.fields.unassignedOnly })).toBeNull();

    await user.click(removeOf(t.fields.unassignedOnly) as HTMLElement);

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(/^\?customer=4101&status=RECEIVED$/),
    );
    expect(listUrls(requests).at(-1)?.searchParams.has('unassignedOnly')).toBe(false);
    expect(removeOf(t.fields.unassignedOnly)).toBeNull();
    expect(removeOf(t.fields.status)).toBeVisible();

    /* 펼치면 칸에 값이 보이므로 칩을 거둔다. */
    await user.click(screen.getByRole('button', { name: messages.common.filterMore.open }));
    expect(screen.getByRole('checkbox', { name: t.fields.unassignedOnly })).not.toBeChecked();
    expect(removeOf(t.fields.status)).toBeNull();
  });

  it('수주일은 기간 한 칸이고, 고른 기간을 주소 from · to 와 orderDateFrom · orderDateTo 로 싣는다', async () => {
    const { fetch, requests } = recordingFetch(normalRoutes);
    renderWithProviders(
      <>
        <ErpSalesOrderScreen />
        <LocationProbe />
      </>,
      { fetch },
    );
    const user = userEvent.setup();

    await screen.findByRole('button', { name: t.actions.select('SYN-SO-801') });
    await pickRange(user, screen.getByLabelText(t.fields.orderDate), '2026-10-01', '2026-10-15');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(/^\?from=2026-10-01&to=2026-10-15$/),
    );
    const last = listUrls(requests).at(-1);
    expect(last?.searchParams.get('orderDateFrom')).toBe('2026-10-01');
    expect(last?.searchParams.get('orderDateTo')).toBe('2026-10-15');
  });

  it('초기화는 바뀐 것이 있을 때만 보이고, 누르면 치던 값까지 비운다', async () => {
    const { fetch } = recordingFetch(normalRoutes);
    renderWithProviders(<ErpSalesOrderScreen />, { fetch });
    const user = userEvent.setup();

    await screen.findByRole('button', { name: t.actions.select('SYN-SO-801') });
    expect(screen.queryByRole('button', { name: messages.common.reset })).toBeNull();

    const q = screen.getByRole('searchbox', { name: t.fields.q });
    await user.type(q, 'SYN');
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    /* 주소는 이미 처음 값이라 바뀌지 않는다 — 그래도 치던 값은 비워지고 초기화는 다시 숨는다. */
    expect(q).toHaveValue('');
    expect(screen.queryByRole('button', { name: messages.common.reset })).toBeNull();
  });

  it('이름을 못 찾은 코드는 원본, 없는 칸은 「-」, 취소된 라인은 취소 표지와 시각을 보인다', async () => {
    const { erpOrderTypeCode: _orderType, erpMovementTypeCode: _movement, ...bare } = order;
    const unknown = { ...bare, statusCode: 'SYN-UNKNOWN', erpSalesGroupCode: 'SYN-SG-RETIRED' };
    const { erpStorageLocationCode: _sl, ...bareLine } = line;
    const { fetch } = recordingFetch([
      ...references,
      {
        match: (request) => exact(request, '/logistics/sales-orders'),
        respond: () => jsonResponse({ items: [unknown], page: { page: 1, size: 25, total: 1 } }),
      },
      {
        match: (request) => exact(request, '/logistics/sales-orders/801'),
        respond: () =>
          jsonResponse({
            ...unknown,
            lines: [{ ...bareLine, cancelledAt: '2026-10-10T03:00:00Z' }],
          }),
      },
    ]);
    renderWithProviders(<ErpSalesOrderScreen />, { fetch, route: '/?sel=801' });

    const linesPane = await screen.findByRole('region', { name: t.panes.lines });
    expect(await within(linesPane).findByText(/2026-10-10 10:00/)).toBeInTheDocument();
    /* 창고 없음 「-」 · 취소 표지 + 공장 시각(UTC+7). */
    expect(storageAndCancelCells(linesPane)).toEqual([
      t.values.missing,
      `${t.values.cancelled} 2026-10-10 10:00`,
    ]);
    expect(detailValue(t.fields.orderType)).toBe(t.values.missing);
    expect(detailValue(t.fields.movementType)).toBe(t.values.missing);
    await waitFor(() => expect(detailValue(t.fields.salesGroup)).toBe('SYN-SG-RETIRED'));
    expect(detailValue(t.fields.status)).toBe('SYN-UNKNOWN');
    const listPane = screen.getByRole('region', { name: t.panes.list });
    expect(within(listPane).getByText('SYN-UNKNOWN')).toBeInTheDocument();
  });

  it('목록 실패를 빈 결과로 바꾸지 않는다', async () => {
    const { fetch } = recordingFetch([
      ...references,
      {
        match: (request) => exact(request, '/logistics/sales-orders'),
        respond: () => jsonResponse({ message: 'synthetic failure' }, { status: 500 }),
      },
    ]);
    renderWithProviders(<ErpSalesOrderScreen />, { fetch });

    await waitFor(() => expect(screen.getByText(t.listLoadFailedTitle)).toBeInTheDocument());
    expect(screen.queryByText(t.empty.title)).not.toBeInTheDocument();
  });
});
