import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { toWorkOrderFact, useWorkOrderDetail, workOrderDetailPath, workOrderKeys } from './queries';
import { useUpdateWorkOrder } from './mutations';

const WORK_ORDER_ID = 702;
const DETAIL_PATH = '/production/work-orders/702';
const COLLECTION_PATH = '/production/work-orders';
const DETAIL_ETAG = '"synthetic-work-order-version-7"';
const COLLECTION_ETAG = '"synthetic-collection-version-3"';

const COMPLETE_BODY = {
  orderQty: 12.5,
  priorityNo: 2,
  plannedStartAt: '2026-08-22T08:00:00+09:00',
  plannedEndAt: '2026-08-22T16:00:00+09:00',
  plannedEquipmentId: 801,
  plannedMoldId: 802,
  plannedShiftId: 803,
  productionLineId: 804,
  responsibleWorkerId: 805,
  defaultWipLocationId: 806,
  defaultFgLocationId: 807,
  defaultScrapLocationId: 808,
  remarks: 'Synthetic assignment note',
};

const workOrder = (workOrderId: number) => ({
  workOrderId,
  workOrderNo: `SYN-WO-${workOrderId}`,
  productionPlanId: 501,
  routingOperationId: 601,
  itemId: 701,
  orderQty: 10,
  uomId: 901,
  workOrderTypeCode: 'SYN_NORMAL',
  priorityNo: 1,
  statusCode: 'SYN_DRAFT',
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
        body: request.method === 'PUT' ? await request.clone().json() : null,
      });
      return stub(request);
    },
    requests,
  };
};

const detailRoute = (): StubRoute => ({
  match: (request) => request.method === 'GET' && new URL(request.url).pathname === DETAIL_PATH,
  respond: () => jsonResponse(workOrder(WORK_ORDER_ID), { headers: { ETag: DETAIL_ETAG } }),
});

const updateRoute = (respond: () => Response): StubRoute => ({
  match: (request) => request.method === 'PUT' && new URL(request.url).pathname === DETAIL_PATH,
  respond,
});

const useUpdateAfterDetail = (onSuccess: (data: ReturnType<typeof toWorkOrderFact>) => void) => {
  const detail = useWorkOrderDetail(WORK_ORDER_ID);
  const mutation = useUpdateWorkOrder({ workOrderId: WORK_ORDER_ID, onSuccess });

  return { detail, mutation };
};

