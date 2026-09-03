import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { toApprovalTypeOptions } from './code-options';
import { DEFAULT_FILTERS } from './filters';
import { BUSINESS_UNIT_LABEL } from './fixtures';
import { RouteFilterBar, type RouteFilterBarProps } from './route-filter-bar';

const t = messages.approvalRoute;

const baseProps = (overrides: Partial<RouteFilterBarProps> = {}): RouteFilterBarProps => ({
  appliedFilters: DEFAULT_FILTERS,
  approvalTypeOptions: [],
  businessUnitOptions: [{ value: '9101', label: BUSINESS_UNIT_LABEL }],
  businessUnitLabel: () => BUSINESS_UNIT_LABEL,
  onSearch: vi.fn(),
  onRemoveFilter: vi.fn(),
  onReset: vi.fn(),
  ...overrides,
});

const renderBar = (overrides: Partial<RouteFilterBarProps> = {}) => {
  const props = baseProps(overrides);
  const result = render(<RouteFilterBar {...props} />);

  return { ...props, ...result, user: userEvent.setup() };
};

describe('RouteFilterBar — 모아서 적용', () => {
  it('적용된 조건이 컨트롤에 서 있다', () => {
    renderBar({ appliedFilters: { ...DEFAULT_FILTERS, q: 'SAMPLE' } });

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('SAMPLE');
  });

  it('입력만으로는 조회하지 않는다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.q), 'SAMPLE');

    expect(onSearch).not.toHaveBeenCalled();
  });

  it('조회를 누르면 지금 고친 조건이 통째로 나간다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.q), 'SAMPLE');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, q: 'SAMPLE' });
  });

  it('사업부를 고르면 조회에 함께 실린다', async () => {
    const { onSearch, user } = renderBar();

    await user.click(screen.getByRole('combobox', { name: t.fields.businessUnit }));
    await user.click(screen.getByRole('option', { name: BUSINESS_UNIT_LABEL }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, businessUnitId: '9101' });
  });

  it('「미사용 포함」을 켜면 조회에 함께 실린다', async () => {
    const { onSearch, user } = renderBar();

    await user.click(screen.getByRole('checkbox', { name: messages.common.includeInactive }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, includeInactive: true });
  });

  it('검색칸에서 엔터로도 조회된다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.q), 'SAMPLE{Enter}');

    expect(onSearch).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, q: 'SAMPLE' });
  });

  it('초기화는 자기 편집 상태까지 함께 비운다', async () => {
    const { onReset, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.q), 'SAMPLE');
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(t.fields.q)).toHaveValue('');
  });

  it('주소가 바뀌면 편집 중인 값도 그 값으로 되돌아간다', () => {
    const { rerender } = renderBar({ appliedFilters: { ...DEFAULT_FILTERS, q: 'SAMPLE' } });

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('SAMPLE');

    rerender(<RouteFilterBar {...baseProps({ appliedFilters: DEFAULT_FILTERS })} />);

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('');
  });

  /**
   * 부모는 렌더할 때마다 주소에서 값을 새로 읽으므로 **내용이 같아도 참조가 달라진다**
   * (조회 응답이 도착해 다시 그려질 때가 그렇다). 되돌림을 참조에 반응시키면 그때마다
   * 사용자가 치던 값이 사라진다 — 그래서 **일부러 매번 새 객체를 준다.**
   */
  it('내용이 같은 새 조건 객체가 와도 치던 값을 지우지 않는다', async () => {
    const { rerender } = render(
      <RouteFilterBar {...baseProps({ appliedFilters: { ...DEFAULT_FILTERS } })} />,
    );
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(t.fields.q), 'SAMPLE');
    rerender(<RouteFilterBar {...baseProps({ appliedFilters: { ...DEFAULT_FILTERS } })} />);

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('SAMPLE');
  });
});

