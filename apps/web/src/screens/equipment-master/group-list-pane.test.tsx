import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { LookupSource } from '../../patterns/lookup-display';
import { defaultGroupFilters } from './code-options';
import { groupItems, makeGroup, plantItems } from './fixtures';
import { GroupListPane } from './group-list-pane';
import { buildGroupRows } from './group-tree';
import type { GroupFilters, LookupEntry } from './types';

const t = messages.equipmentMaster;

const plantEntries: LookupEntry[] = plantItems.map((plant) => ({
  value: String(plant.plantId),
  label: plant.plantName,
  isActive: plant.isActive,
}));
const plants: LookupSource<LookupEntry> = {
  entries: plantEntries,
  isError: false,
  isLoading: false,
};

const ALL_EXPANDED: ReadonlySet<number> = new Set([101]);

const renderPane = (overrides: Partial<Parameters<typeof GroupListPane>[0]> = {}) => {
  const onApplyFilters = vi.fn();
  const onToggleExpand = vi.fn();
  const onSelect = vi.fn();
  const onAddGroup = vi.fn();

  render(
    <GroupListPane
      rows={buildGroupRows(groupItems, ALL_EXPANDED)}
      isLoading={false}
      appliedFilters={defaultGroupFilters}
      onApplyFilters={onApplyFilters}
      plantOptions={plantEntries
        .filter((entry) => entry.isActive)
        .map((entry) => ({ value: entry.value, label: entry.label }))}
      plants={plants}
      expandedIds={ALL_EXPANDED}
      onToggleExpand={onToggleExpand}
      selectedGroupId={null}
      onSelect={onSelect}
      onAddGroup={onAddGroup}
      loadError={null}
      {...overrides}
    />,
  );

  return { onApplyFilters, onToggleExpand, onSelect, onAddGroup };
};

