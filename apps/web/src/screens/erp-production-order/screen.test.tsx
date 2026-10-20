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
import { ErpProductionOrderScreen } from './screen';
import type { ErpProductionOrder } from './types';

const t = messages.erpProductionOrder;
const LIST_PATH = '/planning/production-orders';
const exact = (request: Request, path: string): boolean => new URL(request.url).pathname === path;
const page = (items: unknown[]) => ({ items, page: { page: 1, size: 200, total: items.length } });

/** 지어낸 합성값만 쓴다 — 실제 번호·품목처럼 보이는 값을 넣지 않는다(공개 저장소 경계). */
const order: ErpProductionOrder = {
  productionOrderId: 901,
  productionOrderNo: 'SYN-EWO-901',
  erpOrderNo: 'SYN-EWO-901',
  businessUnitId: 2101,
  plantId: 3101,
  itemId: 7101,
  orderQty: 1200,
  uomId: 8101,
  statusCode: 'UPDATED',
  plannedStartDate: '2026-10-08',
  erpOperationNo: '010',
  erpStorageLocationCode: 'SYN-SL1',
  erpReworkFlag: 'N',
  expandedWorkOrderCount: 0,
  plannedWorkOrderCount: 0,
};

/** 계약 밖 칸이 비면 키가 빠진다(장부 P-67) — 키 없는 행. */
const bareOrder: ErpProductionOrder = {
  productionOrderId: 902,
  productionOrderNo: 'SYN-EWO-902',
  itemId: 7101,
  orderQty: 5,
  uomId: 8101,
  statusCode: 'RECEIVED',
};

const codeValues = (groupCode: string | null): unknown[] => {
  if (groupCode === 'PRODUCTION_ORDER_STATUS') {
    return [
      { codeValueId: 1, code: 'RECEIVED', codeName: '합성 수신', displayOrder: 1, isActive: true },
      { codeValueId: 2, code: 'UPDATED', codeName: '합성 수정됨', displayOrder: 2, isActive: true },
    ];
  }
  if (groupCode === 'SL_TYPE') {
    return [
      { codeValueId: 3, code: 'SYN-SL1', codeName: '합성 창고', displayOrder: 1, isActive: true },
    ];
  }
  return [];
};

