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
import { SYNTHETIC_SESSION } from '../../test/session-harness';
import { ErpPurchaseOrderScreen } from './screen';

const t = messages.erpPurchaseOrder;
const exact = (request: Request, path: string): boolean => new URL(request.url).pathname === path;
const page = (items: unknown[]) => ({ items, page: { page: 1, size: 200, total: items.length } });

const header = {
  purchaseOrderId: 901,
  purchaseOrderNo: 'SYN-PO-901',
  erpPurchaseOrderNo: 'SYN-EPO-901',
  supplierId: 4101,
  businessUnitId: 2101,
  plantId: 3101,
  orderDate: '2026-10-01',
  expectedReceiptDate: '2026-10-15',
  statusCode: 'REGISTERED',
  /* 서버 #737 · 장부 P-67 — 계약에 없는 ERP 원본 칸. */
  erpOrderTypeCode: 'SYN-OT1',
  erpPurchaseGroupCode: 'SYN-PG1',
  erpIoTypeCode: 'SYN-IO1',
};
const line = {
  purchaseOrderLineId: 9011,
  purchaseOrderId: 901,
  lineNo: 1,
  itemId: 7101,
  orderedQty: 100,
  uomId: 8101,
  receivedQty: 30,
  toleranceOverQty: 5,
  toleranceUnderQty: 2,
  erpStorageLocationCode: 'SYN-SL1',
  cancelledAt: null,
};

/** 공통코드 — 그룹마다 따로 답한다. 이 화면이 부를 그룹이 아니면 스텁이 던진다. */
const CODE_VALUES: Record<string, { code: string; codeName: string; isActive?: boolean }[]> = {
  LOGISTICS_DOCUMENT_STATUS: [{ code: 'REGISTERED', codeName: '합성 등록' }],
  ORDER_TYPE: [{ code: 'SYN-OT1', codeName: '합성 발주유형' }],
  PUR_GROUP: [{ code: 'SYN-PG1', codeName: '합성 구매그룹' }],
  /* 사용 중지된 코드도 이름으로 풀려야 한다. */
  SL_TYPE: [{ code: 'SYN-SL1', codeName: '합성 창고', isActive: false }],
};

