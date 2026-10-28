import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { jsonResponse, renderWithProviders, type StubFetch } from '../../test/api-harness';
import { ProductionOrderScreen } from './screen';
import { reasonHelpText, reasonLabel } from './worklist-chips';

const t = messages.erpWorkOrderFlow;
const path = (request: Request) => new URL(request.url).pathname;
const page = (items: unknown[]) => ({ items, page: { page: 1, size: 20, total: items.length } });

const order = (
  id: number,
  no: string,
  autoPlan: unknown,
  expanded = 0,
  worklistState = 'ACTION_REQUIRED',
  worklistReasons?: { code: string; workOrderCount: number }[],
) => ({
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
  worklistState,
  ...(worklistReasons === undefined ? {} : { worklistReasons }),
});

const REVIEW = order(701, 'SYN-PO-701', {
  status: 'NEEDS_REVIEW',
  reasons: ['BOM_MISSING', 'ROUTING_MISSING'],
});
const DONE_BLOCKED = order(
  702,
  'SYN-PO-702',
  { status: 'DONE', reasons: [] },
  2,
  'ACTION_REQUIRED',
  [{ code: 'WORK_ORDER_LINE_MISSING', workOrderCount: 1 }],
);
const DONE_READY = order(703, 'SYN-PO-703', { status: 'DONE', reasons: [] }, 1, 'RELEASE_PENDING');

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
  /* 9004는 배포 시각이 없지만 취소된 W/O다. 배포 전 W/O로 세지 않는다. */
  const pending = [
    workOrder(9001, 702, null),
    workOrder(9002, 702, 11),
    workOrder(9003, 703, 11),
    workOrder(9004, 703, 11, { statusCode: 'CANCELLED' }),
  ];
  const fetch: StubFetch = async (request) => {
    requests.push(request.clone());
    const url = new URL(request.url);
    if (path(request) === '/planning/production-orders') {
      const state = url.searchParams.get('worklistState');
      const filtered = (orders as { worklistState: string }[]).filter(
        (item) => state === null || item.worklistState === state,
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

describe('작업지시 목록 작업함', () => {
  it('기본 조건은 「조치 필요」이고 사유를 첫 칩과 「외 N」으로 목록에 보인다(C-17)', async () => {
    const { requests } = render({ orders: [REVIEW, DONE_BLOCKED, DONE_READY] });

    const row = await screen.findByRole('link', { name: t.list.openRow('SYN-PO-701') });
    expect(within(row).getByText(t.status.ACTION_REQUIRED)).toBeVisible();
    expect(within(row).getByText(t.reasons.BOM_MISSING)).toBeVisible();
    expect(within(row).getByText(t.reasons.more(1))).toBeVisible();
    expect(screen.queryByText('SYN-PO-703')).toBeNull();
    const queries = requests
      .filter((request) => path(request) === '/planning/production-orders')
      .map((request) => new URL(request.url).searchParams);
    const list = queries.find((query) => query.get('size') === '20');
    expect(list?.get('worklistState')).toBe('ACTION_REQUIRED');
    expect(list?.has('autoPlanStatus')).toBe(false);
    /* 칩 건수는 같은 조건에 쪽 크기 1로 센다. 「전체」는 거르지 않는다. */
    const counts = queries.filter((query) => query.get('size') === '1');
    expect(counts.map((query) => query.get('worklistState')).sort()).toEqual([
      'ACTION_REQUIRED',
      'RELEASE_PENDING',
      null,
    ]);
    /* 배포 전 W/O 목록을 따로 불러 판정하지 않는다. */
    expect(requests.some((request) => path(request) === '/production/work-orders')).toBe(false);
  });

  it('조건 칩은 「전체」가 맨 앞이고 처리 순서대로 서며, 보이는 묶음 이름 없이 접근명을 갖는다(C-17)', async () => {
    render({ orders: [REVIEW, DONE_BLOCKED, DONE_READY] });

    const group = await screen.findByRole('group', { name: t.counts.label });
    const chips = within(group).getAllByRole('button');
    expect(chips.map((chip) => chip.textContent)).toEqual([
      expect.stringMatching(/^전체 /),
      expect.stringMatching(new RegExp(`^${t.status.ACTION_REQUIRED} `)),
      expect.stringMatching(new RegExp(`^${t.status.RELEASE_PENDING} `)),
    ]);
    expect(screen.queryByText('자동 계획', { exact: true })).toBeNull();
  });

  it('행 상태 칩은 서버 판정(worklistState) 그대로다', async () => {
    const BEFORE = order(711, 'SYN-PO-711', null, 0, 'BEFORE_PLAN');
    const RELEASED = order(712, 'SYN-PO-712', { status: 'DONE', reasons: [] }, 1, 'RELEASED');
    const CANCELLED = order(713, 'SYN-PO-713', null, 0, 'CANCELLED');
    render(
      { orders: [BEFORE, REVIEW, DONE_READY, RELEASED, CANCELLED] },
      '/production/production-orders?state=ALL',
    );

    await screen.findByRole('link', { name: t.list.openRow('SYN-PO-711') });
    for (const [no, label] of [
      ['SYN-PO-711', '계획 전'],
      ['SYN-PO-701', '조치 필요'],
      ['SYN-PO-703', '배포 대기'],
      ['SYN-PO-712', '배포 완료'],
      ['SYN-PO-713', '취소'],
    ] as const) {
      const row = screen.getByRole('link', { name: t.list.openRow(no) });
      expect(within(row).getByText(label, { exact: true })).toBeVisible();
    }
  });

  it('화면이 모르는 상태 코드는 빈 칩 대신 코드를 보이고, 서버가 수를 싣지 않으면 「배포 전 W/O」 칸을 비운다', async () => {
    const unknown = order(741, 'SYN-PO-741', { status: 'DONE', reasons: [] }, 1, 'NEW_STATE');
    render({ orders: [unknown] }, '/production/production-orders?state=ALL');

    const row = await screen.findByRole('link', { name: t.list.openRow('SYN-PO-741') });
    expect(within(row).getByText('NEW_STATE')).toBeVisible();
    expect(within(row).queryByText(/\d+ \/ \d+/)).toBeNull();
  });

  it('「배포 전 W/O」 열은 서버가 센 배포 전 수와 전체 수를 보인다', async () => {
    const counts = (base: object, pending: number, live: number) => ({
      ...base,
      releasePendingWorkOrderCount: pending,
      liveWorkOrderCount: live,
    });
    render(
      {
        orders: [
          counts(
            order(731, 'SYN-PO-731', { status: 'DONE', reasons: [] }, 2, 'RELEASE_PENDING'),
            1,
            2,
          ),
          counts(order(732, 'SYN-PO-732', { status: 'DONE', reasons: [] }, 2, 'RELEASED'), 0, 2),
          counts(order(733, 'SYN-PO-733', null, 0, 'BEFORE_PLAN'), 0, 0),
        ],
      },
      '/production/production-orders?state=ALL',
    );

    expect(
      await screen.findByRole('columnheader', { name: t.list.columns.pendingWorkOrders }),
    ).toBeVisible();
    for (const [no, text] of [
      ['SYN-PO-731', '1 / 2'],
      ['SYN-PO-732', '0 / 2'],
      ['SYN-PO-733', '0 / 0'],
    ] as const) {
      const row = await screen.findByRole('link', { name: t.list.openRow(no) });
      expect(within(row).getByText(text)).toBeVisible();
    }
  });

  it.each([
    [
      'WORK_ORDER_LINE_MISSING',
      'W/O 생산 라인 지정 필요',
      '배포 전 W/O 2건에 생산 라인이 없습니다. 4M 배정 단계에서 생산 라인을 지정해야 합니다.',
    ],
    [
      'WORK_ORDER_LOCATION_MISSING',
      'W/O 기본 위치 지정 필요',
      '배포 전 W/O 2건에 기본 WIP 위치, 기본 완제품 위치, 기본 스크랩 위치 가운데 빈 것이 있습니다. 4M 배정 단계에서 기본 위치를 지정해야 합니다.',
    ],
    [
      'LINE_PLANT_MISMATCH',
      'W/O 생산 라인 변경 필요',
      '배포 전 W/O 2건의 생산 라인이 이 ERP W/O와 다른 공장의 라인입니다. 4M 배정 단계에서 이 공장의 생산 라인으로 바꿔야 합니다.',
    ],
    [
      'NO_LIVE_WORK_ORDER',
      '계획 추가 필요',
      '확정한 계획의 W/O가 없거나 모두 취소되었습니다. 생산계획 단계에서 [계획 추가]로 필요한 수량을 다시 계획하고 [전개 확정]을 눌러야 합니다.',
    ],
    ['NEW_CODE', '조치 필요(NEW_CODE)', '처리 화면을 열어 남은 일을 확인해야 합니다.'],
  ])(
    '자동 계획이 끝났는데 막힌 사유 %s는 칩 「%s」와 도움말로 보인다',
    async (code, label, help) => {
      const blocked = order(
        720,
        'SYN-PO-720',
        { status: 'DONE', reasons: [] },
        2,
        'ACTION_REQUIRED',
        [{ code, workOrderCount: code === 'NO_LIVE_WORK_ORDER' ? 0 : 2 }],
      );
      render({ orders: [blocked] });

      const row = await screen.findByRole('link', { name: t.list.openRow('SYN-PO-720') });
      expect(within(row).getByText(t.status.ACTION_REQUIRED)).toBeVisible();
      const chip = within(row).getByText(label);
      expect(chip).toBeVisible();
      expect(chip.closest('.reason-chips')).toHaveAttribute('title', help);
    },
  );

  it('자동 계획 확인 필요의 새 사유 AUTO_PLAN_RERUN_NEEDED는 다시 실행하라고 말한다', async () => {
    const rerun = order(721, 'SYN-PO-721', {
      status: 'NEEDS_REVIEW',
      reasons: ['AUTO_PLAN_RERUN_NEEDED'],
    });
    render({ orders: [rerun] });

    const row = await screen.findByRole('link', { name: t.list.openRow('SYN-PO-721') });
    const chip = within(row).getByText('자동 계획 다시 실행 필요');
    expect(chip.closest('.reason-chips')).toHaveAttribute(
      'title',
      '기준정보가 갖춰졌거나 자동 계획이 실패했습니다. 처리 화면 오른쪽 위 [자동 계획 다시 실행]을 눌러야 합니다.',
    );
  });

  it('옛 주소 ?autoPlan=DONE은 「배포 대기」 조건으로 연다', async () => {
    const { requests } = render(
      { orders: [REVIEW, DONE_READY] },
      '/production/production-orders?autoPlan=DONE',
    );

    await screen.findByRole('link', { name: t.list.openRow('SYN-PO-703') });
    expect(screen.queryByRole('link', { name: t.list.openRow('SYN-PO-701') })).toBeNull();
    const group = screen.getByRole('group', { name: t.counts.label });
    expect(
      within(group).getByRole('button', { name: new RegExp(`^${t.status.RELEASE_PENDING} `) }),
    ).toHaveAttribute('aria-pressed', 'true');
    const list = requests.find(
      (request) =>
        path(request) === '/planning/production-orders' &&
        new URL(request.url).searchParams.get('size') === '20',
    );
    expect(new URL(list?.url ?? 'http://x').searchParams.get('worklistState')).toBe(
      'RELEASE_PENDING',
    );
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

  it('자동 계획 확인 창은 라인을 모를 때 건너뛰지 않고 작성 중 계획만 만든다고 말한다', async () => {
    const user = userEvent.setup();
    render({ orders: [REVIEW] });

    const row = await screen.findByRole('link', { name: t.list.openRow('SYN-PO-701') });
    await user.click(within(row).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: t.bulk.autoPlan }));

    const dialog = screen.getByRole('dialog', { name: t.bulk.autoPlanDialog.title });
    expect(
      within(dialog).getByText(
        '생산 라인을 정할 수 없으면 작성 중인 계획만 만들고 확정하지 않습니다.',
      ),
    ).toBeVisible();
    expect(within(dialog).getByText('품목에 ★로 지정한 설비와 금형 자동 배정')).toBeVisible();
    expect(within(dialog).queryByText('라인을 정할 수 없는 ERP W/O')).toBeNull();
    expect(
      within(dialog).getByText(
        '확정한 계획 수량이 주문 수량보다 적고 작성 중인 계획이 없는 ERP W/O(남은 수량은 생산계획 단계에서 계획)',
      ),
    ).toBeVisible();
  });

  it('일괄 배포는 실행과 같은 판정으로 예고하고, 일부 처리를 따로 세며, 결과 칩을 상태 칩 자리에 보인다(C-16, C-18)', async () => {
    const user = userEvent.setup();
    render({ orders: [DONE_BLOCKED, DONE_READY] }, '/production/production-orders?state=ALL');

    const blocked = await screen.findByRole('link', { name: t.list.openRow('SYN-PO-702') });
    const ready = screen.getByRole('link', { name: t.list.openRow('SYN-PO-703') });
    await user.click(within(blocked).getByRole('checkbox'));
    await user.click(within(ready).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: t.bulk.release }));

    const dialog = screen.getByRole('dialog', { name: t.bulk.releaseDialog.title });
    expect(within(dialog).getByText(t.bulk.releaseDialog.target(2))).toBeVisible();
    /* 취소된 9004는 예고에도 배포에도 들지 않는다(서버 「배포 전」 수와 같은 조건). */
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
    render({ orders: [DONE_BLOCKED], released: [9002] }, '/production/production-orders?state=ALL');

    const blocked = await screen.findByRole('link', { name: t.list.openRow('SYN-PO-702') });
    await user.click(within(blocked).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: t.bulk.release }));
    const dialog = screen.getByRole('dialog', { name: t.bulk.releaseDialog.title });
    await within(dialog).findByText(t.bulk.releaseDialog.forecast(0, 0, 1, 0));
    const confirm = within(dialog).getByRole('button', { name: t.bulk.releaseDialog.confirm });
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveAccessibleDescription(t.bulk.releaseDialog.nothing);
  });

  it('체크박스는 행마다 다른 이름이다(C-1)', async () => {
    render({ orders: [DONE_READY] }, '/production/production-orders?state=RELEASE_PENDING');

    const row = await screen.findByRole('link', { name: t.list.openRow('SYN-PO-703') });
    expect(
      within(row).getByRole('checkbox', { name: t.list.checkRow('SYN-PO-703') }),
    ).toBeVisible();
  });

  it('일괄 배포 중에 다른 화면으로 갔다 돌아와도 결과가 남는다', async () => {
    const user = userEvent.setup();
    const harness = stub({ orders: [DONE_READY] });
    const Toggle = () => {
      const [shown, setShown] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setShown((value) => !value)}>
            화면 전환
          </button>
          {shown && <ProductionOrderScreen />}
        </>
      );
    };
    renderWithProviders(<Toggle />, {
      fetch: harness.fetch,
      route: '/production/production-orders?state=RELEASE_PENDING',
    });

    const ready = await screen.findByRole('link', { name: t.list.openRow('SYN-PO-703') });
    await user.click(within(ready).getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: t.bulk.release }));
    const dialog = screen.getByRole('dialog', { name: t.bulk.releaseDialog.title });
    await within(dialog).findByText(t.bulk.releaseDialog.forecast(1, 0, 0, 1));
    await user.click(within(dialog).getByRole('button', { name: t.bulk.releaseDialog.confirm }));
    await user.click(screen.getByRole('button', { name: '화면 전환' }));
    await waitFor(() => expect(harness.requests.some((r) => /:release$/.test(r.url))).toBe(true));
    await user.click(screen.getByRole('button', { name: '화면 전환' }));

    expect(await screen.findByRole('region', { name: t.bulk.resultTitle.release })).toBeVisible();
  });
});

