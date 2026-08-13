import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DiscardConfirmDialog } from './discard-confirm-dialog';

const t = messages.disposalIssue;

describe('DiscardConfirmDialog', () => {
  it('버릴 것을 묻고 두 버튼이 무엇을 하는지 말한다', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<DiscardConfirmDialog onConfirm={onConfirm} onClose={onClose} />);

    expect(screen.getByText(messages.common.discardChangesConfirm)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.confirmDiscard }));

    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  /**
   * **스크림 클릭으로 닫히는 것을 막지 않는다** — 실수로 닫혀도 초안이 그대로 남아 잃는 것이
   * 없다. 되돌릴 수 없는 상신 확인 창과 갈리는 자리이며, X 손잡이도 그래서 남는다.
   */
  it('상신 확인 창과 달리 X 손잡이가 있다', () => {
    render(<DiscardConfirmDialog onConfirm={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: messages.common.close })).toBeInTheDocument();
  });
});
