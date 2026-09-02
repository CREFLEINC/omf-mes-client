import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { useOpenPurchaseOrders, usePurchaseOrderLines } from './queries';

const page = { page: 0, size: 20, totalElements: 0, totalPages: 1 };

const capturing = (pathname: string, body: unknown, seen: URL[]): StubRoute => ({
  match: (request) => new URL(request.url).pathname === pathname,
  respond: (request) => {
    seen.push(new URL(request.url));
    return jsonResponse(body);
  },
});

describe('미마감 발주 조회', () => {
  /* 상태 코드 값 목록이 확정 전이다. 지어내 실으면 값이 달라지는 날 목록이 조용히 빈다. */
  it('아직 입하가 끝나지 않은 건만 묻고 상태 코드로 거르지 않는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch([
      capturing('/logistics/purchase-orders', { items: [], page }, seen),
    ]);

    const { result } = renderHookWithProviders(() => useOpenPurchaseOrders(), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(seen[0]?.searchParams.get('openOnly')).toBe('true');
    expect(seen[0]?.searchParams.get('statusCode')).toBeNull();
  });
});

describe('발주 라인 조회', () => {
  it('고른 발주의 라인만 묻는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch([
      capturing('/logistics/purchase-orders/7/lines', { items: [] }, seen),
    ]);

    const { result } = renderHookWithProviders(() => usePurchaseOrderLines(7), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(seen[0]?.pathname).toBe('/logistics/purchase-orders/7/lines');
  });

  it('발주를 고르기 전에는 묻지 않는다', () => {
    const fetch = createStubFetch([]);

    const { result } = renderHookWithProviders(() => usePurchaseOrderLines(null), { fetch });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
