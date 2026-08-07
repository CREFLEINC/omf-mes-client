import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { RoleChoice } from './role-assign-draft';
import { RoleAssignPane, type RoleAssignPaneProps } from './role-assign-pane';

const CHOICES: RoleChoice[] = [
  { roleId: 5001, label: 'SYN-ROLE-01 · 합성 역할 A', isSelected: true, isLocked: false },
  { roleId: 5002, label: 'SYN-ROLE-02 · 합성 역할 B', isSelected: false, isLocked: false },
  { roleId: 5003, label: 'SYN-ROLE-03 · 합성 역할 C (미사용)', isSelected: true, isLocked: true },
];

const renderPane = (overrides: Partial<RoleAssignPaneProps> = {}) => {
  const props: RoleAssignPaneProps = {
    choices: CHOICES,
    isLoading: false,
    optionsNotice: null,
    loadError: null,
    banner: null,
    isDirty: false,
    isSaving: false,
    onToggle: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };

  render(<RoleAssignPane {...props} />);

  return { props, user: userEvent.setup() };
};

const checkbox = (name: string): HTMLElement => screen.getByRole('checkbox', { name });

describe('RoleAssignPane', () => {
  it('역할마다 확인칸 하나가 서고 부여된 것이 체크돼 있다', () => {
    renderPane();

    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(checkbox('SYN-ROLE-01 · 합성 역할 A')).toBeChecked();
    expect(checkbox('SYN-ROLE-02 · 합성 역할 B')).not.toBeChecked();
  });

  /**
   * 표의 선택 열을 쓰면 머리글의 전체 선택이 「모든 역할을 준다」가 된다(계획 결정 11).
   * 한 번 눌리면 되돌리기 전까지 권한이 전부 열리는 자리다.
   */
  it('표가 아니라 확인칸 목록이다 — 전체 선택 자리가 없다', () => {
    renderPane();

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /전체/ })).not.toBeInTheDocument();
  });

  it('확인칸을 누르면 그 역할 번호가 올라간다', async () => {
    const { props, user } = renderPane();

    await user.click(checkbox('SYN-ROLE-02 · 합성 역할 B'));

    expect(props.onToggle).toHaveBeenCalledWith(5002);
  });

  /**
   * **화면이 「이 역할은 특별하다」를 판정하지 않는다**(계획 결정 4).
   * 사용 중인 역할은 이미 부여돼 있어도 회수를 막지 않는다.
   */
  it('사용 중인 역할은 이미 부여돼 있어도 비활성이 아니다', () => {
    renderPane();

    expect(checkbox('SYN-ROLE-01 · 합성 역할 A')).toBeEnabled();
    expect(checkbox('SYN-ROLE-02 · 합성 역할 B')).toBeEnabled();
  });

  it('잠긴 확인칸은 미사용 역할 하나뿐이고 사유가 보이며 이어져 있다', () => {
    renderPane();

    const locked = checkbox('SYN-ROLE-03 · 합성 역할 C (미사용)');

    expect(locked).toBeDisabled();
    expect(screen.getAllByRole('checkbox').filter((box) => box.hasAttribute('disabled'))).toEqual([
      locked,
    ]);

    const note = screen.getByText(/미사용 역할은 이미 부여돼 있어/);

    expect(locked.getAttribute('aria-describedby')).toBe(note.getAttribute('id'));
  });

  it('잠긴 역할이 없으면 그 안내를 내지 않는다', () => {
    renderPane({ choices: CHOICES.filter((choice) => !choice.isLocked) });

    expect(screen.queryByText(/미사용 역할은 이미 부여돼 있어/)).not.toBeInTheDocument();
  });

  it('고를 수 있는 역할이 없으면 빈 상태가 나온다', () => {
    renderPane({ choices: [] });

    expect(screen.getByText('고를 수 있는 역할이 없습니다')).toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('불러오는 중에는 확인칸 대신 진행 표시가 나온다', () => {
    renderPane({ isLoading: true });

    expect(screen.getByRole('status', { name: '역할 부여분을 불러오는 중' })).toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  /** 조회 실패를 빈 목록으로 내면 「부여된 역할이 없다」로 읽혀 전체 회수를 저장하게 된다. */
  it('조회에 실패하면 확인칸을 그리지 않고 배너 자리를 낸다', () => {
    renderPane({ loadError: <p>목록을 불러오지 못했습니다</p> });

    expect(screen.getByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('고친 것이 없으면 저장이 비활성이고 사유가 보인다', () => {
    renderPane();

    const save = screen.getByRole('button', { name: '저장' });

    expect(save).toBeDisabled();
    expect(screen.getByText(/저장은 고친 내용이 있을 때/)).toBeInTheDocument();
  });

  it('고친 것이 있으면 저장과 취소를 누를 수 있다', async () => {
    const { props, user } = renderPane({ isDirty: true });

    await user.click(screen.getByRole('button', { name: '저장' }));
    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('저장 실패 배너와 선택 목록 안내를 받은 자리에 낸다', () => {
    renderPane({ banner: <p>저장 실패</p>, optionsNotice: <p>선택 목록이 일부만</p> });

    expect(screen.getByText('저장 실패')).toBeInTheDocument();
    expect(screen.getByText('선택 목록이 일부만')).toBeInTheDocument();
  });
});
