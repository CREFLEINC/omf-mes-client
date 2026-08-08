import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BalanceFilterBar, type BalanceFilterBarProps } from './balance-filter-bar';
import { EMPTY_FILTERS, type BalanceFilters } from './filters';

const t = messages.stockStatus;

const WAREHOUSES = [
  { value: '9101', label: 'SAMPLE-WH-01 · 합성 자재창고 가' },
  { value: '9102', label: 'SAMPLE-WH-02 · 합성 자재창고 나' },
];
const ITEMS = [{ value: '9301', label: 'SAMPLE-ITEM-01 · 합성 품목 가' }];
const LOTS = [{ value: '9401', label: 'SAMPLE-LOT-0001' }];
const LOCATIONS = [{ value: '9201', label: 'SAMPLE-LOC-01 · 합성 위치 가' }];

const filters = (overrides: Partial<BalanceFilters> = {}): BalanceFilters => ({
  ...EMPTY_FILTERS,
  ...overrides,
});

const baseProps = (overrides: Partial<BalanceFilterBarProps> = {}): BalanceFilterBarProps => ({
  appliedFilters: EMPTY_FILTERS,
  warehouseOptions: WAREHOUSES,
  itemOptions: ITEMS,
  lotOptions: LOTS,
  locationOptions: LOCATIONS,
  qualityStatusOptions: [],
  inventoryStatusOptions: [],
  ownershipOptions: [],
  chipNames: {
    warehouse: '합성 자재창고 가',
    item: '합성 품목 가',
    lot: 'SAMPLE-LOT-0001',
    location: '합성 위치 가',
  },
  referencesFailed: false,
  onSearch: vi.fn(),
  onRemoveFilter: vi.fn(),
  onReset: vi.fn(),
  onRetryReferences: vi.fn(),
  ...overrides,
});

const renderBar = (overrides: Partial<BalanceFilterBarProps> = {}) => {
  const props = baseProps(overrides);
  const view = render(<BalanceFilterBar {...props} />);

  return { ...props, ...view, user: userEvent.setup() };
};

describe('BalanceFilterBar — 창고가 조회를 연다', () => {
  /*
   * **창고 필수는 이 화면의 규칙이지 계약의 규칙이 아니다.** 그래도 화면에서는 필수이므로
   * 고르기 전에는 조회를 잠그고 **사유를 컨트롤과 이어** 밝힌다 — 비활성 컨트롤은 포커스를
   * 받지 못해 툴팁만으로는 키보드·보조기술 사용자가 닿을 수 없다.
   */
  it('창고를 고르기 전에는 조회가 잠기고 사유가 이어진다', () => {
    renderBar();

    const search = screen.getByRole('button', { name: messages.common.search });

    expect(search).toBeDisabled();

    const reasonId = search.getAttribute('aria-describedby');

    expect(reasonId).not.toBeNull();
    expect(document.getElementById(reasonId ?? '')).toHaveTextContent(t.reasons.warehouseRequired);
  });

  it('창고를 고르면 조회가 열린다', async () => {
    const { user } = renderBar();

    await user.click(screen.getByLabelText(t.fields.warehouse));
    await user.click(screen.getByRole('option', { name: WAREHOUSES[0]?.label ?? '' }));

    expect(screen.getByRole('button', { name: messages.common.search })).toBeEnabled();
  });

  it('창고를 고르고 조회하면 그 조건을 상위에 넘긴다', async () => {
    const { onSearch, user } = renderBar();

    await user.click(screen.getByLabelText(t.fields.warehouse));
    await user.click(screen.getByRole('option', { name: WAREHOUSES[0]?.label ?? '' }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ warehouse: '9101' }));
  });

  /* 잠긴 버튼을 눌러도 조회가 나가면 잠근 뜻이 없다. */
  it('잠긴 상태에서는 조회를 넘기지 않는다', async () => {
    const { onSearch, user } = renderBar();

    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).not.toHaveBeenCalled();
  });
});

