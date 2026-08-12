import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DiscardConfirmDialog } from './discard-confirm-dialog';

const t = messages.approvalRoute;

describe('DiscardConfirmDialog', () => {
  it('무엇을 잃는지 묻는다', () => {
    render(<DiscardConfirmDialog onConfirm={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText(messages.common.discardChangesConfirm)).toBeInTheDocument();
  });

  /** 「확인/취소」로 두면 어느 쪽이 파기인지 창을 다시 읽어야 안다. */
  it('두 버튼이 각각 무엇을 하는지 이름으로 밝힌다', () => {
    render(<DiscardConfirmDialog onConfirm={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: t.actions.discardDraft })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.keepEditing })).toBeInTheDocument();
  });

  it('파기를 누르면 확인이 올라간다', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(<DiscardConfirmDialog onConfirm={onConfirm} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: t.actions.discardDraft }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('계속 편집을 누르면 닫기만 한다', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(<DiscardConfirmDialog onConfirm={onConfirm} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  /** #45 — 창 본문이 펼침 목록을 자른다. 걸릴 자리를 만들지 않는 것으로 피한다. */
  it('선택칸이 없다', () => {
    render(<DiscardConfirmDialog onConfirm={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText(messages.common.discardChangesConfirm)).toBeInTheDocument();
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
  });
});
