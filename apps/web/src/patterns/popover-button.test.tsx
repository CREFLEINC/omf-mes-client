import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PopoverButton } from './popover-button';
import { Select } from './select';

const OPTIONS = [
  { value: 'ko', label: '한국어' },
  { value: 'vi', label: 'Tiếng Việt' },
];

const renderMenu = (onChange: (value: string) => void) =>
  render(
    <>
      <PopoverButton trigger="홍길동">
        {() => <Select aria-label="언어" value="ko" options={OPTIONS} onChange={onChange} />}
      </PopoverButton>
      <p>바깥</p>
    </>,
  );

describe('PopoverButton', () => {
  /**
   * 선택 칸의 목록은 `body` 에 그려져 DOM 으로는 판 밖이다. 선택지를 누르는 것을 「밖을 눌렀다」로 보면 판이 먼저
   * 닫혀 고른 값이 전해지지 않는다(상단 바 언어 선택 · 사용자 2026-11-27).
   */
  it('판 안 선택 칸의 선택지를 누르면 고른 값이 전해진다', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderMenu(onChange);

    await user.click(screen.getByRole('button', { name: '홍길동' }));
    await user.click(screen.getByRole('combobox', { name: '언어' }));
    await user.click(screen.getByRole('option', { name: 'Tiếng Việt' }));

    expect(onChange).toHaveBeenCalledWith('vi');
    expect(screen.getByRole('combobox', { name: '언어' })).toBeInTheDocument();
  });

  it('판 밖을 누르면 닫힌다', async () => {
    const user = userEvent.setup();
    renderMenu(vi.fn());

    await user.click(screen.getByRole('button', { name: '홍길동' }));
    await user.click(screen.getByText('바깥'));

    expect(screen.queryByRole('combobox', { name: '언어' })).toBeNull();
  });
});
