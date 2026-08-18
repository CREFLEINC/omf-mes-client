import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ResultPane, type SubmitPhase } from './result-pane';
import type { CreatedAdjustmentView } from './types';

const t = messages.stockAdjust;

const CREATED: CreatedAdjustmentView = {
  inventoryAdjustmentNo: 'SAMPLE-IA-9301',
  statusCode: 'SAMPLE_IA_STATUS_A',
  erpMessageQueued: true,
  lineCount: 2,
};

interface RenderOptions {
  created?: Partial<CreatedAdjustmentView>;
  phase?: SubmitPhase;
  reason?: string;
  reasonError?: string;
  blockReason?: string | null;
  banner?: React.ReactNode;
  progress?: React.ReactNode;
}

const onChangeReason = vi.fn();
const onRequestSubmit = vi.fn();

const renderPane = (options: RenderOptions = {}): HTMLElement => {
  render(
    <ResultPane
      created={{ ...CREATED, ...options.created }}
      phase={options.phase ?? 'idle'}
      reason={options.reason ?? ''}
      reasonError={options.reasonError}
      blockReason={options.blockReason === undefined ? null : options.blockReason}
      banner={options.banner ?? null}
      progress={options.progress ?? null}
      onChangeReason={onChangeReason}
      onRequestSubmit={onRequestSubmit}
    />,
  );

  return screen.getByRole('region', { name: t.result.label });
};

describe('ResultPane — 화면이 확인한 것만 말한다', () => {
  /** 전표번호는 **적어 두거나 옮겨 적는 값**이라 사라지는 알림으로 내지 않는다. */
  it('전표번호가 제목과 값 자리에 남는다', () => {
    const pane = renderPane();

    expect(within(pane).getByText(t.result.createdTitle('SAMPLE-IA-9301'))).toBeVisible();
    expect(within(pane).getByText(t.result.inventoryAdjustmentNo)).toBeVisible();
  });

  /**
   * ⭐ **상태는 서버가 준 글자 그대로다**(C24 · 공유계약 G-2).
   *
   * 「등록됨」·「승인 대기」로 옮겨 적으면 화면이 값 목록을 아는 척하게 되는데, 그 목록은 아직
   * 확정되지 않았다.
   */
  it('상태 코드를 서버가 준 그대로 낸다', () => {
    const pane = renderPane({ created: { statusCode: 'SAMPLE_IA_STATUS_B' } });

    expect(within(pane).getByText('SAMPLE_IA_STATUS_B')).toBeVisible();
  });

  /** 지금 상태의 정본이 이 화면이 아니라는 사실을 함께 적는다. */
  it('등록 시점의 값이라는 사실을 적는다', () => {
    const pane = renderPane();

    expect(within(pane).getByText(t.result.statusNote)).toBeVisible();
  });

  /** **서버가 저장한 줄 수**를 말한다 — 화면이 보낸 줄 수가 아니다. */
  it('서버가 저장한 줄 수를 낸다', () => {
    const pane = renderPane({ created: { lineCount: 3 } });

    expect(within(pane).getByText(t.result.lineCount(3))).toBeVisible();
  });

  /** 등록은 전기가 아니다 — 재고가 아직 움직이지 않았다는 사실을 결과 구획도 말한다. */
  it('재고가 아직 움직이지 않았다는 사실을 적는다', () => {
    const pane = renderPane();

    expect(within(pane).getByText(t.result.createdDescription)).toBeVisible();
  });

  /** **내부 번호를 내지 않는다**(`omf-mes#44`). 짝으로 업무 번호는 실제로 보인다. */
  it('내부 번호가 구획에 없다', () => {
    const pane = renderPane();

    expect(within(pane).getByText('SAMPLE-IA-9301')).toBeVisible();
    expect(pane.textContent ?? '').not.toContain('9301,');
    expect(pane.textContent ?? '').not.toMatch(/(^|[^-])\b9301\b/);
  });
});

/**
 * ⭐ **ERP 적재 여부는 세 갈래다**(C23 · D-11).
 *
 * 계약이 이 필드를 **선택**으로 두어 오지 않는 갈래가 실재한다 — 없음을 거짓으로 접으면
 * 아무 근거 없이 「대기열에 오르지 않았다」로 읽힌다.
 */
