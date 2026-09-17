import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DockedNumberPad } from './docked-number-pad';

const keyboard = vi.hoisted(() => ({ hide: vi.fn(() => Promise.resolve()) }));

vi.mock('@capacitor/keyboard', () => ({ Keyboard: keyboard }));

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
  /*
   * 숫자판 바깥을 누르면 닫는다. 확인 키를 못 찾은 사람이 화면을 눌러 닫으려 하는데,
   * 그대로 두면 아래 절반이 계속 덮인 채 남는다.
   */
  it('숫자판 바깥을 누르면 닫는다', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <>
        <button type="button">바깥</button>
        <DockedNumberPad head="수량" value="" onChange={vi.fn()} onClose={onClose} />
      </>,
    );

    await user.click(screen.getByRole('button', { name: '바깥' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('숫자판 안을 누르면 닫지 않는다', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DockedNumberPad head="수량" value="" onChange={vi.fn()} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: '7' }));

    expect(onClose).not.toHaveBeenCalled();
  });

  /*
   * 적는 칸이 화면 아래에 있으면 숫자판이 그 위에 서면서 칸을 덮는다. 무엇을 치는지 보이지
   * 않으므로 칸을 숫자판 위로 끌어올린다.
   */
  it('적는 칸을 숫자판 위로 끌어올린다', () => {
    const scrollIntoView = vi.fn();
    const { rerender } = render(<input aria-label="수량칸" />);

    const field = screen.getByLabelText('수량칸');
    field.scrollIntoView = scrollIntoView;
    field.focus();

    /* 칸을 누른 뒤에 숫자판이 선다. 그 차례 그대로 만든다. */
    rerender(
      <>
        <input aria-label="수량칸" />
        <DockedNumberPad head="수량" value="" onChange={vi.fn()} onClose={vi.fn()} />
      </>,
    );

    expect(scrollIntoView).toHaveBeenCalled();
  });
  /*
   * 비고처럼 자판이 필요한 칸을 치다가 숫자칸을 누르면, 포커스가 옮겨 가도 기기 자판이
   * 내려가지 않는다. 앱 숫자판이 그 위에 서서 둘이 겹친다(실기 2026-09-17).
   *
   * 칸의 설정으로는 내릴 수 없어 단말에 직접 내리라고 이른다.
   */
  it('서면 기기 자판을 내린다', () => {
    keyboard.hide.mockClear();
    render(<DockedNumberPad head="수량" value="" onChange={vi.fn()} onClose={vi.fn()} />);

    expect(keyboard.hide).toHaveBeenCalled();
  });
});
