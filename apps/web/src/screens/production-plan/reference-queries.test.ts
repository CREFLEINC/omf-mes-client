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
  ...(bomId === 702 ? { effectiveTo: '2026-12-31' } : {}),
  baseQty: bomId === 701 ? 12.5 : 5,
  baseUomId: 8101,
});

const routing = (routingId: number) => ({
  routingId,
  itemId: 4101,
  routingCode: `ROUTE-SYN-${String(routingId)}`,
  routingVersion: routingId === 801 ? 8 : 2,
  statusCode: routingId === 801 ? 'OBSOLETE' : 'DRAFT',
  ...(routingId === 802 ? { effectiveFrom: '2026-02-01', effectiveTo: '2026-11-30' } : {}),
});

const productionLine = (productionLineId: number) => ({
  productionLineId,
  plantId: 3101,
  ...(productionLineId === 902 ? { parentLineId: 901 } : {}),
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
    expect(result.current.boms.data).toEqual({
      items: [{ ...bom(701), effectiveTo: null }, bom(702)],
    });
    expect(result.current.routings.data).toEqual({
      items: [{ ...routing(801), effectiveFrom: null, effectiveTo: null }, routing(802)],
    });
    expect(result.current.boms.data?.items[0]?.effectiveTo).toBeNull();
    expect(result.current.routings.data?.items[0]?.effectiveFrom).toBeNull();
    expect(result.current.routings.data?.items[0]?.effectiveTo).toBeNull();
    expect(productionPlanReferenceKeys.boms(4101)).not.toEqual(
      productionPlanReferenceKeys.routings(4101),
    );
  });

  it('생산라인을 서버 쪽 크기로 끝까지 읽고 계층·비활성·서버 순서를 보존한다', async () => {
    const { fetch, requests } = recordingFetch([
      {
        match: (request) => isGet(request, PRODUCTION_LINES_PATH),
        respond: (request) =>
          jsonResponse({
            items: [productionLine(new URL(request.url).searchParams.has('page') ? 902 : 901)],
            page: {
              page: Number(new URL(request.url).searchParams.get('page') ?? '1'),
              size: 1,
              total: 2,
            },
          }),
      },
    ]);
    const { result } = renderHookWithProviders(() => useProductionLineReferenceQuery(3101), {
      fetch,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(requests).toHaveLength(2);
    expect(requests[0]?.method).toBe('GET');
    expect(requests[0]?.url.pathname).toBe(PRODUCTION_LINES_PATH);
    expect(Array.from(requests[0]?.url.searchParams.entries() ?? [])).toEqual([
      ['plantId', '3101'],
      ['includeInactive', 'true'],
      ['size', '100'],
    ]);
    expect(requests[1]?.url.searchParams.get('page')).toBe('2');
    expect(result.current.data).toEqual({
      items: [{ ...productionLine(901), parentLineId: null }, productionLine(902)],
      total: 2,
    });
    expect(result.current.data?.items[0]?.parentLineId).toBeNull();
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
      total: 1,
    });
  });

  it.each([
    { label: '다른 공장 행', nextPlantId: 9999, nextTotal: 2 },
    { label: '바뀐 total', nextPlantId: 3101, nextTotal: 3 },
  ])('$label를 조회 정본으로 받지 않는다', async ({ nextPlantId, nextTotal }) => {
    const fetch: StubFetch = async (request) => {
      const page = Number(new URL(request.url).searchParams.get('page') ?? '1');
      return jsonResponse({
        items: [
          page === 1 ? productionLine(901) : { ...productionLine(902), plantId: nextPlantId },
        ],
        page: { page, size: 1, total: page === 1 ? 2 : nextTotal },
      });
    };
    const { result } = renderHookWithProviders(() => useProductionLineReferenceQuery(3101), {
      fetch,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toEqual(
      new Error('생산라인 전체 목록의 쪽 정보가 일관되지 않습니다.'),
    );
  });

  it.each([
    { label: '시작 쪽', page: { page: 2, size: 1, total: 0 }, items: [] },
    { label: '쪽 크기', page: { page: 1, size: 0, total: 1 }, items: [productionLine(901)] },
    { label: '전체 건수', page: { page: 1, size: 1, total: -1 }, items: [] },
  ])('첫 응답의 $label 메타가 유효하지 않으면 실패한다', async ({ page, items }) => {
    const fetch: StubFetch = async () => jsonResponse({ items, page });
    const { result } = renderHookWithProviders(() => useProductionLineReferenceQuery(3101), {
      fetch,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(
      new Error('생산라인 전체 목록의 쪽 정보가 일관되지 않습니다.'),
    );
  });

  it('끝까지 읽어도 고유 생산라인이 total보다 적으면 부분 성공으로 숨기지 않는다', async () => {
    const fetch: StubFetch = async (request) => {
      const page = Number(new URL(request.url).searchParams.get('page') ?? '1');
      return jsonResponse({
        items: page === 1 ? [productionLine(901)] : [],
        page: { page, size: 1, total: 2 },
      });
    };
    const { result } = renderHookWithProviders(() => useProductionLineReferenceQuery(3101), {
      fetch,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(new Error('생산라인 전체 목록을 완성하지 못했습니다.'));
  });
});
