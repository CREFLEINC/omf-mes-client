import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { useShipmentAllocations, useShipmentScan, useTodayShipments } from './queries';

const allocation = (id: number) => ({
  shipmentLotAllocationId: id,
  shipmentId: 501,
  shipmentLineId: 701,
  itemId: 5001,
  itemCode: 'SYN-FG-1001',
  lotId: 8_000 + id,
  lotNo: `SYN-LOT-${String(id)}`,
  warehouseId: 1001,
  allocatedQty: 10,
  uomId: 920001,
  shippingInspectionStatusCode: 'PASSED',
  oqcPassed: true,
  packedQty: 0,
});

describe('packing-result queries — 완전 조회', () => {
  it('당일 출하 선택 목록은 page.total까지 모두 읽는다', async () => {
    const { result } = renderHookWithProviders(useTodayShipments, {
      fetch: createStubFetch([
        {
          match: (request) => new URL(request.url).pathname === '/logistics/shipments',
          respond: (request) => {
            const page = Number(new URL(request.url).searchParams.get('page') ?? '1');

            return jsonResponse({
              items: [
                {
                  shipmentId: 500 + page,
                  shipmentNo: `SYN-SH-${String(page)}`,
                  shipmentRequestId: 700 + page,
                  warehouseId: 1001,
                  statusCode: 'PICKED',
                  expedited: false,
                },
              ],
              page: { page, size: 1, total: 2 },
            });
          },
        },
      ]),
    });

    await waitFor(() => {
      expect(result.current.shipments.map((shipment) => shipment.shipmentId)).toEqual([501, 502]);
    });
  });

  it('출하번호 스캔 뒤 미포장 배분도 page.total까지 모두 읽는다', async () => {
    const allocationPages: number[] = [];
    const { result } = renderHookWithProviders(useShipmentScan, {
      fetch: createStubFetch([
        {
          match: (request) => new URL(request.url).pathname === '/logistics/shipments',
          respond: () =>
            jsonResponse({
              items: [
                {
                  shipmentId: 501,
                  shipmentNo: 'SYN-SH-501',
                  shipmentRequestId: 701,
                  warehouseId: 1001,
                  statusCode: 'PICKED',
                  expedited: false,
                },
              ],
              page: { page: 1, size: 1, total: 1 },
            }),
        },
        {
          match: (request) =>
            new URL(request.url).pathname === '/logistics/shipment-lot-allocations',
          respond: (request) => {
            const page = Number(new URL(request.url).searchParams.get('page') ?? '1');
            allocationPages.push(page);

            return jsonResponse({
              items: [allocation(9_000 + page)],
              page: { page, size: 1, total: 2 },
            });
          },
        },
      ]),
    });

    await act(async () => {
      result.current.mutate('SYN-SH-501');
    });
    await waitFor(() => {
      expect(result.current.data?.allocations).toHaveLength(2);
    });
    expect(allocationPages).toEqual([1, 2]);
  });

  it('출하 진행 배분은 page.total까지 모두 읽는다', async () => {
    const pages: number[] = [];
    const { result } = renderHookWithProviders(() => useShipmentAllocations(501), {
      fetch: createStubFetch([
        {
          match: (request) =>
            new URL(request.url).pathname === '/logistics/shipment-lot-allocations',
          respond: (request) => {
            const page = Number(new URL(request.url).searchParams.get('page') ?? '1');
            pages.push(page);

            return jsonResponse({
              items: [allocation(9_000 + page)],
              page: { page, size: 1, total: 2 },
            });
          },
        },
      ]),
    });

    await waitFor(() => {
      expect(result.current.allocations.map((item) => item.shipmentLotAllocationId)).toEqual([
        9_001, 9_002,
      ]);
    });
    expect(pages).toEqual([1, 2]);
  });
});
