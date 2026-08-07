import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { appUserFixtures } from './fixtures';
import { toPageView } from './pagination';
import { EMPTY_USER_FILTERS, UserListPane, type UserListPaneProps } from './user-list-pane';
import type { UserFilters } from './types';

const departmentOptions = [{ value: '3001', label: 'SYN-DEPT-01 · 합성 부서 A' }];

const renderPane = (overrides: Partial<UserListPaneProps> = {}) => {
  const onApplyFilters = vi.fn<(next: UserFilters) => void>();
  const onChangePage = vi.fn<(page: number) => void>();
  const onSelect = vi.fn<(appUserId: number) => void>();
  const onAddUser = vi.fn<() => void>();

  render(
    <UserListPane
      users={appUserFixtures}
      isLoading={false}
      appliedFilters={EMPTY_USER_FILTERS}
      onApplyFilters={onApplyFilters}
      departmentOptions={departmentOptions}
      departmentLabel={(id) => (id === '3001' ? 'SYN-DEPT-01 · 합성 부서 A' : '알 수 없음')}
      /*
       * 실제 화면의 `lookupLabel`과 같은 세 갈래를 그대로 흉내 낸다 —
       * 값 없음은 「—」, 목록에 없는 번호는 「알 수 없음」, 나머지는 이름.
       * 여기서 셋을 뭉개면 「상태 칸이 대시인가」를 부서 칸의 대시가 대신 통과시킨다.
       */
      departmentNameOf={(id) => {
        if (id === null || id === undefined) return '—';
        return id === 3001 ? 'SYN-DEPT-01 · 합성 부서 A' : '알 수 없음';
      }}
      optionsNotice={null}
      pageView={toPageView({ page: 1, size: 50, total: appUserFixtures.length }, appUserFixtures.length)}
      onChangePage={onChangePage}
      selectedAppUserId={null}
      onSelect={onSelect}
      isCreating={false}
      onAddUser={onAddUser}
      loadError={null}
      {...overrides}
    />,
  );

  return { onApplyFilters, onChangePage, onSelect, onAddUser, user: userEvent.setup() };
};

const table = (): HTMLElement => screen.getByRole('table');

