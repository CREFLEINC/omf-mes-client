import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../test/api-harness';
import { useLocationByCode, useLocations } from './locations';

const page = { page: 0, size: 20, totalElements: 0, totalPages: 1 };

const capturing = (pathname: string, body: unknown, seen: URL[]): StubRoute => ({
  match: (request) => new URL(request.url).pathname === pathname,
  respond: (request) => {
    seen.push(new URL(request.url));
    return jsonResponse(body);
  },
});

const location = (locationId: number, locationCode: string) => ({
  locationId,
  warehouseId: 2,
  locationCode,
  locationName: '자리',
  locationTypeCode: 'RACK',
  allowMixedItem: true,
  allowMixedLot: true,
  isActive: true,
});

describe('위치 조회', () => {
  it('창고로 좁혀 묻는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch([capturing('/mdm/locations', { items: [], page }, seen)]);

    const { result } = renderHookWithProviders(() => useLocations(2), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(seen[0]?.searchParams.get('warehouseId')).toBe('2');
  });

  /* 부분 일치는 여러 건을 내고, 찾는 줄이 첫 쪽 밖으로 밀리면 없는 것과 구별되지 않는다. */
  it('스캔한 코드는 정확 일치 축으로 묻는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch([
      capturing('/mdm/locations', { items: [location(5, 'A-01-03')], page }, seen),
    ]);

    const { result } = renderHookWithProviders(() => useLocationByCode(2, 'A-01-03'), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(seen[0]?.searchParams.get('locationCode')).toBe('A-01-03');
    expect(seen[0]?.searchParams.get('q')).toBeNull();
    expect(result.current.data?.locationId).toBe(5);
  });

  /* 정확 일치가 지켜지지 않으면 남의 자리를 이 자리로 보인다. */
  it('코드가 다른 줄이 와도 그것을 이 위치로 보지 않는다', async () => {
    const fetch = createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/mdm/locations',
        respond: () => jsonResponse({ items: [location(9, 'A-01-030')], page }),
      },
    ]);

    const { result } = renderHookWithProviders(() => useLocationByCode(2, 'A-01-03'), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBeNull();
  });

  it('지시를 고르고 스캔하기 전에는 묻지 않는다', () => {
    const fetch = createStubFetch([]);

    const { result } = renderHookWithProviders(() => useLocationByCode(null, 'A-01-03'), { fetch });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
