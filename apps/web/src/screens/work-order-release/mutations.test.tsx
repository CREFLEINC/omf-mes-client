import type { components } from '@omf-mes/api-client';
import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { workOrderKeys } from '../work-order/queries';
import { useReleaseWorkOrder } from './mutations';
import {
  toWorkOrderReleaseFact,
  workOrderReleaseDetailPath,
  workOrderReleaseKeys,
} from './queries';

type WorkOrderRelease = components['schemas']['WorkOrderRelease'];

const WORK_ORDER_ID = 704;
const DETAIL_PATH = '/production/work-orders/704';
const RELEASE_PATH = '/production/work-orders/704:release';
const DETAIL_ETAG = '"synthetic-release-version-12"';
const RELEASE_BODY: WorkOrderRelease = { lotSize: 25, handoverNote: '합성 교대 전달사항' };

const workOrder = (overrides: Record<string, unknown> = {}) => ({
  workOrderId: WORK_ORDER_ID,
  workOrderNo: 'SYN-WO-704',
  productionPlanId: 504,
  routingOperationId: 604,
  itemId: 804,
  orderQty: 120,
  uomId: 904,
  workOrderTypeCode: 'SYN_NORMAL',
  priorityNo: 2,
  statusCode: 'SYN_RELEASED',
  releasedAt: '2026-08-26T10:00:00+09:00',
  ...overrides,
});

interface RecordedRequest {
  method: string;
  url: URL;
  headers: Headers;
  body: unknown;
}

