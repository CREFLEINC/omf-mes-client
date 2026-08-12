import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RejectDialog } from './reject-dialog';

const t = messages.approvalInbox;

const REQUEST_NO = 'SYNTH-REQ-001';
const COMMENT = '합성 반려 사유 — 근거를 붙여 다시 올려 주세요';

const renderDialog = (
  overrides: Partial<Parameters<typeof RejectDialog>[0]> = {},
): { onClose: () => void; onConfirm: () => void; user: ReturnType<typeof userEvent.setup> } => {
  const onClose = vi.fn();
  const onConfirm = vi.fn();

  render(
    <RejectDialog
      approvalRequestNo={REQUEST_NO}
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
  it('무엇을 반려하는지 업무 번호로 밝힌다', () => {
    renderDialog();

    expect(within(dialog()).getByText(t.dialog.subject(REQUEST_NO))).toBeInTheDocument();
  });

  it('되돌릴 수 없고 번복은 새 요청이라고 적는다', () => {
    renderDialog();

    expect(within(dialog()).getByText(t.dialog.irreversible)).toBeInTheDocument();
  });

  /** 반려는 의견이 **필수**다 — 「의견 없음」 갈래가 아예 없고, 적은 말이 그대로 남는다. */
  it('적어 둔 의견을 보낼 값 그대로 보여 준다', () => {
    renderDialog();

    expect(within(dialog()).getByText(t.dialog.commentHeading)).toBeInTheDocument();
    expect(within(dialog()).getByText(COMMENT)).toBeInTheDocument();
    expect(within(dialog()).getByText(t.dialog.commentRecorded)).toBeInTheDocument();
  });

  /** 승인 창과 갈라 둔 이유가 여기 있다 — 반려에는 「의견 없음」 갈래가 없다. */
  it('의견 없음 문구가 어느 경우에도 서지 않는다', () => {
    renderDialog();

    expect(within(dialog()).queryByText(t.dialog.noComment)).toBeNull();
  });

  it('창 안에 입력칸이 없다', () => {
    renderDialog();

    expect(within(dialog()).queryByRole('textbox')).toBeNull();
  });

  it('창 안에 선택칸이 없다', () => {
    renderDialog();

    expect(within(dialog()).queryAllByRole('combobox')).toHaveLength(0);
  });

  it('머리에 닫기 손잡이가 없다', () => {
    renderDialog();

    expect(within(dialog()).queryByRole('button', { name: messages.common.close })).toBeNull();
    expect(within(dialog()).getAllByRole('button')).toHaveLength(2);
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
});
