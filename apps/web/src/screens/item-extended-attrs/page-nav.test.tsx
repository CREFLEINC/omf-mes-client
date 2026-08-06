import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PageNav } from './page-nav';
import { toPageView } from './pagination';

const renderNav = (page: number, total: number, shown: number) => {
  const onChange = vi.fn<(page: number) => void>();

  render(<PageNav view={toPageView({ page, size: 50, total }, shown)} onChange={onChange} />);

  return { onChange, user: userEvent.setup() };
};

describe('PageNav', () => {
  it('지금 위치를 범위로 알린다', () => {
    renderNav(2, 240, 50);

    expect(screen.getByText('51–100 / 전체 240건')).toBeInTheDocument();
  });

  it('첫 쪽에서는 이전이 비활성이다', () => {
    renderNav(1, 240, 50);

    expect(screen.getByRole('button', { name: '이전' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '다음' })).toBeEnabled();
  });

  it('마지막 쪽에서는 다음이 비활성이다', () => {
    renderNav(5, 240, 40);

    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '이전' })).toBeEnabled();
  });

  it('다음을 누르면 다음 쪽 번호를 알린다', async () => {
    const { onChange, user } = renderNav(2, 240, 50);

    await user.click(screen.getByRole('button', { name: '다음' }));

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('이전을 누르면 앞 쪽 번호를 알린다', async () => {
    const { onChange, user } = renderNav(2, 240, 50);

    await user.click(screen.getByRole('button', { name: '이전' }));

    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('결과가 0건이면 범위를 지어내지 않고 양쪽이 모두 비활성이다', () => {
    renderNav(1, 0, 0);

    expect(screen.getByText('전체 0건')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이전' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  });

  it('탐색 묶음에 접근 이름이 있다', () => {
    renderNav(1, 240, 50);

    expect(screen.getByRole('navigation', { name: '쪽 이동' })).toBeInTheDocument();
  });
});