describe('ResultPane — ERP 송신 세 갈래', () => {
  it('참이면 대기열에 올랐다고 말한다', () => {
    const pane = renderPane({ created: { erpMessageQueued: true } });

    expect(within(pane).getByText(t.result.erpQueued)).toBeVisible();
  });

  it('거짓이면 대기열에 오르지 않았다고 말한다', () => {
    const pane = renderPane({ created: { erpMessageQueued: false } });

    expect(within(pane).getByText(t.result.erpNotQueued)).toBeVisible();
  });

  it('값이 오지 않으면 알 수 없다고 말한다 — 거짓으로 접지 않는다', () => {
    const pane = renderPane({ created: { erpMessageQueued: null } });

    expect(within(pane).getByText(t.result.erpUnknown)).toBeVisible();
    expect(within(pane).queryByText(t.result.erpNotQueued)).not.toBeInTheDocument();
  });

  /** **적재는 전송이 아니다**(계약 문면). 어느 갈래에도 「전송 완료」라는 낱말을 쓰지 않는다. */
  it('적재가 전송 완료가 아니라는 사실을 적는다', () => {
    const pane = renderPane({ created: { erpMessageQueued: true } });

    expect(within(pane).getByText(t.result.erpNote)).toBeVisible();
  });
});

/**
 * ⭐ **상신 갈래 넷**(D-15) — 화면이 확인한 것만 말한다.
 *
 * | 갈래 | 화면이 하는 말 |
 * | --- | --- |
 * | `idle` | 「만들었습니다」 + 사유 칸과 「조정 상신」 |
 * | `submitting` | 위 + 「올리는 중」 |
 * | `submitted` | 「올렸습니다」 + **사유 칸과 버튼이 사라진다** |
 * | `failed` | **전표는 남고 상신만 실패했다** — 그 사실을 정확히 말한다 |
 */
describe('ResultPane — 상신 갈래', () => {
  it('등록만 됐으면 사유 칸과 상신 버튼이 선다', () => {
    const pane = renderPane();

    expect(within(pane).getByLabelText(t.submit.reason)).toBeInTheDocument();
    expect(within(pane).getByRole('button', { name: t.actions.requestApproval })).toBeEnabled();
  });

  it('사유를 치면 그대로 위로 올린다 — 창이 다시 세지 않는다', async () => {
    const user = userEvent.setup();
    const pane = renderPane();

    await user.type(within(pane).getByLabelText(t.submit.reason), '가');

    expect(onChangeReason).toHaveBeenCalledWith('가');
  });

  it('상신을 누르면 확인을 요청한다 — 여기서 보내지 않는다', async () => {
    const user = userEvent.setup();
    const pane = renderPane();

    await user.click(within(pane).getByRole('button', { name: t.actions.requestApproval }));

    expect(onRequestSubmit).toHaveBeenCalledTimes(1);
  });

  /** 나가는 중이라는 사실은 배너를 갈아 끼우지 않고 **덧붙인다** — 전표를 만든 사실이 남는다. */
  it('나가는 중이면 그 사실을 덧붙인다', () => {
    const pane = renderPane({ phase: 'submitting', blockReason: t.actionReasons.submitting });

    expect(within(pane).getByText(t.result.submitting)).toBeVisible();
    expect(within(pane).getByText(t.result.createdTitle('SAMPLE-IA-9301'))).toBeVisible();
    expect(within(pane).getByLabelText(t.submit.reason)).toBeDisabled();
  });

  /**
   * ⭐ **올린 뒤에는 사유 칸과 버튼을 두지 않는다.** 칠 수 있는데 보낼 수 없는 칸은 사용자가 쓴
   * 글을 버리게 만들고, 잠긴 버튼만 남기면 「무엇이 풀리는 조건인가」에 화면이 답하지 못한다.
   */
  it('올렸으면 올렸다고 말하고 사유 칸과 버튼이 사라진다', () => {
    const pane = renderPane({ phase: 'submitted' });

    expect(within(pane).getByText(t.result.submittedTitle('SAMPLE-IA-9301'))).toBeVisible();
    expect(within(pane).getByText(t.result.submittedDescription)).toBeVisible();
    expect(within(pane).queryByLabelText(t.submit.reason)).not.toBeInTheDocument();
    expect(
      within(pane).queryByRole('button', { name: t.actions.requestApproval }),
    ).not.toBeInTheDocument();
  });

  /**
   * ⭐ **부분 실패를 성공과 같은 모양으로 그리지 않는다.**
   *
   * 통째로 실패라고 말하면 사용자가 처음부터 다시 만들어 **전표가 두 벌** 남고, 통째로
   * 성공이라고 말하면 결재에 올라가지 않은 조정을 올라간 것으로 믿는다.
   */
  it('상신만 실패하면 전표가 남았다는 사실을 정확히 말한다', () => {
    const pane = renderPane({ phase: 'failed' });

    expect(within(pane).getByText(t.result.submitFailedTitle('SAMPLE-IA-9301'))).toBeVisible();
    expect(within(pane).getByText(t.result.submitFailedDescription)).toBeVisible();
    /* 다시 올릴 길이 남아 있다 — 막다른 길이 아니다. */
    expect(
      within(pane).getByRole('button', { name: t.actions.requestApproval }),
    ).toBeInTheDocument();
  });

  /** 실패 배너는 **다시 누를 버튼 옆에** 선다 — 다른 자리에 두면 무엇이 막았는지 놓친다. */
  it('실패 배너 자리가 상신 자리 안에 있다', () => {
    const pane = renderPane({ phase: 'failed', banner: <p>합성 상신 거절</p> });

    expect(within(pane).getByText('합성 상신 거절')).toBeVisible();
  });

  /** 화면이 잡은 사정과 서버가 준 오류가 **같은 칸에** 붙는다. */
  it('사유 칸의 서버 오류가 그 칸에 붙는다', () => {
    const pane = renderPane({ reasonError: '합성 사유 오류' });

    expect(within(pane).getByText('합성 사유 오류')).toBeVisible();
    expect(within(pane).getByLabelText(t.submit.reason)).toHaveAttribute('aria-invalid', 'true');
  });

  /** **사유 없이 잠그지 않는다** — 잠긴 버튼과 그 사정이 함께 선다. */
  it('막혔으면 버튼이 잠기고 사유가 함께 선다', () => {
    const pane = renderPane({ blockReason: t.actionReasons.submitReasonRequired });

    expect(within(pane).getByRole('button', { name: t.actions.requestApproval })).toBeDisabled();
    expect(within(pane).getByText(t.actionReasons.submitReasonRequired)).toBeVisible();
  });

  /** 짝 방향 — 열려 있으면 사유를 그리지 않는다. 늘 서 있으면 읽히지 않는다. */
  it('열려 있으면 잠긴 사유를 그리지 않는다', () => {
    const pane = renderPane();

    expect(within(pane).getByRole('button', { name: t.actions.requestApproval })).toBeEnabled();
    expect(within(pane).queryByText(t.actionReasons.submitReasonRequired)).not.toBeInTheDocument();
  });
});

