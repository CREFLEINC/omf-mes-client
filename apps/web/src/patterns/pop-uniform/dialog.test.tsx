import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PuDialog } from './dialog';

describe('PuDialog Esc', () => {
  it('창이 겹쳐 뜨면 Esc 는 맨 위 창만 닫는다', async () => {
    const onCloseOuter = vi.fn();
    const onCloseInner = vi.fn();
    render(
      <PuDialog ariaLabel="바깥 창" onClose={onCloseOuter}>
        <PuDialog ariaLabel="안쪽 창" onClose={onCloseInner}>
          안쪽
        </PuDialog>
      </PuDialog>,
    );
    expect(screen.getByRole('dialog', { name: '안쪽 창' })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(onCloseInner).toHaveBeenCalledTimes(1);
    expect(onCloseOuter).not.toHaveBeenCalled();
  });
});
