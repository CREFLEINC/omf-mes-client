import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';

import { DEFAULT_PLAN_FILTERS, INSPECTION_TYPE_OPTIONS } from './code-options';
import { PlanFilterBar } from './plan-filter-bar';
import { SHEET_TYPE } from './type-options';
import type { PlanFilters } from './types';

const renderBar = (appliedFilters: PlanFilters = DEFAULT_PLAN_FILTERS) => {
  const onApplyFilters = vi.fn<(next: PlanFilters) => void>();

  renderWithProviders(
    <PlanFilterBar appliedFilters={appliedFilters} onApplyFilters={onApplyFilters} />,
  );

  return { onApplyFilters, user: userEvent.setup() };
};

describe('PlanFilterBar — 조건', () => {
  /* 조건을 바꾸면 「조회」를 누르지 않아도 바로 적용된다(사용자 지시 · #208). */
  it('검사 유형을 고르면 바로 조회 조건이 적용된다', async () => {
    const { onApplyFilters, user } = renderBar({
      q: 'SYN',
      inspectionTypeCode: '',
      itemId: '',
      includeInactive: false,
      inactiveOnly: false,
      versionStatus: '',
    });

    await user.click(screen.getByRole('combobox', { name: '검사 유형 선택' }));
    await user.click(screen.getByRole('option', { name: 'PQC (공정검사)' }));

    expect(onApplyFilters).toHaveBeenCalledWith({
      q: 'SYN',
      inspectionTypeCode: 'PQC',
      itemId: '',
      includeInactive: false,
      inactiveOnly: false,
      versionStatus: '',
    });
  });

  /* OA 공장은 PQC 가 검사표 기준을 연다(omf-all-around#255) — 고르면 다른 조건은 비우고 유형만 남긴다. */
  it('검사표를 여는 유형(OA 의 PQC)을 고르면 다른 조건을 비운다', async () => {
    const onApplyFilters = vi.fn<(next: PlanFilters) => void>();
    renderWithProviders(
      <PlanFilterBar
        appliedFilters={{ ...DEFAULT_PLAN_FILTERS, q: 'SYN', versionStatus: 'draft' }}
        onApplyFilters={onApplyFilters}
        sheetTypeCode={SHEET_TYPE}
      />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('combobox', { name: '검사 유형 선택' }));
    await user.click(screen.getByRole('option', { name: 'PQC (공정검사)' }));

    expect(onApplyFilters).toHaveBeenCalledWith({
      ...DEFAULT_PLAN_FILTERS,
      inspectionTypeCode: 'PQC',
    });
  });

  it('검사표를 여는 유형이 없으면(부품) PQC 는 다른 조건을 그대로 둔다', async () => {
    const onApplyFilters = vi.fn<(next: PlanFilters) => void>();
    renderWithProviders(
      <PlanFilterBar
        appliedFilters={{ ...DEFAULT_PLAN_FILTERS, q: 'SYN', versionStatus: 'draft' }}
        onApplyFilters={onApplyFilters}
      />,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('combobox', { name: '검사 유형 선택' }));
    expect(screen.queryByRole('option', { name: '제품 검사표 (OA)' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'PQC (공정검사)' }));

    expect(onApplyFilters).toHaveBeenCalledWith(
      expect.objectContaining({ inspectionTypeCode: 'PQC', q: 'SYN', versionStatus: 'draft' }),
    );
  });

  /* 검사 기준은 칸에서 바로 검색해 고른다 — 창(팝업)이 열리지 않는다(#226). 고르기 전에는 「전체」다. */
  it('검사 기준 검색 칸은 펼치면 검색창이 서고 창이 열리지 않는다', async () => {
    const { user } = renderBar();

    const field = screen.getByLabelText('검사 기준 검색');
    expect(field).toHaveTextContent('전체');
    await user.click(field);

    expect(
      await screen.findByRole('searchbox', { name: messages.common.selectSearch }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  /* 종전 「미사용 포함」 체크는 탭 줄 사용 여부 칩으로 옮겼고(#208), 「미승인」 체크는 승인 기능과 함께 걷었다(omf-all-around#357). */
  it('조건 더보기에 미사용 포함 · 미승인 체크가 없다', async () => {
    const { user } = renderBar();

    await user.click(screen.getByRole('button', { name: messages.common.filterMore.open }));
    expect(screen.queryByRole('checkbox', { name: '미사용 포함' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: '미승인' })).not.toBeInTheDocument();
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
    ).toHaveClass('inspection-standard-type-filter');
  });

  it('초기화는 처음 조건과 달라진 것이 있을 때만 보인다', async () => {
    const { user } = renderBar();

    expect(screen.queryByRole('button', { name: messages.common.reset })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.filterMore.open }));
    await user.click(screen.getByRole('combobox', { name: '상태 선택' }));
    await user.click(screen.getByRole('option', { name: '확정' }));

    expect(screen.getByRole('button', { name: messages.common.reset })).toBeInTheDocument();
  });

  it('사용 여부 칩이 「사용」이 아니어도 초기화가 보인다 — 초기화가 그것도 되돌린다', () => {
    renderBar({ ...DEFAULT_PLAN_FILTERS, includeInactive: true });

    expect(screen.getByRole('button', { name: messages.common.reset })).toBeInTheDocument();
  });
});

describe('PlanFilterBar — 조건 더보기(C-6)', () => {
  it('상태는 「조건 더보기」 안에 접혀 있다', async () => {
    const { user } = renderBar();
    const more = screen.getByRole('button', { name: messages.common.filterMore.open });

    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('combobox', { name: '상태 선택' })).not.toBeInTheDocument();
    /* 보이는 칸은 셋 — 검사 유형 · 검사 기준 검색 · 품목 검색. */
    expect(screen.getByRole('combobox', { name: '검사 유형 선택' })).toBeVisible();
    expect(screen.getByLabelText('검사 기준 검색')).toBeVisible();
    expect(screen.getByLabelText('품목 검색')).toBeVisible();

    await user.click(more);

    expect(screen.getByRole('combobox', { name: '상태 선택' })).toBeVisible();
    expect(screen.getByRole('button', { name: messages.common.filterMore.close })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('접힌 칸에 걸린 조건만 칩이 되고 보이는 칸의 조건은 칩으로 겹쳐 적지 않는다', () => {
    renderBar({
      q: 'SYN',
      inspectionTypeCode: 'IQC',
      itemId: '',
      includeInactive: false,
      inactiveOnly: false,
      versionStatus: 'confirmed',
    });

    expect(screen.getByText('상태: 확정')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '상태 조건 제거' })).toBeInTheDocument();
    expect(screen.queryByText('검색어: SYN')).not.toBeInTheDocument();
    expect(screen.queryByText('검사 유형: IQC (수입검사)')).not.toBeInTheDocument();
  });

  it('접힌 조건 칩을 제거하면 그 조건만 풀린다', async () => {
    const { onApplyFilters, user } = renderBar({
      q: 'SYN',
      inspectionTypeCode: 'IQC',
      itemId: '',
      includeInactive: true,
      inactiveOnly: false,
      versionStatus: 'draft',
    });

    await user.click(screen.getByRole('button', { name: '상태 조건 제거' }));

    expect(onApplyFilters).toHaveBeenCalledWith({
      q: 'SYN',
      inspectionTypeCode: 'IQC',
      itemId: '',
      includeInactive: true,
      inactiveOnly: false,
      versionStatus: '',
    });
  });

  it('펼치면 칸에 값이 보이므로 칩을 거둔다', async () => {
    const { user } = renderBar({ ...DEFAULT_PLAN_FILTERS, versionStatus: 'confirmed' });

    expect(screen.getByRole('button', { name: '상태 조건 제거' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: messages.common.filterMore.open }));

    expect(screen.queryByRole('button', { name: '상태 조건 제거' })).not.toBeInTheDocument();
  });
});
