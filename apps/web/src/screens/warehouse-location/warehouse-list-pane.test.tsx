import { AlertBanner } from '@crefle/web-ui';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { defaultWarehouseFilters } from './code-options';
import { lookupFixtures, plantFixtures, warehouseFixtures } from './fixtures';
import type { LookupSources, WarehouseFilters } from './types';
import { WarehouseListPane } from './warehouse-list-pane';

const plantSource: LookupSources['plants'] = {
  entries: plantFixtures.map((plant) => ({
    value: String(plant.plantId),
    label: plant.plantName,
    isActive: plant.isActive,
  })),
  isError: false,
  isLoading: false,
};

const renderPane = (overrides: Partial<Parameters<typeof WarehouseListPane>[0]> = {}) => {
  const onApplyFilters = vi.fn();
  const onSelect = vi.fn();
  const onAddWarehouse = vi.fn();

  render(
    <WarehouseListPane
      items={warehouseFixtures}
      isLoading={false}
      appliedFilters={defaultWarehouseFilters}
      onApplyFilters={onApplyFilters}
      selectedWarehouseId={null}
      onSelect={onSelect}
      onAddWarehouse={onAddWarehouse}
      loadError={null}
      warehouseTypeOptions={lookupFixtures.warehouseTypes}
      plantOptions={lookupFixtures.plants}
      plants={plantSource}
      {...overrides}
    />,
  );

  return { onApplyFilters, onSelect, onAddWarehouse };
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
    const applied: WarehouseFilters = {
      q: 'WH',
      plantId: '',
      warehouseTypeCode: 'MATERIAL',
      includeInactive: false,
    };
    const { onApplyFilters } = renderPane({ appliedFilters: applied });

    await user.click(screen.getByRole('button', { name: '창고 유형 조건 제거' }));

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

  it('등록된 것이 없을 때의 빈 상태에서 창고 추가를 눌러 onAddWarehouse를 부른다', async () => {
    const user = userEvent.setup();
    const { onAddWarehouse } = renderPane({ items: [] });

    await user.click(screen.getByRole('button', { name: '창고 추가' }));

    expect(onAddWarehouse).toHaveBeenCalledTimes(1);
  });

  it('loadError가 있으면 표와 빈 상태 대신 그것을 낸다 — 조회 실패를 「없음」으로 보이지 않는다', () => {
    renderPane({
      items: [],
      loadError: <AlertBanner variant="error" title="목록을 불러오지 못했습니다" />,
    });

    expect(screen.getByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('아직 등록된 창고가 없습니다')).not.toBeInTheDocument();
  });

  it('loadError가 있어도 조건을 고칠 필터 바는 남는다', () => {
    renderPane({ items: [], loadError: <AlertBanner variant="error" title="실패" /> });

    expect(screen.getByLabelText('창고 검색')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '조회' })).toBeInTheDocument();
  });

  /* 화면 정돈(omf-all-around#17). */
  it('머리글은 창고 코드·창고명이고, 사용 여부는 칩으로 보인다', () => {
    renderPane();

    expect(screen.getByRole('columnheader', { name: '창고 코드' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '창고명' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '명칭' })).not.toBeInTheDocument();
    expect(screen.getAllByText('사용 중').length).toBeGreaterThan(0);
  });

  it('걸린 조건이 없으면 조건 칩 줄을 그리지 않는다', () => {
    renderPane();

    expect(screen.queryByRole('button', { name: /조건 제거/u })).not.toBeInTheDocument();
    expect(document.querySelectorAll('.filter-bar')).toHaveLength(1);
  });
});

/* 창고를 공장으로 거른다 — 서버 선행 P-109(omf-mes-server#809). */
describe('WarehouseListPane — 공장', () => {
  it('공장 열은 행의 plantId 를 공장 이름으로 푼다 — 머리는 「사업부」가 아니라 「공장」이다', () => {
    renderPane();

    expect(screen.getByRole('columnheader', { name: '공장' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: '사업부' })).not.toBeInTheDocument();

    const rowOf = (code: string) => screen.getByRole('button', { name: code }).closest('tr')!;
    expect(within(rowOf('WH-01')).getByText('1공장')).toBeInTheDocument();
    expect(within(rowOf('WH-03')).getByText('2공장')).toBeInTheDocument();
  });

  it('공장 목록에 없는 plantId 는 이름 대신 미확인으로 보인다', () => {
    renderPane({ items: [{ ...warehouseFixtures[0]!, plantId: 99 }] });

    const row = screen.getByRole('button', { name: 'WH-01' }).closest('tr')!;
    expect(within(row).queryByText('1공장')).not.toBeInTheDocument();
    expect(within(row).getByText('알 수 없음')).toBeInTheDocument();
  });

  it('공장은 고르는 즉시 적용한다 — [조회] 없이 plantId 로 onApplyFilters 를 부른다', async () => {
    const user = userEvent.setup();
    const { onApplyFilters } = renderPane();

    await user.click(screen.getByRole('combobox', { name: '공장' }));
    await user.click(screen.getByRole('option', { name: '2공장' }));

    expect(onApplyFilters).toHaveBeenCalledWith({ ...defaultWarehouseFilters, plantId: '12' });
  });

  it('적용된 공장은 이름으로 칩에 보이고, 칩을 지우면 공장 조건만 되돌린다', async () => {
    const user = userEvent.setup();
    const applied: WarehouseFilters = { ...defaultWarehouseFilters, q: 'WH', plantId: '12' };
    const { onApplyFilters } = renderPane({ appliedFilters: applied });

    expect(screen.getByText('공장: 2공장')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '공장 조건 제거' }));

    expect(onApplyFilters).toHaveBeenCalledWith({ ...applied, plantId: '' });
  });

  it('공장만 걸려 있어도 0건이면 「조건에 맞는 결과가 없습니다」와 초기화를 낸다', () => {
    renderPane({ items: [], appliedFilters: { ...defaultWarehouseFilters, plantId: '12' } });

    expect(screen.getByText('조건에 맞는 결과가 없습니다')).toBeInTheDocument();
    expect(screen.queryByText('아직 등록된 창고가 없습니다')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '창고 추가' })).not.toBeInTheDocument();
    /* 필터 줄의 초기화와 빈 상태의 초기화 둘이다. */
    expect(screen.getAllByRole('button', { name: '초기화' })).toHaveLength(2);
  });
});
