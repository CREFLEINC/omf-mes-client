import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { roleFixtures } from './fixtures';
import { RoleListPane, type RoleListPaneProps } from './role-list-pane';
import type { PageView } from './pagination';
import type { RoleFilters } from './types';

const EMPTY_FILTERS: RoleFilters = { q: '', includeInactive: false };

const PAGE_VIEW: PageView = {
  page: 1,
  totalPages: 1,
  rangeLabel: '1–3 / 전체 3건',
  canPrev: false,
  canNext: false,
  isBeyondLast: false,
};

const renderPane = (overrides: Partial<RoleListPaneProps> = {}) => {
  const onApplyFilters = vi.fn<(next: RoleFilters) => void>();
  const onChangePage = vi.fn<(page: number) => void>();
  const onSelect = vi.fn<(roleId: number) => void>();
  const onAddRole = vi.fn<() => void>();

  render(
    <RoleListPane
      roles={roleFixtures}
      isLoading={false}
      appliedFilters={EMPTY_FILTERS}
      onApplyFilters={onApplyFilters}
      pageView={PAGE_VIEW}
      onChangePage={onChangePage}
      selectedRoleId={null}
      onSelect={onSelect}
      isCreating={false}
      onAddRole={onAddRole}
      loadError={null}
      {...overrides}
    />,
  );

  return { onApplyFilters, onChangePage, onSelect, onAddRole, user: userEvent.setup() };
};

const pane = (): HTMLElement => screen.getByRole('region', { name: '역할' });

const rowOf = (roleCode: string): HTMLElement => {
  const cell = within(pane()).getByRole('button', { name: roleCode });
  const row = cell.closest('tr');

  if (row === null) throw new Error(`행을 찾지 못했습니다: ${roleCode}`);

  return row;
};

