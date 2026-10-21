import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { QtyPanel } from './qty-panel';

const props = {
  id: 'qty',
  label: '실입하 수량',
  value: '300',
  unit: 'EA',
  padLabel: '숫자판 열기',
  onChange: () => undefined,
};

describe('수량 판', () => {
  /* 숫자판이 이 칸을 가리킨다. 단말 키보드가 뜨면 판을 덮는다. */
  it('이름으로 찾히는 칸이고 단말 키보드를 부르지 않는다', () => {
    render(<QtyPanel {...props} onFocus={vi.fn()} />);

    const input = screen.getByLabelText('실입하 수량');

    expect(input).toHaveValue('300');
    expect(input).toHaveAttribute('inputmode', 'none');
  });

  it('숫자판 단추를 누르면 칸을 잡고 숫자판을 연다', async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    render(<QtyPanel {...props} onFocus={open} />);

    await user.click(screen.getByRole('button', { name: '숫자판 열기' }));

    expect(open).toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByLabelText('실입하 수량'));
  });

  it('오류가 있으면 안내 대신 오류를 칸의 설명으로 보인다', () => {
    render(
      <QtyPanel
        {...props}
        onFocus={vi.fn()}
        note="잔여 수량을 채워 두었습니다"
        error="0 보다 커야 합니다"
      />,
    );

    expect(screen.getByLabelText('실입하 수량')).toHaveAccessibleDescription('0 보다 커야 합니다');
    expect(screen.queryByText('잔여 수량을 채워 두었습니다')).toBeNull();
  });

  /* 넘친 몫은 막대 끝에서 자르고 색으로 말한다 - 얼마나 넘쳤는지는 판정 칩이 말한다. */
  it('발주를 넘기면 막대가 넘침 색이 된다', () => {
    const { container } = render(
      <QtyPanel {...props} onFocus={vi.fn()} meter={{ before: 200, now: 400, total: 500 }} />,
    );

    const now = container.querySelector('.qty-panel__meter-now') as HTMLElement;

    expect(now).toHaveClass('qty-panel__meter-now--over');
    expect(now.style.width).toBe('60%');
  });
});
