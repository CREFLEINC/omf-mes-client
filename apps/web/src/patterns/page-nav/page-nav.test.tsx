import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { PageNav } from './page-nav';

const t = messages.screenPatterns.pageNav;

describe('PageNav(C-8)', () => {
  it('총 건수, 위치, 처음과 마지막 이동을 보인다', async () => {
    const user = userEvent.setup();
    const onChangePage = vi.fn();
    renderWithProviders(
      <PageNav meta={{ page: 2, size: 20, total: 55 }} onChangePage={onChangePage} />,
    );
    expect(screen.getByText(t.total(55))).toBeVisible();
    expect(screen.getByText(t.position(2, 3))).toBeVisible();
    await user.click(screen.getByRole('button', { name: t.last }));
    await user.click(screen.getByRole('button', { name: t.first }));
    expect(onChangePage.mock.calls).toEqual([[3], [1]]);
  });

  it('첫 쪽에서는 처음과 이전이 잠긴다', () => {
    renderWithProviders(<PageNav meta={{ page: 1, size: 20, total: 5 }} onChangePage={vi.fn()} />);
    expect(screen.getByRole('button', { name: t.prev })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.next })).toBeDisabled();
  });
});
