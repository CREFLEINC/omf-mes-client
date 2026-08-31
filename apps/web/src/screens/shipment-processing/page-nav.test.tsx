import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PageNav } from './page-nav';
import { toPageView } from './pagination';

describe('PageNav', () => {
  it('이전·다음을 누르면 다음 쪽을 알린다', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const view = toPageView({ page: 2, size: 20, total: 60 }, 20);

    render(<PageNav view={view} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: '이전 쪽' }));
    expect(onChange).toHaveBeenCalledWith(1);

    await user.click(screen.getByRole('button', { name: '다음 쪽' }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('첫 쪽에서는 이전이 비활성, 마지막 쪽에서는 다음이 비활성이다', () => {
    const view = toPageView({ page: 1, size: 20, total: 10 }, 10);

    render(<PageNav view={view} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: '이전 쪽' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '다음 쪽' })).toBeDisabled();
  });
});
