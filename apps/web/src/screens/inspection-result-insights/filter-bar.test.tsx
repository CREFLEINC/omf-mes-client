import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EMPTY_INSPECTION_INSIGHT_FILTERS } from './filters';
import { InspectionInsightFilterBar } from './filter-bar';

const options = {
  inspectionType: [{ value: 'PQC', label: '공정검사' }],
  item: [{ value: '101', label: '합성 품목' }],
  process: [{ value: '501', label: '합성 공정' }],
  judgment: [{ value: 'REJECTED', label: '불합격' }],
};

describe('검사 결과 공통 필터', () => {
  it('기간·검사유형 전에는 조회를 막고 무관한 rerender에 편집 초안을 보존한다', async () => {
    const user = userEvent.setup();
    const props = {
      appliedFilters: EMPTY_INSPECTION_INSIGHT_FILTERS,
      options,
      onSearch: vi.fn(),
      onReset: vi.fn(),
    };
    const { rerender } = render(<InspectionInsightFilterBar {...props} />);

    expect(screen.getByRole('button', { name: '조회' })).toBeDisabled();
    expect(screen.getByText('기간과 검사유형을 선택하세요.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('시작일'), '2026-08-01');
    rerender(
      <InspectionInsightFilterBar
        {...props}
        appliedFilters={{ ...EMPTY_INSPECTION_INSIGHT_FILTERS }}
      />,
    );
    expect(screen.getByLabelText('시작일')).toHaveValue('2026-08-01');
  });

  it('표시명 선택과 명시 교정 필터를 공통 조회 조건으로 전달한다', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(
      <InspectionInsightFilterBar
        appliedFilters={EMPTY_INSPECTION_INSIGHT_FILTERS}
        options={options}
        onSearch={onSearch}
        onReset={() => undefined}
      />,
    );

    await user.type(screen.getByLabelText('시작일'), '2026-08-01');
    await user.type(screen.getByLabelText('종료일'), '2026-08-31');
    for (const [field, option] of [
      ['검사유형', '공정검사'],
      ['품목', '합성 품목'],
      ['공정', '합성 공정'],
      ['종합판정', '불합격'],
      ['교정 상태', '검교정 만료만'],
    ]) {
      await user.click(screen.getByLabelText(field!));
      await user.click(screen.getByRole('option', { name: option! }));
    }
    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(onSearch).toHaveBeenCalledWith({
      from: '2026-08-01',
      to: '2026-08-31',
      inspectionTypeCode: 'PQC',
      itemId: '101',
      processId: '501',
      overallJudgmentCode: 'REJECTED',
      finalRoundOnly: true,
      calibrationExpired: 'only',
    });
    expect(screen.getByText('최종 검사 회차만 조회합니다.')).toBeInTheDocument();
    expect(screen.queryByText('101')).not.toBeInTheDocument();
  });
});
