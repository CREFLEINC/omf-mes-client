import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { HUB_ACTIONS_ID } from '../../patterns/hub-actions';
import { UsageChips } from './usage-chips';

/* 탭 줄 사용 여부 라벨 — 「전체」 없이 「이름 N건」, 0건 감춤, 다시 누르면 전체(사용자 지시 2026-11-24). */
describe('UsageChips', () => {
  const renderChips = (value: 'all' | 'active' | 'inactive', inactive = 2) => {
    const onChange = vi.fn();
    render(
      <>
        <div id={HUB_ACTIONS_ID} />
        <UsageChips
          counts={{ all: 7 + inactive, active: 7, inactive }}
          value={value}
          onChange={onChange}
        />
      </>,
    );
    return { onChange, user: userEvent.setup() };
  };

  it('「전체」 없이 칩마다 건수를 붙인다', async () => {
    renderChips('active');

    expect(await screen.findByRole('button', { name: '사용 7' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '미사용 2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /전체/ })).not.toBeInTheDocument();
  });

  it('0건 칩은 감춘다', async () => {
    renderChips('active', 0);

    expect(await screen.findByRole('button', { name: '사용 7' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /미사용/ })).not.toBeInTheDocument();
  });

  it('고른 칩을 다시 누르면 전체로, 다른 칩을 누르면 그 값으로 바꾼다', async () => {
    const { onChange, user } = renderChips('active');

    await user.click(await screen.findByRole('button', { name: '사용 7' }));
    expect(onChange).toHaveBeenLastCalledWith('all');

    await user.click(screen.getByRole('button', { name: '미사용 2' }));
    expect(onChange).toHaveBeenLastCalledWith('inactive');
  });
});
