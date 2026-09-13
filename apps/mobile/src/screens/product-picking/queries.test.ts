import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { shipDay, toCandidates, useAvailableByLot, useLotPool, useTodayRequests } from './queries';

const page = { page: 0, size: 20, totalElements: 0, totalPages: 1 };

const capturing = (pathname: string, body: unknown, seen: URL[]): StubRoute => ({
  match: (request) => new URL(request.url).pathname === pathname,
  respond: (request) => {
    seen.push(new URL(request.url));
    return jsonResponse(body);
  },
});

const lotRow = (lotId: number, lotNo: string) => ({
  lotId,
  lotNo,
  itemId: 31,
  lotTypeCode: 'PRODUCT',
  plantId: 1,
  initialQty: 500,
  uomId: 9,
  sourceTypeCode: 'PRODUCTION',
  sourceId: 1,
  statusCode: 'NORMAL',
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
});

describe('LOT 후보', () => {
  /* 보류 여부가 LOT 응답에 없다. 줄마다 되짚지 않고 보류만 한 번 더 묻는다. */
  it('전체와 보류를 두 번으로 나눠 묻는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/trace/lots',
        respond: (request) => {
          const url = new URL(request.url);
          seen.push(url);

          return jsonResponse({
            items:
              url.searchParams.get('heldOnly') === 'true'
                ? [lotRow(2, 'B')]
                : [lotRow(1, 'A'), lotRow(2, 'B')],
            page,
          });
        },
      },
    ]);

    const { result } = renderHookWithProviders(() => useLotPool(31), { fetch });

    await waitFor(() => {
      expect(result.current.data).not.toBeUndefined();
    });
    expect(seen).toHaveLength(2);
    expect(result.current.data?.lots).toHaveLength(2);
    expect(result.current.data?.heldLotIds.has(2)).toBe(true);
    expect(result.current.data?.heldLotIds.has(1)).toBe(false);
  });

  it('대상을 고르기 전에는 묻지 않는다', () => {
    const fetch = createStubFetch([]);

    const { result } = renderHookWithProviders(() => useLotPool(null), { fetch });

    expect(result.current.data).toBeUndefined();
  });
});

describe('가용 수량', () => {
  /* 잔액 0인 줄까지 받아야 소진된 LOT 이 목록에서 사라지지 않는다. */
  it('LOT 별로 갈라 받고 잔액 0인 줄도 받는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch([
      capturing(
        '/inventory/balances',
        {
          items: [
            {
              groupBy: 'LOT',
              itemId: 31,
              lotId: 1,
              availableQty: 180,
              uomId: 9,
              onHandQty: 180,
              reservedQty: 0,
              pickedQty: 0,
              blockedQty: 0,
              ownershipTypeCode: 'OWN',
            },
            {
              groupBy: 'LOT',
              itemId: 31,
              lotId: 2,
              availableQty: 0,
              uomId: 9,
              onHandQty: 0,
              reservedQty: 0,
              pickedQty: 0,
              blockedQty: 0,
              ownershipTypeCode: 'OWN',
            },
          ],
          page,
        },
        seen,
      ),
    ]);

    const { result } = renderHookWithProviders(() => useAvailableByLot(31), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(seen[0]?.searchParams.get('groupBy')).toBe('LOT');
    expect(seen[0]?.searchParams.get('includeZero')).toBe('true');
    expect(result.current.data?.get(1)).toBe(180);
    expect(result.current.data?.get(2)).toBe(0);
  });
});

describe('후보 조립', () => {
  it('가용이 없는 LOT 도 후보에서 빼지 않는다', () => {
    const pool = { lots: [lotRow(1, 'A'), lotRow(2, 'B')], heldLotIds: new Set([2]) };
    const candidates = toCandidates(pool, new Map([[1, 180]]));

    expect(candidates).toHaveLength(2);
    expect(candidates[0]?.availableQty).toBe(180);
    expect(candidates[1]?.availableQty).toBe(0);
    expect(candidates[1]?.held).toBe(true);
  });
});
