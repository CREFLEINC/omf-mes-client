import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Segmented } from './segmented';

const OPTIONS = [
  { value: 'table', label: '표', icon: 'table_rows' },
  { value: 'timeline', label: '일정', icon: 'view_timeline' },
] as const;

const renderSegmented = (value: 'table' | 'timeline' = 'table') => {
  const onChange = vi.fn();
  render(<Segmented label="보기" options={OPTIONS} value={value} onChange={onChange} />);

  const group = screen.getByRole('group', { name: '보기' });

  return {
    onChange,
    user: userEvent.setup(),
    option: (name: string) => within(group).getByRole('button', { name }),
  };
};

describe('Segmented', () => {
  it('고른 칸만 눌린 상태로 알린다', () => {
    const { option } = renderSegmented('table');

    expect(option('표')).toHaveAttribute('aria-pressed', 'true');
    expect(option('표')).toHaveClass('is-selected');
    expect(option('일정')).toHaveAttribute('aria-pressed', 'false');
    expect(option('일정')).not.toHaveClass('is-selected');
  });

  it('다른 칸을 누르면 그 값을 알린다', async () => {
    const { onChange, user, option } = renderSegmented('table');

    await user.click(option('일정'));

    expect(onChange).toHaveBeenCalledWith('timeline');
  });

  /* 늘 하나가 골라져 있다 — 고른 칸을 다시 눌러 푸는 동작이 없다. */
  it('⛔ 고른 칸을 다시 눌러도 알리지 않는다', async () => {
    const { onChange, user, option } = renderSegmented('table');

    await user.click(option('표'));

    expect(onChange).not.toHaveBeenCalled();
  });

  /* 아이콘은 꾸밈이다 — 칸의 이름은 글자 그대로여야 화면 읽기 도구가 아이콘 이름을 읽지 않는다. */
  it('아이콘이 있어도 칸의 이름은 글자뿐이다', () => {
    const { option } = renderSegmented();

    expect(option('표')).toBeInTheDocument();
    expect(option('일정')).toBeInTheDocument();
  });

  it('키보드로도 고른다', async () => {
    const { onChange, user, option } = renderSegmented('table');

    option('일정').focus();
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith('timeline');
  });
});
