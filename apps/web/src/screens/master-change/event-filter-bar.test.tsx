import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EventFilterBar, type EventFilterBarProps } from './event-filter-bar';

const renderBar = (overrides: Partial<EventFilterBarProps> = {}) => {
  const onSearch = vi.fn();
  const onReset = vi.fn();

  render(
    <EventFilterBar
      appliedPeriod={{ from: '2026-08-01', to: '2026-08-07' }}
      onSearch={onSearch}
      onReset={onReset}
      {...overrides}
    />,
  );

  return { onSearch, onReset, user: userEvent.setup() };
};

describe('EventFilterBar — 조회 기간', () => {
  it('주소에 반영된 기간이 두 칸에 들어 있다', () => {
    renderBar();

    expect(screen.getByLabelText('기간 시작')).toHaveValue('2026-08-01');
    expect(screen.getByLabelText('기간 종료')).toHaveValue('2026-08-07');
  });

  /* 트리거 모델은 「모아서 적용」이다 — 고치는 동안 조회가 나가면 반쯤 지운 기간으로 요청이 나간다. */
  it('고친 기간은 조회를 눌러야 올라간다', async () => {
    const { onSearch, user } = renderBar();

    await user.clear(screen.getByLabelText('기간 시작'));
    await user.type(screen.getByLabelText('기간 시작'), '2026-07-20');

    expect(onSearch).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(onSearch).toHaveBeenCalledWith({ from: '2026-07-20', to: '2026-08-07' });
  });

  it('기간을 비우면 조회가 잠기고 사유가 보이며 조회가 올라가지 않는다', async () => {
    const { onSearch, user } = renderBar();

    await user.clear(screen.getByLabelText('기간 시작'));

    const searchButton = screen.getByRole('button', { name: '조회' });
    expect(searchButton).toBeDisabled();

    // 비활성 컨트롤은 포커스를 받지 못한다 — 사유는 감추지 않고 항상 보이는 DOM 텍스트여야 한다.
    const reasonId = searchButton.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(reasonId)).toHaveTextContent(
      '조회는 기간을 모두 채운 뒤에 쓸 수 있습니다.',
    );
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('기간이 역전되면 잠기고 다른 사유가 보인다', async () => {
    const { user } = renderBar();

    await user.clear(screen.getByLabelText('기간 종료'));
    await user.type(screen.getByLabelText('기간 종료'), '2026-07-01');

    const searchButton = screen.getByRole('button', { name: '조회' });
    expect(searchButton).toBeDisabled();

    const reasonId = searchButton.getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(reasonId)).toHaveTextContent(
      '기간 종료는 기간 시작보다 앞설 수 없습니다.',
    );
  });

  it('기간이 갖춰지면 사유가 사라지고 잠금도 풀린다', () => {
    renderBar();

    const searchButton = screen.getByRole('button', { name: '조회' });

    expect(searchButton).toBeEnabled();
    expect(searchButton).not.toHaveAttribute('aria-describedby');
  });

  it('바깥에서 기간이 바뀌면 두 칸이 따라간다 — 뒤로가기가 칸을 되돌린다', () => {
    const { rerender } = render(
      <EventFilterBar
        appliedPeriod={{ from: '2026-08-01', to: '2026-08-07' }}
        onSearch={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('기간 시작')).toHaveValue('2026-08-01');

    rerender(
      <EventFilterBar
        appliedPeriod={{ from: '2026-07-01', to: '2026-07-31' }}
        onSearch={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('기간 시작')).toHaveValue('2026-07-01');
  });

  it('초기화는 화면이 처리하도록 그대로 올린다', async () => {
    const { onReset, user } = renderBar();

    await user.click(screen.getByRole('button', { name: '초기화' }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
