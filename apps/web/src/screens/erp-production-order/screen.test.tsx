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
import { pickDateRange } from '../../test/date-picker';
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
  progressStatusCode: 'PARTIAL',
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
      jsonResponse({ items: [order, bareOrder], page: { page: 1, size: 20, total: 2 } }),
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
  requests
    .map((request) => new URL(request.url))
    .filter((url) => url.pathname === LIST_PATH)
    /* 진행 라벨 건수용 요청(한 줄만 받는다)은 목록 요청이 아니다. */
    .filter((url) => url.searchParams.get('size') !== '1');

/** 주소의 조건을 읽는 탐침 — 진행 단추가 주소로 가는지 본다. */
const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
};

/** 목록에서 그 번호가 든 줄. */
const findRow = async (orderNo: string): Promise<HTMLElement> => {
  const listPane = screen.getByRole('region', { name: t.panes.list });
  const cell = await within(listPane).findByText(orderNo);
  const row = cell.closest('tr');
  expect(row).not.toBeNull();
  return row as HTMLElement;
};

describe('ErpProductionOrderScreen', () => {
  it('주소의 조건을 계약 밖 질의까지 실어 목록을 부르고, 값을 이름으로 풀어 목록 · 상세에 보인다', async () => {
    const { fetch, requests } = recordingFetch(normalRoutes);
    const user = userEvent.setup();
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

    /* 품목코드 · 품목명은 두 열(사용자 지시 2026-11-24). */
    expect((await cells.findAllByText('SYN-ITEM')).length).toBeGreaterThan(0);
    expect(cells.getAllByText('합성 품목').length).toBeGreaterThan(0);
    expect(cells.queryByText('SYN-ITEM · 합성 품목')).toBeNull();
    expect(await cells.findByText('1,200 SYN-EA')).toBeInTheDocument();
    expect(cells.getByText('2026-10-08')).toBeInTheDocument();
    expect(await cells.findByText('합성 수정됨')).toBeInTheDocument();
    /* 공정 번호 · 창고 · 재작업 여부도 목록에서 본다(되살림 · 사용자 지시 2026-11-24). 납기는 이 쪽에 납기가 있는
       행이 있을 때만 열을 세운다. */
    expect(cells.getByText('010')).toBeInTheDocument();
    expect(await cells.findByText('SYN-SL1 · 합성 창고')).toBeInTheDocument();
    expect(cells.getByText('아니오')).toBeInTheDocument();
    const listPane = screen.getByRole('region', { name: t.panes.list });
    expect(within(listPane).queryByRole('columnheader', { name: t.fields.dueDate })).toBeNull();

    await user.click(cells.getByText('SYN-EWO-901'));
    const detail = within(screen.getByRole('region', { name: t.panes.detail }));
    expect(detail.getByText('010')).toBeInTheDocument();
    expect(await detail.findByText('SYN-SL1 · 합성 창고')).toBeInTheDocument();
    expect(detail.getByText('아니오')).toBeInTheDocument();
    expect(detail.getByText('1,200 SYN-EA')).toBeInTheDocument();
    expect(detail.getByText('SYN-ITEM')).toBeInTheDocument();
    expect(detail.getByText('합성 품목')).toBeInTheDocument();
    /* 상세는 목록 응답만 쓴다 — 한 건 요청도, 참조(사업부·공장)도 부르지 않는다. */
    expect(requests.some((r) => new URL(r.url).pathname.startsWith(`${LIST_PATH}/`))).toBe(false);
    expect(requests.some((r) => exact(r, '/mdm/business-units'))).toBe(false);
    expect(requests.some((r) => exact(r, '/mdm/plants'))).toBe(false);
  });

  it('비어 온 칸은 표시 기호로 낸다', async () => {
    const { fetch } = recordingFetch(normalRoutes);
    renderWithProviders(<ErpProductionOrderScreen />, { fetch });
    const user = userEvent.setup();

    const row = await findRow('SYN-EWO-902');
    /* 목록 — 계획 시작일 · 공정 번호 · 창고 · 재작업 여부 · 진행 다섯이 빠진 행. */
    expect(within(row).getAllByText(t.values.missing)).toHaveLength(5);
    /* 상세 — 계획 시작일 · 납기 · 공정번호 · 창고 · 재작업 · 진행 여섯. */
    await user.click(within(row).getByText('SYN-EWO-902'));
    const detail = within(screen.getByRole('region', { name: t.panes.detail }));
    expect(detail.getAllByText(t.values.missing)).toHaveLength(6);
  });

  it('진행 열은 생산 진행을 표지로 보인다', async () => {
    const { fetch } = recordingFetch(normalRoutes);
    renderWithProviders(<ErpProductionOrderScreen />, { fetch });

    const row = within(await findRow('SYN-EWO-901'));
    expect(row.getByText(t.progress.status.PARTIAL)).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: t.panes.list })).getByRole('columnheader', {
        name: t.fields.progress,
      }),
    ).toBeInTheDocument();
  });

  it('진행은 기본 전체라 조건을 싣지 않고, 미완료·완료는 누르는 즉시 다른 조건을 지킨 채 목록 요청과 주소에 싣는다', async () => {
    const { fetch, requests } = recordingFetch(normalRoutes);
    renderWithProviders(
      <>
        <ErpProductionOrderScreen />
        <LocationProbe />
      </>,
      { fetch, route: '/?status=UPDATED&page=2' },
    );
    const user = userEvent.setup();

    await findRow('SYN-EWO-901');
    expect(listUrls(requests)[0]?.searchParams.has('progress')).toBe(false);
    /* 진행은 위 줄 라벨 「미완료 N건 · 완료 N건」이다 — 「전체」 라벨은 없다(사용자 지시 2026-11-24). */
    const group = screen.getByRole('group', { name: t.progress.group });
    const button = (name: string) =>
      within(group).getByRole('button', { name: new RegExp(`^${name}`) });
    expect(within(group).queryByRole('button', { name: t.progress.all })).toBeNull();
    expect(button(t.progress.done)).toHaveAttribute('aria-pressed', 'false');

    await user.click(button(t.progress.done));
    await waitFor(() =>
      expect(listUrls(requests).at(-1)?.searchParams.get('progress')).toBe('COMPLETED'),
    );
    const done = listUrls(requests).at(-1);
    expect(done?.searchParams.get('statusCode')).toBe('UPDATED');
    expect(done?.searchParams.get('page')).toBe('1');
    expect(screen.getByTestId('location')).toHaveTextContent(/^\?status=UPDATED&progress=done$/);
    expect(button(t.progress.done)).toHaveAttribute('aria-pressed', 'true');

    await user.click(button(t.progress.open));
    await waitFor(() =>
      expect(listUrls(requests).at(-1)?.searchParams.get('progress')).toBe('OPEN'),
    );
    expect(screen.getByTestId('location')).toHaveTextContent(/progress=open$/);
  });

  it('진행은 위 줄 라벨로 고르고, 고른 라벨을 다시 누르면 진행 조건을 풀어 다시 조회한다', async () => {
    const { fetch, requests } = recordingFetch(normalRoutes);
    renderWithProviders(
      <>
        <ErpProductionOrderScreen />
        <LocationProbe />
      </>,
      { fetch, route: '/?q=SYN&progress=done' },
    );
    const user = userEvent.setup();

    await findRow('SYN-EWO-901');
    const group = screen.getByRole('group', { name: t.progress.group });
    expect(within(group).getByRole('button', { name: /^완료/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    /* 위 줄 라벨이 보여 주므로 「조건 더보기」 칩으로 다시 알리지 않는다. */
    expect(screen.queryByText(t.filters.chip(t.fields.progress, t.progress.done))).toBeNull();

    await user.click(within(group).getByRole('button', { name: /^완료/ }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\?q=SYN$/));
    expect(listUrls(requests).at(-1)?.searchParams.has('progress')).toBe(false);
  });

  /* 사용자 지시 2026-11-24 — 진행 라벨에 같은 조건의 미완료 · 완료 건수를 싣고, 0건 라벨은 감춘다. */
  it('진행 라벨은 같은 조건의 미완료 · 완료 건수를 보이고 0건 라벨은 감춘다', async () => {
    const routes: StubRoute[] = [
      ...references,
      {
        match: (request) => exact(request, LIST_PATH),
        respond: (request) => {
          const progress = new URL(request.url).searchParams.get('progress');
          const total = progress === 'OPEN' ? 0 : progress === 'COMPLETED' ? 4 : 4;
          return jsonResponse({ items: [order], page: { page: 1, size: 20, total } });
        },
      },
    ];
    const { fetch, requests } = recordingFetch(routes);
    renderWithProviders(<ErpProductionOrderScreen />, { fetch, route: '/?status=UPDATED' });

    const group = await screen.findByRole('group', { name: t.progress.group });
    expect(await within(group).findByRole('button', { name: '완료 4' })).toBeInTheDocument();
    expect(within(group).queryByRole('button', { name: /^미완료/ })).toBeNull();
    /* 건수 요청도 지금 조건(상태)을 지킨다. */
    const counts = requests
      .map((request) => new URL(request.url))
      .filter((url) => url.searchParams.get('size') === '1');
    expect(counts.map((url) => url.searchParams.get('progress')).sort()).toEqual([
      'COMPLETED',
      'OPEN',
    ]);
    expect(counts.every((url) => url.searchParams.get('statusCode') === 'UPDATED')).toBe(true);
  });

  it('줄을 누르면 상세 상자에 그 W/O 를 내되 상세 요청을 따로 보내지 않고, 쓰기·계획으로 가는 길이 없다', async () => {
    const { fetch, requests } = recordingFetch(normalRoutes);
    /* 예전 주소의 고른 건(`sel`)도 읽지 않는다. */
    renderWithProviders(<ErpProductionOrderScreen />, { fetch, route: '/?sel=901' });
    const user = userEvent.setup();

    /* 읽기 전용 안내 문구는 두지 않는다 — 쓰기 조작이 없는 것으로 충분하다. */
    expect(screen.queryByText(/고칠 수 없습니다/)).not.toBeInTheDocument();
    const row = await findRow('SYN-EWO-901');
    const detail = screen.getByRole('region', { name: t.panes.detail });
    expect(within(detail).getByText(t.empty.pickTitle)).toBeInTheDocument();

    await user.click(within(row).getByText('SYN-EWO-901'));
    expect(within(row).getByRole('button', { name: 'SYN-EWO-901' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(within(detail).getByText('SYN-EWO-901')).toBeInTheDocument();
    expect(requests.some((r) => new URL(r.url).pathname.startsWith(`${LIST_PATH}/`))).toBe(false);

    expect(requests.every((request) => request.method === 'GET')).toBe(true);
    expect(screen.queryByRole('button', { name: /저장|수정|삭제|등록|전개|편성/ })).toBeNull();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('고른 줄을 다시 누르면 선택이 풀린다(사용자 지시 2026-11-24)', async () => {
    const { fetch } = recordingFetch(normalRoutes);
    renderWithProviders(<ErpProductionOrderScreen />, { fetch });
    const user = userEvent.setup();

    const row = await findRow('SYN-EWO-901');
    const detail = screen.getByRole('region', { name: t.panes.detail });
    await user.click(within(row).getByText('SYN-EWO-901'));
    expect(within(detail).queryByText(t.empty.pickTitle)).not.toBeInTheDocument();
    await user.click(within(row).getByText('SYN-EWO-901'));

    expect(within(detail).getByText(t.empty.pickTitle)).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'SYN-EWO-901' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('조회 조건을 고쳐 조회하면 새 조건으로 부른다 — 초기화는 바뀐 것이 생겨야 나타난다', async () => {
    const { fetch, requests } = recordingFetch(normalRoutes);
    renderWithProviders(<ErpProductionOrderScreen />, { fetch });
    const user = userEvent.setup();

    await findRow('SYN-EWO-901');
    expect(screen.queryByRole('button', { name: messages.common.reset })).toBeNull();

    /* 계획 시작일은 시작 · 끝 두 칸이다 — 칸마다 달력에서 고른다. */
    await pickDateRange(
      user,
      screen.getByLabelText(t.filters.plannedStartDateFrom),
      screen.getByLabelText(t.filters.plannedStartDateTo),
      '2026-10-05',
      '2026-10-09',
    );
    expect(screen.getByRole('button', { name: messages.common.reset })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    await waitFor(() => {
      expect(listUrls(requests).at(-1)?.searchParams.get('plannedStartDateFrom')).toBe(
        '2026-10-05',
      );
      expect(listUrls(requests).at(-1)?.searchParams.get('plannedStartDateTo')).toBe('2026-10-09');
    });
  });

  it('상태는 「조건 더보기」에 접혀 있고, 걸린 상태는 이름 칩으로 알리며 ×가 상태만 풀어 다시 조회한다', async () => {
    const { fetch, requests } = recordingFetch(normalRoutes);
    renderWithProviders(
      <>
        <ErpProductionOrderScreen />
        <LocationProbe />
      </>,
      { fetch, route: '/?q=SYN&status=UPDATED' },
    );
    const user = userEvent.setup();
    const removeStatus = messages.common.filterMore.remove(t.fields.status);

    await findRow('SYN-EWO-901');
    expect(screen.queryByRole('combobox', { name: t.filters.statusSelect })).toBeNull();
    /* 코드가 아니라 선택지 이름으로. 보이는 칸(ERP W/O 번호)은 칩으로 겹쳐 적지 않는다. */
    expect(await screen.findByText(t.filters.chip(t.fields.status, '합성 수정됨'))).toBeVisible();
    expect(screen.queryByText(t.filters.chip(t.fields.q, 'SYN'))).toBeNull();

    /* 펼치면 칸에 값이 보이므로 칩을 거둔다. */
    const more = screen.getByRole('button', { name: messages.common.filterMore.open });
    await user.click(more);
    expect(screen.getByRole('combobox', { name: t.filters.statusSelect })).toHaveTextContent(
      '합성 수정됨',
    );
    expect(screen.queryByRole('button', { name: removeStatus })).toBeNull();

    await user.click(screen.getByRole('button', { name: messages.common.filterMore.close }));
    await user.click(screen.getByRole('button', { name: removeStatus }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\?q=SYN$/));
    expect(listUrls(requests).at(-1)?.searchParams.has('statusCode')).toBe(false);
    expect(listUrls(requests).at(-1)?.searchParams.get('q')).toBe('SYN');
    expect(screen.queryByRole('button', { name: removeStatus })).toBeNull();
  });

  it('쪽 크기는 처음 20 을 싣고, 주소에 고른 크기가 있으면 그 크기를 서버에 그대로 싣는다', async () => {
    const first = recordingFetch(normalRoutes);
    const { unmount } = renderWithProviders(<ErpProductionOrderScreen />, { fetch: first.fetch });
    await findRow('SYN-EWO-901');
    expect(listUrls(first.requests)[0]?.searchParams.get('size')).toBe('20');
    unmount();

    const chosen = recordingFetch(normalRoutes);
    renderWithProviders(<ErpProductionOrderScreen />, { fetch: chosen.fetch, route: '/?size=50' });
    await findRow('SYN-EWO-901');
    expect(listUrls(chosen.requests)[0]?.searchParams.get('size')).toBe('50');
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
