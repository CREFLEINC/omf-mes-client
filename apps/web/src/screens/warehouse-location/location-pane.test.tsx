import { AlertBanner } from '@crefle/web-ui';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { locationFixtures } from './fixtures';
import { LocationPane } from './location-pane';
import { buildLocationRows } from './location-tree';

const expandedIds = new Set([2001, 2002]);
const rows = buildLocationRows(locationFixtures, expandedIds);

const renderPane = (overrides: Partial<Parameters<typeof LocationPane>[0]> = {}) => {
  const onToggleExpand = vi.fn();
  const onSelectionChange = vi.fn();
  const onFilterTextChange = vi.fn();
  const onAddRoot = vi.fn();
  const onAddChild = vi.fn();
  const onEdit = vi.fn();

  render(
    <LocationPane
      rows={rows}
      isLoading={false}
      expandedIds={expandedIds}
      onToggleExpand={onToggleExpand}
      selectedIds={[]}
      onSelectionChange={onSelectionChange}
      filterText=""
      onFilterTextChange={onFilterTextChange}
      canAddRoot
      addRootDisabledReason="Location을 추가할 수 없습니다."
      onAddRoot={onAddRoot}
      canAddChild={false}
      onAddChild={onAddChild}
      onEdit={onEdit}
      actionBanner={null}
      loadError={null}
      {...overrides}
    />,
  );

  return {
    onToggleExpand,
    onSelectionChange,
    onFilterTextChange,
    onAddRoot,
    onAddChild,
    onEdit,
  };
};

