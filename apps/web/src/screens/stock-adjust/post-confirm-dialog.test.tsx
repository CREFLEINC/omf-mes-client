import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PostConfirmDialog, type PostSummary } from './post-confirm-dialog';

const t = messages.stockAdjust;

/** 화면이 만든 요약을 그대로 넘긴다 — 창이 다시 세면 확인한 것과 보내는 것이 갈린다. */
const summaryOf = (overrides: Partial<PostSummary> = {}): PostSummary => ({
  inventoryAdjustmentNo: 'SAMPLE-IA-9301',
  businessDate: '2026-08-18',
  occurredAtLocal: '2026-08-18T14:05',
  isBusinessDateApart: false,
  ...overrides,
});

const renderDialog = (
  overrides: { isSaving?: boolean; summary?: PostSummary; banner?: React.ReactNode } = {},
) => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  render(
    <PostConfirmDialog
      summary={overrides.summary ?? summaryOf()}
      isSaving={overrides.isSaving ?? false}
      banner={overrides.banner ?? null}
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  );

  return { onConfirm, onClose, user: userEvent.setup() };
};

const dialog = (): HTMLElement => screen.getByRole('dialog');

const confirmButton = (): HTMLElement =>
  screen.getByRole('button', { name: new RegExp(t.actions.confirmPost) });

/**
 * 전기 확인 — **이 화면에서 재고를 움직이는 유일한 창이다**(D-17).
 *
 * 상신 확인 창과 갈라 둔다: 그 창이 확인시키는 것은 「이 문장이 결재함 요약이 된다」이고,
 * 여기서 확인시키는 것은 **무엇이 언제 자로 원장에 잡히는가**다.
 */
describe('PostConfirmDialog — 무엇을 확인시키는가', () => {
  it('어느 전표를 전기하는지와 두 값을 되보인다', () => {
    renderDialog();

    expect(within(dialog()).getByText(t.dialog.postLead)).toBeInTheDocument();
    expect(within(dialog()).getByText('SAMPLE-IA-9301')).toBeInTheDocument();
    expect(within(dialog()).getByText('2026-08-18')).toBeInTheDocument();
    expect(within(dialog()).getByText('2026-08-18T14:05')).toBeInTheDocument();
  });

  /**
   * ⭐ **「일어나는 일」 세 문장이 상시 자리에 선다**(C38 · D-17).
   *
   * 되돌릴 수 없는 조작의 마지막 층이라 무엇이 일어나는지가 실행 버튼 바로 위에 있어야 한다.
   */
  it('일어나는 일 세 문장이 선다', () => {
    renderDialog();

    const effects = within(dialog()).getByRole('region', { name: t.post.effectsLabel });

    expect(within(effects).getByText(t.post.effectMovesStock)).toBeVisible();
    expect(within(effects).getByText(t.post.effectApprovalIsNotPosting)).toBeVisible();
    expect(within(effects).getByText(t.post.effectNoUndoHere)).toBeVisible();
  });

  /**
   * ⭐ **버튼이 잠겨 있을 때도 선다**(C38).
   *
   * 잠금과 함께 감추면 정작 눌릴 수 있는 상태에서만 경고가 뜨는데, 그때는 이미 사용자가
   * 누르러 온 순간이라 읽지 않는다.
   */
  it('실행 버튼이 잠겨 있어도 세 문장이 그대로 선다', () => {
    renderDialog({ isSaving: true });

    /* 짝 양성 — 버튼이 실제로 잠긴 상태다. */
    expect(confirmButton()).toBeDisabled();

    const effects = within(dialog()).getByRole('region', { name: t.post.effectsLabel });

    expect(within(effects).getByText(t.post.effectMovesStock)).toBeVisible();
    expect(within(effects).getByText(t.post.effectApprovalIsNotPosting)).toBeVisible();
    expect(within(effects).getByText(t.post.effectNoUndoHere)).toBeVisible();
  });

  /**
   * ⭐ **영업일과 발생 일시의 날짜가 갈리면 그 사실을 적는다**(공유계약 C-8의 야간조 경계).
   *
   * 막지 않는다 — 자정을 넘겨 일한 사람에게는 정상이고, 막으면 어제 자 조정을 전기할 길이
   * 사라진다. 실수로 남은 값이면 여기서 알아차린다.
   */
  it('두 날짜가 갈리면 그 사실을 적고 막지는 않는다', () => {
    renderDialog({
      summary: summaryOf({
        businessDate: '2026-08-17',
        occurredAtLocal: '2026-08-18T00:30',
        isBusinessDateApart: true,
      }),
    });

    expect(within(dialog()).getByText(t.dialog.postDatesApart)).toBeVisible();
    expect(confirmButton()).toBeEnabled();
  });

  /** 짝 방향 — 같은 날이면 그 안내가 서지 않는다. 늘 서면 읽히지 않는다. */
  it('같은 날이면 그 안내가 서지 않는다', () => {
    renderDialog();

    /* 짝 양성 — 창이 실제로 섰다(그 뒤에 없음을 잰다). */
    expect(within(dialog()).getByText(t.dialog.postLead)).toBeVisible();
    expect(within(dialog()).queryByText(t.dialog.postDatesApart)).not.toBeInTheDocument();
  });

  /**
   * **창 안에 입력칸을 두지 않는다**(`omf-mes#45`) — 고칠 것이 있으면 닫고 구획의 칸에서 고친다.
   * 내부 번호도 담기지 않는다(`omf-mes#44`).
   *
   * ⚠ 이 시험만 **업무 번호에서 내부 번호 대역을 뺀 값**을 쓴다. 다른 시험이 쓰는
   * `SAMPLE-IA-9301`은 업무 번호 안에 그 숫자가 들어 있어, 그대로 재면 「업무 번호가 보인다」는
   * 사실 때문에 늘 실패한다 — 재려는 것은 **화면이 내부 번호를 따로 그리는가**다.
   */
  it('입력칸이 없고 내부 번호도 없다', () => {
    renderDialog({ summary: summaryOf({ inventoryAdjustmentNo: 'SAMPLE-IA-A' }) });

    /* 짝 양성 — 업무 번호는 실제로 보인다. */
    expect(within(dialog()).getByText('SAMPLE-IA-A')).toBeVisible();
    expect(within(dialog()).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(dialog()).queryAllByRole('combobox')).toHaveLength(0);
    expect(dialog().textContent ?? '').not.toContain('9301');
  });
});

