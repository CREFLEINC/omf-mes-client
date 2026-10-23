import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RegisterActions, type RegisterActionsProps } from './register-actions';

const t = messages.overReceiptSplit;

const renderActions = (overrides: Partial<RegisterActionsProps> = {}) => {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();

  render(
    <RegisterActions
      blockReason={null}
      isSaving={false}
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...overrides}
    />,
  );

  return { onSubmit, onCancel, user: userEvent.setup() };
};

const button = (name: string): HTMLElement => screen.getByRole('button', { name });

describe('RegisterActions — 등록 단추 하나와 취소', () => {
  it('단추가 둘뿐이다 — 갈래 단추를 두지 않는다', () => {
    renderActions();

    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(button(t.actions.register)).toBeInTheDocument();
    expect(button(messages.common.cancel)).toBeInTheDocument();
  });

  it('누르면 등록을 부른다', async () => {
    const { onSubmit, user } = renderActions();

    await user.click(button(t.actions.register));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('취소는 등록을 부르지 않는다', async () => {
    const { onSubmit, onCancel, user } = renderActions();

    await user.click(button(messages.common.cancel));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('사유가 있으면 잠기고 그 사유가 단추에 이어진다', async () => {
    const { onSubmit, user } = renderActions({ blockReason: t.actionReasons.noQty });

    const target = button(t.actions.register);

    expect(target).toBeDisabled();
    expect(screen.getByText(t.actionReasons.noQty)).toBeInTheDocument();
    expect(target.getAttribute('aria-describedby')).not.toBeNull();

    await user.click(target);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('전송 중에는 둘 다 잠긴다', () => {
    renderActions({ isSaving: true });

    expect(button(t.actions.register)).toBeDisabled();
    expect(button(messages.common.cancel)).toBeDisabled();
  });
});
