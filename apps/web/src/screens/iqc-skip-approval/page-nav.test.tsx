import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PageNav } from './page-nav';
import { toPageView } from './pagination';

const t = messages.iqcSkipApproval;

const renderNav = (meta: { page: number; size: number; total: number }, shown: number) => {
  const onChange = vi.fn();
  render(<PageNav view={toPageView(meta, shown)} onChange={onChange} />);

  return { onChange, user: userEvent.setup() };
};

describe('PageNav', () => {
  it('지금 보고 있는 범위를 밝힌다', () => {
    renderNav({ page: 1, size: 20, total: 45 }, 20);

    expect(screen.getByText(t.pageNav.range(1, 20, 45))).toBeInTheDocument();
  });

  it('첫 쪽에서는 이전이 잠긴다', () => {
    renderNav({ page: 1, size: 20, total: 45 }, 20);

    expect(screen.getByRole('button', { name: t.actions.prevPage })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.nextPage })).toBeEnabled();
  });

  it('마지막 쪽에서는 다음이 잠긴다', () => {
    renderNav({ page: 3, size: 20, total: 45 }, 5);

    expect(screen.getByRole('button', { name: t.actions.prevPage })).toBeEnabled();
    expect(screen.getByRole('button', { name: t.actions.nextPage })).toBeDisabled();
  });

  it('옮길 쪽 번호를 준다', async () => {
    const { onChange, user } = renderNav({ page: 2, size: 20, total: 45 }, 20);

    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));
    expect(onChange).toHaveBeenCalledWith(3);

    await user.click(screen.getByRole('button', { name: t.actions.prevPage }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('쪽 이동임을 이름으로 밝힌다', () => {
    renderNav({ page: 1, size: 20, total: 45 }, 20);

    expect(screen.getByRole('navigation', { name: t.pageNav.label })).toBeInTheDocument();
  });
});
