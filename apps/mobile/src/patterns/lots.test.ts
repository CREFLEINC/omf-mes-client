import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../test/api-harness';
import { useScannedLot } from './lots';

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

describe('스캔값으로 LOT 찾기', () => {
  /* 부분 검색은 여러 줄을 내고, 찾는 줄이 첫 페이지 밖으로 밀리면 없는 것과 구별되지 않는다. */
  it('정확 일치로 묻는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch([
      capturingRoute('/trace/lots', { items: [lotRow(4, SCANNED)], page }, seen),
    ]);

    const { result } = renderHookWithProviders(() => useScannedLot(SCANNED), { fetch });

    await waitFor(() => {
      expect(result.current.data?.lotId).toBe(4);
    });
    expect(seen[0]?.searchParams.get('lotNo')).toBe(SCANNED);
    expect(seen[0]?.searchParams.get('q')).toBeNull();
  });

  /* 정확 일치가 지켜지지 않으면 남의 값을 이 LOT 의 것으로 보이게 된다. */
  it('번호가 다른 줄이 와도 그것을 이 LOT으로 보지 않는다', async () => {
    const fetch = createStubFetch([
      route('/trace/lots', { items: [lotRow(7, `${SCANNED}9`)], page }),
    ]);

    const { result } = renderHookWithProviders(() => useScannedLot(SCANNED), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBeNull();
  });

  it('일치하는 줄이 없으면 오류가 아니라 null이다', async () => {
    const fetch = createStubFetch([route('/trace/lots', { items: [], page })]);

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
