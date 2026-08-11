import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CountFilterBar, type CountFilterBarProps } from './count-filter-bar';
import { DEFAULT_FILTERS, type ChipFilterKey, type CountFilters } from './filters';

const t = messages.stocktaking;

const WAREHOUSE_LABEL = 'SAMPLE-WH-01 · 합성 창고 가';

const baseProps = (overrides: Partial<CountFilterBarProps> = {}): CountFilterBarProps => ({
  appliedFilters: DEFAULT_FILTERS,
  warehouseOptions: [{ value: '9101', label: WAREHOUSE_LABEL }],
  /* 지금의 사실 그대로 — 둘 다 비어 있다(`omf-mes#64`). */
  countTypeOptions: [],
  statusOptions: [],
  chipNames: { warehouse: WAREHOUSE_LABEL },
  onSearch: vi.fn<(filters: CountFilters) => void>(),
  onRemoveFilter: vi.fn<(key: ChipFilterKey) => void>(),
  onReset: vi.fn<() => void>(),
  ...overrides,
});

const renderBar = (overrides: Partial<CountFilterBarProps> = {}) => {
  const props = baseProps(overrides);
  const result = render(<CountFilterBar {...props} />);

  return { ...result, ...props, user: userEvent.setup() };
};

describe('CountFilterBar — 조건 줄', () => {
  it('조건 칸이 여섯이다', () => {
    renderBar();

    expect(screen.getByLabelText(t.fields.warehouse)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.plannedDateFrom)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.plannedDateTo)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.countType)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.status)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: t.fields.inProgressOnly })).toBeInTheDocument();
  });

  /*
   * **C14** — 값 목록이 확정되지 않아 실사 유형·상태 선택지가 비어 있다.
   * 비어 있는 선택칸만 두면 고장으로 읽히므로 **왜 비어 있는지**를 `aria-describedby`로 잇는다.
   */
  it('실사 유형·상태 선택지가 비어 있고 각각 안내가 붙는다', () => {
    renderBar();

    const countType = screen.getByLabelText(t.fields.countType);
    const status = screen.getByLabelText(t.fields.status);
    const notes = screen.getAllByText(messages.pendingCode.note);

    expect(notes).toHaveLength(2);
    expect(countType.getAttribute('aria-describedby')).not.toBeNull();
    expect(status.getAttribute('aria-describedby')).not.toBeNull();
    expect(countType.getAttribute('aria-describedby')).not.toBe(
      status.getAttribute('aria-describedby'),
    );
    /* 짝 방향 — 창고 선택지는 실제로 들어 있다(빈 것이 부품 탓이 아님을 밝힌다). */
    expect(screen.getByLabelText(t.fields.warehouse)).toBeInTheDocument();
  });

  /*
   * **「전체」가 값이 빈 선택지로 들어 있다.** 두지 않으면 창고를 한 번 고른 뒤
   * **선택칸 안에서는 해제할 수단이 사라진다**(칩의 ×로는 여전히 풀리므로 막다른 길은 아니다).
   * 자리표시 코드 칸에는 두지 않는다 — 그쪽은 고를 값 자체가 아직 없다.
   */
  it('창고 선택칸의 첫 선택지가 값이 빈 「전체」다', async () => {
    const { user } = renderBar();

    await user.click(screen.getByLabelText(t.fields.warehouse));

    const options = screen.getAllByRole('option');

    expect(options[0]).toHaveTextContent(t.filters.all);
    /* 짝 — 실제 선택지도 함께 있다(「전체」만 있어서 통과하는 것이 아니다). */
    expect(options).toHaveLength(2);
    expect(options[1]).toHaveTextContent(WAREHOUSE_LABEL);
  });

  /** 값 목록이 오면 안내가 걷힌다 — 남으면 고를 수 있는데도 준비 중이라 말하는 거짓말이 된다. */
  it('선택지가 차면 안내가 걷힌다', () => {
    renderBar({
      countTypeOptions: [{ value: 'SAMPLE_COUNT_TYPE_A', label: 'SAMPLE_COUNT_TYPE_A' }],
      statusOptions: [{ value: 'SAMPLE_COUNT_STATUS_A', label: 'SAMPLE_COUNT_STATUS_A' }],
    });

    expect(screen.queryByText(messages.pendingCode.note)).not.toBeInTheDocument();
  });

  /* 기본 기간이 없다는 사실을 밝히지 않으면 비어 있는 칸이 고장으로 읽힌다. */
  it('기간을 비워 두면 전체를 본다는 안내가 있다', () => {
    renderBar();

    expect(screen.getByText(t.filters.periodNote)).toBeInTheDocument();
  });

  /*
   * 트리거 모델은 「모아서 적용」이다. 고치는 동안 조회가 나가면 반쯤 고른 조건으로 요청이
   * 나간다 — 조회를 누를 때만 부모에게 알린다.
   */
  it('고치는 동안에는 조회를 알리지 않고 누를 때 알린다', async () => {
    const { onSearch, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.plannedDateFrom), '2026-08-01');

    expect(onSearch).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, from: '2026-08-01' });
  });

  it('진행 중만을 켜면 조회에 함께 실린다', async () => {
    const { onSearch, user } = renderBar();

    await user.click(screen.getByRole('checkbox', { name: t.fields.inProgressOnly }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onSearch).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, inProgressOnly: true });
  });

  it('초기화를 누르면 부모에게 알린다', async () => {
    const { onReset, user } = renderBar();

    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  /*
   * **M14** — 부모는 렌더할 때마다 주소에서 값을 새로 읽으므로 내용이 같아도 참조가 달라진다
   * (조회 응답이 도착해 다시 그려질 때가 그렇다). 참조로 되돌림을 판정하면 그때마다
   * 사용자가 고르던 값이 사라진다(#43).
   */
  it('같은 값의 새 조건 객체가 와도 고치던 값이 사라지지 않는다', async () => {
    const { rerender, user } = renderBar();

    await user.click(screen.getByRole('checkbox', { name: t.fields.inProgressOnly }));

    rerender(<CountFilterBar {...baseProps({ appliedFilters: { ...DEFAULT_FILTERS } })} />);

    expect(screen.getByRole('checkbox', { name: t.fields.inProgressOnly })).toBeChecked();
  });

  /*
   * 짝 방향 — 주소가 **실제로 바뀌면** 편집 중인 값도 그 값으로 되돌아간다.
   *
   * **여섯 축을 전부 센다.** 되돌림 판정은 조건 객체가 아니라 **값 여섯**에 걸려 있는데
   * (그것이 이 부품의 #43 방어다), 한 축만 검사하면 나머지 다섯이 의존성에서 빠져도 드러나지
   * 않는다. 이 저장소에는 ESLint 설정이 없어 `react-hooks/exhaustive-deps`도 그 배열을
   * 지켜 주지 않는다 — 도구가 없으면 단언이 그 자리를 대신해야 한다.
   *
   * 무너지면 이렇게 된다 — 「진행 중만」을 켜고 조회한 뒤 **뒤로가기**를 누르면 주소에서
   * `prog`가 빠지고 목록도 전체로 다시 조회되는데 **확인칸만 켜진 채 남는다.**
   * 「주소가 정본이다」라는 이 화면의 전제가 화면 위에서 깨져 보인다.
   *
   * **되돌림을 재는 자리(계획일 시작)와 바꾸는 축을 따로 둔다** — 같으면 「되돌아간 것」과
   * 「새 값이 그대로 온 것」이 구분되지 않는다. `from` 축만은 그 둘이 겹치므로 새 적용값으로
   * 되돌아왔는지를 본다.
   */
  const REVERT_AXES: { axis: string; applied: Partial<CountFilters> }[] = [
    { axis: 'warehouse', applied: { warehouse: '9101' } },
    { axis: 'from', applied: { from: '2026-08-31' } },
    { axis: 'to', applied: { to: '2026-08-31' } },
    { axis: 'countType', applied: { countType: 'SAMPLE_COUNT_TYPE_A' } },
    { axis: 'status', applied: { status: 'SAMPLE_COUNT_STATUS_A' } },
    { axis: 'inProgressOnly', applied: { inProgressOnly: true } },
  ];

  it.each(REVERT_AXES)('적용된 $axis가 달라지면 고치던 값이 되돌아간다', async ({ applied }) => {
    const { rerender, user } = renderBar();

    await user.type(screen.getByLabelText(t.fields.plannedDateFrom), '2026-08-01');

    expect(screen.getByLabelText(t.fields.plannedDateFrom)).toHaveValue('2026-08-01');

    const nextApplied = { ...DEFAULT_FILTERS, ...applied };

    rerender(<CountFilterBar {...baseProps({ appliedFilters: nextApplied })} />);

    expect(screen.getByLabelText(t.fields.plannedDateFrom)).toHaveValue(nextApplied.from);
  });
});

