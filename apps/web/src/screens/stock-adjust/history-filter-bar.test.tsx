import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { HistoryFilterBar, type HistoryFilterBarProps } from './history-filter-bar';
import { DEFAULT_ADJUSTMENT_FILTERS, type AdjustmentFilters } from './history-filters';

const t = messages.stockAdjust;

const COUNT_NAME = 'SAMPLE-IC-A · 2026-08-17';

const filters = (overrides: Partial<AdjustmentFilters> = {}): AdjustmentFilters => ({
  ...DEFAULT_ADJUSTMENT_FILTERS,
  ...overrides,
});

const baseProps = (overrides: Partial<HistoryFilterBarProps> = {}): HistoryFilterBarProps => ({
  appliedFilters: DEFAULT_ADJUSTMENT_FILTERS,
  chipNames: { count: COUNT_NAME },
  countOptions: [{ value: '9101', label: COUNT_NAME }],
  reasonOptions: [],
  statusOptions: [],
  isLocked: false,
  onSearch: vi.fn(),
  onRemoveFilter: vi.fn(),
  onReset: vi.fn(),
  ...overrides,
});

const renderBar = (overrides: Partial<HistoryFilterBarProps> = {}) => {
  const props = baseProps(overrides);
  const result = render(<HistoryFilterBar {...props} />);

  return { ...props, ...result, user: userEvent.setup() };
};

const searchButton = (): HTMLElement =>
  screen.getByRole('button', { name: messages.common.search });

/**
 * 그 칸이 **자기 보조 문구로 걸어 둔 글**. 문서 전체에서 찾으면 옆 칸의 문구가 걸려
 * 「이 칸에는 없다」가 헛통과한다 — `aria-describedby`가 가리키는 자리만 읽는다.
 */
const describedTextOf = (label: string): string => {
  const field = screen.getByLabelText(label);
  const ids = (field.getAttribute('aria-describedby') ?? '').split(' ').filter((id) => id !== '');

  return ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
};

