import { messages } from '@omf-mes/i18n';
import type { SelectItems } from '@crefle/web-ui';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WorkOrderCloseFilterBar, type WorkOrderCloseFilterValues } from './filter-bar';

const t = messages.workOrderClose.filter;
const applied: WorkOrderCloseFilterValues = {
  productionPlanId: '',
  plannedStartFrom: '',
  plannedStartTo: '',
  statusCode: 'READY',
};
const productionPlanOptions: SelectItems = [
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
  productionPlanOptions,
  statusOptions,
  productionPlanUnavailableReason: null,
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
      productionPlan: 'P/O',
      plannedStartFrom: '계획 시작일(부터)',
      plannedStartTo: '계획 시작일(까지)',
      status: '마감 상태',
      all: '전체',
      search: '조회',
      reset: '초기화',
      statusRequired: '마감 상태를 선택하세요.',
      dateRange: '계획 시작일은 종료일보다 늦을 수 없습니다.',
      statusEmpty: '선택할 마감 상태가 없습니다.',
    });
  });

  it('keeps raw edits private until its semantic form submits once', async () => {
    const user = userEvent.setup();
    const { onSearch } = renderBar();
    await user.type(screen.getByLabelText(t.plannedStartFrom), '2026-08-01');
    await user.type(screen.getByLabelText(t.plannedStartTo), '2026-08-02');
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
      productionPlanId: 'plan-a',
      plannedStartFrom: '2026-08-10',
      plannedStartTo: '2026-08-11',
      statusCode: 'READY',
    };
    const props = propsOf({ appliedFilters: initial });
    const { rerender } = render(<WorkOrderCloseFilterBar {...props} />);
    await user.click(screen.getByRole('combobox', { name: t.productionPlan }));
    await user.click(screen.getByRole('option', { name: 'Synthetic plan B' }));
    await user.clear(screen.getByLabelText(t.plannedStartFrom));
    await user.type(screen.getByLabelText(t.plannedStartFrom), '2026-08-20');
    await user.clear(screen.getByLabelText(t.plannedStartTo));
    await user.type(screen.getByLabelText(t.plannedStartTo), '2026-08-21');
    await user.click(screen.getByRole('combobox', { name: t.status }));
    await user.click(screen.getByRole('option', { name: 'Hold' }));
    rerender(<WorkOrderCloseFilterBar {...props} appliedFilters={{ ...initial }} />);
    expect(screen.getByRole('combobox', { name: t.productionPlan })).toHaveTextContent(
      'Synthetic plan B',
    );
    expect(screen.getByLabelText(t.plannedStartFrom)).toHaveValue('2026-08-20');
    expect(screen.getByLabelText(t.plannedStartTo)).toHaveValue('2026-08-21');
    expect(screen.getByRole('combobox', { name: t.status })).toHaveTextContent('Hold');
    const next = { ...initial, plannedStartTo: '2026-08-31' };
    rerender(<WorkOrderCloseFilterBar {...props} appliedFilters={next} />);
    expect(screen.getByRole('combobox', { name: t.productionPlan })).toHaveTextContent(
      'Synthetic plan A',
    );
    expect(screen.getByLabelText(t.plannedStartFrom)).toHaveValue(initial.plannedStartFrom);
    expect(screen.getByLabelText(t.plannedStartTo)).toHaveValue(next.plannedStartTo);
    expect(screen.getByRole('combobox', { name: t.status })).toHaveTextContent('Ready');
  });

  it('puts all before caller P/O options but never adds it to status', async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByRole('combobox', { name: t.productionPlan }));
    const productionPlans = screen.getAllByRole('option');
    expect(productionPlans).toHaveLength(3);
    expect(productionPlans[0]).toHaveAccessibleName(t.all);
    expect(productionPlans[1]).toHaveAccessibleName('Synthetic plan B');
    expect(productionPlans[2]).toHaveAccessibleName('Synthetic plan A');
    await user.click(screen.getByRole('combobox', { name: t.status }));
    const statuses = screen.getAllByRole('option');
    expect(statuses).toHaveLength(2);
    expect(statuses[0]).toHaveAccessibleName('Ready');
    expect(statuses[1]).toHaveAccessibleName('Hold');
  });

  it.each([
    ['productionPlan', productionPlanOptions, 'Synthetic P/O unavailable'],
    ['status', [], 'Synthetic status unavailable'],
  ] as ['productionPlan' | 'status', SelectItems, string][])(
    'disables and describes unavailable %s choices',
    (field, options, reason) => {
      renderBar(
        field === 'productionPlan'
          ? { productionPlanOptions: options, productionPlanUnavailableReason: reason }
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
    const input = screen.getByLabelText(t.plannedStartFrom);
    await user.type(input, '2026-08-01');
    await user.click(screen.getByRole('button', { name: t.reset }));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue('2026-08-01');
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
