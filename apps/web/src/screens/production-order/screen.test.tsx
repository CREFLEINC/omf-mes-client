import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { ProductionOrderScreen } from './screen';

const t = messages.erpWorkOrderFlow;
const path = (request: Request) => new URL(request.url).pathname;
const page = (items: unknown[]) => ({ items, page: { page: 1, size: 20, total: items.length } });

const order = (id: number, no: string, autoPlan: unknown, expanded = 0) => ({
  productionOrderId: id,
  productionOrderNo: no,
  erpOrderNo: `ERP-${no}`,
  itemId: 7101,
  orderQty: 500,
  uomId: 8101,
  dueDate: '2026-10-31',
  statusCode: 'RECEIVED',
  expandedWorkOrderCount: expanded,
  plannedWorkOrderCount: expanded,
  autoPlan,
});

const REVIEW = order(701, 'SYN-PO-701', {
  status: 'NEEDS_REVIEW',
  reasons: ['BOM_MISSING', 'ROUTING_MISSING'],
});
const DONE_BLOCKED = order(702, 'SYN-PO-702', { status: 'DONE', reasons: [] }, 2);
const DONE_READY = order(703, 'SYN-PO-703', { status: 'DONE', reasons: [] }, 1);

const workOrder = (
  id: number,
  productionOrderId: number,
  line: number | null,
  extra: object = {},
) => ({
  workOrderId: id,
  workOrderNo: `SYN-WO-${String(id)}`,
  productionPlanId: 1,
  routingOperationId: 1,
  itemId: 7101,
  orderQty: 500,
  uomId: 8101,
  workOrderTypeCode: 'NORMAL',
  priorityNo: 100,
  statusCode: 'PLANNED',
  productionOrderId,
  ...(line === null ? {} : { productionLineId: line }),
  ...extra,
});

interface Options {
  orders: unknown[];
  released?: number[];
}

const stub = ({ orders, released = [] }: Options): { fetch: StubFetch; requests: Request[] } => {
  const requests: Request[] = [];
  const pending = [workOrder(9001, 702, null), workOrder(9002, 702, 11), workOrder(9003, 703, 11)];
  const fetch: StubFetch = async (request) => {
    requests.push(request.clone());
    const url = new URL(request.url);
    if (path(request) === '/planning/production-orders') {
      const status = url.searchParams.get('autoPlanStatus');
      const filtered = (orders as { autoPlan: { status: string } | null }[]).filter(
        (item) => status === null || item.autoPlan?.status === status,
      );
      return jsonResponse(page(filtered));
    }
    if (path(request) === '/production/work-orders') {
      const owner = url.searchParams.get('productionOrderId');
      return jsonResponse(
        page(
          pending.filter(
            (item) =>
              !released.includes(item.workOrderId) &&
              (owner === null || String(item.productionOrderId) === owner),
          ),
        ),
      );
    }
    const detail = /^\/production\/work-orders\/(\d+)$/.exec(path(request));
    if (detail !== null && request.method === 'GET') {
      const id = Number(detail[1]);
      const base = pending.find((item) => item.workOrderId === id);
      return jsonResponse(
        id !== 9001
          ? { ...base, defaultWipLocationId: 1, defaultFgLocationId: 2, defaultScrapLocationId: 3 }
          : base,
        { headers: { ETag: '"1"' } },
      );
    }
    if (/:release$/.test(path(request)) && request.method === 'POST') {
      const id = Number(/work-orders\/(\d+):release/.exec(path(request))?.[1]);
      released.push(id);
      return jsonResponse({
        ...pending.find((item) => item.workOrderId === id),
        statusCode: 'RELEASED',
      });
    }
    if (path(request) === '/mdm/items/7101') {
      return jsonResponse({
        item: {
          itemId: 7101,
          itemCode: 'SYN-ITEM',
          itemName: '합성 품목',
          baseUomId: 8101,
          defaultProductionLotSize: 100,
        },
      });
    }
    if (path(request) === '/mdm/uoms') {
      return jsonResponse(page([{ uomId: 8101, uomCode: 'EA', uomName: '개', isActive: true }]));
    }
    if (path(request) === '/mdm/code-values') return jsonResponse(page([]));
    throw new Error(`unexpected request: ${request.method} ${request.url}`);
  };
  return { fetch, requests };
};

