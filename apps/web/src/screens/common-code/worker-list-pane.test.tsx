import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EMPTY_SCOPED_FILTERS } from './department-list-pane';
import { workerFixtures } from './fixtures';
import { toPageView } from './pagination';
import type { ScopedFilters } from './types';
import { WorkerListPane } from './worker-list-pane';

const renderPane = (overrides: Partial<Parameters<typeof WorkerListPane>[0]> = {}) => {
  const onApplyFilters = vi.fn<(next: ScopedFilters) => void>();
  const onSelect = vi.fn<(workerId: number) => void>();
  const onChangePage = vi.fn<(page: number) => void>();

  render(
    <WorkerListPane
      workers={workerFixtures}
      isLoading={false}
      appliedFilters={EMPTY_SCOPED_FILTERS}
      onApplyFilters={onApplyFilters}
      departmentOptions={[{ value: '3001', label: 'SYN-DEPT-01 · 합성 부서 A' }]}
      departmentLabel={() => 'SYN-DEPT-01 · 합성 부서 A'}
      optionsNotice={null}
      pageView={toPageView(
        { page: 1, size: 50, total: workerFixtures.length },
        workerFixtures.length,
      )}
      onChangePage={onChangePage}
      selectedWorkerId={null}
      onSelect={onSelect}
      loadError={null}
      {...overrides}
    />,
  );

  return { onApplyFilters, onSelect, onChangePage, user: userEvent.setup() };
};

describe('WorkerListPane — 목록 표시', () => {
  it('사번·성명 두 열만 낸다', () => {
    renderPane();

    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      '사번',
      '성명',
    ]);
  });

  it('미사용 행은 열을 늘리지 않고 이름 뒤 접미로 알린다', () => {
    renderPane();

    expect(screen.getByText('합성 작업자 C (미사용)')).toBeInTheDocument();
  });

  it('사번을 누르면 그 작업자 번호를 알린다', async () => {
    const { onSelect, user } = renderPane();

    await user.click(screen.getByRole('button', { name: 'SYN-W-0002' }));

    expect(onSelect).toHaveBeenCalledWith(5002);
  });

  it('고른 작업자의 행에 선택 표식이 붙는다', () => {
    renderPane({ selectedWorkerId: 5002 });

    expect(screen.getByRole('button', { name: 'SYN-W-0002' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  /* 계약에 작업자 등록·수정 경로가 아예 없다 — 좌 페인에 쓰기 액션을 둘 자리가 아니다. */
  it('좌 페인에 쓰기 액션이 없다', () => {
    renderPane();

    const pane = screen.getByRole('region', { name: '작업자' });
    const actionNames = within(pane)
      .getAllByRole('button')
      .map((button) => button.textContent ?? '');

    expect(actionNames.some((name) => name.includes('추가'))).toBe(false);
    expect(actionNames.some((name) => name.includes('사용 중지'))).toBe(false);
  });
});

describe('WorkerListPane — 조건', () => {
  it('검색어를 고치고 조회를 누르면 그 조건을 알린다', async () => {
    const { onApplyFilters, user } = renderPane();

    await user.type(screen.getByLabelText('작업자 검색'), 'SYN');
    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(onApplyFilters).toHaveBeenCalledWith({ q: 'SYN', scopeId: '', includeInactive: false });
  });

  it('부서 조건 칩의 제거 버튼이 그 조건만 푼다', async () => {
    const { onApplyFilters, user } = renderPane({
      appliedFilters: { q: 'SYN', scopeId: '3001', includeInactive: false },
    });

    expect(screen.getByText('부서: SYN-DEPT-01 · 합성 부서 A')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '부서 조건 제거' }));

    expect(onApplyFilters).toHaveBeenCalledWith({ q: 'SYN', scopeId: '', includeInactive: false });
  });

  /* 공장·사업부 필터를 두지 않는다(§4.2) — 좌 페인에 컨트롤 넷을 놓으면 표가 짓눌린다. */
  it('공장·사업부 필터가 없다', () => {
    renderPane();

    expect(screen.queryByLabelText('공장')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('사업부')).not.toBeInTheDocument();
  });
});

describe('WorkerListPane — 빈 상태와 실패', () => {
  /* 여기서 만들 수 없는 자료라 「추가하세요」가 아니라 원본 시스템을 가리킨다. */
  it('조건 없는 0건에는 원본 시스템을 가리킨다', () => {
    renderPane({ workers: [], pageView: toPageView({ page: 1, size: 50, total: 0 }, 0) });

    expect(screen.getByText('등록된 작업자가 없습니다')).toBeInTheDocument();
    expect(screen.getByText(/원본 시스템을 확인하세요/)).toBeInTheDocument();
  });

  it('조건이 걸린 0건에는 초기화 길을 함께 낸다', () => {
    renderPane({
      workers: [],
      appliedFilters: { q: 'SYN', scopeId: '', includeInactive: false },
      pageView: toPageView({ page: 1, size: 50, total: 0 }, 0),
    });

    expect(screen.getByText('조건에 맞는 작업자가 없습니다')).toBeInTheDocument();
    expect(screen.queryByText('등록된 작업자가 없습니다')).not.toBeInTheDocument();
  });

  it('조회 실패 표시가 있으면 표와 빈 상태를 함께 내지 않는다', () => {
    renderPane({ workers: [], loadError: <p>불러오지 못했습니다</p> });

    expect(screen.getByText('불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('등록된 작업자가 없습니다')).not.toBeInTheDocument();
  });

  it('불러오는 중에는 표 대신 진행 안내를 낸다', () => {
    renderPane({ workers: [], isLoading: true });

    expect(screen.getByRole('status', { name: '작업자 목록을 불러오는 중' })).toBeInTheDocument();
  });
});