const references: StubRoute[] = [
  {
    match: (request) => exact(request, '/mdm/code-values'),
    respond: (request) =>
      jsonResponse(page(codeValues(new URL(request.url).searchParams.get('codeGroupCode')))),
  },
  {
    match: (request) => exact(request, '/mdm/business-units'),
    respond: () =>
      jsonResponse(
        page([
          {
            businessUnitId: 2101,
            legalEntityId: 1,
            businessUnitCode: 'SYN-BU',
            businessUnitName: '합성 사업부',
            isActive: true,
          },
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

const detail: ErpProductionOrder = {
  ...order,
  remarks: '합성 비고',
  lastChange: {
    receivedAt: '2026-10-08T02:00:00.000Z',
    changedFields: [
      { field: 'ORDER_QTY', label: '수량', beforeText: '1000', afterText: '1200', beforeQty: 1000 },
      {
        field: 'PLANNED_START_DATE',
        label: '계획 시작일',
        beforeText: '2026-10-06',
        afterText: '2026-10-08',
        beforeQty: null,
      },
    ],
  },
};

const normalRoutes: StubRoute[] = [
  ...references,
  {
    match: (request) => exact(request, LIST_PATH),
    respond: () =>
      jsonResponse({ items: [order, bareOrder], page: { page: 1, size: 25, total: 2 } }),
  },
  {
    match: (request) => exact(request, `${LIST_PATH}/901`),
    respond: () => jsonResponse(detail),
  },
];

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

const listUrls = (requests: Request[]): URL[] =>
  requests.map((request) => new URL(request.url)).filter((url) => url.pathname === LIST_PATH);

describe('ErpProductionOrderScreen', () => {
  it('주소의 조건을 계약 밖 질의까지 실어 목록을 부르고, 값을 이름으로 풀어 보인다', async () => {
    const { fetch, requests } = recordingFetch(normalRoutes);
    renderWithProviders(<ErpProductionOrderScreen />, {
      fetch,
      route: '/?status=UPDATED&item=7101&from=2026-10-01&to=2026-10-31&q=SYN',
    });

    await screen.findByRole('button', { name: t.actions.select('SYN-EWO-901') });
    const url = listUrls(requests)[0];
    expect(url?.searchParams.get('statusCode')).toBe('UPDATED');
    expect(url?.searchParams.get('itemId')).toBe('7101');
    expect(url?.searchParams.get('plannedStartDateFrom')).toBe('2026-10-01');
    expect(url?.searchParams.get('plannedStartDateTo')).toBe('2026-10-31');
    expect(url?.searchParams.get('q')).toBe('SYN');
    expect(url?.searchParams.has('dueDateFrom')).toBe(false);

    const listPane = screen.getByRole('region', { name: t.panes.list });
    const firstRow = within(listPane)
      .getByRole('button', { name: t.actions.select('SYN-EWO-901') })
      .closest('tr');
    expect(firstRow).not.toBeNull();
    const cells = within(firstRow as HTMLElement);
    expect(await cells.findByText('SYN-ITEM · 합성 품목')).toBeInTheDocument();
    expect(await cells.findByText('1,200 SYN-EA')).toBeInTheDocument();
    expect(cells.getByText('2026-10-08')).toBeInTheDocument();
    expect(cells.getByText('010')).toBeInTheDocument();
    expect(await cells.findByText('SYN-SL1 · 합성 창고')).toBeInTheDocument();
    expect(cells.getByText('아니오')).toBeInTheDocument();
    expect(await cells.findByText('합성 수정됨')).toBeInTheDocument();
    /* ERP W/O 는 납기가 비어 온다 — 늘 빈 열을 세우지 않는다. */
    expect(within(listPane).queryByRole('columnheader', { name: t.fields.dueDate })).toBeNull();
    /* 고르기 전에는 상세도, 상세에만 쓰는 참조도 부르지 않는다. */
    expect(requests.some((r) => new URL(r.url).pathname.startsWith(`${LIST_PATH}/`))).toBe(false);
    expect(requests.some((r) => exact(r, '/mdm/plants'))).toBe(false);
  });

  it('비어 온 칸은 표시 기호로 낸다', async () => {
    const { fetch } = recordingFetch(normalRoutes);
    renderWithProviders(<ErpProductionOrderScreen />, { fetch });

    const button = await screen.findByRole('button', { name: t.actions.select('SYN-EWO-902') });
    const row = within(button.closest('tr') as HTMLElement);
    /* 계획 시작일·공정번호·창고·재작업 넷이 빠진 행. */
    expect(row.getAllByText(t.values.missing)).toHaveLength(4);
  });

  it('번호를 누르면 받은 칸 전부와 마지막 ERP 변경을 보이고, 쓰기·계획으로 가는 길이 없다', async () => {
    const { fetch, requests } = recordingFetch(normalRoutes);
    renderWithProviders(<ErpProductionOrderScreen />, { fetch });
    const user = userEvent.setup();

    expect(screen.getByText(t.readOnlyNote)).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: t.actions.select('SYN-EWO-901') }));

    const pane = await screen.findByRole('region', { name: t.panes.detail });
    expect(await within(pane).findByText('SYN-BU · 합성 사업부')).toBeInTheDocument();
    expect(await within(pane).findByText('SYN-PLANT · 합성 공장')).toBeInTheDocument();
    expect(within(pane).getByText('합성 비고')).toBeInTheDocument();
    expect(within(pane).getByText('1000 → 1200')).toBeInTheDocument();
    /* 계약 enum 밖 변경 항목(장부 P-66)도 버리지 않는다. */
    expect(within(pane).getByText('2026-10-06 → 2026-10-08')).toBeInTheDocument();

    const detailUrl = requests
      .map((request) => new URL(request.url))
      .find((url) => url.pathname === `${LIST_PATH}/901`);
    expect(detailUrl?.searchParams.get('withLastChange')).toBe('true');

    expect(requests.every((request) => request.method === 'GET')).toBe(true);
    expect(screen.queryByRole('button', { name: /저장|수정|삭제|등록|전개|편성/ })).toBeNull();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('조회 조건을 고쳐 조회하면 고른 건을 놓고 새 조건으로 부른다', async () => {
    const { fetch, requests } = recordingFetch(normalRoutes);
    renderWithProviders(<ErpProductionOrderScreen />, { fetch, route: '/?sel=901' });
    const user = userEvent.setup();

    await screen.findByText('합성 비고');
    await user.type(screen.getByLabelText(t.fields.plannedStartFrom), '2026-10-05');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(listUrls(requests).at(-1)?.searchParams.get('plannedStartDateFrom')).toBe(
        '2026-10-05',
      );
    });
    expect(await screen.findByText(t.empty.notSelectedTitle)).toBeInTheDocument();
  });

  it('목록 실패를 빈 결과로 바꾸지 않는다', async () => {
    const { fetch } = recordingFetch([
      ...references,
      {
        match: (request) => exact(request, LIST_PATH),
        respond: () => jsonResponse({ message: 'synthetic failure' }, { status: 500 }),
      },
    ]);
    renderWithProviders(<ErpProductionOrderScreen />, { fetch });

    expect(await screen.findByText(t.listLoadFailedTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.title)).not.toBeInTheDocument();
  });
});