describe('CountFilterBar — 조건 칩', () => {
  it('적용된 조건마다 칩이 보이고 ×가 그 조건만 푼다', async () => {
    const { onRemoveFilter, user } = renderBar({
      appliedFilters: { ...DEFAULT_FILTERS, warehouse: '9101', inProgressOnly: true },
    });

    expect(screen.getByText(t.filters.chipWarehouse(WAREHOUSE_LABEL))).toBeInTheDocument();
    /*
     * 확인칸 라벨과 칩 문구가 같은 글자다 — 조건이 걸리면 그 글자가 **둘**이 된다.
     * 칩을 가리키는 유일한 이름은 제거 버튼이므로 그것으로 판정한다.
     */
    expect(screen.getAllByText(t.filters.chipInProgress)).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: t.filters.chipRemoveInProgress }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.filters.chipRemoveWarehouse }));

    expect(onRemoveFilter).toHaveBeenCalledWith('warehouse');
  });

  /* **#44** — 칩에도 번호를 내지 않는다. 화면이 이름으로 풀어 넘긴다. */
  it('칩에 내부 번호를 내지 않는다', () => {
    const { container } = renderBar({
      appliedFilters: { ...DEFAULT_FILTERS, warehouse: '9101' },
    });

    expect(screen.getByText(t.filters.chipWarehouse(WAREHOUSE_LABEL))).toBeInTheDocument();
    expect(container.textContent ?? '').not.toContain('9101');
  });

  it('조건이 없으면 칩 줄이 없다', () => {
    renderBar();

    expect(
      screen.queryByRole('button', { name: t.filters.chipRemoveInProgress }),
    ).not.toBeInTheDocument();
    /* 짝 방향 — 확인칸 라벨은 그대로 있다(칩만 없다는 뜻임을 밝힌다). */
    expect(screen.getAllByText(t.filters.chipInProgress)).toHaveLength(1);
  });
});
