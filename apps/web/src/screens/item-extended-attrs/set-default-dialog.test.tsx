import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SetDefaultDialog } from './set-default-dialog';

const renderDialog = (overrides: Partial<Parameters<typeof SetDefaultDialog>[0]> = {}) => {
  const onClose = vi.fn<() => void>();
  const onConfirm = vi.fn<() => void>();

  render(
    <SetDefaultDialog
      bomName="SYN-BOM-01 · Rev 1"
      isSaving={false}
      banner={null}
      onClose={onClose}
      onConfirm={onConfirm}
      {...overrides}
    />,
  );

  return { onClose, onConfirm, user: userEvent.setup() };
};

/**
 * 결정 9 — **사용자가 고르지 않은 다른 줄이 함께 바뀐다.**
 * 서버 응답은 지정한 줄만 돌려주므로, 무엇이 기본에서 내려갔는지 화면이 알 수 없다.
 */
describe('SetDefaultDialog', () => {
  it('기존 기본이 자동 해제된다는 사실을 본문이 밝힌다', () => {
    renderDialog();

    expect(
      screen.getByText('같은 품목의 기존 기본 자재 명세서는 자동으로 해제됩니다.'),
    ).toBeInTheDocument();
  });

  /* 대상이 제목에 없으면 어느 줄을 지정하는 창인지 알 수 없다. */
  it('제목이 대상 자재 명세서를 담는다', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: /SYN-BOM-01 · Rev 1/ })).toBeInTheDocument();
  });

  it('확인이 바깥에 알린다', async () => {
    const { onConfirm, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: '기본으로 지정' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('취소가 바깥에 알린다', async () => {
    const { onClose, onConfirm, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  /* 보내는 중에 다시 누르면 같은 조작이 두 번 나간다. */
  it('보내는 중에는 확인을 다시 누를 수 없다', () => {
    renderDialog({ isSaving: true });

    expect(screen.getByRole('button', { name: '기본으로 지정' })).toBeDisabled();
  });

  /* 창을 닫으면 실패 이유가 사라진다 — 창 안에서 보여야 다시 시도할 수 있다. */
  it('실패 배너를 창 안에 담는다', () => {
    renderDialog({ banner: <p>권한이 없습니다</p> });

    expect(screen.getByText('권한이 없습니다')).toBeInTheDocument();
  });
});
