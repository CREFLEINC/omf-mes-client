import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PageNav } from './page-nav';
import { toWorkOrderPageView } from './pagination';

type Meta = Parameters<typeof toWorkOrderPageView>[0];

const renderNav = (meta: Meta, shown: number) => {
  const onChange = vi.fn<(page: number) => void>();

  render(<PageNav view={toWorkOrderPageView(meta, shown)} onChange={onChange} />);

  return { onChange, user: userEvent.setup() };
};

/* 공용 쪽 이동 줄(총 N건 · [처음] [이전] n / m [다음] [마지막])로 그린다 — 1쪽 · 0건이어도 늘 보인다(#360). */
describe('PageNav — 공용 쪽 이동 줄', () => {
  it('총 건수와 지금 위치를 보인다', () => {
    renderNav({ page: 2, size: 20, total: 45 }, 20);

    expect(screen.getByRole('navigation', { name: '쪽 이동' })).toBeInTheDocument();
    expect(screen.getByText('총 45건')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('처음 · 이전 · 다음 · 마지막이 옮길 쪽을 알린다', async () => {
    const { onChange, user } = renderNav({ page: 2, size: 20, total: 45 }, 20);

    await user.click(screen.getByRole('button', { name: '처음' }));
    await user.click(screen.getByRole('button', { name: '이전' }));
    await user.click(screen.getByRole('button', { name: '다음' }));
    await user.click(screen.getByRole('button', { name: '마지막' }));

    expect(onChange.mock.calls).toEqual([[1], [1], [3], [3]]);
  });

  it('1쪽뿐이어도 줄은 보이고 단추만 잠긴다', () => {
    renderNav({ page: 1, size: 20, total: 5 }, 5);

    expect(screen.getByText('총 5건')).toBeInTheDocument();
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
    for (const name of ['처음', '이전', '다음', '마지막']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
  });

  it('0건이어도 줄이 보인다', () => {
    renderNav({ page: 1, size: 20, total: 0 }, 0);

    expect(screen.getByText('총 0건')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  });
});
