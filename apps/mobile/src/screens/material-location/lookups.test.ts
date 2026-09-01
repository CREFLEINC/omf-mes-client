import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { useReferenceNames } from './lookups';
import type { InventoryBalance } from './queries';

const balance = (overrides: Partial<InventoryBalance> = {}): InventoryBalance =>
  ({
    groupBy: 'LOCATION',
    warehouseId: 11,
    locationId: 21,
    itemId: 31,
    ownershipTypeCode: 'OWNED',
    onHandQty: 120,
    reservedQty: 20,
    pickedQty: 0,
    blockedQty: 0,
    availableQty: 100,
    uomId: 41,
    ...overrides,
  }) as InventoryBalance;

const route = (pathname: string, body: unknown, seen?: URL[]): StubRoute => ({
  match: (request) => new URL(request.url).pathname === pathname,
  respond: (request) => {
    seen?.push(new URL(request.url));
    return jsonResponse(body);
  },
});

const warehouseRoute = (id: number, seen?: URL[]) =>
  route(`/mdm/warehouses/${id}`, { warehouse: { warehouseName: '1공장 자재창고' } }, seen);

const locationRoute = (id: number, seen?: URL[]) =>
  route(
    `/mdm/locations/${id}`,
    { location: { locationCode: 'A-01-03', locationName: '3단 선반' } },
    seen,
  );

const itemRoute = (id: number, seen?: URL[]) =>
  route(`/mdm/items/${id}`, { item: { itemCode: 'ABC-123' } }, seen);

const uomRoute = (seen?: URL[]) =>
  route('/mdm/uoms', { items: [{ uomId: 41, uomCode: 'EA' }], page: {} }, seen);

const allRoutes = (seen?: URL[]): StubRoute[] => [
  warehouseRoute(11, seen),
  locationRoute(21, seen),
  itemRoute(31, seen),
  uomRoute(seen),
];

describe('참조 이름 해석', () => {
  it('창고·위치·품목·단위를 이름으로 푼다', async () => {
    const fetch = createStubFetch(allRoutes());

    const { result } = renderHookWithProviders(() => useReferenceNames([balance()]), { fetch });

    await waitFor(() => {
      expect(result.current.warehouse(11)).toEqual({ kind: 'named', label: '1공장 자재창고' });
    });
    expect(result.current.item(31)).toEqual({ kind: 'named', label: 'ABC-123' });
    expect(result.current.uom(41)).toEqual({ kind: 'named', label: 'EA' });
  });

  it('위치는 코드와 이름을 함께 보인다', async () => {
    const fetch = createStubFetch(allRoutes());

    const { result } = renderHookWithProviders(() => useReferenceNames([balance()]), { fetch });

    await waitFor(() => {
      expect(result.current.location(21)).toEqual({
        kind: 'named',
        label: 'A-01-03 (3단 선반)',
      });
    });
  });

  it('여러 위치에 나뉜 LOT은 위치마다 이름을 푼다', async () => {
    const fetch = createStubFetch([
      warehouseRoute(11),
      locationRoute(21),
      route(
        '/mdm/locations/22',
        { location: { locationCode: 'B-02-01', locationName: '평치장' } },
        undefined,
      ),
      itemRoute(31),
      uomRoute(),
    ]);

    const { result } = renderHookWithProviders(
      () => useReferenceNames([balance(), balance({ locationId: 22 })]),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current.location(22)).toEqual({ kind: 'named', label: 'B-02-01 (평치장)' });
    });
    expect(result.current.location(21)).toEqual({ kind: 'named', label: 'A-01-03 (3단 선반)' });
  });

  it('번호가 비면 부르지 않고 빈 값으로 둔다', () => {
    const seen: URL[] = [];
    const fetch = createStubFetch(allRoutes(seen));

    const { result } = renderHookWithProviders(
      () => useReferenceNames([balance({ locationId: null })]),
      { fetch },
    );

    expect(result.current.location(null)).toEqual({ kind: 'empty' });
    expect(seen.filter((url) => url.pathname.startsWith('/mdm/locations'))).toHaveLength(0);
  });

  it('아직 오지 않은 이름은 불러오는 중이다', () => {
    const fetch = createStubFetch(allRoutes());

    const { result } = renderHookWithProviders(() => useReferenceNames([balance()]), { fetch });

    expect(result.current.warehouse(11)).toEqual({ kind: 'loading' });
  });

  it('이름 조회가 실패하면 실패로 둔다', async () => {
    const fetch = createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/mdm/warehouses/11',
        respond: () => jsonResponse({ code: 'INTERNAL' }, { status: 500 }),
      },
      locationRoute(21),
      itemRoute(31),
      uomRoute(),
    ]);

    const { result } = renderHookWithProviders(() => useReferenceNames([balance()]), { fetch });

    await waitFor(() => {
      expect(result.current.warehouse(11)).toEqual({ kind: 'failed' });
    });
  });

  it('목록에 없는 단위는 알 수 없음으로 둔다', async () => {
    const fetch = createStubFetch(allRoutes());

    const { result } = renderHookWithProviders(() => useReferenceNames([balance()]), { fetch });

    await waitFor(() => {
      expect(result.current.uom(41).kind).toBe('named');
    });
    expect(result.current.uom(99)).toEqual({ kind: 'unknown' });
  });

  it('미사용 단위까지 받는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch(allRoutes(seen));

    const { result } = renderHookWithProviders(() => useReferenceNames([balance()]), { fetch });

    await waitFor(() => {
      expect(result.current.uom(41).kind).toBe('named');
    });
    const uomCall = seen.find((url) => url.pathname === '/mdm/uoms');
    expect(uomCall?.searchParams.get('includeInactive')).toBe('true');
  });
});
