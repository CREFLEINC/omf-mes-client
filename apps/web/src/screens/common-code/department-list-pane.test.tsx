import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { indexById, orderForGrouping } from './department-hierarchy';
import { DepartmentListPane, EMPTY_SCOPED_FILTERS } from './department-list-pane';
import { toDepartmentRows } from './department-mappers';
import { departmentFixtures } from './fixtures';
import { toPageView } from './pagination';
import type { DepartmentRow, ScopedFilters } from './types';

const defaultRows = toDepartmentRows(departmentFixtures);

const renderPane = (overrides: Partial<Parameters<typeof DepartmentListPane>[0]> = {}) => {
  const onApplyFilters = vi.fn<(next: ScopedFilters) => void>();
  const onSelect = vi.fn<(departmentId: number) => void>();
  const onChangePage = vi.fn<(page: number) => void>();
  const onAddDepartment = vi.fn<() => void>();

  const { rows: givenRows, byId: givenById, ...rest } = overrides;
  const sourceRows = givenRows ?? defaultRows;
  const byId = givenById ?? indexById(sourceRows);

  render(
    <DepartmentListPane
      // 화면이 미리 정렬해 넘긴다 — 디자인 시스템 Table의 그룹 순서가 이 배열 순서로 정해진다.
      rows={orderForGrouping(sourceRows, byId)}
      byId={byId}
      isLoading={false}
      appliedFilters={EMPTY_SCOPED_FILTERS}
      onApplyFilters={onApplyFilters}
      businessUnitOptions={[{ value: '4001', label: 'SYN-BU-01 · 합성 사업부 A' }]}
      businessUnitLabel={() => 'SYN-BU-01 · 합성 사업부 A'}
      optionsNotice={null}
      pageView={toPageView({ page: 1, size: 50, total: sourceRows.length }, sourceRows.length)}
      onChangePage={onChangePage}
      selectedDepartmentId={null}
      onSelect={onSelect}
      isCreating={false}
      onAddDepartment={onAddDepartment}
      loadError={null}
      {...rest}
    />,
  );

  return { onApplyFilters, onSelect, onChangePage, onAddDepartment, user: userEvent.setup() };
};

const row = (
  departmentId: number,
  departmentCode: string,
  parentDepartmentId: number | null = null,
): DepartmentRow => ({
  departmentId,
  departmentCode,
  departmentName: `합성 부서 ${departmentCode.slice(-1)}`,
  parentDepartmentId,
  businessUnitId: null,
  isActive: true,
});

describe('DepartmentListPane — 목록 표시', () => {
  it('부서코드·부서명 두 열만 낸다', () => {
    renderPane();

    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      '부서코드',
      '부서명',
    ]);
  });

  /* 좁은 좌 페인에서 「사용 여부」 열을 더 두면 이름 열이 짓눌린다(결정 11). */
  it('미사용 행은 열을 늘리지 않고 이름 뒤 접미로 알린다', () => {
    renderPane();

    expect(screen.getByText('합성 부서 D (미사용)')).toBeInTheDocument();
    expect(screen.getByText('합성 부서 A')).toBeInTheDocument();
  });

  it('고른 부서의 행에 선택 표식이 붙는다', () => {
    renderPane({ selectedDepartmentId: 3002 });

    expect(screen.getByRole('button', { name: 'SYN-DEPT-02' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('button', { name: 'SYN-DEPT-01' })).not.toHaveAttribute('aria-current');
  });

  it('부서코드를 누르면 그 부서 번호를 알린다', async () => {
    const { onSelect, user } = renderPane();

    await user.click(screen.getByRole('button', { name: 'SYN-DEPT-03' }));

    expect(onSelect).toHaveBeenCalledWith(3003);
  });
});

describe('DepartmentListPane — 계층 표시', () => {
  /*
   * 목 서버가 자기참조 행을 준다 — 접히지 않으면 대표가 자기 자신인 그룹이 생겨
   * 「합성 부서 A」가 자기 그룹의 하위로도 보인다.
   */
  it('그룹 머리글이 대표 부서의 코드·이름으로 보인다', () => {
    renderPane();

    expect(screen.getByText('SYN-DEPT-01 · 합성 부서 A')).toBeInTheDocument();
    expect(screen.getByText('SYN-DEPT-03 · 합성 부서 C')).toBeInTheDocument();
  });

  /* 빈 그룹 키를 쓰면 디자인 시스템 Table이 빈 머리글을 그대로 그린다. */
  it('상위를 이 쪽에서 찾을 수 없는 행은 고아 그룹에 모이고 머리글이 비지 않는다', () => {
    const rows = [row(3001, 'SYN-DEPT-01'), row(3009, 'SYN-DEPT-09', 9999)];

    renderPane({ rows, byId: indexById(rows) });

    expect(screen.getByText('상위 부서가 이 쪽에 없음')).toBeInTheDocument();
  });

  /* 이슈 §6이 예고한 「2단 표시로는 부족한」 상태를 감추지 않는다. */
  it('3단 이상 계층이 있으면 목록 위에 안내가 뜬다', () => {
    const rows = [
      row(3001, 'SYN-DEPT-01'),
      row(3002, 'SYN-DEPT-02', 3001),
      row(3006, 'SYN-DEPT-06', 3002),
    ];

    renderPane({ rows, byId: indexById(rows) });

    expect(screen.getByText(/3단 이상 계층이 있습니다/)).toBeInTheDocument();
  });

  it('2단까지면 안내가 뜨지 않는다', () => {
    renderPane();

    expect(screen.queryByText(/3단 이상 계층이 있습니다/)).not.toBeInTheDocument();
  });
});

