import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DeactivateDialog } from './deactivate-dialog';

const renderDialog = (overrides: Partial<Parameters<typeof DeactivateDialog>[0]> = {}) => {
  const onClose = vi.fn<() => void>();
  const onConfirm = vi.fn<() => void>();

  render(
    <DeactivateDialog
      open
      title="이 코드그룹을 사용 중지할까요?"
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
  it('어느 자원을 중지하는지 제목이 밝힌다', () => {
    renderDialog();

    expect(
      within(screen.getByRole('dialog')).getByText('이 코드그룹을 사용 중지할까요?'),
    ).toBeInTheDocument();
  });

  /* 계약에 되살리는 경로가 없다 — 누르기 전에 그 사실을 밝힌다. */
  it('되돌리는 경로가 없다는 사실을 본문이 밝힌다', () => {
    renderDialog();

    expect(
      within(screen.getByRole('dialog')).getByText(
        '사용 중지하면 새 선택지에서 빠지고 이미 쓰인 자료는 그대로 남습니다. 되돌리는 경로가 없습니다.',
      ),
    ).toBeInTheDocument();
  });

  /*
   * 결정 10 — 화면이 쓸 수 있는 건수는 「코드 필드를 고칠 수 있는지」의 근거이지
   * 「이 행을 참조하는 자료의 수」가 아니다. 두 뜻을 섞으면 화면이 지어낸다.
   */
  it('참조 건수를 내지 않는다', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).not.toMatch(/\d+\s*건/);
    expect(dialog.textContent).not.toMatch(/참조/);
  });

  it('확인을 누르면 중지를 알린다', async () => {
    const { onConfirm, user } = renderDialog();

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '사용 중지' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('취소를 누르면 닫힘을 알린다', async () => {
    const { onClose, user } = renderDialog();

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '취소' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('저장 중에는 확인이 막힌다 — 연타로 요청이 두 번 나가지 않는다', () => {
    renderDialog({ isSaving: true });

    expect(
      within(screen.getByRole('dialog')).getByRole('button', { name: '사용 중지' }),
    ).toBeDisabled();
  });

  it('실패 배너를 창 안에 담는다 — 닫지 않고 이유를 보여야 다시 시도할 수 있다', () => {
    renderDialog({ banner: <p>중지하지 못했습니다</p> });

    expect(within(screen.getByRole('dialog')).getByText('중지하지 못했습니다')).toBeInTheDocument();
  });
});
