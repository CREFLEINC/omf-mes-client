import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { shipDay, useTodayRequests } from './queries';

const page = { page: 0, size: 20, totalElements: 0, totalPages: 1 };

const capturing = (pathname: string, body: unknown, seen: URL[]): StubRoute => ({
  match: (request) => new URL(request.url).pathname === pathname,
  respond: (request) => {
    seen.push(new URL(request.url));
    return jsonResponse(body);
  },
});

describe('오늘 출하분', () => {
  /* 계약이 날짜로 받는다. 시각까지 실으면 서버가 요청을 물리고 목록이 영영 뜨지 않는다. */
  it('시각 없이 날짜만 잡는다', () => {
    const day = shipDay(new Date(2026, 8, 1, 14, 30));

    expect(day.from).toBe('2026-09-01');
    expect(day.to).toBe('2026-09-01');
  });

  it('기간을 비우지 않고 묻는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch([
      capturing('/logistics/shipment-requests', { items: [], page }, seen),
    ]);

    const { result } = renderHookWithProviders(() => useTodayRequests(new Date(2026, 8, 1)), {
      fetch,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(seen[0]?.searchParams.get('shipDateFrom')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(seen[0]?.searchParams.get('shipDateTo')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  /* 값 목록이 확정 전이라 지어내 실으면 값이 달라지는 날 목록이 조용히 빈다. */
  it('상태 코드로 거르지 않는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch([
      capturing('/logistics/shipment-requests', { items: [], page }, seen),
    ]);

    const { result } = renderHookWithProviders(() => useTodayRequests(new Date(2026, 8, 1)), {
      fetch,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(seen[0]?.searchParams.get('statusCode')).toBeNull();
  });

  it('Q9 출하 완료된 지시서는 세우지 않는다', async () => {
    const fetch = createStubFetch([
      capturing(
        '/logistics/shipment-requests',
        {
          items: [
            { shipmentRequestId: 1, completedShipment: null },
            { shipmentRequestId: 2, completedShipment: { shipmentId: 9, shipmentNo: 'SH-1' } },
          ],
          page,
        },
        [],
      ),
    ]);

    const { result } = renderHookWithProviders(() => useTodayRequests(new Date(2026, 8, 1)), {
      fetch,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.map((each) => each.shipmentRequestId)).toEqual([1]);
  });
});
