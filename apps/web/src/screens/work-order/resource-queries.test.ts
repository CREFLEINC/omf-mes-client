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
  useWorkOrderEquipments,
  useWorkOrderProductionLines,
  useWorkOrderShifts,
  workOrderResourceKeys,
} from './resource-queries';

const LINES_PATH = '/mdm/production-lines';
const EQUIPMENTS_PATH = '/mdm/equipments';
const SHIFTS_PATH = '/mdm/shifts';

interface RecordedRequest {
  method: string;
  url: URL;
}

const productionLine = (productionLineId: number) => ({
  productionLineId,
  plantId: 501,
  lineCode: `SYN-LINE-${productionLineId}`,
  lineName: `Synthetic line ${productionLineId}`,
  lineTypeCode: 'SYN_LINE',
  isActive: true,
});

const equipment = (equipmentId: number) => ({
  equipmentId,
  plantId: 501,
  equipmentCode: `SYN-EQ-${equipmentId}`,
  equipmentName: `Synthetic equipment ${equipmentId}`,
  equipmentTypeCode: 'SYN_EQUIPMENT',
  statusCode: 'IN_SERVICE',
  isActive: true,
});

const shift = (shiftId: number) => ({
  shiftId,
  plantId: 501,
  shiftCode: `SYN-SHIFT-${shiftId}`,
  shiftName: `Synthetic shift ${shiftId}`,
  startTime: '20:00:00',
  endTime: '08:00:00',
  crossesMidnight: true,
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

describe('workOrderResourceKeys', () => {
  it('separates each resource, plant, line, and page', () => {
    expect(workOrderResourceKeys.productionLines(501, 1)).not.toEqual(
      workOrderResourceKeys.productionLines(501, 2),
    );
    expect(workOrderResourceKeys.equipments(501, null, 1)).not.toEqual(
      workOrderResourceKeys.equipments(501, 601, 1),
    );
    expect(workOrderResourceKeys.productionLines(501, 1)).not.toEqual(
      workOrderResourceKeys.equipments(501, null, 1),
    );
    expect(workOrderResourceKeys.shifts(501, 1)).not.toEqual(workOrderResourceKeys.shifts(501, 2));
    expect(workOrderResourceKeys.shifts(501, 1)).not.toEqual(
      workOrderResourceKeys.productionLines(501, 1),
    );
  });
});

describe('work-order resource queries', () => {
  it('keeps all queries idle without a plant and sends zero fallback requests', () => {
    const { fetch, requests } = recordingFetch([]);
    const { result } = renderHookWithProviders(
      () => ({
        lines: useWorkOrderProductionLines(null, 1),
        equipments: useWorkOrderEquipments(null, null, 1),
        shifts: useWorkOrderShifts(null, 1),
      }),
      { fetch },
    );

    expect(result.current.lines.fetchStatus).toBe('idle');
    expect(result.current.lines.data).toBeUndefined();
    expect(result.current.equipments.fetchStatus).toBe('idle');
    expect(result.current.equipments.data).toBeUndefined();
    expect(result.current.shifts.fetchStatus).toBe('idle');
    expect(result.current.shifts.data).toBeUndefined();
    expect(requests).toHaveLength(0);
  });

  it('gets plant shifts with the exact query and preserves schedule facts, order, page, and activity', async () => {
    const { fetch, requests } = recordingFetch([
      getRoute(SHIFTS_PATH, {
        items: [{ ...shift(802), crossesMidnight: false, isActive: false }, shift(801)],
        page: { page: 2, size: 20, total: 3 },
      }),
    ]);
    const { result } = renderHookWithProviders(() => useWorkOrderShifts(501, 2), { fetch });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('GET');
    expect(requests[0]?.url.pathname).toBe(SHIFTS_PATH);
    expect(Array.from(requests[0]?.url.searchParams.entries() ?? [])).toEqual([
      ['plantId', '501'],
      ['includeInactive', 'true'],
      ['page', '2'],
    ]);
    expect(result.current.data).toEqual({
      items: [{ ...shift(802), crossesMidnight: false, isActive: false }, shift(801)],
      page: { page: 2, size: 20, total: 3 },
      truncated: true,
    });
  });

  it('gets production lines with the exact query and preserves order, page, truncation, and null parent', async () => {
    const { fetch, requests } = recordingFetch([
      getRoute(LINES_PATH, {
        items: [
          { ...productionLine(602), parentLineId: 601, isActive: false },
          productionLine(601),
        ],
        page: { page: 2, size: 20, total: 3 },
      }),
    ]);
    const { result } = renderHookWithProviders(() => useWorkOrderProductionLines(501, 2), {
      fetch,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('GET');
    expect(requests[0]?.url.pathname).toBe(LINES_PATH);
    expect(Array.from(requests[0]?.url.searchParams.entries() ?? [])).toEqual([
      ['plantId', '501'],
      ['includeInactive', 'true'],
      ['page', '2'],
    ]);
    expect(result.current.data).toEqual({
      items: [
        { ...productionLine(602), parentLineId: 601, isActive: false },
        { ...productionLine(601), parentLineId: null },
      ],
      page: { page: 2, size: 20, total: 3 },
      truncated: true,
    });
  });

  it('gets line equipment with the exact query and preserves raw status, activity, and nullable facts', async () => {
    const { fetch, requests } = recordingFetch([
      getRoute(EQUIPMENTS_PATH, {
        items: [
          { ...equipment(702), processId: 801, productionLineId: 601, isActive: false },
          equipment(701),
        ],
        page: { page: 3, size: 20, total: 2 },
      }),
    ]);
    const { result } = renderHookWithProviders(() => useWorkOrderEquipments(501, 601, 3), {
      fetch,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('GET');
    expect(requests[0]?.url.pathname).toBe(EQUIPMENTS_PATH);
    expect(Array.from(requests[0]?.url.searchParams.entries() ?? [])).toEqual([
      ['plantId', '501'],
      ['productionLineId', '601'],
      ['statusCode', 'IN_SERVICE'],
      ['includeInactive', 'true'],
      ['page', '3'],
    ]);
    expect(result.current.data).toEqual({
      items: [
        { ...equipment(702), processId: 801, productionLineId: 601, isActive: false },
        { ...equipment(701), processId: null, productionLineId: null },
      ],
      page: { page: 3, size: 20, total: 2 },
      truncated: false,
    });
  });

  it('omits only a null production line from the equipment query without inventing a zero value', async () => {
    const { fetch, requests } = recordingFetch([
      getRoute(EQUIPMENTS_PATH, { items: [], page: { page: 1, size: 20, total: 0 } }),
    ]);
    const { result } = renderHookWithProviders(() => useWorkOrderEquipments(501, null, 1), {
      fetch,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url.pathname).toBe(EQUIPMENTS_PATH);
    expect(Array.from(requests[0]?.url.searchParams.entries() ?? [])).toEqual([
      ['plantId', '501'],
      ['statusCode', 'IN_SERVICE'],
      ['includeInactive', 'true'],
      ['page', '1'],
    ]);
  });

  it('keeps an equipment HTTP error separate from successful production-line data', async () => {
    const { fetch } = recordingFetch([
      getRoute(LINES_PATH, { items: [productionLine(601)], page: { page: 1, size: 20, total: 1 } }),
      getRoute(EQUIPMENTS_PATH, { message: 'Synthetic unavailable' }, 503),
    ]);
    const { result } = renderHookWithProviders(
      () => ({
        lines: useWorkOrderProductionLines(501, 1),
        equipments: useWorkOrderEquipments(501, null, 1),
      }),
      { fetch },
    );

    await waitFor(() => expect(result.current.equipments.isError).toBe(true));

    expect(result.current.lines.data).toEqual({
      items: [{ ...productionLine(601), parentLineId: null }],
      page: { page: 1, size: 20, total: 1 },
      truncated: false,
    });
    expect(result.current.equipments.data).toBeUndefined();
    expect(toApiError(result.current.equipments.error)).toMatchObject({
      kind: 'http',
      status: 503,
    });
  });
});
