import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RegisterConfirmDialog, type RegisterSummary } from './register-confirm-dialog';

const t = messages.poRegister;

/** 배너 슬롯이 실제로 창 안에 그려지는지 재려고 두는 글자. */
const BANNER_TEXT = '합성 실패 배너';

const SUMMARY: RegisterSummary = {
  supplier: 'SAMPLE-SUP-01 · 합성 공급사 가',
  orderDate: '2026-08-17',
  lineCount: 2,
  totalQtyText: '19',
  hasMixedUom: false,
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
  /**
   * **네 값을 되보인다**(계획 결정 15). 하나라도 빠지면 사용자가 무엇을 만드는지 모르는 채
   * 확인하게 된다 — 되돌릴 수 없는 조작 앞의 마지막 층이다.
   */
  it('공급사·발주일·라인 수·합계 발주수량을 보인다', () => {
    renderDialog();

    expect(screen.getByText('SAMPLE-SUP-01 · 합성 공급사 가')).toBeVisible();
    expect(screen.getByText('2026-08-17')).toBeVisible();
    expect(screen.getByText(t.dialog.lineCount(2))).toBeVisible();
    expect(screen.getByText('19')).toBeVisible();
  });

  /** 되돌릴 수 없다는 사실이 **실행 버튼 바로 위**에 선다. */
  it('되돌릴 수 없다는 사실을 적는다', () => {
    renderDialog();

    expect(screen.getByText(t.dialog.registerNoUndo)).toBeVisible();
  });

  /**
   * **등록과 승인 요청이 별개라는 사실**(착수 이슈 §6 ③ · 계획 결정 9).
   *
   * 확인 창이 이 문장을 적지 않으면 사용자가 이 한 번으로 결재까지 올라간 것으로 읽고,
   * 상신하지 않은 발주를 올린 것으로 믿은 채 화면을 떠난다.
   */
  it('등록만 한다는 사실을 적는다', () => {
    renderDialog();

    expect(screen.getByText(t.dialog.registerIsNotApproval)).toBeVisible();
  });

  /** 단위가 갈리면 **합계가 한 단위의 수량이 아니라는 사실**을 함께 적는다. */
  it('단위가 갈리면 그 사실이 보인다', () => {
    renderDialog({ hasMixedUom: true });

    expect(screen.getByText(t.dialog.mixedUom)).toBeVisible();
  });

  /** 짝 방향 — 단위가 하나면 그 문장이 없다. 「늘 적는다」로 통과하지 않게 한다. */
  it('단위가 하나면 그 문장이 없다', () => {
    renderDialog();

    expect(screen.queryByText(t.dialog.mixedUom)).not.toBeInTheDocument();
  });

  /** 합계를 낼 수 없으면 **0으로 접지 않고** 그 사실을 글자로 낸다. */
  it('합계를 낼 수 없으면 그 사실이 보인다', () => {
    renderDialog({ totalQtyText: t.dialog.totalUnreadable });

    expect(screen.getByText(t.dialog.totalUnreadable)).toBeVisible();
  });

  /** **내부 번호를 담지 않는다**(`omf-mes#44`). 짝으로 이름은 실제로 보인다. */
  it('이름은 보이고 내부 번호는 없다', () => {
    renderDialog();

    expect(within(dialog()).getByText('SAMPLE-SUP-01 · 합성 공급사 가')).toBeVisible();
    expect(dialog().textContent ?? '').not.toContain('9301');
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

  /**
   * **나머지 반쪽**(`closeOnBackdropClick={false}`). X만 잠그고 스크림을 열어 두면 잠근 적이
   * 없는 것과 같다.
   *
   * 디자인 시스템은 스크림 클릭을 **`<dialog>` 자신이 클릭 대상일 때**로 판정한다(패널은 그 안의
   * 자식이다) — 그래서 창 요소를 직접 눌러 그 길을 잰다.
   */
  it('스크림을 눌러도 닫히지 않는다', () => {
    const { onClose } = renderDialog();

    fireEvent.click(dialog());

    expect(onClose).not.toHaveBeenCalled();
  });

  it('바닥 버튼 둘로만 나간다', async () => {
    const { onConfirm, onClose, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: t.actions.confirmRegister }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  /**
   * **실행 버튼의 글자가 화면의 「등록」과 갈려 있다.** 같은 글자면 창이 열린 동안 두 버튼이
   * 같은 이름으로 서고, 조작하는 쪽도 재는 쪽도 어느 것이 창의 버튼인지 가릴 수 없다.
   */
  it('실행 버튼이 화면의 등록 버튼과 다른 이름이다', () => {
    renderDialog();

    expect(within(dialog()).getByRole('button', { name: t.actions.confirmRegister })).toBeVisible();
    expect(
      within(dialog()).queryByRole('button', { name: t.actions.register }),
    ).not.toBeInTheDocument();
  });

  /** 창 안에 선택칸을 두지 않는다(`omf-mes#45`) — 펼침 목록이 잘린다. */
  it('창 안에 선택칸이 없다', () => {
    renderDialog();

    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
  });
});

/**
 * **나가는 중과 실패**(완료 조건 C19·C25).
 *
 * 실행 버튼만 잠그고 닫기를 열어 두면 사용자가 닫고 다시 눌러 전표를 두 벌 만든다 —
 * 공통 쓰기 훅이 호출마다 새 멱등 키를 만들어 서버에는 다른 요청으로 보인다.
 */
describe('RegisterConfirmDialog — 나가는 중', () => {
  it('나가는 중에는 두 버튼이 함께 잠긴다', () => {
    renderDialog({}, true);

    expect(screen.getByRole('button', { name: t.actions.keepEditing })).toBeDisabled();
    expect(
      within(dialog()).getByRole('button', { name: new RegExp(t.actions.confirmRegister) }),
    ).toBeDisabled();
  });

  /** 실패 배너는 **창 안에** 선다 — 창을 닫지 않고 이유를 보여야 다시 시도할 수 있다. */
  it('배너 슬롯이 창 안에 그려진다', () => {
    renderDialog();

    expect(within(dialog()).getByText(BANNER_TEXT)).toBeVisible();
  });
});
