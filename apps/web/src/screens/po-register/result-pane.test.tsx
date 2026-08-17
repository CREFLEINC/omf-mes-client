import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createdPoView } from './fixtures';
import { ResultPane, type ResultPaneProps } from './result-pane';
import type { CreatedPoView } from './types';

const t = messages.poRegister;

/** 상신 실패 배너가 이 구획 안에 서는지 재려고 두는 글자. */
const BANNER_TEXT = '합성 상신 실패 배너';

const renderPane = (
  overrides: Partial<ResultPaneProps> = {},
  created: Partial<CreatedPoView> = {},
) => {
  const onChangeReason = vi.fn();
  const onRequestSubmit = vi.fn();

  render(
    <ResultPane
      created={createdPoView(created)}
      phase="idle"
      reason=""
      blockReason={null}
      banner={<p>{BANNER_TEXT}</p>}
      onChangeReason={onChangeReason}
      onRequestSubmit={onRequestSubmit}
      {...overrides}
    />,
  );

  return { onChangeReason, onRequestSubmit, user: userEvent.setup() };
};

const pane = (): HTMLElement => screen.getByRole('region', { name: t.result.label });

const submitButton = (): HTMLElement =>
  within(pane()).getByRole('button', { name: t.actions.requestApproval });

const reasonInput = (): HTMLElement => within(pane()).getByLabelText(t.submit.reason);

describe('ResultPane — 만들어진 전표', () => {
  it('전표번호와 저장된 줄 수를 낸다', () => {
    renderPane();

    expect(screen.getByText(t.result.createdTitle('SAMPLE-PO-9001'))).toBeVisible();
    expect(within(pane()).getByText('SAMPLE-PO-9001')).toBeVisible();
    expect(screen.getByText(t.result.lineCount(1))).toBeVisible();
  });

  /**
   * **서버가 준 상태 코드를 그대로 낸다**(완료 조건 C20 · 공유계약 G-2). 값 목록이 확정되지
   * 않아 뜻을 옮길 근거가 없다 — 「등록 완료」로 바꿔 적으면 화면이 지어낸 뜻이 된다.
   */
  it('상태 코드를 그대로 내고 라벨이 시점을 밝힌다', () => {
    renderPane();

    expect(within(pane()).getByText('SAMPLE_PO_STATUS_A')).toBeVisible();
    expect(within(pane()).getByText(t.result.createdStatusCode)).toBeVisible();
  });

  /**
   * **되돌릴 수 없는 값이 사라지는 알림으로 나가지 않는다.** 전표번호는 적어 두거나 옮겨 적는
   * 값이라 몇 초 뒤에 없어지면 안 된다 — 살아 있는 영역으로 알리되 화면에 남는다.
   */
  it('사용자가 부르지 않은 시점에 나타나므로 살아 있는 영역으로 알린다', () => {
    renderPane();

    expect(screen.getByRole('status')).toHaveTextContent(t.result.createdTitle('SAMPLE-PO-9001'));
  });
});

describe('ResultPane — ERP 발주번호 두 갈래(C21)', () => {
  /** 값이 있으면 **그 값이 보인다.** 미매칭 표식은 서지 않는다. */
  it('값이 오면 그 값을 낸다', () => {
    renderPane();

    expect(within(pane()).getByText('SAMPLE-EPO-9001')).toBeVisible();
    expect(within(pane()).queryByText(t.result.erpUnmatched)).not.toBeInTheDocument();
    expect(within(pane()).queryByText(t.result.erpUnmatchedNote)).not.toBeInTheDocument();
  });

  /**
   * 비어 있으면 **표식과 안내가 함께** 선다(미결 #1의 처리 · `omf-mes#72`).
   *
   * 「연계에 실패했습니다」로 말하지 않는다 — MES가 먼저 만들고 매칭은 나중이라는 **순서**이고,
   * 실패와는 다른 사실이다.
   */
  it('비어 있으면 미매칭 표식과 안내가 함께 선다', () => {
    renderPane({}, { erpPurchaseOrderNo: null });

    expect(within(pane()).getByText(t.result.erpUnmatched)).toBeVisible();
    expect(within(pane()).getByText(t.result.erpUnmatchedNote)).toBeVisible();
  });

  /**
   * ERP 발주번호는 **낼 자리는 있고 넣을 칸은 없다**(계획 결정 6).
   *
   * 이 구획의 유일한 입력칸은 **상신 사유**다 — 그 칸이 서 있는 상태에서 재야 「입력칸이 하나
   * 늘었으니 통과」가 되지 않는다.
   */
  it('ERP 발주번호를 고치는 칸이 없다', () => {
    renderPane({}, { erpPurchaseOrderNo: null });

    expect(within(pane()).getByText(t.result.erpPurchaseOrderNo)).toBeVisible();
    expect(within(pane()).getAllByRole('textbox')).toEqual([reasonInput()]);
    expect(within(pane()).queryByRole('combobox')).not.toBeInTheDocument();
  });
});

