import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PageNav } from './page-nav';
import { toPageView } from './pagination';

const renderNav = (page: number, total: number, shown: number, size = 50) => {
  const onChange = vi.fn();
  render(<PageNav view={toPageView({ page, size, total }, shown)} onChange={onChange} />);

  return { onChange, user: userEvent.setup() };
};

describe('PageNav', () => {
  it('지금 위치를 이동 버튼과 함께 낸다', () => {
    renderNav(3, 240, 50);

    expect(screen.getByRole('navigation', { name: '쪽 이동' })).toBeInTheDocument();
    expect(screen.getByText('101–150 / 전체 240건')).toBeInTheDocument();
  });

  it('첫 쪽에서는 이전이 잠긴다', () => {
    renderNav(1, 240, 50);

    expect(screen.getByRole('button', { name: '이전' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '다음' })).toBeEnabled();
  });

  it('마지막 쪽에서는 다음이 잠긴다', () => {
    renderNav(5, 240, 40);

    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  });

  it('전체가 쪽 크기의 배수여도 마지막 쪽에서 다음이 잠긴다', () => {
    renderNav(2, 40, 20, 20);

    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  });

  it('0건이면 양쪽이 다 잠기고 전체 건수만 보인다', () => {
    renderNav(1, 0, 0);

    expect(screen.getByRole('button', { name: '이전' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
    expect(screen.getByText('전체 0건')).toBeInTheDocument();
  });

  it('다음을 누르면 한 쪽 뒤를 요청한다', async () => {
    const { onChange, user } = renderNav(3, 240, 50);

    await user.click(screen.getByRole('button', { name: '다음' }));

    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('이전을 누르면 한 쪽 앞을 요청한다', async () => {
    const { onChange, user } = renderNav(3, 240, 50);

    await user.click(screen.getByRole('button', { name: '이전' }));

    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('쪽 번호 목록을 두지 않는다 — 이동 수단은 이전·다음뿐이다', () => {
    renderNav(3, 240, 50);

    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
