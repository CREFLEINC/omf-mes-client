import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createStubFetch, renderWithProviders, type StubRoute } from '../../test/api-harness';
import { withoutRandomUuid } from '../../test/insecure-context';
import { SYNTHETIC_SESSION, signOutRoute } from '../../test/session-harness';

import { SessionProvider, useSession } from './session-context';
import { useSignOut } from './use-sign-out';

const t = messages.session;

/** 로그아웃 단추와 판정을 한 자리에 세운다 — 누른 뒤 무엇이 되었는지가 재는 대상이다. */
const SignOutProbe = () => {
  const { status } = useSession();
  const { signOut, isSigningOut } = useSignOut();

  return (
    <>
      <output data-testid="status">{status}</output>
      <button type="button" onClick={signOut} disabled={isSigningOut}>
        {t.actions.signOut}
      </button>
    </>
  );
};

const status = (): string => screen.getByTestId('status').textContent ?? '';
const signOutButton = (): HTMLElement => screen.getByRole('button', { name: t.actions.signOut });

const renderSignOut = (routes: StubRoute[]) => {
  const user = userEvent.setup();
  const result = renderWithProviders(
    <SessionProvider>
      <SignOutProbe />
    </SessionProvider>,
    { session: SYNTHETIC_SESSION, fetch: createStubFetch(routes) },
  );

  return { user, ...result };
};

describe('useSignOut — 서버 세션을 끊는다', () => {
  it('성공하면 미인증으로 돌아간다', async () => {
    const { user } = renderSignOut([signOutRoute()]);

    expect(status()).toBe('authenticated');

    await user.click(signOutButton());

    await waitFor(() => {
      expect(status()).toBe('anonymous');
    });
  });

  /** 계약이 쓰기 API 전부에 이 헤더를 필수로 두었다 — 없으면 서버가 400으로 되돌린다. */
  it('멱등 키를 실어 보낸다', async () => {
    const sent: Request[] = [];
    const { user } = renderSignOut([
      {
        match: (request) => request.method === 'DELETE',
        respond: (request) => {
          sent.push(request);

          return new Response(null, { status: 204 });
        },
      },
    ]);

    await user.click(signOutButton());

    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]?.headers.get('Idempotency-Key')).toMatch(/[0-9a-f-]{36}/);
  });

  /**
   * ⭐ **다른 조회의 캐시를 함께 버린다.** 사무실에서 여럿이 번갈아 쓰는 화면이라, 남겨 두면
   * 다음 사람이 로그인한 직후 앞사람이 보던 목록이 잠깐 그려진다.
   */
  it('다른 조회의 캐시를 버린다', async () => {
    const { user, queryClient } = renderSignOut([signOutRoute()]);

    queryClient.setQueryData(['probe', 'items'], ['앞사람이 보던 목록']);

    await user.click(signOutButton());

    await waitFor(() => {
      expect(status()).toBe('anonymous');
    });
    expect(queryClient.getQueryData(['probe', 'items'])).toBeUndefined();
  });

  /**
   * ⛔ **실패했는데 로그아웃한 척하지 않는다.** 자격은 서버가 내린 쿠키에 있으므로, 화면만
   * 비우면 **쿠키는 살아 있고** 다음 사람이 브라우저를 열었을 때 그대로 로그인돼 있다.
   */
  it('실패하면 로그인 상태를 유지하고 실패를 말한다', async () => {
    const { user } = renderSignOut([signOutRoute(500)]);

    await user.click(signOutButton());

    expect(await screen.findByText(t.signOutFailure.title)).toBeVisible();
    expect(screen.getByText(t.signOutFailure.body)).toBeVisible();
    expect(status()).toBe('authenticated');
  });

  it('실패해도 다른 조회의 캐시를 버리지 않는다', async () => {
    const { user, queryClient } = renderSignOut([signOutRoute(500)]);

    queryClient.setQueryData(['probe', 'items'], ['아직 이 사람 것이다']);

    await user.click(signOutButton());

    await screen.findByText(t.signOutFailure.title);

    expect(queryClient.getQueryData(['probe', 'items'])).toEqual(['아직 이 사람 것이다']);
  });

  /** 연타가 그대로 요청 두 벌이 된다 — 시도마다 새 멱등 키라 서버에는 서로 다른 요청이다. */
  it('나가는 중에는 다시 누르지 못한다', async () => {
    const sent: Request[] = [];
    let release: (() => void) | undefined;
    const { user } = renderSignOut([
      {
        match: (request) => request.method === 'DELETE',
        respond: (request) => {
          sent.push(request);

          return new Promise<Response>((resolve) => {
            release = () => {
              resolve(new Response(null, { status: 204 }));
            };
          });
        },
      },
    ]);

    await user.click(signOutButton());

    await waitFor(() => {
      expect(signOutButton()).toBeDisabled();
    });
    expect(sent).toHaveLength(1);

    release?.();
  });
});

/**
 * ⭐ **평문 HTTP 배포본에서도 나간다**(#1066). 그곳에는 `crypto.randomUUID` 가 없어, 멱등 키를
 * 그것으로 만들면 누르는 자리에서 던지고 **요청도 실패 알림도 없이** 로그인된 채 남는다.
 */
describe('useSignOut — 평문 HTTP 배포본', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('crypto.randomUUID가 없어도 요청이 나가고 미인증으로 돌아간다', async () => {
    withoutRandomUuid();

    const sent: Request[] = [];
    const { user } = renderSignOut([
      {
        match: (request) => request.method === 'DELETE',
        respond: (request) => {
          sent.push(request);

          return new Response(null, { status: 204 });
        },
      },
    ]);

    await user.click(signOutButton());

    await waitFor(() => {
      expect(status()).toBe('anonymous');
    });
    expect(sent[0]?.headers.get('Idempotency-Key')).toMatch(/[0-9a-f-]{36}/);
  });
});
