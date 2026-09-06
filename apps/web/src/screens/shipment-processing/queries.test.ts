import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import {
  shipmentProcessingKeys,
  useShipmentRequestCandidates,
  useShipmentRequestDetail,
  type ShipmentProcessingCandidateFilters,
} from './queries';

const LIST_PATH = '/logistics/shipment-requests';
const DETAIL_PATH = '/logistics/shipment-requests/501';

const filters = (
  overrides: Partial<ShipmentProcessingCandidateFilters> = {},
): ShipmentProcessingCandidateFilters => ({
  shipDateFrom: '2026-08-24',
  shipDateTo: '2026-08-31',
  pickingCompleteOnly: true,
  page: 1,
  ...overrides,
});

const request = (overrides: Record<string, unknown> = {}) => ({
  shipmentRequestId: 501,
  shipmentRequestNo: 'SYN-SR-501',
  customerId: 601,
  shipToPartnerId: 602,
  requestedShipDate: '2026-08-28',
  statusCode: 'SYN-STATUS',
  shipmentProgressCode: 'PICKED',
  shippingInspectionStatusCode: 'PASSED',
  ...overrides,
});

const getRoute = (pathname: string, body: unknown, status = 200): StubRoute => ({
  match: (req) => req.method === 'GET' && new URL(req.url).pathname === pathname,
  respond: () => jsonResponse(body, { status }),
});

describe('shipmentProcessingKeys', () => {
  it('키가 필터의 각 값을 담고, 목록과 상세를 가른다', () => {
    const base = filters();

    expect(shipmentProcessingKeys.all).toEqual(['shipment-processing']);
    expect(shipmentProcessingKeys.candidates(base)).toEqual([
      'shipment-processing',
      'candidates',
      '2026-08-24',
      '2026-08-31',
      true,
      1,
    ]);
    expect(shipmentProcessingKeys.detail(501)).toEqual(['shipment-processing', 'detail', 501]);
  });
});

describe('useShipmentRequestCandidates', () => {
  it('shipDateFrom이 없으면 조회하지 않는다(L-3)', () => {
    const fetch = createStubFetch([]);
    const { result } = renderHookWithProviders(
      () => useShipmentRequestCandidates(filters({ shipDateFrom: null })),
      { fetch },
    );

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('shipDateFrom이 있으면 목록을 옮긴다', async () => {
    let sent: URL | null = null;
    const fetch = createStubFetch([
      {
        match: (req) => req.method === 'GET' && new URL(req.url).pathname === LIST_PATH,
        respond: (req) => {
          sent = new URL(req.url);
          return jsonResponse({
            items: [request()],
            page: { page: 1, size: 20, total: 1 },
          });
        },
      },
    ]);
    const { result } = renderHookWithProviders(() => useShipmentRequestCandidates(filters()), {
      fetch,
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.items[0]?.shipmentRequestId).toBe(501);
    expect(result.current.data?.items[0]?.lines).toBeNull();
    expect(sent).not.toBeNull();
    expect((sent as URL | null)?.searchParams.get('pickingCompleteOnly')).toBe('true');
    expect((sent as URL | null)?.searchParams.get('shippableRemainderOnly')).toBe('true');
  });

  it('lines가 응답에 있으면 라인마다 옮긴다', async () => {
    const line = {
      shipmentRequestLineId: 701,
      lineNo: 1,
      itemId: 910001,
      requestedQty: 100,
      allocatedQty: 100,
      pickedQty: 100,
      shippedQty: 0,
      uomId: 920001,
      shippingInspectionRequired: false,
    };
    const fetch = createStubFetch([
      getRoute(LIST_PATH, {
        items: [request({ lines: [line] })],
        page: { page: 1, size: 20, total: 1 },
      }),
    ]);
    const { result } = renderHookWithProviders(() => useShipmentRequestCandidates(filters()), {
      fetch,
    });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.items[0]?.lines).toEqual([line]);
  });
});

describe('useShipmentRequestDetail', () => {
  it('shipmentRequestId가 없으면 조회하지 않는다', () => {
    const fetch = createStubFetch([]);
    const { result } = renderHookWithProviders(() => useShipmentRequestDetail(null), { fetch });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('shipmentRequestId가 있으면 상세를 옮긴다', async () => {
    const fetch = createStubFetch([getRoute(DETAIL_PATH, request({ lines: [] }))]);
    const { result } = renderHookWithProviders(() => useShipmentRequestDetail(501), { fetch });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.shipmentRequestNo).toBe('SYN-SR-501');
    expect(result.current.data?.lines).toEqual([]);
  });
});
