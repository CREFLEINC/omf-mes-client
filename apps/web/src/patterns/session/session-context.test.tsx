import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { SessionProvider, useSession, type Session } from './session-context';

/** 합성값이다 — 계약의 예시값(`1001`·`hong.gd`·`홍길동`)을 쓰지 않는다(공개 저장소 경계). */
const sessionFixture = (overrides: Partial<Session> = {}): Session => ({
  userId: 8101,
  loginId: 'SYN-LOGIN-01',
  userName: '합성 사용자 가',
  departmentId: 8201,
  scopes: [{ businessUnitId: 8301, plantId: 8401 }],
  ...overrides,
});

/** 보관된 값을 그대로 보인다 — 무엇이 담겼는지 판정할 유일한 근거다. */
const SessionProbe = () => {
  const { session } = useSession();

  return (
    <output data-testid="session">{session === null ? '없음' : JSON.stringify(session)}</output>
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

const storedSession = (): Session | null => {
  const text = screen.getByTestId('session').textContent ?? '';

  return text === '없음' ? null : (JSON.parse(text) as Session);
};

const renderSession = () => {
  const user = userEvent.setup();
  const session = sessionFixture();

  render(
    <SessionProvider>
      <SignInProbe session={session} />
      <SessionProbe />
    </SessionProvider>,
  );

  return { user, session };
};

describe('useSession', () => {
  it('프로바이더 안에서는 처음에 세션이 없다', () => {
    renderSession();

    expect(storedSession()).toBeNull();
  });

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

describe('SessionProvider', () => {
  it('담은 세션을 그대로 돌려준다', async () => {
    const { user, session } = renderSession();

    await user.click(screen.getByRole('button', { name: '세션 담기' }));

    expect(storedSession()).toEqual(session);
  });

  /**
   * ⭐ **값을 깎지 않는다.** 지금 화면에 그리는 것은 이름 하나뿐이지만, 뒤따르는 화면들이
   * 권한 범위를 읽는다 — 여기서 필요한 것만 골라 담으면 그 화면들이 다시 로그인을 시켜야 한다.
   */
  it('권한 범위를 그대로 안고 있다', async () => {
    const { user, session } = renderSession();

    await user.click(screen.getByRole('button', { name: '세션 담기' }));

    expect(storedSession()?.scopes).toEqual(session.scopes);
  });

  /**
   * ⭐ **권한 범위의 축은 사업부·공장 둘뿐이다** — 법인 축을 두지 않는다.
   * 축이 늘면 이 시험이 먼저 깨져, 계약이 바뀐 사실을 화면보다 앞서 알린다.
   */
  it('권한 범위에 사업부·공장 말고 다른 축이 없다', async () => {
    const { user } = renderSession();

    await user.click(screen.getByRole('button', { name: '세션 담기' }));

    const scopes = storedSession()?.scopes ?? [];

    expect(scopes.length).toBeGreaterThan(0);

    for (const scope of scopes) {
      expect(Object.keys(scope).sort()).toEqual(['businessUnitId', 'plantId']);
      expect(scope).not.toHaveProperty('corporationId');
      expect(scope).not.toHaveProperty('legalEntityId');
    }
  });

  it('나중에 담은 세션이 앞엣것을 대신한다', async () => {
    const { user } = renderSession();

    await user.click(screen.getByRole('button', { name: '세션 담기' }));

    expect(storedSession()?.loginId).toBe('SYN-LOGIN-01');

    render(
      <SessionProvider>
        <SignInProbe session={sessionFixture({ loginId: 'SYN-LOGIN-02', userId: 8102 })} />
        <SessionProbe />
      </SessionProvider>,
    );

    const [, second] = screen.getAllByRole('button', { name: '세션 담기' });

    if (second === undefined) throw new Error('두 번째 프로바이더를 찾지 못했습니다');

    await user.click(second);

    const [, secondOutput] = screen.getAllByTestId('session');

    expect(JSON.parse(secondOutput?.textContent ?? '{}')).toMatchObject({
      loginId: 'SYN-LOGIN-02',
    });
  });
});
