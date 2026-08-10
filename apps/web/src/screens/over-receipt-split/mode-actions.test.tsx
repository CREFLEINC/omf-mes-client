import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ModeActions, type ModeActionsProps } from './mode-actions';

const t = messages.overReceiptSplit;

const OPEN: ModeActionsProps['blockReasons'] = {
  BOTH: null,
  NORMAL_ONLY: null,
  EXCESS_ONLY: null,
};

const renderActions = (
  overrides: Partial<ModeActionsProps> = {},
): {
  onSubmit: ReturnType<typeof vi.fn>;
  onCancel: ReturnType<typeof vi.fn>;
  user: ReturnType<typeof userEvent.setup>;
} => {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();

  render(
    <ModeActions
      blockReasons={OPEN}
      isSaving={false}
      savingMode={null}
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...overrides}
    />,
  );

  return { onSubmit, onCancel, user: userEvent.setup() };
};

const button = (name: string): HTMLElement => screen.getByRole('button', { name });

describe('ModeActions — 세 갈래', () => {
  it('세 버튼과 취소가 있다', () => {
    renderActions();

    expect(button(t.actions.registerBoth)).toBeInTheDocument();
    expect(button(t.actions.registerNormalOnly)).toBeInTheDocument();
    expect(button(t.actions.registerExcessOnly)).toBeInTheDocument();
    expect(button(messages.common.cancel)).toBeInTheDocument();
  });

  /* **M25의 부품 몫** — 버튼과 갈래가 1:1이다. 하나로 합치면 무엇이 저장되는지 알 수 없다. */
  it.each([
    [t.actions.registerBoth, 'BOTH'],
    [t.actions.registerNormalOnly, 'NORMAL_ONLY'],
    [t.actions.registerExcessOnly, 'EXCESS_ONLY'],
  ] as const)('%s는 %s로 등록한다', async (label, mode) => {
    const { onSubmit, user } = renderActions();

    await user.click(button(label));

    expect(onSubmit).toHaveBeenCalledWith(mode);
  });

  it('취소는 등록을 부르지 않는다', async () => {
    const { onSubmit, onCancel, user } = renderActions();

    await user.click(button(messages.common.cancel));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('ModeActions — 잠긴 이유', () => {
  /*
   * 배치 규범 4 — 사유는 감추지 않고 **항상 보이는 DOM 텍스트**로 렌더하고
   * `aria-describedby`로 그 버튼에 잇는다. 비활성 버튼은 포커스를 받지 못해
   * 툴팁만으로는 키보드·스크린리더 사용자가 닿을 수 없다.
   */
  it('사유가 있으면 잠기고 그 사유가 버튼에 이어진다', () => {
    renderActions({
      blockReasons: { ...OPEN, BOTH: t.actionReasons.bothNeedsExcess },
    });

    const target = button(t.actions.registerBoth);

    expect(target).toBeDisabled();
    expect(screen.getByText(t.actionReasons.bothNeedsExcess)).toBeInTheDocument();

    const describedBy = target.getAttribute('aria-describedby') ?? '';

    expect(document.getElementById(describedBy)?.textContent).toBe(
      t.actionReasons.bothNeedsExcess,
    );
  });

  /* 짝 방향 — 잠기지 않은 버튼에는 사유가 붙지 않는다. 늘 붙이면 늘 잠긴 것처럼 보인다. */
  it('사유가 없으면 열려 있고 사유 문구도 없다', () => {
    renderActions();

    expect(button(t.actions.registerBoth)).toBeEnabled();
    expect(screen.queryByText(t.actionReasons.bothNeedsExcess)).not.toBeInTheDocument();
  });

  it('잠긴 버튼을 눌러도 등록하지 않는다', async () => {
    const { onSubmit, user } = renderActions({
      blockReasons: { ...OPEN, EXCESS_ONLY: t.actionReasons.excessOnlyNeedsExcess },
    });

    await user.click(button(t.actions.registerExcessOnly));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  /* 버튼마다 잠긴 사정이 다르면 사유도 따로 보인다 — 하나로 뭉치면 어느 버튼의 것인지 모른다. */
  it('버튼마다 다른 사유를 낸다', () => {
    renderActions({
      blockReasons: {
        BOTH: t.actionReasons.bothNeedsExcess,
        NORMAL_ONLY: null,
        EXCESS_ONLY: t.actionReasons.excessOnlyNeedsExcess,
      },
    });

    expect(screen.getByText(t.actionReasons.bothNeedsExcess)).toBeInTheDocument();
    expect(screen.getByText(t.actionReasons.excessOnlyNeedsExcess)).toBeInTheDocument();
    expect(button(t.actions.registerNormalOnly)).toBeEnabled();
  });
});

describe('ModeActions — 전송 중', () => {
  /*
   * **이중 제출 방지의 첫 층**(계획 결정 13). 공통 쓰기 훅이 호출마다 새 멱등 키를 만들어
   * 연타가 그대로 두 전표가 된다 — 되돌리려면 승인을 거쳐야 해서 화면이 고칠 수 없다.
   */
  it('전송 중에는 세 버튼과 취소가 모두 잠긴다', () => {
    renderActions({ isSaving: true, savingMode: 'BOTH' });

    expect(button(t.actions.registerBoth)).toBeDisabled();
    expect(button(t.actions.registerNormalOnly)).toBeDisabled();
    expect(button(t.actions.registerExcessOnly)).toBeDisabled();
    expect(button(messages.common.cancel)).toBeDisabled();
  });

  /* 어느 갈래를 보내는 중인지 그 버튼이 밝힌다 — 셋 다 도는 표시를 내면 무엇을 보내는지 모른다. */
  it('보내는 중인 갈래의 버튼만 진행을 밝힌다', () => {
    renderActions({ isSaving: true, savingMode: 'NORMAL_ONLY' });

    expect(button(t.actions.registerNormalOnly)).toHaveAttribute('aria-busy', 'true');
    expect(button(t.actions.registerBoth)).not.toHaveAttribute('aria-busy', 'true');
  });
});

describe('ModeActions — 신규 P/O 등록', () => {
  /*
   * **M48** — 갈 곳이 아직 없다. 링크로 두면 눌러서 없는 화면으로 가고, 감추면
   * 발주를 못 찾은 사용자가 다음에 무엇을 할지 알 수 없다. 자리를 두되 사유를 밝힌다.
   */
  it('자리는 있으나 잠겨 있고 사유가 붙는다', () => {
    renderActions();

    const target = button(t.actions.createPurchaseOrder);

    expect(target).toBeDisabled();
    expect(
      screen.getByText(t.actionReasons.createPurchaseOrderUnavailable),
    ).toBeInTheDocument();
    expect(target.getAttribute('aria-describedby')).not.toBeNull();
  });

  /* 어떤 경로로도 이동하지 않는다 — 링크가 하나라도 있으면 이동 경로가 생긴 것이다. */
  it('이동 경로를 두지 않는다', () => {
    renderActions();

    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(button(t.actions.createPurchaseOrder)).not.toHaveAttribute('href');
  });
});
