import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { useLotBalances, useLotHolds, useScannedLot } from './queries';

const SCANNED = '0001234500000012002607310001230007';

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

describe('스캔값으로 LOT 찾기', () => {
  it('번호가 정확히 같은 줄만 고른다', async () => {
    const fetch = createStubFetch([
      route('/trace/lots', {
        items: [lotRow(7, `${SCANNED}9`), lotRow(4, SCANNED)],
        page,
      }),
    ]);

    const { result } = renderHookWithProviders(() => useScannedLot(SCANNED), { fetch });

    await waitFor(() => {
      expect(result.current.data).toEqual({ lotId: 4, lotNo: SCANNED, itemId: 1 });
    });
  });

  it('일치하는 줄이 없으면 오류가 아니라 null이다', async () => {
    const fetch = createStubFetch([
      route('/trace/lots', { items: [lotRow(7, `${SCANNED}9`)], page }),
    ]);

    const { result } = renderHookWithProviders(() => useScannedLot(SCANNED), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBeNull();
  });

  it('스캔하기 전에는 요청하지 않는다', () => {
    const fetch = createStubFetch([]);

    const { result } = renderHookWithProviders(() => useScannedLot(null), { fetch });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('조회가 실패하면 오류 상태가 된다', async () => {
    const fetch = createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/trace/lots',
        respond: () => jsonResponse({ code: 'INTERNAL' }, { status: 500 }),
      },
    ]);

    const { result } = renderHookWithProviders(() => useScannedLot(SCANNED), { fetch });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

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
