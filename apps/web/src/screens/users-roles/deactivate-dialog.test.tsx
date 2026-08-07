import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DeactivateDialog, type DeactivateDialogProps } from './deactivate-dialog';

const renderDialog = (overrides: Partial<DeactivateDialogProps> = {}) => {
  const onClose = vi.fn<() => void>();
  const onConfirm = vi.fn<() => void>();

  render(
    <DeactivateDialog
      open
      title="이 사용자를 사용 중지할까요?"
      onClose={onClose}
      onConfirm={onConfirm}
      isSaving={false}
      banner={null}
      {...overrides}
    />,
  );

  return { onClose, onConfirm, user: userEvent.setup() };
};

describe('DeactivateDialog', () => {
  it('제목이 어느 자원을 중지하는지 밝힌다', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: '이 사용자를 사용 중지할까요?' })).toBeInTheDocument();
  });

  /** 계약에 되살리는 오퍼레이션이 없고 수정 본문에도 사용 여부가 없다. */
  it('본문이 되돌릴 수 없다는 사실을 밝힌다', () => {
    renderDialog();

    expect(screen.getByText(/되돌리는 경로가 없습니다/)).toBeInTheDocument();
  });

  /**
   * 화면이 쓸 수 있는 건수는 「코드 필드를 고칠 수 있는지」의 근거이지
   * 「이 사용자에게 배정된 자료의 수」가 아니다 — 두 뜻을 섞으면 화면이 지어낸다.
   */
  it('참조 건수·배정 건수를 내지 않는다', () => {
    renderDialog();

    expect(screen.getByRole('dialog').textContent).not.toMatch(/\d+\s*건/);
  });

  /**
   * 되돌릴 수 없는 액션의 확인 창이 실수로 사라지면 사용자는 무엇을 취소했는지 모른다.
   *
   * 디자인 시스템은 **클릭 대상이 `<dialog>` 자신일 때**(=어둠 부분)만 닫으므로
   * 그 요소를 직접 눌러야 이 규칙을 실제로 밟는다.
   */
  it('바깥 어둠을 눌러도 닫히지 않는다', async () => {
    const { onClose, user } = renderDialog();

    await user.click(screen.getByRole('dialog'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('확인과 취소를 누르면 상위에 알린다', async () => {
    const { onClose, onConfirm, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: '사용 중지' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: '취소' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('보내는 중에는 확인을 다시 누를 수 없다', () => {
    renderDialog({ isSaving: true });

    expect(screen.getByRole('button', { name: '사용 중지' })).toBeDisabled();
  });

  /** 창을 닫지 않고 이유를 보여야 사용자가 다시 시도할 수 있다. */
  it('실패 배너를 창 안에 낸다', () => {
    renderDialog({ banner: <p>중지 실패 표시</p> });

    expect(screen.getByText('중지 실패 표시')).toBeInTheDocument();
  });
});
