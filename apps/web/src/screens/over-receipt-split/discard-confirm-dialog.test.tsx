import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DiscardConfirmDialog } from './discard-confirm-dialog';

const t = messages.overReceiptSplit;

const renderDialog = (): {
  onConfirm: ReturnType<typeof vi.fn>;
  onClose: ReturnType<typeof vi.fn>;
  user: ReturnType<typeof userEvent.setup>;
} => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  render(<DiscardConfirmDialog onConfirm={onConfirm} onClose={onClose} />);

  return { onConfirm, onClose, user: userEvent.setup() };
};

describe('DiscardConfirmDialog', () => {
  it('무엇을 버리는지 제목과 본문이 함께 밝힌다', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: t.dialog.discardTitle })).toBeInTheDocument();
    expect(screen.getByText(messages.common.discardChangesConfirm)).toBeInTheDocument();
  });

  /*
   * **M36** — #45(창 본문이 선택 목록을 자른다 · DS `design-system-v2-webui#68`)가
   * **걸릴 자리를 만들지 않는다.** 고칠 수 없는 결함은 피해 가는 것이 이번 처리다.
   * 확인 창에 선택칸을 들이는 변경이 여기서 잡힌다.
   */
  it('창 안에 선택칸이 없다', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog', { name: t.dialog.discardTitle });

    /* 짝 방향 — 창이 실제로 그려졌다(빈 창을 통과시키지 않는다). */
    expect(within(dialog).getByText(messages.common.discardChangesConfirm)).toBeInTheDocument();
    expect(within(dialog).queryAllByRole('combobox')).toHaveLength(0);
    expect(within(dialog).queryAllByRole('listbox')).toHaveLength(0);
  });

  /* 버튼 문구가 「확인/취소」가 아니다 — 무엇이 확인되는지 창을 다시 읽어야 하면 잘못 누른다. */
  it('두 버튼이 각각 무엇을 하는지 문구로 밝힌다', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: t.actions.discardDraft })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.keepEditing })).toBeInTheDocument();
  });

  it('버리기를 누르면 확인을 올린다', async () => {
    const { onConfirm, onClose, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: t.actions.discardDraft }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('계속 입력을 누르면 닫기만 한다', async () => {
    const { onConfirm, onClose, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
