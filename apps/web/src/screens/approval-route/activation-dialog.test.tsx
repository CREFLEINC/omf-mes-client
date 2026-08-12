import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ActivationDialog, type ActivationDialogProps } from './activation-dialog';

const t = messages.approvalRoute;

const renderDialog = (overrides: Partial<ActivationDialogProps> = {}) => {
  const props: ActivationDialogProps = {
    intent: 'deactivate',
    approvalTypeCode: 'SAMPLE-TYPE-A',
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

    expect(screen.getByText(t.dialog.deactivateBlocks('SAMPLE-TYPE-A'))).toBeInTheDocument();
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

    expect(screen.getByText(t.dialog.activateOpens('SAMPLE-TYPE-A'))).toBeInTheDocument();
    expect(screen.getByText(t.dialog.activateStepCount(2))).toBeInTheDocument();
  });

  /** 두 갈래가 서로 다른 사실을 말해야 한다 — 같은 본문을 쓰면 사실과 다른 안내가 나간다. */
  it('끄기의 문장을 내지 않는다', () => {
    renderDialog({ intent: 'activate' });

    expect(screen.queryByText(t.dialog.deactivateBlocks('SAMPLE-TYPE-A'))).not.toBeInTheDocument();
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

    expect(screen.getByText(t.dialog.deactivateBlocks('SAMPLE-TYPE-A'))).toBeInTheDocument();
    expect(container.textContent).not.toContain('9001');
  });

  /** 전송 중에는 연타로 두 번 나가지 않게 한다 — 멱등 키가 호출마다 새로 만들어진다(#55). */
  it('전송 중에는 두 버튼이 모두 잠긴다', () => {
    renderDialog({ isSaving: true });

    expect(screen.getByRole('button', { name: messages.common.deactivate })).toBeDisabled();
    expect(screen.getByRole('button', { name: messages.common.cancel })).toBeDisabled();
  });

  /** 실패해도 창을 닫지 않는다 — 닫으면 사용자는 무엇이 막았는지 모른 채 같은 버튼을 다시 누른다. */
  it('배너 슬롯을 창 안에 낸다', () => {
    renderDialog({ banner: <p>합성 저장 실패</p> });

    expect(screen.getByText('합성 저장 실패')).toBeInTheDocument();
  });
});
