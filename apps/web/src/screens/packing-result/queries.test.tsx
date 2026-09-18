import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import {
  useLotScan,
  useShipmentAllocations,
  useShipmentSelection,
  useTodayShipments,
} from './queries';

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
  /* 현행 배분 응답은 목표 선택 필드 `shippingInspectionStatusCode`를 생략하고 `oqcPassed`를 준다. */
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

  it('출하대상을 고르면 미포장 배분을 page.total까지 모두 읽는다', async () => {
    const allocationPages: number[] = [];
    const shipmentRequests: URL[] = [];
    const { result } = renderHookWithProviders(useShipmentSelection, {
      fetch: createStubFetch([
        {
          /* 불리면 안 되는 경로 — 불리는지 보려고 둔다(아래 단언). */
          match: (request) => new URL(request.url).pathname === '/logistics/shipments',
          respond: (request) => {
            shipmentRequests.push(new URL(request.url));

            return jsonResponse({ items: [], page: { page: 1, size: 50, total: 0 } });
          },
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
      result.current.mutate({
        shipmentId: 501,
        shipmentNo: 'SYN-SH-501',
        shipmentRequestId: 701,
        warehouseId: 1001,
        statusCode: 'PICKED',
        expedited: false,
      });
    });
    await waitFor(() => {
      expect(result.current.data?.allocations).toHaveLength(2);
    });
    expect(allocationPages).toEqual([1, 2]);
    expect(result.current.data?.shipmentId).toBe(501);

    /*
     * ⛔ **출하를 다시 조회하지 않는다**(#1351). 고른 것이 이미 목록의 한 행이라 같은 값을
     *    서버에 한 번 더 물을 이유가 없다 — 물으면 목록과 다른 필터로 나가던 옛 스캔 조회가
     *    되살아난다.
     *
     * ⚠ 한때 이 자리가 `expect(allocationPages).not.toContain(0)` 이었다 — 쪽 번호는 늘 1 이상이라
     *   **실패할 수 없는 단언**이었고, 주석이 말하는 것을 재지 못했다(리뷰 지적).
     */
    expect(shipmentRequests).toHaveLength(0);
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

describe('packing-result queries — 생산LOT 스캔', () => {
  /*
   * ⛔ 서버는 `lotQ` 로 목록을 거르지 않는다 — 판정(`match`)만 싣고 `items` 는 출하의 배분
   * 전건이다(계약 `lotQ` 설명). 첫 줄이 스캔한 LOT 이 아닌 응답으로 고르는 자리를 본다.
   */
  const scanWith = (
    items: ReturnType<typeof allocation>[],
    match: { matched: boolean; reasonCode?: string },
    pageSize = 50,
  ) =>
    renderHookWithProviders(useLotScan, {
      fetch: createStubFetch([
        {
          match: (request) =>
            new URL(request.url).pathname === '/logistics/shipment-lot-allocations',
          respond: (request) => {
            const page = Number(new URL(request.url).searchParams.get('page') ?? '1');
            const start = (page - 1) * pageSize;

            return jsonResponse({
              items: items.slice(start, start + pageSize),
              page: { page, size: pageSize, total: items.length },
              match,
            });
          },
        },
      ]),
    });

  it('매칭이면 응답의 첫 줄이 아니라 스캔한 LOT 번호의 배분을 고른다', async () => {
    const packed = { ...allocation(2), packedQty: 10 };
    const { result } = scanWith([packed, allocation(1)], { matched: true });

    let scanned: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;
    await act(async () => {
      scanned = await result.current.mutateAsync({ shipmentId: 501, code: 'SYN-LOT-1' });
    });

    expect(scanned?.allocation?.shipmentLotAllocationId).toBe(1);
  });

  it('같은 LOT 배분이 여럿이면 아직 남은 수량이 있는 줄을 고른다', async () => {
    const done = { ...allocation(3), lotNo: 'SYN-LOT-1', packedQty: 10 };
    const { result } = scanWith([done, allocation(1)], { matched: true });

    let scanned: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;
    await act(async () => {
      scanned = await result.current.mutateAsync({ shipmentId: 501, code: 'SYN-LOT-1' });
    });

    expect(scanned?.allocation?.shipmentLotAllocationId).toBe(1);
  });

  it('스캔한 LOT 이 첫 쪽에 없으면 다음 쪽까지 읽어 고른다', async () => {
    const { result } = scanWith([allocation(2), allocation(1)], { matched: true }, 1);

    let scanned: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;
    await act(async () => {
      scanned = await result.current.mutateAsync({ shipmentId: 501, code: 'SYN-LOT-1' });
    });

    expect(scanned?.allocation?.shipmentLotAllocationId).toBe(1);
  });

  it('매칭이 아니면 판정을 그대로 넘기고 스캔 LOT 의 배분을 지어내지 않는다', async () => {
    const { result } = scanWith([allocation(2)], {
      matched: false,
      reasonCode: 'LOT_NOT_ALLOCATED',
    });

    let scanned: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;
    await act(async () => {
      scanned = await result.current.mutateAsync({ shipmentId: 501, code: 'SYN-LOT-9' });
    });

    expect(scanned?.verdict.matched).toBe(false);
    expect(scanned?.allocation?.lotNo).not.toBe('SYN-LOT-9');
  });
});
