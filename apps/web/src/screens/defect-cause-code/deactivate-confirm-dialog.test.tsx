import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DeactivateConfirmDialog, type DeactivateConfirmDialogProps } from './deactivate-confirm-dialog';

const renderDialog = (overrides: Partial<DeactivateConfirmDialogProps> = {}) => {
  const props: DeactivateConfirmDialogProps = {
    open: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    isSaving: false,
    childCount: null,
    banner: null,
    ...overrides,
  };

  render(<DeactivateConfirmDialog {...props} />);

  return { props, user: userEvent.setup() };
};

describe('DeactivateConfirmDialog', () => {
  it('무엇이 일어나는지 먼저 밝힌다', () => {
    renderDialog();

    expect(screen.getByText('사용 중지할까요?')).toBeInTheDocument();
    expect(
      screen.getByText('삭제하지 않습니다. 사용 중지하면 새 작업에서 고를 수 없게 됩니다.'),
    ).toBeInTheDocument();
  });

  /*
   * 되돌리기 어려운 조작의 확인 창이 실수로 사라지면 사용자는 자기가 무엇을 취소했는지 모른다.
   * 디자인 시스템 Dialog는 스크림 클릭을 「대상이 dialog 요소인 클릭」으로 판정한다.
   */
  it('바깥 어둠을 눌러도 닫히지 않는다', () => {
    const { props } = renderDialog();

    fireEvent.click(screen.getByRole('dialog'));

    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('하위가 있는 대분류이면 그 건수를 함께 보인다', () => {
    renderDialog({ childCount: 3 });

    expect(
      screen.getByText('이 대분류에는 표시된 목록 기준 하위 상세 코드 3건이 있습니다.'),
    ).toBeInTheDocument();
  });

  it('하위가 없으면 건수 문장이 나오지 않는다', () => {
    renderDialog();

    expect(screen.queryByText(/하위 상세 코드/)).not.toBeInTheDocument();
  });

  it('확인하면 사용 중지를 요청한다', async () => {
    const { props, user } = renderDialog();

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '사용 중지' }));

    expect(props.onConfirm).toHaveBeenCalled();
  });

  it('처리 중에는 다시 누를 수 없다', () => {
    renderDialog({ isSaving: true });

    expect(
      within(screen.getByRole('dialog')).getByRole('button', { name: '사용 중지' }),
    ).toBeDisabled();
  });

  it('실패 사유는 창 안에 낸다 — 닫지 않아야 다시 시도할 수 있다', () => {
    renderDialog({ banner: <p>사용 중지에 실패했습니다</p> });

    expect(
      within(screen.getByRole('dialog')).getByText('사용 중지에 실패했습니다'),
    ).toBeInTheDocument();
  });

  it('닫혀 있으면 아무것도 보이지 않는다', () => {
    renderDialog({ open: false });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
