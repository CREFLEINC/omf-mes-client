import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { useLotBalances, useLotHolds } from './queries';

const SCANNED = '7770001118880002229901015554447777';

const lotRow = (lotId: number, lotNo: string) => ({
  lotId,
  lotNo,
  itemId: 1,
  lotTypeCode: 'MATERIAL',
  plantId: 1,
  initialQty: 120,
  uomId: 1,
  sourceTypeCode: 'RECEIPT',
  sourceId: 1,
  statusCode: 'ACTIVE',
});

const route = (pathname: string, body: unknown): StubRoute => ({
  match: (request) => new URL(request.url).pathname === pathname,
  respond: () => jsonResponse(body),
});

const capturingRoute = (pathname: string, body: unknown, seen: URL[]): StubRoute => ({
  match: (request) => new URL(request.url).pathname === pathname,
  respond: (request) => {
    seen.push(new URL(request.url));
    return jsonResponse(body);
  },
});

const page = { page: 0, size: 20, totalElements: 0, totalPages: 1 };

describe('잔액 조회', () => {
  it('위치별로 갈라 받고 잔액 0인 줄도 받는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch([
      capturingRoute('/inventory/balances', { items: [], page }, seen),
    ]);

    const { result } = renderHookWithProviders(() => useLotBalances(4), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(seen[0]?.searchParams.get('lotId')).toBe('4');
    expect(seen[0]?.searchParams.get('groupBy')).toBe('LOCATION');
    expect(seen[0]?.searchParams.get('includeZero')).toBe('true');
  });

  it('LOT을 찾기 전에는 요청하지 않는다', () => {
    const fetch = createStubFetch([]);

    const { result } = renderHookWithProviders(() => useLotBalances(null), { fetch });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('보류 조회', () => {
  it('해제되지 않은 보류만 받는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch([capturingRoute('/trace/lots/4/holds', { items: [] }, seen)]);

    const { result } = renderHookWithProviders(() => useLotHolds(4), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(seen[0]?.searchParams.get('activeOnly')).toBe('true');
  });

  it('LOT을 찾기 전에는 요청하지 않는다', () => {
    const fetch = createStubFetch([]);

    const { result } = renderHookWithProviders(() => useLotHolds(null), { fetch });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
