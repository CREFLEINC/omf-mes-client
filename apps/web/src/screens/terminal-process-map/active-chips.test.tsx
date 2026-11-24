import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ActiveChips } from './active-chips';
import type { RegistrationFilter } from './filters';

describe('ActiveChips', () => {
  it('0건인 라벨은 세우지 않는다', () => {
    render(<ActiveChips counts={[3, 0]} active="" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: '등록만 보기' })).toHaveTextContent('등록 3');
    expect(screen.queryByRole('button', { name: '미등록만 보기' })).not.toBeInTheDocument();
  });

  it('걸려 있는 라벨은 0건이어도 남아 풀 수 있다', async () => {
    const onChange = vi.fn<(next: RegistrationFilter) => void>();
    render(<ActiveChips counts={[3, 0]} active="unregistered" onChange={onChange} />);

    await userEvent.setup().click(screen.getByRole('button', { name: '미등록 거르기 해제' }));

    expect(onChange).toHaveBeenCalledWith('');
  });

  it('모두 0건이면 빈 자리도 두지 않는다', () => {
    const { container } = render(<ActiveChips counts={[0, 0]} active="" onChange={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });
});
