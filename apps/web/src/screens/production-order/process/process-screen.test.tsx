import { ToastProvider } from '@crefle/web-ui';
import { createApiClient } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { ApiClientProvider } from '../../../patterns/api-context';
import { jsonResponse } from '../../../test/api-harness';
import { LegacyAssignmentRedirect, LegacyPlanRedirect } from './legacy-redirects';
import { ProductionOrderProcessScreen, ProcessWorkspace } from './process-screen';
import { toProductionOrderFact } from '../queries';

/*
 * 처리 화면(T-W-C) 컴포넌트 시험. 이탈 확인(`useBlocker`)이 데이터 라우터에서만 동작하므로 공용 하네스의
 * `MemoryRouter` 대신 `createMemoryRouter`로 앱과 같은 종류의 라우터를 쓴다.
 */
const t = messages.erpWorkOrderFlow;
const tp = t.process;
const ORDER_NO = 'SYN-PO-701';
const WORKLIST = '/production/production-orders';

const page = (items: unknown[]) => ({ items, page: { page: 1, size: 200, total: items.length } });
const path = (request: Request) => new URL(request.url).pathname;

interface Plan {
  productionPlanId: number;
  planNo: string;
  plannedLineId?: number;
  plannedQty: number;
  bomId?: number;
  confirmedAt?: string;
  versionNo: number;
}

interface WorkOrder {
  workOrderId: number;
  productionLineId?: number;
  located: boolean;
}

interface World {
  autoPlan: { status: string; reasons: string[] } | null;
  boms: unknown[];
  plans: Plan[];
  workOrders: WorkOrder[];
  released: number[];
  /** 배포를 422로 거절할 W/O */
  rejectRelease: number[];
  /** 저장 전에 서버 판을 올려 낙관적 잠금 충돌을 만든다 */
  bumpPlanVersion?: boolean;
  /** 서버 칩 판정. 시험 도중 바꿔 머리가 다시 읽는지 본다. */
  worklistState?: string;
  worklistReasons?: { code: string; workOrderCount: number }[];
  /** 서버 확정 계획량. W/O 가 모두 취소된 확정 계획은 빠진다. 주지 않으면 키를 뺀다. */
  confirmedPlanQty?: number;
  /** 품목의 ERP 품목그룹. 주지 않으면 서버가 이 칸을 모르는 것처럼 키를 뺀다. */
  itemGroupCode?: string | null;
  /** 주문의 ERP 원번호. 주지 않으면 제목 번호와 다른 `ERP-701`이다. */
  erpOrderNo?: string | null;
  /** Routing 21이 작성중(쓸 수 없는) 개정이라 usableOnly 목록에 없다 */
  routingDraft?: boolean;
  /** 이 경로를 403으로 거절한다 */
  forbidden?: string;
}

const world = (overrides: Partial<World> = {}): World => ({
  autoPlan: { status: 'NEEDS_REVIEW', reasons: [] },
  boms: [
    {
      bomId: 11,
      parentItemId: 7101,
      bomCode: 'SYN-BOM',
      bomVersion: 1,
      statusCode: 'CONFIRMED',
      isDefault: true,
      effectiveFrom: '2026-01-01',
      baseQty: 1,
      baseUomId: 8101,
    },
  ],
  plans: [],
  workOrders: [],
  released: [],
  rejectRelease: [],
  ...overrides,
});

const LINE = {
  productionLineId: 31,
  plantId: 1,
  lineCode: 'SYN-LN',
  lineName: '합성 라인',
  lineTypeCode: 'ASSEMBLY',
  isActive: true,
  defaultWipLocationId: 41,
  defaultFgLocationId: 42,
  defaultScrapLocationId: 43,
};

const orderBody = (state: World) => ({
  productionOrderId: 701,
  productionOrderNo: ORDER_NO,
  erpOrderNo: state.erpOrderNo === undefined ? 'ERP-701' : state.erpOrderNo,
  plantId: 1,
  itemId: 7101,
  orderQty: 300,
  uomId: 8101,
  dueDate: '2026-10-31',
  statusCode: 'RECEIVED',
  expandedWorkOrderCount: state.workOrders.length,
  plannedWorkOrderCount: state.workOrders.length,
  autoPlan: state.autoPlan,
  ...(state.worklistState === undefined ? {} : { worklistState: state.worklistState }),
  ...(state.worklistReasons === undefined ? {} : { worklistReasons: state.worklistReasons }),
  ...(state.confirmedPlanQty === undefined ? {} : { confirmedPlanQty: state.confirmedPlanQty }),
});

