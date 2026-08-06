import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../../test/api-harness';
import { useCodeValueList, toCodeValueListQuery } from './code-value-queries';
import { codeValueFixtures } from './fixtures';

const listRoute = {
  match: (request: Request) =>
    request.method === 'GET' && new URL(request.url).pathname === '/mdm/code-values',
  respond: () => jsonResponse({ items: codeValueFixtures, page: { page: 1, size: 50, total: 3 } }),
};

describe('toCodeValueListQuery', () => {
  it('그룹 번호는 언제나 싣는다 — 계약이 필수 쿼리로 두었다', () => {
    expect(toCodeValueListQuery(1001, false, 1)).toEqual({ codeGroupId: 1001 });
  });

  /* 계약의 기본값이 false다 — 끈 상태를 값으로 실어 보내면 캐시 키가 갈린다. */
  it('꺼진 확인칸과 첫 쪽은 싣지 않는다', () => {
    const query = toCodeValueListQuery(1001, false, 1);

    expect('includeInactive' in query).toBe(false);
    expect('page' in query).toBe(false);
  });

  it('켜진 조건과 두 번째 이후 쪽만 싣는다', () => {
    expect(toCodeValueListQuery(1001, true, 3)).toEqual({
      codeGroupId: 1001,
      includeInactive: true,
      page: 3,
    });
  });
});

describe('useCodeValueList', () => {
  /*
   * C23 — **조회를 시작조차 하지 않는다.** 계약이 그룹 번호를 필수 쿼리로 두어
   * 빼고 부르면 거부된다.
   *
   * 「요청이 나가지 않았다」만 보면 안쪽 방어(던지기)가 켜져 있는 동안 통과해 버린다 —
   * 그 상태는 조회가 조용히 실패로 앉아 있는 상태이고, 나중에 안쪽 방어를 걷어내면
   * 그대로 요청이 새어 나간다. 그래서 **가져오기 상태가 멈춤(idle)인지**를 직접 본다.
   */
  it('코드그룹을 고르기 전에는 조회를 시작하지 않는다', () => {
    const { result } = renderHookWithProviders(() => useCodeValueList(null, false, 1), {
      fetch: createStubFetch([listRoute]),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.isError).toBe(false);
  });

  it('코드그룹을 고르면 조회가 시작되고 목록이 온다', async () => {
    const { result } = renderHookWithProviders(() => useCodeValueList(1001, false, 1), {
      fetch: createStubFetch([listRoute]),
    });

    await waitFor(() => {
      expect(result.current.data?.items).toHaveLength(3);
    });
  });
});
