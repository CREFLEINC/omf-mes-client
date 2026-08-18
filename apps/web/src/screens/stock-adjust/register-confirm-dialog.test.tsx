import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RegisterConfirmDialog, type RegisterSummary } from './register-confirm-dialog';

const t = messages.stockAdjust;

/** 배너 슬롯이 실제로 창 안에 그려지는지 재려고 두는 글자. */
const BANNER_TEXT = '합성 실패 배너';

const SUMMARY: RegisterSummary = {
  reasonCode: 'SAMPLE_AR_A',
  sendToErp: true,
  includedCount: 2,
  excludedCount: 1,
  hasCountRef: true,
};

const renderDialog = (overrides: Partial<RegisterSummary> = {}, isSaving = false) => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  render(
    <RegisterConfirmDialog
      summary={{ ...SUMMARY, ...overrides }}
      isSaving={isSaving}
      banner={<p>{BANNER_TEXT}</p>}
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  );

  return { onConfirm, onClose, user: userEvent.setup() };
};

const dialog = (): HTMLElement => screen.getByRole('dialog');

describe('RegisterConfirmDialog — 무엇을 만드는가', () => {
  it('사유·ERP 송신 여부·실릴 줄 수를 되보인다', () => {
    renderDialog();

    expect(screen.getByText('SAMPLE_AR_A')).toBeVisible();
    expect(screen.getByText(t.dialog.sendToErpOn)).toBeVisible();
    expect(screen.getByText(t.dialog.includedLineCount(2))).toBeVisible();
  });

  it('ERP 송신을 껐으면 그 사실이 보인다', () => {
    renderDialog({ sendToErp: false });

    expect(screen.getByText(t.dialog.sendToErpOff)).toBeVisible();
  });

  /**
   * ⭐ **빠지는 줄 수를 창이 밝힌다**(C19 · D-4).
   *
   * 표의 「제외」 표식을 못 본 채 확인하는 길이 있고, 그때 사용자가 확인한 줄 수와 실제로
   * 나가는 줄 수가 갈린다 — 되돌릴 수 없는 쓰기 앞의 조용한 누락이다.
   */
  it('차이가 0이라 빠지는 줄 수를 밝힌다', () => {
    renderDialog();

    expect(screen.getByText(t.dialog.excludedLineCount(1))).toBeVisible();
  });

  /** 짝 방향 — 빠지는 줄이 없다는 것도 말한다. 없을 때 침묵하면 확인이 반쪽이 된다. */
  it('빠지는 줄이 없으면 그 사실을 말한다', () => {
    renderDialog({ excludedCount: 0 });

    expect(screen.getByText(t.dialog.noExcludedLine)).toBeVisible();
    expect(screen.queryByText(t.dialog.excludedLineCount(0))).not.toBeInTheDocument();
  });

  /** 실사 참조가 **없는 것이 정상이다**(조심 ⑤) — 경고가 아니라 사실로 적는다. */
  it('실사에서 불러온 조정이면 대상 실사가 있다고 적는다', () => {
    renderDialog();

    expect(within(dialog()).getByText(t.dialog.countRef)).toBeVisible();
  });

  it('직접 등록이면 대상 실사가 「—」다', () => {
    renderDialog({ hasCountRef: false });

    expect(within(dialog()).getByText(t.values.empty)).toBeVisible();
  });

  /** **되돌릴 수 없다는 사실**이 실행 버튼 바로 위에 선다. */
  it('되돌릴 수 없다는 사실을 적는다', () => {
    renderDialog();

    expect(screen.getByText(t.dialog.registerNoUndo)).toBeVisible();
  });

  /**
   * **등록이 전기가 아니다.** 이 문장을 적지 않으면 사용자가 이 한 번으로 재고가 움직인 것으로
   * 읽고, 전기하지 않은 조정을 끝난 것으로 믿은 채 화면을 떠난다.
   */
  it('등록만 한다는 사실을 적는다 — 재고는 아직 움직이지 않는다', () => {
    renderDialog();

    expect(screen.getByText(t.dialog.registerIsNotPost)).toBeVisible();
  });

  /** **내부 번호를 담지 않는다**(`omf-mes#44`). 짝으로 사유 코드는 실제로 보인다. */
  it('내부 번호가 창에 없다', () => {
    renderDialog();

    expect(within(dialog()).getByText('SAMPLE_AR_A')).toBeVisible();
    expect(dialog().textContent ?? '').not.toContain('9301');
  });

  /** 실패 배너는 **창 안에** 선다 — 닫아 버리면 무엇이 막았는지 모른 채 다시 누른다(C27). */
  it('실패 배너가 창 안에 선다', () => {
    renderDialog();

    expect(within(dialog()).getByText(BANNER_TEXT)).toBeVisible();
  });
});

describe('RegisterConfirmDialog — 스치는 클릭으로 닫히지 않는다', () => {
  /**
   * **X 손잡이가 없다**(`showCloseButton={false}` · 사본 체크리스트 5번). 되돌릴 수 없는 조작의
   * 확인이 스치는 클릭에 사라지면 확인이 형식이 된다.
   */
  it('닫기 손잡이가 없다', () => {
    renderDialog();

    expect(
      within(dialog()).queryByRole('button', { name: messages.common.close }),
    ).not.toBeInTheDocument();
    expect(within(dialog()).getAllByRole('button')).toHaveLength(2);
  });

  /** **나머지 반쪽**(`closeOnBackdropClick={false}`) — X만 잠그고 스크림을 열어 두면 잠근 적이 없다. */
  it('스크림을 눌러도 닫히지 않는다', () => {
    const { onClose } = renderDialog();

    fireEvent.click(dialog());

    expect(onClose).not.toHaveBeenCalled();
  });

  /** **셋째 방어는 창이 아니라 화면이 진다** — 여기서는 두 버튼의 뜻이 갈리는지만 잰다. */
  it('계속 입력은 닫기만 요청하고 보내지 않는다', async () => {
    const { onConfirm, onClose, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('등록합니다는 보내기만 요청하고 스스로 닫지 않는다', async () => {
    const { onConfirm, onClose, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: t.actions.confirmRegister }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  /** 창 안에 선택칸을 두지 않는다(`omf-mes#45`) — 글자와 버튼뿐이다. */
  it('창 안에 선택칸이 없다', () => {
    renderDialog();

    expect(dialog()).toBeInTheDocument();
    expect(within(dialog()).queryAllByRole('combobox')).toHaveLength(0);
  });
});

describe('RegisterConfirmDialog — 나가는 중', () => {
  /**
   * **두 버튼을 함께 잠근다.** 실행만 잠그면 사용자가 닫고 다시 눌러 전표를 두 벌 만든다
   * (공통 훅이 호출마다 새 멱등 키를 만든다).
   */
  it('보내는 중에는 두 버튼이 모두 잠긴다', () => {
    renderDialog({}, true);

    expect(screen.getByRole('button', { name: t.actions.keepEditing })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.confirmRegister })).toBeDisabled();
  });

  /** 짝 방향 — 나가는 중이 아니면 둘 다 열려 있다. */
  it('보내는 중이 아니면 두 버튼이 모두 열려 있다', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: t.actions.keepEditing })).toBeEnabled();
    expect(screen.getByRole('button', { name: t.actions.confirmRegister })).toBeEnabled();
  });
});