describe('RouteFilterBar — 승인 유형 자리표시', () => {
  it('선택지가 비어 있고 왜 비었는지 밝힌다', () => {
    renderBar({ approvalTypeOptions: [] });

    const control = screen.getByRole('combobox', { name: t.fields.approvalTypeCode });

    expect(screen.getByText(messages.pendingCode.note)).toBeInTheDocument();
    expect(control).toHaveAccessibleDescription(messages.pendingCode.note);
  });

  it('값 목록이 차면 「전체」와 함께 고를 수 있다', async () => {
    const { user } = renderBar({
      approvalTypeOptions: toApprovalTypeOptions(['GOODS_ISSUE_DISPOSAL', 'INVENTORY_ADJUSTMENT']),
    });

    expect(screen.queryByText(messages.pendingCode.note)).not.toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: t.fields.approvalTypeCode }));

    expect(screen.getByRole('option', { name: t.filters.all })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'GOODS_ISSUE_DISPOSAL' })).toBeInTheDocument();
  });

  it('고를 것이 없는 칸에는 「전체」도 붙이지 않는다', async () => {
    const { user } = renderBar({ approvalTypeOptions: [] });

    await user.click(screen.getByRole('combobox', { name: t.fields.approvalTypeCode }));

    expect(screen.queryByRole('option', { name: t.filters.all })).not.toBeInTheDocument();
  });
});

describe('RouteFilterBar — 사업부 선택지', () => {
  it('선택지의 한계를 밝힌다', () => {
    renderBar({ businessUnitNote: t.filters.lookupTruncated });

    expect(screen.getByText(t.filters.lookupTruncated)).toBeInTheDocument();
  });

  it('한계가 없으면 안내도 없다', () => {
    renderBar();

    expect(screen.queryByText(t.filters.lookupTruncated)).not.toBeInTheDocument();
    expect(screen.queryByText(t.filters.lookupFailed)).not.toBeInTheDocument();
  });
});

describe('RouteFilterBar — 조건 칩', () => {
  it('걸린 조건마다 칩 하나를 낸다', () => {
    renderBar({
      appliedFilters: {
        approvalTypeCode: 'GOODS_ISSUE_DISPOSAL',
        businessUnitId: '9101',
        includeInactive: true,
        q: 'SAMPLE',
      },
    });

    expect(
      screen.getByText(t.filters.chipApprovalType('GOODS_ISSUE_DISPOSAL')),
    ).toBeInTheDocument();
    expect(screen.getByText(t.filters.chipBusinessUnit(BUSINESS_UNIT_LABEL))).toBeInTheDocument();
    expect(screen.getByText(t.filters.chipKeyword('SAMPLE'))).toBeInTheDocument();

    /*
     * 「미사용 포함」은 확인칸의 이름이기도 하다 — 글자로 찾으면 둘이 잡힌다.
     * 칩임을 확실히 하려고 그 칩의 제거 버튼으로 집는다.
     */
    for (const removeLabel of [
      t.filters.chipRemoveApprovalType,
      t.filters.chipRemoveBusinessUnit,
      t.filters.chipRemoveKeyword,
      t.filters.chipRemoveIncludeInactive,
    ]) {
      expect(screen.getByRole('button', { name: removeLabel })).toBeInTheDocument();
    }
  });

  it('사업부 칩에 내부 번호가 없다', () => {
    renderBar({ appliedFilters: { ...DEFAULT_FILTERS, businessUnitId: '9101' } });

    const chip = screen.getByText(t.filters.chipBusinessUnit(BUSINESS_UNIT_LABEL));

    expect(chip).toHaveTextContent(BUSINESS_UNIT_LABEL);
    expect(chip.textContent).not.toContain('9101');
  });

  it('칩의 ×는 그 조건 하나만 즉시 푼다', async () => {
    const { onRemoveFilter, user } = renderBar({
      appliedFilters: { ...DEFAULT_FILTERS, q: 'SAMPLE', includeInactive: true },
    });

    await user.click(screen.getByRole('button', { name: t.filters.chipRemoveKeyword }));

    expect(onRemoveFilter).toHaveBeenCalledWith('q');
  });

  it('조건이 없으면 칩도 없다', () => {
    renderBar();

    expect(
      screen.queryByRole('button', { name: t.filters.chipRemoveKeyword }),
    ).not.toBeInTheDocument();
  });
});