describe('GroupListPane', () => {
  it('설비 그룹을 계층 순서로 렌더한다', () => {
    renderPane();

    const codeCells = screen
      .getAllByRole('button')
      .filter((node) => node.className === 'link-cell')
      .map((node) => node.textContent);

    expect(codeCells).toEqual(['GRP-A', 'GRP-A-01', 'GRP-A-02', 'GRP-B']);
  });

  /* 들여쓰기가 계층의 유일한 표시다. 깊이가 그려지지 않으면 상하 관계가 화면에서 사라진다. */
  it('하위 그룹은 깊이만큼 들여쓴다', () => {
    renderPane();

    const child = screen.getByRole('button', { name: 'GRP-A-01' }).closest('.tree-toggle');
    const root = screen.getByRole('button', { name: 'GRP-A' }).closest('.tree-toggle');

    expect(root).toHaveAttribute('data-depth', '0');
    expect(child).toHaveAttribute('data-depth', '1');
    expect(root).toHaveStyle({ paddingLeft: '0px' });
    expect(child).toHaveStyle({ paddingLeft: '20px' });
  });

  it('하위가 있는 그룹에만 접기 버튼이 붙는다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: t.groupTable.collapse })).toBeInTheDocument();
    // 하위가 없는 GRP-B 줄에는 누를 것을 두지 않는다.
    const leafRow = screen.getByRole('button', { name: 'GRP-B' }).closest('.tree-toggle');
    expect(leafRow).not.toBeNull();
    expect(
      within(leafRow as HTMLElement).queryByRole('button', { name: t.groupTable.expand }),
    ).toBeNull();
  });

  it('접기 버튼을 누르면 그 그룹 식별자로 onToggleExpand를 부른다', async () => {
    const user = userEvent.setup();
    const { onToggleExpand } = renderPane();

    await user.click(screen.getByRole('button', { name: t.groupTable.collapse }));

    expect(onToggleExpand).toHaveBeenCalledWith(101);
  });

  it('접힌 그룹의 버튼 이름은 「펼치기」다', () => {
    renderPane({ expandedIds: new Set(), rows: buildGroupRows(groupItems, new Set()) });

    expect(screen.getByRole('button', { name: t.groupTable.expand })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.groupTable.collapse })).toBeNull();
  });

  it('코드 셀을 누르면 해당 그룹 식별자로 onSelect를 부른다', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderPane();

    await user.click(screen.getByRole('button', { name: 'GRP-A-01' }));

    expect(onSelect).toHaveBeenCalledWith(111);
  });

  it('선택된 그룹의 코드 셀에 aria-current가 붙는다', () => {
    renderPane({ selectedGroupId: 111 });

    expect(screen.getByRole('button', { name: 'GRP-A-01' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('button', { name: 'GRP-A' })).not.toHaveAttribute('aria-current');
  });

  /*
   * 그룹유형은 스펙 §4-A 의 필드이고 목록이 그것을 훑는 자리다.
   * 계약이 두 값으로 닫혔으므로(코드 사전 2026-09-03) 아는 값은 표시명으로 보인다.
   */
  it('그룹유형 열에 계약 값의 표시명을 보인다', () => {
    renderPane({
      rows: buildGroupRows([makeGroup(301, 'GRP-T', { groupTypeCode: 'WORK_AREA' })], new Set()),
    });

    expect(screen.getByRole('columnheader', { name: t.fields.groupType })).toBeInTheDocument();
    expect(screen.getByText(t.groupTypes.WORK_AREA)).toBeInTheDocument();
  });

  /* 공장 이름은 좁힌 선택지가 아니라 전체 목록에서 푼다 — 좁힘 밖의 정상 자료가 「알 수 없음」이 되면 안 된다. */
  it('공장 이름을 푼다', () => {
    renderPane();

    expect(screen.getAllByText('제1공장')).not.toHaveLength(0);
    expect(screen.getByText('제2공장')).toBeInTheDocument();
  });

  it('로딩 중에는 표 대신 스켈레톤을 낸다', () => {
    renderPane({ isLoading: true, rows: [] });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: t.loading.groups })).toBeInTheDocument();
  });

  /* 실패를 「등록된 것이 없습니다」로 보이면 사실과 다른 안내가 된다. */
  it('조회 실패 표시가 있으면 표도 빈 상태도 내지 않는다', () => {
    renderPane({ rows: [], loadError: <p>조회에 실패했습니다</p> });

    expect(screen.getByText('조회에 실패했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.groupNoneTitle)).toBeNull();
  });

  it('결과가 없어도 필터 바는 감추지 않는다', () => {
    renderPane({ rows: [] });

    expect(screen.getByLabelText(t.filters.searchLabel)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.common.search })).toBeInTheDocument();
  });

  it('기본 조건에서 결과 0건이면 「아직 등록된 것이 없다」와 등록 액션을 낸다', async () => {
    const user = userEvent.setup();
    const { onAddGroup } = renderPane({ rows: [] });

    expect(screen.getByText(t.empty.groupNoneTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.groupNoMatchTitle)).toBeNull();

    await user.click(screen.getByRole('button', { name: t.actions.addGroup }));

    expect(onAddGroup).toHaveBeenCalledTimes(1);
  });

  /*
   * 두 빈 상태를 같은 문구로 그리면, 조건 때문에 안 보이는 것을 「등록된 것이 없다」로 읽는다.
   * 조건을 적용한 쪽에만 되돌릴 수단을 둔다.
   */
  it('조건을 적용한 결과 0건은 다른 문구를 내고 초기화로 되돌릴 수 있다', async () => {
    const user = userEvent.setup();
    const applied: GroupFilters = { ...defaultGroupFilters, q: 'ZZZ' };
    const { onApplyFilters } = renderPane({ rows: [], appliedFilters: applied });

    expect(screen.getByText(t.empty.groupNoMatchTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.groupNoneTitle)).toBeNull();

    // 빈 상태 안의 초기화와 필터 바의 초기화가 둘 다 선다 — 빈 상태 쪽을 누른다.
    const emptyReset = screen.getAllByRole('button', { name: messages.common.reset });
    expect(emptyReset).toHaveLength(2);
    await user.click(emptyReset[1] as HTMLElement);

    expect(onApplyFilters).toHaveBeenCalledWith(defaultGroupFilters);
  });

  /* 편집 중인 값은 draft에만 있어야 한다 — 치는 동안 조건 칩이 따라 움직이면 무엇이 적용됐는지 알 수 없다. */
  it('검색어를 치는 동안에는 조건을 적용하지 않는다', async () => {
    const user = userEvent.setup();
    const { onApplyFilters } = renderPane();

    await user.type(screen.getByLabelText(t.filters.searchLabel), 'GRP');

    expect(onApplyFilters).not.toHaveBeenCalled();
  });

  it('조회를 누르면 편집한 조건을 적용한다', async () => {
    const user = userEvent.setup();
    const { onApplyFilters } = renderPane();

    await user.type(screen.getByLabelText(t.filters.searchLabel), 'GRP');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onApplyFilters).toHaveBeenCalledWith({ ...defaultGroupFilters, q: 'GRP' });
  });

  /* 해제 축이라 모아서 적용하지 않는다 — 「미사용 포함」은 누른 즉시 결과가 넓어져야 한다. */
  it('미사용 포함은 누른 즉시 적용한다', async () => {
    const user = userEvent.setup();
    const { onApplyFilters } = renderPane();

    await user.click(screen.getByRole('checkbox', { name: messages.common.includeInactive }));

    expect(onApplyFilters).toHaveBeenCalledWith({ ...defaultGroupFilters, includeInactive: true });
  });

  it('적용된 조건마다 제거할 수 있는 칩이 선다', async () => {
    const user = userEvent.setup();
    const applied: GroupFilters = { q: 'GRP', plantId: '12', includeInactive: true };
    const { onApplyFilters } = renderPane({ appliedFilters: applied });

    expect(screen.getByText(t.filters.chipKeyword('GRP'))).toBeInTheDocument();
    // 미사용 공장이라 좁힌 선택지에는 없지만 칩의 이름은 전체 목록에서 푼다.
    expect(screen.getByText(t.filters.chipPlant('제2공장'))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.filters.chipRemovePlant }));

    expect(onApplyFilters).toHaveBeenCalledWith({ ...applied, plantId: '' });
  });

  it('초기화는 조건을 기본값으로 되돌린다', async () => {
    const user = userEvent.setup();
    const applied: GroupFilters = { q: 'GRP', plantId: '11', includeInactive: true };
    const { onApplyFilters } = renderPane({ appliedFilters: applied });

    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    expect(onApplyFilters).toHaveBeenCalledWith(defaultGroupFilters);
  });
});
