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
  useWorkOrderMolds,
  useWorkOrderWorkers,
  workOrderPeopleToolKeys,
} from './people-tool-queries';

const MOLDS_PATH = '/mdm/molds';
const WORKERS_PATH = '/mdm/workers';

interface RecordedRequest {
  method: string;
  url: URL;
}

const mold = (moldId: number) => ({
  moldId,
  plantId: 501,
  moldCode: `SYN-MOLD-${moldId}`,
  moldName: `Synthetic mold ${moldId}`,
  toolTypeCode: 'MOLD',
  statusCode: 'IN_SERVICE',
  isActive: true,
});

const worker = (workerId: number) => ({
  workerId,
  workerNo: `SYN-WORKER-${workerId}`,
  workerName: `Synthetic worker ${workerId}`,
  businessUnitId: 401,
  plantId: 501,
  statusCode: 'ACTIVE',
  isActive: true,
});

const recordingFetch = (routes: StubRoute[]): { fetch: StubFetch; requests: RecordedRequest[] } => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch(routes);

  return {
    requests,
    fetch: async (request) => {
      requests.push({ method: request.method, url: new URL(request.url) });
      return stub(request);
    },
  };
};

const getRoute = (pathname: string, body: unknown, status = 200): StubRoute => ({
  match: (request) => request.method === 'GET' && new URL(request.url).pathname === pathname,
  respond: () => jsonResponse(body, { status }),
});

describe('workOrderPeopleToolKeys', () => {
  it('separates mold and worker data by resource, plant, and page', () => {
    expect(workOrderPeopleToolKeys.molds(501, 1)).not.toEqual(
      workOrderPeopleToolKeys.molds(501, 2),
    );
    expect(workOrderPeopleToolKeys.workers(501, 1)).not.toEqual(
      workOrderPeopleToolKeys.workers(502, 1),
    );
    expect(workOrderPeopleToolKeys.molds(501, 1)).not.toEqual(
      workOrderPeopleToolKeys.workers(501, 1),
    );
  });
});

describe('work-order people and tool queries', () => {
  it('keeps both queries idle without a plant and sends zero fallback requests', () => {
    const { fetch, requests } = recordingFetch([]);
    const { result } = renderHookWithProviders(
      () => ({ molds: useWorkOrderMolds(null, 1), workers: useWorkOrderWorkers(null, 1) }),
      { fetch },
    );

    expect(result.current.molds.fetchStatus).toBe('idle');
    expect(result.current.molds.data).toBeUndefined();
    expect(result.current.workers.fetchStatus).toBe('idle');
    expect(result.current.workers.data).toBeUndefined();
    expect(requests).toHaveLength(0);
  });

  it('gets molds with the exact query and preserves order, page, truncation, raw facts, and null shots', async () => {
    const { fetch, requests } = recordingFetch([
      getRoute(MOLDS_PATH, {
        items: [
          { ...mold(702), availableShotCount: 900, isActive: false, cavityCount: 4 },
          { ...mold(701), cavityCount: 2 },
        ],
        page: { page: 2, size: 20, total: 3 },
      }),
    ]);
    const { result } = renderHookWithProviders(() => useWorkOrderMolds(501, 2), { fetch });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('GET');
    expect(requests[0]?.url.pathname).toBe(MOLDS_PATH);
    expect(Array.from(requests[0]?.url.searchParams.entries() ?? [])).toEqual([
      ['plantId', '501'],
      ['toolTypeCode', 'MOLD'],
      ['includeInactive', 'true'],
      ['page', '2'],
    ]);
    expect(result.current.data).toEqual({
      items: [
        { ...mold(702), availableShotCount: 900, isActive: false },
        { ...mold(701), availableShotCount: null },
      ],
      page: { page: 2, size: 20, total: 3 },
      truncated: true,
    });
  });

  it('gets workers with the exact query and preserves order, page, truncation, raw facts, and null department', async () => {
    const { fetch, requests } = recordingFetch([
      getRoute(WORKERS_PATH, {
        items: [
          { ...worker(602), departmentId: 301, appUserId: 999, isActive: false },
          worker(601),
        ],
        page: { page: 3, size: 20, total: 2 },
      }),
    ]);
    const { result } = renderHookWithProviders(() => useWorkOrderWorkers(501, 3), { fetch });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('GET');
    expect(requests[0]?.url.pathname).toBe(WORKERS_PATH);
    expect(Array.from(requests[0]?.url.searchParams.entries() ?? [])).toEqual([
      ['plantId', '501'],
      ['includeInactive', 'true'],
      ['page', '3'],
    ]);
    expect(result.current.data).toEqual({
      items: [
        { ...worker(602), departmentId: 301, isActive: false },
        { ...worker(601), departmentId: null },
      ],
      page: { page: 3, size: 20, total: 2 },
      truncated: false,
    });
  });

  it('keeps a mold HTTP error separate from successful worker data', async () => {
    const { fetch } = recordingFetch([
      getRoute(MOLDS_PATH, { message: 'Synthetic unavailable' }, 503),
      getRoute(WORKERS_PATH, { items: [worker(601)], page: { page: 1, size: 20, total: 1 } }),
    ]);
    const { result } = renderHookWithProviders(
      () => ({ molds: useWorkOrderMolds(501, 1), workers: useWorkOrderWorkers(501, 1) }),
      { fetch },
    );

    await waitFor(() => expect(result.current.molds.isError).toBe(true));

    expect(result.current.molds.data).toBeUndefined();
    expect(toApiError(result.current.molds.error)).toMatchObject({ kind: 'http', status: 503 });
    expect(result.current.workers.data).toEqual({
      items: [{ ...worker(601), departmentId: null }],
      page: { page: 1, size: 20, total: 1 },
      truncated: false,
    });
  });
});
