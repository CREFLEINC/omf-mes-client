import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ActivationPane, type ActivationPaneProps } from './activation-pane';

const t = messages.putawayRule;

const renderPane = (overrides: Partial<ActivationPaneProps> = {}) => {
  const props: ActivationPaneProps = {
    action: { kind: 'open', intent: 'deactivate' },
    duplicateUnknownNote: null,
    isLocked: false,
    isSaving: false,
    onStart: vi.fn(),
    ...overrides,
  };

  return { ...render(<ActivationPane {...props} />), props };
};

describe('ActivationPane — 상세가 오기 전', () => {
  /**
   * ⭐ **C4-1.** 목록 응답에는 잠금 토큰이 없어 행에서 곧바로 끄거나 켤 수 없다(위험 R2) —
   * `:activate`에도 `If-Match`가 필수다. 상세 200이 오기 전에는 어느 전환도 낼 수 없다.
   *
   * 그렇다고 자리를 비우지 않는다: 비우면 「아직 못 쓴다」는 사실이 화면 어디에도 없어
   * 사용자가 손잡이를 찾다 만다. 중립 이름으로 **비활성 + 사유**를 세운다(배치 규범 4).
   */
  it('중립 이름의 액션이 사유와 함께 잠긴다', () => {
    renderPane({
      action: {
        kind: 'blocked',
        intent: null,
        reason: t.actionReasons.activationNeedsDetail,
      },
    });

    expect(screen.getByRole('button', { name: t.actions.activation })).toBeDisabled();
    expect(screen.getByText(t.actionReasons.activationNeedsDetail)).toBeInTheDocument();
  });

  /**
   * ⛔ **끄기·켜기 이름을 세우지 않는다.** 사용 여부를 모르는데 「다시 사용」을 세우면
   * 화면이 확인하지 않은 상태를 단언하는 것이고, 그대로 누르면 이미 켜진 규칙에
   * `:activate`가 나가 400이 된다.
   */
  it('끄기·켜기 이름은 서지 않는다', () => {
    renderPane({
      action: {
        kind: 'blocked',
        intent: null,
        reason: t.actionReasons.activationNeedsDetail,
      },
    });

    expect(screen.queryByRole('button', { name: messages.common.deactivate })).toBeNull();
    expect(screen.queryByRole('button', { name: t.actions.activate })).toBeNull();
  });
});

describe('ActivationPane — 지금 상태에서 할 수 있는 쪽 하나', () => {
  /** 둘을 함께 두면 지금 켜져 있는지 꺼져 있는지가 버튼에서 읽히지 않는다. */
  it('켜진 규칙에는 「사용 중지」만 선다', () => {
    renderPane({ action: { kind: 'open', intent: 'deactivate' } });

    expect(screen.getByRole('button', { name: messages.common.deactivate })).toBeEnabled();
    expect(screen.queryByRole('button', { name: t.actions.activate })).toBeNull();
    expect(screen.queryByRole('button', { name: t.actions.activation })).toBeNull();
  });

  it('꺼진 규칙에는 「다시 사용」만 선다', () => {
    renderPane({ action: { kind: 'open', intent: 'activate' } });

    expect(screen.getByRole('button', { name: t.actions.activate })).toBeEnabled();
    expect(screen.queryByRole('button', { name: messages.common.deactivate })).toBeNull();
  });

  /** 창을 여는 쪽에 **그리고 있던 갈래를 함께 넘긴다** — 버튼이 말한 것과 창이 여는 것이 갈리지 않는다. */
  it('누르면 그리고 있던 갈래를 그대로 돌려준다', async () => {
    const user = userEvent.setup();
    const { props } = renderPane({ action: { kind: 'open', intent: 'activate' } });

    await user.click(screen.getByRole('button', { name: t.actions.activate }));

    expect(props.onStart).toHaveBeenCalledWith('activate');
  });

  it('끄기도 자기 갈래를 돌려준다', async () => {
    const user = userEvent.setup();
    const { props } = renderPane({ action: { kind: 'open', intent: 'deactivate' } });

    await user.click(screen.getByRole('button', { name: messages.common.deactivate }));

    expect(props.onStart).toHaveBeenCalledWith('deactivate');
  });
});

