import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../test/api-harness';
import { useWorkOrderCloseMutation } from './mutations';
import { toWorkOrderCloseFact, workOrderCloseDetailPath, workOrderCloseKeys } from './queries';

const WORK_ORDER_ID = 705;
const DETAIL_PATH = '/production/work-orders/705';
const CLOSE_PATH = '/production/work-orders/705:close';
const DETAIL_ETAG = '"synthetic-close-version-11"';
const CLOSE_BODY = {
  remainderDispositionCode: 'WRITE_OFF' as const,
  reasonCode: 'SYN_SHORTFALL',
  erpSendItems: ['PRODUCTION_RESULT', 'MATERIAL_CONSUMPTION'],
};

const workOrder = (overrides: Record<string, unknown> = {}) => ({
  workOrderId: WORK_ORDER_ID,
  workOrderNo: `SYN-WO-${WORK_ORDER_ID}`,
  productionPlanId: 501,
  routingOperationId: 601,
  itemId: 701,
  orderQty: 10,
  uomId: 801,
  workOrderTypeCode: 'SYN_NORMAL',
  priorityNo: 1,
  statusCode: 'SYN_CLOSED',
  completedAt: '2026-08-24T08:00:00+09:00',
  completionVarianceReasonCode: 'SYN_SHORTFALL',
  closedAt: '2026-08-24T09:00:00+09:00',
  ...overrides,
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
        body: request.method === 'POST' ? await request.clone().json() : null,
      });
      return stub(request);
    },
    requests,
  };
};

const closeRoute = (respond: () => Response): StubRoute => ({
  match: (request) => request.method === 'POST' && new URL(request.url).pathname === CLOSE_PATH,
  respond,
});

describe('useWorkOrderCloseMutation', () => {
  it('상세 ETag와 멱등 키로 정확한 마감 요청을 보내고 응답을 변환한 뒤 화면 캐시를 모두 무효화한다', async () => {
    const onSuccess = vi.fn();
    const response = workOrder({ versionNo: 11 });
    const { fetch, requests } = recordingFetch([closeRoute(() => jsonResponse(response))]);
    const { result, apiClient, queryClient } = renderHookWithProviders(
      () => useWorkOrderCloseMutation({ workOrderId: WORK_ORDER_ID, onSuccess }),
      { fetch },
    );
    const candidatesKey = workOrderCloseKeys.candidates({
      statusCode: 'SYN_RELEASED',
      productionOrderId: null,
      plannedStartFrom: null,
      plannedStartTo: null,
      page: 1,
    });
    const detailKey = workOrderCloseKeys.detail(WORK_ORDER_ID);
    queryClient.setQueryData(candidatesKey, { items: [], page: { page: 1, size: 20, total: 0 } });
    queryClient.setQueryData(detailKey, workOrder({ statusCode: 'SYN_RELEASED' }));
    apiClient.etags.capture(workOrderCloseDetailPath(WORK_ORDER_ID), DETAIL_ETAG);

    act(() => {
      result.current.write(CLOSE_BODY);
    });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(toWorkOrderCloseFact(response)));

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: 'POST',
      url: { pathname: CLOSE_PATH, search: '' },
      body: CLOSE_BODY,
    });
    expect(requests[0]?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/i);
    expect(requests[0]?.headers.get('If-Match')).toBe(DETAIL_ETAG);
    expect(onSuccess.mock.calls[0]?.[0]).not.toHaveProperty('versionNo');
    await waitFor(() => expect(queryClient.getQueryState(candidatesKey)?.isInvalidated).toBe(true));
    expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(true);
  });

  it('상세 ETag가 없으면 요청을 보내지 않고 STALE_TOKEN 오류를 남긴다', async () => {
    const requests: Request[] = [];
    const fetch: StubFetch = async (request) => {
      requests.push(request);
      throw new Error('A stale close must not reach fetch.');
    };
    const { result } = renderHookWithProviders(
      () => useWorkOrderCloseMutation({ workOrderId: WORK_ORDER_ID, onSuccess: vi.fn() }),
      { fetch },
    );

    act(() => {
      result.current.write(CLOSE_BODY);
    });

    await waitFor(() =>
      expect(result.current.error).toMatchObject({
        kind: 'validation',
        errors: [{ scope: 'screen', code: 'STALE_TOKEN' }],
      }),
    );
    expect(requests).toHaveLength(0);
  });

  it('409 원인과 메시지를 conflict 오류로 보존한다', async () => {
    const { fetch } = recordingFetch([
      closeRoute(() =>
        jsonResponse(
          { conflictCause: 'user', message: 'Synthetic concurrent close' },
          { status: 409 },
        ),
      ),
    ]);
    const { result, apiClient } = renderHookWithProviders(
      () => useWorkOrderCloseMutation({ workOrderId: WORK_ORDER_ID, onSuccess: vi.fn() }),
      { fetch },
    );
    apiClient.etags.capture(DETAIL_PATH, DETAIL_ETAG);

    act(() => {
      result.current.write(CLOSE_BODY);
    });

    await waitFor(() =>
      expect(result.current.error).toEqual({
        kind: 'conflict',
        cause: 'user',
        message: 'Synthetic concurrent close',
      }),
    );
  });

  it('실패 뒤 같은 본문을 재시도하면 성공 전까지 같은 멱등 키를 쓴다', async () => {
    let attempt = 0;
    const onSuccess = vi.fn();
    const { fetch, requests } = recordingFetch([
      closeRoute(() => {
        attempt += 1;
        return attempt === 1
          ? jsonResponse({ message: 'Synthetic transient failure' }, { status: 500 })
          : jsonResponse(workOrder());
      }),
    ]);
    const { result, apiClient } = renderHookWithProviders(
      () => useWorkOrderCloseMutation({ workOrderId: WORK_ORDER_ID, onSuccess }),
      { fetch },
    );
    apiClient.etags.capture(DETAIL_PATH, DETAIL_ETAG);

    act(() => {
      result.current.write(CLOSE_BODY);
    });
    await waitFor(() => expect(result.current.error).toMatchObject({ kind: 'http', status: 500 }));

    act(() => {
      result.current.write(CLOSE_BODY);
    });
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));

    expect(requests).toHaveLength(2);
    expect(requests[1]?.headers.get('Idempotency-Key')).toBe(
      requests[0]?.headers.get('Idempotency-Key'),
    );
  });
});