describe('BalanceFilterBar — 조건 초안의 수명', () => {
  /*
   * **#43이 되살아나는 자리다.** 부모는 렌더할 때마다 주소에서 조건을 새로 읽으므로
   * 내용이 같아도 참조가 달라질 수 있고(조회 응답이 도착해 다시 그려질 때가 그렇다),
   * 되돌림을 참조로 판정하면 그때마다 사용자가 고르던 값이 사라진다.
   */
  it('같은 값의 새 객체가 다시 내려와도 고르던 값이 남는다', async () => {
    const { rerender, user } = renderBar();

    await user.click(screen.getByLabelText(t.fields.warehouse));
    await user.click(screen.getByRole('option', { name: WAREHOUSES[0]?.label ?? '' }));

    // 조회 응답이 도착해 부모가 다시 그린다 — 내용은 같고 참조만 새 객체다.
    rerender(<BalanceFilterBar {...baseProps({ appliedFilters: { ...EMPTY_FILTERS } })} />);

    expect(screen.getByLabelText(t.fields.warehouse)).toHaveTextContent(WAREHOUSES[0]?.label ?? '');
  });

  /* 짝이 되는 방향 — 값이 실제로 달라지면(뒤로가기·초기화) 조건 줄도 그 값으로 되돌아간다. */
  it('값이 실제로 바뀌면 조건 줄이 따라간다', async () => {
    const { rerender, user } = renderBar();

    await user.click(screen.getByLabelText(t.fields.warehouse));
    await user.click(screen.getByRole('option', { name: WAREHOUSES[0]?.label ?? '' }));

    rerender(
      <BalanceFilterBar {...baseProps({ appliedFilters: filters({ warehouse: '9102' }) })} />,
    );

    expect(screen.getByLabelText(t.fields.warehouse)).toHaveTextContent(WAREHOUSES[1]?.label ?? '');
  });

  /* 잔액 0 포함도 같은 규칙을 따른다 — 참·거짓이라 되돌림 의존성에서 빠뜨리기 쉽다. */
  it('잔액 0 포함도 같은 값의 새 객체에 지워지지 않는다', async () => {
    const { rerender, user } = renderBar();

    await user.click(screen.getByLabelText(t.fields.includeZero));

    rerender(<BalanceFilterBar {...baseProps({ appliedFilters: { ...EMPTY_FILTERS } })} />);

    expect(screen.getByLabelText(t.fields.includeZero)).toBeChecked();
  });
});

describe('BalanceFilterBar — 조건 칩', () => {
  it('걸린 조건마다 칩이 보이고 이름으로 적힌다', () => {
    renderBar({ appliedFilters: filters({ warehouse: '9101', item: '9301' }) });

    expect(screen.getByText('창고: 합성 자재창고 가')).toBeInTheDocument();
    expect(screen.getByText('품목: 합성 품목 가')).toBeInTheDocument();
  });

  /* 이름이 실려 있음을 먼저 확인했으므로, 번호가 없다는 단언이 뜻을 갖는다(#44). */
  it('칩에 내부 번호가 보이지 않는다', () => {
    const { container } = renderBar({
      appliedFilters: filters({ warehouse: '9101', item: '9301', lot: '9401', location: '9201' }),
    });

    expect(screen.getByText('창고: 합성 자재창고 가')).toBeInTheDocument();

    const text = container.textContent ?? '';

    for (const id of ['9101', '9301', '9401', '9201']) {
      expect(text).not.toContain(`: ${id}`);
    }
  });

  it('칩의 ×를 누르면 그 조건만 상위에 알린다', async () => {
    const { onRemoveFilter, user } = renderBar({
      appliedFilters: filters({ warehouse: '9101', item: '9301' }),
    });

    await user.click(screen.getByRole('button', { name: t.filters.chipRemoveItem }));

    expect(onRemoveFilter).toHaveBeenCalledWith('item');
  });

  it('조건이 없으면 칩 줄이 없다', () => {
    renderBar();

    expect(screen.queryByRole('button', { name: t.filters.chipRemoveWarehouse })).toBeNull();
  });
});

