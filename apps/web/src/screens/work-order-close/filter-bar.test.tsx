import { messages } from '@omf-mes/i18n';
import type { SelectItems } from '@crefle/web-ui';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { pickDateRange } from '../../test/date-picker';
import { WorkOrderCloseFilterBar, type WorkOrderCloseFilterValues } from './filter-bar';

const t = messages.workOrderClose.filter;
const applied: WorkOrderCloseFilterValues = {
  productionOrderId: '',
  plannedStartFrom: '',
  plannedStartTo: '',
  statusCode: 'READY',
  judgmentCode: '',
};
const productionOrderOptions: SelectItems = [
  { value: 'plan-b', label: 'Synthetic plan B' },
  { value: 'plan-a', label: 'Synthetic plan A' },
];
const statusOptions: SelectItems = [
  { value: 'READY', label: 'Ready' },
  { value: 'HOLD', label: 'Hold' },
];
const propsOf = (
  overrides: Partial<React.ComponentProps<typeof WorkOrderCloseFilterBar>> = {},
) => ({
  appliedFilters: applied,
  initialFilters: applied,
  productionOrderOptions,
  statusOptions,
  productionOrderUnavailableReason: null,
  statusUnavailableReason: null,
  onSearch: vi.fn(),
  onReset: vi.fn(),
  ...overrides,
});

const renderBar = (
  overrides: Partial<React.ComponentProps<typeof WorkOrderCloseFilterBar>> = {},
) => {
  const props = propsOf(overrides);
  return { ...props, ...render(<WorkOrderCloseFilterBar {...props} />) };
};

