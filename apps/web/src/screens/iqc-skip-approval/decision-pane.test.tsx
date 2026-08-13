import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DecisionPane, type DecisionPaneProps } from './decision-pane';

const t = messages.iqcSkipApproval;

interface Handlers {
  onChangeComment: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
  user: ReturnType<typeof userEvent.setup>;
}

const renderPane = (overrides: Partial<DecisionPaneProps> = {}): Handlers => {
  const onChangeComment = vi.fn();
  const onApprove = vi.fn();
  const onReject = vi.fn();

  render(
    <DecisionPane
      isMyTurn
      comment=""
      onChangeComment={onChangeComment}
      isLocked={false}
      onApprove={onApprove}
      onReject={onReject}
      banner={null}
      {...overrides}
    />,
  );

  return { onChangeComment, onApprove, onReject, user: userEvent.setup() };
};

const approveButton = (): HTMLElement => screen.getByRole('button', { name: t.decision.approve });
const rejectButton = (): HTMLElement => screen.getByRole('button', { name: t.decision.reject });
const commentBox = (): HTMLElement => screen.getByLabelText(t.decision.commentLabel);
const outcomePane = (): HTMLElement => screen.getByRole('group', { name: t.panes.approvalOutcome });

/**
 * 결재 구획 — **되돌릴 수 없는 조작의 첫째 겹이 여기 있다.**
 *
 * 둘째 겹(보내는 자리의 재판정)과 셋째 겹(요청이 실제로 나갔는가)은 이 부품이 잴 수 없다 —
 * 화면 시험이 맡는다. 여기서 재는 것은 **컨트롤이 실제로 잠기는가와 왜 잠겼는지 말하는가**,
 * 그리고 **《승인 시 결과》가 어떤 상태에서도 서 있는가**다.
 */