const references: StubRoute[] = [
  {
    match: (request) => exact(request, '/mdm/code-values'),
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
          { partnerId: 4101, partnerCode: 'SYN-SUP', partnerName: '합성 공급사', isActive: true },
        ]),
      ),
  },
  {
    match: (request) => exact(request, '/mdm/plants'),
    respond: () =>
      jsonResponse(
        page([{ plantId: 3101, plantCode: 'SYN-PLANT', plantName: '합성 공장', isActive: true }]),
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
    match: (request) => exact(request, '/logistics/purchase-orders'),
    respond: () => jsonResponse({ items: [header], page: { page: 1, size: 25, total: 1 } }),
  },
  {
    match: (request) => exact(request, '/logistics/purchase-orders/901'),
    respond: () => jsonResponse({ purchaseOrder: header, lines: [line] }),
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
    .filter((url) => url.pathname === '/logistics/purchase-orders');

describe('ErpPurchaseOrderScreen', () => {
  it('주소의 조건으로 목록을 부르고, 고른 뒤에만 상세·라인을 이름으로 풀어 보인다', async () => {
    const { fetch, requests } = recordingFetch(normalRoutes);
    renderWithProviders(<ErpPurchaseOrderScreen />, {
      fetch,
      route: '/?supplier=4101&status=REGISTERED&type=SYN-OT1&open=1&from=2026-10-01',
    });
    const user = userEvent.setup();

    const select = await screen.findByRole('button', { name: t.actions.select('SYN-PO-901') });
    const listUrl = requests
      .map((request) => new URL(request.url))
      .find((url) => url.pathname === '/logistics/purchase-orders');
    expect(listUrl?.searchParams.get('supplierId')).toBe('4101');
    expect(listUrl?.searchParams.get('statusCode')).toBe('REGISTERED');
    /* 발주 유형(주소 `type`) — 서버 조건 `erpOrderTypeCode`, 칸에는 공통코드 이름. */
    expect(listUrl?.searchParams.get('erpOrderTypeCode')).toBe('SYN-OT1');
    expect(await screen.findByRole('combobox', { name: t.fields.orderType })).toHaveTextContent(
      '합성 발주유형',
    );
    /* 예전 주소의 「입하 미완료만」(`open=1`)은 미완료로 읽는다. */
    expect(listUrl?.searchParams.get('openOnly')).toBe('true');
    expect(listUrl?.searchParams.get('progress')).toBe('OPEN');
    const progressGroup = screen.getByRole('group', { name: t.progress.group });
    expect(within(progressGroup).getByRole('button', { name: t.progress.open })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(listUrl?.searchParams.get('orderDateFrom')).toBe('2026-10-01');
    /* 고르기 전에는 상세를 부르지 않는다. */
    expect(
      requests.some((r) => new URL(r.url).pathname.startsWith('/logistics/purchase-orders/')),
    ).toBe(false);
    expect(screen.getByText(t.empty.notSelectedTitle)).toBeInTheDocument();
    /* 번호가 아니라 이름으로 — 공급사·상태 표시명. */
    const listPane = screen.getByRole('region', { name: t.panes.list });
    expect(await within(listPane).findByText('SYN-SUP · 합성 공급사')).toBeInTheDocument();
    expect(await within(listPane).findByText('합성 등록')).toBeInTheDocument();
    /* ERP 발주번호는 P/O 번호와 겹쳐 보이지 않는다. */
    expect(within(listPane).queryByText('SYN-EPO-901')).not.toBeInTheDocument();
    /* ERP 원본 코드는 공통코드 이름으로(서버 #737 · P-67). */
    expect(await within(listPane).findByText('합성 발주유형')).toBeInTheDocument();
    expect(await within(listPane).findByText('합성 구매그룹')).toBeInTheDocument();
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
    /* 잔량 = 발주 100 - 입하 30. */
    expect(within(linesPane).getByText('70')).toBeInTheDocument();
    expect(await within(linesPane).findByText('합성 창고')).toBeInTheDocument();
    expect(storageAndCancelCells(linesPane)).toEqual(['합성 창고', t.values.missing]);
    const detailPane = screen.getByRole('region', { name: t.panes.detail });
    expect(within(detailPane).getByText('합성 발주유형')).toBeInTheDocument();
    expect(within(detailPane).getByText('합성 구매그룹')).toBeInTheDocument();
    /* 입출고 유형은 코드 그룹이 없어 원본 그대로. */
    expect(within(detailPane).getByText('SYN-IO1')).toBeInTheDocument();
    expect(within(detailPane).queryByText('SYN-EPO-901')).not.toBeInTheDocument();

    /* 읽기 전용 — 쓰기 요청이 한 번도 나가지 않고, 수정 단추도 없다. */
    expect(requests.every((request) => request.method === 'GET')).toBe(true);
    expect(screen.queryByRole('button', { name: /저장|수정|삭제|등록/ })).not.toBeInTheDocument();
    /* 읽기 전용 안내 문구는 두지 않는다 — 수정 컨트롤이 없는 것으로 충분하다. */
    expect(screen.queryByText(/수정할 수 없습니다/)).not.toBeInTheDocument();
  });

  it('진행은 기본 전체라 조건을 싣지 않고, 미완료·완료는 누르는 즉시 다른 조건을 지킨 채 목록 요청과 주소에 싣는다', async () => {
    const { fetch, requests } = recordingFetch(normalRoutes);
    renderWithProviders(
      <>
        <ErpPurchaseOrderScreen />
        <LocationProbe />
      </>,
      { fetch, route: '/?supplier=4101&page=2' },
    );
    const user = userEvent.setup();

    await screen.findByRole('button', { name: t.actions.select('SYN-PO-901') });
    const first = listUrls(requests)[0];
    expect(first?.searchParams.has('progress')).toBe(false);
    expect(first?.searchParams.has('openOnly')).toBe(false);
    const group = screen.getByRole('group', { name: t.progress.group });
    const button = (name: string) => within(group).getByRole('button', { name });
    expect(button(t.progress.all)).toHaveAttribute('aria-pressed', 'true');
    expect(button(t.progress.open)).toHaveAttribute('aria-pressed', 'false');

    /* 미완료 — 지금 서버가 아는 `openOnly` 도 함께 싣고, 쪽은 첫 쪽으로 돌린다. */
    await user.click(button(t.progress.open));
    await waitFor(() =>
      expect(listUrls(requests).at(-1)?.searchParams.get('progress')).toBe('OPEN'),
    );
    const open = listUrls(requests).at(-1);
    expect(open?.searchParams.get('openOnly')).toBe('true');
    expect(open?.searchParams.get('supplierId')).toBe('4101');
    expect(open?.searchParams.get('page')).toBe('1');
    expect(screen.getByTestId('location')).toHaveTextContent(/^\?supplier=4101&progress=open$/);
    expect(button(t.progress.open)).toHaveAttribute('aria-pressed', 'true');

    await user.click(button(t.progress.done));
    await waitFor(() =>
      expect(listUrls(requests).at(-1)?.searchParams.get('progress')).toBe('COMPLETED'),
    );
    expect(listUrls(requests).at(-1)?.searchParams.has('openOnly')).toBe(false);
    expect(screen.getByTestId('location')).toHaveTextContent(/^\?supplier=4101&progress=done$/);

    await user.click(button(t.progress.all));
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(/^\?supplier=4101$/),
    );
  });

  it('진행 열은 입하 진행을 표지로 보이고, 칸이 없는 응답은 「-」로 보인다', async () => {
    const withProgress = {
      ...header,
      receiptStatusCode: 'PARTIAL',
      lineCount: 3,
      openLineCount: 1,
    };
    const withoutProgress = { ...header, purchaseOrderId: 902, purchaseOrderNo: 'SYN-PO-902' };
    const { fetch } = recordingFetch([
      ...references,
      {
        match: (request) => exact(request, '/logistics/purchase-orders'),
        respond: () =>
          jsonResponse({
            items: [withProgress, withoutProgress],
            page: { page: 1, size: 25, total: 2 },
          }),
      },
    ]);
    renderWithProviders(<ErpPurchaseOrderScreen />, { fetch });

    const listPane = await screen.findByRole('region', { name: t.panes.list });
    expect(
      await within(listPane).findByRole('columnheader', { name: t.fields.progress }),
    ).toBeInTheDocument();
    const rowOf = async (orderNo: string) =>
      (await within(listPane).findByRole('button', { name: t.actions.select(orderNo) })).closest(
        'tr',
      ) as HTMLElement;
    expect(
      within(await rowOf('SYN-PO-901')).getByText(t.progress.status.PARTIAL),
    ).toBeInTheDocument();
    expect(within(await rowOf('SYN-PO-902')).getByText(t.values.missing)).toBeInTheDocument();
  });

  it('주소에 고른 건이 있으면 바로 상세를 연다', async () => {
    const { fetch } = recordingFetch(normalRoutes);
    renderWithProviders(<ErpPurchaseOrderScreen />, { fetch, route: '/?sel=901' });

    const detailPane = await screen.findByRole('region', { name: t.panes.detail });
    expect(await within(detailPane).findByText('SYN-PO-901')).toBeInTheDocument();
    expect(within(detailPane).queryByText('SYN-EPO-901')).not.toBeInTheDocument();
  });

  it('ERP 칸이 null 이면 「-」, 이름을 못 찾은 코드는 원본, 취소된 라인은 취소 표지와 시각을 보인다', async () => {
    const bare = {
      ...header,
      erpOrderTypeCode: null,
      erpPurchaseGroupCode: 'SYN-PG-RETIRED',
      erpIoTypeCode: null,
    };
    const { fetch } = recordingFetch([
      ...references,
      {
        match: (request) => exact(request, '/logistics/purchase-orders'),
        respond: () => jsonResponse({ items: [bare], page: { page: 1, size: 25, total: 1 } }),
      },
      {
        match: (request) => exact(request, '/logistics/purchase-orders/901'),
        respond: () =>
          jsonResponse({
            purchaseOrder: bare,
            lines: [{ ...line, erpStorageLocationCode: null, cancelledAt: '2026-10-10T03:00:00Z' }],
          }),
      },
    ]);
    renderWithProviders(<ErpPurchaseOrderScreen />, { fetch, route: '/?sel=901' });

    const linesPane = await screen.findByRole('region', { name: t.panes.lines });
    expect(await within(linesPane).findByText(/2026-10-10 10:00/)).toBeInTheDocument();
    /* 창고 없음 「-」 · 취소 표지 + 공장 시각(UTC+7). */
    expect(storageAndCancelCells(linesPane)).toEqual([
      t.values.missing,
      `${t.values.cancelled} 2026-10-10 10:00`,
    ]);
    const detailPane = screen.getByRole('region', { name: t.panes.detail });
    const valueOf = (label: string) =>
      within(detailPane).getByText(label).closest('div')?.querySelector('dd')?.textContent;
    expect(valueOf(t.fields.orderType)).toBe(t.values.missing);
    expect(valueOf(t.fields.ioType)).toBe(t.values.missing);
    await waitFor(() => expect(valueOf(t.fields.purchaseGroup)).toBe('SYN-PG-RETIRED'));
    const listPane = screen.getByRole('region', { name: t.panes.list });
    expect(within(listPane).getByText('SYN-PG-RETIRED')).toBeInTheDocument();
  });

  it('ERP 칸이 없는 응답(#737 이전)도 「-」로 보인다', async () => {
    const {
      erpOrderTypeCode: _orderType,
      erpPurchaseGroupCode: _group,
      erpIoTypeCode: _io,
      ...legacyHeader
    } = header;
    const { erpStorageLocationCode: _sl, cancelledAt: _cancelled, ...legacyLine } = line;
    const { fetch } = recordingFetch([
      ...references,
      {
        match: (request) => exact(request, '/logistics/purchase-orders'),
        respond: () =>
          jsonResponse({ items: [legacyHeader], page: { page: 1, size: 25, total: 1 } }),
      },
      {
        match: (request) => exact(request, '/logistics/purchase-orders/901'),
        respond: () => jsonResponse({ purchaseOrder: legacyHeader, lines: [legacyLine] }),
      },
    ]);
    renderWithProviders(<ErpPurchaseOrderScreen />, { fetch, route: '/?sel=901' });

    const linesPane = await screen.findByRole('region', { name: t.panes.lines });
    expect(await within(linesPane).findByText('SYN-ITEM · 합성 품목')).toBeInTheDocument();
    expect(storageAndCancelCells(linesPane)).toEqual([t.values.missing, t.values.missing]);
    const detailPane = screen.getByRole('region', { name: t.panes.detail });
    expect(
      within(detailPane).getByText(t.fields.orderType).closest('div')?.querySelector('dd')
        ?.textContent,
    ).toBe(t.values.missing);
  });

  it('목록 실패를 빈 결과로 바꾸지 않는다', async () => {
    const { fetch } = recordingFetch([
      ...references,
      {
        match: (request) => exact(request, '/logistics/purchase-orders'),
        respond: () => jsonResponse({ message: 'synthetic failure' }, { status: 500 }),
      },
    ]);
    renderWithProviders(<ErpPurchaseOrderScreen />, { fetch });

    await waitFor(() => expect(screen.getByText(t.listLoadFailedTitle)).toBeInTheDocument());
    expect(screen.queryByText(t.empty.title)).not.toBeInTheDocument();
  });
});

/*
 * 외자 발주 통관번호(omf-all-around#206 · 서버 장부 P-143). 발주 유형 `PO` 일 때만 라인 칸과 단추가 서고, 단추는
 * W-06-10 권한이 있어야 보인다.
 */
describe('ErpPurchaseOrderScreen — 외자 발주 통관번호', () => {
  const FETCH_PATH = '/integration/erp-sync/purchase-orders/901/customs-clearances:fetch';
  const foreign = { ...header, erpOrderTypeCode: 'PO' };
  const lines = [
    { ...line, erpCustomsClearanceNo: 'SYN-CC-01', erpCustomsClearanceSeq: 2 },
    { ...line, purchaseOrderLineId: 9012, lineNo: 2, erpCustomsClearanceNo: null },
    { ...line, purchaseOrderLineId: 9013, lineNo: 3 },
  ];

  const routesFor = (
    order: typeof header,
    fetchRespond: StubRoute['respond'] = () =>
      jsonResponse({
        purchaseOrderId: 901,
        lines: [
          {
            purchaseOrderLineId: 9011,
            lineNo: 1,
            result: 'SAVED',
            customsClearanceNo: 'SYN-CC-01',
            customsClearanceSeq: 2,
            candidates: [],
          },
          {
            purchaseOrderLineId: 9012,
            lineNo: 2,
            result: 'NOT_FOUND',
            customsClearanceNo: null,
            customsClearanceSeq: null,
            candidates: [],
          },
          {
            purchaseOrderLineId: 9013,
            lineNo: 3,
            result: 'MULTIPLE',
            customsClearanceNo: null,
            customsClearanceSeq: null,
            candidates: [
              { customsClearanceNo: 'SYN-CC-01', customsClearanceSeq: 5 },
              { customsClearanceNo: 'SYN-CC-02', customsClearanceSeq: 1 },
            ],
          },
        ],
      }),
  ): StubRoute[] => [
    ...references,
    {
      match: (request) => exact(request, '/logistics/purchase-orders'),
      respond: () => jsonResponse({ items: [order], page: { page: 1, size: 25, total: 1 } }),
    },
    {
      match: (request) => exact(request, '/logistics/purchase-orders/901'),
      respond: () => jsonResponse({ purchaseOrder: order, lines }),
    },
    {
      match: (request) => request.method === 'POST' && exact(request, FETCH_PATH),
      respond: fetchRespond,
    },
  ];

  const render = (routes: StubRoute[], permissions = ['W-06-10', 'W-06-21']) => {
    const recorded = recordingFetch(routes);
    renderWithProviders(<ErpPurchaseOrderScreen />, {
      fetch: recorded.fetch,
      route: '/?sel=901',
      session: { ...SYNTHETIC_SESSION, permissions },
    });
    return { requests: recorded.requests, user: userEvent.setup() };
  };

  it('라인에 통관번호 / 순번 칸을 두고, 받아오면 결과를 알리고 상세를 다시 읽으며 여럿인 라인은 후보를 남긴다', async () => {
    const { requests, user } = render(routesFor(foreign));

    const linesPane = await screen.findByRole('region', { name: t.panes.lines });
    expect(
      await within(linesPane).findByRole('columnheader', { name: t.fields.customsClearance }),
    ).toBeInTheDocument();
    expect(within(linesPane).getByText('SYN-CC-01 / 2')).toBeInTheDocument();
    /* 비었거나 칸이 없는 라인은 「-」. 창고 · 취소는 여전히 마지막 두 칸이다. */
    expect(storageAndCancelCells(linesPane)).toEqual(['합성 창고', t.values.missing]);

    const detailReads = () =>
      requests.filter((request) => exact(request, '/logistics/purchase-orders/901')).length;
    const before = detailReads();
    await user.click(within(linesPane).getByRole('button', { name: t.customs.fetch }));

    expect(
      await screen.findByText('3줄 중 1줄 받음 · 1줄 통관 전 · 1줄 확인 필요'),
    ).toBeInTheDocument();
    const posts = requests.filter((request) => request.method === 'POST');
    expect(posts.map((request) => new URL(request.url).pathname)).toEqual([FETCH_PATH]);
    await waitFor(() => expect(detailReads()).toBeGreaterThan(before));
    expect(screen.getByText(t.customs.multipleTitle)).toBeInTheDocument();
    expect(screen.getByText('라인 3: SYN-CC-01 / 5, SYN-CC-02 / 1')).toBeInTheDocument();
  });

  it('외자가 아니면 칸도 단추도 없다', async () => {
    render(routesFor(header));

    const linesPane = await screen.findByRole('region', { name: t.panes.lines });
    /* 세 라인이 같은 품목이다. */
    expect(await within(linesPane).findAllByText('SYN-ITEM · 합성 품목')).toHaveLength(3);
    expect(
      within(linesPane).queryByRole('columnheader', { name: t.fields.customsClearance }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.customs.fetch })).not.toBeInTheDocument();
  });

  it('W-06-10 권한이 없으면 단추를 숨기고 칸은 보인다', async () => {
    render(routesFor(foreign), ['W-06-21']);

    const linesPane = await screen.findByRole('region', { name: t.panes.lines });
    expect(await within(linesPane).findByText('SYN-CC-01 / 2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.customs.fetch })).not.toBeInTheDocument();
  });

  it('서버가 막으면(STATE_LOCKED) 서버 문구를 그대로 보인다', async () => {
    const { user } = render(
      routesFor(foreign, () =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'screen',
                code: 'STATE_LOCKED',
                message: '합성 — 통관 조회가 설정되지 않았습니다',
              },
            ],
          },
          { status: 400 },
        ),
      ),
    );

    await user.click(await screen.findByRole('button', { name: t.customs.fetch }));

    expect(await screen.findByText(t.customs.fetchFailedTitle)).toBeInTheDocument();
    expect(screen.getByText('합성 — 통관 조회가 설정되지 않았습니다')).toBeInTheDocument();
  });
});