const planBody = (plan: Plan) => ({
  productionOrderId: 701,
  planDate: '2026-10-21',
  uomId: 8101,
  bomId: 11,
  routingId: 21,
  statusCode: plan.confirmedAt === undefined ? 'DRAFT' : 'CONFIRMED',
  ...plan,
});

const workOrderBody = (workOrder: WorkOrder, state: World) => ({
  workOrderId: workOrder.workOrderId,
  workOrderNo: `SYN-WO-${String(workOrder.workOrderId)}`,
  productionPlanId: 501,
  routingOperationId: 1,
  routingOperationName: '조립',
  productionOrderId: 701,
  itemId: 7101,
  orderQty: 300,
  uomId: 8101,
  workOrderTypeCode: 'NORMAL',
  priorityNo: 100,
  statusCode: state.released.includes(workOrder.workOrderId) ? 'RELEASED' : 'PLANNED',
  ...(workOrder.productionLineId === undefined
    ? {}
    : { productionLineId: workOrder.productionLineId }),
  ...(workOrder.located
    ? { defaultWipLocationId: 41, defaultFgLocationId: 42, defaultScrapLocationId: 43 }
    : {}),
  versionNo: 1,
});

interface Call {
  method: string;
  path: string;
  ifMatch: string | null;
}

/** 처리 화면이 부르는 API의 합성 서버. 쓰기는 상태를 바꾸고, 계획 쓰기는 If-Match를 판과 맞춰 본다. */
const serve = (state: World) => {
  const writes: Call[] = [];
  const fetch = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const at = path(request);
    const method = request.method;
    if (method !== 'GET') {
      writes.push({ method, path: at, ifMatch: request.headers.get('If-Match') });
    }
    const planMatch = /^\/planning\/production-plans\/(\d+)(:confirm)?$/.exec(at);
    const workOrderMatch = /^\/production\/work-orders\/(\d+)(\/validation|:release)?$/.exec(at);

    if (state.forbidden === at) {
      return jsonResponse(
        { errors: [{ scope: 'screen', code: 'PERMISSION_DENIED', message: '권한이 없습니다.' }] },
        { status: 403 },
      );
    }
    if (at === '/planning/production-orders') {
      const q = url.searchParams.get('q');
      return jsonResponse(page(q === null || ORDER_NO.includes(q) ? [orderBody(state)] : []));
    }
    if (at === '/planning/production-orders/701') return jsonResponse(orderBody(state));
    if (at === '/planning/boms') return jsonResponse(page(state.boms));
    if (/^\/planning\/boms\/\d+\/components$/.test(at)) return jsonResponse({ items: [] });
    if (/^\/planning\/boms\/\d+$/.test(at))
      return jsonResponse({
        bom: state.boms.find(
          (bom) => (bom as { bomId: number }).bomId === Number(at.split('/').at(-1)),
        ),
      });
    if (at === '/planning/routings') {
      if (state.routingDraft === true && url.searchParams.get('usableOnly') === 'true') {
        return jsonResponse(page([]));
      }
      return jsonResponse(
        page([
          {
            routingId: 21,
            itemId: 7101,
            routingCode: 'SYN-RT',
            routingVersion: 1,
            statusCode: state.routingDraft === true ? 'DRAFT' : 'ACTIVE',
            isDefault: true,
          },
        ]),
      );
    }
    if (at === '/planning/routings/21')
      return jsonResponse({
        routing: {
          routingCode: 'SYN-RT',
          routingVersion: 1,
          statusCode: 'CONFIRMED',
          isDefault: true,
        },
      });
    if (at === '/planning/routings/21/operations') {
      return jsonResponse(
        page([{ routingOperationId: 1, operationSeq: 10, operationName: '조립' }]),
      );
    }
    if (at === '/mdm/production-lines') return jsonResponse(page([LINE]));
    if (at === '/planning/production-plans' && method === 'GET') {
      return jsonResponse(page(state.plans.map(planBody)));
    }
    if (planMatch !== null) {
      const plan = state.plans.find((entry) => entry.productionPlanId === Number(planMatch[1]));
      if (plan === undefined) return jsonResponse({}, { status: 404 });
      if (method === 'GET') return jsonResponse(planBody(plan));
      if (state.bumpPlanVersion === true) plan.versionNo += 1;
      if (request.headers.get('If-Match') !== String(plan.versionNo)) {
        return jsonResponse({ conflictCause: 'user', message: '' }, { status: 409 });
      }
      plan.versionNo += 1;
      if (planMatch[2] === ':confirm') {
        plan.confirmedAt = '2026-10-21T09:00:00+09:00';
        state.workOrders.push({ workOrderId: 9001, productionLineId: 31, located: false });
        state.autoPlan = { status: 'DONE', reasons: [] };
      } else if (method === 'PUT') {
        Object.assign(plan, (await request.json()) as Partial<Plan>);
      }
      return jsonResponse(planBody(plan));
    }
    if (at === '/production/work-orders' && method === 'GET') {
      const unreleasedOnly = url.searchParams.get('released') === 'false';
      return jsonResponse(
        page(
          state.workOrders
            .filter((entry) => !unreleasedOnly || !state.released.includes(entry.workOrderId))
            .map((entry) => workOrderBody(entry, state)),
        ),
      );
    }
    if (workOrderMatch !== null) {
      const workOrder = state.workOrders.find(
        (entry) => entry.workOrderId === Number(workOrderMatch[1]),
      );
      if (workOrder === undefined) return jsonResponse({}, { status: 404 });
      if (workOrderMatch[2] === '/validation') {
        return jsonResponse({ passed: workOrder.located, findings: [] });
      }
      if (workOrderMatch[2] === ':release') {
        if (state.rejectRelease.includes(workOrder.workOrderId)) {
          return jsonResponse(
            { errors: [{ scope: 'screen', code: 'REJECTED', message: '설비 점검이 막았습니다' }] },
            { status: 422 },
          );
        }
        state.released.push(workOrder.workOrderId);
        return jsonResponse(workOrderBody(workOrder, state));
      }
      if (method === 'PUT') workOrder.located = true;
      return jsonResponse(workOrderBody(workOrder, state), { headers: { ETag: '1' } });
    }
    if (at === '/mdm/items/7101') {
      return jsonResponse({
        item: {
          itemId: 7101,
          itemCode: 'SYN-ITEM',
          itemName: '합성 품목 【 SYN-001 】',
          baseUomId: 8101,
          defaultProductionLotSize: 100,
          ...(state.itemGroupCode === undefined ? {} : { erpItemGroupCode: state.itemGroupCode }),
        },
      });
    }
    if (at === '/mdm/uoms') {
      return jsonResponse(page([{ uomId: 8101, uomCode: 'EA', uomName: '개', isActive: true }]));
    }
    if (method === 'GET') return jsonResponse(page([]));
    throw new Error(`unexpected request: ${method} ${request.url}`);
  };
  return { fetch, writes };
};

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

