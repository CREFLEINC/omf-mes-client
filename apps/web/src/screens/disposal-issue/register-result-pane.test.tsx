import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { INTERNAL_IDS } from './fixtures';
import {
  RegisterResultPane,
  type CreatedIssueSummary,
  type RegisterResultPaneProps,
  type SubmitOutcome,
} from './register-result-pane';

const t = messages.disposalIssue;

const ISSUE: CreatedIssueSummary = {
  goodsIssueNo: 'GI-2026-950004',
  statusCode: 'SAMPLE_GI_STATUS_A',
  lines: [
    {
      ordinal: 1,
      item: 'SAMPLE-ITEM-01 · 합성 자재 가',
      lot: 'SAMPLE-LOT-0001',
      qty: '10 SAMPLE-UOM-EA',
    },
  ],
};

const renderPane = (
  outcome: SubmitOutcome,
  overrides: Partial<RegisterResultPaneProps> = {},
) => render(<RegisterResultPane outcome={outcome} onOpenIssue={vi.fn()} {...overrides} />);

describe('RegisterResultPane — 갈래별 문장', () => {
  it('상신까지 끝나면 올렸다고 말한다', () => {
    renderPane({ kind: 'submitted', issue: ISSUE });

    expect(screen.getByText(t.result.submittedTitle('GI-2026-950004'))).toBeInTheDocument();
    expect(screen.getByText(t.result.submittedDescription)).toBeInTheDocument();
  });

  it('상신 중에는 만들었다고만 말한다', () => {
    renderPane({ kind: 'submitting', issue: ISSUE });

    expect(screen.getByText(t.result.createdTitle('GI-2026-950004'))).toBeInTheDocument();
    expect(screen.getByText(t.result.submitting)).toBeInTheDocument();
  });

  /**
   * **부분 실패를 정확히 말한다**(감지기 M57). 통째로 실패라고 하면 사용자가 처음부터 다시
   * 만들어 **전표가 두 벌** 남고, 통째로 성공이라고 하면 올라가지 않은 품의를 올라간 것으로 믿는다.
   */
  it('전표만 만들어졌으면 그 사실과 전표 번호를 함께 말한다', () => {
    renderPane({ kind: 'partial', issue: ISSUE });

    expect(screen.getByText(t.result.partialTitle('GI-2026-950004'))).toBeInTheDocument();
    expect(screen.getByText(t.result.partialDescription)).toBeInTheDocument();
    expect(screen.getByText(t.result.notSubmittedYet)).toBeInTheDocument();
  });

  /** 부분 실패는 **경고**로 낸다 — 성공과 같은 모양이면 훑고 지나간다. */
  it('부분 실패만 경고로 서고 성공은 그렇지 않다', () => {
    const { unmount } = renderPane({ kind: 'partial', issue: ISSUE });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    unmount();

    renderPane({ kind: 'submitted', issue: ISSUE });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  /** 성공 갈래에 「아직 상신되지 않았습니다」가 서면 화면이 스스로를 뒤집는다. */
  it('상신이 끝났으면 미상신이라 말하지 않는다', () => {
    renderPane({ kind: 'submitted', issue: ISSUE });

    expect(screen.queryByText(t.result.notSubmittedYet)).not.toBeInTheDocument();
  });
});

describe('RegisterResultPane — 확인한 것만 말한다', () => {
  it('서버가 준 상태 코드와 라인을 그대로 낸다', () => {
    renderPane({ kind: 'submitted', issue: ISSUE });

    expect(screen.getByText('SAMPLE_GI_STATUS_A')).toBeInTheDocument();
    expect(screen.getByText(t.result.lineCount(1))).toBeInTheDocument();
    expect(
      screen.getByText(
        t.result.linePair('SAMPLE-ITEM-01 · 합성 자재 가', 'SAMPLE-LOT-0001', '10 SAMPLE-UOM-EA'),
      ),
    ).toBeInTheDocument();
  });

  /**
   * **승인 요청 번호를 내지 않는다**(감지기 M61 · `omf-mes#44`). 상신 응답이 내부 식별자
   * 하나뿐이라 낼 번호가 없다 — 그 사실을 적고 어디서 볼 수 있는지 가리킨다.
   */
  it('승인 요청 번호 대신 어디서 보는지 가리킨다', () => {
    renderPane({ kind: 'submitted', issue: ISSUE });

    expect(screen.getByText(t.result.submittedNoRequestNo)).toBeInTheDocument();
  });

  /** **내부 번호를 내지 않는다**(감지기 M62) — 짝으로 업무 번호가 보이는 것을 함께 잰다. */
  it('업무 번호는 보이고 내부 번호는 보이지 않는다', () => {
    const { container } = renderPane({ kind: 'partial', issue: ISSUE });

    expect(screen.getByText('GI-2026-950004')).toBeInTheDocument();

    const text = container.textContent ?? '';

    for (const id of INTERNAL_IDS) expect(text).not.toContain(id);
  });

  /**
   * 이 조작은 전기가 아니다 — **지난 일로 적지 않는다**(계획 결정 15).
   *
   * 「승인이 끝나면 … 차감합니다」는 **앞으로 할 일**이라 사실이고, 「차감됐습니다」는 거짓이다.
   * 낱말 하나로 재지 않고 **끝난 것처럼 말하는 어미**를 잰다.
   */
  it.each(['차감됐', '차감했', '차감되었'])(
    '재고가 %s다고 지난 일로 말하지 않는다',
    (past) => {
      const { container } = renderPane({ kind: 'submitted', issue: ISSUE });

      expect(container.textContent ?? '').not.toContain(past);
    },
  );
});

describe('RegisterResultPane — 이어서 다루는 길', () => {
  /** **탭을 말없이 바꾸지 않는다**(계획 결정 6) — 누르는 것은 사용자다. */
  it('세 갈래 모두에서 이 품의를 열 수 있다', async () => {
    const onOpenIssue = vi.fn();
    const user = userEvent.setup();

    for (const kind of ['submitting', 'submitted', 'partial'] as const) {
      const { unmount } = renderPane({ kind, issue: ISSUE }, { onOpenIssue });

      await user.click(screen.getByRole('button', { name: t.actions.openIssue }));
      unmount();
    }

    expect(onOpenIssue).toHaveBeenCalledTimes(3);
  });
});
