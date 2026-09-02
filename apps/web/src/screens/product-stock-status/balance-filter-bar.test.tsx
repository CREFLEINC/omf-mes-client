import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BalanceFilterBar, type BalanceFilterBarProps } from './balance-filter-bar';
import { EMPTY_FILTERS } from './filters';

const t = messages.productStockStatus;

const WAREHOUSE_OPTIONS = [{ value: '9101', label: 'SAMPLE-WH-01 · 합성 자재창고 가' }];
const ITEM_OPTIONS = [{ value: '9301', label: 'SAMPLE-ITEM-01 · 합성 품목 가' }];

const renderBar = (overrides: Partial<BalanceFilterBarProps> = {}) => {
  const onSearch = vi.fn<(filters: typeof EMPTY_FILTERS) => void>();
  const onReset = vi.fn<() => void>();
  const onRemoveFilter = vi.fn<(key: keyof typeof EMPTY_FILTERS) => void>();
  const onRetryReferences = vi.fn<() => void>();
  const onViewChange = vi.fn<(view: 'item' | 'lot' | 'location') => void>();

  render(
    <BalanceFilterBar
      appliedFilters={EMPTY_FILTERS}
      view="item"
      canUseLotView={false}
      onViewChange={onViewChange}
      warehouseOptions={WAREHOUSE_OPTIONS}
      itemOptions={ITEM_OPTIONS}
      chipNames={{ warehouse: '', item: '' }}
      referencesFailed={false}
      onRetryReferences={onRetryReferences}
      onSearch={onSearch}
      onRemoveFilter={onRemoveFilter}
      onReset={onReset}
      {...overrides}
    />,
  );

  return {
    onSearch,
    onReset,
    onRemoveFilter,
    onRetryReferences,
    onViewChange,
    user: userEvent.setup(),
  };
};

describe('BalanceFilterBar', () => {
  it('창고를 고르기 전에는 조회 버튼이 잠기고 사유가 보인다', () => {
    renderBar();

    expect(screen.getByRole('button', { name: messages.common.search })).toBeDisabled();
    expect(screen.getByText(t.reasons.warehouseRequired)).toBeInTheDocument();
  });

  it('창고를 고르면 조회 버튼이 열리고 고른 값으로 onSearch를 부른다', async () => {
    const { onSearch, user } = renderBar();

    await user.click(screen.getByLabelText(t.fields.warehouse));
    await user.click(screen.getByRole('option', { name: WAREHOUSE_OPTIONS[0]?.label ?? '' }));
    expect(screen.getByRole('button', { name: messages.common.search })).not.toBeDisabled();

    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith({ warehouse: '9101', item: '', availableOnly: false });
  });

  it('묶기를 바꾸면 즉시 onViewChange를 부른다', async () => {
    const { onViewChange, user } = renderBar({ canUseLotView: true });

    await user.click(screen.getByLabelText(t.fields.groupBy));
    await user.click(screen.getByRole('option', { name: t.views.location }));

    expect(onViewChange).toHaveBeenCalledWith('location');
  });

  it('품목이 없으면 LOT별 묶기 사유를 낸다', () => {
    renderBar({ canUseLotView: false });

    expect(screen.getByText(t.reasons.lotViewNeedsItem)).toBeInTheDocument();
  });

  it('적용된 조건마다 칩을 내고 ×를 누르면 onRemoveFilter를 부른다', async () => {
    const { onRemoveFilter, user } = renderBar({
      appliedFilters: { warehouse: '9101', item: '', availableOnly: false },
      chipNames: { warehouse: 'SAMPLE-WH-01 · 합성 자재창고 가', item: '' },
    });

    expect(
      screen.getByText(t.filters.chipWarehouse('SAMPLE-WH-01 · 합성 자재창고 가')),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.filters.chipRemoveWarehouse }));

    expect(onRemoveFilter).toHaveBeenCalledWith('warehouse');
  });

  it('초기화를 누르면 onReset을 부른다', async () => {
    const { onReset, user } = renderBar();

    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    expect(onReset).toHaveBeenCalled();
  });

  it('참조 실패를 밝히고 다시 시도를 낸다', async () => {
    const { onRetryReferences, user } = renderBar({ referencesFailed: true });

    expect(screen.getByText(t.reasons.filterReferencesFailed)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetryReferences).toHaveBeenCalled();
  });
});
