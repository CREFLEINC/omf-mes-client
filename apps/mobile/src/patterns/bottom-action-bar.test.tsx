import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BottomActionBar } from './bottom-action-bar';

describe('하단 확정 바', () => {
  it('확정 단추를 누르면 넘긴 일을 한다', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<BottomActionBar primary={{ label: '입하 등록', onClick }} />);

    await user.click(screen.getByRole('button', { name: '입하 등록' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  /* 공유계약 G-1 — 잠긴 단추만 두면 무엇을 해야 풀리는지 알 수 없다. */
  it('잠겨 있으면 이유를 단추에 이어 말한다', () => {
    render(
      <BottomActionBar
        primary={{
          label: '입하 등록',
          onClick: vi.fn(),
          disabled: true,
          lockReason: '실입하 수량을 먼저 적으세요',
        }}
      />,
    );

    const button = screen.getByRole('button', { name: '입하 등록' });

    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('실입하 수량을 먼저 적으세요');
  });

  it('잠겨 있지 않으면 이유를 보이지 않는다', () => {
    render(
      <BottomActionBar
        primary={{
          label: '입하 등록',
          onClick: vi.fn(),
          lockReason: '실입하 수량을 먼저 적으세요',
        }}
      />,
    );

    expect(screen.queryByText('실입하 수량을 먼저 적으세요')).toBeNull();
  });

  it('두 번째 길을 같은 바에 세운다', async () => {
    const user = userEvent.setup();
    const onHold = vi.fn();
    render(
      <BottomActionBar
        primary={{ label: '부분 입하 등록', onClick: vi.fn() }}
        secondary={{ label: '다음 입하', onClick: onHold }}
      />,
    );

    await user.click(screen.getByRole('button', { name: '다음 입하' }));

    expect(onHold).toHaveBeenCalledTimes(1);
  });
});
