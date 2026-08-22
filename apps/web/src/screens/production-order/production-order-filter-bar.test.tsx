import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_PRODUCTION_ORDER_FILTERS, type ProductionOrderFilters } from './filters';
import { ProductionOrderFilterBar } from './production-order-filter-bar';

const applied = (overrides: Partial<ProductionOrderFilters> = {}): ProductionOrderFilters => ({
  ...DEFAULT_PRODUCTION_ORDER_FILTERS,
  ...overrides,
});

const renderBar = (
  overrides: Partial<React.ComponentProps<typeof ProductionOrderFilterBar>> = {},
) => {
  const props = {
    appliedFilters: applied(),
    plantOptions: [{ value: '12', label: 'SYNTH-PLANT-A · 합성 공장' }],
    itemOptions: [{ value: '20', label: 'SYNTH-ITEM-A · 합성 품목' }],
    statusOptions: ['SYNTH-RAW'],
    onSearch: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  };
  return { ...render(<ProductionOrderFilterBar {...props} />), props, user: userEvent.setup() };
};

describe('ProductionOrderFilterBar', () => {
  it('keeps edits as a draft until Search, including Enter in q', async () => {
    const { props, user } = renderBar();
    const query = screen.getByRole('searchbox', { name: '검색' });

    await user.type(query, 'SYNTH');
    expect(props.onSearch).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(props.onSearch).toHaveBeenCalledWith(applied({ q: 'SYNTH' }));
  });

  it('delegates Reset and offers empty all options to clear every select', async () => {
    const { props, user } = renderBar();

    const selects = ['공장', '품목', '상태'].map((name) => screen.getByRole('combobox', { name }));
    for (const select of selects) {
      await user.click(select);
      await user.click(screen.getByRole('option', { name: '전체' }));
      expect(select).toHaveTextContent('전체');
    }
    await user.click(screen.getByRole('button', { name: '초기화' }));
    expect(props.onReset).toHaveBeenCalledOnce();
  });

  it('keeps a typed draft for equal applied primitives but restores it when they change', async () => {
    const { rerender, user } = renderBar({ appliedFilters: applied({ q: 'old' }) });
    const query = screen.getByRole('searchbox', { name: '검색' });

    await user.clear(query);
    await user.type(query, 'draft');
    rerender(
      <ProductionOrderFilterBar
        appliedFilters={applied({ q: 'old' })}
        plantOptions={[]}
        itemOptions={[]}
        statusOptions={[]}
        onSearch={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(query).toHaveValue('draft');
    rerender(
      <ProductionOrderFilterBar
        appliedFilters={applied({ q: 'next' })}
        plantOptions={[]}
        itemOptions={[]}
        statusOptions={[]}
        onSearch={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(query).toHaveValue('next');
  });

  it('blocks a reversed due range with an always-visible described reason', async () => {
    const { user } = renderBar();
    await user.type(screen.getByLabelText('납기 시작일'), '2026-09-02');
    await user.type(screen.getByLabelText('납기 종료일'), '2026-09-01');

    const search = screen.getByRole('button', { name: '조회' });
    const reasonId = search.getAttribute('aria-describedby');
    expect(search).toBeDisabled();
    expect(reasonId).not.toBeNull();
    expect(document.getElementById(reasonId ?? '')).toHaveTextContent(
      '납기 시작일은 종료일보다 늦을 수 없습니다.',
    );
  });
});
