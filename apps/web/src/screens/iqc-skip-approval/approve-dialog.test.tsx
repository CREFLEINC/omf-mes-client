import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApproveDialog } from './approve-dialog';
import { requestFixtures } from './fixtures';
import { toDecisionSubject, type ApprovalRequest } from './types';

const t = messages.iqcSkipApproval;

const [multiline] = requestFixtures;
const SUBJECT = toDecisionSubject(multiline as ApprovalRequest);

const renderDialog = (
  overrides: Partial<Parameters<typeof ApproveDialog>[0]> = {},
): { onClose: () => void; onConfirm: () => void; user: ReturnType<typeof userEvent.setup> } => {
  const onClose = vi.fn();
  const onConfirm = vi.fn();

  render(
    <ApproveDialog
      subject={SUBJECT}
      comment={undefined}
      isSaving={false}
      onClose={onClose}
      onConfirm={onConfirm}
      {...overrides}
    />,
  );

  return { onClose, onConfirm, user: userEvent.setup() };
};

const dialog = (): HTMLElement => screen.getByRole('dialog');

describe('ApproveDialog', () => {
  /**
   * **오결재 방어의 마지막 자리**(계획 §13-2 셋째 방어 · M60).
   *
   * 다섯 값을 **하나씩** 잰다 — 「요약이 있다」만 재면 값 하나가 빠져도 통과하고, 빠지는 값이
   * 하필 유형이나 사유면 이 화면이 막으려는 오결재가 그대로 지나간다.
   */
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
   * **되돌릴 수 없다는 사실이 이 창의 존재 이유다.** 계약에 수정·취소 오퍼레이션이 없어
   * 잘못 누른 승인을 무를 길이 화면에도 서버에도 없다.
   */
  it('되돌릴 수 없고 번복은 새 요청이라고 적는다', () => {
    renderDialog();

    expect(within(dialog()).getByText(t.dialog.irreversible)).toBeInTheDocument();
  });

  /** 승인은 의견이 **선택**이다. 빈 칸을 내지 않고 무엇이 기록되지 않는지를 적는다. */
  it('의견이 없으면 그 사실을 적는다', () => {
    renderDialog({ comment: undefined });

    expect(within(dialog()).getByText(t.dialog.noComment)).toBeInTheDocument();
    expect(within(dialog()).queryByText(t.dialog.commentHeading)).toBeNull();
  });

  /** 짝 방향 — 「늘 없음 문구」로도 위가 통과하므로 차 있는 쪽을 함께 잰다. */
  it('의견이 있으면 보낼 값 그대로 보여 준다', () => {
    renderDialog({ comment: '합성 승인 의견' });

    expect(within(dialog()).getByText(t.dialog.commentHeading)).toBeInTheDocument();
    expect(within(dialog()).getByText('합성 승인 의견')).toBeInTheDocument();
    expect(within(dialog()).getByText(t.dialog.commentRecorded)).toBeInTheDocument();
    expect(within(dialog()).queryByText(t.dialog.noComment)).toBeNull();
  });

  /**
   * **입력받지 않는다** — 의견은 아래 구획에서 이미 적었다. 창에 입력칸을 두면 같은 값을
   * 두 곳에서 고칠 수 있게 되고, 어느 쪽이 나가는지가 흐려진다.
   */
  it('창 안에 입력칸이 없다', () => {
    renderDialog({ comment: '합성 승인 의견' });

    expect(within(dialog()).queryByRole('textbox')).toBeNull();
  });

  /**
   * **선택칸을 두지 않는다**(`omf-mes#45`) — 창 본문이 펼침 목록을 자르는 결함이 아직
   * 고쳐지지 않았다. 걸릴 자리를 만들지 않는 것으로 피한다.
   */
  it('창 안에 선택칸이 없다', () => {
    renderDialog();

    expect(within(dialog()).queryAllByRole('combobox')).toHaveLength(0);
  });

  /**
   * **나가는 길을 바닥 버튼 둘로 좁힌다.** X 손잡이는 진행 상태를 받지 않아 전송 중에도
   * 눌린다 — 한쪽 문만 잠그면 잠근 적이 없는 것과 같다.
   */
  it('머리에 닫기 손잡이가 없다', () => {
    renderDialog();

    expect(within(dialog()).queryByRole('button', { name: messages.common.close })).toBeNull();
    expect(within(dialog()).getAllByRole('button')).toHaveLength(2);
  });

  /**
   * **나가는 길의 나머지 반쪽.** X 손잡이만 잠그고 스크림을 열어 두면 잠근 적이 없는 것과 같다.
   *
   * 디자인 시스템은 스크림 클릭을 **`<dialog>` 자신이 클릭 대상일 때**로 판정한다(패널은 그 안의
   * 자식이다). 그래서 창 요소를 직접 눌러 그 길을 잰다.
   */
  it('스크림을 눌러도 닫히지 않는다', () => {
    const { onClose } = renderDialog();

    fireEvent.click(dialog());

    expect(onClose).not.toHaveBeenCalled();
  });

  it('확인을 누르면 승인을 보낸다', async () => {
    const { onConfirm, user } = renderDialog();

    await user.click(within(dialog()).getByRole('button', { name: t.decision.approve }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('취소를 누르면 닫기를 요청한다', async () => {
    const { onClose, onConfirm, user } = renderDialog();

    await user.click(within(dialog()).getByRole('button', { name: messages.common.cancel }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  /** 전송 중에는 **양쪽 다** 잠긴다 — 확인만 잠그면 취소로 창을 없애 진행을 감출 수 있다. */
  it('전송 중에는 확인과 취소가 모두 잠긴다', () => {
    renderDialog({ isSaving: true });

    expect(within(dialog()).getByRole('button', { name: t.decision.approve })).toBeDisabled();
    expect(within(dialog()).getByRole('button', { name: messages.common.cancel })).toBeDisabled();
  });

  /**
   * **내부 번호가 창에도 없다.** 요약이 그 값을 나르지 않으므로 꺼낼 것 자체가 없지만,
   * 창은 사용자가 마지막으로 읽는 자리라 그 사실을 여기서도 못 박는다(`omf-mes#44`).
   */
  it('내부 번호를 어디에도 내지 않는다', () => {
    renderDialog({ comment: '합성 승인 의견' });

    const text = dialog().textContent ?? '';

    expect(text).not.toContain(String(multiline?.approvalRequestId));
    expect(text).not.toContain(String(multiline?.requestedBy));
    expect(text).not.toContain(String(multiline?.target.targetId));
  });
});
