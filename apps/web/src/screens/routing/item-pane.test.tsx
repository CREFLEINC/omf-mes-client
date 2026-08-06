import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { itemFixtures } from './fixtures';
import { ItemPane, type ItemPaneProps } from './item-pane';
import type { ItemFilters } from './types';

const NO_FILTERS: ItemFilters = { q: '', onlyWithoutRouting: false };

const renderPane = (overrides: Partial<ItemPaneProps> = {}) => {
  const onApplyFilters = vi.fn();
  const onSelect = vi.fn();

  render(
    <ItemPane
      items={itemFixtures}
      isLoading={false}
      appliedFilters={NO_FILTERS}
      onApplyFilters={onApplyFilters}
      selectedItemId={null}
      onSelect={onSelect}
      loadError={null}
      {...overrides}
    />,
  );

  return { onApplyFilters, onSelect, user: userEvent.setup() };
};

describe('ItemPane', () => {
  it('받은 품목을 코드·품목명으로 그린다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: 'ITM-001' })).toBeInTheDocument();
    expect(screen.getByText('하우징 커버')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ITM-003' })).toBeInTheDocument();
  });

  it('품목 코드를 누르면 선택을 알린다', async () => {
    const { onSelect, user } = renderPane();

    await user.click(screen.getByRole('button', { name: 'ITM-002' }));

    expect(onSelect).toHaveBeenCalledWith(5002);
  });

  it('선택된 품목의 코드에 현재 위치 표식이 붙는다', () => {
    renderPane({ selectedItemId: 5002 });

    expect(screen.getByRole('button', { name: 'ITM-002' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'ITM-001' })).not.toHaveAttribute('aria-current');
  });

  it('검색어를 입력하고 조회를 누르면 조건이 적용된다', async () => {
    const { onApplyFilters, user } = renderPane();

    await user.type(screen.getByLabelText('품목 검색'), 'ITM');
    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(onApplyFilters).toHaveBeenCalledWith({ q: 'ITM', onlyWithoutRouting: false });
  });

  it('「Routing 미보유만」은 해제 축이라 누르는 즉시 적용된다', async () => {
    const { onApplyFilters, user } = renderPane();

    await user.click(screen.getByRole('checkbox', { name: 'Routing 미보유만' }));

    expect(onApplyFilters).toHaveBeenCalledWith({ q: '', onlyWithoutRouting: true });
  });

  it('적용된 조건은 칩으로 보이고 칩을 지우면 그 조건만 풀린다', async () => {
    const { onApplyFilters, user } = renderPane({
      appliedFilters: { q: 'ITM', onlyWithoutRouting: true },
    });

    expect(screen.getByText('검색어: ITM')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Routing 미보유만 조건 제거' }));

    expect(onApplyFilters).toHaveBeenCalledWith({ q: 'ITM', onlyWithoutRouting: false });
  });

  it('조회에 실패하면 표도 빈 상태도 내지 않고 받은 오류 표시만 낸다', () => {
    renderPane({ items: [], loadError: <p>목록을 불러오지 못했습니다</p> });

    expect(screen.getByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('등록된 품목이 없습니다')).not.toBeInTheDocument();
  });

  it('불러오는 동안에는 스켈레톤을 낸다', () => {
    renderPane({ items: [], isLoading: true });

    expect(screen.getByRole('status', { name: '품목 목록을 불러오는 중' })).toBeInTheDocument();
  });

  it('조건이 없는 빈 목록과 조건이 있는 빈 목록은 다른 안내를 낸다', () => {
    const { unmount } = render(
      <ItemPane
        items={[]}
        isLoading={false}
        appliedFilters={NO_FILTERS}
        onApplyFilters={vi.fn()}
        selectedItemId={null}
        onSelect={vi.fn()}
        loadError={null}
      />,
    );

    expect(screen.getByText('등록된 품목이 없습니다')).toBeInTheDocument();
    unmount();

    renderPane({ items: [], appliedFilters: { q: 'ZZZ', onlyWithoutRouting: false } });

    expect(screen.getByText('조건에 맞는 품목이 없습니다')).toBeInTheDocument();
  });
});
