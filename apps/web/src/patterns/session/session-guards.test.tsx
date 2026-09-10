import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Route, Routes, useLocation } from 'react-router';

import { renderWithProviders } from '../../test/api-harness';
import {
  SYNTHETIC_SESSION,
  sessionUnavailableRoute,
  signedInRoute,
  signedOutRoute,
  withSessionStub,
} from '../../test/session-harness';

import { readReturnPath } from './return-path';
import { SessionProvider } from './session-context';
import { GuestOnly, RequireSession } from './session-guards';

const t = messages.session;

const PROTECTED_ROUTE = '/master-data/warehouse-location';
const LOGIN_ROUTE = '/login';

/**
 * 주소와 **들려 온 값**을 함께 보인다. 「어디로 갔는가」만 재면 막힌 주소를 잃어버린 결함이
 * 그대로 통과한다 — 그 값은 로그인 뒤에야 쓰이기 때문이다.
 */
const LocationProbe = () => {
  const location = useLocation();

  return (
    <>
      <output data-testid="location">{`${location.pathname}${location.search}`}</output>
      <output data-testid="from">{readReturnPath(location.state) ?? '없음'}</output>
    </>
  );
};

const currentPath = (): string => screen.getByTestId('location').textContent ?? '';
const carriedFrom = (): string => screen.getByTestId('from').textContent ?? '';

/** 가드가 지키는 화면과 로그인 화면을 한 표에 세운다 — 두 화면 사이의 이동이 재는 대상이다. */
const renderGuardedApp = (
  route: string,
  fetch: ReturnType<typeof withSessionStub> | undefined,
  session?: Parameters<typeof renderWithProviders>[1] extends undefined ? never : null,
) =>
  renderWithProviders(
    <SessionProvider>
      <Routes>
        <Route
          path={PROTECTED_ROUTE}
          element={
            <RequireSession>
              <h1>창고·Location</h1>
            </RequireSession>
          }
        />
        <Route
          path={LOGIN_ROUTE}
          element={
            <GuestOnly>
              <h1>로그인</h1>
            </GuestOnly>
          }
        />
      </Routes>
      <LocationProbe />
    </SessionProvider>,
    { route, fetch, session },
  );

describe('RequireSession — 로그인한 사람만 지나간다', () => {
  it('로그인했으면 화면을 그대로 세운다', async () => {
    renderGuardedApp(PROTECTED_ROUTE, withSessionStub(signedInRoute()));

    expect(await screen.findByRole('heading', { name: '창고·Location' })).toBeVisible();
    expect(currentPath()).toBe(PROTECTED_ROUTE);
  });

  /**
   * ⛔ **판정 전에 화면을 미리 그리지 않는다.** 먼저 그려 두면 막으려던 사람에게 화면이 한 번
   * 번쩍이고 사라진다 — 가리려던 것을 보여 준 뒤에 가리는 셈이다.
   */
  it('판정을 기다리는 동안에는 화면을 그리지 않는다', () => {
    renderGuardedApp(PROTECTED_ROUTE, withSessionStub(signedInRoute()));

    expect(screen.queryByRole('heading', { name: '창고·Location' })).toBeNull();
    /* 탐침의 `<output>`도 status 역할이라 역할로 찾지 않는다 — 문구로 집고 역할을 확인한다. */
    const notice = screen.getByText(t.restoring);

    expect(notice).toBeVisible();
    expect(notice).toHaveAttribute('role', 'status');
  });

  it('로그인하지 않았으면 로그인 화면으로 보낸다', async () => {
    renderGuardedApp(PROTECTED_ROUTE, withSessionStub(signedOutRoute()));

    await waitFor(() => {
      expect(currentPath()).toBe(LOGIN_ROUTE);
    });
    expect(screen.queryByRole('heading', { name: '창고·Location' })).toBeNull();
  });

  /** ⭐ **막힌 주소를 들려 보낸다** — 로그인한 뒤 원래 가려던 자리로 돌아가야 한다. */
  it('막힌 주소를 로그인 화면에 들려 보낸다', async () => {
    renderGuardedApp(PROTECTED_ROUTE, withSessionStub(signedOutRoute()));

    await waitFor(() => {
      expect(currentPath()).toBe(LOGIN_ROUTE);
    });
    expect(carriedFrom()).toBe(PROTECTED_ROUTE);
  });

  /**
   * ⛔ **조회 실패로 내쫓지 않는다.** 서버가 잠깐 흔들렸을 뿐인데 로그인 화면으로 보내면,
   * 작업 중이던 사람이 자기 자격을 의심하며 다시 로그인한다.
   */
  it('판정하지 못했으면 사유를 보이고 로그인 화면으로 보내지 않는다', async () => {
    renderGuardedApp(PROTECTED_ROUTE, withSessionStub(sessionUnavailableRoute()));

    expect(await screen.findByText(t.unknown.title)).toBeVisible();
    expect(currentPath()).toBe(PROTECTED_ROUTE);
    expect(screen.getByRole('button', { name: t.unknown.retry })).toBeEnabled();
  });

  it('「다시 시도」를 누르면 다시 물어보고 화면이 선다', async () => {
    const user = userEvent.setup();
    let answered = false;

    renderGuardedApp(
      PROTECTED_ROUTE,
      withSessionStub({
        match: (request) => new URL(request.url).pathname.endsWith('/app/sessions/current'),
        respond: (request) =>
          (answered ? signedInRoute() : sessionUnavailableRoute()).respond(request),
      }),
    );

    expect(await screen.findByText(t.unknown.title)).toBeVisible();

    answered = true;
    await user.click(screen.getByRole('button', { name: t.unknown.retry }));

    expect(await screen.findByRole('heading', { name: '창고·Location' })).toBeVisible();
  });
});

describe('GuestOnly — 로그인한 사람은 로그인 화면을 보지 않는다', () => {
  it('로그인하지 않았으면 로그인 화면을 세운다', async () => {
    renderGuardedApp(LOGIN_ROUTE, withSessionStub(signedOutRoute()));

    expect(await screen.findByRole('heading', { name: '로그인' })).toBeVisible();
    expect(currentPath()).toBe(LOGIN_ROUTE);
  });

  /** 보이면 자기가 로그인된 줄 모르고 자격을 한 번 더 친다. */
  it('이미 로그인했으면 앱 안으로 돌려보낸다', async () => {
    renderGuardedApp(LOGIN_ROUTE, withSessionStub(signedInRoute(SYNTHETIC_SESSION)));

    await waitFor(() => {
      expect(currentPath()).not.toBe(LOGIN_ROUTE);
    });
    expect(screen.queryByRole('heading', { name: '로그인' })).toBeNull();
  });

  /**
   * ⭐ **판정을 못 했어도 로그인은 열어 둔다.** 막으면 세션이 만료된 사람이 들어올 길이
   * 사라진다 — 그 사람에게 지금 필요한 것이 바로 이 화면이다.
   */
  it('판정하지 못했어도 로그인 화면은 연다', async () => {
    renderGuardedApp(LOGIN_ROUTE, withSessionStub(sessionUnavailableRoute()));

    expect(await screen.findByRole('heading', { name: '로그인' })).toBeVisible();
  });
});