const renderAt = (route: string, state: World, startAtAssign = false) => {
  const server = serve(state);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, networkMode: 'always' },
      mutations: { retry: false, networkMode: 'always' },
    },
  });
  const apiClient = createApiClient({ baseUrl: 'http://api.test', fetch: server.fetch });
  const router = createMemoryRouter(
    [
      { path: WORKLIST, element: <LocationProbe /> },
      {
        path: `${WORKLIST}/:productionOrderNo`,
        element: (
          <>
            {startAtAssign ? (
              <ProcessWorkspace
                order={toProductionOrderFact(
                  orderBody(state) as Parameters<typeof toProductionOrderFact>[0],
                )}
                initialStep="assign"
              />
            ) : (
              <ProductionOrderProcessScreen />
            )}
            <LocationProbe />
          </>
        ),
      },
      { path: '/production/production-plans', element: <LegacyPlanRedirect /> },
      { path: '/production/work-order-assignments', element: <LegacyAssignmentRedirect /> },
    ],
    { initialEntries: [route] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider client={apiClient}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </ApiClientProvider>
    </QueryClientProvider>,
  );
  return server;
};

const currentStep = async (name: string) =>
  waitFor(() => expect(screen.getByRole('tab', { name, selected: true })).toBeInTheDocument());

