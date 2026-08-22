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
  productionPlanReferenceKeys,
  useBomReferenceQuery,
  useProductionLineReferenceQuery,
  useRoutingReferenceQuery,
} from './reference-queries';

const BOMS_PATH = '/planning/boms';
const ROUTINGS_PATH = '/planning/routings';
const PRODUCTION_LINES_PATH = '/mdm/production-lines';

const isGet = (request: Request, pathname: string): boolean =>
  request.method === 'GET' && new URL(request.url).pathname === pathname;

const recordingFetch = (
  routes: StubRoute[],
): { fetch: StubFetch; requests: { method: string; url: URL }[] } => {
  const requests: { method: string; url: URL }[] = [];
  const stub = createStubFetch(routes);

  return {
    fetch: async (request) => {
      requests.push({ method: request.method, url: new URL(request.url) });
      return stub(request);
    },
    requests,
  };
};

const bom = (bomId: number) => ({
  bomId,
  parentItemId: 4101,
  bomCode: `BOM-SYN-${String(bomId)}`,
  bomVersion: bomId === 701 ? 7 : 3,
  statusCode: bomId === 701 ? 'OBSOLETE' : 'DRAFT',
  isDefault: bomId === 701,
  effectiveFrom: '2026-01-01',
  effectiveTo: bomId === 701 ? null : '2026-12-31',
  baseQty: bomId === 701 ? 12.5 : 5,
  baseUomId: 8101,
});

const routing = (routingId: number) => ({
  routingId,
  itemId: 4101,
  routingCode: `ROUTE-SYN-${String(routingId)}`,
  routingVersion: routingId === 801 ? 8 : 2,
  statusCode: routingId === 801 ? 'OBSOLETE' : 'DRAFT',
  effectiveFrom: routingId === 801 ? undefined : '2026-02-01',
  effectiveTo: routingId === 801 ? null : '2026-11-30',
});

const productionLine = (productionLineId: number) => ({
  productionLineId,
  plantId: 3101,
  parentLineId: productionLineId === 901 ? null : 901,
  lineCode: `LINE-SYN-${String(productionLineId)}`,
  lineName: `Synthetic line ${String(productionLineId)}`,
  lineTypeCode: productionLineId === 901 ? 'LINE' : 'WORK_AREA',
  isActive: productionLineId === 901,
});

describe('production plan reference queries', () => {
  it('does not dispatch BOM, Routing, or production-line requests when their IDs are null', () => {
    const fetch: StubFetch = async () => {
      throw new Error('A null reference ID must not dispatch a request.');
    };
    const { result } = renderHookWithProviders(
      () => ({
        boms: useBomReferenceQuery(null),
        routings: useRoutingReferenceQuery(null),
        productionLines: useProductionLineReferenceQuery(null),
      }),
      { fetch },
    );

    expect(result.current.boms.fetchStatus).toBe('idle');
    expect(result.current.routings.fetchStatus).toBe('idle');
    expect(result.current.productionLines.fetchStatus).toBe('idle');
    expect(result.current.boms.data).toBeUndefined();
    expect(result.current.routings.data).toBeUndefined();
    expect(result.current.productionLines.data).toBeUndefined();
  });

  it('requests exact item-scoped BOM and Routing revisions without filtering or default selection', async () => {
    const { fetch, requests } = recordingFetch([
      {
        match: (request) => isGet(request, BOMS_PATH),
        respond: () => jsonResponse({ items: [bom(701), bom(702)] }),
      },
      {
        match: (request) => isGet(request, ROUTINGS_PATH),
        respond: () => jsonResponse({ items: [routing(801), routing(802)] }),
      },
    ]);
    const { result } = renderHookWithProviders(
      () => ({ boms: useBomReferenceQuery(4101), routings: useRoutingReferenceQuery(4101) }),
      { fetch },
    );

    await waitFor(() => expect(result.current.boms.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.routings.isSuccess).toBe(true));

    expect(requests).toHaveLength(2);
    expect(requests).toEqual([
      { method: 'GET', url: expect.objectContaining({ pathname: BOMS_PATH }) },
      { method: 'GET', url: expect.objectContaining({ pathname: ROUTINGS_PATH }) },
    ]);
    expect(Array.from(requests[0]?.url.searchParams.entries() ?? [])).toEqual([
      ['parentItemId', '4101'],
    ]);
    expect(Array.from(requests[1]?.url.searchParams.entries() ?? [])).toEqual([['itemId', '4101']]);
    expect(result.current.boms.data).toEqual({ items: [bom(701), bom(702)] });
    expect(result.current.routings.data).toEqual({ items: [routing(801), routing(802)] });
    expect(productionPlanReferenceKeys.boms(4101)).not.toEqual(
      productionPlanReferenceKeys.routings(4101),
    );
  });

  it('requests production lines with exactly plantId and includeInactive, preserving hierarchy, metadata, and truncation', async () => {
    const { fetch, requests } = recordingFetch([
      {
        match: (request) => isGet(request, PRODUCTION_LINES_PATH),
        respond: () =>
          jsonResponse({
            items: [productionLine(901), productionLine(902)],
            page: { page: 1, size: 2, total: 3 },
          }),
      },
    ]);
    const { result } = renderHookWithProviders(() => useProductionLineReferenceQuery(3101), {
      fetch,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('GET');
    expect(requests[0]?.url.pathname).toBe(PRODUCTION_LINES_PATH);
    expect(Array.from(requests[0]?.url.searchParams.entries() ?? [])).toEqual([
      ['plantId', '3101'],
      ['includeInactive', 'true'],
    ]);
    expect(result.current.data).toEqual({
      items: [productionLine(901), productionLine(902)],
      page: { page: 1, size: 2, total: 3 },
      truncated: true,
    });
  });

  it('keeps a failed BOM query separate from successful Routing and production-line data', async () => {
    const { fetch } = recordingFetch([
      {
        match: (request) => isGet(request, BOMS_PATH),
        respond: () => jsonResponse({ message: 'Synthetic BOM failure' }, { status: 503 }),
      },
      {
        match: (request) => isGet(request, ROUTINGS_PATH),
        respond: () => jsonResponse({ items: [routing(802)] }),
      },
      {
        match: (request) => isGet(request, PRODUCTION_LINES_PATH),
        respond: () =>
          jsonResponse({
            items: [productionLine(902)],
            page: { page: 1, size: 25, total: 1 },
          }),
      },
    ]);
    const { result } = renderHookWithProviders(
      () => ({
        boms: useBomReferenceQuery(4101),
        routings: useRoutingReferenceQuery(4101),
        productionLines: useProductionLineReferenceQuery(3101),
      }),
      { fetch },
    );

    await waitFor(() => expect(result.current.boms.isError).toBe(true));
    await waitFor(() => expect(result.current.routings.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.productionLines.isSuccess).toBe(true));

    expect(result.current.boms.data).toBeUndefined();
    expect(toApiError(result.current.boms.error)).toMatchObject({ kind: 'http', status: 503 });
    expect(result.current.routings.data).toEqual({ items: [routing(802)] });
    expect(result.current.productionLines.data).toEqual({
      items: [productionLine(902)],
      page: { page: 1, size: 25, total: 1 },
      truncated: false,
    });
  });
});