describe('DepartmentListPane — 조건', () => {
  it('검색어를 고치고 조회를 누르면 그 조건을 알린다', async () => {
    const { onApplyFilters, user } = renderPane();

    await user.type(screen.getByLabelText('부서 검색'), 'SYN');
    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(onApplyFilters).toHaveBeenCalledWith({
      q: 'SYN',
      scopeId: '',
      includeInactive: false,
    });
  });

  /* 해제 축이라 변경 즉시 적용한다 — 조회 버튼을 기다리지 않는다. */
  it('미사용 포함은 누르는 즉시 적용된다', async () => {
    const { onApplyFilters, user } = renderPane();

    await user.click(screen.getByRole('checkbox', { name: '미사용 포함' }));

    expect(onApplyFilters).toHaveBeenCalledWith({ q: '', scopeId: '', includeInactive: true });
  });

  it('걸린 조건마다 칩이 보이고 제거 버튼이 그 조건만 푼다', async () => {
    const { onApplyFilters, user } = renderPane({
      appliedFilters: { q: 'SYN', scopeId: '4001', includeInactive: false },
    });

    expect(screen.getByText('검색어: SYN')).toBeInTheDocument();
    expect(screen.getByText('사업부: SYN-BU-01 · 합성 사업부 A')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '사업부 조건 제거' }));

    expect(onApplyFilters).toHaveBeenCalledWith({ q: 'SYN', scopeId: '', includeInactive: false });
  });

  it('선택 목록 안내 슬롯을 필터 위에 낸다', () => {
    renderPane({ optionsNotice: <p>선택 목록을 불러오지 못했습니다</p> });

    expect(screen.getByText('선택 목록을 불러오지 못했습니다')).toBeInTheDocument();
  });
});

describe('DepartmentListPane — 빈 상태와 실패', () => {
  it('조건이 걸린 0건에는 초기화 길을 함께 낸다', () => {
    renderPane({
      rows: [],
      byId: indexById([]),
      appliedFilters: { q: 'SYN', scopeId: '', includeInactive: false },
      pageView: toPageView({ page: 1, size: 50, total: 0 }, 0),
    });

    expect(screen.getByText('조건에 맞는 부서가 없습니다')).toBeInTheDocument();
    expect(screen.queryByText('등록된 부서가 없습니다')).not.toBeInTheDocument();
    // 빈 상태 안에도 초기화 길이 있다 — 필터 바까지 눈을 옮기지 않고 되돌릴 수 있어야 한다.
    expect(
      within(screen.getByRole('table')).getByRole('button', { name: '초기화' }),
    ).toBeInTheDocument();
  });

  it('조건 없는 0건에는 등록 길을 낸다', () => {
    renderPane({
      rows: [],
      byId: indexById([]),
      pageView: toPageView({ page: 1, size: 50, total: 0 }, 0),
    });

    expect(screen.getByText('등록된 부서가 없습니다')).toBeInTheDocument();
  });

  /* 결과는 있는데 이 쪽에 없다 — 「등록된 것이 없다」로 내면 거짓말이 된다. */
  it('범위 밖 쪽에는 첫 쪽으로 돌아갈 길을 낸다', async () => {
    const { onChangePage, user } = renderPane({
      rows: [],
      byId: indexById([]),
      pageView: toPageView({ page: 5, size: 50, total: 12 }, 0),
    });

    expect(screen.getByText('이 쪽에는 결과가 없습니다')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '첫 쪽으로' }));

    expect(onChangePage).toHaveBeenCalledWith(1);
  });

  it('조회 실패 표시가 있으면 표와 빈 상태를 함께 내지 않는다', () => {
    renderPane({
      rows: [],
      byId: indexById([]),
      loadError: <p>불러오지 못했습니다</p>,
    });

    expect(screen.getByText('불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('등록된 부서가 없습니다')).not.toBeInTheDocument();
  });

  it('불러오는 중에는 표 대신 진행 안내를 낸다', () => {
    renderPane({ rows: [], byId: indexById([]), isLoading: true });

    expect(screen.getByRole('status', { name: '부서 목록을 불러오는 중' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('DepartmentListPane — 부서 추가', () => {
  it('부서 추가를 누르면 알린다', async () => {
    const { onAddDepartment, user } = renderPane();

    await user.click(
      within(screen.getByRole('region', { name: '부서' })).getByRole('button', {
        name: '부서 추가',
      }),
    );

    expect(onAddDepartment).toHaveBeenCalledTimes(1);
  });

  /* 같은 폼을 두 번 열 이유가 없다. */
  it('등록 폼이 이미 열려 있으면 부서 추가가 비활성이다', () => {
    renderPane({ isCreating: true });

    expect(screen.getByRole('button', { name: '부서 추가' })).toBeDisabled();
  });
});
