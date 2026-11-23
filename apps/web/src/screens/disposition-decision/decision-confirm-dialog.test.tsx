import { messages } from '@omf-mes/i18n';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { jsonResponse, renderWithProviders } from '../../test/api-harness';
import { DecisionConfirmDialog } from './decision-confirm-dialog';

/** #352 판정 확인 팝업 — 결재선이 있으면 결재자 · 결재 요청, 없으면 바로 반영. 값은 지어낸 것이다. */
const t = messages.dispositionDecision;

const ROUTED = [
  {
    approvalTypeCode: 'DISPOSITION',
    hasRoute: true,
    steps: [{ stepNo: 1, approverName: '합성 결재자' }],
  },
  { approvalTypeCode: 'CONCESSION', hasRoute: false, steps: [] },
];

const renderDialog = (code: string, items: unknown[] | 'fail' = ROUTED) => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  renderWithProviders(
    <DecisionConfirmDialog
      dispositionTypeCode={code}
      rows={[{ label: t.confirm.reason, value: '합성 사유' }]}
      isSaving={false}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
    {
      fetch: async () =>
        items === 'fail' ? jsonResponse({ message: '' }, { status: 500 }) : jsonResponse({ items }),
    },
  );
  return { onConfirm, onCancel, user: userEvent.setup() };
};

describe('판정 확인 팝업(#352)', () => {
  it('결재선이 있으면 결재자와 결재 요청 안내를 보이고, 확인을 누르면 저장한다', async () => {
    const { onConfirm, user } = renderDialog('SCRAP');

    expect(await screen.findByText(t.confirm.routed(t.approval.apply))).toBeInTheDocument();
    expect(screen.getByText(t.confirm.approverStep(1, '합성 결재자'))).toBeInTheDocument();
    expect(screen.getByText('합성 사유')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.confirm.ok }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('결재선이 없으면 바로 반영된다고 알리고 결재자 칸은 두지 않는다', async () => {
    renderDialog('CONCESSION');

    expect(await screen.findByText(t.confirm.direct)).toBeInTheDocument();
    expect(screen.queryByText(t.confirm.approvers)).toBeNull();
  });

  it('결재선을 확인하지 못하면 확인을 잠근다 — 무엇이 일어날지 모른 채 저장하지 않는다', async () => {
    renderDialog('SCRAP', 'fail');

    expect(await screen.findByText(t.confirm.loadFailed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.confirm.ok })).toBeDisabled();
  });

  it('취소는 저장하지 않고 닫는다', async () => {
    const { onConfirm, onCancel, user } = renderDialog('SCRAP');
    await waitFor(() => expect(screen.getByRole('button', { name: t.confirm.ok })).toBeEnabled());

    await user.click(screen.getByRole('button', { name: messages.common.cancel }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
