import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createStubFetch, renderWithProviders } from '../test/api-harness';
import { appRoutes } from './index';

const renderAt = (path: string) =>
  renderWithProviders(
    <RouterProvider router={createMemoryRouter(appRoutes, { initialEntries: [path] })} />,
    { fetch: createStubFetch([]) },
  );

describe('모바일 라우트', () => {
  it('셸 홈에서 자재 위치 확인으로 갈 수 있다', async () => {
    const user = userEvent.setup();
    renderAt('/');

    await user.click(screen.getByRole('link', { name: '자재 위치 확인' }));

    expect(screen.getByRole('heading', { name: '자재 위치 확인' })).toBeInTheDocument();
  });

  it('경로로 바로 들어와도 화면이 선다', () => {
    renderAt('/material-location');

    expect(screen.getByRole('heading', { name: '자재 위치 확인' })).toBeInTheDocument();
  });
});
