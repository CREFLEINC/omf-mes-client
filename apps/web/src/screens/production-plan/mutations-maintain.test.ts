import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import {
  productionPlanDetailPath,
  productionPlanKeys,
  toProductionPlanFact,
  useProductionPlanDetail,
} from './queries';
import { useDeleteProductionPlan, useUpdateProductionPlan } from './mutations';

const PRODUCTION_PLAN_ID = 5101;
const DETAIL_PATH = '/planning/production-plans/5101';
const ETAG = '"synthetic-plan-version-5"';

const UPDATE_BODY = {
  planDate: '2026-08-22',
  plannedQty: 32.5,
  bomId: 5201,
  routingId: 5301,
  plannedLineId: 5401,
  remarks: 'Synthetic revised plan note',
};

const productionPlan = (productionPlanId: number) => ({
  productionPlanId,
  productionOrderId: 5001,
  planNo: `PLAN-${String(productionPlanId)}`,
  planDate: '2026-08-22',
  plannedQty: 24.5,
  uomId: 5501,
  bomId: 5201,
  routingId: 5301,
  statusCode: 'DRAFT',
});

interface RecordedRequest {
  method: string;
  url: URL;
  headers: Headers;
  body: string;
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
        body: await request.clone().text(),
      });
      return stub(request);
    },
    requests,
  };
};

const detailRoute = (): StubRoute => ({
  match: (request) => request.method === 'GET' && new URL(request.url).pathname === DETAIL_PATH,
  respond: () => jsonResponse(productionPlan(PRODUCTION_PLAN_ID), { headers: { ETag: ETAG } }),
});

const updateRoute = (respond: () => Response): StubRoute => ({
  match: (request) => request.method === 'PUT' && new URL(request.url).pathname === DETAIL_PATH,
  respond,
});

const deleteRoute = (respond: () => Response): StubRoute => ({
  match: (request) => request.method === 'DELETE' && new URL(request.url).pathname === DETAIL_PATH,
  respond,
});

const useUpdateAfterDetail = (
  onSuccess: (data: ReturnType<typeof toProductionPlanFact>) => void,
) => {
  const detail = useProductionPlanDetail(PRODUCTION_PLAN_ID);
  const mutation = useUpdateProductionPlan({ productionPlanId: PRODUCTION_PLAN_ID, onSuccess });

  return { detail, mutation };
};

const useDeleteAfterDetail = (onSuccess: () => void) => {
  const detail = useProductionPlanDetail(PRODUCTION_PLAN_ID);
  const mutation = useDeleteProductionPlan({ productionPlanId: PRODUCTION_PLAN_ID, onSuccess });

  return { detail, mutation };
};

