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
      onAddRoot={onAddRoot}
      onAddChild={onAddChild}
      onEdit={onEdit}
      {...overrides}
    />,
  );

  return { onToggleExpand, onSelectionChange, onFilterTextChange, onAddRoot, onAddChild, onEdit };
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

  it('선택이 없으면 하위 추가가 비활성이고 사유가 보인다', () => {
    renderPane({ selectedIds: [] });

    const reason = '하위 추가는 Location을 하나만 선택했을 때 쓸 수 있습니다.';
    const button = screen.getByRole('button', { name: '하위 추가' });

    expect(button).toBeDisabled();
    expect(screen.getByText(reason)).toBeInTheDocument();
    // 화면에 보이는 것과 그 버튼의 설명인 것은 별개 조건이다. 배치를 바꿔도 연결이 끊기면 안 된다.
    expect(button).toHaveAccessibleDescription(reason);
  });

  it('선택이 2건 이상이면 하위 추가가 비활성이다', () => {
    renderPane({ selectedIds: ['2001', '2004'] });

    expect(screen.getByRole('button', { name: '하위 추가' })).toBeDisabled();
  });

  it('선택이 정확히 1건이면 하위 추가를 눌러 onAddChild를 부른다', async () => {
    const user = userEvent.setup();
    const { onAddChild } = renderPane({ selectedIds: ['2001'] });

    const addChild = screen.getByRole('button', { name: '하위 추가' });
    expect(addChild).not.toBeDisabled();

    await user.click(addChild);
    expect(onAddChild).toHaveBeenCalledTimes(1);
  });

  it('라벨 이미지 생성은 항상 비활성이고 사유가 화면 텍스트로 보인다', () => {
    renderPane();

    const reason = '라벨 이미지는 아직 만들 수 없습니다. 생성 기능이 준비되면 이 버튼을 쓸 수 있습니다.';
    const button = screen.getByRole('button', { name: '라벨 이미지 생성' });

    expect(button).toBeDisabled();
    expect(screen.getByText(reason)).toBeInTheDocument();
    // 화면에 보이는 것과 그 버튼의 설명인 것은 별개 조건이다. 배치를 바꿔도 연결이 끊기면 안 된다.
    expect(button).toHaveAccessibleDescription(reason);
  });

  it('최상위 추가를 누르면 onAddRoot를 부른다', async () => {
    const user = userEvent.setup();
    const { onAddRoot } = renderPane();

    await user.click(screen.getByRole('button', { name: '최상위 추가' }));

    expect(onAddRoot).toHaveBeenCalledTimes(1);
  });

  it('검색어로 이미 받아 둔 목록을 클라이언트에서 거른다', () => {
    renderPane({ filterText: 'B-01' });

    expect(screen.getByRole('button', { name: 'B-01' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'A-01' })).not.toBeInTheDocument();
  });

  it('로딩 중에는 표 대신 스켈레톤을 낸다', () => {
    renderPane({ isLoading: true, rows: [] });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Location을 불러오는 중' })).toBeInTheDocument();
  });

  it('등록된 것이 없을 때와 조건에 안 맞을 때의 빈 상태 문구가 다르다', () => {
    renderPane({ rows: [] });
    expect(screen.getByText('등록된 Location이 없습니다')).toBeInTheDocument();

    renderPane({ rows, filterText: '없는코드' });
    expect(screen.getByText('조건에 맞는 Location이 없습니다')).toBeInTheDocument();
  });
});
