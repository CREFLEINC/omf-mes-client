import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { useWorkOrderScreenContext } from './screen-context';

const planPath = (planId: number): string => `/planning/production-plans/${planId}`;
const orderPath = (orderId: number): string => `/planning/production-orders/${orderId}`;

const plan = (planId: number, productionOrderId: number) => ({
  productionPlanId: planId,
  productionOrderId,
  planNo: `SYN-PLAN-${planId}`,
  planDate: '2026-08-23',
  plannedQty: 12.5,
  uomId: 801,
  bomId: 901,
  routingId: 902,
  statusCode: 'SYN_DRAFT',
});

const order = (productionOrderId: number, plantId: number | null) => ({
  productionOrderId,
  productionOrderNo: `SYN-PO-${productionOrderId}`,
  plantId,
  itemId: 701,
  orderQty: 12.5,
  uomId: 801,
  statusCode: 'SYN_RELEASED',
});

const recordingFetch = (routes: StubRoute[]): { fetch: StubFetch; requests: URL[] } => {
  const requests: URL[] = [];
  const stub = createStubFetch(routes);

  return {
    requests,
    fetch: async (request) => {
      requests.push(new URL(request.url));
      return stub(request);
    },
  };
};

const getRoute = (pathname: string, body: unknown, status = 200): StubRoute => ({
  match: (request) => request.method === 'GET' && new URL(request.url).pathname === pathname,
  respond: () => jsonResponse(body, { status }),
});

describe('useWorkOrderScreenContext', () => {
  it('keeps both detail requests idle without a selected plan', () => {
    const { fetch, requests } = recordingFetch([]);
    const { result } = renderHookWithProviders(() => useWorkOrderScreenContext(null), { fetch });

    expect(result.current.productionPlanQuery.fetchStatus).toBe('idle');
    expect(result.current.productionOrderQuery.fetchStatus).toBe('idle');
    expect(result.current.plantId).toBeNull();
    expect(requests).toHaveLength(0);
  });

  it('reads the selected plan first, then its exact production order and plant', async () => {
    const { fetch, requests } = recordingFetch([
      getRoute(planPath(301), plan(301, 401)),
      getRoute(orderPath(401), order(401, 501)),
    ]);
    const { result } = renderHookWithProviders(() => useWorkOrderScreenContext(301), { fetch });

    await waitFor(() => expect(result.current.plantId).toBe(501));

    expect(requests.map((request) => [request.pathname, request.search])).toEqual([
      [planPath(301), ''],
      [orderPath(401), ''],
    ]);
    expect(result.current.productionPlanQuery.data?.productionOrderId).toBe(401);
    expect(result.current.productionOrderQuery.data?.plantId).toBe(501);
  });

  it('keeps a failed plan visible without starting a production order request', async () => {
    const { fetch, requests } = recordingFetch([
      getRoute(planPath(301), { message: 'synthetic plan failure' }, 404),
    ]);
    const { result } = renderHookWithProviders(() => useWorkOrderScreenContext(301), { fetch });

    await waitFor(() => expect(result.current.productionPlanQuery.isError).toBe(true));

    expect(result.current.productionOrderQuery.fetchStatus).toBe('idle');
    expect(result.current.plantId).toBeNull();
    expect(requests.map((request) => request.pathname)).toEqual([planPath(301)]);
  });

  it('does not follow a production order from a mismatched plan response', async () => {
    const { fetch, requests } = recordingFetch([getRoute(planPath(301), plan(999, 777))]);
    const { result } = renderHookWithProviders(() => useWorkOrderScreenContext(301), { fetch });

    await waitFor(() => expect(result.current.productionPlanQuery.isSuccess).toBe(true));

    expect(result.current.productionOrderQuery.fetchStatus).toBe('idle');
    expect(result.current.plantId).toBeNull();
    expect(requests.map((request) => request.pathname)).toEqual([planPath(301)]);
  });

  it('keeps a failed production order visible without a synthetic plant', async () => {
    const { fetch } = recordingFetch([
      getRoute(planPath(301), plan(301, 401)),
      getRoute(orderPath(401), { message: 'synthetic order failure' }, 503),
    ]);
    const { result } = renderHookWithProviders(() => useWorkOrderScreenContext(301), { fetch });

    await waitFor(() => expect(result.current.productionOrderQuery.isError).toBe(true));

    expect(result.current.productionPlanQuery.isSuccess).toBe(true);
    expect(result.current.plantId).toBeNull();
  });

  it('follows a changed plan to its own production order without retaining a stale plant', async () => {
    let selectedPlanId: number | null = 301;
    const { fetch, requests } = recordingFetch([
      getRoute(planPath(301), plan(301, 401)),
      getRoute(orderPath(401), order(401, 501)),
      getRoute(planPath(302), plan(302, 402)),
      getRoute(orderPath(402), order(402, 502)),
    ]);
    const { result, rerender } = renderHookWithProviders(
      () => useWorkOrderScreenContext(selectedPlanId),
      { fetch },
    );

    await waitFor(() => expect(result.current.plantId).toBe(501));
    selectedPlanId = 302;
    rerender();

    expect(result.current.plantId).toBeNull();
    await waitFor(() => expect(result.current.plantId).toBe(502));
    expect(requests.map((request) => request.pathname)).toEqual([
      planPath(301),
      orderPath(401),
      planPath(302),
      orderPath(402),
    ]);
  });

  it('keeps a contract null plant as null', async () => {
    const { fetch } = recordingFetch([
      getRoute(planPath(301), plan(301, 401)),
      getRoute(orderPath(401), order(401, null)),
    ]);
    const { result } = renderHookWithProviders(() => useWorkOrderScreenContext(301), { fetch });

    await waitFor(() => expect(result.current.productionOrderQuery.isSuccess).toBe(true));
    expect(result.current.plantId).toBeNull();
  });
});
