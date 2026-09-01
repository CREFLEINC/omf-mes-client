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
  /* 비우면 본인이 되는 것이 아니다. 비우면 남의 지시까지 함께 온다. */
  it('담당자로 좁혀 묻고 상태 코드로 거르지 않는다', async () => {
    const seen: URL[] = [];
    const fetch = createStubFetch([
      capturing('/logistics/putaway-tasks', { items: [], page }, seen),
    ]);

    const { result } = renderHookWithProviders(() => usePutawayTasks(77), { fetch });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(seen[0]?.searchParams.get('assignedWorkerId')).toBe('77');
    expect(seen[0]?.searchParams.get('statusCode')).toBeNull();
  });

  it('작업자를 확인하기 전에는 묻지 않는다', () => {
    const fetch = createStubFetch([]);

    const { result } = renderHookWithProviders(() => usePutawayTasks(null), { fetch });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
