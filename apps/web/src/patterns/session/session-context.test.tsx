import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQuery } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import {
  SYNTHETIC_SESSION,
  sessionUnavailableRoute,
  signedInRoute,
  signedOutRoute,
  withSessionStub,
} from '../../test/session-harness';
import { useApiClient } from '../api-context';
import { runRequest } from '../request';

import { SessionProvider, useSession, type Session } from './session-context';

/** 합성값이다 — 계약의 예시값(`1001`·`hong.gd`·`홍길동`)을 쓰지 않는다(공개 저장소 경계). */
const sessionFixture = (overrides: Partial<Session> = {}): Session => ({
  ...SYNTHETIC_SESSION,
  departmentId: 8201,
  ...overrides,
});

/** 보관된 값과 판정을 그대로 보인다 — 무엇이 담겼는지 판정할 유일한 근거다. */
const SessionProbe = () => {
  const { status, session } = useSession();

  return (
    <>
      <output data-testid="status">{status}</output>
      <output data-testid="session">{session === null ? '없음' : JSON.stringify(session)}</output>
    </>
  );
};

/** 화면이 성공했을 때 하는 일을 흉내 낸다. 자동으로 돌지 않고 눌러서 돈다 — 시점을 시험이 정한다. */
const SignInProbe = ({ session }: { session: Session }) => {
  const { signIn } = useSession();

  return (
    <button
      type="button"
      onClick={() => {
        signIn(session);
      }}
    >
      세션 담기
    </button>
  );
};

const SignOutProbe = () => {
  const { signOut } = useSession();

  return (
    <button type="button" onClick={signOut}>
      세션 비우기
    </button>
  );
};

const RetryProbe = () => {
  const { retryRestore } = useSession();

  return (
    <button type="button" onClick={retryRestore}>
      다시 물어보기
    </button>
  );
};

/**
 * 업무 화면이 거는 조회 하나. **세션 조회가 아니다** — 만료가 업무 조회의 401로 먼저
 * 도착하는 실제 순서를 그대로 밟는다.
 */
const BusinessQueryProbe = () => {
  const { client } = useApiClient();

  useQuery({
    queryKey: ['probe', 'items'],
    queryFn: () => runRequest(() => client.GET('/mdm/items', { params: { query: {} } })),
  });

  return null;
};

const status = (): string => screen.getByTestId('status').textContent ?? '';

const storedSession = (): Session | null => {
  const text = screen.getByTestId('session').textContent ?? '';

  return text === '없음' ? null : (JSON.parse(text) as Session);
};

describe('SessionProvider — 로그인 상태를 서버에 물어본다', () => {
  it('물어보는 동안에는 판정하지 않는다', () => {
    renderWithProviders(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
      { fetch: withSessionStub(signedInRoute()) },
    );

    expect(status()).toBe('restoring');
    expect(storedSession()).toBeNull();
  });

  /**
   * ⭐ **새로고침해도 로그인이 유지되는 갈래다.** 자격은 서버가 내린 세션 쿠키에 있어 스크립트가
   * 읽을 수 없다 — 물어봐야만 알고, 물어보면 알 수 있다.
   */
  it('서버가 세션을 주면 로그인된 것으로 판정한다', async () => {
    renderWithProviders(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
      { fetch: withSessionStub(signedInRoute(sessionFixture())) },
    );

    await waitFor(() => {
      expect(status()).toBe('authenticated');
    });
    expect(storedSession()).toEqual(sessionFixture());
  });

  /** ⭐ **401은 실패가 아니라 답이다** — 「다시 시도」가 서면 첫 방문자가 그것부터 본다. */
  it('401이면 로그인하지 않은 것으로 판정한다', async () => {
    renderWithProviders(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
      { fetch: withSessionStub(signedOutRoute()) },
    );

    await waitFor(() => {
      expect(status()).toBe('anonymous');
    });
    expect(storedSession()).toBeNull();
  });

  /**
   * ⛔ **조회 실패를 미인증으로 접지 않는다.** 접으면 서버가 잠깐 흔들릴 때 **작업 중인 사람이
   * 로그인 화면으로 쫓겨난다** — 그 사람의 자격에는 아무 문제가 없었다.
   */
  it('조회가 실패하면 「모른다」로 두고 미인증과 가른다', async () => {
    renderWithProviders(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
      { fetch: withSessionStub(sessionUnavailableRoute()) },
    );

    await waitFor(() => {
      expect(status()).toBe('unknown');
    });
    expect(status()).not.toBe('anonymous');
  });

  it('「모른다」에서 다시 물어보면 판정이 선다', async () => {
    const user = userEvent.setup();
    let answered = false;

    renderWithProviders(
      <SessionProvider>
        <SessionProbe />
        <RetryProbe />
      </SessionProvider>,
      {
        fetch: withSessionStub({
          match: (request) => new URL(request.url).pathname.endsWith('/app/sessions/current'),
          respond: () => {
            const route = answered ? signedInRoute(sessionFixture()) : sessionUnavailableRoute();
            answered = true;

            return route.respond(new Request('http://api.test/app/sessions/current'));
          },
        }),
      },
    );

    await waitFor(() => {
      expect(status()).toBe('unknown');
    });

    await user.click(screen.getByRole('button', { name: '다시 물어보기' }));

    await waitFor(() => {
      expect(status()).toBe('authenticated');
    });
  });
});

