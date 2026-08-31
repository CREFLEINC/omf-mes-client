import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { useLotCandidatesByItem } from './lot-candidates';

const lotsRoute = (itemId: number, body: unknown): StubRoute => ({
  match: (req) => {
    const url = new URL(req.url);
    return (
      req.method === 'GET' &&
      url.pathname === '/trace/lots' &&
      url.searchParams.get('itemId') === String(itemId)
    );
  },
  respond: () => jsonResponse(body),
});

describe('useLotCandidatesByItem', () => {
  it('빈 목록이면 아무것도 조회하지 않는다', () => {
    const fetch = createStubFetch([]);
    const { result } = renderHookWithProviders(() => useLotCandidatesByItem([]), { fetch });

    expect(result.current).toEqual({});
  });

  it('품목마다 한 번씩 조회하고 held를 옮긴다', async () => {
    const fetch = createStubFetch([
      lotsRoute(910001, {
        items: [
          {
            lotId: 1001,
            lotNo: 'SYN-LOT-1001',
            held: true,
            expiryDate: '2027-01-01',
            itemId: 910001,
          },
          { lotId: 1002, lotNo: 'SYN-LOT-1002', expiryDate: null, itemId: 910001 },
        ],
        page: { page: 1, size: 100, total: 2 },
      }),
      lotsRoute(910002, {
        items: [{ lotId: 2001, lotNo: 'SYN-LOT-2001', held: false, itemId: 910002 }],
        page: { page: 1, size: 100, total: 1 },
      }),
    ]);
    const { result } = renderHookWithProviders(() => useLotCandidatesByItem([910001, 910002]), {
      fetch,
    });

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

  it('같은 품목이 중복되면 한 번만 조회한다', async () => {
    const fetch = createStubFetch([
      lotsRoute(910001, { items: [], page: { page: 1, size: 100, total: 0 } }),
    ]);
    const { result } = renderHookWithProviders(() => useLotCandidatesByItem([910001, 910001]), {
      fetch,
    });

    await waitFor(() => {
      expect(result.current[910001]).toBeDefined();
    });

    // 중복 품목이 결과 키에서도 하나로 접힌다 — 스텁이 한 요청만 받아도 예외가 나지 않는 것이
    // 곧 한 번만 조회했다는 뜻이다(스텁은 규칙에 없는 요청을 받으면 던진다).
    expect(Object.keys(result.current)).toEqual(['910001']);
  });

  it('잘렸으면 truncated를 참으로 낸다', async () => {
    const fetch = createStubFetch([
      lotsRoute(910001, {
        items: [{ lotId: 1001, lotNo: 'SYN-LOT-1001', itemId: 910001 }],
        page: { page: 1, size: 100, total: 5 },
      }),
    ]);
    const { result } = renderHookWithProviders(() => useLotCandidatesByItem([910001]), { fetch });

    await waitFor(() => {
      expect(result.current[910001]?.truncated).toBe(true);
    });
  });

  it('조회 실패를 알린다', async () => {
    const fetch = createStubFetch([
      {
        match: (req) => req.method === 'GET',
        respond: () => jsonResponse({ message: 'x' }, { status: 500 }),
      },
    ]);
    const { result } = renderHookWithProviders(() => useLotCandidatesByItem([910001]), { fetch });

    await waitFor(() => {
      expect(result.current[910001]?.isError).toBe(true);
    });
  });
});
