import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DockedNumberPad } from './docked-number-pad';

const MOVE = {
  canPrevious: true,
  canNext: true,
  onPrevious: vi.fn(),
  onNext: vi.fn(),
  previousLabel: '앞 라인',
  nextLabel: '다음 라인',
};

describe('화면 아래 숫자판', () => {
  it('무엇을 적는 중인지 머리줄로 말한다', () => {
    render(
      <DockedNumberPad head="A-01 · 나사" value="" onChange={vi.fn()} onClose={vi.fn()} />,
    );

    expect(screen.getByText('A-01 · 나사')).toBeInTheDocument();
  });

  it('적을 칸이 하나면 이동 단추를 그리지 않는다', () => {
    render(<DockedNumberPad head="수량" value="" onChange={vi.fn()} onClose={vi.fn()} />);

    expect(screen.queryByRole('button', { name: '앞 라인' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '다음 라인' })).not.toBeInTheDocument();
  });

  it('적을 칸이 여럿이면 이동 단추를 그린다', () => {
    render(
      <DockedNumberPad head="수량" value="" onChange={vi.fn()} onClose={vi.fn()} move={MOVE} />,
    );

    expect(screen.getByRole('button', { name: '앞 라인' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다음 라인' })).toBeInTheDocument();
  });

  it('갈 곳이 없는 쪽은 눌리지 않는다', () => {
    render(
      <DockedNumberPad
        head="수량"
        value=""
        onChange={vi.fn()}
        onClose={vi.fn()}
        move={{ ...MOVE, canPrevious: false }}
      />,
    );

    expect(screen.getByRole('button', { name: '앞 라인' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '다음 라인' })).toBeEnabled();
  });

  it('닫는 길이 있다', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DockedNumberPad head="수량" value="7" onChange={vi.fn()} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onClose).toHaveBeenCalled();
  });

  /*
   * 줄 안에 끼우면 아래 줄이 화면 밖으로 밀린다. 붙박이로 서는지는 자리를 정하는 클래스로
   * 잰다 — 계산된 위치는 jsdom 이 내주지 않는다.
   */
  it('화면 아래에 붙박이로 선다', () => {
    const { container } = render(
      <DockedNumberPad head="수량" value="" onChange={vi.fn()} onClose={vi.fn()} />,
    );

    expect(container.querySelector('.docked-pad')).not.toBeNull();
  });
});
