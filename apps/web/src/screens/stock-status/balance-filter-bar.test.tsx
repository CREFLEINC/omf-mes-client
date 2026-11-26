import { createApiClient } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ApiClientProvider } from '../../patterns/api-context';

import { BalanceFilterBar, type BalanceFilterBarProps } from './balance-filter-bar';
import { EMPTY_FILTERS, type BalanceFilters } from './filters';

const t = messages.stockStatus;

const WAREHOUSES = [
  { value: '9101', label: 'SAMPLE-WH-01 · 합성 자재창고 가' },
  { value: '9102', label: 'SAMPLE-WH-02 · 합성 자재창고 나' },
];
const LOTS = [{ value: '9401', label: 'SAMPLE-LOT-0001' }];
const LOCATIONS = [{ value: '9201', label: 'SAMPLE-LOC-01 · 합성 위치 가' }];

const filters = (overrides: Partial<BalanceFilters> = {}): BalanceFilters => ({
  ...EMPTY_FILTERS,
  ...overrides,
});

const baseProps = (overrides: Partial<BalanceFilterBarProps> = {}): BalanceFilterBarProps => ({
  appliedFilters: EMPTY_FILTERS,
  warehouseOptions: WAREHOUSES,
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
  const queryClient = new QueryClient();
  const apiClient = createApiClient({ baseUrl: 'http://test.invalid' });
  /* 품목 칸(`ItemSelect`)이 조회 프로바이더를 쓴다 — 다시 그려도 남게 wrapper 로 감싼다. */
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider client={apiClient}>{children}</ApiClientProvider>
    </QueryClientProvider>
  );
  const view = render(<BalanceFilterBar {...props} />, { wrapper });

  return { ...props, ...view, user: userEvent.setup() };
};

/** 「조건 더보기」를 편다 — 접힌 칸을 쓰는 시험은 먼저 편다. */
const openMore = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await user.click(screen.getByRole('button', { name: messages.common.filterMore.open }));
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

