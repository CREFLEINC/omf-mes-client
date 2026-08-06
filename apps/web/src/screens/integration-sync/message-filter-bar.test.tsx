import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MessageFilterBar } from './message-filter-bar';
import type { PeriodInput } from './period';

const APPLIED: PeriodInput = { from: '2026-08-01', to: '2026-08-06' };

const renderBar = (applied: PeriodInput = APPLIED) => {
  const onSearch = vi.fn();
  const onReset = vi.fn();
  const view = render(
    <MessageFilterBar appliedPeriod={applied} onSearch={onSearch} onReset={onReset} />,
  );

  return { onSearch, onReset, user: userEvent.setup(), rerender: view.rerender };
};

describe('MessageFilterBar', () => {
  it('적용된 기간이 입력칸에 채워진다', () => {
    renderBar();

    expect(screen.getByLabelText('기간 시작')).toHaveValue('2026-08-01');
    expect(screen.getByLabelText('기간 종료')).toHaveValue('2026-08-06');
  });

  it('바깥에서 기간이 바뀌면 입력칸이 따라간다 — 초기화·뒤로가기가 화면에 반영돼야 한다', () => {
    const { rerender } = renderBar();

    rerender(
      <MessageFilterBar
        appliedPeriod={{ from: '2026-07-01', to: '2026-07-31' }}
        onSearch={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('기간 시작')).toHaveValue('2026-07-01');
  });

  it('고치는 동안에는 조회가 나가지 않고 조회를 누를 때 고친 값이 넘어간다', async () => {
    const { onSearch, user } = renderBar();

    await user.clear(screen.getByLabelText('기간 종료'));
    await user.type(screen.getByLabelText('기간 종료'), '2026-08-10');
    expect(onSearch).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(onSearch).toHaveBeenCalledWith({ from: '2026-08-01', to: '2026-08-10' });
  });

  it('기간이 갖춰지지 않으면 조회를 잠그고 사유를 이어 준다', async () => {
    const { onSearch, user } = renderBar();

    await user.clear(screen.getByLabelText('기간 시작'));

    const button = screen.getByRole('button', { name: '조회' });
    expect(button).toBeDisabled();
    expect(button.getAttribute('aria-describedby')).not.toBeNull();
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('초기화는 기간이 잠긴 상태에서도 쓸 수 있다 — 되돌릴 수단까지 막으면 갇힌다', async () => {
    const { onReset, user } = renderBar({ from: '', to: '' });

    expect(screen.getByRole('button', { name: '조회' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '초기화' }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
