import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  defaultWarehouseFilters,
  type WarehouseFilters,
  visibleWarehouses,
  WarehouseFilterBar,
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

  render(
    <WarehouseFilterBar
      appliedFilters={defaultWarehouseFilters}
      onApplyFilters={onApplyFilters}
      warehouseTypeOptions={lookupFixtures.warehouseTypes}
      plantOptions={lookupFixtures.plants}
      {...overrides}
    />,
  );

  return { onApplyFilters };
};

describe('WarehouseFilterBar', () => {
  /* 안 A(사용자 결정 2026-11-24) — 한 줄, [조회] · [창고 추가] 없음. */
  it('검색 · 공장 · 유형 · 미사용 포함이 한 줄에 있고 조회 · 창고 추가 단추가 없다', () => {
    renderPane();

    const row = screen.getByLabelText('창고 검색').closest('.warehouse-location-filter-row');
    expect(row).toHaveClass('is-one-line');
    expect(row).toContainElement(screen.getByRole('combobox', { name: '공장' }));
    expect(row).toContainElement(screen.getByRole('checkbox', { name: '미사용 포함' }));
    expect(screen.queryByRole('button', { name: '조회' })).toBeNull();
    expect(screen.queryByRole('button', { name: '창고 추가' })).toBeNull();
  });

  it('검색어는 입력이 멈추면 한 번만 적용한다 — 글자마다 부르지 않는다', async () => {
    const user = userEvent.setup();
    const { onApplyFilters } = renderPane();

    await user.type(screen.getByLabelText('창고 검색'), 'WH-0');
    expect(onApplyFilters).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(onApplyFilters).toHaveBeenCalledWith({ ...defaultWarehouseFilters, q: 'WH-0' }),
    );
    expect(onApplyFilters).toHaveBeenCalledTimes(1);
  });

  it('Enter 는 기다리지 않고 바로 적용한다', async () => {
    const user = userEvent.setup();
    const { onApplyFilters } = renderPane();

    await user.type(screen.getByLabelText('창고 검색'), 'WH{Enter}');

    expect(onApplyFilters).toHaveBeenCalledWith({ ...defaultWarehouseFilters, q: 'WH' });
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
});

describe('창고 배치도에서 쓰는 조건 상자', () => {
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

describe('visibleWarehouses', () => {
  const rows = [
    { warehouseId: 1, isExternal: false },
    { warehouseId: 2, isExternal: true },
  ];

  it('외부 창고는 숨긴다', () => {
    expect(
      visibleWarehouses(rows, { includeInactive: false }).map((row) => row.warehouseId),
    ).toEqual([1]);
  });

  it('「미사용 포함」이면 외부 창고도 보인다 — 다시 내부로 되돌릴 길이다', () => {
    expect(
      visibleWarehouses(rows, { includeInactive: true }).map((row) => row.warehouseId),
    ).toEqual([1, 2]);
  });
});
