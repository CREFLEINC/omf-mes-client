import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PageNav } from './page-nav';
import { toPageView } from './pagination';

const t = messages.productStockStatus;

describe('PageNav', () => {
  it('첫 쪽에서는 이전이 잠긴다', () => {
    render(<PageNav view={toPageView({ page: 1, size: 50, total: 10 }, 10)} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: t.actions.prevPage })).toBeDisabled();
  });

  it('마지막 쪽에서는 다음이 잠긴다', () => {
    render(<PageNav view={toPageView({ page: 1, size: 50, total: 10 }, 10)} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: t.actions.nextPage })).toBeDisabled();
  });

  it('다음을 누르면 다음 쪽 번호로 onChange를 부른다', async () => {
    const onChange = vi.fn<(page: number) => void>();
    const user = userEvent.setup();

    render(<PageNav view={toPageView({ page: 1, size: 10, total: 30 }, 10)} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    expect(onChange).toHaveBeenCalledWith(2);
  });
});
