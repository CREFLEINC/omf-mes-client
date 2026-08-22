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
  useWorkOrderDetail,
  useWorkOrderList,
  useWorkOrderValidation,
  workOrderKeys,
} from './queries';

const LIST_PATH = '/production/work-orders';
const DETAIL_PATH = '/production/work-orders/702';
const VALIDATION_PATH = '/production/work-orders/702/validation';

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
  statusCode: 'SYN_RELEASED',
});

const fact = (workOrderId: number) => ({
  ...workOrder(workOrderId),
  productionLineId: null,
  responsibleWorkerId: null,
  plannedStartAt: null,
  plannedEndAt: null,
  plannedEquipmentId: null,
  plannedMoldId: null,
  plannedShiftId: null,
  remarks: null,
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

describe('workOrderKeys', () => {
  it('keeps each read target in a distinct screen-owned key', () => {
    expect(workOrderKeys.list(null, 1)).toEqual(['work-orders', 'list', null, 1]);
    expect(workOrderKeys.detail(702)).not.toEqual(workOrderKeys.validation(702));
  });
});

describe('work-order reads', () => {
  it('keeps null list and detail identifiers idle without dispatching a fallback request', () => {
    const { fetch, requests } = recordingFetch([]);
    const { result: list } = renderHookWithProviders(() => useWorkOrderList(null, 1), { fetch });
    const { result: detail } = renderHookWithProviders(() => useWorkOrderDetail(null), { fetch });
    const { result: validation } = renderHookWithProviders(() => useWorkOrderValidation(null), {
      fetch,
    });

    expect(list.current.fetchStatus).toBe('idle');
    expect(detail.current.fetchStatus).toBe('idle');
    expect(validation.current.fetchStatus).toBe('idle');
    expect(requests).toHaveLength(0);
  });

  it('lists the plan page only, preserves server order and page, and null-normalizes omitted facts', async () => {
    const { fetch, requests } = recordingFetch([
      getRoute(LIST_PATH, {
        items: [
          { ...workOrder(702), productionLineId: 901, remarks: 'Synthetic remarks', versionNo: 9 },
          workOrder(701),
        ],
        page: { page: 3, size: 20, total: 22 },
      }),
    ]);
    const { result } = renderHookWithProviders(() => useWorkOrderList(501, 3), { fetch });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(Array.from(requests[0]?.searchParams.entries() ?? [])).toEqual([
      ['productionPlanId', '501'],
      ['page', '3'],
    ]);
    expect(result.current.data).toEqual({
      items: [{ ...fact(702), productionLineId: 901, remarks: 'Synthetic remarks' }, fact(701)],
      page: { page: 3, size: 20, total: 22 },
    });
  });

  it('gets the exact detail path with no search and returns the list fact shape', async () => {
    const { fetch, requests } = recordingFetch([
      getRoute(DETAIL_PATH, { ...workOrder(702), plannedEquipmentId: 901, versionNo: 9 }),
    ]);
    const { result } = renderHookWithProviders(() => useWorkOrderDetail(702), { fetch });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(requests).toHaveLength(1);
    expect(requests[0]?.pathname).toBe(DETAIL_PATH);
    expect(requests[0]?.search).toBe('');
    expect(result.current.data).toEqual({ ...fact(702), plannedEquipmentId: 901 });
  });

  it('gets validation unchanged in server finding order and null-normalizes an omitted field', async () => {
    const { fetch, requests } = recordingFetch([
      getRoute(VALIDATION_PATH, {
        passed: false,
        findings: [
          { severity: 'BLOCK', code: 'SYN_BLOCK', message: 'Synthetic block' },
          { severity: 'WARN', field: 'plannedMoldId', code: 'SYN_WARN', message: 'Synthetic warn' },
        ],
      }),
    ]);
    const { result } = renderHookWithProviders(() => useWorkOrderValidation(702), { fetch });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(requests).toHaveLength(1);
    expect(requests[0]?.pathname).toBe(VALIDATION_PATH);
    expect(requests[0]?.search).toBe('');
    expect(result.current.data).toEqual({
      passed: false,
      findings: [
        { severity: 'BLOCK', field: null, code: 'SYN_BLOCK', message: 'Synthetic block' },
        {
          severity: 'WARN',
          field: 'plannedMoldId',
          code: 'SYN_WARN',
          message: 'Synthetic warn',
        },
      ],
    });
  });

  it('keeps a validation HTTP failure as a query error without a synthetic report', async () => {
    const { fetch } = recordingFetch([
      getRoute(VALIDATION_PATH, { message: 'Synthetic unavailable' }, 503),
    ]);
    const { result } = renderHookWithProviders(() => useWorkOrderValidation(702), { fetch });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.data).toBeUndefined();
    expect(toApiError(result.current.error)).toMatchObject({ kind: 'http', status: 503 });
  });
});
