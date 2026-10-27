import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_PLAN_FILTERS } from './code-options';
import { PlanFilterBar } from './plan-filter-bar';
import type { PlanFilters } from './types';

const renderBar = (appliedFilters: PlanFilters = DEFAULT_PLAN_FILTERS) => {
  const onApplyFilters = vi.fn<(next: PlanFilters) => void>();

  render(<PlanFilterBar appliedFilters={appliedFilters} onApplyFilters={onApplyFilters} />);

  return { onApplyFilters, user: userEvent.setup() };
};

describe('PlanFilterBar — 조건', () => {
  it('조회를 누르면 편집 중이던 조건이 한꺼번에 적용된다', async () => {
    const { onApplyFilters, user } = renderBar();

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
    const { onApplyFilters, user } = renderBar();

    await user.click(screen.getByRole('checkbox', { name: '미사용 포함' }));

    expect(onApplyFilters).toHaveBeenCalledWith({
      q: '',
      inspectionTypeCode: '',
      includeInactive: true,
    });
  });

  /*
   * 규범 3-2 — 디자인 시스템 이슈 #62로 선택지 목록이 트리거 폭에 갇힌다.
   * 최소 폭을 주지 않으면 「IQC (수입검사)」가 「IQC (수⋯」로 잘려 무엇을 고르는지 읽을 수 없다.
   * 브라우저 확인에서 실제로 잘린 자리라 클래스가 붙어 있는지 여기서 고정한다.
   */
  it('검사 유형 선택칸이 선택지 폭을 확보하는 클래스를 갖는다', () => {
    renderBar();

    expect(screen.getByRole('combobox', { name: '검사 유형' }).closest('.field-cell')).toHaveClass(
      'wide-select',
    );
  });

  it('적용된 조건마다 칩이 하나씩 서고 제거 라벨이 서로 다르다', () => {
    renderBar({ q: 'SYN', inspectionTypeCode: 'IQC', includeInactive: true });

    expect(screen.getByText('검색어: SYN')).toBeInTheDocument();
    expect(screen.getByText('검사 유형: IQC (수입검사)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '검색어 조건 제거' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '검사 유형 조건 제거' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '미사용 포함 조건 제거' })).toBeInTheDocument();
  });

  it('칩을 제거하면 그 조건만 풀린다', async () => {
    const { onApplyFilters, user } = renderBar({
      q: 'SYN',
      inspectionTypeCode: 'IQC',
      includeInactive: true,
    });

    await user.click(screen.getByRole('button', { name: '검사 유형 조건 제거' }));

    expect(onApplyFilters).toHaveBeenCalledWith({
      q: 'SYN',
      inspectionTypeCode: '',
      includeInactive: true,
    });
  });
});