describe('WorkOrderCloseFilterBar', () => {
  it('uses the exact localized labels and validation copy', () => {
    expect(t).toEqual({
      pane: '마감 후보 조회 조건',
      productionOrder: 'P/O',
      plannedStartFrom: '계획 시작일(부터)',
      plannedStartTo: '계획 시작일(까지)',
      status: '마감 상태',
      judgment: '판정',
      judgmentUnavailable:
        '마감 또는 취소 상태가 들어간 조회는 판정으로 거르지 않습니다. 판정으로 거르려면 진행, 중단, 완료 중에서 상태를 고르세요.',
      closableStatuses: '진행 또는 중단',
      all: '전체',
      search: '조회',
      reset: '초기화',
      chipJudgment: expect.any(Function),
      statusRequired: '마감 상태를 선택하세요.',
      dateRange: '계획 시작일은 종료일보다 늦을 수 없습니다.',
      statusEmpty: '선택할 마감 상태가 없습니다.',
      statusLookupLoading: '마감 상태 목록을 불러오는 중입니다.',
      statusLookupFailed: '마감 상태 목록을 불러오지 못했습니다.',
      statusLookupEmpty: '사용 가능한 마감 상태가 없습니다.',
      statusLookupTruncated: '마감 상태 목록 일부만 불러와 최초 조회를 시작할 수 없습니다.',
      inProgressStatusMissing:
        '진행 상태를 확인할 수 없어 처음 조회를 시작할 수 없습니다. 새로고침한 뒤에도 같으면 시스템 관리자에게 알리세요.',
    });
  });

  it('keeps raw edits private until its semantic form submits once', async () => {
    const user = userEvent.setup();
    const { onSearch } = renderBar();
    expect(screen.getByRole('region', { name: t.pane })).toHaveClass(
      'work-order-close-filter-pane',
    );
    expect(screen.getByRole('heading', { level: 2, name: t.pane })).toBeVisible();
    await pickDateRange(
      user,
      screen.getByLabelText(t.plannedStartFrom),
      screen.getByLabelText(t.plannedStartTo),
      '2026-08-01',
      '2026-08-02',
    );
    expect(onSearch).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: t.search }));
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith({
      ...applied,
      plannedStartFrom: '2026-08-01',
      plannedStartTo: '2026-08-02',
    });
  });

  it('submits once from the form and once from an explicit Search click', async () => {
    const user = userEvent.setup();
    const first = renderBar();
    const form = screen.getByRole('button', { name: t.search }).closest('form')!;
    fireEvent.submit(form);
    expect(first.onSearch).toHaveBeenCalledTimes(1);
    first.unmount();
    const second = renderBar();
    await user.click(screen.getByRole('button', { name: t.search }));
    expect(second.onSearch).toHaveBeenCalledTimes(1);
  });

  it('preserves draft for equal applied primitives and restores all fields when one changes', async () => {
    const user = userEvent.setup();
    const initial = {
      productionOrderId: 'plan-a',
      plannedStartFrom: '2026-08-10',
      plannedStartTo: '2026-08-11',
      statusCode: 'READY',
      judgmentCode: '',
    };
    const props = propsOf({ appliedFilters: initial });
    const { rerender } = render(<WorkOrderCloseFilterBar {...props} />);
    await user.click(screen.getByRole('combobox', { name: t.productionOrder }));
    await user.click(screen.getByRole('option', { name: 'Synthetic plan B' }));
    await pickDateRange(
      user,
      screen.getByLabelText(t.plannedStartFrom),
      screen.getByLabelText(t.plannedStartTo),
      '2026-08-20',
      '2026-08-21',
    );
    await user.click(screen.getByRole('combobox', { name: t.status }));
    await user.click(screen.getByRole('option', { name: 'Hold' }));
    rerender(<WorkOrderCloseFilterBar {...props} appliedFilters={{ ...initial }} />);
    expect(screen.getByRole('combobox', { name: t.productionOrder })).toHaveTextContent(
      'Synthetic plan B',
    );
    expect(screen.getByLabelText(t.plannedStartFrom)).toHaveTextContent('2026-08-20');
    expect(screen.getByLabelText(t.plannedStartTo)).toHaveTextContent('2026-08-21');
    expect(screen.getByRole('combobox', { name: t.status })).toHaveTextContent('Hold');
    const next = { ...initial, plannedStartTo: '2026-08-31' };
    rerender(<WorkOrderCloseFilterBar {...props} appliedFilters={next} />);
    expect(screen.getByRole('combobox', { name: t.productionOrder })).toHaveTextContent(
      'Synthetic plan A',
    );
    expect(screen.getByLabelText(t.plannedStartFrom)).toHaveTextContent('2026-08-10');
    expect(screen.getByLabelText(t.plannedStartTo)).toHaveTextContent('2026-08-31');
    expect(screen.getByRole('combobox', { name: t.status })).toHaveTextContent('Ready');
  });

  it('puts all before caller P/O options but never adds it to status', async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByRole('combobox', { name: t.productionOrder }));
    const productionOrders = screen.getAllByRole('option');
    expect(productionOrders).toHaveLength(3);
    expect(productionOrders[0]).toHaveAccessibleName(t.all);
    expect(productionOrders[1]).toHaveAccessibleName('Synthetic plan B');
    expect(productionOrders[2]).toHaveAccessibleName('Synthetic plan A');
    await user.click(screen.getByRole('combobox', { name: t.status }));
    const statuses = screen.getAllByRole('option');
    expect(statuses).toHaveLength(2);
    expect(statuses[0]).toHaveAccessibleName('Ready');
    expect(statuses[1]).toHaveAccessibleName('Hold');
  });

  it.each([
    ['productionOrder', productionOrderOptions, 'Synthetic P/O unavailable'],
    ['status', [], 'Synthetic status unavailable'],
  ] as ['productionOrder' | 'status', SelectItems, string][])(
    'disables and describes unavailable %s choices',
    (field, options, reason) => {
      renderBar(
        field === 'productionOrder'
          ? { productionOrderOptions: options, productionOrderUnavailableReason: reason }
          : { statusOptions: options, statusUnavailableReason: reason },
      );
      const select = screen.getByRole('combobox', { name: t[field] });
      expect(select).toBeDisabled();
      expect(select).toHaveAccessibleDescription(reason);
      expect(screen.queryByText(t.statusEmpty)).not.toBeInTheDocument();
    },
  );

  it('uses the empty status fallback only without a caller reason', () => {
    renderBar({ statusOptions: [] });
    const status = screen.getByRole('combobox', { name: t.status });
    expect(status).toBeDisabled();
    expect(screen.getByText(t.statusEmpty)).toBeVisible();
    expect(status).toHaveAccessibleDescription(t.statusEmpty);
  });

  it.each([
    [{ ...applied, statusCode: '' }, t.statusRequired],
    [{ ...applied, plannedStartFrom: '2026-08-03', plannedStartTo: '2026-08-02' }, t.dateRange],
    [
      { ...applied, statusCode: '', plannedStartFrom: '2026-08-03', plannedStartTo: '2026-08-02' },
      `${t.statusRequired} ${t.dateRange}`,
    ],
  ] as const)('blocks invalid search with ordered reasons', (filters, reason) => {
    const { onSearch } = renderBar({ appliedFilters: filters });
    const search = screen.getByRole('button', { name: t.search });
    expect(search).toBeDisabled();
    expect(search).toHaveAccessibleDescription(reason);
    fireEvent.submit(search.closest('form')!);
    expect(onSearch).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...applied, plannedStartFrom: '2026-08-02' }],
    [{ ...applied, plannedStartTo: '2026-08-02' }],
    [{ ...applied, plannedStartFrom: '2026-08-02', plannedStartTo: '2026-08-02' }],
  ] as const)('allows valid partial or equal dates', (filters) => {
    renderBar({ appliedFilters: filters });
    expect(screen.getByRole('button', { name: t.search })).toBeEnabled();
  });

  it('delegates reset without changing the local draft or adding actions', async () => {
    const user = userEvent.setup();
    const { onReset } = renderBar();
    /* 처음 값 그대로면 「초기화」가 없다(C-6). */
    expect(screen.queryByRole('button', { name: t.reset })).not.toBeInTheDocument();
    const start = screen.getByLabelText(t.plannedStartFrom);
    const end = screen.getByLabelText(t.plannedStartTo);
    await pickDateRange(user, start, end, '2026-08-01', '2026-08-02');
    await user.click(screen.getByRole('button', { name: t.reset }));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(start).toHaveTextContent('2026-08-01');
    expect(end).toHaveTextContent('2026-08-02');
    /* 계획 시작일 달력 단추 둘(시작 · 끝)과 조회 · 초기화 · 조건 더보기뿐이다. */
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });

  it('걸린 조건이 처음 값과 다르면 고치지 않아도 「초기화」가 보인다', () => {
    renderBar({ appliedFilters: { ...applied, plannedStartTo: '2026-08-31' } });
    expect(screen.getByRole('button', { name: t.reset })).toBeVisible();
  });

  it('판정은 「조건 더보기」 안에 접혀 있고, P/O · 계획 시작일 · 마감 상태는 늘 보인다', async () => {
    const user = userEvent.setup();
    renderBar();
    const more = screen.getByRole('button', { name: messages.common.filterMore.open });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('combobox', { name: t.judgment })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: t.productionOrder })).toBeVisible();
    expect(screen.getByLabelText(t.plannedStartFrom)).toBeVisible();
    expect(screen.getByLabelText(t.plannedStartTo)).toBeVisible();
    expect(screen.getByRole('combobox', { name: t.status })).toBeVisible();

    await user.click(more);

    expect(screen.getByRole('combobox', { name: t.judgment })).toBeVisible();
    expect(screen.getByRole('button', { name: messages.common.filterMore.close })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('접힌 칸(판정)에 걸린 조건만 칩이 되고 ×가 그 조건만 풀어 조회한다', async () => {
    const user = userEvent.setup();
    const filters = {
      ...applied,
      productionOrderId: 'plan-a',
      plannedStartFrom: '2026-08-01',
      judgmentCode: 'UNDER',
    };
    const { onSearch } = renderBar({ appliedFilters: filters });

    expect(screen.getByText(t.chipJudgment('미달'))).toBeVisible();
    /* 보이는 칸(P/O · 계획 시작일 · 마감 상태)은 칩으로 겹쳐 적지 않는다. */
    expect(screen.getAllByRole('button', { name: /조건 제거$/ })).toHaveLength(1);

    await user.click(
      screen.getByRole('button', {
        name: messages.common.filterMore.remove(t.chipJudgment('미달')),
      }),
    );
    expect(onSearch).toHaveBeenCalledWith({ ...filters, judgmentCode: '' });

    await user.click(screen.getByRole('button', { name: messages.common.filterMore.open }));
    expect(screen.queryByText(t.chipJudgment('미달'))).not.toBeInTheDocument();
  });

  it('판정을 골라 조회에 싣고, 마감 상태를 고르면 판정 칸을 막고 까닭을 말한다', async () => {
    const user = userEvent.setup();
    const { onSearch } = renderBar({
      statusOptions: [...statusOptions, { value: 'CLOSED', label: 'Closed' }],
    });
    await user.click(screen.getByRole('button', { name: messages.common.filterMore.open }));

    await user.click(screen.getByRole('combobox', { name: t.judgment }));
    await user.click(screen.getByRole('option', { name: '미달' }));
    await user.click(screen.getByRole('button', { name: t.search }));
    expect(onSearch).toHaveBeenLastCalledWith(expect.objectContaining({ judgmentCode: 'UNDER' }));

    await user.click(screen.getByRole('combobox', { name: t.status }));
    await user.click(screen.getByRole('option', { name: 'Closed' }));
    const judgment = screen.getByRole('combobox', { name: t.judgment });
    expect(judgment).toBeDisabled();
    expect(judgment).toHaveAccessibleDescription(t.judgmentUnavailable);
    await user.click(screen.getByRole('button', { name: t.search }));
    expect(onSearch).toHaveBeenLastCalledWith(
      expect.objectContaining({ statusCode: 'CLOSED', judgmentCode: '' }),
    );
  });
});
