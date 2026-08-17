import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DiscardConfirmDialog } from './discard-confirm-dialog';

const t = messages.poRegister;

const renderDialog = () => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  render(<DiscardConfirmDialog onConfirm={onConfirm} onClose={onClose} />);

  return { onConfirm, onClose, user: userEvent.setup() };
};

const dialog = (): HTMLElement => screen.getByRole('dialog');

describe('DiscardConfirmDialog — 무엇을 잃는가', () => {
  /** **무엇이 사라지는지 적는다.** 「파기할까요?」만으로는 승계된 값까지 사라지는지 알 수 없다. */
  it('친 값이 사라지고 승계된 값으로 돌아간다는 사실을 적는다', () => {
    renderDialog();

    expect(screen.getByText(t.dialog.discardLead)).toBeVisible();
  });

  it('버리기와 계속 입력이 각각 자기 일을 한다', async () => {
    const { onConfirm, onClose, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: t.actions.discardDraft }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('DiscardConfirmDialog — 나가는 길이 바닥 버튼 둘뿐이다', () => {
  /**
   * **세 방어를 등록 확인 창과 같은 강도로 둔다**(계획 결정 15 · 사본 체크리스트 5번).
   *
   * 전례의 버리기 창들은 스크림 클릭을 열어 두었다(실수로 닫혀도 초안이 남으므로). 이 화면은
   * 계획이 세 창을 **함께** 막기로 정했고, 그 판단의 근거는 이 창의 「버리기」가 **승계된 라인
   * 1행까지 되세우는** 조작이라는 점이다 — 잃는 것이 친 글자만이 아니다. 스크림이 열려 있으면
   * 확인 창이 스치는 클릭에 닫히고, 사용자는 자기가 무엇을 취소했는지 알 수 없다.
   */
  it('닫기 손잡이가 없다', () => {
    renderDialog();

    expect(
      within(dialog()).queryByRole('button', { name: messages.common.close }),
    ).not.toBeInTheDocument();
    expect(within(dialog()).getAllByRole('button')).toHaveLength(2);
  });

  it('스크림을 눌러도 닫히지 않는다', () => {
    const { onClose, onConfirm } = renderDialog();

    fireEvent.click(dialog());

    expect(onClose).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  /** 창 안에 선택칸을 두지 않는다(`omf-mes#45`) — 문장 하나와 버튼 둘뿐이다. */
  it('창 안에 선택칸이 없다', () => {
    renderDialog();

    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
  });
});
