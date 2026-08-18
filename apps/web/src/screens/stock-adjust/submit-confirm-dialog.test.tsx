import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { readReason } from './reason-draft';
import { SubmitConfirmDialog, type SubmitSummary } from './submit-confirm-dialog';

const t = messages.stockAdjust;

const REASON = '실사 차이분 조정 요청\n\n  들여쓴 근거 줄\n2026-08 실사에서 확인';

/** 화면이 만든 요약을 그대로 넘긴다 — 창이 다시 세면 확인한 것과 보내는 것이 갈린다. */
const summaryOf = (reason = REASON): SubmitSummary => {
  const state = readReason(reason);

  return {
    inventoryAdjustmentNo: 'SAMPLE-IA-9301',
    reason: state.kind === 'ready' ? state.reason : '',
    reasonFirstLine: state.kind === 'ready' ? state.firstLine : '',
  };
};

const renderDialog = (
  overrides: { isSaving?: boolean; summary?: SubmitSummary; banner?: React.ReactNode } = {},
) => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  render(
    <SubmitConfirmDialog
      summary={overrides.summary ?? summaryOf()}
      isSaving={overrides.isSaving ?? false}
      banner={overrides.banner ?? null}
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  );

  return { onConfirm, onClose, user: userEvent.setup() };
};

const dialog = (): HTMLElement => screen.getByRole('dialog');

/**
 * 상신 확인 — **되돌릴 수 없는 둘째 조작 앞의 마지막 층**이다(D-17).
 */
describe('SubmitConfirmDialog — 무엇을 확인시키는가', () => {
  it('어느 전표를 올리는지 밝힌다', () => {
    renderDialog();

    expect(within(dialog()).getByText('SAMPLE-IA-9301')).toBeInTheDocument();
    expect(within(dialog()).getByText(t.dialog.submitLead)).toBeInTheDocument();
  });

  /**
   * ⭐ **사유 전문과 첫 줄을 나눠 보인다**(C30 · A-12).
   *
   * 첫 줄만 보이면 무엇을 보내는지 모르고, 전문만 보이면 **어느 줄이 남들에게 요약으로 보일지**
   * 모른다 — 결재함 목록에서 요약을 겸하는 것이 첫 줄이다.
   */
  it('전문과 첫 줄을 나눠 보인다', () => {
    renderDialog();

    const full = within(dialog()).getByRole('region', { name: t.dialog.reasonFull });
    const firstLine = within(dialog()).getByRole('region', { name: t.dialog.reasonFirstLine });

    expect(within(full).getByText('실사 차이분 조정 요청')).toBeInTheDocument();
    expect(within(full).getByText('2026-08 실사에서 확인')).toBeInTheDocument();
    expect(within(firstLine).getByText('실사 차이분 조정 요청')).toBeInTheDocument();
    expect(within(firstLine).getByText(t.dialog.reasonSummaryNote)).toBeInTheDocument();
  });

  /**
   * 전문 쪽은 **줄 수가 그대로**여야 한다 — 빈 줄과 들여쓰기가 접히면 사용자가 확인한 글자와
   * 결재함에 실릴 글자가 갈린다.
   */
  it('전문의 줄 수와 들여쓰기가 접히지 않는다', () => {
    renderDialog();

    const full = within(dialog()).getByRole('region', { name: t.dialog.reasonFull });
    const lines = within(full)
      .getAllByRole('paragraph')
      .map((line) => line.textContent ?? '');

    /* 라벨 한 줄 + 사유 네 줄. 빈 줄이 사라지면 이 수가 줄어든다. */
    expect(lines).toHaveLength(5);
    expect(lines.at(-3)).not.toBe('');
    expect(lines.at(-2)).toContain('들여쓴 근거 줄');
  });

  /**
   * ⛔ **승인자·결재선을 이 창이 고르지 않는다**(D-12). 계약의 본문이 사유 한 칸이라 보낼
   * 자리가 없다 — 그 사실을 적어야 사용자가 「고르는 칸이 없다」를 결함으로 읽지 않는다.
   */
  it('승인자를 고르는 칸이 없고 그 사정을 적는다', () => {
    renderDialog();

    expect(within(dialog()).getByText(t.dialog.submitApprover)).toBeInTheDocument();
    expect(within(dialog()).getByText(t.dialog.submitNoUndo)).toBeInTheDocument();
    /* 창 안에 입력칸을 두지 않는다(`omf-mes#45`) — 글자와 버튼뿐이다. */
    expect(within(dialog()).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(dialog()).queryAllByRole('combobox')).toHaveLength(0);
  });
});

