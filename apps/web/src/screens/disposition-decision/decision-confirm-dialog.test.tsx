import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { DecisionConfirmDialog } from './decision-confirm-dialog';

/** #352 판정 확인 팝업 — 결재 없이 저장하면 바로 반영된다. 값은 지어낸 것이다. */
const t = messages.dispositionDecision;

const renderDialog = () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  renderWithProviders(
    <DecisionConfirmDialog
      rows={[{ label: t.confirm.reason, value: '합성 사유' }]}
      isSaving={false}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
    {
      fetch: async () => {
        throw new Error('팝업은 서버를 부르지 않는다');
      },
    },
  );
  return { onConfirm, onCancel, user: userEvent.setup() };
};

describe('판정 확인 팝업(#352)', () => {
  it('저장할 내용과 「바로 반영」 안내를 보이고, [판정 저장]을 누르면 저장한다', async () => {
    const { onConfirm, user } = renderDialog();

    expect(screen.getByText(t.confirm.title)).toBeInTheDocument();
    expect(screen.getByText(t.confirm.direct)).toBeInTheDocument();
    expect(screen.getByText('합성 사유')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.confirm.save }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('취소는 저장하지 않고 닫는다', async () => {
    const { onConfirm, onCancel, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: messages.common.cancel }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
