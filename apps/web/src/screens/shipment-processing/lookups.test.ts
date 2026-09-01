import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { lookupLabel, usePartnerLookup, useWorkerLookup, type LookupEntry } from './lookups';

const getRoute = (pathname: string, body: unknown, status = 200): StubRoute => ({
  match: (req) => req.method === 'GET' && new URL(req.url).pathname === pathname,
  respond: () => jsonResponse(body, { status }),
});

describe('usePartnerLookup', () => {
  it('거래처를 코드·이름 라벨로 옮긴다', async () => {
    const fetch = createStubFetch([
      getRoute('/mdm/partners', {
        items: [
          {
            partnerId: 601,
            partnerCode: 'CUS-01',
            partnerName: 'Synthetic Customer',
            isActive: true,
          },
        ],
        page: { page: 1, size: 200, total: 1 },
      }),
    ]);
    const { result } = renderHookWithProviders(() => usePartnerLookup(), { fetch });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(1);
    });

    expect(result.current.entries[0]).toEqual({
      value: '601',
      label: 'CUS-01 · Synthetic Customer',
      isActive: true,
    });
    expect(result.current.truncated).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('전체 건수가 받은 건수보다 많으면 잘렸다고 낸다', async () => {
    const fetch = createStubFetch([
      getRoute('/mdm/partners', {
        items: [{ partnerId: 601, partnerCode: 'CUS-01', partnerName: 'X', isActive: true }],
        page: { page: 1, size: 200, total: 5 },
      }),
    ]);
    const { result } = renderHookWithProviders(() => usePartnerLookup(), { fetch });

    await waitFor(() => {
      expect(result.current.truncated).toBe(true);
    });
  });

  it('조회 실패를 알린다', async () => {
    const fetch = createStubFetch([getRoute('/mdm/partners', { message: 'x' }, 500)]);
    const { result } = renderHookWithProviders(() => usePartnerLookup(), { fetch });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.entries).toEqual([]);
  });
});

describe('useWorkerLookup', () => {
  it('작업자를 사번·성명 라벨로 옮긴다', async () => {
    const fetch = createStubFetch([
      getRoute('/mdm/workers', {
        items: [
          { workerId: 801, workerNo: 'W-801', workerName: 'Synthetic Worker', isActive: true },
        ],
        page: { page: 1, size: 200, total: 1 },
      }),
    ]);
    const { result } = renderHookWithProviders(() => useWorkerLookup(), { fetch });

    await waitFor(() => {
      expect(result.current.entries).toHaveLength(1);
    });

    expect(result.current.entries[0]).toEqual({
      value: '801',
      label: 'W-801 · Synthetic Worker',
      isActive: true,
    });
  });
});

describe('lookupLabel', () => {
  const entries: LookupEntry[] = [
    { value: '601', label: 'CUS-01 · Synthetic Customer', isActive: true },
  ];

  it('값이 null이면 null을 낸다', () => {
    expect(lookupLabel(entries, null)).toBeNull();
  });

  it('찾으면 라벨을 낸다', () => {
    expect(lookupLabel(entries, 601)).toBe('CUS-01 · Synthetic Customer');
  });

  it('찾지 못하면 null을 낸다', () => {
    expect(lookupLabel(entries, 999)).toBeNull();
  });
});
