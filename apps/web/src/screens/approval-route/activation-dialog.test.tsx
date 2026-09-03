import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ActivationDialog, type ActivationDialogProps } from './activation-dialog';

const t = messages.approvalRoute;

const renderDialog = (overrides: Partial<ActivationDialogProps> = {}) => {
  const props: ActivationDialogProps = {
    intent: 'deactivate',
    approvalTypeCode: 'GOODS_ISSUE_DISPOSAL',
    inProgressCount: 3,
    stepCount: 2,
    isSaving: false,
    banner: null,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };

  return { ...render(<ActivationDialog {...props} />), props };
};

describe('ActivationDialog — 사용 중지', () => {
  /** 계약에 이 오퍼레이션의 400이 아예 없다 — 화면 경고가 유일한 방어다. */
  it('무엇이 막히는지를 승인 유형과 함께 말한다', () => {
    renderDialog();

    expect(screen.getByText(t.dialog.deactivateBlocks('GOODS_ISSUE_DISPOSAL'))).toBeInTheDocument();
  });

  it('진행 중인 요청이 그대로 진행된다는 사실을 건수와 함께 말한다', () => {
    renderDialog();

    expect(screen.getByText(t.dialog.deactivateInProgress(3))).toBeInTheDocument();
  });

  /** 건수는 응답이 실어 온 값이다 — 화면이 세지 않는다는 것을 값이 흐르는지로 잰다. */
  it('건수를 넘겨받은 값 그대로 낸다', () => {
    renderDialog({ inProgressCount: 7 });

    expect(screen.getByText(t.dialog.deactivateInProgress(7))).toBeInTheDocument();
    expect(screen.queryByText(t.dialog.deactivateInProgress(3))).not.toBeInTheDocument();
  });

  it('진행 중인 요청이 없으면 없다고 말한다', () => {
    renderDialog({ inProgressCount: 0 });

    expect(screen.getByText(t.dialog.deactivateInProgressNone)).toBeInTheDocument();
    expect(screen.queryByText(t.dialog.deactivateInProgress(0))).not.toBeInTheDocument();
  });

  it('되돌릴 수 있다는 사실을 말한다', () => {
    renderDialog();

    expect(screen.getByText(t.dialog.deactivateReversible)).toBeInTheDocument();
  });

  it('확인 버튼이 「사용 중지」다', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();

    await user.click(screen.getByRole('button', { name: messages.common.deactivate }));

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('ActivationDialog — 다시 사용', () => {
  it('무엇이 열리는지와 단계 수를 말한다', () => {
    renderDialog({ intent: 'activate' });

    expect(screen.getByText(t.dialog.activateOpens('GOODS_ISSUE_DISPOSAL'))).toBeInTheDocument();
    expect(screen.getByText(t.dialog.activateStepCount(2))).toBeInTheDocument();
  });

  /** 두 갈래가 서로 다른 사실을 말해야 한다 — 같은 본문을 쓰면 사실과 다른 안내가 나간다. */
  it('끄기의 문장을 내지 않는다', () => {
    renderDialog({ intent: 'activate' });

    expect(
      screen.queryByText(t.dialog.deactivateBlocks('GOODS_ISSUE_DISPOSAL')),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(t.dialog.deactivateInProgress(3))).not.toBeInTheDocument();
  });

  it('확인 버튼이 「다시 사용」이다', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog({ intent: 'activate' });

    await user.click(screen.getByRole('button', { name: t.actions.activate }));

    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('ActivationDialog — 창의 경계', () => {
  /**
   * **창 안에 펼침 목록을 두지 않는다**(#45). 짝 방향으로 잰다 —
   * 아무것도 그리지 않아도 통과하는 단언이 되지 않게 본문이 실제로 섰는지를 먼저 본다.
   */
  it('선택칸이 없다', () => {
    renderDialog();

    expect(screen.getByText(t.dialog.deactivateReversible)).toBeInTheDocument();
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.queryAllByRole('listbox')).toHaveLength(0);
  });

  it('내부 번호를 내지 않는다', () => {
    const { container } = renderDialog();

    expect(screen.getByText(t.dialog.deactivateBlocks('GOODS_ISSUE_DISPOSAL'))).toBeInTheDocument();
    expect(container.textContent).not.toContain('9001');
  });

  /**
   * **창에서 나가는 길을 바닥 둘로 좁힌다.**
   *
   * 디자인 시스템 `Dialog`는 머리에 X 손잡이를 기본으로 그리는데 **그 손잡이는 진행 상태를
   * 받지 않는다** — 전송 중에도 눌린다. 스크림을 막은 이유(「되돌리기에 다른 사람의 업무가
   * 걸린 확인 창이 실수로 사라지면 안 된다」)가 이 손잡이에도 그대로 적용된다.
   * 한쪽 문만 잠그면 잠근 적이 없는 것과 같다.
   */
  it('창 머리에 닫기 손잡이를 두지 않는다', () => {
    renderDialog();

    // 선행 단언 — 나가는 길 자체는 있어야 한다. 없으면 이 단언이 「갇힌 창」과 구별되지 않는다.
    expect(screen.getByRole('button', { name: messages.common.cancel })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.close })).toBeNull();
  });

  /**
   * 전송 중에는 연타로 두 번 나가지 않게 한다 — 멱등 키가 호출마다 새로 만들어진다(#55).
   *
   * **버튼을 이름으로 세지 않고 창 안의 모든 버튼을 센다** — 나가는 길이 하나 늘면
   * 이름을 아는 잣대는 그 길을 비껴간다.
   */
  it('전송 중에는 창 안의 모든 버튼이 잠긴다', () => {
    renderDialog({ isSaving: true });

    const buttons = screen.getAllByRole('button');

    // 선행 단언 — 버튼이 실제로 있어야 「전부 잠겼다」가 뜻을 갖는다.
    expect(buttons.length).toBeGreaterThan(1);
    for (const button of buttons) expect(button).toBeDisabled();
  });

  /**
   * **Escape는 막을 수 없다** — native `<dialog>`가 `cancel`을 내고 디자인 시스템이 그것을
   * 닫기 요청으로 무조건 잇는다. 그러므로 「닫히지 않게」가 아니라 **「닫혀도 무너지지 않게」**가
   * 이 화면의 규율이다(`screen.test.tsx`의 「창을 닫아도 전환의 되먹임이 끊기지 않는다」).
   */
  it('Escape는 닫기 요청으로 이어진다', () => {
    const { props } = renderDialog({ isSaving: true });

    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { bubbles: false, cancelable: true }),
    );

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  /**
   * **스크림 클릭으로 닫히지 않는다.**
   *
   * 되돌리기에 다른 사람의 업무가 걸린 확인 창이 실수로 사라지면 사용자는 자기가 무엇을
   * 취소했는지 모른다 — 초안 파기 창이 **일부러 열어 두는 것**과 정확히 반대 자리다
   * (`discard-confirm-dialog.test.tsx`가 그 반대 방향을 잰다).
   */
  it('스크림을 눌러도 닫히지 않는다', () => {
    const { props } = renderDialog();

    fireEvent.click(screen.getByRole('dialog'));

    expect(props.onClose).not.toHaveBeenCalled();
  });

  /** 짝 방향 — 닫는 길 자체는 열려 있어야 한다. 안 그러면 위 단언이 「닫을 길이 없다」와 같아진다. */
  it('취소를 누르면 닫힌다', async () => {
    const user = userEvent.setup();
    const { props } = renderDialog();

    await user.click(screen.getByRole('button', { name: messages.common.cancel }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  /** 실패해도 창을 닫지 않는다 — 닫으면 사용자는 무엇이 막았는지 모른 채 같은 버튼을 다시 누른다. */
  it('배너 슬롯을 창 안에 낸다', () => {
    renderDialog({ banner: <p>합성 저장 실패</p> });

    expect(screen.getByText('합성 저장 실패')).toBeInTheDocument();
  });
});
