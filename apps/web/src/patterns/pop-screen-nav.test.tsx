import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../test/api-harness';
import { PopScreenNavButton } from './pop-screen-nav';

const SESSION = {
  userId: 1001,
  loginId: 'pop.terminal',
  userName: '조립 1라인 단말',
  scopes: [{ businessUnitId: 1001 }],
};

const stub = (body: unknown, init: ResponseInit = {}) =>
  createStubFetch([
    {
      match: (request: Request) => request.url.endsWith('/app/sessions/current'),
      respond: () => jsonResponse(body, init),
    },
  ]);

/** 지금 어느 주소인지 눈으로 확인할 자리 — 이동이 실제로 일어났는지 잰다. */
const Here = () => <p>지금: {useLocation().pathname}</p>;

const renderNav = (body: unknown, route = '/pop/work-start') =>
  renderWithProviders(
    <>
      <PopScreenNavButton />
      <Here />
    </>,
    { fetch: stub(body), route },
  );

describe('PopScreenNavButton — G-34 화면 이동', () => {
  it('권한 있는 화면만 후보로 보이고 고르면 즉시 이동한다', async () => {
    const user = userEvent.setup();

    renderNav({ ...SESSION, permissions: ['P-02-01', 'P-05-02'] });

    const trigger = await screen.findByRole('combobox', { name: '화면 이동' });
    await waitFor(() => {
      expect(trigger).toBeEnabled();
    });
    await user.click(trigger);

    expect(screen.getByRole('option', { name: 'P-05-02 비가동 실적 입력' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /P-04-01/u })).not.toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: 'P-05-02 비가동 실적 입력' }));

    expect(screen.getByText('지금: /pop/downtime')).toBeInTheDocument();
  });

  /* 지금 서 있는 화면으로 가는 항목은 아무 일도 하지 않는다 — 후보에서 뺀다. */
  it('현재 화면은 후보에 담지 않는다', async () => {
    const user = userEvent.setup();

    renderNav({ ...SESSION, permissions: ['P-02-01', 'P-05-02'] });

    const trigger = await screen.findByRole('combobox', { name: '화면 이동' });
    await waitFor(() => {
      expect(trigger).toBeEnabled();
    });
    await user.click(trigger);

    expect(screen.queryByRole('option', { name: /P-02-01/u })).not.toBeInTheDocument();
  });

  it('권한 목록을 못 받으면 비활성으로 두고 사유를 보인다', async () => {
    renderNav(SESSION);

    expect(
      await screen.findByText('이동할 수 있는 화면을 확인하지 못했습니다'),
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '화면 이동' })).toBeDisabled();
  });

  it('갈 수 있는 화면이 없으면 사유를 갈라 보인다', async () => {
    renderNav({ ...SESSION, permissions: [] });

    expect(await screen.findByText('이동할 수 있는 화면이 없습니다')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '화면 이동' })).toBeDisabled();
  });

  /* 진입 화면은 사번을 넣기 «전»이라 갈 곳을 물을 자리가 아니다. */
  it('진입 화면에서는 서지 않는다', async () => {
    renderNav({ ...SESSION, permissions: ['P-02-01'] }, '/pop/worker-assignment');

    await waitFor(() => {
      expect(screen.getByText('지금: /pop/worker-assignment')).toBeInTheDocument();
    });
    expect(screen.queryByRole('combobox', { name: '화면 이동' })).not.toBeInTheDocument();
  });
});
