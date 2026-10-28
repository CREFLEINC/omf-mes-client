import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { defaultWarehouseFilters } from './code-options';
import { lookupFixtures } from './fixtures';
import type { WarehouseFilters } from './types';
import { WarehouseFilterBar } from './warehouse-filter-bar';

const renderPane = (overrides: Partial<Parameters<typeof WarehouseFilterBar>[0]> = {}) => {
  const onApplyFilters = vi.fn();
  const onAddWarehouse = vi.fn();

  render(
    <WarehouseFilterBar
      appliedFilters={defaultWarehouseFilters}
      onApplyFilters={onApplyFilters}
      onAddWarehouse={onAddWarehouse}
      warehouseTypeOptions={lookupFixtures.warehouseTypes}
      plantOptions={lookupFixtures.plants}
      {...overrides}
    />,
  );

  return { onApplyFilters, onAddWarehouse };
};

describe('WarehouseFilterBar', () => {
  it('검색칸과 조회 단추가 있다', () => {
    renderPane();

    expect(screen.getByLabelText('창고 검색')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '조회' })).toBeInTheDocument();
  });

  it('검색어를 입력하고 조회를 누르면 입력값으로 onApplyFilters를 부른다', async () => {
    const user = userEvent.setup();
    const { onApplyFilters } = renderPane();

    await user.type(screen.getByLabelText('창고 검색'), 'WH-0');
    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(onApplyFilters).toHaveBeenCalledWith({ ...defaultWarehouseFilters, q: 'WH-0' });
  });

  it('초기화를 누르면 기본 조건으로 즉시 되돌린다', async () => {
    const user = userEvent.setup();
    const applied: WarehouseFilters = {
      q: 'WH',
      plantId: '12',
      warehouseTypeCode: 'MATERIAL',
      includeInactive: true,
    };
    const { onApplyFilters } = renderPane({ appliedFilters: applied });

    await user.click(screen.getByRole('button', { name: '초기화' }));

    expect(onApplyFilters).toHaveBeenCalledWith(defaultWarehouseFilters);
  });

  it('미사용 포함은 변경 즉시 적용한다', async () => {
    const user = userEvent.setup();
    const { onApplyFilters } = renderPane();

    await user.click(screen.getByRole('checkbox', { name: '미사용 포함' }));

    expect(onApplyFilters).toHaveBeenCalledWith({
      ...defaultWarehouseFilters,
      includeInactive: true,
    });
  });

  it('공장은 고르는 즉시 적용한다 — [조회] 없이 plantId 로 onApplyFilters 를 부른다', async () => {
    const user = userEvent.setup();
    const { onApplyFilters } = renderPane();

    await user.click(screen.getByRole('combobox', { name: '공장' }));
    await user.click(screen.getByRole('option', { name: '2공장' }));

    expect(onApplyFilters).toHaveBeenCalledWith({ ...defaultWarehouseFilters, plantId: '12' });
  });

  it('창고 추가는 조건 줄 오른쪽 끝에 있다', async () => {
    const user = userEvent.setup();
    const { onAddWarehouse } = renderPane();

    await user.click(screen.getByRole('button', { name: '창고 추가' }));

    expect(onAddWarehouse).toHaveBeenCalledTimes(1);
  });
});
