import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ROW_PICK_CLASS, rowPickHandlers } from './row-pick';

const NAMES = ['합성 가', '합성 나', '합성 다'];

const renderTable = (disabled: string | null = null, picked: string | null = null) => {
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
                  aria-current={name === picked ? 'true' : undefined}
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

  /*
   * 고른 줄을 다시 누르면 고르는 단추의 함수(선택 해제)에 닿는다 — 빈 칸 · 단추 · Enter 모두(사용자 지시 2026-11-27 ·
   * #360 「2번 클릭하면 선택 해제」). 입력이 사라지는 화면의 확인 팝업은 그 함수가 띄운다.
   */
  it('고른 줄은 빈 칸 · 고르는 단추 · Enter 어느 쪽으로 눌러도 단추의 함수(해제)에 닿는다', async () => {
    const { onPick, user } = renderTable(null, '합성 나');

    await user.click(screen.getByText('합성 나 설명'));
    await user.click(screen.getByRole('button', { name: '합성 나' }));
    screen.getByRole('button', { name: '합성 나' }).focus();
    await user.keyboard('{Enter}');

    expect(onPick).toHaveBeenCalledTimes(3);
    expect(onPick).toHaveBeenNthCalledWith(1, '합성 나');
  });

  it('고른 줄이 있어도 다른 줄은 종전대로 고른다', async () => {
    const { onPick, user } = renderTable(null, '합성 나');

    await user.click(screen.getByText('합성 가 설명'));
    await user.click(screen.getByRole('button', { name: '합성 다' }));

    expect(onPick.mock.calls).toEqual([['합성 가'], ['합성 다']]);
  });

  it('aria-pressed 로 고른 상태를 적는 단추도 같다', async () => {
    const onPick = vi.fn();
    render(
      <div {...rowPickHandlers}>
        <table>
          <tbody>
            <tr>
              <td>
                <button type="button" className={ROW_PICK_CLASS} aria-pressed onClick={onPick}>
                  합성 라
                </button>
              </td>
              <td>합성 라 설명</td>
            </tr>
          </tbody>
        </table>
      </div>,
    );
    const user = userEvent.setup();

    await user.click(screen.getByText('합성 라 설명'));
    await user.click(screen.getByRole('button', { name: '합성 라' }));

    expect(onPick).toHaveBeenCalledTimes(2);
  });

  /* 고른 줄이어도 그 줄의 다른 단추는 그쪽만 받는다. */
  it('고른 줄의 다른 단추는 그대로 받는다', async () => {
    const { onOther, user } = renderTable(null, '합성 가');

    await user.click(screen.getByRole('button', { name: '합성 가 다른 일' }));

    expect(onOther).toHaveBeenCalledOnce();
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