describe('SessionProvider — 담고 비운다', () => {
  const renderSeeded = () => {
    const user = userEvent.setup();

    renderWithProviders(
      <SessionProvider>
        <SignInProbe session={sessionFixture()} />
        <SignOutProbe />
        <SessionProbe />
      </SessionProvider>,
      { session: null },
    );

    return { user };
  };

  it('담은 세션을 그대로 돌려준다', async () => {
    const { user } = renderSeeded();

    await user.click(screen.getByRole('button', { name: '세션 담기' }));

    expect(status()).toBe('authenticated');
    expect(storedSession()).toEqual(sessionFixture());
  });

  /**
   * ⭐ **값을 깎지 않는다.** 지금 화면에 그리는 것은 이름 하나뿐이지만, 뒤따르는 화면들이
   * 권한 범위를 읽는다 — 여기서 필요한 것만 골라 담으면 그 화면들이 다시 로그인을 시켜야 한다.
   */
  it('권한 범위를 그대로 안고 있다', async () => {
    const { user } = renderSeeded();

    await user.click(screen.getByRole('button', { name: '세션 담기' }));

    expect(storedSession()?.scopes).toEqual(sessionFixture().scopes);
  });

  /**
   * ⭐ **권한 범위의 축은 사업부·공장 둘뿐이다** — 법인 축을 두지 않는다.
   * 축이 늘면 이 시험이 먼저 깨져, 계약이 바뀐 사실을 화면보다 앞서 알린다.
   */
  it('권한 범위에 사업부·공장 말고 다른 축이 없다', async () => {
    const { user } = renderSeeded();

    await user.click(screen.getByRole('button', { name: '세션 담기' }));

    const scopes = storedSession()?.scopes ?? [];

    expect(scopes.length).toBeGreaterThan(0);

    for (const scope of scopes) {
      expect(Object.keys(scope).sort()).toEqual(['businessUnitId', 'plantId']);
      expect(scope).not.toHaveProperty('corporationId');
      expect(scope).not.toHaveProperty('legalEntityId');
    }
  });

  it('비우면 미인증으로 돌아간다', async () => {
    const { user } = renderSeeded();

    await user.click(screen.getByRole('button', { name: '세션 담기' }));
    expect(status()).toBe('authenticated');

    await user.click(screen.getByRole('button', { name: '세션 비우기' }));

    expect(status()).toBe('anonymous');
    expect(storedSession()).toBeNull();
  });
});

/**
 * **세션이 끊겼다는 답을 어디서 받든 판정에 반영한다.**
 *
 * 만료는 세션 조회가 아니라 **업무 조회의 401**로 먼저 도착한다. 흘려보내면 화면마다
 * 「불러오지 못했습니다」 배너만 서고, 사람은 원인을 모른 채 새로고침을 되풀이한다.
 */
describe('SessionProvider — 만료를 업무 조회에서 알아챈다', () => {
  it('다른 조회가 401을 받으면 미인증으로 돌아간다', async () => {
    renderWithProviders(
      <SessionProvider>
        <BusinessQueryProbe />
        <SessionProbe />
      </SessionProvider>,
      {
        session: sessionFixture(),
        fetch: withSessionStub({
          match: (request) => new URL(request.url).pathname.endsWith('/mdm/items'),
          respond: () =>
            new Response(JSON.stringify({ code: 'UNAUTHENTICATED' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            }),
        }),
      },
    );

    expect(status()).toBe('authenticated');

    await waitFor(() => {
      expect(status()).toBe('anonymous');
    });
  });

  /** ⛔ **401이 아닌 실패로는 내쫓지 않는다** — 조회 하나가 흔들렸다고 세션이 끊긴 것이 아니다. */
  it('다른 조회가 500을 받아도 로그인 상태를 유지한다', async () => {
    renderWithProviders(
      <SessionProvider>
        <BusinessQueryProbe />
        <SessionProbe />
      </SessionProvider>,
      {
        session: sessionFixture(),
        fetch: withSessionStub({
          match: (request) => new URL(request.url).pathname.endsWith('/mdm/items'),
          respond: () =>
            new Response(JSON.stringify({ code: 'SERVER_ERROR' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }),
        }),
      },
    );

    await waitFor(() => {
      expect(screen.getByTestId('status')).toBeInTheDocument();
    });

    expect(status()).toBe('authenticated');
  });
});

describe('useSession', () => {
  /**
   * ⛔ **조용히 빈 세션으로 돌지 않는다**(전례 `patterns/api-context.tsx`와 같은 규율).
   *
   * 기본값을 돌려주면 프로바이더를 잊은 화면이 **로그인하지 않은 상태로 정상 동작하는 것처럼**
   * 보이고, 그 어긋남은 세션을 실제로 읽는 자리에 가서야 드러난다.
   */
  it('프로바이더 밖에서 부르면 오류를 던진다', () => {
    expect(() => render(<SessionProbe />)).toThrow(/SessionProvider/);
  });
});
