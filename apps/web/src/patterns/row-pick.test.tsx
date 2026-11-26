import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ROW_PICK_CLASS, rowPickHandlers } from './row-pick';

const NAMES = ['합성 가', '합성 나', '합성 다'];

const renderTable = (disabled: string | null = null) => {
  const onPick = vi.fn<(name: string) => void>();
  const onOther = vi.fn();
  render(
    <div {...rowPickHandlers}>
      <table>
        <tbody>
          {NAMES.map((name) => (
            <tr key={name}>
              <td>
                <button
                  type="button"
                  className={`link-cell ${ROW_PICK_CLASS}`}
                  disabled={name === disabled}
                  onClick={() => onPick(name)}
                >
                  {name}
                </button>
              </td>
              <td>{`${name} 설명`}</td>
              <td>
                <button type="button" onClick={onOther}>{`${name} 다른 일`}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>,
  );

  return { onPick, onOther, user: userEvent.setup() };
};

describe('rowPickHandlers — 줄 아무 곳이나 눌러 고르기(#360)', () => {
  it('줄의 빈 칸을 누르면 그 줄의 고르는 단추가 눌린다', async () => {
    const { onPick, user } = renderTable();

    await user.click(screen.getByText('합성 나 설명'));

    expect(onPick).toHaveBeenCalledExactlyOnceWith('합성 나');
  });

  it('줄 안의 다른 단추는 그쪽만 받는다', async () => {
    const { onPick, onOther, user } = renderTable();

    await user.click(screen.getByRole('button', { name: '합성 가 다른 일' }));

    expect(onOther).toHaveBeenCalledOnce();
    expect(onPick).not.toHaveBeenCalled();
  });

  it('고르는 단추를 누르면 한 번만 고른다', async () => {
    const { onPick, user } = renderTable();

    await user.click(screen.getByRole('button', { name: '합성 다' }));

    expect(onPick).toHaveBeenCalledExactlyOnceWith('합성 다');
  });

  it('잠긴 줄은 눌러도 고르지 않는다', async () => {
    const { onPick, user } = renderTable('합성 가');

    await user.click(screen.getByText('합성 가 설명'));

    expect(onPick).not.toHaveBeenCalled();
  });

  it('위아래 방향키로 앞뒤 줄의 고르는 단추로 옮긴다 — 잠긴 줄은 건너뛴다', async () => {
    const { user } = renderTable('합성 나');

    screen.getByRole('button', { name: '합성 가' }).focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: '합성 다' })).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('button', { name: '합성 가' })).toHaveFocus();
  });
});
