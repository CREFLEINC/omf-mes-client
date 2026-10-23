import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, RouterProvider, createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { LeaveGuard } from './leave-guard';

const t = messages.routing.discard;

const renderGuarded = () => {
  const router = createMemoryRouter(
    [
      {
        path: '/master-data/routings',
        element: (
          <>
            <LeaveGuard when />
            <Link to="/production/work-orders">다른 화면</Link>
          </>
        ),
      },
      { path: '/production/work-orders', element: <p>다른 화면 본문</p> },
    ],
    { initialEntries: ['/master-data/routings'] },
  );
  render(<RouterProvider router={router} />);
  return { router, user: userEvent.setup() };
};

describe('LeaveGuard', () => {
  it('저장하지 않은 편집이 있으면 다른 화면으로 가기 전에 묻는다', async () => {
    const { router, user } = renderGuarded();

    await user.click(screen.getByRole('link', { name: '다른 화면' }));
    const dialog = await screen.findByRole('dialog', { name: t.title });
    await user.click(within(dialog).getByRole('button', { name: t.stay }));
    expect(router.state.location.pathname).toBe('/master-data/routings');

    await user.click(screen.getByRole('link', { name: '다른 화면' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: t.title })).getByRole('button', {
        name: t.confirm,
      }),
    );
    expect(await screen.findByText('다른 화면 본문')).toBeInTheDocument();
  });
});
