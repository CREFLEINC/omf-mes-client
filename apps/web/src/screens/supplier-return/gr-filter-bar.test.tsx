import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { pickRange } from '../../test/date-picker';
import { DEFAULT_FILTERS, type ReceiptFilters } from './filters';
import { GrFilterBar, type GrFilterBarProps } from './gr-filter-bar';

const t = messages.supplierReturn;

const WAREHOUSE_LABEL = 'SAMPLE-WH-01 · 합성 창고 가';

const baseProps = (overrides: Partial<GrFilterBarProps> = {}): GrFilterBarProps => ({
  appliedFilters: DEFAULT_FILTERS,
  warehouseOptions: [{ value: '9701', label: WAREHOUSE_LABEL }],
  receiptTypeOptions: [],
  statusOptions: [],
  chipNames: { warehouse: WAREHOUSE_LABEL },
  onSearch: vi.fn(),
  onRemoveFilter: vi.fn(),
  onReset: vi.fn(),
  ...overrides,
});

const renderBar = (overrides: Partial<GrFilterBarProps> = {}) => {
  const props = baseProps(overrides);
  const result = render(<GrFilterBar {...props} />);

  return { ...props, ...result, user: userEvent.setup() };
};

const periodTrigger = (): HTMLElement => screen.getByLabelText(t.fields.period);

describe('GrFilterBar — 모아서 적용', () => {
  it('적용된 조건이 컨트롤에 서 있다', () => {
    renderBar({ appliedFilters: { ...DEFAULT_FILTERS, q: 'GR-2026' } });

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('GR-2026');
  });

  /* 조건을 고치는 동안 조회가 나가면 반쯤 지운 검색어로 요청이 나간다. */
  it('입력만으로는 조회하지 않는다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.q), 'GR');

    expect(onSearch).not.toHaveBeenCalled();
  });

  it('조회를 누르면 지금 고친 조건이 통째로 나간다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.q), 'GR-2026');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, q: 'GR-2026' });
  });

  /**
   * **기간은 한 컨트롤이다**(`mode="range"`). 시작·종료 두 칸으로 나누지 않는다 —
   * 값 비우기가 없는 날짜 컨트롤에서 두 칸을 두면 한쪽만 남은 기간을 풀 길이 사라진다.
   */
  it('기간을 한 컨트롤에서 고르고 조회에 함께 싣는다', async () => {
    const { onSearch, user } = renderBar();

    await pickRange(user, periodTrigger(), '2026-08-01', '2026-08-05');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith({
      ...DEFAULT_FILTERS,
      from: '2026-08-01',
      to: '2026-08-05',
    });
  });

  it('기간 칸이 하나뿐이다', () => {
    renderBar();

    expect(screen.getAllByLabelText(t.fields.period)).toHaveLength(1);
  });
});