/**
 * ⭐ **3방어**(사본 체크리스트 5번) — 스크림·닫기 버튼·Escape.
 *
 * 되돌릴 수 없는 창이라 실수로 닫히면 확인 자체가 형식이 된다. **버리기 창과 갈리는 자리다** —
 * 그쪽은 닫혀도 잃는 것이 없어 전례가 스크림을 열어 둔다.
 */
describe('SubmitConfirmDialog — 3방어와 Escape 축', () => {
  /** **나머지 반쪽**(`closeOnBackdropClick={false}`) — X만 잠그고 스크림을 열어 두면 잠근 적이 없다. */
  it('스크림을 눌러도 닫히지 않는다', () => {
    const { onClose } = renderDialog();

    fireEvent.click(dialog());

    expect(onClose).not.toHaveBeenCalled();
  });

  /** **X 손잡이가 없다**(`showCloseButton={false}`) — 남는 버튼은 둘뿐이다. */
  it('닫기 손잡이가 없다', () => {
    renderDialog();

    expect(
      within(dialog()).queryByRole('button', { name: messages.common.close }),
    ).not.toBeInTheDocument();
    expect(within(dialog()).getAllByRole('button')).toHaveLength(2);
  });

  /**
   * **Escape는 디자인 시스템이 막을 수단을 주지 않는다.** 그래서 이 창의 규율은 「닫히지 않게」가
   * 아니라 **「닫혀도 나가는 요청이 무너지지 않게」**다 — 창은 닫힘을 화면에 알리기만 하고,
   * 되돌리는 일(`reset`)을 하지 않는다. 그 규율의 화면 쪽 감지기는 `screen.test.tsx`에 있다.
   */
  it('Escape로 닫히면 그 사실만 화면에 알린다', () => {
    const { onClose, onConfirm } = renderDialog();

    fireEvent(dialog(), new Event('cancel', { bubbles: false, cancelable: true }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

/**
 * **나가는 중에는 두 버튼을 함께 잠근다** — 실행 버튼만 잠그면 사용자가 닫고 다시 눌러
 * 결재 요청을 두 벌 만든다(공통 훅이 호출마다 새 멱등 키를 만든다).
 */
describe('SubmitConfirmDialog — 나가는 중', () => {
  it('두 버튼이 함께 잠긴다', () => {
    renderDialog({ isSaving: true });

    expect(
      screen.getByRole('button', { name: new RegExp(t.actions.confirmSubmit) }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.keepEditing })).toBeDisabled();
  });

  it('열려 있으면 실행이 한 번만 불린다', async () => {
    const { onConfirm, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: new RegExp(t.actions.confirmSubmit) }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('계속 입력을 누르면 닫기만 한다', async () => {
    const { onConfirm, onClose, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  /**
   * 실패 배너는 **창을 닫지 않고 창 안에** 선다 — 닫아 버리면 무엇이 막았는지 모른 채 같은
   * 버튼을 다시 누른다.
   */
  it('실패 배너 자리가 창 안에 있다', () => {
    renderDialog({ banner: <p>합성 상신 거절</p> });

    expect(within(dialog()).getByText('합성 상신 거절')).toBeInTheDocument();
  });
});