/* omf-all-around#270 — 위치 선택지는 고르는 중인 창고로 채운다. 조회 전에도 위치를 고를 수 있어야 한다. */
describe('BalanceFilterBar — 고르는 중인 창고가 위치 선택지를 정한다', () => {
  it('창고를 고르면 조회 전에 상위에 알린다', async () => {
    const onWarehouseChange = vi.fn();
    const { onSearch, user } = renderBar({ onWarehouseChange });

    await user.click(screen.getByLabelText(t.fields.warehouse));
    await user.click(screen.getByRole('option', { name: WAREHOUSES[0]?.label ?? '' }));

    expect(onWarehouseChange).toHaveBeenCalledWith('9101');
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('창고를 고른 뒤 조회 전에 위치를 고를 수 있다', async () => {
    const { onSearch, user } = renderBar();

    await user.click(screen.getByLabelText(t.fields.warehouse));
    await user.click(screen.getByRole('option', { name: WAREHOUSES[0]?.label ?? '' }));
    await openMore(user);
    await user.click(screen.getByLabelText(t.fields.location));
    await user.click(screen.getByRole('option', { name: LOCATIONS[0]?.label ?? '' }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({ warehouse: '9101', location: '9201' }),
    );
  });

  it('창고를 바꾸면 고른 위치를 비운다', async () => {
    const { onSearch, user } = renderBar({
      appliedFilters: filters({ warehouse: '9101', location: '9201' }),
    });
    await openMore(user);

    await user.click(screen.getByLabelText(t.fields.warehouse));
    await user.click(screen.getByRole('option', { name: WAREHOUSES[1]?.label ?? '' }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({ warehouse: '9102', location: '' }),
    );
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

    await openMore(user);
    await user.click(screen.getByLabelText(t.fields.includeZero));

    rerender(<BalanceFilterBar {...baseProps({ appliedFilters: { ...EMPTY_FILTERS } })} />);

    expect(screen.getByLabelText(t.fields.includeZero)).toBeChecked();
  });
});

/*
 * C-6 — 보이는 칸은 창고 · 품목 둘이다(C-19 보통 폭 셋과 단추 셋은 1280 에서 한 줄에 들지 않는다). 나머지는 「조건 더보기」에
 * 접혀 있다.
 */
describe('BalanceFilterBar — 조건 더보기', () => {
  it('입하 LOT 번호 · 위치 · LOT · 코드 셋 · 잔액 0 포함은 접혀 있고, 펼치면 보인다', async () => {
    const { user } = renderBar();

    expect(screen.getByRole('button', { name: messages.common.filterMore.open })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('checkbox', { name: t.fields.includeZero })).toBeNull();
    expect(screen.queryByRole('searchbox', { name: t.fields.inboundLotNo })).toBeNull();
    expect(screen.getByLabelText(t.fields.warehouse)).toBeVisible();
    expect(screen.getByLabelText(t.fields.item)).toBeVisible();

    await openMore(user);

    expect(screen.getByRole('searchbox', { name: t.fields.inboundLotNo })).toBeVisible();
    for (const label of [
      t.fields.location,
      t.fields.lot,
      t.fields.qualityStatus,
      t.fields.inventoryStatus,
      t.fields.ownership,
      t.fields.includeZero,
    ]) {
      expect(screen.getByLabelText(label)).toBeVisible();
    }
  });
});

describe('BalanceFilterBar — 조건 칩', () => {
  it('접힌 칸에 걸린 조건만 칩이 되고 이름으로 적힌다 — 보이는 칸의 조건은 칩으로 겹쳐 적지 않는다', () => {
    renderBar({
      appliedFilters: filters({
        warehouse: '9101',
        item: '9301',
        location: '9201',
        lot: '9401',
        inboundLotNo: 'IL-20261110-0001',
      }),
    });

    expect(screen.getByText(t.filters.chipInboundLotNo('IL-20261110-0001'))).toBeInTheDocument();

    expect(screen.getByText('위치: 합성 위치 가')).toBeInTheDocument();
    expect(screen.getByText('LOT: SAMPLE-LOT-0001')).toBeInTheDocument();
    expect(screen.queryByText('창고: 합성 자재창고 가')).toBeNull();
    expect(screen.queryByText('품목: 합성 품목 가')).toBeNull();
  });

  /* 이름이 실려 있음을 먼저 확인했으므로, 번호가 없다는 단언이 뜻을 갖는다(#44). */
  it('칩에 내부 번호가 보이지 않는다', () => {
    const { container } = renderBar({
      appliedFilters: filters({ warehouse: '9101', item: '9301', lot: '9401', location: '9201' }),
    });

    expect(screen.getByText('위치: 합성 위치 가')).toBeInTheDocument();

    const text = container.textContent ?? '';

    for (const id of ['9101', '9301', '9401', '9201']) {
      expect(text).not.toContain(`: ${id}`);
    }
  });

  it('칩의 ×를 누르면 그 조건만 상위에 알린다', async () => {
    const { onRemoveFilter, user } = renderBar({
      appliedFilters: filters({ warehouse: '9101', location: '9201', includeZero: true }),
    });

    await user.click(screen.getByRole('button', { name: t.filters.chipRemoveLocation }));

    expect(onRemoveFilter).toHaveBeenCalledWith('location');
  });

  it('펼치면 칸에 값이 보이므로 칩을 거두되, 칸이 없는 입하 LOT 거르기 칩은 남는다', async () => {
    const { user } = renderBar({
      appliedFilters: filters({ includeZero: true, inboundLot: '9901:IL-20261110-0001' }),
    });

    // 칩 글자는 접힌 확인칸의 이름과 같아 × 이름으로 찾는다.
    expect(
      screen.getByRole('button', { name: t.filters.chipRemoveIncludeZero }),
    ).toBeInTheDocument();

    await openMore(user);

    expect(screen.queryByRole('button', { name: t.filters.chipRemoveIncludeZero })).toBeNull();
    expect(screen.getByText(t.filters.chipInboundLot('IL-20261110-0001'))).toBeInTheDocument();
  });

  it('조건이 없으면 칩 줄이 없다', () => {
    renderBar();

    expect(screen.queryByRole('button', { name: t.filters.chipRemoveLocation })).toBeNull();
  });
});

describe('BalanceFilterBar — 초기화', () => {
  /* 창고까지 비운다 — 남기면 「초기화했는데 조회가 열려 있다」가 되어 상태가 어중간해진다. */
  it('초기화를 누르면 상위에 알린다', async () => {
    const { onReset, user } = renderBar({ appliedFilters: filters({ warehouse: '9101' }) });

    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  /* C-6 — 처음 조건 그대로면 「초기화」가 할 일이 없다. 고르는 중인 값이 처음과 달라지면 그때 보인다. */
  it('처음 조건에서는 초기화가 없고, 칸을 고치면 나타난다', async () => {
    const { user } = renderBar();

    expect(screen.queryByRole('button', { name: messages.common.reset })).toBeNull();

    await user.click(screen.getByLabelText(t.fields.warehouse));
    await user.click(screen.getByRole('option', { name: WAREHOUSES[0]?.label ?? '' }));

    expect(screen.getByRole('button', { name: messages.common.reset })).toBeInTheDocument();
  });
});

describe('BalanceFilterBar — 선택지의 한계 안내', () => {
  it('선택지가 잘리면 그 칸 아래에 밝힌다', () => {
    renderBar({ warehouseNote: t.filters.lookupTruncated });

    expect(screen.getByText(t.filters.lookupTruncated)).toBeInTheDocument();
  });

  /*
   * **잠그지 않는다.** 주소로 걸린 조건을 해제할 방법이 사라지기 때문이다 —
   * 선택지가 비어도 「전체」는 늘 있어 되돌릴 수 있다.
   */
  it('선택지가 비어도 칸을 잠그지 않는다', async () => {
    const { user } = renderBar({ locationOptions: [] });

    await openMore(user);

    expect(screen.getByLabelText(t.fields.location)).toBeEnabled();
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

  /* C-19 — 조회 줄에 보이는 창고 · 품목은 정한 보통 폭이다. 고른 값에 따라 칸 폭이 바뀌지 않는다. */
  it('조회 줄의 창고 · 품목은 C-19 보통 폭을 쓴다', () => {
    renderBar();

    for (const label of [t.fields.warehouse, t.fields.item]) {
      const cell = cellOf(label);

      expect(cell).toHaveClass('filter-field-md');
      expect(cell).not.toHaveClass('wide-select');
      expect(cell?.style.minWidth).toBe('');
    }
  });

  it('「조건 더보기」의 「코드 · 이름」과 긴 식별자를 고르는 둘은 넓은 갈래를 쓴다', () => {
    renderBar();

    for (const label of [t.fields.location, t.fields.lot]) {
      const cell = cellOf(label);

      expect(cell).toHaveClass('wide-select');
      /* 18.5rem 하한은 걷었다 — 조회 줄 선택칸은 전 화면 같은 폭(176px · 사용자 지시 2026-11-24). */
      expect(cell?.style.minWidth).toBe('');
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
