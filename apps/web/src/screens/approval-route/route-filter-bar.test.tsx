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
  onSearch: vi.fn(),
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

    await user.click(screen.getByRole('combobox', { name: t.filters.businessUnitSelect }));
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

  it('초기화는 바뀐 것이 생겨야 나타나고, 자기 편집 상태까지 함께 비운다', async () => {
    const { onReset, user } = renderBar();
    expect(screen.queryByRole('button', { name: messages.common.reset })).toBeNull();

    await user.type(screen.getByLabelText(t.fields.q), 'SAMPLE');
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(t.fields.q)).toHaveValue('');
    expect(screen.queryByRole('button', { name: messages.common.reset })).toBeNull();
  });

  it('적용된 조건이 처음 값과 다르면 초기화가 보인다', () => {
    renderBar({ appliedFilters: { ...DEFAULT_FILTERS, includeInactive: true } });

    expect(screen.getByRole('button', { name: messages.common.reset })).toBeInTheDocument();
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

    const control = screen.getByRole('combobox', { name: t.filters.approvalTypeSelect });

    expect(screen.getByText(messages.pendingCode.note)).toBeInTheDocument();
    expect(control).toHaveAccessibleDescription(messages.pendingCode.note);
  });

  it('값 목록이 차면 「전체」와 함께 고를 수 있다', async () => {
    const { user } = renderBar({
      approvalTypeOptions: toApprovalTypeOptions(['GOODS_ISSUE_DISPOSAL', 'INVENTORY_ADJUSTMENT']),
    });

    expect(screen.queryByText(messages.pendingCode.note)).not.toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: t.filters.approvalTypeSelect }));

    expect(screen.getByRole('option', { name: t.filters.all })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '폐기 출고' })).toBeInTheDocument();
  });

  it('고를 것이 없는 칸에는 「전체」도 붙이지 않는다', async () => {
    const { user } = renderBar({ approvalTypeOptions: [] });

    await user.click(screen.getByRole('combobox', { name: t.filters.approvalTypeSelect }));

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
  it('네 조건이 모두 조건 줄에 보여 칩으로 겹쳐 적지 않는다', () => {
    renderBar({
      appliedFilters: {
        approvalTypeCode: 'GOODS_ISSUE_DISPOSAL',
        businessUnitId: '9101',
        includeInactive: true,
        q: 'SAMPLE',
      },
    });

    /* 선행 단언 — 조건이 칸에 서 있어야 「칩이 없다」가 뜻을 갖는다. */
    expect(screen.getByLabelText(t.fields.q)).toHaveValue('SAMPLE');
    expect(screen.getByRole('checkbox', { name: messages.common.includeInactive })).toBeChecked();
    expect(screen.queryByRole('button', { name: /조건 제거$/ })).not.toBeInTheDocument();
  });
});
