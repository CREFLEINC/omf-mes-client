import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { IssueAction, type IssueActionProps } from './issue-action';
import type { PendingWorkOrder } from './mutations';

const t = messages.emergencyWorkOrder;

const OPEN = { reason: undefined, isUncertain: false, canRetryRelease: false };

const pendingWorkOrder = (failedAt: PendingWorkOrder['failedAt']): PendingWorkOrder => ({
  workOrderId: 7001,
  workOrderNo: 'SYN-WO-0007',
  body: { lotSize: 200 },
  ifMatch: 'W/"3"',
  failedAt,
});

const renderAction = (overrides: Partial<IssueActionProps> = {}) => {
  const onIssue = vi.fn();
  const onRetryRelease = vi.fn();

  render(
    <IssueAction
      lock={OPEN}
      releasedNo={null}
      pending={null}
      onIssue={onIssue}
      onRetryRelease={onRetryRelease}
      {...overrides}
    />,
  );

  return {
    onIssue,
    onRetryRelease,
    user: userEvent.setup(),
    action: screen.getByRole('button', { name: t.action }),
  };
};

describe('IssueAction', () => {
  it('잠기지 않았으면 누를 수 있다', async () => {
    const { onIssue, user, action } = renderAction();

    expect(action).toBeEnabled();
    await user.click(action);

    expect(onIssue).toHaveBeenCalledTimes(1);
  });

  it('⛔ 잠기면 사유를 버튼에 묶어 낸다 — 감추지 않는다', () => {
    const { action } = renderAction({
      lock: { reason: t.lock.itemNotChosen, isUncertain: false, canRetryRelease: false },
    });

    expect(action).toBeDisabled();
    expect(action).toHaveAccessibleDescription(t.lock.itemNotChosen);
  });

  it('잠기지 않았으면 사유를 붙이지 않는다', () => {
    const { action } = renderAction();

    expect(action).not.toHaveAttribute('aria-describedby');
  });

  describe('결과', () => {
    it('끝까지 갔으면 번호와 함께 알린다', () => {
      renderAction({ releasedNo: 'SYN-WO-0007' });

      expect(screen.getByText(t.outcome.released('SYN-WO-0007'))).toBeInTheDocument();
    });

    /*
     * ⛔ 아는 만큼만 말한다. 보내지도 못한 것은 단언해도 되지만, 보냈는데 답을 못 받은 것을
     * 「안 됐다」고 단언하면 거짓일 수 있다 — 실제로 배포됐는데 다시 눌러 이중 배포를 시도한다.
     */
    it('배포를 «보내지 못했으면» 그렇게 말한다', () => {
      renderAction({ pending: pendingWorkOrder('notSent') });

      expect(screen.getByText(t.outcome.notSent('SYN-WO-0007'))).toBeInTheDocument();
    });

    it('⛔ 배포를 «보냈는데 답을 못 받았으면» 안 됐다고 단언하지 않는다', () => {
      renderAction({ pending: pendingWorkOrder('unknown') });

      const notice = screen.getByText(t.outcome.releaseUnknown('SYN-WO-0007'));
      expect(notice).toHaveTextContent('확인되지 않았습니다');
      expect(screen.queryByText(t.outcome.notSent('SYN-WO-0007'))).not.toBeInTheDocument();
    });

    it('만들어진 번호를 결과에 담는다 — 무엇이 남았는지 보여야 한다', () => {
      renderAction({ pending: pendingWorkOrder('notSent') });

      expect(screen.getByText(/SYN-WO-0007/)).toBeInTheDocument();
    });

    it('아직 아무것도 안 했으면 결과를 그리지 않는다', () => {
      renderAction();

      expect(screen.queryByText(/SYN-WO-0007/)).not.toBeInTheDocument();
    });
  });

  describe('배포 재시도', () => {
    it('낼 수 있을 때만 버튼이 나온다', async () => {
      const { onRetryRelease, user } = renderAction({
        lock: { reason: t.lock.notSent('SYN-WO-0007'), isUncertain: false, canRetryRelease: true },
        pending: pendingWorkOrder('notSent'),
      });

      await user.click(screen.getByRole('button', { name: t.outcome.retryRelease }));

      expect(onRetryRelease).toHaveBeenCalledTimes(1);
    });

    it('⛔ 낼 수 없으면 버튼을 두지 않는다 — 누를 수 없는 버튼을 보이지 않는다', () => {
      renderAction({ pending: pendingWorkOrder('notSent') });

      expect(
        screen.queryByRole('button', { name: t.outcome.retryRelease }),
      ).not.toBeInTheDocument();
    });
  });
});
