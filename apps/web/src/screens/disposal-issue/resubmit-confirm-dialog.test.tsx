import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { INTERNAL_IDS } from './fixtures';
import {
  ResubmitConfirmDialog,
  type ResubmitConfirmDialogProps,
  type ResubmitSummary,
} from './resubmit-confirm-dialog';

const t = messages.disposalIssue;

const SUMMARY: ResubmitSummary = {
  goodsIssueNo: 'GI-2026-950002',
  lineCount: 2,
  totalQtyText: '45 SAMPLE-UOM-EA',
  reason: '불량 판정분 폐기\n둘째 줄',
  reasonFirstLine: '불량 판정분 폐기',
};

const renderDialog = (overrides: Partial<ResubmitConfirmDialogProps> = {}) =>
  render(
    <ResubmitConfirmDialog summary={SUMMARY} onConfirm={vi.fn()} onClose={vi.fn()} {...overrides} />,
  );

describe('ResubmitConfirmDialog', () => {
  /**
   * **전표를 새로 만들지 않는다는 사실이 앞머리에 있다.** 이 자리에 오는 사용자는 방금
   * 「전표는 만들어졌고 상신이 실패했습니다」를 본 사람이라, 다시 만드는 것으로 읽으면
   * 전표가 두 벌 남는다.
   */
  it('전표를 새로 만들지 않는다고 앞머리에서 말한다', () => {
    renderDialog();

    expect(screen.getByText(t.dialog.resubmitLead)).toBeInTheDocument();
  });

  it('전표 번호·줄 수·합계 수량을 다시 보인다', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText('GI-2026-950002')).toBeInTheDocument();
    expect(within(dialog).getByText(t.dialog.lineCount(2))).toBeInTheDocument();
    expect(within(dialog).getByText('45 SAMPLE-UOM-EA')).toBeInTheDocument();
  });

  it('사유 전문과 첫 줄을 나눠 보인다', () => {
    renderDialog();

    const full = screen.getByRole('region', { name: t.dialog.reasonFull });
    const first = screen.getByRole('region', { name: t.dialog.reasonFirstLine });

    expect(within(full).getByText('둘째 줄')).toBeInTheDocument();
    expect(within(first).getByText('불량 판정분 폐기')).toBeInTheDocument();
    expect(screen.getByText(t.dialog.reasonSummaryNote)).toBeInTheDocument();
  });

  it('되돌릴 수 없음과 재고가 움직이지 않음을 함께 적는다', () => {
    renderDialog();

    expect(screen.getByText(t.dialog.submitNoUndo)).toBeInTheDocument();
    expect(screen.getByText(t.dialog.submitEffects)).toBeInTheDocument();
  });

  /** **창 안에 선택칸을 두지 않는다**(`omf-mes#45` · 완료 조건 C79). */
  it('선택칸과 X 손잡이가 없다', () => {
    renderDialog();

    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: messages.common.close })).not.toBeInTheDocument();
  });

  it('상신을 누르면 알리고, 계속 작성을 누르면 닫는다', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    renderDialog({ onConfirm, onClose });
    await user.click(screen.getByRole('button', { name: t.actions.confirmSubmit }));

    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  /** **내부 번호를 내지 않는다**(`omf-mes#44`) — 짝으로 업무 번호가 보이는 것을 함께 잰다. */
  it('업무 번호는 보이고 내부 번호는 보이지 않는다', () => {
    const { container } = renderDialog();

    expect(screen.getByText('GI-2026-950002')).toBeInTheDocument();

    const text = container.textContent ?? '';

    for (const id of INTERNAL_IDS) expect(text).not.toContain(id);
  });
});