/**
 * **여기 없는 것** — 이 회차의 결과 구획은 **전기를 그리지 않는다.**
 *
 * 목이 등록 응답에 승인 요청 번호와 전기 시각을 채워 주지만(계약 예시값), 그것은 **화면이
 * 확인한 사실이 아니다** — 이 구획이 「올렸습니다」로 바뀌는 근거는 오직 **202를 받았다는
 * 사실**(`phase`)이다.
 */
describe('ResultPane — 여기 없는 것', () => {
  it('전기 조작이 없다', () => {
    const pane = renderPane();

    /* 짝 양성 — 상신 버튼은 실제로 있다. 「아무 버튼도 없다」로 통과하지 않게 한다. */
    expect(within(pane).getByRole('button', { name: t.actions.requestApproval })).toBeVisible();
    expect(
      within(pane)
        .getAllByRole('button')
        .filter((button) => /전기/.test(button.textContent ?? '')),
    ).toEqual([]);
  });

  /** ⛔ **승인·반려 조작이 없다**(조심 ① · D-3) — 결재함이 소유한다. */
  it('승인·반려 조작이 없다', () => {
    const pane = renderPane({ phase: 'submitted' });

    expect(within(pane).getByText(t.result.submittedTitle('SAMPLE-IA-9301'))).toBeVisible();
    expect(within(pane).queryAllByRole('button')).toHaveLength(0);
  });

  /** 결재 진행은 **화면이 넘긴 슬롯**이다 — 구획이 스스로 부르지 않는다. */
  it('결재 진행 슬롯을 화면에서 받는다', () => {
    const pane = renderPane({ phase: 'submitted', progress: <p>합성 진행 구획</p> });

    expect(within(pane).getByText('합성 진행 구획')).toBeVisible();
  });
});
