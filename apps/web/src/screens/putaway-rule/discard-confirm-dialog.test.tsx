import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DiscardConfirmDialog } from './discard-confirm-dialog';

const t = messages.putawayRule;

const renderDialog = () => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  render(<DiscardConfirmDialog onConfirm={onConfirm} onClose={onClose} />);

  return { onConfirm, onClose, user: userEvent.setup() };
};

describe('DiscardConfirmDialog', () => {
  it('무엇이 사라지는지 말한다', () => {
    renderDialog();

    expect(screen.getByText(t.dialog.discardBody)).toBeInTheDocument();
  });

  /** 문구가 「확인/취소」가 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다. */
  it('버튼 이름이 무엇을 하는지 말한다', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: t.actions.keepEditing })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.discardDraft })).toBeInTheDocument();
  });

  it('버리기를 누르면 파기한다', async () => {
    const { onConfirm, onClose, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: t.actions.discardDraft }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('계속 편집을 누르면 창만 닫는다', async () => {
    const { onConfirm, onClose, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  /**
   * **창 안에 선택칸을 두지 않는다**(`design-system-v2-webui#68`) — 창 본문이 펼침 목록을
   * 잘라 무엇을 고르는지 읽을 수 없다. 여기 필요한 것은 문장 하나와 버튼 둘뿐이다.
   */
  it('창 안에 선택칸을 두지 않는다', () => {
    renderDialog();

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  /**
   * **Escape는 막을 수 없다** — native `<dialog>`가 `cancel`을 내고 디자인 시스템이 그것을
   * 닫기 요청으로 무조건 잇는다. 여기서는 그것이 옳다: 실수로 닫혀도 초안이 그대로 남아
   * 잃는 것이 없다. **파기로 이어지지 않는다**는 사실을 함께 잰다.
   */
  it('Escape는 닫기 요청으로 이어지고 파기로 이어지지 않는다', () => {
    const { onConfirm, onClose } = renderDialog();

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  /**
   * **스크림 클릭으로 닫히는 것을 막지 않는다.** 초안이 그대로 남아 잃는 것이 없다 —
   * 되돌리기에 다른 사람의 업무가 걸린 확인 창(끄기·켜기)과 정확히 반대 자리다.
   */
  it('스크림을 눌러도 파기로 이어지지 않는다', () => {
    const { onConfirm } = renderDialog();

    fireEvent.click(screen.getByRole('dialog'));

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