describe('RoleListPane 표', () => {
  it('열이 셋이다 — 역할 코드·역할명·상태', () => {
    renderPane();

    const headers = within(pane()).getAllByRole('columnheader');

    expect(headers.map((header) => header.textContent)).toEqual(['역할 코드', '역할명', '상태']);
  });

  it('응답 건수만큼 행이 그려진다', () => {
    renderPane();

    expect(within(pane()).getAllByRole('row')).toHaveLength(roleFixtures.length + 1);
  });

  /** 계약이 널을 허용하고 목 서버가 실제로 그런 행을 준다 — 설명이 없어도 행이 깨지지 않아야 한다. */
  it('설명이 널인 역할도 행이 그려진다', () => {
    renderPane();

    expect(within(rowOf('SYN-ROLE-02')).getByText('합성 역할 B')).toBeInTheDocument();
  });

  /**
   * 역할에는 상태 코드가 없다(계약이 준 필드가 `isActive` 하나뿐이다) —
   * 상태 열이 사용 여부를 그대로 낸다.
   */
  it('미사용 역할의 상태 열에 「미사용」이 나온다', () => {
    renderPane();

    expect(within(rowOf('SYN-ROLE-03')).getByText('미사용')).toBeInTheDocument();
  });

  it('사용 중인 역할의 상태 열에는 「미사용」이 나오지 않는다', () => {
    renderPane();

    expect(within(rowOf('SYN-ROLE-01')).getByText('사용 중')).toBeInTheDocument();
    expect(within(rowOf('SYN-ROLE-01')).queryByText('미사용')).not.toBeInTheDocument();
  });

  it('역할 코드를 누르면 상위에 그 번호를 알린다', async () => {
    const { onSelect, user } = renderPane();

    await user.click(within(pane()).getByRole('button', { name: 'SYN-ROLE-01' }));

    expect(onSelect).toHaveBeenCalledWith(5001);
  });

  it('고른 역할의 행이 표시된다', () => {
    renderPane({ selectedRoleId: 5001 });

    expect(within(pane()).getByRole('button', { name: 'SYN-ROLE-01' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });
});

describe('RoleListPane 조건', () => {
  it('부서 조건을 두지 않는다 — 계약의 역할 목록 쿼리에 그 조건이 없다', () => {
    renderPane();

    expect(within(pane()).queryByLabelText('부서')).not.toBeInTheDocument();
  });

  /** 사용자 탭과 갈리는 자리다 — 그쪽은 값 목록이 미정이라 비활성으로 두었고, 여기는 조건 자체가 없다. */
  it('상태 조건을 두지 않는다 — 계약에 그 쿼리가 없다', () => {
    renderPane();

    expect(within(pane()).queryByLabelText('상태')).not.toBeInTheDocument();
  });

  it('조회를 누르면 편집 중인 조건이 한 번에 적용된다', async () => {
    const { onApplyFilters, user } = renderPane();

    await user.type(within(pane()).getByLabelText('역할 검색'), 'SYN');
    await user.click(within(pane()).getByRole('button', { name: '조회' }));

    expect(onApplyFilters).toHaveBeenCalledWith({ q: 'SYN', includeInactive: false });
  });

  /** 해제 축이라 변경 즉시 적용한다 — 편집 중인 검색어를 함께 보내지 않는다. */
  it('미사용 포함은 누르는 즉시 적용된다', async () => {
    const { onApplyFilters, user } = renderPane({
      appliedFilters: { q: 'SYN', includeInactive: false },
    });

    await user.click(within(pane()).getByRole('checkbox', { name: '미사용 포함' }));

    expect(onApplyFilters).toHaveBeenCalledWith({ q: 'SYN', includeInactive: true });
  });

  it('초기화는 조건을 모두 푼다', async () => {
    const { onApplyFilters, user } = renderPane({
      appliedFilters: { q: 'SYN', includeInactive: true },
    });

    await user.click(within(pane()).getByRole('button', { name: '초기화' }));

    expect(onApplyFilters).toHaveBeenCalledWith({ q: '', includeInactive: false });
  });

  it('적용된 조건마다 칩이 하나씩 선다', () => {
    renderPane({ appliedFilters: { q: 'SYN', includeInactive: true } });

    expect(within(pane()).getByText('검색어: SYN')).toBeInTheDocument();
    expect(within(pane()).getByRole('button', { name: '미사용 포함 조건 제거' })).toBeInTheDocument();
  });

  it('칩을 제거하면 그 조건 하나만 풀린다', async () => {
    const { onApplyFilters, user } = renderPane({
      appliedFilters: { q: 'SYN', includeInactive: true },
    });

    await user.click(within(pane()).getByRole('button', { name: '검색어 조건 제거' }));

    expect(onApplyFilters).toHaveBeenCalledWith({ q: '', includeInactive: true });
  });
});

describe('RoleListPane 빈 상태와 실패', () => {
  it('조건 없이 0건이면 등록된 것이 없다고 안내한다', () => {
    renderPane({ roles: [] });

    expect(within(pane()).getByText('등록된 역할이 없습니다')).toBeInTheDocument();
  });

  /** 조건이 걸린 0건을 「등록된 것이 없다」로 내면 사실과 다른 안내가 된다. */
  it('조건이 걸린 0건은 다른 안내이고 초기화 길을 준다', async () => {
    const { onApplyFilters, user } = renderPane({
      roles: [],
      appliedFilters: { q: 'SYN', includeInactive: false },
    });

    expect(within(pane()).getByText('조건에 맞는 역할이 없습니다')).toBeInTheDocument();

    // 조건 줄에도 「초기화」가 있다 — 빈 상태 안의 것만 눌러야 이 안내의 길이 열렸는지 알 수 있다.
    await user.click(within(screen.getByRole('status')).getByRole('button', { name: '초기화' }));

    expect(onApplyFilters).toHaveBeenCalledWith({ q: '', includeInactive: false });
  });

  it('범위 밖 쪽에는 첫 쪽으로 돌아갈 길을 준다', async () => {
    const { onChangePage, user } = renderPane({
      roles: [],
      pageView: { ...PAGE_VIEW, page: 9, isBeyondLast: true, canPrev: true },
    });

    expect(within(pane()).getByText('이 쪽에는 결과가 없습니다')).toBeInTheDocument();

    await user.click(within(pane()).getByRole('button', { name: '첫 쪽으로' }));

    expect(onChangePage).toHaveBeenCalledWith(1);
  });

  /** 실패를 「등록된 것이 없습니다」로 내면 사실과 다른 안내가 된다. */
  it('조회 실패에는 표도 빈 상태도 내지 않는다', () => {
    renderPane({ roles: [], loadError: <p>역할 조회 실패 표시</p> });

    expect(screen.getByText('역할 조회 실패 표시')).toBeInTheDocument();
    expect(within(pane()).queryByRole('table')).not.toBeInTheDocument();
    expect(within(pane()).queryByText('등록된 역할이 없습니다')).not.toBeInTheDocument();
  });

  it('불러오는 중에는 표 대신 진행 표시가 나온다', () => {
    renderPane({ isLoading: true });

    expect(screen.getByRole('status', { name: '역할 목록을 불러오는 중' })).toBeInTheDocument();
    expect(within(pane()).queryByRole('table')).not.toBeInTheDocument();
  });

  it('결과가 없어도 조건을 고칠 수단은 남는다', () => {
    renderPane({ roles: [], loadError: <p>역할 조회 실패 표시</p> });

    expect(within(pane()).getByLabelText('역할 검색')).toBeInTheDocument();
  });
});

describe('RoleListPane 역할 추가', () => {
  it('누르면 상위에 알린다', async () => {
    const { onAddRole, user } = renderPane();

    await user.click(within(pane()).getByRole('button', { name: '역할 추가' }));

    expect(onAddRole).toHaveBeenCalledTimes(1);
  });

  it('등록 폼이 이미 열려 있으면 다시 누를 수 없다', () => {
    renderPane({ isCreating: true });

    expect(within(pane()).getByRole('button', { name: '역할 추가' })).toBeDisabled();
  });
});
