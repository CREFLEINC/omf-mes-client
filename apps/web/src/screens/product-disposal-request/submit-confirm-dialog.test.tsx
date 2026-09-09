import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SubmitConfirmDialog } from './submit-confirm-dialog';

const t = messages.productDisposalRequest.confirm;

const open = (over: Partial<Parameters<typeof SubmitConfirmDialog>[0]> = {}) => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  render(
    <SubmitConfirmDialog
      count={2}
      qtyText="160"
      onConfirm={onConfirm}
      onClose={onClose}
      {...over}
    />,
  );

  return { onConfirm, onClose, user: userEvent.setup() };
};

describe('SubmitConfirmDialog — 되돌릴 수 없는 쓰기 앞의 한 겹', () => {
  /** ⭐ 무엇이 얼마나 나가는지 보인다 — 합계만 있고 건수가 없으면 무엇을 확인하는지 모른다. */
  it('건수와 합계를 보인다', () => {
    open();

    expect(screen.getByText(t.target(2, '160'))).toBeInTheDocument();
  });

  /** ⛔ 되돌릴 수 없다는 사실을 «누르기 전»에 적는다. */
  it('철회할 길이 없다는 사실을 적는다', () => {
    open();

    expect(screen.getByText(t.irreversible)).toBeInTheDocument();
  });

  it('확인을 누르면 보낸다', async () => {
    const { onConfirm, onClose, user } = open();

    await user.click(screen.getByRole('button', { name: t.submit }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });

  /** ⛔ 취소는 «보내지 않는다» — 창만 닫힌 척하고 나가면 되돌릴 수 없다. */
  it('취소를 누르면 보내지 않는다', async () => {
    const { onConfirm, onClose, user } = open();

    await user.click(screen.getByRole('button', { name: t.cancel }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  /**
   * ⚠ **단위가 섞이면 합계가 성립하지 않는다.** 그때 오는 `—` 를 그대로 보인다 —
   * 뜻 없는 수를 보이면 사용자가 그 수를 보고 폐기를 결정한다.
   */
  it('합계를 셀 수 없으면 그대로 보인다', () => {
    open({ qtyText: '—' });

    expect(screen.getByText(t.target(2, '—'))).toBeInTheDocument();
  });
});
