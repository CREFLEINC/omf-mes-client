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
  useWorkOrderReleaseCandidates,
  useWorkOrderReleaseDetail,
  workOrderReleaseDetailPath,
  workOrderReleaseKeys,
  type WorkOrderReleaseFilters,
} from './queries';

const LIST_PATH = '/production/work-orders';
const DETAIL_PATH = '/production/work-orders/702';

const filters = (overrides: Partial<WorkOrderReleaseFilters> = {}): WorkOrderReleaseFilters => ({
  statusCode: 'SYN-CALLER-STATUS',
  productionLineId: 901,
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
  workOrderTypeCode: 'SYN_NORMAL',
  priorityNo: 2,
  statusCode: 'SYN-CALLER-STATUS',
});

const releaseFact = (workOrderId: number) => ({
  ...workOrder(workOrderId),
  productionLineId: null,
  responsibleWorkerId: null,
  plannedStartAt: null,
  plannedEndAt: null,
  plannedEquipmentId: null,
  plannedMoldId: null,
  plannedShiftId: null,
  remarks: null,
  defaultWipLocationId: null,
  defaultFgLocationId: null,
  defaultScrapLocationId: null,
  operationSettingsSnapshot: null,
  releasedAt: null,
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

describe('workOrderReleaseKeys', () => {
  it('owns every caller filter fact and keeps candidates distinct from detail', () => {
    expect(workOrderReleaseKeys.all).toEqual(['work-order-release']);
    expect(workOrderReleaseKeys.candidates(filters())).toEqual([
      'work-order-release',
      'candidates',
      'SYN-CALLER-STATUS',
      901,
      '2026-08-23T09:00:00+09:00',
      '2026-08-23T17:00:00+09:00',
      3,
    ]);
    expect(workOrderReleaseKeys.candidates(filters({ page: 4 }))).not.toEqual(
      workOrderReleaseKeys.candidates(filters()),
    );
    expect(workOrderReleaseKeys.candidates(filters())).not.toEqual(
      workOrderReleaseKeys.detail(702),
    );
  });
});

describe('work-order release reads', () => {
  it('keeps null status and null detail ID idle without fallback requests', () => {
    const { fetch, requests } = recordingFetch([]);
    const { result } = renderHookWithProviders(
      () => ({
        candidates: useWorkOrderReleaseCandidates(filters({ statusCode: null })),
        detail: useWorkOrderReleaseDetail(null),
      }),
      { fetch },
    );

    expect(result.current.candidates.fetchStatus).toBe('idle');
    expect(result.current.candidates.data).toBeUndefined();
    expect(result.current.detail.fetchStatus).toBe('idle');
    expect(result.current.detail.data).toBeUndefined();
    expect(requests).toHaveLength(0);
  });

  it('gets candidates with exact caller filters, preserves order and page, and normalizes five release facts', async () => {
    const { fetch, requests } = recordingFetch([
      getRoute(LIST_PATH, {
        items: [
          {
            ...workOrder(702),
            defaultWipLocationId: 911,
            defaultFgLocationId: 912,
            defaultScrapLocationId: 913,
            operationSettingsSnapshot: {},
            releasedAt: '2026-08-23T08:30:00+09:00',
            versionNo: 9,
            completedAt: '2026-08-23T10:00:00+09:00',
          },
          workOrder(701),
        ],
        page: { page: 3, size: 20, total: 22 },
      }),
    ]);
    const { result } = renderHookWithProviders(() => useWorkOrderReleaseCandidates(filters()), {
      fetch,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(requests).toHaveLength(1);
    expect(Array.from(requests[0]?.searchParams.entries() ?? [])).toEqual([
      ['statusCode', 'SYN-CALLER-STATUS'],
      ['productionLineId', '901'],
      ['plannedStartFrom', '2026-08-23T09:00:00+09:00'],
      ['plannedStartTo', '2026-08-23T17:00:00+09:00'],
      ['page', '3'],
    ]);
    expect(result.current.data).toEqual({
      items: [
        {
          ...releaseFact(702),
          defaultWipLocationId: 911,
          defaultFgLocationId: 912,
          defaultScrapLocationId: 913,
          operationSettingsSnapshot: {},
          releasedAt: '2026-08-23T08:30:00+09:00',
        },
        releaseFact(701),
      ],
      page: { page: 3, size: 20, total: 22 },
    });
    expect(result.current.data?.items[0]).not.toHaveProperty('versionNo');
    expect(result.current.data?.items[0]).not.toHaveProperty('completedAt');
  });

  it('omits null optional filters without adding fallback query values', async () => {
    const { fetch, requests } = recordingFetch([
      getRoute(LIST_PATH, { items: [], page: { page: 1, size: 20, total: 0 } }),
    ]);
    const { result } = renderHookWithProviders(
      () =>
        useWorkOrderReleaseCandidates(
          filters({
            productionLineId: null,
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

  it('gets the exact detail path with no search and exposes only release facts', async () => {
    const { fetch, requests } = recordingFetch([
      getRoute(DETAIL_PATH, {
        ...workOrder(702),
        defaultWipLocationId: 911,
        defaultFgLocationId: 912,
        defaultScrapLocationId: 913,
        operationSettingsSnapshot: {},
        releasedAt: '2026-08-23T08:30:00+09:00',
        versionNo: 9,
        completedAt: '2026-08-23T10:00:00+09:00',
      }),
    ]);
    const { result } = renderHookWithProviders(() => useWorkOrderReleaseDetail(702), { fetch });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(workOrderReleaseDetailPath(702)).toBe(DETAIL_PATH);
    expect(requests[0]?.pathname).toBe(DETAIL_PATH);
    expect(requests[0]?.search).toBe('');
    expect(result.current.data).toEqual({
      ...releaseFact(702),
      defaultWipLocationId: 911,
      defaultFgLocationId: 912,
      defaultScrapLocationId: 913,
      operationSettingsSnapshot: {},
      releasedAt: '2026-08-23T08:30:00+09:00',
    });
    expect(result.current.data).not.toHaveProperty('versionNo');
    expect(result.current.data).not.toHaveProperty('completedAt');
  });

  it('keeps a candidate HTTP failure as a query error without synthetic data', async () => {
    const { fetch } = recordingFetch([
      getRoute(LIST_PATH, { message: 'Synthetic unavailable' }, 503),
    ]);
    const { result } = renderHookWithProviders(() => useWorkOrderReleaseCandidates(filters()), {
      fetch,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.data).toBeUndefined();
    expect(toApiError(result.current.error)).toMatchObject({ kind: 'http', status: 503 });
  });
});
