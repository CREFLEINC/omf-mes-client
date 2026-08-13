import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { requestFixtures } from './fixtures';
import { RejectDialog } from './reject-dialog';
import { toDecisionSubject, type ApprovalRequest } from './types';

const t = messages.iqcSkipApproval;

const [multiline] = requestFixtures;
const SUBJECT = toDecisionSubject(multiline as ApprovalRequest);
const COMMENT = '합성 반려 사유';

const renderDialog = (
  overrides: Partial<Parameters<typeof RejectDialog>[0]> = {},
): { onClose: () => void; onConfirm: () => void; user: ReturnType<typeof userEvent.setup> } => {
  const onClose = vi.fn();
  const onConfirm = vi.fn();

  render(
    <RejectDialog
      subject={SUBJECT}
      comment={COMMENT}
      isSaving={false}
      onClose={onClose}
      onConfirm={onConfirm}
      {...overrides}
    />,
  );

  return { onClose, onConfirm, user: userEvent.setup() };
};

const dialog = (): HTMLElement => screen.getByRole('dialog');

describe('RejectDialog', () => {
  /** 승인 창과 **같은 요약**을 보인다 — 무엇을 결재하는지는 어느 쪽이든 같은 물음이다. */
  it('대상 요약 다섯 값을 창에서 다시 보인다', () => {
    renderDialog();

    const summary = within(dialog()).getByRole('group', { name: t.panes.decisionSubject });

    expect(within(summary).getByText(SUBJECT.approvalRequestNo)).toBeVisible();
    expect(within(summary).getByText(SUBJECT.approvalTypeCode)).toBeVisible();
    expect(within(summary).getByText(SUBJECT.targetName)).toBeVisible();
    expect(within(summary).getByText(SUBJECT.requesterName)).toBeVisible();
    expect(within(summary).getByText(SUBJECT.reasonFirstLine)).toBeVisible();
  });

  /**
   * **반려는 의견이 필수다** — 「없음」 갈래가 아예 없다. 그 차이가 창을 승인 쪽과 가른 이유다.
   */
  it('적어 둔 의견을 보낼 값 그대로 보이고 기록에 남는다고 적는다', () => {
    renderDialog();

    expect(within(dialog()).getByText(t.dialog.commentHeading)).toBeInTheDocument();
    expect(within(dialog()).getByText(COMMENT)).toBeInTheDocument();
    expect(within(dialog()).getByText(t.dialog.commentRecorded)).toBeInTheDocument();
  });

  it('의견 없음 갈래를 두지 않는다', () => {
    renderDialog();

    expect(within(dialog()).queryByText(t.dialog.noComment)).toBeNull();
  });

  it('되돌릴 수 없고 번복은 새 요청이라고 적는다', () => {
    renderDialog();

    expect(within(dialog()).getByText(t.dialog.irreversible)).toBeInTheDocument();
  });

  it('창 안에 입력칸이 없다', () => {
    renderDialog();

    expect(within(dialog()).queryByRole('textbox')).toBeNull();
  });

  /** `omf-mes#45` — 창 본문이 펼침 목록을 자르는 결함이 걸릴 자리를 만들지 않는다. */
  it('창 안에 선택칸이 없다', () => {
    renderDialog();

    expect(within(dialog()).queryAllByRole('combobox')).toHaveLength(0);
  });

  it('머리에 닫기 손잡이가 없다', () => {
    renderDialog();

    expect(within(dialog()).queryByRole('button', { name: messages.common.close })).toBeNull();
    expect(within(dialog()).getAllByRole('button')).toHaveLength(2);
  });

  it('스크림을 눌러도 닫히지 않는다', () => {
    const { onClose } = renderDialog();

    fireEvent.click(dialog());

    expect(onClose).not.toHaveBeenCalled();
  });

  it('확인을 누르면 반려를 보낸다', async () => {
    const { onConfirm, user } = renderDialog();

    await user.click(within(dialog()).getByRole('button', { name: t.decision.reject }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('취소를 누르면 닫기를 요청한다', async () => {
    const { onClose, onConfirm, user } = renderDialog();

    await user.click(within(dialog()).getByRole('button', { name: messages.common.cancel }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('전송 중에는 확인과 취소가 모두 잠긴다', () => {
    renderDialog({ isSaving: true });

    expect(within(dialog()).getByRole('button', { name: t.decision.reject })).toBeDisabled();
    expect(within(dialog()).getByRole('button', { name: messages.common.cancel })).toBeDisabled();
  });

  it('내부 번호를 어디에도 내지 않는다', () => {
    renderDialog();

    const text = dialog().textContent ?? '';

    expect(text).not.toContain(String(multiline?.approvalRequestId));
    expect(text).not.toContain(String(multiline?.requestedBy));
    expect(text).not.toContain(String(multiline?.target.targetId));
  });
});