describe('GrFilterBar — 초기화', () => {
  /**
   * **M04** — 날짜 컨트롤에 값 비우기가 없어(설치본 실측) 기간을 푸는 길이 「초기화」뿐이다.
   * 이 부품이 **자기 편집 상태까지 함께 비우지 않으면**, 아직 조회하지 않은 기간은 주소가
   * 바뀌지 않아 되돌림 effect도 깨어나지 않고 값이 그대로 남는다.
   */
  it('초기화가 아직 조회하지 않은 기간까지 비운다', async () => {
    const { onReset, user } = renderBar();

    await pickRange(user, periodTrigger(), '2026-08-01', '2026-08-05');

    /* 짝 방향 — 실제로 값이 들어갔다(아무것도 고르지 않아서 통과한 것이 아니다). */
    expect(periodTrigger().textContent).toContain('2026-08-01');

    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    expect(periodTrigger().textContent).not.toContain('2026-08-01');
    expect(periodTrigger().textContent).not.toContain('2026-08-05');
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('초기화가 다른 조건도 함께 비운다', async () => {
    const { user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.q), 'GR-2026');
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('');
  });
});

describe('GrFilterBar — 되돌림', () => {
  /**
   * **되돌림을 참조가 아니라 값으로 판정한다**(#43). 부모는 렌더할 때마다 주소에서 값을 새로
   * 읽으므로 내용이 같아도 참조가 달라질 수 있고(조회 응답이 도착해 다시 그려질 때가 그렇다),
   * 참조로 판정하면 그때마다 사용자가 치던 값이 사라진다.
   */
  it('같은 조건으로 다시 그려도 치던 값이 남는다', async () => {
    const props = baseProps();
    const { rerender } = render(<GrFilterBar {...props} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(t.fields.q), 'GR-2026');

    rerender(<GrFilterBar {...props} appliedFilters={{ ...DEFAULT_FILTERS }} />);

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('GR-2026');
  });

  it('주소가 실제로 바뀌면 그 값으로 되돌아간다', async () => {
    const props = baseProps();
    const { rerender } = render(<GrFilterBar {...props} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(t.fields.q), 'GR-2026');

    rerender(<GrFilterBar {...props} appliedFilters={{ ...DEFAULT_FILTERS, q: 'GR-2027' }} />);

    expect(screen.getByLabelText(t.fields.q)).toHaveValue('GR-2027');
  });
});

describe('GrFilterBar — 값 목록이 확정되지 않은 코드', () => {
  /**
   * 값 목록이 확정되지 않아 **선택지가 비어 있다.** 자리표시 값을 하나 넣어 두지 않는다 —
   * 넣으면 서버가 모르는 코드가 조건에 실려 결과가 늘 비어 보인다.
   */
  it.each([
    [t.fields.receiptType],
    [t.fields.status],
  ])('%s 선택지가 비어 있고 왜 비었는지 밝힌다', (label) => {
    renderBar();

    const field = screen.getByLabelText(label);

    expect(field).toHaveTextContent(messages.pendingCode.placeholder);
    expect(screen.getAllByText(messages.pendingCode.note).length).toBeGreaterThan(0);
  });

  /**
   * 고를 것이 하나도 없는데 「전체」만 있으면 **목록이 준비된 것처럼 보인다.**
   * 왜 비었는지는 안내가 말한다.
   */
  it('비어 있는 코드 칸에는 「전체」도 붙지 않는다', () => {
    renderBar();

    expect(screen.getByLabelText(t.fields.receiptType)).not.toHaveTextContent(t.filters.all);
    expect(screen.getByLabelText(t.fields.status)).not.toHaveTextContent(t.filters.all);
    /* 짝 방향 — 선택지가 있는 칸에는 「전체」가 있다. */
    expect(screen.getByLabelText(t.fields.warehouse)).toHaveTextContent(t.filters.all);
  });

  /* **차면 거둔다** — 남으면 화면이 거짓말을 한다. */
  it('선택지가 차면 안내를 거둔다', () => {
    renderBar({
      receiptTypeOptions: [{ value: 'SAMPLE_TY_A', label: 'SAMPLE_TY_A' }],
      statusOptions: [{ value: 'SAMPLE_ST_A', label: 'SAMPLE_ST_A' }],
    });

    expect(screen.queryByText(messages.pendingCode.note)).not.toBeInTheDocument();
  });
});

describe('GrFilterBar — 조건 칩', () => {
  const applied: ReceiptFilters = {
    warehouse: '9701',
    from: '2026-08-01',
    to: '2026-08-05',
    receiptType: 'SAMPLE_TY_A',
    status: 'SAMPLE_ST_A',
    q: 'GR-2026',
  };

  it('걸린 조건을 이름으로 보인다', () => {
    renderBar({ appliedFilters: applied });

    expect(screen.getByText(t.filters.chipWarehouse(WAREHOUSE_LABEL))).toBeInTheDocument();
    expect(
      screen.getByText(t.filters.chipPeriodBoth('2026-08-01', '2026-08-05')),
    ).toBeInTheDocument();
  });

  /** **번호를 문구로 만드는 자리가 없다**(#44) — 화면이 이름으로 풀어 넘긴다. */
  it('칩에 내부 번호가 없다', () => {
    renderBar({ appliedFilters: applied });

    expect(screen.getByText(t.filters.chipWarehouse(WAREHOUSE_LABEL)).textContent).not.toContain(
      '9701',
    );
  });

  it('×가 그 조건 하나만 푼다', async () => {
    const { onRemoveFilter, user } = renderBar({ appliedFilters: applied });

    await user.click(screen.getByRole('button', { name: t.filters.chipRemoveWarehouse }));

    expect(onRemoveFilter).toHaveBeenCalledWith('warehouse');
  });

  /**
   * **기간 칩에는 ×가 없다**(계획 §13-5 안 A) — 날짜 컨트롤이 값을 개별로 비우는 수단을
   * 주지 않아 눌러도 값이 남는다. 그 사실을 안내가 밝힌다.
   */
  /**
   * **이름이 아니라 개수로 잰다.** 「입고일 조건 해제」라는 이름의 ×가 없는지만 보면
   * **다른 이름을 단 ×를 놓친다** — 막으려는 것은 특정 문구가 아니라 눌러도 값이 남는
   * 버튼이 기간 칩에 생기는 일이다.
   */
  it('기간 칩에만 해제 버튼이 없고 그 사실을 밝힌다', () => {
    renderBar({ appliedFilters: applied });

    const chipRow = screen
      .getByText(t.filters.chipPeriodBoth('2026-08-01', '2026-08-05'))
      .closest('.filter-bar');

    expect(chipRow).not.toBeNull();
    /* 칩 다섯 중 넷만 ×를 갖는다 — 어떤 이름이든 하나가 더 붙으면 이 수가 어긋난다. */
    expect(within(chipRow as HTMLElement).getAllByRole('button')).toHaveLength(4);
    expect(screen.getByText(t.filters.periodClearNote)).toBeInTheDocument();
  });

  it('걸린 기간이 없으면 그 안내도 없다', () => {
    renderBar();

    expect(screen.queryByText(t.filters.periodClearNote)).not.toBeInTheDocument();
  });
});

describe('GrFilterBar — 선택지의 한계', () => {
  it('창고 목록의 한계를 밝힌다', () => {
    renderBar({ warehouseNote: t.filters.lookupTruncated });

    expect(screen.getByText(t.filters.lookupTruncated)).toBeInTheDocument();
  });

  /* 기본 기간이 없다는 사실은 화면에서 읽혀야 한다 — 빈 칸이 고장으로 읽히지 않게 한다. */
  it('기본 기간이 없다는 사실을 밝힌다', () => {
    renderBar();

    expect(screen.getByText(t.filters.periodNote)).toBeInTheDocument();
  });
});
