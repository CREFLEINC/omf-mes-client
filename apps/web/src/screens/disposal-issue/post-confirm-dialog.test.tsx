import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PostConfirmDialog, type PostSummary } from './post-confirm-dialog';

const t = messages.disposalIssue;

const SUMMARY: PostSummary = {
  goodsIssueNo: 'GI-2026-950001',
  lineCount: 2,
  totalQtyText: '45 SAMPLE-UOM-EA',
  reason: { kind: 'known', firstLine: '불량 판정분 폐기 — 합성 사유 첫 줄' },
  isJudgePending: false,
  hasPostedLine: false,
};

const renderDialog = (overrides: Partial<PostSummary> = {}) => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  render(
    <PostConfirmDialog
      summary={{ ...SUMMARY, ...overrides }}
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  );

  return { onConfirm, onClose, user: userEvent.setup() };
};

describe('PostConfirmDialog — 무엇을 처리하는가', () => {
  /**
   * **여섯 값을 다시 보인다**(완료 조건 C71 · 감지기 M68). 하나라도 빠지면 사용자가 무엇을
   * 처리하는지 모르는 채 확인하게 된다 — 되돌릴 수 없는 조작 앞의 마지막 층이다.
   */
  it('전표 번호·줄 수·합계 수량·사유 첫 줄과 두 사실을 보인다', () => {
    renderDialog();

    expect(screen.getByText('GI-2026-950001')).toBeVisible();
    expect(screen.getByText(t.dialog.lineCount(2))).toBeVisible();
    expect(screen.getByText('45 SAMPLE-UOM-EA')).toBeVisible();
    expect(screen.getByText('불량 판정분 폐기 — 합성 사유 첫 줄')).toBeVisible();
    expect(screen.getByText(t.dialog.postDeducts)).toBeVisible();
    expect(screen.getByText(t.dialog.postNoUndo)).toBeVisible();
  });

  /** 단위가 섞이면 화면이 합계를 내지 않는다 — 그 사실을 그대로 나른다. */
  it('합계를 낼 수 없으면 그 사실이 보인다', () => {
    renderDialog({ totalQtyText: t.dialog.mixedUom });

    expect(screen.getByText(t.dialog.mixedUom)).toBeVisible();
  });

  /** **내부 번호를 담지 않는다**(`omf-mes#44`). 짝으로 업무 번호는 실제로 보인다. */
  it('업무 번호는 보이고 내부 번호는 없다', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByText('GI-2026-950001')).toBeVisible();
    expect(dialog.textContent ?? '').not.toContain('9501');
  });
});

describe('PostConfirmDialog — 화면이 확인하지 못한 것', () => {
  /**
   * **자리표시가 비면 그 사실을 창에서 한 번 더 적는다**(완료 조건 C71). 구획의 상시 안내를
   * 읽고 지나쳤어도 확인 직전에 다시 만난다.
   */
  it('승인 판정을 못 했으면 그 사실이 보인다', () => {
    renderDialog({ isJudgePending: true });

    expect(screen.getByText(t.dialog.postJudgePending)).toBeVisible();
  });

  /** 짝 방향 — 판정할 수 있게 되면 그 문장이 사라진다(전환 감지기의 창 쪽). */
  it('승인 판정을 할 수 있으면 그 문장이 없다', () => {
    renderDialog({ isJudgePending: false });

    expect(screen.queryByText(t.dialog.postJudgePending)).not.toBeInTheDocument();
  });

  /**
   * **결재 진행을 못 읽은 채 처리하는 갈래**(완료 조건 C71·C78). 막지는 않되 무엇을 모르고
   * 누르는지는 밝힌다 — 사유 첫 줄도 그때는 낼 것이 없다.
   */
  it('결재 진행을 못 읽었으면 그 사실이 보이고 사유 첫 줄이 없다', () => {
    renderDialog({ reason: { kind: 'unread' } });

    expect(screen.getByText(t.dialog.postProgressUnread)).toBeVisible();
    expect(screen.queryByText(t.dialog.postReasonFirstLine)).not.toBeInTheDocument();
  });

  /** 짝 방향 — 읽었으면 그 문장이 없고 사유 첫 줄이 선다. */
  it('결재 진행을 읽었으면 그 문장이 없고 사유 첫 줄이 선다', () => {
    renderDialog();

    expect(screen.queryByText(t.dialog.postProgressUnread)).not.toBeInTheDocument();
    expect(screen.getByText(t.dialog.postReasonFirstLine)).toBeVisible();
  });

  /**
   * **이미 전기된 줄이 있는 전표**(값 유무로 판정). 막지 않는 대신 **한 번 더 움직일 수 있다**는
   * 사실을 되돌릴 수 없는 조작 앞에서 밝힌다.
   */
  it('이미 전기된 줄이 있으면 그 사실이 보인다', () => {
    renderDialog({ hasPostedLine: true });

    expect(screen.getByText(t.dialog.postAlreadyPosted)).toBeVisible();
  });

  it('전기된 줄이 없으면 그 문장이 없다', () => {
    renderDialog({ hasPostedLine: false });

    expect(screen.queryByText(t.dialog.postAlreadyPosted)).not.toBeInTheDocument();
  });
});

describe('PostConfirmDialog — 스치는 클릭으로 닫히지 않는다', () => {
  /**
   * **스크림·X로 닫히지 않는다**(계획 결정 14의 둘째 겹 · 감지기 M69). 되돌릴 수 없는 조작의
   * 확인이 스치는 클릭에 사라지면 확인이 형식이 된다.
   */
  it('닫기 손잡이가 없다', () => {
    renderDialog();

    expect(screen.queryByRole('button', { name: '닫기' })).not.toBeInTheDocument();
  });

  it('바닥 버튼 둘로만 나간다', async () => {
    const { onConfirm, onClose, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: t.actions.keepReviewing }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: t.actions.confirmPost }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  /** **창 안에 선택칸을 두지 않는다**(완료 조건 C79 · `omf-mes#45`) — 펼침 목록이 잘린다. */
  it('창 안에 선택칸이 없다', () => {
    renderDialog();

    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
  });
});
