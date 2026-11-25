import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { HUB_ACTIONS_ID } from '../../patterns/hub-actions';
import { UsageChips } from './usage-chips';

/** 셸이 세우는 탭 줄 오른쪽 자리를 흉내 낸다. */
const renderWithSlot = (value: 'all' | 'active' | 'inactive') => {
  const onChange = vi.fn();
  render(
    <>
      <div id={HUB_ACTIONS_ID} />
      <UsageChips counts={null} value={value} onChange={onChange} />
    </>,
  );
  return { onChange, user: userEvent.setup() };
};

describe('UsageChips (#209)', () => {
  it('건수를 받으면 「전체」 없이 칩마다 「이름 N건」으로 낸다', async () => {
    render(
      <>
        <div id={HUB_ACTIONS_ID} />
        <UsageChips counts={{ all: 9, active: 7, inactive: 2 }} value="active" onChange={vi.fn()} />
      </>,
    );

    expect(await screen.findByRole('button', { name: '사용 7' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '미사용 2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /전체/ })).not.toBeInTheDocument();
  });

  it('0건 칩은 감추고, 고른 칩은 0건이어도 남긴다', async () => {
    const { rerender } = render(
      <>
        <div id={HUB_ACTIONS_ID} />
        <UsageChips counts={{ all: 7, active: 7, inactive: 0 }} value="active" onChange={vi.fn()} />
      </>,
    );

    expect(await screen.findByRole('button', { name: '사용 7' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /미사용/ })).not.toBeInTheDocument();

    rerender(
      <>
        <div id={HUB_ACTIONS_ID} />
        <UsageChips
          counts={{ all: 7, active: 7, inactive: 0 }}
          value="inactive"
          onChange={vi.fn()}
        />
      </>,
    );
    expect(await screen.findByRole('button', { name: '미사용 0' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('사용 · 미사용 칩을 내고 지금 고른 칩이 눌린 상태다', async () => {
    renderWithSlot('active');

    expect(await screen.findByRole('button', { name: '사용' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '미사용' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('다른 칩을 누르면 그 값으로 바꾼다', async () => {
    const { onChange, user } = renderWithSlot('active');

    await user.click(await screen.findByRole('button', { name: '미사용' }));

    expect(onChange).toHaveBeenCalledWith('inactive');
  });

  it('고른 칩을 다시 누르면 전체로 풀린다', async () => {
    const { onChange, user } = renderWithSlot('active');

    await user.click(await screen.findByRole('button', { name: '사용' }));

    expect(onChange).toHaveBeenCalledWith('all');
  });

  it('탭 줄 자리가 없으면 그리지 않는다', () => {
    render(<UsageChips counts={null} value="all" onChange={vi.fn()} />);

    expect(screen.queryByRole('group', { name: '사용 여부로 거르기' })).not.toBeInTheDocument();
  });
});