describe('production plan maintain mutations', () => {
  it('uses the item detail path as the canonical lock source', () => {
    expect(productionPlanDetailPath(PRODUCTION_PLAN_ID)).toBe(DETAIL_PATH);
  });

  it('updates with the captured same-resource ETag, maps the response, and invalidates plan queries', async () => {
    const onSuccess = vi.fn();
    const response = { ...productionPlan(PRODUCTION_PLAN_ID), ...UPDATE_BODY };
    const { fetch, requests } = recordingFetch([
      detailRoute(),
      updateRoute(() => jsonResponse(response)),
    ]);
    const { result, queryClient } = renderHookWithProviders(() => useUpdateAfterDetail(onSuccess), {
      fetch,
    });
    const listKey = productionPlanKeys.list(5001, 1);
    const inactiveDetailKey = productionPlanKeys.detail(PRODUCTION_PLAN_ID + 1);
    queryClient.setQueryData(listKey, { items: [], page: { page: 1, size: 20, total: 0 } });
    queryClient.setQueryData(inactiveDetailKey, productionPlan(PRODUCTION_PLAN_ID + 1));

    await waitFor(() => expect(result.current.detail.isSuccess).toBe(true));

    act(() => {
      result.current.mutation.write(UPDATE_BODY);
    });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(toProductionPlanFact(response)));

    const request = requests.find((candidate) => candidate.method === 'PUT');
    expect(request).toMatchObject({
      method: 'PUT',
      url: { pathname: DETAIL_PATH, search: '' },
      body: JSON.stringify(UPDATE_BODY),
    });
    expect(request?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/i);
    expect(request?.headers.get('If-Match')).toBe(ETAG);
    await waitFor(() => expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true));
    expect(queryClient.getQueryState(inactiveDetailKey)?.isInvalidated).toBe(true);
  });

  it('does not dispatch an update without a captured ETag and reports STALE_TOKEN', async () => {
    const fetch: StubFetch = async () => {
      throw new Error('An update without an ETag must not reach fetch.');
    };
    const { result } = renderHookWithProviders(
      () => useUpdateProductionPlan({ productionPlanId: PRODUCTION_PLAN_ID, onSuccess: vi.fn() }),
      { fetch },
    );

    act(() => {
      result.current.write(UPDATE_BODY);
    });

    await waitFor(() =>
      expect(result.current.error).toMatchObject({
        kind: 'validation',
        errors: [{ scope: 'screen', code: 'STALE_TOKEN' }],
      }),
    );
  });

  it('splits known update fields from screen errors without accepting or invalidating', async () => {
    const onSuccess = vi.fn();
    const { fetch } = recordingFetch([
      detailRoute(),
      updateRoute(() =>
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
    const { result, queryClient } = renderHookWithProviders(() => useUpdateAfterDetail(onSuccess), {
      fetch,
    });
    const listKey = productionPlanKeys.list(5001, 1);
    queryClient.setQueryData(listKey, { items: [], page: { page: 1, size: 20, total: 0 } });

    await waitFor(() => expect(result.current.detail.isSuccess).toBe(true));

    act(() => {
      result.current.mutation.write(UPDATE_BODY);
    });

    await waitFor(() =>
      expect(result.current.mutation.fieldErrors).toEqual({
        plannedQty: 'Synthetic quantity error',
      }),
    );
    expect(result.current.mutation.error).toEqual({
      kind: 'validation',
      errors: [{ scope: 'screen', code: 'PLAN_CONFLICT', message: 'Synthetic plan error' }],
    });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(false);
  });

  it('deletes with the captured same-resource ETag, no body, and invalidates all plan queries', async () => {
    const onSuccess = vi.fn();
    const { fetch, requests } = recordingFetch([
      detailRoute(),
      deleteRoute(() => new Response(null, { status: 204 })),
    ]);
    const { result, queryClient } = renderHookWithProviders(() => useDeleteAfterDetail(onSuccess), {
      fetch,
    });
    const listKey = productionPlanKeys.list(5001, 1);
    const inactiveDetailKey = productionPlanKeys.detail(PRODUCTION_PLAN_ID + 1);
    queryClient.setQueryData(listKey, { items: [], page: { page: 1, size: 20, total: 0 } });
    queryClient.setQueryData(inactiveDetailKey, productionPlan(PRODUCTION_PLAN_ID + 1));

    await waitFor(() => expect(result.current.detail.isSuccess).toBe(true));

    act(() => {
      result.current.mutation.write();
    });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));

    const request = requests.find((candidate) => candidate.method === 'DELETE');
    expect(request).toMatchObject({ method: 'DELETE', url: { pathname: DETAIL_PATH, search: '' } });
    expect(request?.body).toBe('');
    expect(request?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/i);
    expect(request?.headers.get('If-Match')).toBe(ETAG);
    await waitFor(() => expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true));
    expect(queryClient.getQueryState(inactiveDetailKey)?.isInvalidated).toBe(true);
  });

  it('preserves a delete conflict without a success callback or invalidation', async () => {
    const onSuccess = vi.fn();
    const { fetch } = recordingFetch([
      detailRoute(),
      deleteRoute(() =>
        jsonResponse(
          { conflictCause: 'user', message: 'Synthetic concurrent edit' },
          { status: 409 },
        ),
      ),
    ]);
    const { result, queryClient } = renderHookWithProviders(() => useDeleteAfterDetail(onSuccess), {
      fetch,
    });
    const listKey = productionPlanKeys.list(5001, 1);
    queryClient.setQueryData(listKey, { items: [], page: { page: 1, size: 20, total: 0 } });

    await waitFor(() => expect(result.current.detail.isSuccess).toBe(true));

    act(() => {
      result.current.mutation.write();
    });

    await waitFor(() =>
      expect(result.current.mutation.error).toEqual({
        kind: 'conflict',
        cause: 'user',
        message: 'Synthetic concurrent edit',
      }),
    );
    expect(onSuccess).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(false);
  });
});
