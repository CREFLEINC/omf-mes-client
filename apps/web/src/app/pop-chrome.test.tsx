import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { PopChrome } from './pop-chrome';
import { PopRegistrationProvider } from '../patterns/pop-registration';
import { setWorkerSession } from '../patterns/worker-session';
import { createStubFetch, jsonResponse, renderWithProviders } from '../test/api-harness';

/*
 * POP 셸 연결을 그려서 잰다(PR #1731 리뷰 · #334) — 맨 위 줄 칩 → 사번 입력 창 → 확인하면 닫히고 풀림,
 * [전환] → 홈 + 창, 사번 없이 다른 화면 → 홈.
 */
const header = messages.popChrome.header;
const input = messages.workerAssignment.input;

const SESSION = {
  userId: 1001,
  loginId: 'pop.terminal',
  userName: '합성 단말',
  scopes: [{ businessUnitId: 1001 }],
  permissions: ['P-02-01', 'P-04-07'],
};

const WORKER = {
  workerId: 1001,
  workerNo: '900028',
  workerName: '김작업',
  businessUnitId: 1,
  plantId: 10,
  statusCode: 'ACTIVE',
  isActive: true,
};

const Here = () => <output aria-label="현재 경로">{useLocation().pathname}</output>;

const renderChrome = (route: string) =>
  renderWithProviders(
    <PopRegistrationProvider>
      <Routes>
        <Route element={<PopChrome />}>
          <Route path="/pop/home" element={<p>홈 화면</p>} />
          <Route path="/pop/work-start" element={<p>생산 작업 화면</p>} />
        </Route>
      </Routes>
      <Here />
    </PopRegistrationProvider>,
    {
      route,
      fetch: createStubFetch([
        {
          match: (request) => request.url.endsWith('/app/sessions/current'),
          respond: () => jsonResponse(SESSION),
        },
        {
          match: (request) => new URL(request.url).pathname === '/app/terminal-work-counts',
          respond: () => jsonResponse({}),
        },
        {
          match: (request) => new URL(request.url).pathname === '/mdm/workers',
          respond: () => jsonResponse({ items: [WORKER], page: { page: 1, size: 2, total: 1 } }),
        },
      ]),
    },
  );

const path = () => screen.getByRole('status', { name: '현재 경로' });
const loginChip = () =>
  screen.getByRole('button', {
    name: `${messages.popChrome.login}: ${header.workerUnset}`,
  });

const typeAndConfirm = async (user: ReturnType<typeof userEvent.setup>, digits: string) => {
  const keypad = screen.getByRole('group', { name: messages.popUniform.keypad.region });
  for (const digit of digits) await user.click(within(keypad).getByRole('button', { name: digit }));
  await user.click(screen.getByRole('button', { name: input.submit }));
};

afterEach(() => {
  setWorkerSession(null);
});

describe('PopChrome — 맨 위 줄 로그인 · 사번 없을 때', () => {
  it('사번 없이 다른 화면 주소로 들어오면 홈으로 보낸다', async () => {
    renderChrome('/pop/work-start');

    await waitFor(() => expect(path()).toHaveTextContent('/pop/home'));
    expect(screen.getByText('홈 화면')).toBeInTheDocument();
    expect(screen.queryByText('생산 작업 화면')).toBeNull();
  });

  it('칩을 누르면 사번 입력 창이 열리고, 확인하면 닫히며 작업자로 풀린다', async () => {
    const user = userEvent.setup();
    renderChrome('/pop/home');

    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(loginChip());
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await typeAndConfirm(user, '900028');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(
      screen.getByRole('button', {
        name: `${messages.popChrome.userSwitch}: ${header.workerLabel('900028', '김작업')}`,
      }),
    ).toBeInTheDocument();
  });

  it('[전환]을 누르면 사번을 지우고 홈으로 가며 사번 입력 창을 연다', async () => {
    const user = userEvent.setup();
    setWorkerSession({
      worker: WORKER,
      assignedAt: '2026-11-20T00:00:00.000Z',
      isOtherPlant: false,
    } as Parameters<typeof setWorkerSession>[0]);
    renderChrome('/pop/work-start');
    expect(screen.getByText('생산 작업 화면')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: `${messages.popChrome.userSwitch}: ${header.workerLabel('900028', '김작업')}`,
      }),
    );

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(path()).toHaveTextContent('/pop/home');
    expect(loginChip()).toBeInTheDocument();
  });
});
