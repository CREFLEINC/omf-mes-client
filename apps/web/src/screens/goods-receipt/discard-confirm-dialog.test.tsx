import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DiscardConfirmDialog } from './discard-confirm-dialog';

const t = messages.goodsReceipt;

const renderDialog = () => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  render(<DiscardConfirmDialog onConfirm={onConfirm} onClose={onClose} />);

  return { onConfirm, onClose, user: userEvent.setup() };
};

describe('DiscardConfirmDialog', () => {
  it('무엇을 잃는지 밝힌다', () => {
    renderDialog();

    expect(screen.getByText(messages.common.discardChangesConfirm)).toBeInTheDocument();
  });

  /* 「확인/취소」가 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다. */
  it('두 버튼이 무엇을 하는지 이름으로 말한다', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: t.actions.keepEditing })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.discardDraft })).toBeInTheDocument();
  });

  /* **M31** — 창 본문이 선택 목록을 자르는 결함(#45)에 걸릴 자리를 만들지 않는다. */
  it('창 안에 선택칸이 없다', () => {
    renderDialog();

    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    /* 짝 방향 — 창은 실제로 그려져 있다. */
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('버리기를 누르면 그때 버린다', async () => {
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