describe('HistoryFilterBar — 조건 칸', () => {
  it('조건 칸이 넷이다 — 전기일·대상 실사·조정 사유·상태', () => {
    renderBar();

    expect(screen.getByLabelText(t.historyFields.period)).toBeInTheDocument();
    expect(screen.getByLabelText(t.historyFields.count)).toBeInTheDocument();
    expect(screen.getByLabelText(t.historyFields.reason)).toBeInTheDocument();
    expect(screen.getByLabelText(t.historyFields.status)).toBeInTheDocument();
  });

  /**
   * ⛔ C41·D-3의 자리. **승인 대기 조건 칸이 없다** — 양성 앵커(네 칸이 실제로 섰다)를 먼저
   * 재고 그 뒤에 「다섯째 칸이 없다」를 잰다.
   */
  it('승인 대기 조건 칸이 없다 — 조건 컨트롤이 넷뿐이다', () => {
    const { container } = renderBar();

    expect(screen.getByLabelText(t.historyFields.period)).toBeInTheDocument();
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
    expect(container.textContent ?? '').not.toContain('승인 대기');
  });

  /** 계약에 검색어 조건이 없다 — 만들면 쳐도 아무것도 좁혀지지 않는 칸이 된다. */
  it('검색칸을 만들지 않는다', () => {
    renderBar();

    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  /**
   * ⭐ **사유와 상태가 갈린다**(#36 회신 ④ · D-9 개정).
   *
   * 상태는 아직 설계가 정할 자리표시라 「목록 준비 중」이 서고, 사유는 **고객의 마스터에서
   * 오는 실제 목록**이라 그 문구가 서지 않는다 — 하나만 남았다는 사실을 개수로 고정한다.
   */
  it('「목록 준비 중」은 상태 칸에만 선다 — 사유 칸에는 없다', () => {
    renderBar();

    /* 양성 앵커 — 상태 칸은 자리표시 그대로다. 이것이 서야 「하나뿐」이 뜻을 갖는다. */
    expect(screen.getAllByText(t.historyFilters.codePending)).toHaveLength(1);
    expect(describedTextOf(t.historyFields.status)).toContain(t.historyFilters.codePending);
    expect(describedTextOf(t.historyFields.reason)).not.toContain(t.historyFilters.codePending);
    expect(screen.getByLabelText(t.historyFields.status)).toBeEnabled();
  });

  /**
   * ⛔ **사유 칸이 잠기지 않는다**(#36 회신 ④). 목록이 0건이어도 칸은 열려 있고 조회도 열려
   * 있다 — 고객이 값을 넣는 순간 곧바로 고를 수 있어야 한다.
   */
  it('사유 선택지가 0건이어도 칸도 조회도 잠기지 않는다', () => {
    renderBar();

    expect(screen.getByLabelText(t.historyFields.reason)).toBeEnabled();
    expect(searchButton()).toBeEnabled();
  });

  /** 사유의 「없음」은 미확정이 아니라 사실이다 — 그때도 「전체」는 고를 수 있는 조건이다. */
  it('사유 선택지가 0건이어도 「전체」는 선다', async () => {
    const { user } = renderBar();

    await user.click(screen.getByLabelText(t.historyFields.reason));

    expect(screen.getByRole('option', { name: t.historyFilters.all })).toBeInTheDocument();
  });

  it('사유 값이 오면 「전체」와 함께 선다', async () => {
    const { user } = renderBar({
      reasonOptions: [{ value: 'SYN-RSN-ALPHA', label: 'SYN-RSN-ALPHA · 합성 사유 가' }],
    });

    await user.click(screen.getByLabelText(t.historyFields.reason));

    expect(screen.getByRole('option', { name: t.historyFilters.all })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'SYN-RSN-ALPHA · 합성 사유 가' }),
    ).toBeInTheDocument();
  });

  /** 사유 칸이 말하는 것은 선택지의 한계 둘뿐이다 — 불러오기 실패와 잘림. */
  it('사유 선택지의 한계는 그 칸에 붙는다', () => {
    renderBar({ reasonNote: t.lookups.failed });

    expect(screen.getByText(t.lookups.failed)).toBeInTheDocument();
  });

  /** 상태 칸은 자리표시 그대로다 — 값이 차면 「전체」가 함께 선다. */
  it('상태 값 목록이 차면 「전체」가 함께 선다', async () => {
    const { user } = renderBar({ statusOptions: [{ value: 'SAMPLE_ST_A', label: 'SAMPLE_ST_A' }] });

    await user.click(screen.getByLabelText(t.historyFields.status));

    expect(screen.getByRole('option', { name: t.historyFilters.all })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'SAMPLE_ST_A' })).toBeInTheDocument();
  });

  it('선택지의 한계를 밝히는 안내를 그 칸에 붙인다', () => {
    renderBar({ countNote: t.lookups.truncated });

    expect(screen.getByText(t.lookups.truncated)).toBeInTheDocument();
  });
});

describe('HistoryFilterBar — 모아서 적용', () => {
  it('고르는 동안에는 조회하지 않고 「조회」를 누를 때 한 번에 넘긴다', async () => {
    const { onSearch, user } = renderBar();

    await user.click(screen.getByLabelText(t.historyFields.count));
    await user.click(screen.getByRole('option', { name: COUNT_NAME }));

    expect(onSearch).not.toHaveBeenCalled();

    await user.click(searchButton());

    expect(onSearch).toHaveBeenCalledWith(filters({ count: '9101' }));
  });

  /**
   * 주소가 정본이다 — 뒤로가기로 주소가 바뀌면 편집 중인 값도 그 값으로 되돌아간다.
   * **참조가 아니라 값으로 판정한다**(`omf-mes#43`) — 같은 값의 새 객체는 되돌리지 않는다.
   */
  it('같은 값의 새 참조가 와도 치던 값을 되돌리지 않는다', async () => {
    const { user, rerender } = renderBar();

    await user.click(screen.getByLabelText(t.historyFields.count));
    await user.click(screen.getByRole('option', { name: COUNT_NAME }));

    rerender(
      <HistoryFilterBar {...baseProps({ appliedFilters: { ...DEFAULT_ADJUSTMENT_FILTERS } })} />,
    );

    expect(screen.getByLabelText(t.historyFields.count)).toHaveTextContent(COUNT_NAME);
  });

  it('주소가 실제로 바뀌면 편집 중인 값이 그 값으로 되돌아간다', async () => {
    const { user, rerender } = renderBar();

    await user.click(screen.getByLabelText(t.historyFields.count));
    await user.click(screen.getByRole('option', { name: COUNT_NAME }));

    rerender(
      <HistoryFilterBar
        {...baseProps({
          appliedFilters: filters({ reason: 'SAMPLE_AR_A' }),
          reasonOptions: [{ value: 'SAMPLE_AR_A', label: 'SAMPLE_AR_A' }],
        })}
      />,
    );

    expect(screen.getByLabelText(t.historyFields.count)).not.toHaveTextContent(COUNT_NAME);
  });

  /** 부모에게만 알리면 주소가 안 바뀌어 「초기화」를 눌렀는데 고른 값이 그대로 남는다. */
  it('초기화가 자기 편집 상태를 함께 비운다', async () => {
    const { onReset, user } = renderBar();

    await user.click(screen.getByLabelText(t.historyFields.count));
    await user.click(screen.getByRole('option', { name: COUNT_NAME }));
    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText(t.historyFields.count)).not.toHaveTextContent(COUNT_NAME);
  });
});

