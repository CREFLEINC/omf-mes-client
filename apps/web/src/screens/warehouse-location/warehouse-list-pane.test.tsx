import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { defaultWarehouseFilters, warehouseFixtures } from './fixtures';
import type { WarehouseFilters } from './types';
import { WarehouseListPane } from './warehouse-list-pane';

const renderPane = (overrides: Partial<Parameters<typeof WarehouseListPane>[0]> = {}) => {
  const onApplyFilters = vi.fn();
  const onSelect = vi.fn();

  render(
    <WarehouseListPane
      items={warehouseFixtures}
      isLoading={false}
      appliedFilters={defaultWarehouseFilters}
      onApplyFilters={onApplyFilters}
      selectedWarehouseId={null}
      onSelect={onSelect}
      {...overrides}
    />,
  );

  return { onApplyFilters, onSelect };
};

describe('WarehouseListPane', () => {
  it('예시 창고 3건을 표에 렌더한다', () => {
    renderPane();

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'WH-01' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'WH-02' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'WH-03' })).toBeInTheDocument();
    expect(screen.getByText('1공장 자재창고')).toBeInTheDocument();
  });

  it('코드 셀을 누르면 해당 warehouseId로 onSelect를 부른다', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderPane();

    await user.click(screen.getByRole('button', { name: 'WH-02' }));

    expect(onSelect).toHaveBeenCalledWith(1002);
  });

  it('선택된 창고의 코드 셀에 aria-current가 붙는다', () => {
    renderPane({ selectedWarehouseId: 1002 });

    expect(screen.getByRole('button', { name: 'WH-02' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'WH-01' })).not.toHaveAttribute('aria-current');
  });

  it('로딩 중에는 표 대신 스켈레톤을 낸다', () => {
    renderPane({ isLoading: true, items: [] });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: '창고 목록을 불러오는 중' })).toBeInTheDocument();
  });

  it('결과가 없어도 필터 바는 감추지 않는다', () => {
    renderPane({ items: [] });

    expect(screen.getByLabelText('창고 검색')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '조회' })).toBeInTheDocument();
  });

  it('기본 조건에서 결과 0건과 조건을 적용한 결과 0건의 문구가 서로 다르다', () => {
    renderPane({ items: [] });
    const noneTitle = screen.getByText('아직 등록된 창고가 없습니다');
    expect(noneTitle).toBeInTheDocument();
    expect(screen.queryByText('조건에 맞는 결과가 없습니다')).not.toBeInTheDocument();

    const applied: WarehouseFilters = { ...defaultWarehouseFilters, q: 'ZZZ' };
    renderPane({ items: [], appliedFilters: applied });
    expect(screen.getByText('조건에 맞는 결과가 없습니다')).toBeInTheDocument();
  });

  it('검색어를 입력하고 조회를 누르면 입력값으로 onApplyFilters를 부른다', async () => {
    const user = userEvent.setup();
    const { onApplyFilters } = renderPane();

    await user.type(screen.getByLabelText('창고 검색'), 'WH-0');
    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(onApplyFilters).toHaveBeenCalledWith({ ...defaultWarehouseFilters, q: 'WH-0' });
  });

  it('조건 칩을 지우면 그 조건만 되돌려 즉시 적용한다', async () => {
    const user = userEvent.setup();
    const applied: WarehouseFilters = { q: 'WH', warehouseTypeCode: 'MATERIAL', includeInactive: false };
    const { onApplyFilters } = renderPane({ appliedFilters: applied });

    await user.click(screen.getByRole('button', { name: '창고유형 조건 제거' }));

    expect(onApplyFilters).toHaveBeenCalledWith({ ...applied, warehouseTypeCode: '' });
  });

  it('적용된 조건만 칩으로 보인다 — 편집 중인 값은 칩에 나타나지 않는다', async () => {
    const user = userEvent.setup();
    renderPane();

    await user.type(screen.getByLabelText('창고 검색'), '아직-적용-안-함');

    expect(screen.queryByRole('button', { name: '검색어 조건 제거' })).not.toBeInTheDocument();
  });

  it('초기화를 누르면 기본 조건으로 즉시 되돌린다', async () => {
    const user = userEvent.setup();
    const applied: WarehouseFilters = { q: 'WH', warehouseTypeCode: 'MATERIAL', includeInactive: true };
    const { onApplyFilters } = renderPane({ appliedFilters: applied });

    await user.click(screen.getByRole('button', { name: '초기화' }));

    expect(onApplyFilters).toHaveBeenCalledWith(defaultWarehouseFilters);
  });

  it('미사용 포함은 변경 즉시 적용한다', async () => {
    const user = userEvent.setup();
    const { onApplyFilters } = renderPane();

    await user.click(screen.getByRole('checkbox', { name: '미사용 포함' }));

    expect(onApplyFilters).toHaveBeenCalledWith({ ...defaultWarehouseFilters, includeInactive: true });
  });
});
