import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DiscardConfirmDialog } from './discard-confirm-dialog';

const t = messages.stockAdjust;

const renderDialog = (isSaving = false) => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  render(<DiscardConfirmDialog isSaving={isSaving} onConfirm={onConfirm} onClose={onClose} />);

  return { onConfirm, onClose, user: userEvent.setup() };
};

const dialog = (): HTMLElement => screen.getByRole('dialog');

describe('DiscardConfirmDialog — 무엇을 잃는가', () => {
  /** 「버릴까요?」만으로는 어디까지 사라지는지 알 수 없다 — 무엇이 사라지고 무엇이 남는지 적는다. */
  it('줄과 고른 사유가 사라지고 실사 차이는 다시 부를 수 있다는 사실을 적는다', () => {
    renderDialog();

    expect(screen.getByText(t.dialog.discardLead)).toBeVisible();
  });

  it('계속 입력은 닫기만 요청하고 버리지 않는다', async () => {
    const { onConfirm, onClose, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  /**
   * **버리기는 스스로 닫지 않는다**(전례 `goods-receipt`·`po-register`와 같은 축).
   *
   * 닫는 것은 화면 몫이다 — 창이 스스로 닫으면 화면이 버리기를 끝내기 전에 사라진다.
   */
  it('초안을 버립니다는 확정만 올리고 스스로 닫지 않는다', async () => {
    const { onConfirm, onClose, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: t.actions.confirmDiscard }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  /**
   * ⭐ **보내는 중에도 버릴 수 있다** — 그러나 **보낸 것은 되돌아가지 않는다.**
   *
   * 이 창은 화면의 초안을 비우는 조작이지 서버에 간 요청을 취소하는 조작이 아니다. 그 사실을
   * 적지 않으면 사용자가 이 창으로 등록이 취소된 줄 알고, 실제로는 전표가 만들어진다.
   */
  it('보내는 중이면 등록이 되돌아가지 않는다는 사실을 함께 적는다', () => {
    renderDialog(true);

    expect(screen.getByText(t.dialog.discardWhileSaving)).toBeVisible();
  });

  /** 짝 방향 — 나가는 요청이 없으면 그 문장이 없다. 「늘 적는다」로 통과하지 않게 한다. */
  it('보내는 중이 아니면 그 문장이 없다', () => {
    renderDialog();

    expect(screen.getByText(t.dialog.discardLead)).toBeVisible();
    expect(screen.queryByText(t.dialog.discardWhileSaving)).not.toBeInTheDocument();
  });
});

describe('DiscardConfirmDialog — 닫히는 것이 곧 버리는 것은 아니다', () => {
  /**
   * **스크림 클릭을 막지 않는다**(D-17 · 사본 체크리스트 5번 · 전례 우선 판정).
   *
   * 실수로 닫혀도 **아무것도 버리지 않는다**: 친 값과 세운 줄이 그대로 남아 잃는 것이 없다.
   * 이 저장소의 버리기 창이 모두 두 prop을 지정하지 않아 같은 형태이고, 그 규율을 여기서
   * 뒤집으면 규칙이 「막는다」로 굳어 **되돌릴 수 없는 창을 막는 이유**(등록 확인 창)와
   * 구분되지 않는다.
   */
  it('스크림을 누르면 닫히고 버리지는 않는다', () => {
    const { onClose, onConfirm } = renderDialog();

    fireEvent.click(dialog());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  /** **X 손잡이도 같은 짝이다** — 나가는 길을 반쪽만 전례에 맞추면 규율이 어느 쪽인지 알 수 없다. */
  it('X를 누르면 닫히고 버리지는 않는다', async () => {
    const { onClose, onConfirm, user } = renderDialog();

    const close = within(dialog()).getByRole('button', { name: messages.common.close });

    await user.click(close);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  /**
   * 창 안에 선택칸을 두지 않는다(`omf-mes#45`).
   *
   * **짝 양성이 함께 선다**(사본 체크리스트 9번) — 창이 통째로 그려지지 않아도 음성 단언만으로는
   * 통과한다.
   */
  it('창 안에 선택칸이 없다', () => {
    renderDialog();

    expect(dialog()).toBeInTheDocument();
    expect(within(dialog()).queryAllByRole('combobox')).toHaveLength(0);
  });
});
