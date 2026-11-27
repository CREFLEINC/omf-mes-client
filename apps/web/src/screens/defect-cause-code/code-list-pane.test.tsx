import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { defectCodeAdapter } from './adapters';
import { CodeListPane, type CodeListPaneProps } from './code-list-pane';
import { hierarchyFixtures } from './fixtures';
import { indexById, orderForGrouping } from './hierarchy';
import type { CodeFilters, HierarchyCode } from './types';

const NO_FILTERS: CodeFilters = {
  q: '',
  includeInactive: false,
  inactiveOnly: false,
  dispositionTypeCode: '',
  processId: '',
  page: 1,
  size: 20,
};

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
    processLabelOf: (processId) => (processId === 7001 ? 'P-10 · 조립' : null),
    pageMeta: { page: 1, size: 20, total: orderedRows.length },
    onChangePage: vi.fn(),
    onChangePageSize: vi.fn(),
    loadError: null,
    referenceCountOf: () => null,
    onEdit: vi.fn(),
    onToggleActive: vi.fn(),
    onAddChild: vi.fn(),
    ...overrides,
  };

  render(<CodeListPane {...props} />);

  return { props, user: userEvent.setup() };
};

/** 대분류 줄이 묶음 머리다(#209) — 그 코드 글자가 머리 칸(접기 단추 옆)에 있는가. */
const isHeadRow = (code: string): boolean =>
  screen.getByText(code).closest('.defect-cause-tree-head') !== null;

describe('CodeListPane — 2계층 표시', () => {
  it('대분류 줄이 묶음 머리가 되고 하위 코드 수를 함께 낸다(#209)', () => {
    renderPane();

    expect(isHeadRow('DF-10')).toBe(true);
    expect(isHeadRow('DF-20')).toBe(true);
    expect(isHeadRow('DF-90')).toBe(true);
    expect(isHeadRow('DF-11')).toBe(false);
    expect(screen.getAllByText(/하위 코드 \d+건/).length).toBeGreaterThanOrEqual(3);
  });

  it('상세 줄은 선으로 대분류에 잇고, 묶음의 마지막 줄에서 선을 끝낸다', () => {
    renderPane();

    const child = screen.getByText('DF-12').closest('.defect-cause-tree-child');
    expect(child).not.toBeNull();
    expect(child).toHaveAttribute('data-last', 'true');
    expect(screen.getByText('DF-11').closest('.defect-cause-tree-child')).not.toHaveAttribute(
      'data-last',
    );
  });

  it('접기 단추를 누르면 그 대분류의 상세 줄을 숨기고, 다시 누르면 보인다', async () => {
    const { user } = renderPane();

    const [fold] = screen.getAllByRole('button', { name: '하위 코드 접기' });
    await user.click(fold!);
    expect(screen.queryByText('DF-11')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '하위 코드 펼치기' }));
    expect(screen.getByText('DF-11')).toBeInTheDocument();
  });

  it('상위를 찾을 수 없는 코드는 별도 그룹으로 나온다 — 사라지지 않는다', () => {
    renderPane();

    expect(screen.getByText('상위를 찾을 수 없는 코드')).toBeInTheDocument();
    expect(screen.getByText('DF-91')).toBeInTheDocument();
  });

  it('자기참조 행도 대분류로 나오고 그 아래에 상세가 붙는다', () => {
    renderPane();

    expect(screen.getByText('DF-20')).toBeInTheDocument();
    expect(screen.getByText('DF-21')).toBeInTheDocument();
  });

  it('받은 순서대로 행을 그린다 — 대분류 자신이 자기 그룹의 첫 행이다', () => {
    renderPane();

    const codes = [...document.querySelectorAll('.defect-cause-open')].map(
      (element) => element.textContent,
    );

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

  it('코드와 줄은 누르는 자리가 아니다 — 단추로 그리지 않는다(#360)', () => {
    renderPane();

    expect(screen.queryByRole('button', { name: 'DF-11' })).not.toBeInTheDocument();
    expect(document.querySelector('[aria-current]')).toBeNull();
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
    // 대분류 추가는 조회 카드 단추 하나만 둔다 — 빈 안내에 같은 단추를 겹쳐 두지 않는다(omf-all-around#228).
    expect(screen.queryByRole('button', { name: '대분류 추가' })).not.toBeInTheDocument();
  });

  it('조건이 걸린 0건이면 조건을 고치라는 빈 상태를 낸다', async () => {
    const { props, user } = renderPane({
      rows: [],
      appliedFilters: {
        q: 'ZZ',
        includeInactive: false,
        inactiveOnly: false,
        dispositionTypeCode: '',
        processId: '',
        page: 1,
        size: 20,
      },
    });

    expect(screen.getByText('조건에 맞는 결과가 없습니다')).toBeInTheDocument();
    // 빈 안내는 표 밖에 선다(#209) — 좁은 화면에서 넓은 표 가운데에 서서 잘리지 않게. 목록 구획 안의 것을 고른다.
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await user.click(
      within(screen.getByRole('region', { name: '불량코드 목록' })).getByRole('button', {
        name: '초기화',
      }),
    );

    expect(props.onApplyFilters).toHaveBeenCalledWith({
      q: '',
      includeInactive: false,
      inactiveOnly: false,
      dispositionTypeCode: '',
      processId: '',
      page: 1,
      size: 20,
    });
  });
});

