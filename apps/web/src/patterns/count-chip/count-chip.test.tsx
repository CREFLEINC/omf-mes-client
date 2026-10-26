import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CountChip } from './count-chip';

describe('CountChip(C-17, C-19)', () => {
  it('선택 여부를 aria-pressed 로 알리고 누르면 onSelect 를 부른다', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<CountChip tone="idle" label="자재 입고 3" selected={false} onSelect={onSelect} />);

    const chip = screen.getByRole('button', { name: '자재 입고 3' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    expect(chip).toHaveClass('count-chip', 'count-chip-idle');

    await user.click(chip);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('선택된 칩만 is-selected 를 갖는다', () => {
    render(<CountChip tone="warning" label="확인 필요 2" selected onSelect={() => {}} />);

    expect(screen.getByRole('button', { name: '확인 필요 2' })).toHaveClass('is-selected');
  });
});
