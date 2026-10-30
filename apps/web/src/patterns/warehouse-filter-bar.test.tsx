import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  defaultWarehouseFilters,
  WarehouseFilterBar,
  type WarehouseFilters,
  warehouseListQuery,
} from './warehouse-filter-bar';

/* 조건 상자의 선택지 — 화면 픽스처에 기대지 않는다(패턴은 화면을 모른다). */
const lookupFixtures = {
  plants: [
    { value: '11', label: '1공장' },
    { value: '12', label: '2공장' },
  ],
  warehouseTypes: [
    { value: 'MATERIAL', label: '자재' },
    { value: 'PRODUCT', label: '제품' },
    { value: 'GENERAL', label: '일반' },
  ],
};

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

  it('초기화 단추 대신 검색칸의 X 가 검색어만 비우고 바로 다시 조회한다', async () => {
    const user = userEvent.setup();
    const applied: WarehouseFilters = {
      q: 'WH',
      plantId: '12',
      warehouseTypeCode: 'MATERIAL',
      includeInactive: true,
    };
    const { onApplyFilters } = renderPane({ appliedFilters: applied });

    expect(screen.queryByRole('button', { name: '초기화' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '지우기' }));

    expect(onApplyFilters).toHaveBeenCalledWith({ ...applied, q: '' });
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

describe('창고 배치도에서 쓰는 조건 상자', () => {
  it('창고 등록을 주지 않으면 그 단추가 없다', () => {
    renderPane({ onAddWarehouse: undefined });

    expect(
      screen.queryByRole('button', { name: messages.warehouseLocation.actions.addWarehouse }),
    ).toBeNull();
  });

  it('조건을 서버 질의로 옮긴다 — 빈 조건은 싣지 않고, 숫자가 아닌 공장은 버린다', () => {
    expect(warehouseListQuery(defaultWarehouseFilters)).toEqual({ includeInactive: false });
    expect(
      warehouseListQuery({
        q: 'WH',
        plantId: 'abc',
        warehouseTypeCode: 'MATERIAL',
        includeInactive: true,
      }),
    ).toEqual({ q: 'WH', warehouseTypeCode: 'MATERIAL', includeInactive: true });
    expect(warehouseListQuery({ ...defaultWarehouseFilters, plantId: '11' })).toEqual({
      plantId: 11,
      includeInactive: false,
    });
  });
});
