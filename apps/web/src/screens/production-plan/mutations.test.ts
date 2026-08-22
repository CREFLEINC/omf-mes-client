import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { productionPlanKeys, toProductionPlanFact } from './queries';
import { useCreateProductionPlan } from './mutations';

const CREATE_PATH = '/planning/production-plans';

const REQUIRED_BODY = {
  productionOrderId: 4201,
  planDate: '2026-08-22',
  plannedQty: 24.5,
  uomId: 4301,
  bomId: 4401,
  routingId: 4501,
};

const COMPLETE_BODY = {
  ...REQUIRED_BODY,
  plannedLineId: 4601,
  splitOfPlanId: { sourcePlanId: 4701, reasonCode: 'SPLIT' },
  remarks: 'Synthetic plan note',
};

const productionPlan = (productionPlanId: number) => ({
  productionPlanId,
  ...REQUIRED_BODY,
  planNo: `PLAN-${String(productionPlanId)}`,
  statusCode: 'DRAFT',
});

interface RecordedRequest {
  method: string;
  url: URL;
  headers: Headers;
  body: unknown;
}

const recordingFetch = (routes: StubRoute[]): { fetch: StubFetch; requests: RecordedRequest[] } => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch(routes);

  return {
    fetch: async (request) => {
      requests.push({
        method: request.method,
        url: new URL(request.url),
        headers: request.headers,
        body: await request.clone().json(),
      });
      return stub(request);
    },
    requests,
  };
};

const createRoute = (respond: () => Response): StubRoute => ({
  match: (request) => request.method === 'POST' && new URL(request.url).pathname === CREATE_PATH,
  respond,
});

describe('useCreateProductionPlan', () => {
  it('sends the exact POST request with all optional values and no If-Match', async () => {
    const { fetch, requests } = recordingFetch([
      createRoute(() => jsonResponse(productionPlan(4801), { status: 201 })),
    ]);
    const { result } = renderHookWithProviders(
      () => useCreateProductionPlan({ onSuccess: vi.fn() }),
      { fetch },
    );

    act(() => {
      result.current.write(COMPLETE_BODY);
    });

    await waitFor(() => expect(requests).toHaveLength(1));

    expect(requests[0]).toMatchObject({
      method: 'POST',
      url: { pathname: CREATE_PATH, search: '' },
      body: COMPLETE_BODY,
    });
    expect(requests[0]?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/i);
    expect(requests[0]?.headers.has('If-Match')).toBe(false);
  });

  it('omits optional values instead of inventing nulls or defaults', async () => {
    const { fetch, requests } = recordingFetch([
      createRoute(() => jsonResponse(productionPlan(4802), { status: 201 })),
    ]);
    const { result } = renderHookWithProviders(
      () => useCreateProductionPlan({ onSuccess: vi.fn() }),
      { fetch },
    );

    act(() => {
      result.current.write(REQUIRED_BODY);
    });

    await waitFor(() => expect(requests).toHaveLength(1));

    expect(requests[0]?.body).toEqual(REQUIRED_BODY);
    expect(requests[0]?.body).not.toHaveProperty('plannedLineId');
    expect(requests[0]?.body).not.toHaveProperty('splitOfPlanId');
    expect(requests[0]?.body).not.toHaveProperty('remarks');
  });

  it('maps the 201 response to the shared fact and invalidates all plan queries', async () => {
    const onSuccess = vi.fn();
    const response = {
      ...productionPlan(4803),
      plannedLineId: 4601,
      confirmedAt: '2026-08-22T08:00:00+09:00',
      confirmedBy: 4901,
      remarks: 'Synthetic response note',
      versionNo: 3,
    };
    const { fetch } = recordingFetch([createRoute(() => jsonResponse(response, { status: 201 }))]);
    const { result, queryClient } = renderHookWithProviders(
      () => useCreateProductionPlan({ onSuccess }),
      { fetch },
    );
    const listKey = productionPlanKeys.list(REQUIRED_BODY.productionOrderId, 1);
    queryClient.setQueryData(listKey, { items: [], page: { page: 1, size: 20, total: 0 } });

    act(() => {
      result.current.write(REQUIRED_BODY);
    });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(toProductionPlanFact(response)));
    expect(onSuccess.mock.calls[0]?.[0]).not.toHaveProperty('confirmedBy');
    expect(onSuccess.mock.calls[0]?.[0]).not.toHaveProperty('versionNo');
    await waitFor(() => expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true));
  });

  it('uses distinct non-empty keys for two settled explicit attempts', async () => {
    const { fetch, requests } = recordingFetch([
      createRoute(() => jsonResponse(productionPlan(4804), { status: 201 })),
    ]);
    const { result } = renderHookWithProviders(
      () => useCreateProductionPlan({ onSuccess: vi.fn() }),
      { fetch },
    );

    act(() => {
      result.current.write(REQUIRED_BODY);
    });
    await waitFor(() => expect(requests).toHaveLength(1));

    act(() => {
      result.current.write(REQUIRED_BODY);
    });
    await waitFor(() => expect(requests).toHaveLength(2));

    const keys = requests.map((request) => request.headers.get('Idempotency-Key'));
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/i);
    expect(keys[1]).toMatch(/^[0-9a-f-]{36}$/i);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('splits known 400 fields from unknown screen errors without accepting or invalidating', async () => {
    const onSuccess = vi.fn();
    const { fetch } = recordingFetch([
      createRoute(() =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'field',
                field: 'plannedQty',
                code: 'RANGE',
                message: 'Synthetic quantity error',
              },
              { scope: 'screen', code: 'PLAN_CONFLICT', message: 'Synthetic plan error' },
            ],
          },
          { status: 400 },
        ),
      ),
    ]);
    const { result, queryClient } = renderHookWithProviders(
      () => useCreateProductionPlan({ onSuccess }),
      { fetch },
    );
    const listKey = productionPlanKeys.list(REQUIRED_BODY.productionOrderId, 1);
    queryClient.setQueryData(listKey, { items: [], page: { page: 1, size: 20, total: 0 } });

    act(() => {
      result.current.write(REQUIRED_BODY);
    });

    await waitFor(() =>
      expect(result.current.fieldErrors).toEqual({ plannedQty: 'Synthetic quantity error' }),
    );
    expect(result.current.error).toMatchObject({
      kind: 'validation',
      errors: [{ scope: 'screen', code: 'PLAN_CONFLICT', message: 'Synthetic plan error' }],
    });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(false);
  });

  it('keeps network failure as a banner error without accepting or invalidating', async () => {
    const onSuccess = vi.fn();
    const fetch: StubFetch = async () => {
      throw new TypeError('Synthetic network failure');
    };
    const { result, queryClient } = renderHookWithProviders(
      () => useCreateProductionPlan({ onSuccess }),
      { fetch },
    );
    const listKey = productionPlanKeys.list(REQUIRED_BODY.productionOrderId, 1);
    queryClient.setQueryData(listKey, { items: [], page: { page: 1, size: 20, total: 0 } });

    act(() => {
      result.current.write(REQUIRED_BODY);
    });

    await waitFor(() => expect(result.current.error).toEqual({ kind: 'network' }));
    expect(result.current.fieldErrors).toEqual({});
    expect(onSuccess).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(false);
  });
});
