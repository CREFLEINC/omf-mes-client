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

describe('ErpPurchaseOrderScreen', () => {
  it('주소의 조건으로 목록을 부르고, 고른 뒤에만 상세·라인을 이름으로 풀어 보인다', async () => {
    const { fetch, requests } = recordingFetch(normalRoutes);
    renderWithProviders(<ErpPurchaseOrderScreen />, {
      fetch,
      route: '/?supplier=4101&status=REGISTERED&open=1&from=2026-10-01',
    });
    const user = userEvent.setup();

    const select = await screen.findByRole('button', { name: t.actions.select('SYN-PO-901') });
    const listUrl = requests
      .map((request) => new URL(request.url))
      .find((url) => url.pathname === '/logistics/purchase-orders');
    expect(listUrl?.searchParams.get('supplierId')).toBe('4101');
    expect(listUrl?.searchParams.get('statusCode')).toBe('REGISTERED');
    expect(listUrl?.searchParams.get('openOnly')).toBe('true');
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

    /* 읽기 전용 — 쓰기 요청이 한 번도 나가지 않고, 수정 단추도 없다. */
    expect(requests.every((request) => request.method === 'GET')).toBe(true);
    expect(screen.queryByRole('button', { name: /저장|수정|삭제|등록/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.actions.integrationSync })).toHaveAttribute(
      'href',
      '/master-data/integration-sync',
    );
  });

  it('주소에 고른 건이 있으면 바로 상세를 연다', async () => {
    const { fetch } = recordingFetch(normalRoutes);
    renderWithProviders(<ErpPurchaseOrderScreen />, { fetch, route: '/?sel=901' });

    const detailPane = await screen.findByRole('region', { name: t.panes.detail });
    expect(await within(detailPane).findByText('SYN-EPO-901')).toBeInTheDocument();
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
