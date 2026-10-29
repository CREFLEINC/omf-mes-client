import { render, screen } from '@testing-library/react';
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

  render(
    <PlanListPane
      plans={inspectionPlanFixtures}
      isLoading={false}
      appliedFilters={DEFAULT_PLAN_FILTERS}
      onApplyFilters={onApplyFilters}
      pageView={toPageView({ page: 1, size: 50, total: 3 }, 3)}
      pageMeta={{ page: 1, size: 50, total: 3 }}
      onChangePageSize={vi.fn()}
      onChangePage={onChangePage}
      selectedPlanId={null}
      onSelect={onSelect}
      loadError={null}
      itemPartsOf={(itemId) =>
        itemId === null || itemId === undefined
          ? null
          : { name: `품목 ${String(itemId)}`, code: `CODE-${String(itemId)}` }
      }
      {...overrides}
    />,
  );

  return { onApplyFilters, onSelect, onChangePage, user: userEvent.setup() };
};

describe('PlanListPane — 목록 표시', () => {
  it('기준코드·기준명·유형과 품목·상태·승인·사용 열을 낸다', () => {
    renderPane();

    /* 머리칸에는 열 순서를 옮기는 손잡이 아이콘 글자(drag_indicator)가 함께 있다 — 이름만 견준다. */
    const headers = screen
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent?.replace('drag_indicator', ''));
    expect(headers).toEqual([
      '기준코드',
      '기준명',
      '검사 유형',
      '품목',
      '상태',
      '승인 여부',
      '사용 여부',
    ]);
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

  /* 줄 아무 곳이나 눌러도 고른다 — 검사 조회·판정 목록과 같다(omf-all-around#196). */
  it('기준명 칸을 눌러도 그 줄의 기준을 고른다', async () => {
    const { onSelect, user } = renderPane();

    await user.click(screen.getByText(inspectionPlanFixtures[1]?.inspectionPlanName ?? ''));

    expect(onSelect).toHaveBeenCalledWith(inspectionPlanFixtures[1]?.inspectionPlanId);
  });

  /* 표 아래 「선택한 검사 기준: …」 줄은 걷었다(사용자 지시 · #196). */
  it('고른 기준이 있어도 표 아래에 선택 문구를 내지 않는다', () => {
    renderPane({ selectedPlanId: inspectionPlanFixtures[1]?.inspectionPlanId ?? null });

    expect(screen.queryByText(/선택한 검사 기준/)).not.toBeInTheDocument();
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

describe('PlanListPane — 0건 안내', () => {
  it('조건이 걸린 0건이면 조건을 줄이라고 안내한다', () => {
    renderPane({
      plans: [],
      appliedFilters: {
        q: 'SYN',
        inspectionTypeCode: '',
        itemId: '',
        includeInactive: false,
        inactiveOnly: false,
        unapprovedOnly: false,
      },
      pageView: toPageView({ page: 1, size: 50, total: 0 }, 0),
    });

    expect(screen.getByText('조건에 맞는 검사기준이 없습니다')).toBeInTheDocument();
    expect(screen.queryByText('등록된 검사기준이 없습니다')).not.toBeInTheDocument();
  });
});

describe('PlanListPane — 쪽 이동', () => {
  it('다음을 누르면 다음 쪽 번호를 알린다', async () => {
    const { onChangePage, user } = renderPane({
      pageView: toPageView({ page: 2, size: 50, total: 240 }, 50),
      pageMeta: { page: 2, size: 50, total: 240 },
    });

    await user.click(screen.getByRole('button', { name: '다음' }));

    expect(onChangePage).toHaveBeenCalledWith(3);
  });
});
