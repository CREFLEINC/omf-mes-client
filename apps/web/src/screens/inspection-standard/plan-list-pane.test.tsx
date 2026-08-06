import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_PLAN_FILTERS } from './code-options';
import { toPageView } from './pagination';
import { inspectionPlanFixtures } from './fixtures';
import { PlanListPane } from './plan-list-pane';
import type { PlanFilters } from './types';

const renderPane = (overrides: Partial<Parameters<typeof PlanListPane>[0]> = {}) => {
  const onApplyFilters = vi.fn<(next: PlanFilters) => void>();
  const onSelect = vi.fn<(id: number) => void>();
  const onChangePage = vi.fn<(page: number) => void>();
  const onAddPlan = vi.fn<() => void>();

  render(
    <PlanListPane
      plans={inspectionPlanFixtures}
      isLoading={false}
      appliedFilters={DEFAULT_PLAN_FILTERS}
      onApplyFilters={onApplyFilters}
      pageView={toPageView({ page: 1, size: 50, total: 3 }, 3)}
      onChangePage={onChangePage}
      selectedPlanId={null}
      onSelect={onSelect}
      isCreating={false}
      onAddPlan={onAddPlan}
      loadError={null}
      {...overrides}
    />,
  );

  return { onApplyFilters, onSelect, onChangePage, onAddPlan, user: userEvent.setup() };
};

describe('PlanListPane — 목록 표시', () => {
  it('기준코드·기준명·유형 세 열만 낸다', () => {
    renderPane();

    const headers = screen.getAllByRole('columnheader').map((cell) => cell.textContent);
    expect(headers).toEqual(['기준코드', '기준명', '검사 유형']);
  });

  it('고른 기준의 행에 선택 표식이 붙는다', () => {
    renderPane({ selectedPlanId: 3002 });

    expect(screen.getByRole('button', { name: 'SYN-PLAN-02' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('button', { name: 'SYN-PLAN-01' })).not.toHaveAttribute('aria-current');
  });

  it('기준코드를 누르면 그 기준 번호를 알린다', async () => {
    const { onSelect, user } = renderPane();

    await user.click(screen.getByRole('button', { name: 'SYN-PLAN-03' }));

    expect(onSelect).toHaveBeenCalledWith(3003);
  });

  /* 실패를 「등록된 검사기준이 없습니다」로 보이면 사실과 다른 안내가 된다. */
  it('조회 실패 표시가 있으면 표와 빈 상태를 함께 내지 않는다', () => {
    renderPane({ plans: [], loadError: <p>불러오지 못했습니다</p> });

    expect(screen.getByText('불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('등록된 검사기준이 없습니다')).not.toBeInTheDocument();
  });

  it('불러오는 중에는 표 대신 진행 안내를 낸다', () => {
    renderPane({ plans: [], isLoading: true });

    expect(screen.getByRole('status', { name: '검사기준 목록을 불러오는 중' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('PlanListPane — 조건', () => {
  it('조회를 누르면 편집 중이던 조건이 한꺼번에 적용된다', async () => {
    const { onApplyFilters, user } = renderPane();

    await user.type(screen.getByLabelText('검사기준 검색'), 'SYN');
    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(onApplyFilters).toHaveBeenCalledWith({
      q: 'SYN',
      inspectionTypeCode: '',
      includeInactive: false,
    });
  });

  /* 해제 축이라 변경 즉시 적용한다 — 조회를 한 번 더 누르게 하면 켜 놓고 잊는다. */
  it('미사용 포함은 누르는 즉시 적용된다', async () => {
    const { onApplyFilters, user } = renderPane();

    await user.click(screen.getByRole('checkbox', { name: '미사용 포함' }));

    expect(onApplyFilters).toHaveBeenCalledWith({
      q: '',
      inspectionTypeCode: '',
      includeInactive: true,
    });
  });

  it('적용된 조건마다 칩이 하나씩 서고 제거 라벨이 서로 다르다', () => {
    renderPane({
      appliedFilters: { q: 'SYN', inspectionTypeCode: 'IQC', includeInactive: true },
    });

    expect(screen.getByText('검색어: SYN')).toBeInTheDocument();
    expect(screen.getByText('검사 유형: IQC (수입검사)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '검색어 조건 제거' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '검사 유형 조건 제거' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '미사용 포함 조건 제거' })).toBeInTheDocument();
  });

  it('칩을 제거하면 그 조건만 풀린다', async () => {
    const { onApplyFilters, user } = renderPane({
      appliedFilters: { q: 'SYN', inspectionTypeCode: 'IQC', includeInactive: true },
    });

    await user.click(screen.getByRole('button', { name: '검사 유형 조건 제거' }));

    expect(onApplyFilters).toHaveBeenCalledWith({
      q: 'SYN',
      inspectionTypeCode: '',
      includeInactive: true,
    });
  });

  it('조건이 걸린 0건이면 조건을 줄이라고 안내한다', () => {
    renderPane({
      plans: [],
      appliedFilters: { q: 'SYN', inspectionTypeCode: '', includeInactive: false },
      pageView: toPageView({ page: 1, size: 50, total: 0 }, 0),
    });

    expect(screen.getByText('조건에 맞는 검사기준이 없습니다')).toBeInTheDocument();
    expect(screen.queryByText('등록된 검사기준이 없습니다')).not.toBeInTheDocument();
  });

  /* 결과가 없어도 조건을 고칠 수단이 사라지면 안 된다. */
  it('결과가 없어도 조건 줄은 남는다', () => {
    renderPane({ plans: [], pageView: toPageView({ page: 1, size: 50, total: 0 }, 0) });

    expect(screen.getByLabelText('검사기준 검색')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: '검사기준' })).getByRole('button', { name: '조회' })).toBeInTheDocument();
  });
});

describe('PlanListPane — 쪽 이동', () => {
  it('다음을 누르면 다음 쪽 번호를 알린다', async () => {
    const { onChangePage, user } = renderPane({
      pageView: toPageView({ page: 2, size: 50, total: 240 }, 50),
    });

    await user.click(screen.getByRole('button', { name: '다음' }));

    expect(onChangePage).toHaveBeenCalledWith(3);
  });
});
