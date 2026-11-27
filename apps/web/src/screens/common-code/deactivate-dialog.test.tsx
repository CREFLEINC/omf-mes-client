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
      title="코드그룹 사용 중지"
      question="이 코드그룹의 사용을 중지하시겠습니까?"
      description="사용을 중지하면 새로 선택할 수 없습니다. 기존 기록에는 이 코드그룹이 그대로 표시됩니다."
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
  /* 아이콘 클래스는 창(제목 앞 아이콘)에 — [취소] 단추에 붙지 않는다(#360). */
  it('제목 아이콘 클래스는 창에 붙고 [취소] 단추에는 없다', () => {
    renderDialog();

    expect(screen.getByRole('dialog').closest('dialog')).toHaveClass('dialog-icon-block');
    const cancel = screen.getByRole('button', { name: '취소' });
    expect(cancel.className).not.toMatch(/dialog-icon-/);
  });

  it('어느 자원을 중지하는지 제목이 밝힌다', () => {
    renderDialog();

    expect(within(screen.getByRole('dialog')).getByText('코드그룹 사용 중지')).toBeInTheDocument();
  });

  /* 사용자 지시 2026-11-26 — 제목 아래 대상 줄 없이 설명 · 주의 줄 순서. */
  it('대상 줄 없이 질문 · 설명 · 주의 줄을 차례로 낸다', () => {
    renderDialog();

    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.queryByText(/\(SYN-/)).toBeNull();
    const question = dialog.getByText('이 코드그룹의 사용을 중지하시겠습니까?');
    const description = dialog.getByText(
      '사용을 중지하면 새로 선택할 수 없습니다. 기존 기록에는 이 코드그룹이 그대로 표시됩니다.',
    );
    const warning = dialog.getByText('사용 중지 후에는 사용을 재개할 수 없습니다.');
    expect(description).toHaveAttribute('data-tone', 'info');
    expect(warning).toHaveAttribute('data-tone', 'warning');
    expect(
      question.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      description.compareDocumentPosition(warning) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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
    /* 결재선 정의의 사용 전환 창과 같다 — 나가는 중에는 취소로도 빠지지 않는다. */
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: '취소' })).toBeDisabled();
  });

  /* 결재선 정의의 확인 창과 같은 모양 — 닫기(X) 없이 바닥 단추 둘로만 나간다(사용자 지시 2026-11-25). */
  /* 사용자 지시 2026-11-26 — 빨간색은 [사용 중지]만. [취소]는 앱의 중립 outlined 단추 모양이다. */
  it('[취소]는 중립색 단추이고 [사용 중지]는 기본 단추다', () => {
    renderDialog();

    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByRole('button', { name: '취소' })).toHaveClass('app-button-neutral');
    expect(dialog.getByRole('button', { name: '사용 중지' })).not.toHaveClass('app-button-neutral');
  });

  it('창 머리에 닫기(X)가 없다', () => {
    renderDialog();

    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.queryByRole('button', { name: '닫기' })).not.toBeInTheDocument();
    expect(dialog.getAllByRole('button').map((button) => button.textContent)).toEqual([
      '취소',
      '사용 중지',
    ]);
  });

  it('실패 배너를 창 안에 담는다 — 닫지 않고 이유를 보여야 다시 시도할 수 있다', () => {
    renderDialog({ banner: <p>중지하지 못했습니다</p> });

    expect(within(screen.getByRole('dialog')).getByText('중지하지 못했습니다')).toBeInTheDocument();
  });
});
