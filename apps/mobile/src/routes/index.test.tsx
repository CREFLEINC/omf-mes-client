import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createStubFetch, renderWithProviders } from '../test/api-harness';
import { appRoutes } from './index';

const keystore = vi.hoisted(() => ({ token: 'tok-1' as string | null }));

vi.mock('../patterns/device-token', () => ({
  readDeviceToken: () => Promise.resolve(keystore.token),
  writeDeviceToken: (value: string) => {
    keystore.token = value;
    return Promise.resolve();
  },
  clearDeviceToken: () => {
    keystore.token = null;
    return Promise.resolve();
  },
  currentDeviceToken: () => keystore.token,
}));

afterEach(() => {
  keystore.token = 'tok-1';
});

const renderAt = (path: string) =>
  renderWithProviders(
    <RouterProvider router={createMemoryRouter(appRoutes, { initialEntries: [path] })} />,
    { fetch: createStubFetch([]) },
  );

describe('모바일 라우트', () => {
  it('셸 홈에서 자재 위치 확인으로 갈 수 있다', async () => {
    const user = userEvent.setup();
    renderAt('/');

    await user.click(await screen.findByRole('link', { name: '자재 위치 확인' }));

    expect(screen.getByRole('heading', { name: '자재 위치 확인' })).toBeInTheDocument();
  });

  it('경로로 바로 들어와도 화면이 선다', async () => {
    renderAt('/material-location');

    expect(await screen.findByRole('heading', { name: '자재 위치 확인' })).toBeInTheDocument();
  });

  it('등록되지 않은 단말은 어떤 화면에도 닿지 못한다', async () => {
    keystore.token = null;

    renderAt('/material-location');

    expect(await screen.findByText('이 기기는 아직 등록되지 않았습니다')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '자재 위치 확인' })).not.toBeInTheDocument();
  });
});
