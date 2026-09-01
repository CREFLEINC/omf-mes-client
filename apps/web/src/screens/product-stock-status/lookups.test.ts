import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { itemFixtures, locationFixtures, lotFixtures, warehouseFixtures } from './fixtures';
import { useItemOptions, useLocationOptions, useLotOptions, useWarehouseOptions } from './lookups';

const WAREHOUSES_PATH = '/mdm/warehouses';
const LOCATIONS_PATH = '/mdm/locations';
const ITEMS_PATH = '/mdm/items';
const LOTS_PATH = '/trace/lots';

const route = (path: string, items: unknown[], total = items.length): StubRoute => ({
  match: (request) => request.method === 'GET' && new URL(request.url).pathname === path,
  respond: () => jsonResponse({ items, page: { page: 1, size: 50, total } }),
});

describe('useWarehouseOptions', () => {
  it('코드·이름 선택지로 받고 미사용 포함을 요청한다', async () => {
    const urls: URL[] = [];
    const stub = createStubFetch([route(WAREHOUSES_PATH, warehouseFixtures)]);
    const { result } = renderHookWithProviders(() => useWarehouseOptions(), {
      fetch: async (request) => {
        urls.push(new URL(request.url));
        return stub(request);
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(urls[0]?.searchParams.get('includeInactive')).toBe('true');
    expect(result.current.data?.entries).toEqual([
      { value: '9101', label: 'SAMPLE-WH-01 · 합성 자재창고 가', isActive: true },
      { value: '9102', label: 'SAMPLE-WH-02 · 합성 자재창고 나', isActive: true },
    ]);
  });
});

describe('useItemOptions', () => {
  it('잘린 목록을 밝힌다', async () => {
    const stub = createStubFetch([route(ITEMS_PATH, itemFixtures, itemFixtures.length + 1)]);
    const { result } = renderHookWithProviders(() => useItemOptions(), { fetch: stub });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.isTruncated).toBe(true);
  });
});

describe('useLocationOptions', () => {
  it('창고를 고르기 전에는 요청하지 않는다', async () => {
    const urls: URL[] = [];
    const { result } = renderHookWithProviders(() => useLocationOptions(null), {
      fetch: async (request) => {
        urls.push(new URL(request.url));
        return jsonResponse({});
      },
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(urls).toHaveLength(0);
  });

  it.each([0, -1, 1.5])('유효하지 않은 창고 번호 %p로도 요청하지 않는다', async (warehouseId) => {
    const urls: URL[] = [];
    const { result } = renderHookWithProviders(() => useLocationOptions(warehouseId), {
      fetch: async (request) => {
        urls.push(new URL(request.url));
        return jsonResponse({});
      },
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(urls).toHaveLength(0);
  });

  it('창고를 고르면 그 창고의 위치를 받는다', async () => {
    const urls: URL[] = [];
    const stub = createStubFetch([route(LOCATIONS_PATH, locationFixtures)]);
    const { result } = renderHookWithProviders(() => useLocationOptions(9101), {
      fetch: async (request) => {
        urls.push(new URL(request.url));
        return stub(request);
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(urls[0]?.searchParams.get('warehouseId')).toBe('9101');
    expect(result.current.data?.entries).toEqual([
      { value: '9201', label: 'SAMPLE-LOC-01 · 합성 위치 가', isActive: true },
    ]);
  });
});

describe('useLotOptions', () => {
  it('꺼져 있으면 품목이 있어도 요청하지 않는다', async () => {
    const urls: URL[] = [];
    const { result } = renderHookWithProviders(() => useLotOptions(9301, false), {
      fetch: async (request) => {
        urls.push(new URL(request.url));
        return jsonResponse({});
      },
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(urls).toHaveLength(0);
  });

  it('켜져 있어도 품목이 없으면 요청하지 않는다', async () => {
    const urls: URL[] = [];
    const { result } = renderHookWithProviders(() => useLotOptions(null, true), {
      fetch: async (request) => {
        urls.push(new URL(request.url));
        return jsonResponse({});
      },
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(urls).toHaveLength(0);
  });

  it('품목이 있고 켜져 있으면 그 품목의 LOT을 받는다', async () => {
    const urls: URL[] = [];
    const stub = createStubFetch([route(LOTS_PATH, lotFixtures)]);
    const { result } = renderHookWithProviders(() => useLotOptions(9301, true), {
      fetch: async (request) => {
        urls.push(new URL(request.url));
        return stub(request);
      },
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(urls[0]?.searchParams.get('itemId')).toBe('9301');
    expect(result.current.data?.entries).toEqual([
      { value: '9401', label: 'SAMPLE-LOT-0001', isActive: true },
      { value: '9402', label: 'SAMPLE-LOT-0002', isActive: true },
    ]);
  });
});
