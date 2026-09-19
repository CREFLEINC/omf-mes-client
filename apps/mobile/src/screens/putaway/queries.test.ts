import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderHookWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { usePutawayTasks } from './queries';

const page = { page: 0, size: 20, totalElements: 0, totalPages: 1 };

const capturing = (pathname: string, body: unknown, seen: URL[]): StubRoute => ({
  match: (request) => new URL(request.url).pathname === pathname,
  respond: (request) => {
    seen.push(new URL(request.url));
    return jsonResponse(body);
  },
});

describe('적치 지시 조회', () => {
  /* 끝낸 지시도 함께 오면 같은 자리를 두 번 다녀온다. */
  it('적치 대기 상태로 좁혀 묻는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch([
      capturing('/logistics/putaway-tasks', { items: [], page }, seen),
    ]);

    const { result } = renderHookWithProviders(() => usePutawayTasks(77), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(seen[0]?.searchParams.get('statusCode')).toBe('PENDING');
  });

  /*
   * omf-all-around#26 — 적치에는 담당자가 없다(사용자 결정 2026-09-19). 실제 지시가 모두 담당자
   * 없이 만들어져, 담당자로 거르면 목록이 늘 빈다. 사번을 확인했어도 조회 조건에 싣지 않는다.
   */
  it('담당자로 거르지 않는다 — 요청에 assignedWorkerId 가 없다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch([
      capturing('/logistics/putaway-tasks', { items: [], page }, seen),
    ]);

    const { result } = renderHookWithProviders(() => usePutawayTasks(77), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(seen[0]?.searchParams.has('assignedWorkerId')).toBe(false);
  });

  it('작업자를 확인하기 전에는 묻지 않는다', () => {
    const fetch = createStubFetch([]);

    const { result } = renderHookWithProviders(() => usePutawayTasks(null), { fetch });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
