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

  it('초기화를 누르면 상위에 알린다', async () => {
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
    await user.click(screen.getByRole('button', { name: t.filters.reset }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('적용된 조건마다 칩을 낸다', () => {
    render(
      <SourceFilterBar
        appliedFilters={{ ...EMPTY_FILTERS, unassignedOnly: true }}
        customerOptions={customerOptions}
        customerName={t.values.empty}
        onSearch={vi.fn()}
        onRemoveFilter={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    /* 칩의 제거 버튼으로 칩 자체를 확인한다 — 「미편성만」 글자는 확인칸 라벨과도 겹친다. */
    expect(
      screen.getByRole('button', { name: t.filters.chipRemoveUnassignedOnly }),
    ).toBeInTheDocument();
  });

  it('칩을 지우면 그 조건의 키로 onRemoveFilter를 부른다', async () => {
    const onRemoveFilter = vi.fn<(key: 'customer' | 'period' | 'unassignedOnly') => void>();
    const user = userEvent.setup();

    render(
      <SourceFilterBar
        appliedFilters={{ ...EMPTY_FILTERS, unassignedOnly: true }}
        customerOptions={customerOptions}
        customerName={t.values.empty}
        onSearch={vi.fn()}
        onRemoveFilter={onRemoveFilter}
        onReset={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: t.filters.chipRemoveUnassignedOnly }));

    expect(onRemoveFilter).toHaveBeenCalledWith('unassignedOnly');
  });
});
