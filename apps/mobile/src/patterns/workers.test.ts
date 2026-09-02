import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../test/api-harness';
import { useWorkerId } from './workers';

const page = { page: 0, size: 20, totalElements: 0, totalPages: 1 };

const worker = (workerId: number, workerNo: string) => ({
  workerId,
  workerNo,
  workerName: '김철수',
  businessUnitId: 1,
  plantId: 1,
  statusCode: 'ACTIVE',
});

const route = (items: unknown[]): StubRoute => ({
  match: (request) => new URL(request.url).pathname === '/mdm/workers',
  respond: () => jsonResponse({ items, page }),
});

describe('사번으로 작업자 찾기', () => {
  /* 검색은 부분 일치라 사번이 비슷한 다른 사람이 함께 온다. 첫 줄을 그대로 쓰면 남이 된다. */
  it('사번이 정확히 같은 사람만 쓴다', async () => {
    const fetch = createStubFetch([route([worker(11, '9000280'), worker(77, '900028')])]);

    const { result } = renderHookWithProviders(() => useWorkerId('900028'), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBe(77);
  });

  it('사번으로 좁혀 묻는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/mdm/workers',
        respond: (request) => {
          seen.push(new URL(request.url));
          return jsonResponse({ items: [worker(77, '900028')], page });
        },
      },
    ]);

    const { result } = renderHookWithProviders(() => useWorkerId('900028'), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(seen[0]?.searchParams.get('q')).toBe('900028');
  });

  it('없으면 오류가 아니라 null이다', async () => {
    const fetch = createStubFetch([route([worker(11, '9000280')])]);

    const { result } = renderHookWithProviders(() => useWorkerId('900028'), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBeNull();
  });

  it('사번을 확인하기 전에는 묻지 않는다', () => {
    const fetch = createStubFetch([]);

    const { result } = renderHookWithProviders(() => useWorkerId(null), { fetch });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('조회가 실패하면 오류 상태가 된다', async () => {
    const fetch = createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/mdm/workers',
        respond: () => jsonResponse({ message: '실패' }, { status: 500 }),
      },
    ]);

    const { result } = renderHookWithProviders(() => useWorkerId('900028'), { fetch });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
