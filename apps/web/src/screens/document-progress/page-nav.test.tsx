import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PageNav } from './page-nav';
import { toPageView } from './pagination';

const t = messages.documentProgress;

const renderNav = (page: number, total: number, shown: number) => {
  const onChange = vi.fn();

  render(<PageNav view={toPageView({ page, size: 50, total }, shown)} onChange={onChange} />);

  return { onChange, user: userEvent.setup() };
};

describe('PageNav', () => {
  it('지금 보고 있는 범위를 낸다', () => {
    renderNav(2, 120, 50);

    expect(screen.getByText(t.pageNav.range(51, 100, 120))).toBeInTheDocument();
  });

  it('이전·다음으로 쪽을 옮긴다', async () => {
    const { onChange, user } = renderNav(2, 120, 50);

    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));
    expect(onChange).toHaveBeenCalledWith(3);

    await user.click(screen.getByRole('button', { name: t.actions.prevPage }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('갈 수 없는 쪽의 버튼은 잠긴다', () => {
    renderNav(1, 20, 20);

    expect(screen.getByRole('button', { name: t.actions.prevPage })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.nextPage })).toBeDisabled();
  });

  /* 쪽 이동 묶음에 이름이 있어야 보조기술 사용자가 그 자리를 찾을 수 있다. */
  it('쪽 이동 묶음에 이름이 있다', () => {
    renderNav(1, 120, 50);

    expect(screen.getByRole('navigation', { name: t.pageNav.label })).toBeInTheDocument();
  });
});
