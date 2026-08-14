import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ResubmitPane, type ResubmitPaneProps } from './resubmit-pane';

const t = messages.disposalIssue;

const renderPane = (overrides: Partial<ResubmitPaneProps> = {}) =>
  render(
    <ResubmitPane
      submission="notSubmitted"
      reason=""
      blockReason={null}
      isLocked={false}
      onChangeReason={vi.fn()}
      onOpenConfirm={vi.fn()}
      {...overrides}
    />,
  );

describe('ResubmitPane — 미상신 전표', () => {
  it('무엇을 해야 하는지 말하고 사유 칸을 낸다', () => {
    renderPane();

    expect(screen.getByText(t.resubmit.lead)).toBeInTheDocument();
    expect(screen.getByLabelText(t.formFields.submitReason)).toBeInTheDocument();
  });

  /** 형식 유도는 두 자리에서 **같은 문구**로 한다 — 규칙이 갈리면 사유의 모양도 갈린다. */
  it('발의 폼과 같은 예시·보조 문구를 쓴다', () => {
    renderPane();

    expect(screen.getByLabelText(t.formFields.submitReason)).toHaveAttribute(
      'placeholder',
      t.form.reasonPlaceholder,
    );
    expect(screen.getByText(t.form.reasonHelper)).toBeInTheDocument();
  });

  it('친 글자를 그대로 알린다', async () => {
    const onChangeReason = vi.fn();
    const user = userEvent.setup();

    renderPane({ onChangeReason });
    await user.type(screen.getByLabelText(t.formFields.submitReason), '가');

    expect(onChangeReason).toHaveBeenLastCalledWith('가');
  });

  /**
   * **통지가 문면으로 지정한 낱말**(#124) — 이 버튼은 「재상신」이 아니라 **「재요청」**이다.
   *
   * 나머지 시험은 `t.actions.resubmit` **키로 조회**해서 값이 무엇이든 늘 통과하므로,
   * 보이는 글자를 직접 무는 자리를 하나 둔다.
   *
   * **구획 이름과 짝을 이룬다.** 구획은 「승인 재요청」이고 버튼은 「재요청」이다 —
   * 구획이 발의 자리의 버튼(`actions.submitDisposal`)과 같은 글자가 되면 서로 다른 키 둘이
   * 한 문구를 갖게 되고, 왜 이 자리에 「재」요청이 서는지도 이름이 말하지 못한다.
   */
  it('버튼의 보이는 글자가 통지 문면 그대로이고 구획 이름과 짝을 이룬다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: t.actions.resubmit })).toHaveTextContent(/^재요청$/);

    const pane = screen.getByRole('region', { name: t.resubmit.label });

    expect(pane).toBeInTheDocument();
    /* 짝 — 구획 이름이 버튼 낱말을 담되, 발의 자리의 버튼과 같은 글자가 되지 않는다. */
    expect(t.resubmit.label).toContain(t.actions.resubmit);
    expect(t.resubmit.label).not.toBe(t.actions.submitDisposal);
  });

  it('막히지 않았으면 버튼을 눌러 확인 창을 연다', async () => {
    const onOpenConfirm = vi.fn();
    const user = userEvent.setup();

    renderPane({ reason: '사유', onOpenConfirm });
    await user.click(screen.getByRole('button', { name: t.actions.resubmit }));

    expect(onOpenConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('ResubmitPane — 잠금', () => {
  /** **사유 없이 잠그지 않는다**(배치 규범 4) — 무엇을 해야 풀리는지 버튼 옆에서 읽힌다. */
  it('막히면 버튼이 잠기고 사유가 버튼에 이어진다', () => {
    renderPane({ blockReason: t.actionReasons.needsReason });

    const button = screen.getByRole('button', { name: t.actions.resubmit });

    expect(button).toBeDisabled();
    expect(screen.getByText(t.actionReasons.needsReason)).toBeInTheDocument();
    expect(button).toHaveAccessibleDescription(t.actionReasons.needsReason);
  });

  /** **첫째 겹**이다 — 전송 중에 사유가 바뀌면 확인한 것과 나가는 것이 갈린다. */
  it('전송 중에는 사유 칸과 버튼이 함께 잠긴다', () => {
    renderPane({ reason: '사유', isLocked: true });

    expect(screen.getByLabelText(t.formFields.submitReason)).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.resubmit })).toBeDisabled();
  });

  it('사유 오류가 그 칸에 붙는다', () => {
    renderPane({ reasonError: t.errors.reasonRequired });

    expect(screen.getByLabelText(t.formFields.submitReason)).toHaveAccessibleDescription(
      expect.stringContaining(t.errors.reasonRequired),
    );
  });
});

describe('ResubmitPane — 올릴 수 없는 전표', () => {
  /**
   * 칠 수 있는데 보낼 수 없는 칸은 사용자가 쓴 글을 버리게 만든다 — 무엇이 막혔는지는
   * 버튼 옆 사유가 말한다.
   */
  it('이미 상신된 품의에는 사유 칸이 없고 그 사실을 말한다', () => {
    renderPane({ submission: 'submitted', blockReason: t.actionReasons.alreadySubmitted });

    expect(screen.getByText(t.resubmit.submittedLead)).toBeInTheDocument();
    expect(screen.queryByLabelText(t.formFields.submitReason)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.resubmit })).toBeDisabled();
  });

  /**
   * **셋째 갈래를 미상신과 같은 모양으로 보이지 않는다.** 값이 실려 온 이상 이미 올라갔을 수
   * 있고, 그때 다시 올리면 결재 요청이 두 벌이 된다.
   */
  it('상신 여부를 확인할 수 없으면 올리지 못하는 자리가 된다', () => {
    renderPane({ submission: 'unusable', blockReason: t.actionReasons.submissionUnknown });

    expect(screen.queryByLabelText(t.formFields.submitReason)).not.toBeInTheDocument();
    expect(screen.getByText(t.actionReasons.submissionUnknown)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.resubmit })).toBeDisabled();
  });
});