describe('useUpdateWorkOrder', () => {
  it('uses the item detail path as the canonical lock source', () => {
    expect(workOrderDetailPath(WORK_ORDER_ID)).toBe(DETAIL_PATH);
  });

  it('updates once with the same-resource ETag, preserves the generated body, maps the response, and invalidates all work-order reads', async () => {
    const onSuccess = vi.fn();
    const response = {
      ...workOrder(WORK_ORDER_ID),
      ...COMPLETE_BODY,
      parentWorkOrderId: 999,
      versionNo: 7,
    };
    const { fetch, requests } = recordingFetch([
      detailRoute(),
      updateRoute(() => jsonResponse(response)),
    ]);
    const { result, queryClient, apiClient } = renderHookWithProviders(
      () => useUpdateAfterDetail(onSuccess),
      { fetch },
    );
    const listKey = workOrderKeys.list(501, 1);
    const detailKey = workOrderKeys.detail(WORK_ORDER_ID + 1);
    const validationKey = workOrderKeys.validation(WORK_ORDER_ID + 1);
    queryClient.setQueryData(listKey, { items: [], page: { page: 1, size: 20, total: 0 } });
    queryClient.setQueryData(detailKey, workOrder(WORK_ORDER_ID + 1));
    queryClient.setQueryData(validationKey, { passed: true, findings: [] });
    apiClient.etags.capture(COLLECTION_PATH, COLLECTION_ETAG);

    await waitFor(() => expect(result.current.detail.isSuccess).toBe(true));

    act(() => {
      result.current.mutation.write(COMPLETE_BODY);
    });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(toWorkOrderFact(response)));

    const updates = requests.filter((request) => request.method === 'PUT');
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      method: 'PUT',
      url: { pathname: DETAIL_PATH, search: '' },
      body: COMPLETE_BODY,
    });
    expect(updates[0]?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/i);
    expect(updates[0]?.headers.get('If-Match')).toBe(DETAIL_ETAG);
    expect(updates[0]?.headers.get('If-Match')).not.toBe(COLLECTION_ETAG);
    expect(onSuccess.mock.calls[0]?.[0]).not.toHaveProperty('parentWorkOrderId');
    expect(onSuccess.mock.calls[0]?.[0]).not.toHaveProperty('versionNo');
    await waitFor(() => expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(true));
    expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(validationKey)?.isInvalidated).toBe(true);
  });

  it('does not dispatch a write without an item ETag and reports STALE_TOKEN', async () => {
    const requests: RecordedRequest[] = [];
    const fetch: StubFetch = async (request) => {
      requests.push({
        method: request.method,
        url: new URL(request.url),
        headers: request.headers,
        body: null,
      });
      throw new Error('A stale write must not reach fetch.');
    };
    const { result } = renderHookWithProviders(
      () => useUpdateWorkOrder({ workOrderId: WORK_ORDER_ID, onSuccess: vi.fn() }),
      { fetch },
    );

    act(() => {
      result.current.write(COMPLETE_BODY);
    });

    await waitFor(() =>
      expect(result.current.error).toMatchObject({
        kind: 'validation',
        errors: [{ scope: 'screen', code: 'STALE_TOKEN' }],
      }),
    );
    expect(requests).toHaveLength(0);
  });

  it('keeps a partial generated body partial without inventing optional values, nulls, or defaults', async () => {
    const partialBody = { plannedEquipmentId: 801 };
    const { fetch, requests } = recordingFetch([
      detailRoute(),
      updateRoute(() => jsonResponse({ ...workOrder(WORK_ORDER_ID), ...partialBody })),
    ]);
    const { result } = renderHookWithProviders(() => useUpdateAfterDetail(vi.fn()), { fetch });

    await waitFor(() => expect(result.current.detail.isSuccess).toBe(true));

    act(() => {
      result.current.mutation.write(partialBody);
    });

    await waitFor(() =>
      expect(requests.filter((request) => request.method === 'PUT')).toHaveLength(1),
    );

    const body = requests.find((request) => request.method === 'PUT')?.body;
    expect(body).toEqual(partialBody);
    expect(body).not.toHaveProperty('orderQty');
    expect(body).not.toHaveProperty('remarks');
    expect(body).not.toHaveProperty('productionLineId');
  });

  it('keeps only the first owned field error inline and leaves non-owned, screen, unknown, and duplicate errors in the banner', async () => {
    const onSuccess = vi.fn();
    const { fetch } = recordingFetch([
      detailRoute(),
      updateRoute(() =>
        jsonResponse(
          {
            errors: [
              {
                scope: 'field',
                field: 'plannedStartAt',
                code: 'RANGE',
                message: 'Synthetic first start error',
              },
              {
                scope: 'field',
                field: 'plannedStartAt',
                code: 'DUPLICATE',
                message: 'Synthetic duplicate start error',
              },
              {
                scope: 'field',
                field: 'orderQty',
                code: 'NOT_OWNED',
                message: 'Synthetic non-owned quantity error',
              },
              { scope: 'screen', code: 'ASSIGNMENT_CONFLICT', message: 'Synthetic screen error' },
              {
                scope: 'field',
                field: 'unknownField',
                code: 'UNKNOWN',
                message: 'Synthetic unknown field error',
              },
            ],
          },
          { status: 400 },
        ),
      ),
    ]);
    const { result, queryClient } = renderHookWithProviders(() => useUpdateAfterDetail(onSuccess), {
      fetch,
    });
    const listKey = workOrderKeys.list(501, 1);
    queryClient.setQueryData(listKey, { items: [], page: { page: 1, size: 20, total: 0 } });

    await waitFor(() => expect(result.current.detail.isSuccess).toBe(true));

    act(() => {
      result.current.mutation.write(COMPLETE_BODY);
    });

    await waitFor(() =>
      expect(result.current.mutation.fieldErrors).toEqual({
        plannedStartAt: 'Synthetic first start error',
      }),
    );
    expect(result.current.mutation.error).toEqual({
      kind: 'validation',
      errors: [
        {
          scope: 'field',
          field: 'plannedStartAt',
          code: 'DUPLICATE',
          message: 'Synthetic duplicate start error',
        },
        {
          scope: 'field',
          field: 'orderQty',
          code: 'NOT_OWNED',
          message: 'Synthetic non-owned quantity error',
        },
        { scope: 'screen', code: 'ASSIGNMENT_CONFLICT', message: 'Synthetic screen error' },
        {
          scope: 'field',
          field: 'unknownField',
          code: 'UNKNOWN',
          message: 'Synthetic unknown field error',
        },
      ],
    });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(false);
  });

  it('keeps a conflict as an error without accepting or invalidating', async () => {
    const onSuccess = vi.fn();
    const { fetch } = recordingFetch([
      detailRoute(),
      updateRoute(() =>
        jsonResponse(
          { conflictCause: 'user', message: 'Synthetic concurrent assignment' },
          { status: 409 },
        ),
      ),
    ]);
    const { result, queryClient } = renderHookWithProviders(() => useUpdateAfterDetail(onSuccess), {
      fetch,
    });
    const listKey = workOrderKeys.list(501, 1);
    queryClient.setQueryData(listKey, { items: [], page: { page: 1, size: 20, total: 0 } });

    await waitFor(() => expect(result.current.detail.isSuccess).toBe(true));

    act(() => {
      result.current.mutation.write(COMPLETE_BODY);
    });

    await waitFor(() =>
      expect(result.current.mutation.error).toEqual({
        kind: 'conflict',
        cause: 'user',
        message: 'Synthetic concurrent assignment',
      }),
    );
    expect(onSuccess).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(listKey)?.isInvalidated).toBe(false);
  });

  it('uses a new idempotency key for each settled explicit update attempt', async () => {
    const onSuccess = vi.fn();
    const { fetch, requests } = recordingFetch([
      detailRoute(),
      updateRoute(() => jsonResponse({ ...workOrder(WORK_ORDER_ID), ...COMPLETE_BODY })),
    ]);
    const { result } = renderHookWithProviders(() => useUpdateAfterDetail(onSuccess), { fetch });

    await waitFor(() => expect(result.current.detail.isSuccess).toBe(true));

    act(() => {
      result.current.mutation.write(COMPLETE_BODY);
    });
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.mutation.write(COMPLETE_BODY);
    });
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(2));

    const updates = requests.filter((request) => request.method === 'PUT');
    expect(updates).toHaveLength(2);
    expect(updates[0]?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/i);
    expect(updates[1]?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/i);
    expect(updates[1]?.headers.get('Idempotency-Key')).not.toBe(
      updates[0]?.headers.get('Idempotency-Key'),
    );
  });
});