describe('ActivationPane — 막힘과 잠금', () => {
  /** 막힌 사유는 감추지 않고 항상 보이는 글로 낸다 — 비활성 컨트롤은 포커스를 받지 못한다. */
  it('막힌 사유가 있으면 사유와 함께 잠긴다', () => {
    renderPane({
      action: {
        kind: 'blocked',
        intent: 'activate',
        reason: t.actionReasons.activateDuplicate(2),
      },
    });

    expect(screen.getByRole('button', { name: t.actions.activate })).toBeDisabled();
    expect(screen.getByText(t.actionReasons.activateDuplicate(2))).toBeInTheDocument();
  });

  /** G-30 ② **막을 것은 전역** — 남의 요청이 나가는 중이면 잠그되 무엇을 기다리는지 밝힌다. */
  it('남의 요청이 나가는 중이면 사유와 함께 잠기고 진행 표시를 돌지 않는다', () => {
    renderPane({ isLocked: true, isSaving: false });

    expect(screen.getByRole('button', { name: messages.common.deactivate })).toBeDisabled();
    expect(screen.getByText(t.actionReasons.activationLockedByOtherSave)).toBeInTheDocument();
  });

  /**
   * G-30 ① **가릴 것은 대상에만** — 내 전환이 나가는 중이면 진행 표시가 사유 자리를 대신한다.
   * 두 사실(내 요청 / 남의 요청)을 한 문구로 뭉개지 않는다.
   */
  it('내 전환이 나가는 중이면 진행 표시가 돌고 남의 요청 사유를 내지 않는다', () => {
    renderPane({ isLocked: true, isSaving: true });

    expect(screen.getByRole('button', { name: messages.common.deactivate })).toBeDisabled();
    expect(screen.queryByText(t.actionReasons.activationLockedByOtherSave)).not.toBeInTheDocument();
  });

  /**
   * 잠금이 막힌 사유보다 앞이다 — 뒤에 두면 남의 요청이 나가는 중인데 화면이
   * 「중복 때문에 막혔다」고 말한다(고칠 수 없는 것을 고치라고 시킨다).
   */
  it('잠금과 막힌 사유가 함께면 잠금 사유가 선다', () => {
    renderPane({
      action: {
        kind: 'blocked',
        intent: 'activate',
        reason: t.actionReasons.activateDuplicate(2),
      },
      isLocked: true,
    });

    expect(screen.getByText(t.actionReasons.activationLockedByOtherSave)).toBeInTheDocument();
    expect(screen.queryByText(t.actionReasons.activateDuplicate(2))).not.toBeInTheDocument();
  });
});

describe('ActivationPane — 판정하지 못한 중복', () => {
  /** **막지 않되 말한다** — 계약이 같은 조건을 다시 검사하므로 막을 이유가 없다(C3-9 잣대). */
  it('판정 불가 안내가 서고 버튼은 열려 있다', () => {
    renderPane({
      action: { kind: 'open', intent: 'activate' },
      duplicateUnknownNote: t.notes.activateDuplicateUnknown,
    });

    expect(screen.getByText(t.notes.activateDuplicateUnknown)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.activate })).toBeEnabled();
  });

  /** 안내를 넘기지 않으면 서지 않는다 — 짝 방향이 없으면 「늘 선다」로 그려도 통과한다. */
  it('안내가 없으면 서지 않는다', () => {
    renderPane({ action: { kind: 'open', intent: 'activate' }, duplicateUnknownNote: null });

    expect(screen.queryByText(t.notes.activateDuplicateUnknown)).not.toBeInTheDocument();
  });
});