/**
 * **등록과 상신은 별개 동작이다**(착수 이슈 §6 ③ · 계획 결정 9).
 *
 * 이 구획은 **등록이 끝난 뒤에만** 서므로 여기 서는 「승인 요청」이 곧 「등록 성공 뒤에야
 * 활성」이다 — 등록 한 번이 상신을 잇지 않는다는 것은 화면 층이 요청 횟수로 잰다.
 */
describe('ResultPane — 상신 자리(C27)', () => {
  it('사유 칸과 승인 요청 버튼이 서고 첫 줄이 요약임을 밝힌다', () => {
    renderPane();

    expect(reasonInput()).toBeEnabled();
    expect(submitButton()).toBeEnabled();
    expect(within(pane()).getByText(t.submit.reasonHelper)).toBeVisible();
  });

  it('친 사유가 그대로 올라간다', async () => {
    const { onChangeReason, user } = renderPane();

    await user.type(reasonInput(), '정');

    expect(onChangeReason).toHaveBeenCalledWith('정');
  });

  /** 누르는 것은 **확인 요청**이다 — 이 구획이 스스로 보내지 않는다(창이 사이에 선다). */
  it('승인 요청을 누르면 확인을 요청한다', async () => {
    const { onRequestSubmit, user } = renderPane();

    await user.click(submitButton());

    expect(onRequestSubmit).toHaveBeenCalledTimes(1);
  });

  /** **사유 없는 잠금을 두지 않는다**(배치 규범 4) — 잠긴 버튼에 사유가 이어진다. */
  it('막혔으면 버튼이 잠기고 사유가 그 버튼에 이어진다', () => {
    renderPane({ blockReason: t.actionReasons.reasonRequired });

    expect(submitButton()).toBeDisabled();
    expect(submitButton()).toHaveAccessibleDescription(new RegExp(t.actionReasons.reasonRequired));
  });

  /** 서버가 사유 칸에 준 오류는 **그 칸에** 붙는다 — 배너로 옮기면 무엇을 고칠지 가리키지 못한다. */
  it('사유 칸의 서버 오류가 그 칸에 붙는다', () => {
    renderPane({ reason: '정산', reasonError: '합성 사유 서버 문구' });

    expect(reasonInput()).toHaveAccessibleDescription(/합성 사유 서버 문구/);
  });
});

