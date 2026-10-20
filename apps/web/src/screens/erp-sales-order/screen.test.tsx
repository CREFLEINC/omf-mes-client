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
    expect(within(listPane).getByText('SYN-SHIP · 합성 납품처')).toBeInTheDocument();
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

    expect(requests.every((request) => request.method === 'GET')).toBe(true);
    expect(screen.queryByRole('button', { name: /저장|수정|삭제|등록/ })).not.toBeInTheDocument();
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

  it('상태는 공통코드 선택지로 거르고, 주소의 상태를 조건에 싣는다', async () => {
    const { fetch, requests } = recordingFetch(normalRoutes);
    renderWithProviders(<ErpSalesOrderScreen />, { fetch, route: '/?status=RECEIVED' });
    const user = userEvent.setup();

    await screen.findByRole('button', { name: t.actions.select('SYN-SO-801') });
    const listUrls = () =>
      requests
        .map((request) => new URL(request.url))
        .filter((url) => url.pathname === '/logistics/sales-orders');
    expect(listUrls()[0]?.searchParams.get('statusCode')).toBe('RECEIVED');

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
