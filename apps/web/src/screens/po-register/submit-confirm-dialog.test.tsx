import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { NO_BREAK_SPACE } from './reason-draft';
import { SubmitConfirmDialog, type SubmitSummary } from './submit-confirm-dialog';

const t = messages.poRegister;

/** 배너 슬롯이 실제로 창 안에 그려지는지 재려고 두는 글자. */
const BANNER_TEXT = '합성 상신 실패 배너';

const SUMMARY: SubmitSummary = {
  purchaseOrderNo: 'SAMPLE-PO-9001',
  reason: '초과 입하분 정산 발주\n\n  입하 전표 SAMPLE-IR-9101의 초과분',
  reasonFirstLine: '초과 입하분 정산 발주',
};

const renderDialog = (overrides: Partial<SubmitSummary> = {}, isSaving = false) => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  render(
    <SubmitConfirmDialog
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

describe('SubmitConfirmDialog — 무엇을 올리는가', () => {
  /** 어느 전표를 올리는지 되보인다 — 확인 창에서 **처음 보는 값이 없어야** 한다. */
  it('전표번호를 되보인다', () => {
    renderDialog();

    expect(within(dialog()).getByText('SAMPLE-PO-9001')).toBeVisible();
    expect(within(dialog()).getByText(t.dialog.submitLead)).toBeVisible();
  });

  /**
   * **전문과 첫 줄을 나눠 보인다**(계획 결정 15 · 공유계약 A-12).
   *
   * 첫 줄만 보이면 무엇을 보내는지 모르고, 전문만 보이면 어느 줄이 결재함 목록에서 요약으로
   * 보일지 모른다.
   */
  it('사유 전문과 첫 줄을 나눠 보이고 요약 노릇을 밝힌다', () => {
    renderDialog();

    const full = screen.getByRole('region', { name: t.dialog.reasonFull });
    const first = screen.getByRole('region', { name: t.dialog.reasonFirstLine });

    expect(within(full).getByText('초과 입하분 정산 발주')).toBeVisible();
    expect(within(first).getByText('초과 입하분 정산 발주')).toBeVisible();
    expect(screen.getByText(t.dialog.reasonSummaryNote)).toBeVisible();
  });

  /**
   * 줄바꿈이 뜻을 나른다 — 한 줄로 이어 붙이면 문단 구분이 사라진다.
   *
   * **접근성 조회로 재지 않는다.** 이름으로 집는 조회는 공백을 접어 U+00A0과 보통 공백을
   * 가르지 못하는데, **빈 줄과 들여쓰기가 보이는 글자로 남는가**가 이 잣대의 요점이라 DOM을
   * 직접 센다(전례와 같은 처리).
   */
  it('전문의 줄바꿈과 들여쓰기를 살린다', () => {
    renderDialog();

    const full = screen.getByRole('region', { name: t.dialog.reasonFull });
    const lines = [...full.querySelectorAll('p')].map((node) => node.textContent);

    expect(lines).toEqual([
      t.dialog.reasonFull,
      '초과 입하분 정산 발주',
      NO_BREAK_SPACE,
      `${NO_BREAK_SPACE.repeat(2)}입하 전표 SAMPLE-IR-9101의 초과분`,
    ]);
  });

  /** 첫 줄이 전문과 다른 갈래 — 요약 자리에 **실제로 첫 줄만** 선다. */
  it('전문이 여러 줄이어도 요약 자리에는 첫 줄만 선다', () => {
    renderDialog({ reason: '요약 줄\n둘째 줄', reasonFirstLine: '요약 줄' });

    const first = screen.getByRole('region', { name: t.dialog.reasonFirstLine });

    expect(within(first).getByText('요약 줄')).toBeVisible();
    expect(within(first).queryByText('둘째 줄')).not.toBeInTheDocument();
  });
});

describe('SubmitConfirmDialog — 무엇을 말하는가', () => {
  /** 되돌릴 수 없다는 **사실을 정확히** 말한다 — 반려 뒤 재상신은 새 요청이다. */
  it('되돌릴 수 없다는 사실을 적는다', () => {
    renderDialog();

    expect(screen.getByText(t.dialog.submitNoUndo)).toBeVisible();
  });

  /**
   * **승인 주체를 화면이 정하지 않는다**(착수 이슈 §6 ④ · 계획 결정 8).
   *
   * 계약의 본문이 사유 한 칸이라 승인 유형·승인자·결재선을 보낼 자리가 없다 — 창이 그 사실을
   * 적지 않으면 사용자가 「결재선을 고르지 않았다」를 결함으로 읽는다.
   */
  it('승인자·결재선을 이 화면이 정하지 않는다고 적는다', () => {
    renderDialog();

    expect(screen.getByText(t.dialog.submitApprover)).toBeVisible();
  });
});

describe('SubmitConfirmDialog — 스치는 클릭으로 닫히지 않는다', () => {
  /**
   * **X 손잡이가 없다**(`showCloseButton={false}` · 사본 체크리스트 5번).
   *
   * 되돌릴 수 없는 조작의 확인이 스치는 클릭에 사라지면 확인이 형식이 된다. **버리기 창과
   * 갈리는 자리다** — 그쪽은 닫혀도 잃는 것이 없다.
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
   * 디자인 시스템은 스크림 클릭을 **`<dialog>` 자신이 클릭 대상일 때**로 판정한다(패널은 그
   * 안의 자식이다) — 그래서 창 요소를 직접 눌러 그 길을 잰다.
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

    await user.click(screen.getByRole('button', { name: t.actions.confirmSubmit }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  /**
   * **Escape는 막을 수 없다 — 그래서 규율이 다르다**(사본 체크리스트 5번의 셋째 방어).
   *
   * native `<dialog>`가 `cancel`을 내고 디자인 시스템이 그것을 닫기 요청으로 무조건 잇는다.
   * 규율은 「닫히지 않게」가 아니라 **「닫혀도 무너지지 않게」**이고, 이 부품이 지는 몫은
   * **그 요청을 상신으로 잇지 않는 것**이다 — 스크림·X를 막아 둔 창이 Escape 한 번에 결재를
   * 올리면 세 방어가 모두 뜻을 잃는다.
   *
   * jsdom은 Escape 키를 native 취소로 잇지 않으므로 브라우저가 내는 이벤트를 직접 만든다.
   * **나가는 중 화면이 무너지지 않는가**는 화면 층이 따로 잰다(`screen.test.tsx` · 두 겹).
   */
  it('Escape는 닫기 요청으로 이어지고 상신으로 이어지지 않는다', () => {
    const { onClose, onConfirm } = renderDialog();

    fireEvent(dialog(), new Event('cancel', { bubbles: false, cancelable: true }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('나가는 중 Escape도 상신으로 이어지지 않는다', () => {
    const { onClose, onConfirm } = renderDialog({}, true);

    fireEvent(dialog(), new Event('cancel', { bubbles: false, cancelable: true }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  /**
   * **실행 버튼의 글자가 화면의 「승인 요청」과 갈려 있다.** 같은 글자면 창이 열린 동안 두
   * 버튼이 같은 이름으로 서고, 조작하는 쪽도 재는 쪽도 어느 것이 창의 버튼인지 가릴 수 없다.
   */
  it('실행 버튼이 화면의 승인 요청 버튼과 다른 이름이다', () => {
    renderDialog();

    expect(within(dialog()).getByRole('button', { name: t.actions.confirmSubmit })).toBeVisible();
    expect(
      within(dialog()).queryByRole('button', { name: t.actions.requestApproval }),
    ).not.toBeInTheDocument();
  });

  /** 창은 **확인하는 자리**다 — 고칠 것이 있으면 닫고 결과 구획의 사유 칸에서 고친다. */
  it('창 안에 입력칸·선택칸이 없다', () => {
    renderDialog();

    expect(within(dialog()).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(dialog()).queryAllByRole('combobox')).toHaveLength(0);
  });
});

describe('SubmitConfirmDialog — 나가는 중', () => {
  /** 실행 버튼만 잠그고 닫기를 열어 두면 사용자가 닫고 다시 눌러 결재 요청을 두 벌 만든다. */
  it('나가는 중에는 두 버튼이 함께 잠긴다', () => {
    renderDialog({}, true);

    expect(screen.getByRole('button', { name: t.actions.keepEditing })).toBeDisabled();
    expect(
      within(dialog()).getByRole('button', { name: new RegExp(t.actions.confirmSubmit) }),
    ).toBeDisabled();
  });

  /** 실패 배너는 **창 안에** 선다 — 창을 닫지 않고 이유를 보여야 다시 시도할 수 있다. */
  it('배너 슬롯이 창 안에 그려진다', () => {
    renderDialog();

    expect(within(dialog()).getByText(BANNER_TEXT)).toBeVisible();
  });

  /**
   * **내부 번호를 담지 않는다**(`omf-mes#44`). 짝으로 업무 번호는 실제로 보인다.
   *
   * **업무 번호 안의 숫자는 세지 않는다** — 전표번호·입하번호는 사용자가 나중에 그 전표를
   * 찾는 값이라 보이는 것이 맞고, 그 글자 안에 같은 숫자가 들어 있다. 여기서 세는 것은
   * **업무 번호 밖에서** 내부 번호가 글자로 나타나는가다.
   */
  it('업무 번호는 보이고 그 밖에 내부 번호가 없다', () => {
    renderDialog();

    expect(within(dialog()).getByText('SAMPLE-PO-9001')).toBeVisible();

    const text = (dialog().textContent ?? '')
      .split('SAMPLE-PO-9001')
      .join('')
      .split('SAMPLE-IR-9101')
      .join('');

    for (const id of ['9001', '9101', '9801']) expect(text).not.toContain(id);
  });
});