/**
 * ⭐ **3방어**(사본 체크리스트 5번) — 스크림·닫기 버튼·Escape.
 *
 * 재고가 실제로 움직이는 창이라 실수로 닫히면 확인 자체가 형식이 된다.
 */
describe('PostConfirmDialog — 3방어와 Escape 축', () => {
  /** **나머지 반쪽**(`closeOnBackdropClick={false}`) — X만 잠그고 스크림을 열어 두면 잠근 적이 없다. */
  it('스크림을 눌러도 닫히지 않는다', () => {
    const { onClose } = renderDialog();

    fireEvent.click(dialog());

    expect(onClose).not.toHaveBeenCalled();
  });

  /** **X 손잡이가 없다**(`showCloseButton={false}`) — 남는 버튼은 둘뿐이다. */
  it('닫기 손잡이가 없다', () => {
    renderDialog();

    expect(
      within(dialog()).queryByRole('button', { name: messages.common.close }),
    ).not.toBeInTheDocument();
    expect(within(dialog()).getAllByRole('button')).toHaveLength(2);
  });

  /**
   * **Escape는 디자인 시스템이 막을 수단을 주지 않는다.** 그래서 이 창의 규율은 「닫히지 않게」가
   * 아니라 **「닫혀도 나가는 요청이 무너지지 않게」**다 — 창은 닫힘을 화면에 알리기만 하고
   * 되돌리는 일(`reset`)을 하지 않는다. 그 규율의 화면 쪽 감지기는 `screen.test.tsx`에 있다.
   */
  it('Escape로 닫히면 그 사실만 화면에 알린다', () => {
    const { onClose, onConfirm } = renderDialog();

    fireEvent(dialog(), new Event('cancel', { bubbles: false, cancelable: true }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

/**
 * **나가는 중에는 두 버튼을 함께 잠근다** — 실행 버튼만 잠그면 사용자가 닫고 다시 눌러
 * **재고를 두 번 움직인다**(공통 훅이 호출마다 새 멱등 키를 만든다).
 */
describe('PostConfirmDialog — 나가는 중', () => {
  it('두 버튼이 함께 잠긴다', () => {
    renderDialog({ isSaving: true });

    expect(confirmButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.keepReviewing })).toBeDisabled();
  });

  it('열려 있으면 실행이 한 번만 불린다', async () => {
    const { onConfirm, user } = renderDialog();

    await user.click(confirmButton());

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('다시 확인을 누르면 닫기만 한다', async () => {
    const { onConfirm, onClose, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: t.actions.keepReviewing }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  /**
   * 실패 배너는 **창을 닫지 않고 창 안에** 선다 — 닫아 버리면 무엇이 막았는지 모른 채 같은
   * 버튼을 다시 누른다.
   */
  it('실패 배너 자리가 창 안에 있다', () => {
    renderDialog({ banner: <p>합성 전기 거절</p> });

    expect(within(dialog()).getByText('합성 전기 거절')).toBeInTheDocument();
  });
});
