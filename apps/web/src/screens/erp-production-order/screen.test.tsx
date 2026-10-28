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
    match: (request) => exact(request, LIST_PATH),
    respond: () =>
      jsonResponse({ items: [order, bareOrder], page: { page: 1, size: 25, total: 2 } }),
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

/** 목록에서 그 번호가 든 줄. */
const findRow = async (orderNo: string): Promise<HTMLElement> => {
  const listPane = screen.getByRole('region', { name: t.panes.list });
  const cell = await within(listPane).findByText(orderNo);
  const row = cell.closest('tr');
  expect(row).not.toBeNull();
  return row as HTMLElement;
};

describe('ErpProductionOrderScreen', () => {
  it('주소의 조건을 계약 밖 질의까지 실어 목록을 부르고, 값을 이름으로 풀어 보인다', async () => {
    const { fetch, requests } = recordingFetch(normalRoutes);
    renderWithProviders(<ErpProductionOrderScreen />, {
      fetch,
      route: '/?status=UPDATED&item=7101&from=2026-10-01&to=2026-10-31&q=SYN',
    });

    const cells = within(await findRow('SYN-EWO-901'));
    const url = listUrls(requests)[0];
    expect(url?.searchParams.get('statusCode')).toBe('UPDATED');
    expect(url?.searchParams.get('itemId')).toBe('7101');
    expect(url?.searchParams.get('plannedStartDateFrom')).toBe('2026-10-01');
    expect(url?.searchParams.get('plannedStartDateTo')).toBe('2026-10-31');
    expect(url?.searchParams.get('q')).toBe('SYN');
    expect(url?.searchParams.has('dueDateFrom')).toBe(false);

    expect(await cells.findByText('SYN-ITEM · 합성 품목')).toBeInTheDocument();
    expect(await cells.findByText('1,200 SYN-EA')).toBeInTheDocument();
    expect(cells.getByText('2026-10-08')).toBeInTheDocument();
    expect(cells.getByText('010')).toBeInTheDocument();
    expect(await cells.findByText('SYN-SL1 · 합성 창고')).toBeInTheDocument();
    expect(cells.getByText('아니오')).toBeInTheDocument();
    expect(await cells.findByText('합성 수정됨')).toBeInTheDocument();
    /* ERP W/O 는 납기가 비어 온다 — 늘 빈 열을 세우지 않는다. */
    const listPane = screen.getByRole('region', { name: t.panes.list });
    expect(within(listPane).queryByRole('columnheader', { name: t.fields.dueDate })).toBeNull();
    /* 상세가 없다 — 한 건도, 상세에만 쓰던 참조(사업부·공장)도 부르지 않는다. */
    expect(requests.some((r) => new URL(r.url).pathname.startsWith(`${LIST_PATH}/`))).toBe(false);
    expect(requests.some((r) => exact(r, '/mdm/business-units'))).toBe(false);
    expect(requests.some((r) => exact(r, '/mdm/plants'))).toBe(false);
  });

  it('비어 온 칸은 표시 기호로 낸다', async () => {
    const { fetch } = recordingFetch(normalRoutes);
    renderWithProviders(<ErpProductionOrderScreen />, { fetch });

    const row = within(await findRow('SYN-EWO-902'));
    /* 계획 시작일·공정번호·창고·재작업 넷이 빠진 행. */
    expect(row.getAllByText(t.values.missing)).toHaveLength(4);
  });

  it('상세 구획 없이 목록 한 구획만 서고, 줄을 눌러도 상세를 부르지 않으며, 쓰기·계획으로 가는 길이 없다', async () => {
    const { fetch, requests } = recordingFetch(normalRoutes);
    /* 예전 주소의 고른 건(`sel`)도 읽지 않는다. */
    renderWithProviders(<ErpProductionOrderScreen />, { fetch, route: '/?sel=901' });
    const user = userEvent.setup();

    /* 읽기 전용 안내 문구는 두지 않는다 — 쓰기 조작이 없는 것으로 충분하다. */
    expect(screen.queryByText(/고칠 수 없습니다/)).not.toBeInTheDocument();
    const row = await findRow('SYN-EWO-901');
    await user.click(within(row).getByText('SYN-EWO-901'));

    expect(screen.getByRole('region', { name: t.panes.list })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /상세/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
    /* 고르는 단추도, 고른 줄 표지도 없다. */
    expect(within(row).queryByRole('button')).not.toBeInTheDocument();
    expect(row.querySelector('[aria-current]')).toBeNull();
    expect(requests.some((r) => new URL(r.url).pathname.startsWith(`${LIST_PATH}/`))).toBe(false);

    expect(requests.every((request) => request.method === 'GET')).toBe(true);
    expect(screen.queryByRole('button', { name: /저장|수정|삭제|등록|전개|편성/ })).toBeNull();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('조회 조건을 고쳐 조회하면 새 조건으로 부른다', async () => {
    const { fetch, requests } = recordingFetch(normalRoutes);
    renderWithProviders(<ErpProductionOrderScreen />, { fetch });
    const user = userEvent.setup();

    await findRow('SYN-EWO-901');
    await user.type(screen.getByLabelText(t.fields.plannedStartFrom), '2026-10-05');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(listUrls(requests).at(-1)?.searchParams.get('plannedStartDateFrom')).toBe(
        '2026-10-05',
      );
    });
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