describe('DecisionPane', () => {
  /**
   * 《승인 시 결과》 — 이 화면 고유의 구획이다.
   *
   * 화면 이름이 「한도승인」이라 승인이 곧 입고·검사 처리로 읽히기 쉬운데, 실제로 일어나는
   * 것은 요청 상태 변경 하나뿐이다. 세 문장이 서로 다른 오해를 하나씩 막으므로 **셋을 각각**
   * 잰다 — 「구획이 있다」만 재면 문장 하나가 빠져도 통과한다.
   */
  describe('《승인 시 결과》 구획', () => {
    it('버튼 위 상시 자리에 구획으로 서고 세 문장이 모두 보인다', () => {
      renderPane();

      const outcome = within(outcomePane());

      expect(outcome.getByText(t.decision.outcome.statusOnly)).toBeVisible();
      expect(outcome.getByText(t.decision.outcome.noErpDocument)).toBeVisible();
      expect(outcome.getByText(t.decision.outcome.inspectionPending)).toBeVisible();
    });

    /**
     * **버튼이 잠겨 있어도 보인다.** 승인이 무엇을 하고 무엇을 하지 않는지는 지금 누를 수
     * 있는지와 무관하게 참인 사실이다 — 잠긴 자리에서 감추면 「내 차례가 되면 입고까지 된다」로 읽힌다.
     */
    it('내 차례가 아니어도 세 문장이 사라지지 않는다', () => {
      renderPane({ isMyTurn: false });

      const outcome = within(outcomePane());

      expect(outcome.getByText(t.decision.outcome.statusOnly)).toBeVisible();
      expect(outcome.getByText(t.decision.outcome.noErpDocument)).toBeVisible();
      expect(outcome.getByText(t.decision.outcome.inspectionPending)).toBeVisible();
    });

    it('보내는 중에도 세 문장이 사라지지 않는다', () => {
      renderPane({ isLocked: true, comment: '합성 의견' });

      const outcome = within(outcomePane());

      expect(outcome.getByText(t.decision.outcome.statusOnly)).toBeVisible();
      expect(outcome.getByText(t.decision.outcome.noErpDocument)).toBeVisible();
      expect(outcome.getByText(t.decision.outcome.inspectionPending)).toBeVisible();
    });

    /**
     * **버튼보다 위다.** 아래에 두면 결재를 누른 사람이 그 문장을 읽는 시점이 이미 지난 뒤다.
     * 문서 차례로 잰다 — 시각 배치는 §11.2가 본다.
     */
    it('두 버튼보다 앞선다', () => {
      renderPane();

      expect(
        outcomePane().compareDocumentPosition(approveButton()) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        outcomePane().compareDocumentPosition(rejectButton()) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  describe('내 차례가 아닐 때 — 첫째 겹', () => {
    it('승인과 반려가 모두 잠기고 각자 사유가 붙는다', () => {
      renderPane({ isMyTurn: false, comment: '합성 의견' });

      expect(approveButton()).toBeDisabled();
      expect(rejectButton()).toBeDisabled();
      expect(approveButton()).toHaveAccessibleDescription(
        t.decision.blockedNotMyTurn(t.decision.approve),
      );
      expect(rejectButton()).toHaveAccessibleDescription(
        t.decision.blockedNotMyTurn(t.decision.reject),
      );
    });

    /** 보낼 수 없는 말을 적어 두는 자리가 아니다 — 입력칸도 함께 잠근다. */
    it('의견 입력칸이 잠기고 그 이유가 보인다', () => {
      renderPane({ isMyTurn: false });

      expect(commentBox()).toBeDisabled();
      expect(screen.getByText(t.decision.commentDisabledReason)).toBeVisible();
    });

    /** 잠긴 버튼은 눌러도 아무 일이 없어야 한다 — 첫째 겹이 실제로 막는지 잰다. */
    it('눌러도 창을 열지 않는다', async () => {
      const { onApprove, onReject, user } = renderPane({ isMyTurn: false, comment: '합성 의견' });

      await user.click(approveButton());
      await user.click(rejectButton());

      expect(onApprove).not.toHaveBeenCalled();
      expect(onReject).not.toHaveBeenCalled();
    });
  });

  describe('내 차례일 때', () => {
    /** 짝 방향 — 「늘 잠긴다」로도 위 묶음이 통과하므로 열리는 쪽을 함께 잰다. */
    it('승인은 의견이 비어도 열린다', async () => {
      const { onApprove, user } = renderPane({ comment: '' });

      expect(approveButton()).toBeEnabled();

      await user.click(approveButton());

      expect(onApprove).toHaveBeenCalledTimes(1);
    });

    it('반려는 의견이 비면 잠기고 사유가 차례 사유와 다르다', () => {
      renderPane({ comment: '' });

      expect(rejectButton()).toBeDisabled();
      expect(rejectButton()).toHaveAccessibleDescription(
        t.decision.blockedNoComment(t.decision.reject),
      );
      expect(rejectButton()).not.toHaveAccessibleDescription(
        t.decision.blockedNotMyTurn(t.decision.reject),
      );
    });

    /** 공백만 친 것은 적지 않은 것과 같다 — 목 서버가 그 값을 200으로 받는 자리다. */
    it('반려는 의견이 공백만이어도 잠긴다', () => {
      renderPane({ comment: '   ' });

      expect(rejectButton()).toBeDisabled();
    });

    it('의견이 차면 반려가 열린다', async () => {
      const { onReject, user } = renderPane({ comment: '합성 반려 사유' });

      expect(rejectButton()).toBeEnabled();

      await user.click(rejectButton());

      expect(onReject).toHaveBeenCalledTimes(1);
    });

    it('의견 입력칸이 열려 있고 친 값이 그대로 올라간다', async () => {
      const { onChangeComment, user } = renderPane();

      expect(commentBox()).toBeEnabled();

      await user.type(commentBox(), '가');

      expect(onChangeComment).toHaveBeenCalledWith('가');
    });
  });

  /**
   * 반려 의견의 **형식을 유도하는 문구**(계획 결정 16 · §13-9).
   *
   * 계약이 반려 의견을 필수로 둔 목적이 「상신자가 무엇을 고쳐야 하는지 알게 하는 것」이다.
   * 필수로만 두면 한 글자짜리 반려가 기록에 남고 상신자는 같은 요청을 그대로 다시 올린다.
   */
  describe('반려 의견 형식 유도', () => {
    it('입력칸 옆에 상시로 서고 도움말과 다른 문장이다', () => {
      renderPane();

      expect(screen.getByText(t.decision.commentRejectGuide)).toBeVisible();
      expect(t.decision.commentRejectGuide).not.toBe(t.decision.commentHelp);
    });

    /** 잠긴 상태에서도 남는다 — 「무엇을 적는가」는 지금 적을 수 있는지와 다른 축이다. */
    it('내 차례가 아니어도 남는다', () => {
      renderPane({ isMyTurn: false });

      expect(screen.getByText(t.decision.commentRejectGuide)).toBeVisible();
    });

    /** 입력칸에 매인다 — 스크린리더가 그 칸에 닿았을 때 함께 읽혀야 한다. */
    it('의견 입력칸의 설명으로 이어져 있다', () => {
      renderPane();

      expect(commentBox()).toHaveAccessibleDescription(
        new RegExp(t.decision.commentRejectGuide.slice(0, 12)),
      );
    });
  });

  describe('보내는 중 — 첫째 겹', () => {
    it('입력칸과 두 버튼이 함께 잠긴다', () => {
      renderPane({ isLocked: true, comment: '합성 반려 사유' });

      expect(commentBox()).toBeDisabled();
      expect(approveButton()).toBeDisabled();
      expect(rejectButton()).toBeDisabled();
    });

    /** 잠긴 이유가 갈린다 — 기다리면 되는 것과 기다려도 열리지 않는 것은 다르다. */
    it('입력칸의 잠금 사유가 차례 사유와 다르다', () => {
      renderPane({ isLocked: true, comment: '합성 반려 사유' });

      expect(screen.getByText(t.decision.commentSendingReason)).toBeVisible();
      expect(screen.queryByText(t.decision.commentDisabledReason)).toBeNull();
    });

    it('눌러도 창을 다시 열지 않는다', async () => {
      const { onApprove, onReject, user } = renderPane({
        isLocked: true,
        comment: '합성 반려 사유',
      });

      await user.click(approveButton());
      await user.click(rejectButton());

      expect(onApprove).not.toHaveBeenCalled();
      expect(onReject).not.toHaveBeenCalled();
    });
  });

  describe('오류와 배너', () => {
    it('의견 오류가 그 입력칸에 붙는다', () => {
      renderPane({ commentError: t.decision.commentRequired });

      expect(screen.getByText(t.decision.commentRequired)).toBeVisible();
      expect(commentBox()).toHaveAttribute('aria-invalid', 'true');
    });

    /** 짝 방향 — 오류가 없으면 도움말이 그 자리를 지킨다. */
    it('오류가 없으면 도움말이 보인다', () => {
      renderPane();

      expect(screen.getByText(t.decision.commentHelp)).toBeVisible();
      expect(commentBox()).not.toHaveAttribute('aria-invalid', 'true');
    });

    it('배너 슬롯이 준 내용을 그대로 낸다', () => {
      renderPane({ banner: <p>합성 실패 배너</p> });

      expect(screen.getByText('합성 실패 배너')).toBeVisible();
    });
  });
});
