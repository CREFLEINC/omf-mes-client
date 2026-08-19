import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ExecuteCancelDialog, type ExecuteCancelDialogProps } from './execute-cancel-dialog';

const t = messages.documentProgress;

const DOCUMENT_NO = 'SYN-GR-2026-0001';

const renderDialog = (overrides: Partial<ExecuteCancelDialogProps> = {}) => {
  const props: ExecuteCancelDialogProps = {
    documentNo: DOCUMENT_NO,
    isSaving: false,
    banner: null,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };

  return { ...render(<ExecuteCancelDialog {...props} />), props };
};

describe('ExecuteCancelDialog — 창이 말하는 것 · C4-9', () => {
  /** ⓒ 어느 문서인지 창이 말한다. ⛔ 내부 번호가 아니라 업무 번호다(omf-mes#44). */
  it('대상 문서번호를 말한다', () => {
    renderDialog();

    expect(screen.getByText(t.executeDialog.target(DOCUMENT_NO))).toBeInTheDocument();
  });

  /** 넘겨받은 번호 그대로다 — 창이 지어내지 않는다는 것을 값이 흐르는지로 잰다. */
  it('넘겨받은 문서번호를 그대로 낸다', () => {
    renderDialog({ documentNo: 'SYN-GR-2026-0009' });

    expect(screen.getByText(t.executeDialog.target('SYN-GR-2026-0009'))).toBeInTheDocument();
    expect(screen.queryByText(t.executeDialog.target(DOCUMENT_NO))).not.toBeInTheDocument();
  });

  /**
   * ⓐ **원장에 무엇이 일어나는지 말한다.** 이 조작은 전기된 문서면 원장에 역트랜잭션을 만든다 —
   * 무엇이 일어나는지 모른 채 누르게 하면 확인 창이 형식이 된다.
   */
  it('원장 파급을 말한다', () => {
    renderDialog();

    expect(screen.getByText(t.executeDialog.ledgerImpact)).toBeInTheDocument();
  });

  /**
   * ⭐ **파급을 갈래 없이 단언하지 않는다.** 전기 전 문서면 원장에는 아무것도 생기지 않는다 —
   * 늘 무거운 쪽으로 적으면 화면이 확인하지 않은 것을 단언하게 되고, 그 경고를 몇 번 겪은
   * 사용자는 다음 경고도 흘려 읽는다(전례 `putaway-rule`의 세 갈래와 같은 규율).
   */
  it('원장 파급이 조건을 밝힌 문장이다', () => {
    renderDialog();

    const line = screen.getByText(t.executeDialog.ledgerImpact).textContent ?? '';

    expect(line).toContain('전기된 문서면');
    expect(line).toContain('전기 전이면');
  });

  /**
   * ⓑ ⛔ **되돌릴 수 없다** — 이 창의 요점이자 **전례와 갈리는 자리**다.
   * 전례(`putaway-rule/activation-dialog.tsx`)는 「다시 켤 수 있습니다」라고 말하는데,
   * 여기서는 취소를 되무르는 경로가 **없다.**
   */
  it('되돌릴 수 없다고 말한다', () => {
    renderDialog();

    expect(screen.getByText(t.executeDialog.irreversible)).toBeInTheDocument();
  });

  /**
   * ⛔ **「되돌릴 수 있다」류 문장이 창 어디에도 없다**(계획 §11-1의 사용자 확인 항목을 코드
   * 쪽에서 고정하는 감지기). 문면을 옮겨 적다 전례의 문장이 함께 따라오는 것이 이 단위에서
   * 가장 조용한 결함이다 — 창 **전체 글자**를 훑어 잰다.
   */
  it('되돌릴 수 있다고 읽힐 문장이 창에 없다', () => {
    renderDialog();

    const text = screen.getByRole('dialog').textContent ?? '';

    for (const forbidden of ['되돌릴 수 있', '다시 켤 수 있', '취소를 취소', '철회할 수 있']) {
      expect(text).not.toContain(forbidden);
    }
  });

  /**
   * 세 문장이 **함께** 서야 뜻이 온전하다 — 원장 파급만 읽으면 되돌릴 수 있는 줄 알고,
   * 되돌릴 수 없다는 말만 읽으면 무엇이 되돌아가는지 모른다.
   */
  it('세 문장이 함께 선다', () => {
    renderDialog();

    for (const line of [
      t.executeDialog.target(DOCUMENT_NO),
      t.executeDialog.ledgerImpact,
      t.executeDialog.irreversible,
    ]) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
  });

  it('제목이 취소 실행의 물음이다', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: t.executeDialog.title })).toBeInTheDocument();
  });

  /** 확인 버튼의 문구가 「확인」이 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다. */
  it('확인 버튼이 무엇을 하는지 말한다', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: t.executeDialog.confirm })).toBeInTheDocument();
  });
});

describe('ExecuteCancelDialog — 창의 규율 3종 · C4-10', () => {
  /**
   * **① 스크림 클릭으로 닫히지 않는다**(사본 체크리스트 5번).
   *
   * 되돌릴 수 없는 실행을 확인하는 창이 스치는 클릭에 사라지면 확인 자체가 형식이 된다.
   */
  it('스크림을 눌러도 닫히지 않는다', () => {
    const { props } = renderDialog();

    fireEvent.click(screen.getByRole('dialog'));

    expect(props.onClose).not.toHaveBeenCalled();
  });

  /**
   * **② 창 머리의 X 손잡이가 없다.** 그 손잡이는 진행 상태를 받지 않아 **전송 중에도 눌리며**,
   * 한쪽 문만 잠그면 잠근 적이 없는 것과 같다.
   *
   * **버튼을 이름으로 세지 않고 창 안의 모든 버튼을 센다** — 나가는 길이 하나 늘면 이름을 아는
   * 잣대는 그 길을 비껴간다.
   */
  it('나가는 길이 바닥 버튼 둘뿐이다', () => {
    renderDialog();

    const names = screen.getAllByRole('button').map((button) => button.textContent);

    expect(names).toEqual([t.executeDialog.keepEditing, t.executeDialog.confirm]);
  });

  /** 짝 방향 — 닫는 길 자체는 열려 있어야 한다. 아니면 위 단언이 「닫을 길이 없다」와 같아진다. */
  it('돌아가기를 누르면 닫힌다', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();

    await user.click(screen.getByRole('button', { name: t.executeDialog.keepEditing }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  /**
   * **③ Escape는 막을 수 없다.** native `<dialog>`가 `cancel`을 내고 디자인 시스템이 그것을
   * 닫기 요청으로 무조건 잇는다 — 그러므로 이 창의 규율은 「닫히지 않게」가 아니라 **「닫혀도
   * 나가는 요청이 무너지지 않게」**이고, 그 몫은 창을 여닫는 쪽에 있다(`screen.test.tsx`).
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

describe('ExecuteCancelDialog — 전송 중과 실패', () => {
  /** 연타로 두 번 나가지 않게 한다 — 되돌릴 수 없는 조작이라 두 번 나가면 되돌릴 길이 없다. */
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

    await user.click(screen.getByRole('button', { name: t.executeDialog.confirm }));

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });

  /** 실패해도 창을 닫지 않는다(C4-15) — 닫으면 무엇이 막았는지 모른 채 같은 버튼을 다시 누른다. */
  it('배너 슬롯을 창 안에 낸다', () => {
    renderDialog({ banner: <p>합성 실행 실패</p> });

    expect(screen.getByText('합성 실행 실패')).toBeInTheDocument();
  });
});
