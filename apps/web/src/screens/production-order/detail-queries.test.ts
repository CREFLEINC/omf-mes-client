import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import {
  productionOrderDetailKeys,
  useProductionOrderPlans,
  useProductionOrderWorkOrders,
} from './detail-queries';

const PLANS_PATH = '/planning/production-plans';
const WORK_ORDERS_PATH = '/production/work-orders';
const page = <T>(items: T[]) => ({ items, page: { page: 1, size: 25, total: items.length } });
const plan = (productionPlanId: number, productionOrderId = 701) => ({
  productionPlanId,
  productionOrderId,
  planNo: `SYN-PLAN-${String(productionPlanId)}`,
  planDate: '2026-08-25',
  plannedQty: 12.5,
  uomId: 8101,
  bomId: 8201,
  routingId: 8301,
  statusCode: 'SYN-DRAFT',
});
const planFact = (productionPlanId: number, plannedLineId: number | null = null) => ({
  productionPlanId,
  productionOrderId: 701,
  planNo: `SYN-PLAN-${String(productionPlanId)}`,
  planDate: '2026-08-25',
  plannedQty: 12.5,
  uomId: 8101,
  plannedLineId,
  statusCode: 'SYN-DRAFT',
});
const workOrder = (workOrderId: number, productionPlanId = 501) => ({
  workOrderId,
  workOrderNo: `SYN-WO-${String(workOrderId)}`,
  productionPlanId,
  routingOperationId: 6101,
  itemId: 7101,
  orderQty: 8.5,
  uomId: 8101,
  workOrderTypeCode: 'SYN-NORMAL',
  priorityNo: 1,
  statusCode: 'SYN-RELEASED',
});

const recordingFetch = (routes: StubRoute[]) => {
  const requests: URL[] = [];
  const stub = createStubFetch(routes);
  const fetch: StubFetch = async (request) => {
    requests.push(new URL(request.url));
    return stub(request);
  };
  return { fetch, requests };
};

const route = (pathname: string, body: unknown, status = 200): StubRoute => ({
  match: (request) => request.method === 'GET' && new URL(request.url).pathname === pathname,
  respond: () => jsonResponse(body, { status }),
});

const renderLists = (productionOrderId: number | null, fetch: StubFetch) =>
  renderHookWithProviders(
    () => ({
      plans: useProductionOrderPlans(productionOrderId),
      workOrders: useProductionOrderWorkOrders(productionOrderId),
    }),
    { fetch },
  );

describe('production-order detail list queries', () => {
  it('선택이 없으면 두 요청 모두 idle이며 ID와 목록 종류별 key를 격리한다', () => {
    const { fetch, requests } = recordingFetch([]);
    const { result } = renderLists(null, fetch);

    expect(result.current.plans.fetchStatus).toBe('idle');
    expect(result.current.workOrders.fetchStatus).toBe('idle');
    expect(requests).toHaveLength(0);
    expect(productionOrderDetailKeys.plans(701)).not.toEqual(productionOrderDetailKeys.plans(702));
    expect(productionOrderDetailKeys.plans(701)).not.toEqual(
      productionOrderDetailKeys.workOrders(701),
    );
  });

  it('선택 P/O만 조회해 서버 순서·쪽과 화면 최소 사실을 보존한다', async () => {
    const { fetch, requests } = recordingFetch([
      route(
        PLANS_PATH,
        page([
          { ...plan(502), plannedLineId: 8401, confirmedAt: '2026-08-25T09:00:00+09:00' },
          plan(501),
        ]),
      ),
      route(
        WORK_ORDERS_PATH,
        page([
          {
            ...workOrder(602, 502),
            productionLineId: 8401,
            plannedStartAt: '2026-08-25T10:00:00+09:00',
            plannedEndAt: '2026-08-25T11:00:00+09:00',
          },
          workOrder(601),
        ]),
      ),
    ]);
    const { result } = renderLists(701, fetch);

    await waitFor(() => expect(result.current.plans.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.workOrders.isSuccess).toBe(true));

    expect(requests.map((request) => [request.pathname, request.search])).toEqual([
      [PLANS_PATH, '?productionOrderId=701'],
      [WORK_ORDERS_PATH, '?productionOrderId=701'],
    ]);
    expect(result.current.plans.data).toEqual({
      items: [planFact(502, 8401), planFact(501)],
      page: { page: 1, size: 25, total: 2 },
    });
    expect(result.current.workOrders.data).toEqual({
      items: [
        {
          workOrderId: 602,
          workOrderNo: 'SYN-WO-602',
          productionPlanId: 502,
          itemId: 7101,
          orderQty: 8.5,
          uomId: 8101,
          workOrderTypeCode: 'SYN-NORMAL',
          productionLineId: 8401,
          plannedStartAt: '2026-08-25T10:00:00+09:00',
          plannedEndAt: '2026-08-25T11:00:00+09:00',
          statusCode: 'SYN-RELEASED',
        },
        {
          workOrderId: 601,
          workOrderNo: 'SYN-WO-601',
          productionPlanId: 501,
          itemId: 7101,
          orderQty: 8.5,
          uomId: 8101,
          workOrderTypeCode: 'SYN-NORMAL',
          productionLineId: null,
          plannedStartAt: null,
          plannedEndAt: null,
          statusCode: 'SYN-RELEASED',
        },
      ],
      page: { page: 1, size: 25, total: 2 },
    });
  });

  it('HTTP와 네트워크 실패를 빈 성공으로 바꾸지 않는다', async () => {
    const http = recordingFetch([
      route(PLANS_PATH, { message: 'synthetic plan failure' }, 500),
      route(WORK_ORDERS_PATH, { message: 'synthetic W/O failure' }, 503),
    ]);
    const httpResult = renderLists(701, http.fetch).result;
    await waitFor(() => expect(httpResult.current.plans.isError).toBe(true));
    await waitFor(() => expect(httpResult.current.workOrders.isError).toBe(true));
    expect([httpResult.current.plans.data, httpResult.current.workOrders.data]).toEqual([
      undefined,
      undefined,
    ]);

    const networkResult = renderLists(701, async () => {
      throw new TypeError('synthetic network failure');
    }).result;
    await waitFor(() => expect(networkResult.current.plans.isError).toBe(true));
    await waitFor(() => expect(networkResult.current.workOrders.isError).toBe(true));
    expect([networkResult.current.plans.data, networkResult.current.workOrders.data]).toEqual([
      undefined,
      undefined,
    ]);
  });

  it('선택 변경 중 이전 ID의 성공 데이터를 새 ID 결과로 노출하지 않는다', async () => {
    let selectedId = 701;
    const requests: URL[] = [];
    const fetch: StubFetch = async (request) => {
      const url = new URL(request.url);
      requests.push(url);
      const id = Number(url.searchParams.get('productionOrderId'));
      if (id === 702) return new Promise<Response>(() => undefined);
      return jsonResponse(
        url.pathname === PLANS_PATH ? page([plan(501, id)]) : page([workOrder(601)]),
      );
    };
    const { result, rerender } = renderHookWithProviders(
      () => ({
        plans: useProductionOrderPlans(selectedId),
        workOrders: useProductionOrderWorkOrders(selectedId),
      }),
      { fetch },
    );
    await waitFor(() => expect(result.current.workOrders.isSuccess).toBe(true));

    selectedId = 702;
    rerender();
    await waitFor(() => expect(requests).toHaveLength(4));

    expect(result.current.plans.data).toBeUndefined();
    expect(result.current.workOrders.data).toBeUndefined();
  });
});
