import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { toApiError } from '../../patterns/request';
import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import {
  useWorkOrderCloseCandidates,
  useWorkOrderCloseDetail,
  workOrderCloseDetailPath,
  workOrderCloseKeys,
  type WorkOrderCloseFilters,
} from './queries';

const LIST_PATH = '/production/work-orders';
const DETAIL_PATH = '/production/work-orders/702';

const filters = (overrides: Partial<WorkOrderCloseFilters> = {}): WorkOrderCloseFilters => ({
  statusCode: 'SYN-CALLER-STATUS',
  productionPlanId: 501,
  plannedStartFrom: '2026-08-23T09:00:00+09:00',
  plannedStartTo: '2026-08-23T17:00:00+09:00',
  page: 3,
  ...overrides,
});

const workOrder = (workOrderId: number) => ({
  workOrderId,
  workOrderNo: `SYN-WO-${workOrderId}`,
  productionPlanId: 501,
  routingOperationId: 601,
  itemId: 701,
  orderQty: 12.5,
  uomId: 801,
  workOrderTypeCode: 'SYN-NORMAL',
  priorityNo: 2,
  statusCode: 'SYN-CALLER-STATUS',
});

const closeFact = (workOrderId: number) => ({
  ...workOrder(workOrderId),
  productionLineId: null,
  responsibleWorkerId: null,
  plannedStartAt: null,
  plannedEndAt: null,
  plannedEquipmentId: null,
  plannedMoldId: null,
  plannedShiftId: null,
  remarks: null,
  completedAt: null,
  completionVarianceReasonCode: null,
  closedAt: null,
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

describe('workOrderCloseKeys', () => {
  it('owns every caller filter fact and keeps candidates distinct from detail', () => {
    const base = filters();
    const baseKey = workOrderCloseKeys.candidates(base);

    expect(workOrderCloseKeys.all).toEqual(['work-order-close']);
    expect(workOrderCloseKeys.candidates(base)).toEqual([
      'work-order-close',
      'candidates',
      'SYN-CALLER-STATUS',
      501,
      '2026-08-23T09:00:00+09:00',
      '2026-08-23T17:00:00+09:00',
      3,
    ]);
    [
      filters({ statusCode: 'SYN-OTHER-STATUS' }),
      filters({ productionPlanId: 502 }),
      filters({ plannedStartFrom: '2026-08-24T09:00:00+09:00' }),
      filters({ plannedStartTo: '2026-08-24T17:00:00+09:00' }),
      filters({ page: 4 }),
    ].forEach((changed) => expect(workOrderCloseKeys.candidates(changed)).not.toEqual(baseKey));
    expect(workOrderCloseKeys.candidates(base)).not.toEqual(workOrderCloseKeys.detail(702));
  });
});

describe('work-order close reads', () => {
  it('keeps null status and null detail ID idle without requests', () => {
    const { fetch, requests } = recordingFetch([]);
    const { result } = renderHookWithProviders(
      () => ({
        candidates: useWorkOrderCloseCandidates(filters({ statusCode: null })),
        detail: useWorkOrderCloseDetail(null),
      }),
      { fetch },
    );

    expect(result.current.candidates.fetchStatus).toBe('idle');
    expect(result.current.candidates.data).toBeUndefined();
    expect(result.current.detail.fetchStatus).toBe('idle');
    expect(result.current.detail.data).toBeUndefined();
    expect(requests).toHaveLength(0);
  });

  it('gets candidates with exact filters, preserves server order and page, and exposes only three close facts', async () => {
    const { fetch, requests } = recordingFetch([
      getRoute(LIST_PATH, {
        items: [
          {
            ...workOrder(702),
            completedAt: '2026-08-23T10:00:00+09:00',
            completionVarianceReasonCode: 'SYN-VARIANCE',
            closedAt: '2026-08-23T11:00:00+09:00',
            versionNo: 9,
            releasedAt: '2026-08-23T08:00:00+09:00',
            operationSettingsSnapshot: {},
          },
          workOrder(701),
        ],
        page: { page: 3, size: 20, total: 22 },
      }),
    ]);
    const { result } = renderHookWithProviders(() => useWorkOrderCloseCandidates(filters()), {
      fetch,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(Array.from(requests[0]?.searchParams.entries() ?? [])).toEqual([
      ['statusCode', 'SYN-CALLER-STATUS'],
      ['productionPlanId', '501'],
      ['plannedStartFrom', '2026-08-23T09:00:00+09:00'],
      ['plannedStartTo', '2026-08-23T17:00:00+09:00'],
      ['page', '3'],
    ]);
    expect(result.current.data).toEqual({
      items: [
        {
          ...closeFact(702),
          completedAt: '2026-08-23T10:00:00+09:00',
          completionVarianceReasonCode: 'SYN-VARIANCE',
          closedAt: '2026-08-23T11:00:00+09:00',
        },
        closeFact(701),
      ],
      page: { page: 3, size: 20, total: 22 },
    });
    expect(result.current.data?.items[0]).not.toHaveProperty('versionNo');
    expect(result.current.data?.items[0]).not.toHaveProperty('releasedAt');
    expect(result.current.data?.items[0]).not.toHaveProperty('operationSettingsSnapshot');
  });

  it('omits null optional candidate filters without fallback values', async () => {
    const { fetch, requests } = recordingFetch([
      getRoute(LIST_PATH, { items: [], page: { page: 1, size: 20, total: 0 } }),
    ]);
    const { result } = renderHookWithProviders(
      () =>
        useWorkOrderCloseCandidates(
          filters({
            productionPlanId: null,
            plannedStartFrom: null,
            plannedStartTo: null,
            page: 1,
          }),
        ),
      { fetch },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(Array.from(requests[0]?.searchParams.entries() ?? [])).toEqual([
      ['statusCode', 'SYN-CALLER-STATUS'],
      ['page', '1'],
    ]);
  });

  it('gets the exact detail path without search, exposes only close facts, and keeps failures without data', async () => {
    const { fetch, requests } = recordingFetch([
      getRoute(DETAIL_PATH, {
        ...workOrder(702),
        completedAt: '2026-08-23T10:00:00+09:00',
        completionVarianceReasonCode: 'SYN-VARIANCE',
        closedAt: '2026-08-23T11:00:00+09:00',
        versionNo: 9,
        releasedAt: '2026-08-23T08:00:00+09:00',
        operationSettingsSnapshot: {},
        parentWorkOrderId: 901,
        completedQty: 12.5,
      }),
    ]);
    const { result } = renderHookWithProviders(() => useWorkOrderCloseDetail(702), { fetch });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(workOrderCloseDetailPath(702)).toBe(DETAIL_PATH);
    expect(requests[0]?.pathname).toBe(DETAIL_PATH);
    expect(requests[0]?.search).toBe('');
    expect(result.current.data).toEqual({
      ...closeFact(702),
      completedAt: '2026-08-23T10:00:00+09:00',
      completionVarianceReasonCode: 'SYN-VARIANCE',
      closedAt: '2026-08-23T11:00:00+09:00',
    });
    expect(result.current.data).not.toHaveProperty('versionNo');
    expect(result.current.data).not.toHaveProperty('completedQty');
    expect(result.current.data).not.toHaveProperty('operationSettingsSnapshot');

    const failed = recordingFetch([
      getRoute(DETAIL_PATH, { message: 'Synthetic unavailable' }, 503),
    ]);
    const errorResult = renderHookWithProviders(() => useWorkOrderCloseDetail(702), {
      fetch: failed.fetch,
    });

    await waitFor(() => expect(errorResult.result.current.isError).toBe(true));

    expect(errorResult.result.current.data).toBeUndefined();
    expect(toApiError(errorResult.result.current.error)).toMatchObject({
      kind: 'http',
      status: 503,
    });
  });
});