describe('ResultPane — 나가는 중과 끝난 뒤', () => {
  /** 나가는 중에는 **사유 칸과 버튼이 함께 잠긴다** — 연타가 결재 요청 두 벌이 된다. */
  it('나가는 중이면 올리는 중이라고 말하고 칸과 버튼이 잠긴다', () => {
    renderPane({ phase: 'submitting', reason: '정산', blockReason: t.actionReasons.submitting });

    expect(within(pane()).getByText(t.result.submitting)).toBeVisible();
    expect(reasonInput()).toBeDisabled();
    expect(submitButton()).toBeDisabled();
    /* 전표번호는 어느 갈래에서도 남는다 — 사용자가 옮겨 적는 값이다. */
    expect(within(pane()).getByText('SAMPLE-PO-9001')).toBeVisible();
  });

  /**
   * **올린 뒤에는 결재함을 가리킨다**(착수 이슈 §6 ③ · 계획 결정 11).
   *
   * 진행 상태를 이 화면이 말하지 않는다 — 결재함(W-CO-09)이 정본이다.
   */
  it('올린 뒤에는 올렸다고 말하고 결재함을 가리킨다', () => {
    renderPane({ phase: 'submitted', reason: '정산' });

    expect(screen.getByText(t.result.submittedTitle('SAMPLE-PO-9001'))).toBeVisible();
    expect(within(pane()).getByText(t.result.submittedDescription)).toBeVisible();
    expect(within(pane()).getByText(t.result.submittedNoRequestNo)).toBeVisible();
    expect(within(pane()).getByText('SAMPLE-PO-9001')).toBeVisible();
  });

  /**
   * **올린 뒤에는 사유 칸과 버튼을 두지 않는다.** 칠 수 있는데 보낼 수 없는 칸은 사용자가 쓴
   * 글을 버리게 만들고, 잠긴 버튼만 남기면 「무엇이 풀리는 조건인가」에 화면이 답하지 못한다 —
   * 그 자리는 결재함 안내가 대신한다.
   *
   * 음성 단언 앞에 **짝 양성**을 세운다 — 구획이 실제로 그려진 상태에서 잰다.
   */
  it('올린 뒤에는 다시 올릴 칸과 버튼이 없다', () => {
    renderPane({ phase: 'submitted', reason: '정산' });

    expect(within(pane()).getByText(t.result.submittedDescription)).toBeVisible();
    expect(within(pane()).queryByLabelText(t.submit.reason)).not.toBeInTheDocument();
    expect(
      within(pane()).queryByRole('button', { name: t.actions.requestApproval }),
    ).not.toBeInTheDocument();
  });

  /**
   * **전표는 남고 상신만 실패했다**(완료 조건 C31).
   *
   * 통째로 실패라고 말하면 사용자가 처음부터 다시 만들어 전표가 두 벌 남는다 — 화면은 첫
   * 응답을 받았으므로 전표가 만들어졌다는 것을 **확인한 사실**로 말할 수 있다.
   */
  it('상신이 실패하면 전표가 남았다는 사실과 다시 올릴 길이 함께 선다', () => {
    renderPane({ phase: 'failed', reason: '정산' });

    expect(screen.getByText(t.result.submitFailedTitle('SAMPLE-PO-9001'))).toBeVisible();
    expect(within(pane()).getByText(t.result.submitFailedDescription)).toBeVisible();
    expect(within(pane()).getByText('SAMPLE-PO-9001')).toBeVisible();
    expect(reasonInput()).toHaveValue('정산');
    expect(submitButton()).toBeEnabled();
  });

  /** 실패 배너는 **다시 누를 버튼 옆에** 선다 — 다른 자리에 두면 무엇이 막았는지 놓친다. */
  it('실패 배너 슬롯이 이 구획 안에 그려진다', () => {
    renderPane({ phase: 'failed' });

    expect(within(pane()).getByText(BANNER_TEXT)).toBeVisible();
  });
});

describe('ResultPane — 두지 않는 것', () => {
  /**
   * **결재 대기 목록·진행 단계를 두지 않는다**(착수 이슈 §6 ③ · 계획 결정 11 · 완료 조건 C30).
   *
   * 주 사본에는 결재 진행 구획이 있어 파일을 통째로 옮기면 따라온다 — 그 구획이 여기 서면
   * 이 화면이 결재함과 같은 사실을 서로 다른 시점의 값으로 말하게 된다.
   *
   * 음성 단언 앞에 **짝 양성**을 세운다.
   */
  it('올린 뒤에도 결재 진행 목록·표를 두지 않는다', () => {
    renderPane({ phase: 'submitted', reason: '정산' });

    expect(within(pane()).getByText(t.result.submittedDescription)).toBeVisible();
    expect(within(pane()).queryAllByRole('table')).toHaveLength(0);
    expect(within(pane()).queryAllByRole('list')).toHaveLength(0);
    expect(within(pane()).queryAllByRole('listitem')).toHaveLength(0);
  });

  /**
   * **내부 번호를 담을 자리가 없다**(`omf-mes#44`) — 받는 타입에 그 값이 없다. 승인 요청
   * 응답의 식별자도 이 구획에 오지 않는다.
   *
   * **업무 번호는 세지 않는다.** 전표번호와 ERP 발주번호는 사용자가 이 전표를 찾는 값이라
   * 보이는 것이 맞고, 그 글자 안에 내부 번호와 같은 숫자가 들어 있다.
   */
  it('업무 번호 밖에서 내부 번호가 글자로 나타나지 않는다', () => {
    renderPane({ phase: 'submitted' });

    const text = (pane().textContent ?? '')
      .split('SAMPLE-EPO-9001')
      .join('')
      .split('SAMPLE-PO-9001')
      .join('');

    for (const id of ['9001', '9301', '9401', '9701', '9801']) expect(text).not.toContain(id);
  });
});
