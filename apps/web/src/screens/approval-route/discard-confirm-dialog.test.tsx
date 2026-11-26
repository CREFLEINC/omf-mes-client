import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DiscardConfirmDialog } from './discard-confirm-dialog';

const t = messages.approvalRoute;

describe('DiscardConfirmDialog', () => {
  it('무엇을 잃는지 묻는다', () => {
    render(<DiscardConfirmDialog onConfirm={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: t.dialog.discardTitle })).toBeInTheDocument();
    expect(screen.getByText(t.dialog.discardBody)).toBeInTheDocument();
  });

  /* 사용자 관리 · 주간 근무일 화면의 저장 안 한 변경 창과 같은 문구 · 닫기(X) 없음(사용자 지시 2026-11-25). */
  it('다른 화면과 같은 문구이고 닫기(X) 단추가 없다', () => {
    render(<DiscardConfirmDialog onConfirm={vi.fn()} onClose={vi.fn()} />);

    expect(t.dialog.discardTitle).toBe(messages.usersRoles.discard.title);
    expect(t.dialog.discardBody).toBe(messages.usersRoles.discard.body);
    expect(t.actions.keepEditing).toBe(messages.usersRoles.discard.keep);
    expect(t.actions.discardDraft).toBe(messages.usersRoles.discard.confirm);
    expect(screen.queryByRole('button', { name: '닫기' })).toBeNull();
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      t.actions.keepEditing,
      t.actions.discardDraft,
    ]);
  });

  /** 「확인/취소」로 두면 어느 쪽이 파기인지 창을 다시 읽어야 안다. */
  it('두 버튼이 각각 무엇을 하는지 이름으로 밝힌다', () => {
    render(<DiscardConfirmDialog onConfirm={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: t.actions.discardDraft })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.actions.keepEditing })).toBeInTheDocument();
  });

  it('파기를 누르면 확인이 올라간다', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(<DiscardConfirmDialog onConfirm={onConfirm} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: t.actions.discardDraft }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('계속 편집을 누르면 닫기만 한다', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(<DiscardConfirmDialog onConfirm={onConfirm} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: t.actions.keepEditing }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  /**
   * **스크림 클릭으로 닫히는 것을 막지 않는다.**
   *
   * 실수로 닫혀도 초안이 그대로 남아 잃는 것이 없다 — 사용 전환 창이 **일부러 막는 것**과
   * 정확히 반대 자리다(`activation-dialog.test.tsx`가 그 반대 방향을 잰다).
   * 두 창을 짝으로 재야 규칙이 「막는다」가 아니라 「여기는 막고 저기는 연다」로 읽힌다.
   */
  it('스크림을 누르면 닫힌다', () => {
    const onClose = vi.fn();

    render(<DiscardConfirmDialog onConfirm={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('dialog'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  /** #45 — 창 본문이 펼침 목록을 자른다. 걸릴 자리를 만들지 않는 것으로 피한다. */
  it('선택칸이 없다', () => {
    render(<DiscardConfirmDialog onConfirm={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText(t.dialog.discardBody)).toBeInTheDocument();
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
  });
});