describe('LocationPane', () => {
  it('계층을 들여쓰기 depth와 함께 렌더한다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: 'A-01' }).closest('.tree-toggle')).toHaveAttribute(
      'data-depth',
      '0',
    );
    expect(screen.getByRole('button', { name: 'A-01-01' }).closest('.tree-toggle')).toHaveAttribute(
      'data-depth',
      '1',
    );
    expect(
      screen.getByRole('button', { name: 'A-01-01-01' }).closest('.tree-toggle'),
    ).toHaveAttribute('data-depth', '2');
    expect(screen.getByRole('button', { name: 'B-01' }).closest('.tree-toggle')).toHaveAttribute(
      'data-depth',
      '0',
    );
  });

  it('단계는 서버 값을 이름으로, 비어 오면 줄표로 보인다', () => {
    const [zone, rack] = locationFixtures;
    if (zone === undefined || rack === undefined) throw new Error('fixture');
    const leveled = [
      { ...zone, locationLevelCode: 'ZONE' as const },
      { ...rack, locationLevelCode: null },
    ];
    renderPane({ rows: buildLocationRows(leveled, expandedIds) });

    expect(screen.getByRole('cell', { name: '구역' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '—' })).toBeInTheDocument();
  });

  it('접기·펴기 버튼에 상태에 맞는 접근성 이름이 있다', () => {
    renderPane();

    // A-01과 A-01-01은 하위가 있고 둘 다 펼쳐져 있다. B-01·A-01-01-01은 하위가 없어 토글이 없다.
    expect(screen.getAllByRole('button', { name: '하위 접기' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: '하위 펼치기' })).not.toBeInTheDocument();
  });

  it('접힌 노드의 토글은 펼치기 이름을 낸다', () => {
    const collapsedRows = buildLocationRows(locationFixtures, new Set());
    renderPane({ rows: collapsedRows, expandedIds: new Set() });

    expect(screen.getAllByRole('button', { name: '하위 펼치기' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: '하위 접기' })).not.toBeInTheDocument();
  });

  it('접기 버튼을 누르면 해당 locationId로 onToggleExpand를 부른다', async () => {
    const user = userEvent.setup();
    const collapsedRows = buildLocationRows(locationFixtures, new Set());
    const { onToggleExpand } = renderPane({ rows: collapsedRows, expandedIds: new Set() });

    await user.click(screen.getByRole('button', { name: '하위 펼치기' }));

    expect(onToggleExpand).toHaveBeenCalledWith(2001);
  });

  it('코드 셀을 누르면 그 Location으로 onEdit을 부른다', async () => {
    const user = userEvent.setup();
    const { onEdit } = renderPane();

    await user.click(screen.getByRole('button', { name: 'A-01-01' }));

    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ locationId: 2002 }));
  });

  // 하위 추가는 사유 문구 없이 비활성만 둔다(사용자 지시 2026-09-18 · omf-all-around#17).
  it('선택이 없으면 하위 추가가 비활성이고 사유 문구는 없다', () => {
    renderPane({ selectedIds: [] });

    const button = screen.getByRole('button', { name: '랙 추가' });

    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute('aria-describedby');
  });

  it('선택이 2건 이상이면 하위 추가가 비활성이다', () => {
    renderPane({ selectedIds: ['2001', '2004'] });

    expect(screen.getByRole('button', { name: '랙 추가' })).toBeDisabled();
  });

  it('선택이 정확히 1건이면 하위 추가를 눌러 onAddChild를 부른다', async () => {
    const user = userEvent.setup();
    const { onAddChild } = renderPane({ selectedIds: ['2001'], canAddChild: true });

    const addChild = screen.getByRole('button', { name: '랙 추가' });
    expect(addChild).not.toBeDisabled();

    await user.click(addChild);
    expect(onAddChild).toHaveBeenCalledTimes(1);
  });

  it('라벨 이미지 생성 단추와 선택 안내가 없다 — 라벨은 위치를 눌러 연 창에서 본다', () => {
    renderPane();

    expect(screen.queryByRole('button', { name: '라벨 이미지 생성' })).not.toBeInTheDocument();
    expect(screen.queryByText('Location을 하나 이상 선택해 주세요.')).not.toBeInTheDocument();
  });

  it('구역 추가를 누르면 onAddRoot를 부른다', async () => {
    const user = userEvent.setup();
    const { onAddRoot } = renderPane();

    await user.click(screen.getByRole('button', { name: '구역 추가' }));

    expect(onAddRoot).toHaveBeenCalledTimes(1);
  });

  it('검색 입력은 서버 조회를 갱신하도록 상위에 전달한다', async () => {
    const user = userEvent.setup();
    const { onFilterTextChange } = renderPane();

    await user.type(screen.getByLabelText('Location 검색'), 'B-01');

    expect(onFilterTextChange).toHaveBeenCalled();
  });

  it('로딩 중에는 표 대신 스켈레톤을 낸다', () => {
    renderPane({ isLoading: true, rows: [] });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Location을 불러오는 중' })).toBeInTheDocument();
  });

  it('등록된 것이 없을 때와 조건에 안 맞을 때의 빈 상태 문구가 다르다', () => {
    renderPane({ rows: [] });
    expect(screen.getByText('등록된 Location이 없습니다')).toBeInTheDocument();

    renderPane({ rows: [], filterText: '없는코드' });
    expect(screen.getByText('조건에 맞는 Location이 없습니다')).toBeInTheDocument();
  });

  it('loadError가 있으면 표와 빈 상태 대신 그것을 낸다', () => {
    renderPane({
      rows: [],
      loadError: <AlertBanner variant="error" title="목록을 불러오지 못했습니다" />,
    });

    expect(screen.getByText('목록을 불러오지 못했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('등록된 Location이 없습니다')).not.toBeInTheDocument();
  });

  it('loadError가 있어도 추가 액션 줄은 남는다', () => {
    renderPane({ rows: [], loadError: <AlertBanner variant="error" title="실패" /> });

    expect(screen.getByRole('button', { name: '구역 추가' })).toBeInTheDocument();
  });

  /* Location 탭 정돈(omf-all-around#17 4차) — 문구·배치만, 활성 조건은 그대로. */
  it('등록할 수 있으면 빈 상태가 구역 추가를 안내한다', () => {
    renderPane({ rows: [] });

    expect(screen.getByText('구역을 추가해 주세요.')).toBeInTheDocument();
  });

  it('구역 추가가 막혀 있으면 빈 상태가 추가를 권하지 않고 사유를 보인다', () => {
    const reason = 'Location 계층을 불러온 뒤 추가할 수 있습니다.';
    renderPane({ rows: [], canAddRoot: false, addRootDisabledReason: reason });

    expect(screen.queryByText('구역을 추가해 주세요.')).not.toBeInTheDocument();
    expect(screen.getAllByText(reason).length).toBeGreaterThan(0);
  });
});
