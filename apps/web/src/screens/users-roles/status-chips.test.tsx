import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { StatusChips } from './status-chips';

const statuses = [
  { value: 'ACTIVE', label: '재직', isActive: true },
  { value: 'ON_LEAVE', label: '휴직', isActive: true },
  { value: 'RETIRED', label: '퇴직', isActive: true },
];

describe('StatusChips', () => {
  /* 0건 · 아직 모르는 상태는 세우지 않는다(사용자 지시 2026-11-20 · omf-all-around#333). */
  it('건수가 있는 상태만 「이름 건수」로 선다', () => {
    render(
      <StatusChips statuses={statuses} counts={[3, 0, undefined]} active="" onChange={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: '재직만 보기' })).toHaveTextContent('재직 3');
    expect(screen.queryByRole('button', { name: '휴직만 보기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '퇴직만 보기' })).not.toBeInTheDocument();
  });

  it('걸린 상태는 0건이어도 남아 풀 수 있다', async () => {
    const onChange = vi.fn<(next: string) => void>();
    render(
      <StatusChips statuses={statuses} counts={[3, 0, 0]} active="ON_LEAVE" onChange={onChange} />,
    );

    await userEvent.setup().click(screen.getByRole('button', { name: '휴직 거르기 해제' }));

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('누르면 그 상태만 건다', async () => {
    const onChange = vi.fn<(next: string) => void>();
    render(<StatusChips statuses={statuses} counts={[3, 1, 0]} active="" onChange={onChange} />);

    await userEvent.setup().click(screen.getByRole('button', { name: '휴직만 보기' }));

    expect(onChange).toHaveBeenCalledWith('ON_LEAVE');
  });

  it('모든 상태가 0건이면 아무것도 세우지 않는다', () => {
    const { container } = render(
      <StatusChips statuses={statuses} counts={[0, 0, 0]} active="" onChange={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
