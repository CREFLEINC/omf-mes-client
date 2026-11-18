import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { useLotCandidatesByItem } from './lot-candidates';

const lotRoute = (itemId: number, lotNo: string, lot: Record<string, unknown>): StubRoute => ({
  match: (req) => {
    const url = new URL(req.url);
    return (
      req.method === 'GET' &&
      url.pathname === '/trace/lots' &&
      url.searchParams.get('itemId') === String(itemId) &&
      url.searchParams.get('lotNo') === lotNo
    );
  },
  respond: () =>
    jsonResponse({ items: [{ lotNo, itemId, ...lot }], page: { page: 1, size: 1, total: 1 } }),
});

describe('useLotCandidatesByItem', () => {
  it('빈 목록이면 아무것도 조회하지 않는다', () => {
    const fetch = createStubFetch([]);
    const { result } = renderHookWithProviders(() => useLotCandidatesByItem([], {}), { fetch });

    expect(result.current).toEqual({});
  });

  it('집은 LOT 마다 LOT 번호로 한 건씩 조회하고 held를 옮긴다(omf-all-around#302)', async () => {
    const fetch = createStubFetch([
      lotRoute(910001, 'SYN-LOT-1001', { lotId: 1001, held: true, expiryDate: '2027-01-01' }),
      lotRoute(910001, 'SYN-LOT-1002', { lotId: 1002, expiryDate: null }),
      lotRoute(910002, 'SYN-LOT-2001', { lotId: 2001, held: false }),
    ]);
    const { result } = renderHookWithProviders(
      () =>
        useLotCandidatesByItem([910001, 910002], {
          910001: [
            { lotId: 1001, lotNo: 'SYN-LOT-1001' },
            { lotId: 1002, lotNo: 'SYN-LOT-1002' },
          ],
          910002: [{ lotId: 2001, lotNo: 'SYN-LOT-2001' }],
        }),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current[910001]?.items).toHaveLength(2);
      expect(result.current[910002]?.items).toHaveLength(1);
    });

    expect(result.current[910001]?.items[0]).toEqual({
      lotId: 1001,
      lotNo: 'SYN-LOT-1001',
      held: true,
      expiryDate: '2027-01-01',
    });
    // held가 응답에 없으면 false로 낸다.
    expect(result.current[910001]?.items[1]?.held).toBe(false);
    expect(result.current[910002]?.items[0]?.held).toBe(false);
  });

  it('집은 LOT 이 없으면 조회하지 않고 빈 후보를 낸다 — 집지 않은 · 입고 전 LOT 은 나오지 않는다', () => {
    const fetch = createStubFetch([]);
    const { result } = renderHookWithProviders(() => useLotCandidatesByItem([910001], {}), {
      fetch,
    });

    expect(result.current[910001]).toEqual({ items: [], isError: false, isLoading: false });
  });

  it('같은 LOT 을 여러 번 집었어도 한 번만 조회한다', async () => {
    const fetch = createStubFetch([lotRoute(910001, 'SYN-LOT-1001', { lotId: 1001 })]);
    const { result } = renderHookWithProviders(
      () =>
        useLotCandidatesByItem([910001, 910001], {
          910001: [
            { lotId: 1001, lotNo: 'SYN-LOT-1001' },
            { lotId: 1001, lotNo: 'SYN-LOT-1001' },
          ],
        }),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current[910001]?.isLoading).toBe(false);
    });
    expect(result.current[910001]?.items.map((lot) => lot.lotId)).toEqual([1001]);
  });

  it('조회 실패를 알린다', async () => {
    const fetch = createStubFetch([
      {
        match: (req) => req.method === 'GET',
        respond: () => jsonResponse({ message: 'x' }, { status: 500 }),
      },
    ]);
    const { result } = renderHookWithProviders(
      () => useLotCandidatesByItem([910001], { 910001: [{ lotId: 1001, lotNo: 'SYN-LOT-1001' }] }),
      { fetch },
    );

    await waitFor(() => {
      expect(result.current[910001]?.isError).toBe(true);
    });
  });
});