describe('BalanceFilterBar — 초기화', () => {
  /* 창고까지 비운다 — 남기면 「초기화했는데 조회가 열려 있다」가 되어 상태가 어중간해진다. */
  it('초기화를 누르면 상위에 알린다', async () => {
    const { onReset, user } = renderBar({ appliedFilters: filters({ warehouse: '9101' }) });

    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

describe('BalanceFilterBar — 선택지의 한계 안내', () => {
  it('선택지가 잘리면 그 칸 아래에 밝힌다', () => {
    renderBar({ warehouseNote: t.filters.lookupTruncated });

    expect(screen.getByText(t.filters.lookupTruncated)).toBeInTheDocument();
  });

  /* 매달린 조건이 채워지지 않아 선택지가 빈 것을 「없다」로 읽지 않게 한다. */
  it('매달린 조건이 없으면 왜 비었는지 밝힌다', () => {
    renderBar({
      locationNote: t.filters.locationNeedsWarehouse,
      lotNote: t.filters.lotNeedsItem,
    });

    expect(screen.getByText(t.filters.locationNeedsWarehouse)).toBeInTheDocument();
    expect(screen.getByText(t.filters.lotNeedsItem)).toBeInTheDocument();
  });

  /*
   * **잠그지 않는다.** 주소로 걸린 조건을 해제할 방법이 사라지기 때문이다 —
   * 선택지가 비어도 「전체」는 늘 있어 되돌릴 수 있다.
   */
  it('선택지가 비어도 칸을 잠그지 않는다', () => {
    renderBar({ locationOptions: [] });

    expect(screen.getByLabelText(t.fields.location)).toBeEnabled();
  });

  it('코드 선택지가 임시 목록임을 밝힌다', () => {
    renderBar();

    expect(screen.getAllByText(t.filters.codeNote)).toHaveLength(3);
  });
});

describe('BalanceFilterBar — 선택칸 최소 폭 (규범 3-2)', () => {
  /**
   * 디자인 시스템 `Select`의 선택지 목록은 뿌리 폭에 못 박혀 있고 넘치는 가로를 **잘라 버린다.**
   * 브라우저 확인 F-B1에서 창고 선택지 「WH-01 · 1공장 자재창고」가 13px 부족해 말줄임됐다.
   *
   * 폭 자체는 CSS라 단위 테스트가 픽셀을 재지 못한다 — 대신 **어느 갈래를 골랐는지**를 값으로
   * 고정한다. 갈래가 잘못 붙으면(되돌림) 이 단언이 먼저 걸린다.
   */
  const cellOf = (label: string): HTMLElement | null =>
    screen.getByLabelText(label).closest('.field-cell');

  it('「코드 · 이름」과 긴 식별자를 고르는 넷은 넓은 갈래를 쓴다', () => {
    renderBar();

    for (const label of [t.fields.warehouse, t.fields.location, t.fields.item, t.fields.lot]) {
      const cell = cellOf(label);

      expect(cell).toHaveClass('wide-select');
      expect(cell).toHaveStyle({ minWidth: '18.5rem' });
    }
  });

  /*
   * **짝이 되는 방향** — 코드값만 고르는 칸에는 넓은 갈래를 붙이지 않는다.
   * 규범 3-2의 이탈 조건 1(「값이 짧은 선택칸에는 붙이지 않는다 — 줄이 쓸데없이 일찍 넘어간다」).
   */
  it('코드값만 고르는 셋은 규범 3-2의 기본 폭을 쓴다', () => {
    renderBar();

    for (const label of [t.fields.qualityStatus, t.fields.inventoryStatus, t.fields.ownership]) {
      const cell = cellOf(label);

      expect(cell).toHaveClass('wide-select');
      expect(cell?.style.minWidth).toBe('');
    }
  });
});

describe('BalanceFilterBar — 참조 실패 복구', () => {
  /*
   * **문구가 적은 대상과 「다시 시도」가 다시 부르는 대상이 같아야 한다.**
   * 이 구획이 이름을 내는 참조는 창고·위치·품목·LOT 넷이다.
   */
  it('조건 줄의 참조가 실패하면 사유와 다시 시도를 낸다', async () => {
    const { onRetryReferences, user } = renderBar({ referencesFailed: true });

    expect(screen.getByText(t.reasons.filterReferencesFailed)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(onRetryReferences).toHaveBeenCalledTimes(1);
  });

  it('실패가 없으면 사유도 복구 버튼도 없다', () => {
    renderBar();

    expect(screen.queryByText(t.reasons.filterReferencesFailed)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });
});
