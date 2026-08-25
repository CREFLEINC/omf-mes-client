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
import { useConfirmProductionPlan } from './mutations';
import { productionPlanDetailPath, productionPlanKeys, toProductionPlanFact } from './queries';

const PRODUCTION_PLAN_ID = 5101;
const DETAIL_PATH = '/planning/production-plans/5101';
const CONFIRM_PATH = '/planning/production-plans/5101:confirm';
const ETAG = '"synthetic-plan-version-5"';

const productionPlan = (overrides: Record<string, unknown> = {}) => ({
  productionPlanId: PRODUCTION_PLAN_ID,
  productionOrderId: 5001,
  planNo: 'PLAN-5101',
  planDate: '2026-08-22',
  plannedQty: 24.5,
  uomId: 5501,
  bomId: 5201,
  routingId: 5301,
  statusCode: 'CONFIRMED',
  confirmedAt: '2026-08-26T09:00:00+09:00',
  ...overrides,
});

interface RecordedRequest {
  method: string;
  url: URL;
  headers: Headers;
  body: string;
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
        body: await request.clone().text(),
      });
      return stub(request);
    },
    requests,
  };
};

const confirmRoute = (respond: () => Response): StubRoute => ({
  match: (request) => request.method === 'POST' && new URL(request.url).pathname === CONFIRM_PATH,
  respond,
});

describe('useConfirmProductionPlan', () => {
  it('상세 ETag와 멱등 키로 본문 없는 전개 확정을 보내고 계획·W/O 캐시를 함께 무효화한다', async () => {
    const onSuccess = vi.fn();
    const response = productionPlan({ versionNo: 6 });
    const { fetch, requests } = recordingFetch(confirmRoute(() => jsonResponse(response)));
    const { result, apiClient, queryClient } = renderHookWithProviders(
      () => useConfirmProductionPlan({ productionPlanId: PRODUCTION_PLAN_ID, onSuccess }),
      { fetch },
    );
    const planListKey = productionPlanKeys.list(5001, 1);
    const workOrderListKey = workOrderKeys.list(PRODUCTION_PLAN_ID, 1);
    queryClient.setQueryData(planListKey, { items: [], page: { page: 1, size: 20, total: 0 } });
    queryClient.setQueryData(workOrderListKey, {
      items: [],
      page: { page: 1, size: 20, total: 0 },
    });
    apiClient.etags.capture(productionPlanDetailPath(PRODUCTION_PLAN_ID), ETAG);

    act(() => result.current.write());

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(toProductionPlanFact(response)));
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: 'POST',
      url: { pathname: CONFIRM_PATH, search: '' },
      body: '',
    });
    expect(requests[0]?.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/i);
    expect(requests[0]?.headers.get('If-Match')).toBe(ETAG);
    expect(onSuccess.mock.calls[0]?.[0]).not.toHaveProperty('versionNo');
    await waitFor(() => expect(queryClient.getQueryState(planListKey)?.isInvalidated).toBe(true));
    expect(queryClient.getQueryState(workOrderListKey)?.isInvalidated).toBe(true);
  });

  it('상세 ETag가 없으면 요청하지 않고 STALE_TOKEN을 남긴다', async () => {
    const requests: Request[] = [];
    const fetch: StubFetch = async (request) => {
      requests.push(request);
      throw new Error('A confirm without an ETag must not reach fetch.');
    };
    const { result } = renderHookWithProviders(
      () => useConfirmProductionPlan({ productionPlanId: PRODUCTION_PLAN_ID, onSuccess: vi.fn() }),
      { fetch },
    );

    act(() => result.current.write());

    await waitFor(() =>
      expect(result.current.error).toMatchObject({
        kind: 'validation',
        errors: [{ scope: 'screen', code: 'STALE_TOKEN' }],
      }),
    );
    expect(requests).toHaveLength(0);
  });

  it('409 원인과 메시지를 보존하고 성공 콜백과 캐시 무효화를 하지 않는다', async () => {
    const onSuccess = vi.fn();
    const { fetch } = recordingFetch(
      confirmRoute(() =>
        jsonResponse(
          { conflictCause: 'user', message: 'Synthetic concurrent confirm' },
          { status: 409 },
        ),
      ),
    );
    const { result, apiClient, queryClient } = renderHookWithProviders(
      () => useConfirmProductionPlan({ productionPlanId: PRODUCTION_PLAN_ID, onSuccess }),
      { fetch },
    );
    const planListKey = productionPlanKeys.list(5001, 1);
    queryClient.setQueryData(planListKey, { items: [], page: { page: 1, size: 20, total: 0 } });
    apiClient.etags.capture(DETAIL_PATH, ETAG);

    act(() => result.current.write());

    await waitFor(() =>
      expect(result.current.error).toEqual({
        kind: 'conflict',
        cause: 'user',
        message: 'Synthetic concurrent confirm',
      }),
    );
    expect(onSuccess).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(planListKey)?.isInvalidated).toBe(false);
  });

  it('실패 뒤 본문 없는 액션을 다시 시도하면 공용 규칙대로 새 멱등 키를 쓴다', async () => {
    let attempt = 0;
    const onSuccess = vi.fn();
    const { fetch, requests } = recordingFetch(
      confirmRoute(() => {
        attempt += 1;
        return attempt === 1
          ? jsonResponse({ message: 'Synthetic transient failure' }, { status: 500 })
          : jsonResponse(productionPlan());
      }),
    );
    const { result, apiClient } = renderHookWithProviders(
      () => useConfirmProductionPlan({ productionPlanId: PRODUCTION_PLAN_ID, onSuccess }),
      { fetch },
    );
    apiClient.etags.capture(DETAIL_PATH, ETAG);

    act(() => result.current.write());
    await waitFor(() => expect(result.current.error).toMatchObject({ kind: 'http', status: 500 }));
    act(() => result.current.write());
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));

    expect(requests).toHaveLength(2);
    expect(requests[1]?.headers.get('Idempotency-Key')).not.toBe(
      requests[0]?.headers.get('Idempotency-Key'),
    );
  });
});