describe('CodeListPane — 표에 싣는 값 (#209)', () => {
  const rich: HierarchyCode[] = [
    {
      id: 6001,
      code: 'DF-50',
      name: '외관',
      parentId: null,
      isActive: true,
      nameKo: '외관 한글',
      nameVi: 'Ngoại quan',
      processId: 7001,
      dispositionTypeCode: 'REWORKABLE',
    },
  ];

  it('불량코드 표는 한국어명 · 베트남어명 · 처분 유형 · 공정을 함께 낸다', () => {
    renderPane({ rows: rich, byId: indexById(rich) });

    for (const header of ['한국어명', '베트남어명', '처분 유형', '공정']) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    }
    expect(screen.getByText('외관 한글')).toBeInTheDocument();
    expect(screen.getByText('Ngoại quan')).toBeInTheDocument();
    expect(screen.getByText('재작업 가능')).toBeInTheDocument();
    expect(screen.getByText('P-10 · 조립')).toBeInTheDocument();
  });
});

describe('CodeListPane — 표 머리 문구 (#209)', () => {
  it('불량코드 표는 불량코드 · 불량명 · 구분 · 사용 여부로 적는다', () => {
    renderPane();

    for (const header of ['불량코드', '불량명', '구분', '사용 유무']) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    }
  });
});

describe('CodeListPane — 조회 조건', () => {
  it('조회 조건과 대분류 추가 단추는 목록 칸에 두지 않는다 — 위 조회 카드에 선다(#209)', () => {
    renderPane();

    expect(screen.queryByRole('button', { name: '조회' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '대분류 추가' })).not.toBeInTheDocument();
  });
});

/* 상세 카드에 있던 사용된 기록 · 사용 중지/재사용 · 수정을 목록 줄로 옮겼다(#360). */
describe('CodeListPane — 행 끝 동작 · 사용된 기록 (#360)', () => {
  const rowOf = (code: string): HTMLElement => {
    const row = screen.getByText(code).closest('tr');
    if (row === null) throw new Error(`${code} 줄이 없습니다.`);
    return row;
  };

  it('사용된 기록을 건수로, 받지 못한 줄은 「—」로 낸다', () => {
    renderPane({ referenceCountOf: (id) => (id === 1002 ? 3 : null) });

    expect(within(rowOf('DF-11')).getByText('3건')).toBeInTheDocument();
    expect(within(rowOf('DF-12')).queryByText(/건$/)).not.toBeInTheDocument();
  });

  it('사용 중인 줄의 사용 중지 · 수정은 그 코드로 부른다', async () => {
    const { props, user } = renderPane();

    await user.click(within(rowOf('DF-11')).getByRole('button', { name: '사용 중지' }));
    await user.click(within(rowOf('DF-11')).getByRole('button', { name: '수정' }));

    expect(props.onToggleActive).toHaveBeenCalledWith(1002);
    expect(props.onEdit).toHaveBeenCalledWith(1002);
  });

  it('사용 중인 대분류 줄에만 하위 코드 추가를 내고, 그 대분류로 부른다(상세 카드에서 옮겨 옴)', async () => {
    const { props, user } = renderPane();

    expect(within(rowOf('DF-11')).queryByRole('button', { name: '하위 코드 추가' })).toBeNull();
    // 미사용 대분류에는 내지 않는다(#209).
    expect(within(rowOf('DF-90')).queryByRole('button', { name: '하위 코드 추가' })).toBeNull();
    await user.click(within(rowOf('DF-10')).getByRole('button', { name: '하위 코드 추가' }));

    expect(props.onAddChild).toHaveBeenCalledWith(1001);
  });

  it('사용 중지 · 재사용 · 수정 단추에 아이콘이 붙는다(#360)', () => {
    renderPane();

    for (const [code, name, icon] of [
      ['DF-11', '사용 중지', 'block'],
      ['DF-90', '재사용', 'restart_alt'],
      ['DF-11', '수정', 'edit'],
    ] as const) {
      const button = within(rowOf(code)).getByRole('button', { name });
      // 세 단추의 아이콘은 같은 크기다.
      const glyph = button.querySelector<HTMLElement>('[aria-hidden="true"]');
      expect(glyph).toHaveTextContent(icon);
      expect(glyph).toHaveStyle({ fontSize: '16px' });
    }
  });

  it('미사용 줄은 사용 중지 자리에 재사용을 낸다', async () => {
    const { props, user } = renderPane();

    const inactive = rowOf('DF-90');
    expect(within(inactive).queryByRole('button', { name: '사용 중지' })).not.toBeInTheDocument();
    await user.click(within(inactive).getByRole('button', { name: '재사용' }));

    expect(props.onToggleActive).toHaveBeenCalledWith(1006);
  });
});

describe('CodeListPane — 행이 하나뿐인 목록', () => {
  const single: HierarchyCode[] = [
    { id: 5001, code: 'DF-01', name: '단독', parentId: null, isActive: true },
  ];

  it('그룹이 하나여도 머리글과 행이 함께 나온다', () => {
    renderPane({ rows: single, byId: indexById(single) });

    expect(isHeadRow('DF-01')).toBe(true);
    expect(screen.getByText('하위 코드 0건')).toBeInTheDocument();
  });
});