describe('UserListPane 표', () => {
  it('열이 넷이다 — 로그인 ID · 이름 · 부서 · 상태', () => {
    renderPane();

    expect(within(table()).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      '로그인 ID',
      '이름',
      '부서',
      '상태',
    ]);
  });

  it('응답 건수만큼 행을 그린다', () => {
    renderPane();

    // 머리글 행 하나가 더 있다.
    expect(within(table()).getAllByRole('row')).toHaveLength(appUserFixtures.length + 1);
  });

  it('로그인 ID가 상세를 여는 버튼이다', async () => {
    const { onSelect, user } = renderPane();

    await user.click(screen.getByRole('button', { name: 'SYN-LOGIN-01' }));

    expect(onSelect).toHaveBeenCalledWith(1001);
  });

  it('고른 행의 버튼에 현재 위치 표시가 붙는다', () => {
    renderPane({ selectedAppUserId: 1001 });

    expect(screen.getByRole('button', { name: 'SYN-LOGIN-01' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  /** 열 순서는 로그인 ID · 이름 · 부서 · 상태다. 칸을 자리로 집어야 다른 칸이 대신 통과시키지 않는다. */
  const cellsOf = (loginId: string): string[] => {
    const row = screen.getByRole('button', { name: loginId }).closest('tr');

    expect(row).not.toBeNull();

    return within(row as HTMLElement)
      .getAllByRole('cell')
      .map((cell) => cell.textContent ?? '');
  };

  /** 계약이 널을 허용하고 목 서버가 실제로 키 없는 응답을 준다 — 셀이 깨지면 안 된다. */
  it('부서가 널이면 부서 칸이 「—」다', () => {
    renderPane();

    expect(cellsOf('SYN-LOGIN-02')[2]).toBe('—');
  });

  it('부서 번호가 선택 목록에 없으면 번호를 내지 않는다', () => {
    renderPane();

    expect(cellsOf('SYN-LOGIN-03')[2]).toBe('알 수 없음');
    expect(cellsOf('SYN-LOGIN-03')[2]).not.toContain('9999');
  });

  it('상태 코드가 빈 문자열이면 상태 칸이 「—」다', () => {
    renderPane();

    expect(cellsOf('SYN-LOGIN-03')[3]).toBe('—');
  });

  /** 상태 코드는 값 목록이 미정이라 **원본 문자열을 그대로** 낸다 — 이름을 지어내지 않는다. */
  it('상태 코드를 서버가 준 문자열 그대로 낸다', () => {
    renderPane();

    expect(screen.getByText('SYN-STATUS-A')).toBeInTheDocument();
  });

  it('미사용 행에 「미사용」 표식이 붙는다', () => {
    renderPane();

    expect(screen.getByText('합성 사용자 C (미사용)')).toBeInTheDocument();
    expect(screen.getByText('합성 사용자 A')).toBeInTheDocument();
  });
});

describe('UserListPane 조건 줄', () => {
  /**
   * 값 목록이 확정되지 않아 고를 수 있는 값이 하나도 없다 —
   * 자리표시 값을 쿼리로 보내면 언제나 0건이 온다(계획 결정 16).
   */
  it('상태 조건이 비활성이고 사유가 보인다', () => {
    renderPane();

    const status = screen.getByLabelText('상태');

    expect(status).toBeDisabled();
    expect(screen.getByText(/상태 조건은 상태 코드 목록이 확정되지 않아/)).toBeInTheDocument();
  });

  it('상태 조건의 사유가 컨트롤과 이어져 있다 — 비활성 컨트롤은 포커스를 받지 못한다', () => {
    renderPane();

    const describedBy = screen.getByLabelText('상태').getAttribute('aria-describedby');

    expect(describedBy).not.toBeNull();
    expect(document.getElementById(describedBy as string)?.textContent).toMatch(/상태 조건은/);
  });

  it('조회를 누르면 편집 중인 조건이 적용된다', async () => {
    const { onApplyFilters, user } = renderPane();

    await user.type(screen.getByLabelText('사용자 검색'), 'syn');
    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(onApplyFilters).toHaveBeenCalledWith({
      q: 'syn',
      departmentId: '',
      includeInactive: false,
    });
  });

  it('초기화를 누르면 조건이 전부 풀린다', async () => {
    const { onApplyFilters, user } = renderPane({
      appliedFilters: { q: 'syn', departmentId: '3001', includeInactive: true },
    });

    await user.click(screen.getByRole('button', { name: '초기화' }));

    expect(onApplyFilters).toHaveBeenCalledWith(EMPTY_USER_FILTERS);
  });

  /* 해제 축이라 변경 즉시 적용한다 — 조회를 한 번 더 누르게 하지 않는다. */
  it('미사용 포함은 누르는 즉시 적용된다', async () => {
    const { onApplyFilters, user } = renderPane();

    await user.click(screen.getByRole('checkbox', { name: '미사용 포함' }));

    expect(onApplyFilters).toHaveBeenCalledWith({ ...EMPTY_USER_FILTERS, includeInactive: true });
  });

  it('적용된 조건마다 칩이 하나씩 보인다', () => {
    renderPane({ appliedFilters: { q: 'syn', departmentId: '3001', includeInactive: true } });

    expect(screen.getByText('검색어: syn')).toBeInTheDocument();
    expect(screen.getByText('부서: SYN-DEPT-01 · 합성 부서 A')).toBeInTheDocument();
    /*
     * 「미사용 포함」은 확인칸 라벨과 칩 문구 둘 다에 쓰인다 —
     * 칩이 실제로 섰는지는 칩마다 다른 제거 버튼 이름으로 가린다.
     */
    expect(screen.getByRole('button', { name: '미사용 포함 조건 제거' })).toBeInTheDocument();
  });

  it('칩을 제거하면 그 조건만 풀린다', async () => {
    const { onApplyFilters, user } = renderPane({
      appliedFilters: { q: 'syn', departmentId: '3001', includeInactive: true },
    });

    await user.click(screen.getByRole('button', { name: '검색어 조건 제거' }));

    expect(onApplyFilters).toHaveBeenCalledWith({
      q: '',
      departmentId: '3001',
      includeInactive: true,
    });
  });
});

describe('UserListPane 상태별 표시', () => {
  it('불러오는 중이면 표 대신 진행 표시가 나온다', () => {
    renderPane({ isLoading: true });

    expect(screen.getByRole('status', { name: '사용자 목록을 불러오는 중' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  /** 실패를 「없습니다」로 보이면 사실과 다른 안내가 된다. */
  it('조회 실패면 표도 빈 상태도 내지 않고 받은 표시만 낸다', () => {
    renderPane({ users: [], loadError: <p>조회 실패 표시</p> });

    expect(screen.getByText('조회 실패 표시')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('등록된 사용자가 없습니다')).not.toBeInTheDocument();
  });

  it('조건 없는 0건에는 「등록된 사용자가 없습니다」가 나온다', () => {
    renderPane({
      users: [],
      pageView: toPageView({ page: 1, size: 50, total: 0 }, 0),
    });

    expect(screen.getByText('등록된 사용자가 없습니다')).toBeInTheDocument();
    // 조건이 걸린 0건과 뭉치면 「조건을 줄이라」는 쓸모없는 안내가 된다.
    expect(screen.queryByText('조건에 맞는 사용자가 없습니다')).not.toBeInTheDocument();
  });

  it('조건이 걸린 0건에는 초기화 길이 함께 나온다', async () => {
    const { onApplyFilters, user } = renderPane({
      users: [],
      appliedFilters: { q: 'syn', departmentId: '', includeInactive: false },
      pageView: toPageView({ page: 1, size: 50, total: 0 }, 0),
    });

    expect(screen.getByText('조건에 맞는 사용자가 없습니다')).toBeInTheDocument();

    // 조건 줄에도 「초기화」가 있다 — 빈 상태 안의 것만 눌러야 이 안내의 길이 열렸는지 알 수 있다.
    await user.click(within(screen.getByRole('status')).getByRole('button', { name: '초기화' }));

    expect(onApplyFilters).toHaveBeenCalledWith(EMPTY_USER_FILTERS);
  });

  /** 결과는 있는데 이 쪽에 없다 — 「등록된 것이 없다」로 내면 거짓말이 된다. */
  it('범위 밖 쪽에는 다른 안내와 첫 쪽으로 가는 길이 나온다', async () => {
    const { onChangePage, user } = renderPane({
      users: [],
      pageView: toPageView({ page: 9, size: 50, total: 3 }, 0),
    });

    expect(screen.getByText('이 쪽에는 결과가 없습니다')).toBeInTheDocument();
    expect(screen.queryByText('등록된 사용자가 없습니다')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '첫 쪽으로' }));

    expect(onChangePage).toHaveBeenCalledWith(1);
  });

  it('사용자 추가를 누르면 상위에 알린다', async () => {
    const { onAddUser, user } = renderPane();

    await user.click(screen.getByRole('button', { name: '사용자 추가' }));

    expect(onAddUser).toHaveBeenCalledTimes(1);
  });

  it('등록 폼이 이미 열려 있으면 사용자 추가를 다시 누를 수 없다', () => {
    renderPane({ isCreating: true });

    expect(screen.getByRole('button', { name: '사용자 추가' })).toBeDisabled();
  });

  it('선택 목록 안내 슬롯을 그대로 낸다', () => {
    renderPane({ optionsNotice: <p>선택 목록 안내</p> });

    expect(screen.getByText('선택 목록 안내')).toBeInTheDocument();
  });
});

describe('UserListPane 정렬·선택 열', () => {
  /** 계약의 목록 쿼리에 정렬 파라미터가 없다 — 화면이 정렬하면 지금 쪽 안에서만 도는 정렬이 된다. */
  it('정렬 가능한 열 머리글이 없다', () => {
    renderPane();

    for (const header of within(table()).getAllByRole('columnheader')) {
      expect(header.querySelector('button')).toBeNull();
      expect(header).not.toHaveAttribute('aria-sort');
    }
  });

  /** 일괄로 할 쓰기가 계약에 없다 — 선택 열만 두면 눌러도 아무 일이 없다. */
  it('행 선택 확인칸이 없다', () => {
    renderPane();

    expect(within(table()).queryAllByRole('checkbox')).toHaveLength(0);
  });
});
