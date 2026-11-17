import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { PopIdentityProvider, UNKNOWN_POP_IDENTITY } from '../../patterns/pop-identity';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { PopHomeScreen } from './screen';

const t = messages.popChrome.home;

const SESSION = {
  userId: 1001,
  loginId: 'pop.terminal',
  userName: '합성 단말',
  scopes: [{ businessUnitId: 1001 }],
  permissions: ['P-02-01', 'P-02-04', 'P-04-01', 'P-05-02'],
};

const Here = () => {
  const { pathname } = useLocation();
  return <p>지금: {pathname}</p>;
};

const setup = (counts: Record<string, number>) =>
  renderWithProviders(
    <PopIdentityProvider value={{ ...UNKNOWN_POP_IDENTITY, workerNo: '2048' }}>
      <PopHomeScreen />
      <Here />
    </PopIdentityProvider>,
    {
      fetch: createStubFetch([
        {
          match: (request) => request.url.endsWith('/app/sessions/current'),
          respond: () => jsonResponse(SESSION),
        },
        {
          match: (request) => new URL(request.url).pathname === '/app/terminal-work-counts',
          respond: () =>
            jsonResponse({
              shipmentPacking: 0,
              workStart: 0,
              emergencyWorkOrder: 0,
              reworkResult: 0,
              oqcInspection: 0,
              ...counts,
            }),
        },
      ]),
      route: '/pop/home',
    },
  );

describe('PopHomeScreen — 홈(#291)', () => {
  it('인사, 남은 작업, 이 단말이 갈 수 있는 바로가기만 보인다', async () => {
    setup({ shipmentPacking: 4, workStart: 3 });

    expect(screen.getByRole('heading', { name: t.greeting('2048') })).toBeInTheDocument();
    const remaining = await within(
      screen.getByRole('region', { name: new RegExp(`^${t.remainingTitle}`, 'u') }),
    ).findByRole('button', { name: messages.popChrome.remaining.count('출하 포장', 4) });
    expect(remaining).toHaveTextContent(t.remainingCount(4));

    const shortcuts = within(screen.getByRole('region', { name: t.shortcutsTitle }));
    expect(
      shortcuts
        .getAllByRole('button')
        .map((tile) => tile.querySelector('span:last-child')?.textContent),
    ).toEqual(['생산 작업', '작업 지시 목록', '출하 포장']);
  });

  it('남은 작업·바로가기를 누르면 그 화면으로 간다', async () => {
    const user = userEvent.setup();
    setup({ workStart: 3 });

    await user.click(
      await within(
        screen.getByRole('region', { name: new RegExp(`^${t.remainingTitle}`, 'u') }),
      ).findByRole('button', { name: messages.popChrome.remaining.count('작업 지시 목록', 3) }),
    );
    expect(screen.getByText('지금: /pop/work-start')).toBeInTheDocument();
  });

  it('사번을 모르면 사번 입력 화면으로 보낸다', async () => {
    renderWithProviders(
      <PopIdentityProvider value={UNKNOWN_POP_IDENTITY}>
        <PopHomeScreen />
        <Here />
      </PopIdentityProvider>,
      { fetch: createStubFetch([]), route: '/pop/home' },
    );

    expect(await screen.findByText('지금: /pop/worker-assignment')).toBeInTheDocument();
  });

  it('남은 작업이 없으면 그렇게 말한다', async () => {
    setup({});

    await waitFor(() => {
      expect(screen.getByRole('region', { name: t.shortcutsTitle })).toBeInTheDocument();
    });
    expect(screen.getByText(t.remainingNone)).toBeInTheDocument();
  });
});
