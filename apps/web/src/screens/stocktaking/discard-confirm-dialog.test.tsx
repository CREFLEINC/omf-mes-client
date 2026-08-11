import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DiscardConfirmDialog } from './discard-confirm-dialog';

const t = messages.stocktaking;

const renderDialog = () => {
  const onConfirm = vi.fn<() => void>();
  const onClose = vi.fn<() => void>();

  render(<DiscardConfirmDialog onConfirm={onConfirm} onClose={onClose} />);

  return { onConfirm, onClose, user: userEvent.setup() };
};

const dialog = (): HTMLElement => screen.getByRole('dialog');

describe('DiscardConfirmDialog — 초안 파기 확인', () => {
  it('무엇을 잃는지 밝힌다', () => {
    renderDialog();

    expect(within(dialog()).getByText(messages.common.discardChangesConfirm)).toBeInTheDocument();
  });

  /*
   * **M29 · C25** — 창 안에 선택칸을 두지 않는다(#45 · DS `design-system-v2-webui#68`).
   * 이 창에 필요한 것은 문장 하나와 버튼 둘뿐이라 걸릴 자리를 만들 이유가 없다.
   */
  it('창 안에 선택칸이 없다', () => {
    renderDialog();

    /* 짝 방향 — 창이 실제로 그려졌다. */
    expect(within(dialog()).getByText(messages.common.discardChangesConfirm)).toBeInTheDocument();
    expect(within(dialog()).queryAllByRole('combobox')).toHaveLength(0);
    expect(within(dialog()).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(dialog()).queryAllByRole('checkbox')).toHaveLength(0);
  });

  /* 문구가 「확인/취소」가 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다. */
  it('두 버튼이 무엇을 하는지 이름으로 밝힌다', async () => {
    const { onConfirm, onClose, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: t.actions.discardDraft }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
