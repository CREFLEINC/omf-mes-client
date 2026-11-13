import { describe, expect, it } from 'vitest';
import { useLocationOptions } from './lookups';
import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { waitFor } from '@testing-library/react';

/** 별칭이 있는 위치 하나만 주는 스텁(피처 007 · #267). */
const aliasedLocationFetch = () =>
  createStubFetch([
    {
      match: (request) =>
        request.method === 'GET' && new URL(request.url).pathname === '/mdm/locations',
      respond: () =>
        jsonResponse({
          items: [
            {
              locationId: 9291,
              warehouseId: 9101,
              locationCode: 'SAMPLE-LOC-91',
              locationName: '합성 위치 별',
              aliasName: '합성 별칭',
              isActive: true,
            },
          ],
          page: { page: 1, size: 50, total: 1 },
        }),
    },
  ]);

describe('useLocationOptions — 위치 이름', () => {
  it('US2-4 별칭이 있으면 위치를 「코드 · 별칭」으로 보인다', async () => {
    const { result } = renderHookWithProviders(() => useLocationOptions(9101), {
      fetch: aliasedLocationFetch(),
    });

    await waitFor(() => {
      expect(result.current.entries[0]?.label).toBe('SAMPLE-LOC-91 · 합성 별칭');
    });
  });
});