describe('사유 칩 도움말', () => {
  it('계획 수량을 알면 주문과 계획 수량을 넣고, 모르면 수 없이 말한다', () => {
    expect(
      reasonHelpText([{ code: 'QTY_REMAINING' }], {
        orderQty: '1,000',
        plannedQty: '600',
        uom: 'EA',
      }),
    ).toBe(
      '주문 1,000 EA 중 600 EA만 계획되었습니다. 생산계획 단계에서 남은 수량을 계획해야 합니다.',
    );
    expect(reasonHelpText([{ code: 'QTY_REMAINING' }])).toBe(
      '확정한 계획 수량이 주문 수량보다 적습니다. 생산계획 단계에서 남은 수량을 계획해야 합니다.',
    );
  });

  it('사유가 여럿이면 줄을 바꿔 모두 말한다', () => {
    expect(
      reasonHelpText([{ code: 'BOM_MISSING' }, { code: 'ROUTING_MISSING' }]).split('\n'),
    ).toEqual([
      '이 품목의 기본 BOM이 없거나 둘 이상입니다. 품목·BOM 정보에서 기본 BOM을 하나로 지정해야 합니다.',
      '이 품목에 쓸 수 있는 공정(Routing)이 없습니다. 공정(Routing) 화면에서 등록해야 합니다.',
    ]);
  });

  it('모르는 사유 코드는 빈 칩이나 undefined 대신 코드와 일반 안내를 보인다', () => {
    expect(reasonLabel('NEW_CODE')).toBe('조치 필요(NEW_CODE)');
    expect(reasonLabel('more')).toBe('조치 필요(more)');
    expect(reasonHelpText([{ code: 'NEW_CODE' }])).toBe(
      '처리 화면을 열어 남은 일을 확인해야 합니다.',
    );
    expect(reasonLabel('BOM_MISSING')).toBe('기본 BOM 지정 필요');
  });
});
