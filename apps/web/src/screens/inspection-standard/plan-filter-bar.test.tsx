import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';

import { DEFAULT_PLAN_FILTERS } from './code-options';
import { PlanFilterBar } from './plan-filter-bar';
import type { PlanFilters } from './types';

const renderBar = (appliedFilters: PlanFilters = DEFAULT_PLAN_FILTERS) => {
  const onApplyFilters = vi.fn<(next: PlanFilters) => void>();

  renderWithProviders(
    <PlanFilterBar appliedFilters={appliedFilters} onApplyFilters={onApplyFilters} />,
  );

  return { onApplyFilters, user: userEvent.setup() };
};

describe('PlanFilterBar — 조건', () => {
  it('조회를 누르면 편집 중이던 조건이 한꺼번에 적용된다', async () => {
    const { onApplyFilters, user } = renderBar({
      q: 'SYN',
      inspectionTypeCode: '',
      itemId: '',
      includeInactive: false,
      inactiveOnly: false,
      unapprovedOnly: false,
    });

    await user.click(screen.getByRole('combobox', { name: '검사 유형 선택' }));
    await user.click(screen.getByRole('option', { name: 'PQC (공정검사)' }));
    expect(onApplyFilters).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(onApplyFilters).toHaveBeenCalledWith({
      q: 'SYN',
      inspectionTypeCode: 'PQC',
      itemId: '',
      includeInactive: false,
      inactiveOnly: false,
      unapprovedOnly: false,
    });
  });

  /* 검사 기준은 창에서 골라 넣는다 — 칸에 직접 치지 않는다(검사 조회·판정의 품목 조건과 같다). */
  it('검사 기준 검색 칸은 읽기 전용이고 안내 문구가 선다', () => {
    renderBar();

    const field = screen.getByLabelText('검사 기준 검색');
    expect(field).toHaveAttribute('readonly');
    expect(field).toHaveAttribute('placeholder', '기준 코드 또는 기준명을 입력하세요');
    expect(field).toHaveAttribute('aria-haspopup', 'dialog');
  });

  /* 「미승인」은 누르는 즉시 적용한다(#208). 종전 「미사용 포함」 체크는 탭 줄 사용 여부 칩으로 옮겼다. */
  it('미승인은 누르는 즉시 적용되고 미사용 포함 체크는 없다', async () => {
    const { onApplyFilters, user } = renderBar();

    expect(screen.queryByRole('checkbox', { name: '미사용 포함' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: '미승인' }));

    expect(onApplyFilters).toHaveBeenCalledWith({
      q: '',
      inspectionTypeCode: '',
      itemId: '',
      includeInactive: false,
      inactiveOnly: false,
      unapprovedOnly: true,
    });
  });

  /*
   * 규범 3-2 — 디자인 시스템 이슈 #62로 선택지 목록이 트리거 폭에 갇힌다.
   * 최소 폭을 주지 않으면 「IQC (수입검사)」가 「IQC (수⋯」로 잘려 무엇을 고르는지 읽을 수 없다.
   * 브라우저 확인에서 실제로 잘린 자리라 클래스가 붙어 있는지 여기서 고정한다.
   */
  it('검사 유형 선택칸이 선택지 폭을 확보하는 클래스를 갖는다', () => {
    renderBar();

    expect(
      screen.getByRole('combobox', { name: '검사 유형 선택' }).closest('.field-cell'),
    ).toHaveClass('wide-select');
  });

  it('적용된 조건마다 칩이 하나씩 서고 제거 라벨이 서로 다르다', () => {
    renderBar({
      q: 'SYN',
      inspectionTypeCode: 'IQC',
      itemId: '',
      includeInactive: false,
      inactiveOnly: false,
      unapprovedOnly: true,
    });

    expect(screen.getByText('검색어: SYN')).toBeInTheDocument();
    expect(screen.getByText('검사 유형: IQC (수입검사)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '검색어 조건 제거' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '검사 유형 조건 제거' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '미승인 조건 제거' })).toBeInTheDocument();
  });

  it('칩을 제거하면 그 조건만 풀린다', async () => {
    const { onApplyFilters, user } = renderBar({
      q: 'SYN',
      inspectionTypeCode: 'IQC',
      itemId: '',
      includeInactive: true,
      inactiveOnly: false,
      unapprovedOnly: false,
    });

    await user.click(screen.getByRole('button', { name: '검사 유형 조건 제거' }));

    expect(onApplyFilters).toHaveBeenCalledWith({
      q: 'SYN',
      inspectionTypeCode: '',
      itemId: '',
      includeInactive: true,
      inactiveOnly: false,
      unapprovedOnly: false,
    });
  });
});
