import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PostPane, type PostPaneProps } from './post-pane';

const t = messages.disposalIssue;

const renderPane = (overrides: Partial<PostPaneProps> = {}) => {
  const onOpenConfirm = vi.fn();

  render(
    <PostPane
      approval={{ kind: 'judgePending' }}
      blockReason={null}
      isLocked={false}
      onOpenConfirm={onOpenConfirm}
      {...overrides}
    />,
  );

  return { onOpenConfirm, user: userEvent.setup() };
};

const postButton = (): HTMLElement => screen.getByRole('button', { name: t.actions.postIssue });

describe('PostPane — 《처리하면 일어나는 일》 상시 문구', () => {
  /**
   * **세 문장이 버튼 위 상시 자리에 선다**(완료 조건 C68 · 감지기 M66). 하나라도 감추면
   * 되돌릴 수 없는 조작 앞에서 사용자가 알아야 할 사실이 빠진다.
   */
  it('세 문장이 함께 보인다', () => {
    renderPane();

    expect(screen.getByText(t.post.effectDeducts)).toBeVisible();
    expect(screen.getByText(t.post.effectApprovalIsNotPosting)).toBeVisible();
    expect(screen.getByText(t.post.effectNoUndoHere)).toBeVisible();
  });

  /**
   * **버튼이 잠겨 있어도 보인다**(감지기 M66). 잠긴 동안 읽어 두어야 열렸을 때 무엇을 누르는지
   * 알고, 잠금과 함께 감추면 정작 눌릴 수 있는 상태에서만 경고가 뜬다.
   */
  it('버튼이 잠겨 있어도 세 문장이 그대로 보인다', () => {
    renderPane({ blockReason: t.actionReasons.postNeedsSubmission });

    expect(postButton()).toBeDisabled();
    expect(screen.getByText(t.post.effectDeducts)).toBeVisible();
    expect(screen.getByText(t.post.effectApprovalIsNotPosting)).toBeVisible();
    expect(screen.getByText(t.post.effectNoUndoHere)).toBeVisible();
  });

  /** 전송 중에도 그대로다 — 문구가 사라지는 자리에 있으면 상시 문구가 아니다. */
  it('보내는 동안에도 세 문장이 그대로 보인다', () => {
    renderPane({ isLocked: true, blockReason: null });

    expect(screen.getByText(t.post.effectDeducts)).toBeVisible();
    expect(screen.getByText(t.post.effectNoUndoHere)).toBeVisible();
  });
});

describe('PostPane — 승인 판정을 못 하는 동안', () => {
  /**
   * **잠그지 않고 밝힌다**(승인 기록 §13-2 안 1 · 완료 조건 C67). 잠그면 승인된 건까지 처리할
   * 수 없어 화면이 통째로 무용해진다 — 막는 것은 서버다.
   */
  it('자리표시가 비면 버튼이 열려 있고 그 사실을 적는다', () => {
    renderPane({ approval: { kind: 'judgePending' }, blockReason: null });

    expect(postButton()).toBeEnabled();
    expect(screen.getByText(t.post.unjudgeableNote)).toBeVisible();
  });

  /**
   * **전환 감지기**(감지기 M64) — 자리표시가 채워지면 안내가 사라지고 승인 전 전표가 잠긴다.
   * 채웠을 때 살아나는 것을 재지 않으면 그 자리표시는 죽은 가지다.
   */
  it('자리표시가 채워져 승인 전이면 잠기고 안내가 사라진다', () => {
    renderPane({
      approval: { kind: 'notApproved' },
      blockReason: t.actionReasons.postNotApproved,
    });

    expect(postButton()).toBeDisabled();
    expect(postButton()).toHaveAccessibleDescription(t.actionReasons.postNotApproved);
    expect(screen.queryByText(t.post.unjudgeableNote)).not.toBeInTheDocument();
  });

  /** 승인된 전표는 열리고 안내도 없다 — 판정할 수 있게 된 뒤의 정상 갈래다. */
  it('자리표시가 채워지고 승인됐으면 열리고 안내가 없다', () => {
    renderPane({ approval: { kind: 'approved' }, blockReason: null });

    expect(postButton()).toBeEnabled();
    expect(screen.queryByText(t.post.unjudgeableNote)).not.toBeInTheDocument();
  });

  /**
   * **결재 진행을 못 읽은 것은 「승인되지 않았다」가 아니다**(완료 조건 C78). 그때도 열려
   * 있고, 판정하지 못했다는 안내는 **자리표시가 빈 갈래의 것**이라 서지 않는다.
   */
  it('진행을 못 읽었으면 열려 있고 판정 불가 안내는 서지 않는다', () => {
    renderPane({ approval: { kind: 'unread' }, blockReason: null });

    expect(postButton()).toBeEnabled();
    expect(screen.queryByText(t.post.unjudgeableNote)).not.toBeInTheDocument();
  });
});

describe('PostPane — 잠금과 사유', () => {
  /** **미상신 전표는 잠근다**(완료 조건 C69 · 감지기 M65) — 승인이 있을 수 없는 전표다. */
  it('미상신이면 잠기고 사유가 버튼 옆에서 읽힌다', () => {
    renderPane({ blockReason: t.actionReasons.postNeedsSubmission });

    expect(postButton()).toBeDisabled();
    expect(postButton()).toHaveAccessibleDescription(t.actionReasons.postNeedsSubmission);
  });

  /** 사유 없이 잠그지 않는다(배치 규범 4) — 열려 있을 때는 사유가 붙지 않는다. */
  it('열려 있으면 사유가 붙지 않는다', () => {
    renderPane({ blockReason: null });

    expect(postButton()).toBeEnabled();
    expect(postButton()).not.toHaveAccessibleDescription(t.actionReasons.postNeedsSubmission);
  });

  /** 전송 중에도 **사유가 붙는다** — 눌러도 아무 일이 없는 버튼을 두지 않는다. */
  it('보내는 동안 잠기고 사유가 붙는다', () => {
    renderPane({ isLocked: true, blockReason: null });

    expect(postButton()).toBeDisabled();
    expect(postButton()).toHaveAccessibleDescription(t.actionReasons.postLocked);
  });

  /** 눌러야 창이 열린다 — 이 부품은 요청을 만들지 않는다. */
  it('버튼을 누르면 확인을 요청한다', async () => {
    const { onOpenConfirm, user } = renderPane();

    await user.click(postButton());

    expect(onOpenConfirm).toHaveBeenCalledTimes(1);
  });

  /** 잠긴 버튼은 눌리지 않는다 — 첫째 겹이 실제로 막는지 본다. */
  it('잠긴 버튼을 눌러도 확인을 요청하지 않는다', async () => {
    const { onOpenConfirm, user } = renderPane({
      blockReason: t.actionReasons.postNeedsSubmission,
    });

    await user.click(postButton());

    expect(onOpenConfirm).not.toHaveBeenCalled();
  });
});
