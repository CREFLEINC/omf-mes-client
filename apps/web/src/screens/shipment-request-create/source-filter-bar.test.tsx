import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EMPTY_FILTERS } from './filters';
import { SourceFilterBar } from './source-filter-bar';

const t = messages.shipmentRequestCreate;

const customerOptions = [{ value: '8201', label: 'SAMPLE-CUST-01 · 합성 고객 가' }];

describe('SourceFilterBar', () => {
  it('미편성만을 켜고 조회를 누르면 그 값으로 onSearch를 부른다', async () => {
    const onSearch = vi.fn<(filters: typeof EMPTY_FILTERS) => void>();
    const user = userEvent.setup();

    render(
      <SourceFilterBar
        appliedFilters={EMPTY_FILTERS}
        customerOptions={customerOptions}
        customerName={t.values.empty}
        onSearch={onSearch}
        onRemoveFilter={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('checkbox', { name: t.filters.unassignedOnly }));
    await user.click(screen.getByRole('button', { name: t.filters.search }));

    expect(onSearch).toHaveBeenCalledWith({ ...EMPTY_FILTERS, unassignedOnly: true });
  });

  it('「초기화」는 처음 값과 달라진 것이 있을 때만 보이고, 누르면 상위에 알린다', async () => {
    const onReset = vi.fn<() => void>();
    const user = userEvent.setup();

    render(
      <SourceFilterBar
        appliedFilters={EMPTY_FILTERS}
        customerOptions={customerOptions}
        customerName={t.values.empty}
        onSearch={vi.fn()}
        onRemoveFilter={vi.fn()}
        onReset={onReset}
      />,
    );

    expect(screen.queryByRole('button', { name: t.filters.reset })).toBeNull();

    await user.click(screen.getByRole('checkbox', { name: t.filters.unassignedOnly }));
    await user.click(screen.getByRole('button', { name: t.filters.reset }));

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('checkbox', { name: t.filters.unassignedOnly })).not.toBeChecked();
    expect(screen.queryByRole('button', { name: t.filters.reset })).toBeNull();
  });

  it('칸에 값이 보이는 조건은 칩으로 겹쳐 적지 않는다(C-6)', () => {
    render(
      <SourceFilterBar
        appliedFilters={{
          customer: '8201',
          orderDateFrom: '2026-08-01',
          orderDateTo: '2026-08-31',
          unassignedOnly: true,
        }}
        customerOptions={customerOptions}
        customerName={customerOptions[0]?.label ?? ''}
        onSearch={vi.fn()}
        onRemoveFilter={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    /* 선행 단언 — 조건 줄이 그려지고 처음 값과 다르다. */
    expect(screen.getByRole('button', { name: t.filters.reset })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.filters.chipRemoveCustomer })).toBeNull();
    expect(screen.queryByRole('button', { name: t.filters.chipRemovePeriod })).toBeNull();
    expect(screen.queryByRole('button', { name: t.filters.chipRemoveUnassignedOnly })).toBeNull();
  });

  it('주소로 들어온 끝만 있는 주문일은 칸이 그리지 못해 칩으로 남고, ×가 period 로 onRemoveFilter를 부른다', async () => {
    const onRemoveFilter = vi.fn<(key: 'customer' | 'period' | 'unassignedOnly') => void>();
    const user = userEvent.setup();

    render(
      <SourceFilterBar
        appliedFilters={{ ...EMPTY_FILTERS, orderDateTo: '2026-08-31' }}
        customerOptions={customerOptions}
        customerName={t.values.empty}
        onSearch={vi.fn()}
        onRemoveFilter={onRemoveFilter}
        onReset={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: t.filters.chipRemovePeriod }));

    expect(onRemoveFilter).toHaveBeenCalledWith('period');
  });
});