const Location = () => {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

const render = (options: Options, route = '/production/production-orders') => {
  const harness = stub(options);
  renderWithProviders(
    <>
      <ProductionOrderScreen />
      <Location />
    </>,
    { fetch: harness.fetch, route },
  );
  return harness;
};

describe('ERP W/O 처리 작업함', () => {
  it('기본 조건은 「확인 필요」이고 사유를 첫 칩과 「외 N」으로 목록에 보인다(C-17)', async () => {
    const { requests } = render({ orders: [REVIEW, DONE_BLOCKED, DONE_READY] });

    const row = await screen.findByRole('link', { name: t.list.openRow('SYN-PO-701') });
    expect(within(row).getByText(t.status.NEEDS_REVIEW)).toBeVisible();
    expect(within(row).getByText(t.reasons.BOM_MISSING)).toBeVisible();
    expect(within(row).getByText(t.reasons.more(1))).toBeVisible();
    expect(screen.queryByText('SYN-PO-702')).toBeNull();
    const list = requests.find(
      (request) =>
        path(request) === '/planning/production-orders' &&
        new URL(request.url).searchParams.get('size') === '20',
    );
    expect(new URL(list?.url ?? 'http://x').searchParams.get('autoPlanStatus')).toBe(
      'NEEDS_REVIEW',
    );
  });

  it('자동 계획 완료 행은 조건과 같은 상태 칩이고, 라인 미정 W/O는 사유 칩 「4M 배정 미완」으로만 보인다(C-17)', async () => {
    render(
      { orders: [REVIEW, DONE_BLOCKED, DONE_READY] },
      '/production/production-orders?autoPlan=DONE',
    );

    const blocked = await screen.findByRole('link', { name: t.list.openRow('SYN-PO-702') });
    await waitFor(() =>
      expect(within(blocked).getByText(t.reasons.ASSIGNMENT_INCOMPLETE)).toBeVisible(),
    );
    expect(within(blocked).getByText(t.status.DONE)).toBeVisible();
    expect(within(blocked).getByText(t.list.pendingWorkOrders(2, 2))).toBeVisible();
    const ready = screen.getByRole('link', { name: t.list.openRow('SYN-PO-703') });
    expect(within(ready).getByText(t.status.DONE)).toBeVisible();
  });

  it('행을 누르면 업무 번호 주소의 처리 화면으로 간다. 체크박스 칸은 이동하지 않는다(C-1, T-W-C)', async () => {
    const user = userEvent.setup();
    render({ orders: [REVIEW] });

    const row = await screen.findByRole('link', { name: t.list.openRow('SYN-PO-701') });
    await user.click(within(row).getByRole('checkbox'));
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/production\/production-orders$/);
    await user.click(within(row).getByText('SYN-PO-701'));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/production/production-orders/SYN-PO-701',
    );
  });

  it('일괄 동작은 체크 전에는 잠기고 사유를 잇는다(C-4)', async () => {
    render({ orders: [REVIEW] });

    await screen.findByRole('link', { name: t.list.openRow('SYN-PO-701') });
    const release = screen.getByRole('button', { name: t.bulk.release });
    expect(release).toBeDisabled();
    expect(release).toHaveAccessibleDescription(t.bulk.reasons.noneChecked);
  });

  it('일괄 배포는 실행과 같은 판정으로 예고하고, 일부 처리를 따로 세며, 결과 칩을 상태 칩 자리에 보인다(C-16, C-18)', async () => {
    const user = userEvent.setup();
    render({ orders: [DONE_BLOCKED, DONE_READY] }, '/production/production-orders?autoPlan=DONE');

    const blocked = await screen.findByRole('link', { name: t.list.openRow('SYN-PO-702') });
    const ready = screen.getByRole('link', { name: t.list.openRow('SYN-PO-703') });
    await waitFor(() =>
      expect(within(blocked).getByText(t.reasons.ASSIGNMENT_INCOMPLETE)).toBeVisible(),
    );
    await user.click(within(blocked).getByRole('checkbox'));
    await user.click(within(ready).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: t.bulk.release }));

    const dialog = screen.getByRole('dialog', { name: t.bulk.releaseDialog.title });
    expect(within(dialog).getByText(t.bulk.releaseDialog.target(2))).toBeVisible();
    expect(
      await within(dialog).findByText(t.bulk.releaseDialog.forecast(1, 1, 0, 2)),
    ).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: t.bulk.releaseDialog.confirm }));

    const result = await screen.findByRole('region', { name: t.bulk.resultTitle.release });
    expect(
      within(result).getByText(
        `${t.bulk.resultTitle.release}: ${messages.screenPatterns.bulkResult.summary(1, 1, 0, 0)}`,
      ),
    ).toBeVisible();
    expect(
      within(result).getByText(messages.screenPatterns.bulkResult.items('W/O', 2, 1)),
    ).toBeVisible();
    expect(
      within(result).getByRole('link', {
        name: messages.screenPatterns.bulkResult.fixFor('SYN-PO-702'),
      }),
    ).toHaveAttribute('href', '/production/production-orders/SYN-PO-702');
    await user.click(
      within(result).getByRole('button', { name: messages.screenPatterns.bulkResult.onlyPartial }),
    );
    const narrowed = await screen.findByRole('link', { name: t.list.openRow('SYN-PO-702') });
    expect(
      within(narrowed).getByText(messages.screenPatterns.bulkResult.outcome.partial),
    ).toBeVisible();
    expect(screen.queryByRole('link', { name: t.list.openRow('SYN-PO-703') })).toBeNull();
  });

  it('모든 대상이 건너뛸 것이면 확인 창의 [배포]를 잠그고 이유를 적는다(C-18)', async () => {
    const user = userEvent.setup();
    render(
      { orders: [DONE_BLOCKED], released: [9002] },
      '/production/production-orders?autoPlan=DONE',
    );

    const blocked = await screen.findByRole('link', { name: t.list.openRow('SYN-PO-702') });
    await user.click(within(blocked).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: t.bulk.release }));
    const dialog = screen.getByRole('dialog', { name: t.bulk.releaseDialog.title });
    await within(dialog).findByText(t.bulk.releaseDialog.forecast(0, 0, 1, 0));
    const confirm = within(dialog).getByRole('button', { name: t.bulk.releaseDialog.confirm });
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAccessibleDescription(t.bulk.releaseDialog.nothing);
  });

  it('배포 대기가 0이면 「배포 완료」로 보이고, 체크박스는 행마다 다른 이름이다(C-1, C-17)', async () => {
    const RELEASED = order(704, 'SYN-PO-704', { status: 'DONE', reasons: [] }, 1);
    render({ orders: [RELEASED] }, '/production/production-orders?autoPlan=DONE');

    const row = await screen.findByRole('link', { name: t.list.openRow('SYN-PO-704') });
    await waitFor(() => expect(within(row).getByText(t.status.RELEASED)).toBeVisible());
    expect(
      within(row).getByRole('checkbox', { name: t.list.checkRow('SYN-PO-704') }),
    ).toBeVisible();
  });

  it('배포 대기 목록이 상한에 걸려 잘리면 목록에 없는 건을 「배포 완료」로 보이지 않고 「확인 불가」로 둔다', async () => {
    const UNKNOWN = order(705, 'SYN-PO-705', { status: 'DONE', reasons: [] }, 1);
    const harness = stub({ orders: [UNKNOWN] });
    const fetch: StubFetch = async (request) =>
      path(request) === '/production/work-orders'
        ? jsonResponse({ items: [], page: { page: 1, size: 200, total: 100000 } })
        : harness.fetch(request);
    renderWithProviders(<ProductionOrderScreen />, {
      fetch,
      route: '/production/production-orders?autoPlan=DONE',
    });

    expect(await screen.findByText(t.list.readinessTruncated)).toBeVisible();
    const row = screen.getByRole('link', { name: t.list.openRow('SYN-PO-705') });
    expect(within(row).getByText(t.list.pendingUnknown)).toBeVisible();
    expect(within(row).queryByText(t.status.RELEASED)).toBeNull();
  });
});
