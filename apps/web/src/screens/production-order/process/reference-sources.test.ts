import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { locationOptionLabel } from '../../../patterns/location-label';
import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubFetch,
  type StubRoute,
} from '../../../test/api-harness';
import { useLocationSource } from './reference-sources';

const WAREHOUSES_PATH = '/mdm/warehouses';

const warehouse = (
  warehouseId: number,
  warehouseTypeCode: string,
  plantId = 501,
  isActive = true,
) => ({
  warehouseId,
  plantId,
  warehouseCode: `SYN-WH-${warehouseId}`,
  warehouseName: `Synthetic warehouse ${warehouseId}`,
  warehouseTypeCode,
  isActive,
});

const recordingFetch = (routes: StubRoute[]): { fetch: StubFetch; requests: URL[] } => {
  const requests: URL[] = [];
  const stub = createStubFetch(routes);

  return {
    requests,
    fetch: async (request) => {
      requests.push(new URL(request.url));
      return stub(request);
    },
  };
};

const warehousesRoute = (items: unknown[]): StubRoute => ({
  match: (request) => request.method === 'GET' && new URL(request.url).pathname === WAREHOUSES_PATH,
  respond: () => jsonResponse({ items, page: { page: 1, size: 200, total: items.length } }),
});

/* 위치 고르기 팝업의 창고 분류 — W/O 의 공장 창고만 받는다(서버 선행 P-109 · omf-mes-server#809). */
describe('useLocationSource', () => {
  it('창고 목록을 W/O 의 공장(plantId)으로 부른다', async () => {
    const { fetch, requests } = recordingFetch([
      warehousesRoute([warehouse(34, 'PRODUCT'), warehouse(35, 'GENERAL')]),
    ]);
    const { result } = renderHookWithProviders(() => useLocationSource(501, 'PRODUCT'), {
      fetch,
    });

    await waitFor(() => expect(result.current).not.toBeNull());

    expect(requests.map((url) => url.pathname)).toEqual([WAREHOUSES_PATH]);
    expect(requests[0]?.searchParams.get('plantId')).toBe('501');
    expect(result.current?.filter?.options).toEqual([
      { value: '34', label: 'Synthetic warehouse 34' },
    ]);
  });

  it('P-109 전 서버가 다른 공장 창고를 함께 내도 분류 선택지에 넣지 않는다', async () => {
    const { fetch } = recordingFetch([
      warehousesRoute([
        warehouse(34, 'PRODUCT'),
        warehouse(37, 'PRODUCT', 502),
        warehouse(36, 'PRODUCT', 501, false),
      ]),
    ]);
    const { result } = renderHookWithProviders(() => useLocationSource(501, 'PRODUCT'), {
      fetch,
    });

    await waitFor(() => expect(result.current).not.toBeNull());

    expect(result.current?.filter?.options.map((option) => option.value)).toEqual(['34']);
  });

  it('공장을 모르면 창고를 부르지 않고 팝업도 열지 않는다', () => {
    const { fetch, requests } = recordingFetch([]);
    const { result } = renderHookWithProviders(() => useLocationSource(null, 'PRODUCT'), {
      fetch,
    });

    expect(result.current).toBeNull();
    expect(requests).toHaveLength(0);
  });
});

describe('useLocationSource — 별칭(피처 007 · #267)', () => {
  it('US2-4 별칭이 있으면 이름 칸이 별칭이고, 고른 칸은 「코드 · 별칭」이다', async () => {
    const { fetch } = recordingFetch([
      warehousesRoute([warehouse(34, 'PRODUCT')]),
      {
        match: (request) =>
          request.method === 'GET' && new URL(request.url).pathname === '/mdm/locations',
        respond: () =>
          jsonResponse({
            items: [
              {
                locationId: 601,
                warehouseId: 34,
                locationCode: 'SYN-LOC-601',
                locationName: 'Synthetic location 601',
                aliasName: '합성 별칭',
                isActive: true,
              },
            ],
            page: { page: 1, size: 20, total: 1 },
          }),
      },
    ]);
    const { result } = renderHookWithProviders(() => useLocationSource(501, 'PRODUCT'), {
      fetch,
    });

    await waitFor(() => expect(result.current).not.toBeNull());
    const found = await result.current?.search('', 1, '34');
    const [row] = found?.items ?? [];

    expect(row?.name).toBe('합성 별칭');
    expect(
      row === undefined
        ? ''
        : locationOptionLabel({ locationCode: row.code, locationName: row.name }),
    ).toBe('SYN-LOC-601 · 합성 별칭');
  });
});
