import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { useLocationNames } from './queries';

const locationRoute = (aliasName: string | null) =>
  createStubFetch([
    {
      match: (request) => new URL(request.url).pathname === '/mdm/locations/502',
      respond: () =>
        jsonResponse({
          location: {
            locationId: 502,
            warehouseId: 7001,
            locationCode: 'SYN-A-01',
            locationName: '합성 A열 1칸',
            aliasName,
            systemRoleCode: null,
            isActive: true,
          },
          editability: {},
        }),
    },
  ]);

describe('useLocationNames — 도착 위치 표시 이름', () => {
  it('별칭이 없으면 「코드 · 이름」이다', async () => {
    const { result } = renderHookWithProviders(
      () => useLocationNames([{ id: 502, code: 'SYN-A-01' }]),
      { fetch: locationRoute(null) },
    );

    await waitFor(() => {
      expect(result.current.get(502)).toBe('SYN-A-01 · 합성 A열 1칸');
    });
  });

  it('US2-4 별칭이 있으면 위치를 「코드 · 별칭」으로 보인다', async () => {
    const { result } = renderHookWithProviders(
      () => useLocationNames([{ id: 502, code: 'SYN-A-01' }]),
      { fetch: locationRoute('합성 별칭') },
    );

    await waitFor(() => {
      expect(result.current.get(502)).toBe('SYN-A-01 · 합성 별칭');
    });
  });
});