describe('HistoryFilterBar — 조건 칩', () => {
  it('걸린 조건마다 칩이 서고 이름으로 적힌다', () => {
    renderBar({ appliedFilters: filters({ count: '9101' }) });

    expect(screen.getByText(t.historyFilters.chipCount(COUNT_NAME))).toBeInTheDocument();
  });

  it('칩의 ×가 그 조건 하나만 푼다', async () => {
    const { onRemoveFilter, user } = renderBar({
      appliedFilters: filters({ count: '9101', reason: 'SAMPLE_AR_A' }),
    });

    await user.click(screen.getByRole('button', { name: t.historyFilters.chipRemoveReason }));

    expect(onRemoveFilter).toHaveBeenCalledWith('reason');
  });

  /**
   * **기간 칩에는 ×가 없고 그 사정을 밝힌다** — 양성 앵커(다른 칩에는 ×가 있다)를 먼저 재고
   * 그 뒤에 잰다.
   */
  it('기간 칩에는 ×가 없고 푸는 길을 안내한다', () => {
    renderBar({ appliedFilters: filters({ from: '2026-08-01', reason: 'SAMPLE_AR_A' }) });

    expect(
      screen.getByRole('button', { name: t.historyFilters.chipRemoveReason }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: t.historyFilters.chipRemoveCount }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(t.historyFilters.periodClearNote)).toBeInTheDocument();
  });

  it('조건이 없으면 칩도 서지 않는다', () => {
    renderBar();

    expect(screen.queryByText(t.historyFilters.periodClearNote)).not.toBeInTheDocument();
    expect(screen.getByText(t.historyFilters.periodNote)).toBeInTheDocument();
  });
});

describe('HistoryFilterBar — 잠금', () => {
  /** 조건이 바뀌면 고른 전표가 풀린다 — 나가는 중인 쓰기의 되먹임이 다른 맥락에 도착한다. */
  it('잠기면 칸과 버튼이 함께 잠긴다', () => {
    const { rerender } = renderBar();

    expect(searchButton()).toBeEnabled();

    rerender(<HistoryFilterBar {...baseProps({ isLocked: true })} />);

    expect(searchButton()).toBeDisabled();
    expect(screen.getByRole('button', { name: messages.common.reset })).toBeDisabled();
    expect(screen.getByLabelText(t.historyFields.count)).toBeDisabled();
  });
});

describe('HistoryFilterBar — 승인·반려 조작', () => {
  /** ⛔ C42의 자리 — 조건 줄에 있는 버튼은 조회·초기화·칩 해제뿐이다. */
  it('조회·초기화·칩 해제 말고 다른 조작이 없다', () => {
    const { container } = renderBar({ appliedFilters: filters({ reason: 'SAMPLE_AR_A' }) });

    const names = within(container)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? button.textContent ?? '');

    /* 날짜 컨트롤의 여는 손잡이는 디자인 시스템의 것이라 이 잣대의 대상이 아니다. */
    expect(names.filter((name) => !name.startsWith(messages.common.selectDate))).toEqual([
      messages.common.search,
      messages.common.reset,
      t.historyFilters.chipRemoveReason,
    ]);
  });
});
