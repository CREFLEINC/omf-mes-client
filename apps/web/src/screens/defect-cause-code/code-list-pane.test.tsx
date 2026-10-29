import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { defectCodeAdapter } from './adapters';
import { CodeListPane, type CodeListPaneProps } from './code-list-pane';
import { hierarchyFixtures } from './fixtures';
import { indexById, orderForGrouping } from './hierarchy';
import type { CodeFilters, HierarchyCode } from './types';

const NO_FILTERS: CodeFilters = { q: '', includeInactive: false };

const byId = indexById(hierarchyFixtures);
const orderedRows = orderForGrouping(hierarchyFixtures, byId);

const renderPane = (overrides: Partial<CodeListPaneProps> = {}) => {
  const props: CodeListPaneProps = {
    adapter: defectCodeAdapter,
    rows: orderedRows,
    byId,
    isLoading: false,
    appliedFilters: NO_FILTERS,
    onApplyFilters: vi.fn(),
    selectedId: null,
    onSelect: vi.fn(),
    onAddCategory: vi.fn(),
    loadError: null,
    ...overrides,
  };

  render(<CodeListPane {...props} />);

  return { props, user: userEvent.setup() };
};

describe('CodeListPane — 2계층 표시', () => {
  /*
   * 그룹 머리글은 <th scope="rowgroup">로 렌더돼 역할 조회가 불안정하다.
   * 텍스트로 찾는다(디자인 시스템 구현 실측).
   */
  it('대분류마다 그룹 머리글이 하나씩 나온다', () => {
    renderPane();

    expect(screen.getByText('DF-10 · 외관')).toBeInTheDocument();
    expect(screen.getByText('DF-20 · 치수')).toBeInTheDocument();
    expect(screen.getByText('DF-90 · 사용하지 않는 축')).toBeInTheDocument();
  });

  it('상위를 찾을 수 없는 코드는 별도 그룹으로 나온다 — 사라지지 않는다', () => {
    renderPane();

    expect(screen.getByText('상위를 찾을 수 없는 코드')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'DF-91' })).toBeInTheDocument();
  });

  it('자기참조 행도 대분류로 나오고 그 아래에 상세가 붙는다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: 'DF-20' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'DF-21' })).toBeInTheDocument();
  });

  it('받은 순서대로 행을 그린다 — 대분류 자신이 자기 그룹의 첫 행이다', () => {
    renderPane();

    const codes = screen
      .getAllByRole('button')
      .map((element) => element.textContent)
      .filter((text) => text !== null && text.startsWith('DF-'));

    expect(codes).toEqual(['DF-10', 'DF-11', 'DF-12', 'DF-20', 'DF-21', 'DF-90', 'DF-91']);
  });

  it('사용 여부를 값으로 낸다', () => {
    renderPane();

    expect(screen.getByText('미사용')).toBeInTheDocument();
    // 머리칸 「사용」은 빼고 센다.
    expect(screen.getAllByText('사용').filter((node) => node.closest('th') === null)).toHaveLength(
      6,
    );
  });

  it('코드를 누르면 그 코드가 선택된다', async () => {
    const { props, user } = renderPane();

    await user.click(screen.getByRole('button', { name: 'DF-11' }));

    expect(props.onSelect).toHaveBeenCalledWith(1002);
  });
});

describe('CodeListPane — 상태별 표시', () => {
  it('조회 실패에서는 표도 빈 상태도 내지 않는다', () => {
    renderPane({ rows: [], loadError: <p>조회 실패 안내</p> });

    expect(screen.getByText('조회 실패 안내')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('아직 등록된 코드가 없습니다')).not.toBeInTheDocument();
  });

  it('불러오는 동안에는 스켈레톤을 낸다', () => {
    renderPane({ rows: [], isLoading: true });

    expect(screen.getByRole('status', { name: '코드 목록을 불러오는 중' })).toBeInTheDocument();
  });

  it('조건 없이 0건이면 첫 등록을 이끄는 빈 상태를 낸다', () => {
    renderPane({ rows: [] });

    expect(screen.getByText('아직 등록된 코드가 없습니다')).toBeInTheDocument();
    expect(screen.getByText('「대분류 추가」로 첫 대분류를 등록하세요.')).toBeInTheDocument();
  });

  it('조건이 걸린 0건이면 조건을 고치라는 빈 상태를 낸다', async () => {
    const { props, user } = renderPane({
      rows: [],
      appliedFilters: { q: 'ZZ', includeInactive: false },
    });

    expect(screen.getByText('조건에 맞는 결과가 없습니다')).toBeInTheDocument();
    // 필터 바에도 같은 이름의 버튼이 있다 — 빈 상태 안의 것을 고른다.
    await user.click(within(screen.getByRole('table')).getByRole('button', { name: '초기화' }));

    expect(props.onApplyFilters).toHaveBeenCalledWith({ q: '', includeInactive: false });
  });
});

describe('CodeListPane — 선택', () => {
  it('고른 코드에 현재 선택 표식이 붙는다', () => {
    renderPane({ selectedId: 1002 });

    expect(screen.getByRole('button', { name: 'DF-11' })).toHaveAttribute('aria-current', 'true');
  });

  it('조회 조건과 등록 단추는 목록 칸에 두지 않는다 — 위 조회 카드에 선다(#209)', () => {
    renderPane();

    expect(screen.queryByRole('button', { name: '조회' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '상세 추가' })).not.toBeInTheDocument();
  });
});

describe('CodeListPane — 행이 하나뿐인 목록', () => {
  const single: HierarchyCode[] = [
    { id: 5001, code: 'DF-01', name: '단독', parentId: null, isActive: true },
  ];

  it('그룹이 하나여도 머리글과 행이 함께 나온다', () => {
    renderPane({ rows: single, byId: indexById(single) });

    expect(screen.getByText('DF-01 · 단독')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'DF-01' })).toBeInTheDocument();
  });
});
