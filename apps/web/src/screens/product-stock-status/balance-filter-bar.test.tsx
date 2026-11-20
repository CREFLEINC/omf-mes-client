import { createApiClient } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiClientProvider } from '../../patterns/api-context';

import { BalanceFilterBar, type BalanceFilterBarProps } from './balance-filter-bar';
import { EMPTY_FILTERS } from './filters';

const t = messages.productStockStatus;

const WAREHOUSE_OPTIONS = [{ value: '9101', label: 'SAMPLE-WH-01 · 합성 자재창고 가' }];

const renderBar = (overrides: Partial<BalanceFilterBarProps> = {}) => {
  const onSearch = vi.fn<(filters: typeof EMPTY_FILTERS) => void>();
  const onReset = vi.fn<() => void>();
  const onRemoveFilter = vi.fn<(key: 'availableOnly') => void>();
  const onRetryReferences = vi.fn<() => void>();
  const onViewChange = vi.fn<(view: 'item' | 'lot' | 'location') => void>();

  /* 품목 칸(`ItemSelect`)이 조회 프로바이더를 쓴다. 펼치지 않으면 부르지 않는다. */
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ApiClientProvider client={createApiClient({ baseUrl: 'http://test.invalid' })}>
        <BalanceFilterBar
          appliedFilters={EMPTY_FILTERS}
          view="item"
          canUseLotView={false}
          onViewChange={onViewChange}
          warehouseOptions={WAREHOUSE_OPTIONS}
          referencesFailed={false}
          onRetryReferences={onRetryReferences}
          onSearch={onSearch}
          onRemoveFilter={onRemoveFilter}
          onReset={onReset}
          {...overrides}
        />
      </ApiClientProvider>
    </QueryClientProvider>,
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

  /* C-6 — 보이는 칸은 창고 · 품목 · 묶기 셋이고, 가용만은 「조건 더보기」에 접혀 있다. */
  it('가용만은 「조건 더보기」에 접혀 있고, 펼치면 보인다', async () => {
    const { user } = renderBar();
    const more = screen.getByRole('button', { name: messages.common.filterMore.open });

    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('checkbox', { name: t.fields.availableOnly }),
    ).not.toBeInTheDocument();

    await user.click(more);

    expect(screen.getByRole('checkbox', { name: t.fields.availableOnly })).toBeVisible();
  });

  it('접힌 가용만이 켜져 있으면 칩으로 보이고 ×가 그 조건만 푼다 — 보이는 창고는 칩이 없다', async () => {
    const { onRemoveFilter, user } = renderBar({
      appliedFilters: { warehouse: '9101', item: '', availableOnly: true },
    });

    expect(screen.getByLabelText(t.fields.warehouse)).toHaveTextContent(
      WAREHOUSE_OPTIONS[0]?.label ?? '',
    );
    expect(screen.getAllByRole('button', { name: /조건 (제거|해제)$/u })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: t.filters.chipRemoveAvailableOnly }));

    expect(onRemoveFilter).toHaveBeenCalledWith('availableOnly');
  });

  /* C-19 — 칸 폭은 정한 폭이라 고른 값에 따라 바뀌지 않는다. */
  it('창고 · 품목은 보통 폭, 묶기는 좁은 폭이다', () => {
    renderBar();

    const cellOf = (label: string) => screen.getByLabelText(label).closest('.field-cell');

    expect(cellOf(t.fields.warehouse)).toHaveClass('filter-field-md');
    expect(cellOf(t.fields.item)).toHaveClass('filter-field-md');
    expect(cellOf(t.fields.groupBy)).toHaveClass('filter-field-sm');
  });

  /* C-6 — 처음 조건 그대로면 「초기화」가 할 일이 없다. 칸을 고치면 그때 보인다. */
  it('처음 조건에서는 초기화가 없고, 칸을 고치면 나타난다', async () => {
    const { user } = renderBar();

    expect(screen.queryByRole('button', { name: messages.common.reset })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.filterMore.open }));
    await user.click(screen.getByRole('checkbox', { name: t.fields.availableOnly }));

    expect(screen.getByRole('button', { name: messages.common.reset })).toBeInTheDocument();
  });

  it('초기화를 누르면 onReset을 부른다', async () => {
    const { onReset, user } = renderBar({
      appliedFilters: { warehouse: '9101', item: '', availableOnly: false },
    });

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