const actionBar = () =>
  screen.getByRole('button', { name: messages.screenPatterns.actionBar.prev });

const DRAFT_PLAN: Plan = {
  productionPlanId: 501,
  planNo: 'PP-501',
  plannedLineId: 31,
  plannedQty: 300,
  versionNo: 2,
};
const CONFIRMED_PLAN: Plan = { ...DRAFT_PLAN, confirmedAt: '2026-10-20T09:00:00+09:00' };

describe('작업지시 목록 처리 화면(T-W-C)', () => {
  it.each([false, true])(
    'ERP BOM 변경 시 확정=%s 계획은 확정 여부에 따라 개정을 적용한다',
    async (confirmed) => {
      const user = userEvent.setup();
      const old = {
        ...(world().boms[0] as Record<string, unknown>),
        isDefault: false,
        statusCode: 'OBSOLETE',
      };
      const latest = { ...old, bomId: 12, bomVersion: 2, isDefault: true, statusCode: 'CONFIRMED' };
      const state = world({
        boms: [old, latest],
        plans: [{ ...(confirmed ? CONFIRMED_PLAN : DRAFT_PLAN), bomId: 11 }],
      });
      const server = renderAt(`${WORKLIST}/${ORDER_NO}`, state);
      if (confirmed) {
        await currentStep(tp.steps.assign);
        await user.click(screen.getByRole('tab', { name: tp.steps.master }));
        await screen.findByText(/확정 계획 적용 개정/);
        expect(screen.queryByRole('combobox', { name: 'BOM 개정' })).toBeNull();
        expect(screen.getByText(/SYN-BOM.*개정 1/)).toBeVisible();
      }
      if (!confirmed) {
        await currentStep(tp.steps.plan);
        await user.click(screen.getByRole('button', { name: tp.plan.confirm }));
        const dialog = await screen.findByRole('dialog', { name: tp.planConfirm.title });
        await user.click(within(dialog).getByRole('button', { name: tp.planConfirm.confirm }));
        await currentStep(tp.steps.assign);
        expect(state.plans[0]?.bomId).toBe(12);
      } else {
        expect(state.plans[0]?.bomId).toBe(11);
        expect(server.writes).toHaveLength(0);
      }
    },
  );
  it('부분 확정 계획은 초기 4M 요청이 있어도 전량 미달이면 생산계획에 남는다', async () => {
    renderAt(
      `${WORKLIST}/${ORDER_NO}`,
      world({
        plans: [{ ...CONFIRMED_PLAN, plannedQty: 150 }],
        workOrders: [{ workOrderId: 9001, productionLineId: 31, located: true }],
      }),
      true,
    );
    await currentStep(tp.steps.plan);
    expect(screen.getByRole('tab', { name: tp.steps.assign })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('tab', { name: tp.steps.release })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('W/O 가 모두 취소된 확정 계획은 확정 계획량에서 빠져, 생산계획 단계로 열고 남은 수량을 말한다(#246)', async () => {
    /* 확정 계획 둘(200 + 100) 가운데 100 의 W/O 가 모두 취소됐다. 서버 확정 계획량은 200 이다. */
    renderAt(
      `${WORKLIST}/${ORDER_NO}`,
      world({
        autoPlan: { status: 'DONE', reasons: [] },
        plans: [
          { ...CONFIRMED_PLAN, plannedQty: 200 },
          { ...CONFIRMED_PLAN, productionPlanId: 502, planNo: 'PP-502', plannedQty: 100 },
        ],
        workOrders: [{ workOrderId: 9001, productionLineId: 31, located: true }],
        confirmedPlanQty: 200,
        worklistState: 'ACTION_REQUIRED',
        worklistReasons: [{ code: 'PLAN_QTY_REMAINING', workOrderCount: 0 }],
      }),
    );
    await currentStep(tp.steps.plan);
    const chip = await screen.findByText(t.reasons.PLAN_QTY_REMAINING);
    expect(chip.closest('button')).toHaveAccessibleDescription(
      /주문 300.* 중 200.*만 계획되었습니다/,
    );
  });

  it('계획 수량 합계와 [계획 추가] 기본 생산량은 W/O 가 모두 취소된 확정 계획을 빼고 센다(#250)', async () => {
    const user = userEvent.setup();
    /* 확정 계획 둘(200 + 100) 가운데 100 의 W/O 가 모두 취소됐다. 서버 확정 계획량은 200 이다. */
    renderAt(
      `${WORKLIST}/${ORDER_NO}`,
      world({
        autoPlan: { status: 'DONE', reasons: [] },
        plans: [
          { ...CONFIRMED_PLAN, plannedQty: 200 },
          { ...CONFIRMED_PLAN, productionPlanId: 502, planNo: 'PP-502', plannedQty: 100 },
        ],
        workOrders: [{ workOrderId: 9001, productionLineId: 31, located: true }],
        confirmedPlanQty: 200,
        worklistState: 'ACTION_REQUIRED',
        worklistReasons: [{ code: 'PLAN_QTY_REMAINING', workOrderCount: 0 }],
      }),
    );
    await currentStep(tp.steps.plan);
    expect(document.querySelector('.erp-wo-plan-total')).toHaveTextContent(
      /^계획 수량 합계 200 \/ 300/,
    );

    await user.click(screen.getByRole('button', { name: tp.plan.add }));
    const qty = await screen.findByRole('textbox', {
      name: (name) => name.startsWith('신규 계획') && name.includes(tp.plan.columns.plannedQty),
    });
    expect(qty).toHaveValue('100');
    expect(document.querySelector('.erp-wo-plan-total')).toHaveTextContent(
      /^계획 수량 합계 300 \/ 300/,
    );
    /* 작성중 50 이면 확정 200 + 50 이라 50 이 모자란다(취소된 100 을 세면 다 찬 것으로 보였다). */
    await user.clear(qty);
    await user.type(qty, '50');
    expect(document.body).toHaveTextContent(tp.remaining.qtyShort('50'));
  });

  it('기본 BOM 이 없는 품목은 [계획 추가] 줄을 보내지 않고 막힌 까닭을 알린다(#249)', async () => {
    const user = userEvent.setup();
    /* BOM 11 은 기본 BOM 이 아니다. 서버는 작성중 계획에 기본 BOM 만 받는다(BOM_NOT_DEFAULT). */
    const state = world({
      boms: [{ ...(world().boms[0] as Record<string, unknown>), isDefault: false }],
      plans: [{ ...CONFIRMED_PLAN, plannedQty: 200 }],
      workOrders: [{ workOrderId: 9001, productionLineId: 31, located: true }],
      confirmedPlanQty: 200,
    });
    const server = renderAt(`${WORKLIST}/${ORDER_NO}`, state);
    await currentStep(tp.steps.plan);

    await user.click(screen.getByRole('button', { name: tp.plan.add }));
    const blocked = tp.remaining.planBomMissing(tp.plan.newRow(2));
    expect(await screen.findByText(blocked)).toBeVisible();
    expect(screen.getByRole('link', { name: tp.links.bom })).toBeVisible();

    await user.click(screen.getByRole('button', { name: tp.plan.saveDraft }));
    const alert = await screen.findByText(tp.plan.failedTitle);
    expect(alert.closest('[role="alert"], .alert-banner') ?? document.body).toHaveTextContent(
      blocked,
    );
    expect(document.body).not.toHaveTextContent(tp.remaining.canProceed('4M 배정으로'));
    expect(server.writes).toEqual([]);
    expect(state.plans).toHaveLength(1);
  });

  it('처음 여는 단계는 데이터의 첫 미완료 단계다', async () => {
    renderAt(`${WORKLIST}/${ORDER_NO}`, world({ boms: [] }));
    await currentStep(tp.steps.master);
    expect(document.body).toHaveTextContent(tp.remaining.bomMissing);
  });

  it('상단 품목코드와 품목명을 분리하고 품목명 안의 표기를 유지한다', async () => {
    renderAt(`${WORKLIST}/${ORDER_NO}`, world());
    await currentStep(tp.steps.plan);
    const summary = document.querySelector('.erp-wo-summary')! as HTMLElement;
    expect(within(summary).getByText(t.list.columns.itemCode, { exact: true })).toBeVisible();
    expect(within(summary).getByText(t.list.columns.itemName, { exact: true })).toBeVisible();
    expect(within(summary).getByText('합성 품목 【 SYN-001 】', { exact: true })).toBeVisible();
    expect(within(summary).getByText('SYN-ITEM', { exact: true })).toBeVisible();
  });
  it('ERP 원번호는 제목 번호와 다를 때만 머리에 보인다', async () => {
    renderAt(`${WORKLIST}/${ORDER_NO}`, world({ boms: [], erpOrderNo: 'ERP-701' }));
    await currentStep(tp.steps.master);
    expect(screen.getByText(tp.summary.erpNo)).toBeVisible();
    expect(screen.getByText('ERP-701')).toBeVisible();
  });

  it('품목그룹이 있으면 머리에 보이고, 없으면 보이지 않는다', async () => {
    renderAt(`${WORKLIST}/${ORDER_NO}`, world({ boms: [], itemGroupCode: 'G100' }));
    await currentStep(tp.steps.master);
    expect(await screen.findByText(tp.summary.itemGroup)).toBeVisible();
    expect(screen.getByText('G100')).toBeVisible();
  });

  it.each([undefined, null, ''])(
    '품목그룹이 %j 이면 머리에 보이지 않는다',
    async (itemGroupCode) => {
      renderAt(`${WORKLIST}/${ORDER_NO}`, world({ boms: [], itemGroupCode }));
      await currentStep(tp.steps.master);
      await within(document.querySelector('.process-page-head') as HTMLElement).findByText(
        '합성 품목',
        { exact: false },
      );
      expect(screen.queryByText(tp.summary.itemGroup)).toBeNull();
    },
  );

  it.each([ORDER_NO, '', null])('ERP 원번호가 %j 이면 머리에 보이지 않는다', async (erpOrderNo) => {
    renderAt(`${WORKLIST}/${ORDER_NO}`, world({ boms: [], erpOrderNo }));
    await currentStep(tp.steps.master);
    expect(screen.queryByText(tp.summary.erpNo)).toBeNull();
  });

  it('작성 중 계획이 있으면 생산계획 단계로 열고, 라인 칸은 「계획 번호 라인」 이름을 가진다', async () => {
    renderAt(`${WORKLIST}/${ORDER_NO}`, world({ plans: [{ ...DRAFT_PLAN }] }));
    await currentStep(tp.steps.plan);
    expect(
      screen.getByRole('button', { name: tp.plan.fieldLabel('PP-501', tp.plan.columns.line) }),
    ).toBeVisible();
  });

  it('전개 확정은 불러온 판으로 보내고, 확정하면 4M 배정 단계로 넘어간다', async () => {
    const user = userEvent.setup();
    const server = renderAt(`${WORKLIST}/${ORDER_NO}`, world({ plans: [{ ...DRAFT_PLAN }] }));
    await currentStep(tp.steps.plan);

    await user.click(screen.getByRole('button', { name: tp.plan.confirm }));
    const dialog = await screen.findByRole('dialog', { name: tp.planConfirm.title });
    await user.click(within(dialog).getByRole('button', { name: tp.planConfirm.confirm }));

    await currentStep(tp.steps.assign);
    expect(server.writes).toContainEqual({
      method: 'POST',
      path: '/planning/production-plans/501:confirm',
      ifMatch: '2',
    });
  });

  it('불러온 뒤 서버 계획이 바뀌면 덮어쓰지 않고 충돌을 알려 다시 불러오게 한다', async () => {
    const user = userEvent.setup();
    const state = world({ plans: [{ ...DRAFT_PLAN }], bumpPlanVersion: true });
    const server = renderAt(`${WORKLIST}/${ORDER_NO}`, state);
    await currentStep(tp.steps.plan);

    await user.click(screen.getByRole('button', { name: tp.plan.confirm }));
    const dialog = await screen.findByRole('dialog', { name: tp.planConfirm.title });
    await user.click(within(dialog).getByRole('button', { name: tp.planConfirm.confirm }));

    expect(await screen.findByText(messages.conflict.user)).toBeVisible();
    expect(state.plans[0]?.confirmedAt).toBeUndefined();
    expect(server.writes.filter((call) => call.method === 'POST')).toHaveLength(1);
    await currentStep(tp.steps.plan);
  });

  it('4M을 저장하면 다음 배정 미완 W/O를 연다', async () => {
    const user = userEvent.setup();
    renderAt(
      `${WORKLIST}/${ORDER_NO}`,
      world({
        autoPlan: { status: 'DONE', reasons: [] },
        plans: [{ ...CONFIRMED_PLAN }],
        workOrders: [
          { workOrderId: 9001, productionLineId: 31, located: false },
          { workOrderId: 9002, productionLineId: 31, located: false },
        ],
      }),
    );
    await currentStep(tp.steps.assign);
    const editor = await screen.findByRole('region', {
      name: tp.assign.editorLabel('SYN-WO-9001'),
    });
    /*
     * [저장]은 라인 기본 위치가 초안에 채워져야 열린다 — 라인 목록이 늦게 오면 편집기가 먼저
     * 보이므로, 열리기 전에 누르면 아무 일도 일어나지 않는다.
     */
    await waitFor(() => {
      expect(screen.getByRole('button', { name: tp.assign.actions.save })).toBeEnabled();
    });
    await user.click(screen.getByRole('button', { name: tp.assign.actions.save }));

    expect(
      await screen.findByRole('region', { name: tp.assign.editorLabel('SYN-WO-9002') }),
    ).toBeVisible();
  });

  it('4M을 저장하면 머리의 상태 칩과 사유 칩을 서버 판정으로 다시 읽는다', async () => {
    const user = userEvent.setup();
    const state = world({
      autoPlan: { status: 'DONE', reasons: [] },
      plans: [{ ...CONFIRMED_PLAN }],
      workOrders: [{ workOrderId: 9001, productionLineId: 31, located: false }],
      worklistState: 'ACTION_REQUIRED',
      worklistReasons: [{ code: 'WORK_ORDER_LOCATION_MISSING', workOrderCount: 1 }],
    });
    renderAt(`${WORKLIST}/${ORDER_NO}`, state);
    await currentStep(tp.steps.assign);
    expect(await screen.findByText(t.reasons.WORK_ORDER_LOCATION_MISSING)).toBeVisible();
    const editor = await screen.findByRole('region', {
      name: tp.assign.editorLabel('SYN-WO-9001'),
    });
    const save = await screen.findByRole('button', { name: tp.assign.actions.save });
    await waitFor(() => {
      expect(save).toBeEnabled();
    });
    /* 저장하면 서버 판정이 배포 대기로 바뀐다. 새로 읽기 전에는 화면이 이 값을 모른다. */
    state.worklistState = 'RELEASE_PENDING';
    delete state.worklistReasons;
    await user.click(save);

    expect(await screen.findByText(t.status.RELEASE_PENDING)).toBeVisible();
    expect(screen.queryByText(t.reasons.WORK_ORDER_LOCATION_MISSING)).toBeNull();
  });

  it('확정된 계획이 쓰는 Routing 개정이 이제 쓸 수 없어도 BOM·Routing 단계는 그 개정으로 통과한다', async () => {
    renderAt(
      `${WORKLIST}/${ORDER_NO}`,
      world({
        autoPlan: { status: 'DONE', reasons: [] },
        plans: [{ ...CONFIRMED_PLAN }],
        workOrders: [{ workOrderId: 9001, located: false }],
        routingDraft: true,
      }),
    );

    await currentStep(tp.steps.assign);
    expect(screen.queryByText(tp.remaining.select('Routing을'))).toBeNull();
  });

  it('처리 화면을 볼 권한이 없으면 다시 시도 없이 권한과 요청할 곳을 말한다', async () => {
    renderAt(`${WORKLIST}/${ORDER_NO}`, world({ forbidden: '/planning/production-orders' }));

    expect(await screen.findByText(t.access.forbiddenTitle)).toBeVisible();
    expect(screen.getByText(t.access.forbiddenNoMenu)).toBeVisible();
    expect(screen.queryByRole('button', { name: tp.retry })).toBeNull();
  });

  it('배포가 모두 성공하면 완료 화면을 보인다', async () => {
    const user = userEvent.setup();
    const state = world({
      autoPlan: { status: 'DONE', reasons: [] },
      plans: [{ ...CONFIRMED_PLAN }],
      workOrders: [{ workOrderId: 9001, productionLineId: 31, located: true }],
    });
    const server = renderAt(`${WORKLIST}/${ORDER_NO}`, state);
    await currentStep(tp.steps.release);

    await user.click(screen.getByRole('button', { name: tp.release.release }));

    expect(await screen.findByText(tp.done.success(ORDER_NO, 1))).toBeVisible();
    expect(server.writes).toContainEqual({
      method: 'POST',
      path: '/production/work-orders/9001:release',
      ifMatch: '1',
    });
  });

  it('배포가 일부 실패하면 그 W/O와 사유를 보이고 배포 확인 단계에 남는다', async () => {
    const user = userEvent.setup();
    const state = world({
      autoPlan: { status: 'DONE', reasons: [] },
      plans: [{ ...CONFIRMED_PLAN }],
      workOrders: [
        { workOrderId: 9001, productionLineId: 31, located: true },
        { workOrderId: 9002, productionLineId: 31, located: true },
      ],
      rejectRelease: [9002],
    });
    renderAt(`${WORKLIST}/${ORDER_NO}`, state);
    await currentStep(tp.steps.release);

    await user.click(screen.getByRole('button', { name: tp.release.release }));

    expect(
      await screen.findByText(tp.release.failed('SYN-WO-9002', '설비 점검이 막았습니다')),
    ).toBeVisible();
    expect(state.released).toEqual([9001]);
    await currentStep(tp.steps.release);
  });

  it('저장하지 않은 계획 변경은 [이전]과 작업함 복귀에서 확인한다', async () => {
    const user = userEvent.setup();
    renderAt(`${WORKLIST}/${ORDER_NO}`, world({ plans: [{ ...DRAFT_PLAN }] }));
    await currentStep(tp.steps.plan);
    const qty = screen.getByRole('textbox', {
      name: tp.plan.fieldLabel('PP-501', tp.plan.columns.plannedQty),
    });
    await user.clear(qty);
    await user.type(qty, '250');

    await user.click(actionBar());
    const stepDialog = await screen.findByRole('dialog', { name: tp.assign.discard.title });
    await user.click(within(stepDialog).getByRole('button', { name: messages.common.cancel }));
    await currentStep(tp.steps.plan);

    await user.click(screen.getByRole('button', { name: tp.back }));
    const leaveDialog = await screen.findByRole('dialog', { name: tp.assign.discard.title });
    await user.click(within(leaveDialog).getByRole('button', { name: tp.assign.discard.confirm }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(WORKLIST));
  });

  it('번호의 ERP W/O가 없으면 찾을 수 없다고 알린다', async () => {
    renderAt(`${WORKLIST}/SYN-PO-404`, world());
    expect(await screen.findByText(tp.notFound)).toBeVisible();
  });

  it('옛 생산계획 주소는 productionOrderId로 처리 화면에 넘긴다', async () => {
    renderAt('/production/production-plans?productionOrderId=701', world());
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(`${WORKLIST}/${ORDER_NO}`),
    );
  });

  it('옛 4M 배정 주소는 productionPlanId의 작업지시 목록 처리 화면에 넘긴다', async () => {
    renderAt(
      '/production/work-order-assignments?productionPlanId=501',
      world({ plans: [{ ...CONFIRMED_PLAN }] }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(`${WORKLIST}/${ORDER_NO}`),
    );
  });
});
