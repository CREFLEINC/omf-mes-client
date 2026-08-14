import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PARTNER_LABEL } from './fixtures';
import type { ReferenceSource } from './lookups';
import { describeIssueDestination, PostPane, type PostPaneProps } from './post-pane';

const t = messages.disposalIssue;

const renderPane = (overrides: Partial<PostPaneProps> = {}) => {
  const onOpenConfirm = vi.fn();

  render(
    <PostPane
      approval={{ kind: 'judgePending' }}
      blockReason={null}
      destination={t.values.selfDisposal}
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

/**
 * **③ 구획이 「누가 가져가는가」를 말한다**(완료 조건 C26 · 변경 통지 #128).
 *
 * 재고가 실제로 움직이는 자리라 **처리 직전에** 도착지가 읽혀야 한다 — 통지는 이 구획에
 * 컨트롤을 두라고 했으나 그 시점에 값을 보낼 계약 통로가 없어(실측) 결정은 발의 시점으로
 * 옮겨졌고, 여기 남는 것은 **이미 정해진 값을 읽어 보이는 일**이다(승인 기록 D-1 안 A).
 */
describe('describeIssueDestination — 세 갈래', () => {
  const partners = (overrides: Partial<ReferenceSource> = {}): ReferenceSource => ({
    entries: [{ value: '9561', label: PARTNER_LABEL, isActive: true }],
    isError: false,
    isLoading: false,
    truncated: false,
    ...overrides,
  });

  /** 짝이 통째로 없는 것은 **사용자가 정한 사실**이다 — 「없음」이나 「알 수 없음」이 아니다. */
  it('짝이 없으면 자체 폐기라 말한다', () => {
    expect(
      describeIssueDestination(
        { destinationTypeCode: null, destinationId: null },
        partners({ entries: [] }),
      ),
    ).toBe(t.values.selfDisposal);
  });

  it('짝이 있으면 「코드 · 이름」으로 말한다', () => {
    expect(
      describeIssueDestination(
        { destinationTypeCode: 'SAMPLE_DEST_TYPE_A', destinationId: 9561 },
        partners(),
      ),
    ).toBe(PARTNER_LABEL);
  });

  /**
   * **이름을 풀지 못하면 그 사실을 밝히고 번호를 대신 내지 않는다**(`omf-mes#44`).
   * 낱말은 이 슬라이스가 이미 정해 둔 것을 쓴다 — 확인 창의 못 푼 이름과 같은 말이어야
   * 사용자가 자리마다 다른 읽기 규칙을 익히지 않는다.
   */
  it('목록에 없는 거래처는 알 수 없음으로 말한다', () => {
    expect(
      describeIssueDestination(
        { destinationTypeCode: 'SAMPLE_DEST_TYPE_A', destinationId: 9563 },
        partners(),
      ),
    ).toBe(t.values.unknown);
  });

  /**
   * **아직 오지 않은 것·못 받은 것을 「목록에 없음」으로 말하지 않는다**(`omf-mes#47`).
   * 그 문구는 *값이 잘못됐다*는 뜻이라 사용자가 반대로 읽는다.
   */
  it('미도착·실패를 목록에 없음과 가른다', () => {
    const target = { destinationTypeCode: 'SAMPLE_DEST_TYPE_A', destinationId: 9561 };

    expect(describeIssueDestination(target, partners({ entries: [], isLoading: true }))).toBe(
      t.values.referenceLoading,
    );
    expect(describeIssueDestination(target, partners({ isError: true }))).toBe(
      t.values.referenceFailed,
    );
  });

  /**
   * **한쪽만 온 전표를 자체 폐기로 읽지 않는다**(#128 ⛔ — 짝은 함께 있거나 함께 없다).
   * 서버가 유형만 실어 보내면 「누가 가져갔는지 모른다」가 사실이고, 그것을 「외부 업체가
   * 없다」로 접으면 화면이 확인하지 않은 것을 말하게 된다.
   */
  it('짝 한쪽만 온 전표를 자체 폐기로 접지 않는다', () => {
    expect(
      describeIssueDestination(
        { destinationTypeCode: 'SAMPLE_DEST_TYPE_A', destinationId: null },
        partners(),
      ),
    ).toBe(t.values.unknown);
  });

  /** **어느 갈래에도 번호를 담지 않는다**(`omf-mes#44`) — 담을 자리가 없으면 샐 경로도 없다. */
  it('어느 갈래에도 번호를 담지 않는다', () => {
    for (const text of [
      describeIssueDestination({ destinationTypeCode: null, destinationId: null }, partners()),
      describeIssueDestination(
        { destinationTypeCode: 'SAMPLE_DEST_TYPE_A', destinationId: 9561 },
        partners(),
      ),
      describeIssueDestination(
        { destinationTypeCode: 'SAMPLE_DEST_TYPE_A', destinationId: 9563 },
        partners(),
      ),
      describeIssueDestination(
        { destinationTypeCode: 'SAMPLE_DEST_TYPE_A', destinationId: 9561 },
        partners({ isError: true }),
      ),
    ]) {
      expect(text).not.toContain('9561');
      expect(text).not.toContain('9563');
    }
  });
});

describe('PostPane — 도착지 표시', () => {
  it('도착지를 라벨과 함께 보인다', () => {
    renderPane({ destination: PARTNER_LABEL });

    expect(screen.getByText(t.post.destinationLabel)).toBeVisible();
    expect(screen.getByText(PARTNER_LABEL)).toBeVisible();
  });

  /**
   * **잠겨 있을 때도 보인다.** 왜 이 전표를 처리할 수 없는지와 이 전표가 어디로 가는지는
   * 서로 다른 사실이고, 잠금과 함께 감추면 승인 전에는 도착지를 확인할 길이 사라진다.
   */
  it('버튼이 잠겨 있어도 도착지가 보인다', () => {
    renderPane({
      destination: t.values.selfDisposal,
      blockReason: t.actionReasons.postNeedsSubmission,
    });

    expect(screen.getByText(t.values.selfDisposal)).toBeVisible();
  });
});
