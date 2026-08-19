import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RequestCancelDialog, type RequestCancelDialogProps } from './request-cancel-dialog';

const t = messages.documentProgress;

const DOCUMENT_NO = 'SYN-GR-2026-0001';

const renderDialog = (overrides: Partial<RequestCancelDialogProps> = {}) => {
  const props: RequestCancelDialogProps = {
    documentNo: DOCUMENT_NO,
    isSaving: false,
    banner: null,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };

  return { ...render(<RequestCancelDialog {...props} />), props };
};

describe('RequestCancelDialog — 창이 말하는 것', () => {
  /**
   * ⭐ **어느 문서인지 창이 말한다**(완료 조건 C3-6). 목록에서 고른 뒤 창이 뜨기까지 사이가 있고,
   * 이 화면은 여러 문서를 오가며 본다 — 대상을 밝히지 않으면 무엇을 확인한 것인지 모른다.
   *
   * ⛔ **내부 번호가 아니라 업무 번호다**(omf-mes#44).
   */
  it('대상 문서번호를 말한다', () => {
    renderDialog();

    expect(screen.getByText(t.cancelDialog.target(DOCUMENT_NO))).toBeInTheDocument();
  });

  /** 넘겨받은 번호 그대로다 — 창이 지어내지 않는다는 것을 값이 흐르는지로 잰다. */
  it('넘겨받은 문서번호를 그대로 낸다', () => {
    renderDialog({ documentNo: 'SYN-GR-2026-0009' });

    expect(screen.getByText(t.cancelDialog.target('SYN-GR-2026-0009'))).toBeInTheDocument();
    expect(screen.queryByText(t.cancelDialog.target(DOCUMENT_NO))).not.toBeInTheDocument();
  });

  /**
   * ⭐ **승인을 탄다는 사실**(C3-6 ⓐ). 지금 취소되는 것이 아니다 — 이 문장이 없으면 사용자는
   * 누른 뒤 문서가 그대로인 것을 결함으로 읽는다.
   */
  it('승인을 탄다고 말한다', () => {
    renderDialog();

    expect(screen.getByText(t.cancelDialog.approval)).toBeInTheDocument();
  });

  /**
   * ⭐ **철회할 수 없다는 사실**(C3-6 ⓑ). 상신을 되무르는 오퍼레이션이 승인 계약에 **없다**
   * (omf-mes#87) — 무를 수 있다고 읽히면 사용자가 가볍게 누른다.
   *
   * ⚠ 전례(`putaway-rule/activation-dialog.tsx`)와 **갈리는 자리**다. 그 창은 되돌릴 수 있음을
   * 함께 말하는데 여기서는 되돌리는 경로가 없다.
   */
  it('철회할 수 없다고 말한다', () => {
    renderDialog();

    expect(screen.getByText(t.cancelDialog.noWithdraw)).toBeInTheDocument();
  });

  /**
   * 세 문장이 **함께** 서야 뜻이 온전하다 — 하나만 서면 「승인을 탄다」만 읽고 무를 수 있다고
   * 여기거나, 「철회할 수 없다」만 읽고 지금 취소되는 줄 안다. 한 자리에서 셋을 함께 센다.
   */
  it('세 문장이 함께 선다', () => {
    renderDialog();

    for (const line of [
      t.cancelDialog.target(DOCUMENT_NO),
      t.cancelDialog.approval,
      t.cancelDialog.noWithdraw,
    ]) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
  });

  /** 제목이 사용자가 가장 먼저 읽는 문장이다 — 무엇을 확인하는 창인지 제목이 정한다. */
  it('제목이 취소 요청의 물음이다', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: t.cancelDialog.title })).toBeInTheDocument();
  });

  /** 확인 버튼의 문구가 「확인」이 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다. */
  it('확인 버튼이 무엇을 하는지 말한다', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: t.cancelDialog.confirm })).toBeInTheDocument();
  });
});

describe('RequestCancelDialog — 창의 규율 3종', () => {
  /**
   * **① 스크림 클릭으로 닫히지 않는다**(사본 체크리스트 5번 · 완료 조건 C3-7).
   *
   * 되돌릴 수 없는 상신을 확인하는 창이 스치는 클릭에 사라지면 확인 자체가 형식이 된다.
   */
  it('스크림을 눌러도 닫히지 않는다', () => {
    const { props } = renderDialog();

    fireEvent.click(screen.getByRole('dialog'));

    expect(props.onClose).not.toHaveBeenCalled();
  });

  /**
   * **② 창 머리의 X 손잡이가 없다**(C3-7). 그 손잡이는 진행 상태를 받지 않아 **전송 중에도
   * 눌리며**, 한쪽 문만 잠그면 잠근 적이 없는 것과 같다.
   *
   * **버튼을 이름으로 세지 않고 창 안의 모든 버튼을 센다** — 나가는 길이 하나 늘면 이름을 아는
   * 잣대는 그 길을 비껴간다.
   */
  it('나가는 길이 바닥 버튼 둘뿐이다', () => {
    renderDialog();

    const names = screen.getAllByRole('button').map((button) => button.textContent);

    expect(names).toEqual([t.cancelDialog.keepEditing, t.cancelDialog.confirm]);
  });

  /** 짝 방향 — 닫는 길 자체는 열려 있어야 한다. 아니면 위 단언이 「닫을 길이 없다」와 같아진다. */
  it('돌아가기를 누르면 닫힌다', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();

    await user.click(screen.getByRole('button', { name: t.cancelDialog.keepEditing }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  /**
   * **③ Escape는 막을 수 없다**(C3-8의 창 쪽 절반). native `<dialog>`가 `cancel`을 내고 디자인
   * 시스템이 그것을 닫기 요청으로 무조건 잇는다 — 그러므로 이 창의 규율은 「닫히지 않게」가
   * 아니라 **「닫혀도 나가는 요청이 무너지지 않게」**이고, 그 몫은 창을 여닫는 쪽에 있다
   * (`screen.test.tsx`의 「창을 닫아도 취소 요청의 되먹임이 끊기지 않는다」).
   */
  it('Escape는 전송 중에도 닫기 요청으로 이어진다', () => {
    const { props } = renderDialog({ isSaving: true });

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});

describe('RequestCancelDialog — 전송 중과 실패', () => {
  /** 연타로 두 번 나가지 않게 한다 — 쓰기 훅이 호출마다 새 멱등 키를 만든다. */
  it('전송 중에는 창 안의 모든 버튼이 잠긴다', () => {
    renderDialog({ isSaving: true });

    const buttons = screen.getAllByRole('button');

    // 선행 단언 — 버튼이 실제로 있어야 「전부 잠겼다」가 뜻을 갖는다.
    expect(buttons.length).toBeGreaterThan(1);
    for (const button of buttons) expect(button).toBeDisabled();
  });

  /** 짝 방향 — 전송 중이 아니면 눌린다. 아니면 위 단언이 「늘 잠겨 있다」와 같아진다. */
  it('전송 중이 아니면 확인이 눌린다', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();

    await user.click(screen.getByRole('button', { name: t.cancelDialog.confirm }));

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });

  /** 실패해도 창을 닫지 않는다 — 닫으면 사용자는 무엇이 막았는지 모른 채 같은 버튼을 다시 누른다. */
  it('배너 슬롯을 창 안에 낸다', () => {
    renderDialog({ banner: <p>합성 취소 요청 실패</p> });

    expect(screen.getByText('합성 취소 요청 실패')).toBeInTheDocument();
  });
});
