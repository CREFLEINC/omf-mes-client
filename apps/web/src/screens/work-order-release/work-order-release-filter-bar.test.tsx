import type { SelectItems } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  WorkOrderReleaseFilterBar,
  type WorkOrderReleaseFilterBarProps,
  type WorkOrderReleaseFilterValues,
} from './work-order-release-filter-bar';

const t = messages.workOrderRelease.filter;
const applied: WorkOrderReleaseFilterValues = {
  productionLineId: '',
  plannedStartFrom: '',
  plannedStartTo: '',
  statusCode: 'SYN-READY',
};
const lineOptions: SelectItems = [
  { value: '302', label: 'SYN-LINE-B · Synthetic Line B' },
  { value: '301', label: 'SYN-LINE-A · Synthetic Line A' },
];
const statusOptions: SelectItems = [
  { value: 'SYN-READY', label: 'Synthetic Ready' },
  { value: 'SYN-HOLD', label: 'Synthetic Hold' },
];
const propsOf = (
  overrides: Partial<WorkOrderReleaseFilterBarProps> = {},
): WorkOrderReleaseFilterBarProps => ({
  appliedFilters: applied,
  productionLineOptions: lineOptions,
  statusOptions,
  productionLineUnavailableReason: null,
  statusUnavailableReason: null,
  onSearch: vi.fn(),
  onReset: vi.fn(),
  ...overrides,
});
const renderBar = (overrides: Partial<WorkOrderReleaseFilterBarProps> = {}) => {
  const props = propsOf(overrides);
  return { ...render(<WorkOrderReleaseFilterBar {...props} />), props };
};

describe('WorkOrderReleaseFilterBar', () => {
  it('keeps edits private until the semantic form submits once', async () => {
    const user = userEvent.setup();
    const { props } = renderBar();
    await user.type(screen.getByLabelText(t.plannedStartFrom), '2026-08-01');
    await user.type(screen.getByLabelText(t.plannedStartTo), '2026-08-02');
    expect(props.onSearch).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: t.search }));
    expect(props.onSearch).toHaveBeenCalledTimes(1);
    expect(props.onSearch).toHaveBeenCalledWith({
      ...applied,
      plannedStartFrom: '2026-08-01',
      plannedStartTo: '2026-08-02',
    });
  });

  it('preserves draft for equal applied primitives and restores all fields when one changes', async () => {
    const user = userEvent.setup();
    const initial = { ...applied, productionLineId: '301', plannedStartFrom: '2026-08-10' };
    const props = propsOf({ appliedFilters: initial });
    const { rerender } = render(<WorkOrderReleaseFilterBar {...props} />);
    await user.clear(screen.getByLabelText(t.plannedStartFrom));
    await user.type(screen.getByLabelText(t.plannedStartFrom), '2026-08-20');
    rerender(<WorkOrderReleaseFilterBar {...props} appliedFilters={{ ...initial }} />);
    expect(screen.getByLabelText(t.plannedStartFrom)).toHaveValue('2026-08-20');

    const next = { ...initial, plannedStartTo: '2026-08-31' };
    rerender(<WorkOrderReleaseFilterBar {...props} appliedFilters={next} />);
    expect(screen.getByLabelText(t.plannedStartFrom)).toHaveValue(initial.plannedStartFrom);
    expect(screen.getByLabelText(t.plannedStartTo)).toHaveValue(next.plannedStartTo);
    expect(screen.getByRole('combobox', { name: t.productionLine })).toHaveTextContent(
      'SYN-LINE-A',
    );
  });

  it('keeps server option order and adds all only to production lines', async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByRole('combobox', { name: t.productionLine }));
    const lines = screen.getAllByRole('option');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toHaveAccessibleName(t.all);
    expect(lines[1]).toHaveAccessibleName(lineOptions[0]?.label);
    expect(lines[2]).toHaveAccessibleName(lineOptions[1]?.label);
    await user.click(screen.getByRole('combobox', { name: t.status }));
    const statuses = screen.getAllByRole('option');
    expect(statuses).toHaveLength(2);
    expect(statuses[0]).toHaveAccessibleName(statusOptions[0]?.label);
    expect(statuses[1]).toHaveAccessibleName(statusOptions[1]?.label);
  });

  it.each([
    ['productionLine', '생산 라인: 목록을 불러오지 못했습니다.'],
    ['status', '확정 대기 상태: 목록을 불러오지 못했습니다.'],
  ] as const)('disables and describes an unavailable %s lookup', (field, reason) => {
    renderBar(
      field === 'productionLine'
        ? { productionLineUnavailableReason: reason }
        : { statusUnavailableReason: reason },
    );
    const control = screen.getByRole('combobox', { name: t[field] });
    expect(control).toBeDisabled();
    expect(control).toHaveAccessibleDescription(reason);
    expect(screen.getByText(reason)).toBeVisible();
  });

  it('uses the empty status fallback only without a caller reason', () => {
    renderBar({ statusOptions: [], appliedFilters: { ...applied, statusCode: '' } });
    const status = screen.getByRole('combobox', { name: t.status });
    expect(status).toBeDisabled();
    expect(status).toHaveAccessibleDescription(t.statusEmpty);
  });

  it.each([
    [{ ...applied, statusCode: '' }, t.statusRequired],
    [{ ...applied, plannedStartFrom: '2026-08-03', plannedStartTo: '2026-08-02' }, t.dateRange],
    [
      { ...applied, statusCode: '', plannedStartFrom: '2026-08-03', plannedStartTo: '2026-08-02' },
      `${t.statusRequired} ${t.dateRange}`,
    ],
  ] as const)('blocks invalid submit with ordered reasons', (filters, reason) => {
    const { props } = renderBar({ appliedFilters: filters });
    const search = screen.getByRole('button', { name: t.search });
    expect(search).toBeDisabled();
    expect(search).toHaveAccessibleDescription(reason);
    fireEvent.submit(search.closest('form')!);
    expect(props.onSearch).not.toHaveBeenCalled();
  });

  it('resets the local draft even when unchanged applied primitives cannot retrigger sync', async () => {
    const user = userEvent.setup();
    const { props } = renderBar();
    const from = screen.getByLabelText(t.plannedStartFrom);
    await user.click(screen.getByRole('combobox', { name: t.productionLine }));
    await user.click(screen.getByRole('option', { name: lineOptions[0]?.label }));
    await user.type(from, '2026-08-01');
    await user.click(screen.getByRole('button', { name: t.reset }));
    expect(props.onReset).toHaveBeenCalledTimes(1);
    expect(from).toHaveValue('');
    expect(screen.getByRole('combobox', { name: t.productionLine })).toHaveTextContent(t.all);
    expect(screen.getByRole('combobox', { name: t.status })).not.toHaveTextContent(
      'Synthetic Ready',
    );
    expect(screen.getByRole('button', { name: t.search })).toBeDisabled();
  });
});