const recordingFetch = (route: StubRoute): { fetch: StubFetch; requests: RecordedRequest[] } => {
  const requests: RecordedRequest[] = [];
  const stub = createStubFetch([route]);
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

const releaseRoute = (respond: () => Response): StubRoute => ({
  match: (request) => request.method === 'POST' && new URL(request.url).pathname === RELEASE_PATH,
  respond,
});

describe('useReleaseWorkOrder', () => {
  it('sends the generated release body with detail ETag and invalidates release and shared reads', async () => {
    const onSuccess = vi.fn();
    const response = workOrder({ versionNo: 12 });
    const { fetch, requests } = recordingFetch(releaseRoute(() => jsonResponse(response)));
    const { result, apiClient, queryClient } = renderHookWithProviders(
      () => useReleaseWorkOrder({ workOrderId: WORK_ORDER_ID, onSuccess }),
      { fetch },
    );
    const releaseKey = workOrderReleaseKeys.detail(WORK_ORDER_ID);
    const sharedKey = workOrderKeys.detail(WORK_ORDER_ID);
    queryClient.setQueryData(releaseKey, workOrder({ statusCode: 'SYN_READY' }));
    queryClient.setQueryData(sharedKey, workOrder({ statusCode: 'SYN_READY' }));
    apiClient.etags.capture(workOrderReleaseDetailPath(WORK_ORDER_ID), DETAIL_ETAG);

    act(() => result.current.write({ ...RELEASE_BODY, internalOnly: true } as WorkOrderRelease));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(toWorkOrderReleaseFact(response)));
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: 'POST',
      url: { pathname: RELEASE_PATH, search: '' },
      body: RELEASE_BODY,
    });
    expect(requests[0]?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/i);
    expect(requests[0]?.headers.get('If-Match')).toBe(DETAIL_ETAG);
    expect(onSuccess.mock.calls[0]?.[0]).not.toHaveProperty('versionNo');
    await waitFor(() => expect(queryClient.getQueryState(releaseKey)?.isInvalidated).toBe(true));
    expect(queryClient.getQueryState(sharedKey)?.isInvalidated).toBe(true);
  });

  it('does not send without the selected detail ETag', async () => {
    const requests: Request[] = [];
    const fetch: StubFetch = async (request) => {
      requests.push(request);
      throw new Error('A release without an ETag must not reach fetch.');
    };
    const { result } = renderHookWithProviders(
      () => useReleaseWorkOrder({ workOrderId: WORK_ORDER_ID, onSuccess: vi.fn() }),
      { fetch },
    );

    act(() => result.current.write(RELEASE_BODY));

    await waitFor(() =>
      expect(result.current.error).toMatchObject({
        kind: 'validation',
        errors: [{ scope: 'screen', code: 'STALE_TOKEN' }],
      }),
    );
    expect(requests).toHaveLength(0);
  });

  it('preserves a concurrent release conflict without reporting success', async () => {
    const onSuccess = vi.fn();
    const { fetch } = recordingFetch(
      releaseRoute(() =>
        jsonResponse(
          { conflictCause: 'user', message: 'Synthetic concurrent release' },
          { status: 409 },
        ),
      ),
    );
    const { result, apiClient } = renderHookWithProviders(
      () => useReleaseWorkOrder({ workOrderId: WORK_ORDER_ID, onSuccess }),
      { fetch },
    );
    apiClient.etags.capture(DETAIL_PATH, DETAIL_ETAG);

    act(() => result.current.write(RELEASE_BODY));

    await waitFor(() =>
      expect(result.current.error).toEqual({
        kind: 'conflict',
        cause: 'user',
        message: 'Synthetic concurrent release',
      }),
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('reuses the idempotency key for the same irreversible release until it succeeds', async () => {
    let attempt = 0;
    const onSuccess = vi.fn();
    const { fetch, requests } = recordingFetch(
      releaseRoute(() => {
        attempt += 1;
        return attempt === 1
          ? jsonResponse({ message: 'Synthetic transient failure' }, { status: 500 })
          : jsonResponse(workOrder());
      }),
    );
    const { result, apiClient } = renderHookWithProviders(
      () => useReleaseWorkOrder({ workOrderId: WORK_ORDER_ID, onSuccess }),
      { fetch },
    );
    apiClient.etags.capture(DETAIL_PATH, DETAIL_ETAG);

    act(() => result.current.write(RELEASE_BODY));
    await waitFor(() => expect(result.current.error).toMatchObject({ kind: 'http', status: 500 }));
    act(() => result.current.write(RELEASE_BODY));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));

    expect(requests).toHaveLength(2);
    expect(requests[1]?.headers.get('Idempotency-Key')).toBe(
      requests[0]?.headers.get('Idempotency-Key'),
    );
  });

  it('uses a new idempotency key when the target work order changes after failure', async () => {
    let selectedWorkOrderId = WORK_ORDER_ID;
    let attempt = 0;
    const onSuccess = vi.fn();
    const { fetch, requests } = recordingFetch({
      match: (request) =>
        request.method === 'POST' &&
        /^\/production\/work-orders\/(704|705):release$/.test(new URL(request.url).pathname),
      respond: () => {
        attempt += 1;
        return attempt === 1
          ? jsonResponse({ message: 'Synthetic transient failure' }, { status: 500 })
          : jsonResponse(workOrder({ workOrderId: 705, workOrderNo: 'SYN-WO-705' }));
      },
    });
    const { result, rerender, apiClient } = renderHookWithProviders(
      () => useReleaseWorkOrder({ workOrderId: selectedWorkOrderId, onSuccess }),
      { fetch },
    );
    apiClient.etags.capture(DETAIL_PATH, DETAIL_ETAG);
    apiClient.etags.capture('/production/work-orders/705', '"synthetic-release-version-4"');

    act(() => result.current.write(RELEASE_BODY));
    await waitFor(() => expect(result.current.error).toMatchObject({ kind: 'http', status: 500 }));
    selectedWorkOrderId = 705;
    rerender();
    act(() => result.current.write(RELEASE_BODY));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));

    expect(requests.map(({ url }) => url.pathname)).toEqual([
      '/production/work-orders/704:release',
      '/production/work-orders/705:release',
    ]);
    expect(requests[1]?.headers.get('Idempotency-Key')).not.toBe(
      requests[0]?.headers.get('Idempotency-Key'),
    );
  });
});
