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
    warehouseName: '1공장 자재창고',
    locationId: 21,
    locationCode: 'A-01-03',
    locationName: '3단 선반',
    itemId: 31,
    itemCode: 'ABC-123',
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

const itemRoute = (id: number, seen?: URL[]) =>
  route(`/mdm/items/${id}`, { item: { itemCode: 'ABC-123' } }, seen);

const uomRoute = (seen?: URL[]) =>
  route('/mdm/uoms', { items: [{ uomId: 41, uomCode: 'EA' }], page: {} }, seen);

/*
 * 창고·위치 단건 조회는 두지 않는다. 스텁에 없는 요청은 하네스가 던지므로, 화면이 그것을
 * 부르면 시험이 그 자리에서 깨진다 - 되짚어 부르지 않는다는 것을 이 부재가 잰다.
 */
const allRoutes = (seen?: URL[]): StubRoute[] => [itemRoute(31, seen), uomRoute(seen)];

describe('참조 이름 해석', () => {
  /* 이름이 응답에 실려 오므로 기다릴 것이 없다. 첫 그리기부터 이름이 선다. */
  it('창고·위치·품목을 되짚어 부르지 않고 응답에서 푼다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch(allRoutes(seen));

    const { result } = renderHookWithProviders(() => useReferenceNames([balance()]), { fetch });

    expect(result.current.warehouse(11)).toEqual({ kind: 'named', label: '1공장 자재창고' });
    expect(result.current.location(21)).toEqual({ kind: 'named', label: 'A-01-03 (3단 선반)' });
    expect(result.current.item(31)).toEqual({ kind: 'named', label: 'ABC-123' });

    await waitFor(() => {
      expect(result.current.uom(41)).toEqual({ kind: 'named', label: 'EA' });
    });

    expect(seen.filter((url) => url.pathname.startsWith('/mdm/warehouses'))).toHaveLength(0);
    expect(seen.filter((url) => url.pathname.startsWith('/mdm/locations'))).toHaveLength(0);
    expect(seen.filter((url) => url.pathname.startsWith('/mdm/items'))).toHaveLength(0);
  });

  /* 이름이 안 오면 코드만 보인다. 코드도 없으면 그 자리를 모른다고 말한다. */
  it('위치 이름이 비면 코드만 보인다', () => {
    const fetch = createStubFetch(allRoutes());

    const { result } = renderHookWithProviders(
      () => useReferenceNames([balance({ locationName: null })]),
      { fetch },
    );

    expect(result.current.location(21)).toEqual({ kind: 'named', label: 'A-01-03' });
  });

  it('여러 위치에 나뉜 LOT은 위치마다 이름을 푼다', () => {
    const fetch = createStubFetch(allRoutes());

    const { result } = renderHookWithProviders(
      () =>
        useReferenceNames([
          balance(),
          balance({ locationId: 22, locationCode: 'B-02-01', locationName: '평치장' }),
        ]),
      { fetch },
    );

    expect(result.current.location(22)).toEqual({ kind: 'named', label: 'B-02-01 (평치장)' });
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
    expect(result.current.item(null)).toEqual({ kind: 'empty' });
    expect(seen.filter((url) => url.pathname.startsWith('/mdm/items'))).toHaveLength(0);
  });

  /*
   * 잔액이 한 자리도 없는 LOT 은 응답에 품목 코드가 실려 올 곳이 없다. 그때만 되짚어 부른다.
   */
  it('잔액이 없는 LOT 의 품목만 되짚어 부른다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch(allRoutes(seen));

    const { result } = renderHookWithProviders(() => useReferenceNames([], 31), { fetch });

    expect(result.current.item(31)).toEqual({ kind: 'loading' });

    await waitFor(() => {
      expect(result.current.item(31)).toEqual({ kind: 'named', label: 'ABC-123' });
    });

    expect(seen.filter((url) => url.pathname.startsWith('/mdm/items'))).toHaveLength(1);
  });

  /* 잔액에 코드가 있으면 부르지 않는다. */
  it('잔액이 품목 코드를 실어 오면 되짚어 부르지 않는다', () => {
    const seen: URL[] = [];
    const fetch = createStubFetch(allRoutes(seen));

    const { result } = renderHookWithProviders(() => useReferenceNames([balance()], 31), { fetch });

    expect(result.current.item(31)).toEqual({ kind: 'named', label: 'ABC-123' });
    expect(seen.filter((url) => url.pathname.startsWith('/mdm/items'))).toHaveLength(0);
  });

  it('품목 조회가 실패하면 실패로 둔다', async () => {
    const fetch = createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/mdm/items/31',
        respond: () => jsonResponse({ code: 'INTERNAL' }, { status: 500 }),
      },
      uomRoute(),
    ]);

    const { result } = renderHookWithProviders(() => useReferenceNames([], 31), { fetch });

    await waitFor(() => {
      expect(result.current.item(31)).toEqual({ kind: 'failed' });
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
