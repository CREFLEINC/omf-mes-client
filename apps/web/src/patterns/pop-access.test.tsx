import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderHookWithProviders } from '../test/api-harness';
import { useAccessiblePopScreens } from './pop-access';

const sessionRoute = (body: unknown, init: ResponseInit = {}) => ({
  match: (request: Request) => request.url.endsWith('/app/sessions/current'),
  respond: () => jsonResponse(body, init),
});

const SESSION = {
  userId: 1001,
  loginId: 'pop.terminal',
  userName: '조립 1라인 단말',
  scopes: [{ businessUnitId: 1001 }],
};

const renderAccess = (route: ReturnType<typeof sessionRoute>) =>
  renderHookWithProviders(() => useAccessiblePopScreens(), {
    fetch: createStubFetch([route]),
  });

describe('useAccessiblePopScreens — [화면 이동] 후보', () => {
  it('세션 권한에 있는 화면만 후보로 남긴다', async () => {
    const { result } = renderAccess(
      sessionRoute({ ...SESSION, permissions: ['P-02-01', 'P-05-02', 'W-01-03'] }),
    );

    await waitFor(() => {
      expect(result.current.state).toBe('ready');
    });
    expect(result.current.screens.map((screen) => screen.code)).toEqual(['P-02-01', 'P-05-02']);
  });

  /*
   * 계약이 갈라 놓은 두 경우다 — 필드가 «없으면» 「모른다」이고 «빈 배열»은 「아무 권한도
   * 없다」다. 같게 다루면 목록을 못 받은 단말이 「권한 없음」으로 보여 원인이 가려진다.
   */
  it('권한 필드가 없으면 판정하지 않고 사유를 남긴다', async () => {
    const { result } = renderAccess(sessionRoute(SESSION));

    await waitFor(() => {
      expect(result.current.state).toBe('unknown');
    });
    expect(result.current.screens).toEqual([]);
  });

  it('권한이 빈 배열이면 갈 수 있는 화면이 없다고 판정한다', async () => {
    const { result } = renderAccess(sessionRoute({ ...SESSION, permissions: [] }));

    await waitFor(() => {
      expect(result.current.state).toBe('empty');
    });
    expect(result.current.screens).toEqual([]);
  });

  /* 조회가 실패했는데 「권한 없음」으로 보이면 작업자가 관리자를 부른다 — 갈라 둔다. */
  it('세션 조회가 실패하면 「모른다」로 둔다', async () => {
    const { result } = renderAccess(sessionRoute({ message: '없음' }, { status: 500 }));

    await waitFor(() => {
      expect(result.current.state).toBe('unknown');
    });
  });

  /* POP 화면이 아닌 권한만 가진 단말은 「권한 없음」이다 — 「모른다」가 아니다. */
  it('관리웹 권한만 가지면 후보가 비고 권한 없음으로 판정한다', async () => {
    const { result } = renderAccess(
      sessionRoute({ ...SESSION, permissions: ['W-01-03', 'W-06-05'] }),
    );

    await waitFor(() => {
      expect(result.current.state).toBe('empty');
    });
  });
});
