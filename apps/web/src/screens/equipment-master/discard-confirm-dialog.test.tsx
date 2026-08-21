import { ToastProvider } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DiscardConfirmDialog } from './discard-confirm-dialog';

const t = messages.equipmentMaster;

const renderDialog = () => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  render(
    <ToastProvider>
      <DiscardConfirmDialog onConfirm={onConfirm} onClose={onClose} />
    </ToastProvider>,
  );

  return { onConfirm, onClose };
};

describe('DiscardConfirmDialog', () => {
  it('무엇이 일어나는지 먼저 밝힌다', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: t.dialog.discardTitle })).toBeInTheDocument();
    expect(screen.getByText(messages.common.discardChangesConfirm)).toBeInTheDocument();
  });

  /* 「확인/취소」로 두면 무엇을 누르는지 창을 다시 읽어야 한다. */
  it('버튼 문구가 곧 그 버튼이 하는 일이다', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: t.actions.keepEditing })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.discardChanges })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.confirm })).toBeNull();
  });

  it('버리기는 파기를, 계속 편집은 닫기를 부른다', async () => {
    const user = userEvent.setup();
    const { onConfirm, onClose } = renderDialog();

    await user.click(screen.getByRole('button', { name: t.actions.discardChanges }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  /*
   * **스크림 클릭으로 닫히는 것을 막지 않는다** — 실수로 닫혀도 입력이 그대로 남아 잃는 것이
   * 없다. 되돌릴 수 없는 실행 확인 창과 갈리는 자리다. 닫아도 **버리지 않는다**까지 함께 본다.
   */
  it('스크림을 누르면 닫히고 버리지는 않는다', () => {
    const { onConfirm, onClose } = renderDialog();

    fireEvent.click(screen.getByRole('dialog'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  /* 창 본문이 선택 목록을 자르는 결함이 남아 있어, 걸릴 자리를 만들지 않는다. */
  it('창 안에 선택칸을 두지 않는다', () => {
    renderDialog();

    expect(screen.queryByRole('combobox')).toBeNull();
  });
});
