import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { useInboundReceipts, useKnownVariances, useReceiptLines } from './queries';

const page = { page: 0, size: 20, totalElements: 0, totalPages: 1 };

const capturing = (pathname: string, body: unknown, seen: URL[]): StubRoute => ({
  match: (request) => new URL(request.url).pathname === pathname,
  respond: (request) => {
    seen.push(new URL(request.url));
    return jsonResponse(body);
  },
});

describe('입하 조회', () => {
  /* 값 목록이 확정 전이다. 지어내 실으면 값이 달라지는 날 목록이 조용히 빈다. */
  it('상태 코드로 거르지 않는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch([
      capturing('/logistics/inbound-receipts', { items: [], page }, seen),
    ]);

    const { result } = renderHookWithProviders(() => useInboundReceipts(''), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(seen[0]?.searchParams.get('statusCode')).toBeNull();
  });

  /* 계약이 기간을 요구하지 않는다. 창을 지어내면 그 밖의 입하가 없는 것처럼 보인다. */
  it('기간을 지어내 거르지 않는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch([
      capturing('/logistics/inbound-receipts', { items: [], page }, seen),
    ]);

    const { result } = renderHookWithProviders(() => useInboundReceipts(''), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(seen[0]?.searchParams.get('receiptDateFrom')).toBeNull();
    expect(seen[0]?.searchParams.get('receiptDateTo')).toBeNull();
  });

  it('적어 넣은 것이 있으면 검색 축으로 싣는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch([
      capturing('/logistics/inbound-receipts', { items: [], page }, seen),
    ]);

    const { result } = renderHookWithProviders(() => useInboundReceipts(' IB-2026 '), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(seen[0]?.searchParams.get('q')).toBe('IB-2026');
  });
});

describe('입하 라인 조회', () => {
  it('고른 입하의 라인만 묻는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch([
      capturing('/logistics/inbound-receipts/8/lines', { items: [] }, seen),
    ]);

    const { result } = renderHookWithProviders(() => useReceiptLines(8), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(seen[0]?.pathname).toBe('/logistics/inbound-receipts/8/lines');
  });

  it('입하를 고르기 전에는 묻지 않는다', () => {
    const fetch = createStubFetch([]);

    const { result } = renderHookWithProviders(() => useReceiptLines(null), { fetch });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('적힌 오류 조회', () => {
  it('고른 줄의 오류만 묻는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch([
      capturing('/logistics/inbound-receipt-lines/55/variances', { items: [] }, seen),
    ]);

    const { result } = renderHookWithProviders(() => useKnownVariances(55), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(seen[0]?.pathname).toBe('/logistics/inbound-receipt-lines/55/variances');
  });

  it('줄을 고르기 전에는 묻지 않는다', () => {
    const fetch = createStubFetch([]);

    const { result } = renderHookWithProviders(() => useKnownVariances(null), { fetch });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
