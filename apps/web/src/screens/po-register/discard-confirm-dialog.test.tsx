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

  it('계속 입력은 닫기만 요청하고 버리지 않는다', async () => {
    const { onConfirm, onClose, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  /**
   * **버리기는 스스로 닫지 않는다**(전례 `goods-receipt`와 같은 축).
   *
   * 닫는 것은 화면 몫이다 — 창이 스스로 닫으면 화면이 버리기를 끝내기 전에 사라지고, 그때
   * 실패하거나 되돌릴 일이 생겨도 사용자에게 말할 자리가 없다. 두 버튼을 한 시험에 합치면
   * 앞선 클릭이 이미 `onClose`를 불러 이 단언을 세울 수 없다.
   */
  it('버리기는 확정만 올리고 스스로 닫지 않는다', async () => {
    const { onConfirm, onClose, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: t.actions.discardDraft }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('DiscardConfirmDialog — 닫히는 것이 곧 버리는 것은 아니다', () => {
  /**
   * **스크림 클릭을 막지 않는다**(계획 결정 15 개정 — 전례 우선 판정 · 사본 체크리스트 5번).
   *
   * 이 저장소의 버리기 창 **여섯이 모두** 스크림을 열어 두고, **그중 넷이** 「닫힘 = 버리지 않음」을
   * 짝 감지기로 고정한다(실측 — `disposal-issue`·`over-receipt-split`에는 그 감지기가 없다).
   * 그 규율을 일곱 번째 화면에서 뒤집으면 규칙이 「막는다」로 굳어, 정작 **되돌릴 수 없는 창을
   * 막는 이유**(등록 확인 창)와 구분되지 않는다.
   *
   * 앞 회차의 「스크림을 눌러도 닫히지 않는다」를 **지우지 않고 이 감지기로 다시 썼다** —
   * 재는 자리는 같고 기대하는 사실이 바뀌었다: 닫히기는 하되 **아무것도 버리지 않는다.**
   */
  it('스크림을 누르면 닫히고 버리지는 않는다', () => {
    const { onClose, onConfirm } = renderDialog();

    fireEvent.click(dialog());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  /**
   * **X 손잡이도 스크림과 같은 짝이다**(전례 우선 판정의 연장).
   *
   * 나가는 길을 반쪽만 전례에 맞추면 규율이 어느 쪽인지 다시 알 수 없게 된다 — X도 스크림도
   * 「계속 입력」과 같은 뜻이고, 앞 회차의 「닫기 손잡이가 없다」를 **지우지 않고 이 감지기로
   * 다시 썼다**: 손잡이는 있고, 눌러도 **버리지는 않는다.**
   */
  it('X를 누르면 닫히고 버리지는 않는다', async () => {
    const { onClose, onConfirm, user } = renderDialog();

    const close = within(dialog()).getByRole('button', { name: messages.common.close });

    await user.click(close);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  /**
   * 창 안에 선택칸을 두지 않는다(`omf-mes#45`) — 문장 하나와 버튼 둘뿐이다.
   *
   * **짝 양성이 함께 선다**(사본 체크리스트 9번 · 전례 `goods-receipt`와 같은 형태) — 창이
   * 통째로 그려지지 않아도 음성 단언만으로는 통과한다.
   */
  it('창 안에 선택칸이 없다', () => {
    renderDialog();

    expect(dialog()).toBeInTheDocument();
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
  });
});
