import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { causeCodeAdapter, defectCodeAdapter } from './adapters';
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
    onAddChild: vi.fn(),
    canAddChild: false,
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
    expect(screen.getAllByText('사용 중').length).toBe(6);
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

describe('CodeListPane — 조회 조건', () => {
  it('검색어를 넣고 조회를 누르면 조건이 적용된다', async () => {
    const { props, user } = renderPane();

    await user.type(screen.getByLabelText('불량코드 검색'), 'DF-1');
    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(props.onApplyFilters).toHaveBeenCalledWith({ q: 'DF-1', includeInactive: false });
  });

  it('미사용 포함은 해제 축이라 바꾸는 즉시 적용된다', async () => {
    const { props, user } = renderPane();

    await user.click(screen.getByRole('checkbox', { name: '미사용 포함' }));

    expect(props.onApplyFilters).toHaveBeenCalledWith({ q: '', includeInactive: true });
  });

  it('적용된 조건은 칩으로 보이고 칩을 지우면 그 조건만 풀린다', async () => {
    const { props, user } = renderPane({
      appliedFilters: { q: 'DF-1', includeInactive: true },
    });

    expect(screen.getByText('검색어: DF-1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '검색어 조건 제거' }));

    expect(props.onApplyFilters).toHaveBeenCalledWith({ q: '', includeInactive: true });
  });

  it('탭마다 검색 라벨이 다르다', () => {
    renderPane({ adapter: causeCodeAdapter });

    expect(screen.getByLabelText('원인코드 검색')).toBeInTheDocument();
  });
});

describe('CodeListPane — 등록 액션', () => {
  it('대분류 추가는 언제나 쓸 수 있다', async () => {
    const { props, user } = renderPane();

    await user.click(screen.getByRole('button', { name: '대분류 추가' }));

    expect(props.onAddCategory).toHaveBeenCalled();
  });

  it('상세 추가는 대분류를 고르기 전에는 비활성이고 사유가 보인다', () => {
    renderPane({ canAddChild: false });

    const addChild = screen.getByRole('button', { name: '상세 추가' });
    expect(addChild).toBeDisabled();
    expect(
      screen.getByText('상세 추가는 대분류를 하나 고른 뒤에 쓸 수 있습니다.'),
    ).toBeInTheDocument();
    expect(addChild).toHaveAttribute('aria-describedby');
  });

  it('대분류를 고르면 상세 추가를 쓸 수 있다', async () => {
    const { props, user } = renderPane({ canAddChild: true, selectedId: 1001 });

    expect(
      screen.queryByText('상세 추가는 대분류를 하나 고른 뒤에 쓸 수 있습니다.'),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '상세 추가' }));

    expect(props.onAddChild).toHaveBeenCalled();
  });

  it('고른 코드에 현재 선택 표식이 붙는다', () => {
    renderPane({ selectedId: 1002 });

    expect(screen.getByRole('button', { name: 'DF-11' })).toHaveAttribute('aria-current', 'true');
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
