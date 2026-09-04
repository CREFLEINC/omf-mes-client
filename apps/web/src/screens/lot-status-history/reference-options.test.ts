import type { components } from '@omf-mes/api-client';
import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import {
  referenceOptionKeys,
  useItemReferenceOptions,
  useLocationReferenceOptions,
  useWarehouseReferenceOptions,
} from './reference-options';

const WAREHOUSES_PATH = '/mdm/warehouses';
const LOCATIONS_PATH = '/mdm/locations';
const ITEMS_PATH = '/mdm/items';

const warehouse: components['schemas']['Warehouse'] = {
  warehouseId: 101,
  plantId: 201,
  businessUnitId: 301,
  warehouseCode: 'SAMPLE-WH-01',
  warehouseName: '합성 창고',
  warehouseTypeCode: 'SAMPLE_TYPE',
  managementLevelCode: 'SAMPLE_LEVEL',
  isExternal: false,
  isDefect: false,
  isActive: true,
};
const earlierWarehouse: components['schemas']['Warehouse'] = {
  ...warehouse,
  warehouseId: 104,
  warehouseCode: 'SAMPLE-WH-00',
  warehouseName: '합성 이전 창고',
  isActive: false,
};

const location: components['schemas']['Location'] = {
  locationId: 102,
  warehouseId: 101,
  locationCode: 'SAMPLE-LOC-01',
  locationName: '합성 위치',
  locationTypeCode: 'SAMPLE_TYPE',
  allowMixedItem: true,
  allowMixedLot: true,
  isActive: true,
};
const earlierLocation: components['schemas']['Location'] = {
  ...location,
  locationId: 105,
  locationCode: 'SAMPLE-LOC-00',
  locationName: '합성 이전 위치',
  isActive: false,
};

const item: components['schemas']['Item'] = {
  itemId: 103,
  itemCode: 'SAMPLE-ITEM-01',
  itemName: '합성 품목',
  itemTypeCode: 'SAMPLE_TYPE',
  baseUomId: 401,
  lotControlled: true,
  serialControlTypeCode: 'SAMPLE_SERIAL',
  inspectionRequired: false,
  fifoPolicyCode: 'SAMPLE_FIFO',
  negativeStockAllowed: false,
  isActive: false,
};
const earlierItem: components['schemas']['Item'] = {
  ...item,
  itemId: 106,
  itemCode: 'SAMPLE-ITEM-00',
  itemName: '합성 이전 품목',
  isActive: true,
};

const route = (path: string, items: unknown[], total = items.length): StubRoute => ({
  match: (request) => request.method === 'GET' && new URL(request.url).pathname === path,
  respond: () => jsonResponse({ items, page: { page: 1, size: 50, total } }),
});

describe('LOT 상태 화면 참조 선택지', () => {
  it('창고를 내부 번호가 아닌 코드·이름 선택지로 받고 미사용 포함을 요청한다', async () => {
    const urls: URL[] = [];
    const stub = createStubFetch([route(WAREHOUSES_PATH, [warehouse, earlierWarehouse])]);
    const { result } = renderHookWithProviders(() => useWarehouseReferenceOptions(), {
      fetch: async (request) => {
        urls.push(new URL(request.url));
        return stub(request);
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(urls).toHaveLength(1);
    expect(urls[0]?.searchParams.get('includeInactive')).toBe('true');
    expect(result.current.data).toEqual({
      entries: [
        { value: '101', label: 'SAMPLE-WH-01 · 합성 창고', isActive: true },
        { value: '104', label: 'SAMPLE-WH-00 · 합성 이전 창고', isActive: false },
      ],
      isTruncated: false,
    });
  });

  it('품목 응답 순서·사용 여부를 보존하고 잘린 목록을 밝힌다', async () => {
    const urls: URL[] = [];
    const stub = createStubFetch([route(ITEMS_PATH, [item, earlierItem], 3)]);
    const { result } = renderHookWithProviders(() => useItemReferenceOptions(), {
      fetch: async (request) => {
        urls.push(new URL(request.url));
        return stub(request);
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(urls[0]?.searchParams.get('includeInactive')).toBe('true');
    expect(result.current.data).toEqual({
      entries: [
        { value: '103', label: 'SAMPLE-ITEM-01 · 합성 품목', isActive: false },
        { value: '106', label: 'SAMPLE-ITEM-00 · 합성 이전 품목', isActive: true },
      ],
      isTruncated: true,
    });
  });

  it('창고를 고르기 전에는 위치를 요청하지 않는다', async () => {
    const urls: URL[] = [];
    const { result } = renderHookWithProviders(() => useLocationReferenceOptions(null), {
      fetch: async (request) => {
        urls.push(new URL(request.url));
        return jsonResponse({});
      },
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(urls).toHaveLength(0);
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    '유효하지 않은 창고 ID %p로도 위치를 요청하지 않는다',
    async (warehouseId) => {
      const urls: URL[] = [];
      const { result } = renderHookWithProviders(() => useLocationReferenceOptions(warehouseId), {
        fetch: async (request) => {
          urls.push(new URL(request.url));
          return jsonResponse({});
        },
      });

      await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
      expect(urls).toHaveLength(0);
    },
  );

  it('선택 창고의 위치를 코드·이름으로 받고 창고별 캐시를 쓴다', async () => {
    const urls: URL[] = [];
    const stub = createStubFetch([route(LOCATIONS_PATH, [location, earlierLocation])]);
    const { result } = renderHookWithProviders(() => useLocationReferenceOptions(101), {
      fetch: async (request) => {
        urls.push(new URL(request.url));
        return stub(request);
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Object.fromEntries(urls[0]?.searchParams ?? [])).toEqual({
      warehouseId: '101',
      includeInactive: 'true',
    });
    expect(result.current.data).toEqual({
      entries: [
        { value: '102', label: 'SAMPLE-LOC-01 · 합성 위치', isActive: true },
        { value: '105', label: 'SAMPLE-LOC-00 · 합성 이전 위치', isActive: false },
      ],
      isTruncated: false,
    });
    expect(referenceOptionKeys.locations(101)).not.toEqual(referenceOptionKeys.locations(999));
  });
});
