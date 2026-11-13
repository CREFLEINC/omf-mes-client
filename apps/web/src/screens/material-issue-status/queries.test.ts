import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { useDestinationOptions } from './queries';

const location = {
  locationId: 9291,
  warehouseId: 9101,
  locationCode: 'SAMPLE-LOC-91',
  locationName: '합성 위치 별',
  aliasName: '합성 별칭',
  isActive: true,
};

describe('useDestinationOptions — 입고지 선택 칸', () => {
  it('US2-4 별칭이 있으면 위치를 「코드 · 별칭」으로 보인다', async () => {
    const fetch = createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/mdm/locations/9291',
        respond: () => jsonResponse({ location }),
      },
      {
        match: (request) => new URL(request.url).pathname === '/mdm/locations',
        respond: () => jsonResponse({ items: [location], page: { page: 1, size: 50, total: 1 } }),
      },
    ]);
    const { result } = renderHookWithProviders(() => useDestinationOptions(9291), { fetch });

    await waitFor(() => {
      expect(result.current.data?.[0]?.label).toBe('SAMPLE-LOC-91 · 합성 별칭');
    });
  });
});
