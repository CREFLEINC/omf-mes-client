import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ExecuteCancelPane, type ExecuteCancelPaneProps } from './execute-cancel-pane';
import { ApiRequestError } from '../../patterns/request';

const t = messages.documentProgress;

const renderPane = (overrides: Partial<ExecuteCancelPaneProps> = {}) => {
  const props: ExecuteCancelPaneProps = {
    hasCancelRequest: true,
    lock: { kind: 'ready' },
    isSaving: false,
    isLocked: false,
    banner: null,
    result: null,
    onOpenConfirm: vi.fn(),
    ...overrides,
  };

  return { ...render(<ExecuteCancelPane {...props} />), props };
};

const executeButton = (): HTMLElement =>
  screen.getByRole('button', { name: t.executeCancel.label });

describe('ExecuteCancelPane — 요청이 없으면 · C4-7의 짝', () => {
  /**
   * ⛔ **잠긴 버튼도 두지 않는다.** 이 자리에서 풀 수 있는 잠금이 아니라 위 구획에서 취소 요청을
   * 올려야 풀린다 — 잠긴 버튼을 두면 사용자가 눌러 보다 만다.
   */
  it('실행 버튼을 그리지 않는다', () => {
    renderPane({ hasCancelRequest: false });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  /** 조작이 없는 이유를 **글자로** 밝힌다 — 빈 자리는 화면이 고장 난 것으로 읽힌다. */
  it('무엇을 하면 서는지 말한다', () => {
    renderPane({ hasCancelRequest: false });

    expect(screen.getByText(t.executeCancel.notRequestedNote)).toBeInTheDocument();
  });

  /* 짝 방향 — 요청이 있으면 버튼이 선다. 아니면 위 단언이 「늘 그리지 않는다」와 같아진다. */
  it('요청이 있으면 실행 버튼이 선다', () => {
    renderPane();

    expect(executeButton()).toBeInTheDocument();
    expect(screen.queryByText(t.executeCancel.notRequestedNote)).not.toBeInTheDocument();
  });
});

describe('ExecuteCancelPane — 잠금 토큰이 버튼을 연다', () => {
  /**
   * ⭐ **200이 오기 전에는 열리지 않는다.** 계약이 `If-Match`를 필수로 두어, 토큰 없이 열면
   * 눌러도 아무 일이 없는 자리가 된다 — 증상이 「눌러도 아무 일이 없다」라 알아채기 어렵다.
   */
  it('토큰을 기다리는 동안 잠기고 그 사실을 말한다', () => {
    renderPane({ lock: { kind: 'preparing' } });

    expect(executeButton()).toBeDisabled();
    expect(screen.getByText(t.executeCancel.preparing)).toBeInTheDocument();
  });

  /** 못 읽었으면 잠기고 **어디를 눌러야 하는지** 가리킨다 — 「다시 시도」는 위 구획이 갖는다. */
  it('토큰을 못 읽었으면 잠기고 어디를 눌러야 하는지 말한다', () => {
    renderPane({ lock: { kind: 'failed', error: new ApiRequestError({ kind: 'network' }) } });

    expect(executeButton()).toBeDisabled();
    expect(screen.getByText(t.executeCancel.lockFailedNote)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });

  it('토큰이 오면 열린다', async () => {
    const user = userEvent.setup();
    const { props } = renderPane();

    expect(executeButton()).toBeEnabled();
    await user.click(executeButton());

    expect(props.onOpenConfirm).toHaveBeenCalledTimes(1);
  });

  /** 잠긴 이유가 버튼과 **이어져** 있어야 보조기술이 함께 읽는다. */
  it('잠긴 이유가 버튼에 이어져 있다', () => {
    renderPane({ lock: { kind: 'preparing' } });

    const describedBy = executeButton().getAttribute('aria-describedby');

    expect(describedBy).not.toBeNull();
    expect(document.getElementById(describedBy ?? '')?.textContent).toBe(t.executeCancel.preparing);
  });

  /** 이유가 없으면 잇지 않는다 — 빈 자리를 가리키는 연결은 보조기술에서 침묵이 된다. */
  it('이유가 없으면 잇지 않는다', () => {
    renderPane();

    expect(executeButton()).not.toHaveAttribute('aria-describedby');
  });
});

describe('ExecuteCancelPane — 나가는 중과 잠금', () => {
  /** 전역 잠금 — 어느 대상이든 취소 조작이 나가는 중이면 잠근다. */
  it('나가는 중이면 잠긴다', () => {
    renderPane({ isLocked: true });

    expect(executeButton()).toBeDisabled();
  });

  /**
   * ⭐ **진행 표시는 대상 매임을 지난다.** 전역 잠금으로 재면 **손대지도 않은 문서가
   * 「실행 중」이라고 말한다** — 두 축을 갈라 둔 이유다.
   *
   * 디자인 시스템은 진행을 `aria-busy`로 낸다(실측) — 그 표식으로 두 축을 각각 잰다.
   */
  it('다른 대상의 실행이 나가는 중이면 잠기되 진행 표시는 서지 않는다', () => {
    renderPane({ isLocked: true, isSaving: false });

    expect(executeButton()).toBeDisabled();
    expect(executeButton()).not.toHaveAttribute('aria-busy');
  });

  /** 짝 방향 — 이 대상의 실행이면 진행 표시가 선다. 아니면 위 단언이 「늘 서지 않는다」와 같다. */
  it('이 대상의 실행이면 진행 표시가 선다', () => {
    renderPane({ isLocked: true, isSaving: true });

    expect(executeButton()).toHaveAttribute('aria-busy', 'true');
  });

  it('실패 배너 슬롯을 구획 안에 낸다', () => {
    renderPane({ banner: <p>합성 실행 실패</p> });

    expect(screen.getByText('합성 실행 실패')).toBeInTheDocument();
  });
});

describe('ExecuteCancelPane — 결과가 구획에 남는다', () => {
  /**
   * ⭐ **되돌릴 수 없는 조작이라 안내 한 줄로 지나가면 안 된다** — 원장에 무엇이 생겼는지를
   * 사용자가 다시 볼 수 있어야 한다.
   */
  it('결과가 있으면 결과 구획이 선다', () => {
    renderPane({
      result: {
        statusCode: 'SYN_STATUS_CANCELLED',
        reversed: true,
        reversalTransactionNo: 'SYN-TX-9501',
        reversalBusinessDate: '2026-08-07',
      },
    });

    expect(screen.getByRole('group', { name: t.executionResult.label })).toBeInTheDocument();
    expect(screen.getByText(t.ledger.pair('SYN-TX-9501', '2026-08-07'))).toBeInTheDocument();
  });

  /** 짝 방향 — 결과가 없으면 서지 않는다. 아니면 위 단언이 「늘 선다」와 같아진다. */
  it('결과가 없으면 결과 구획이 서지 않는다', () => {
    renderPane();

    expect(screen.queryByRole('group', { name: t.executionResult.label })).not.toBeInTheDocument();
  });

  /**
   * ⭐ **결과가 서 있어도 실행 버튼이 사라지지 않는다.** 실행이 성공해도 서버가 다시 막을지는
   * 서버가 정하고(잠금의 정본), 사용자가 결과를 읽고 나서 화면을 새로 고르는 길이 막히면 안 된다.
   */
  it('결과가 있어도 버튼은 그대로 선다', () => {
    renderPane({
      result: {
        statusCode: 'SYN_STATUS_CANCELLED',
        reversed: false,
        reversalTransactionNo: null,
        reversalBusinessDate: null,
      },
    });

    expect(executeButton()).toBeInTheDocument();
  });
});
