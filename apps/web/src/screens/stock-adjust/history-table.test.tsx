import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { adjustmentListFixtures, countFixtures } from './fixtures';
import {
  buildHistoryColumns,
  HISTORY_ABSORBING_COLUMN_BUDGET_PX,
  HISTORY_TABLE_MIN_WIDTH_PX,
  HistoryTable,
  type HistoryTableProps,
} from './history-table';
import type { ReferenceSource } from './lookups';
import { toAdjustmentSummaryView } from './types';

const t = messages.stockAdjust;

const COUNT_LABEL = 'SAMPLE-IC-9101 · 2026-08-17';

const countSource = (overrides: Partial<ReferenceSource> = {}): ReferenceSource => ({
  entries: countFixtures.map((count) => ({
    value: String(count.inventoryCountId),
    label: `${count.inventoryCountNo} · ${count.plannedDate}`,
    isActive: true,
  })),
  isError: false,
  isLoading: false,
  truncated: false,
  ...overrides,
});

const rows = adjustmentListFixtures.map(toAdjustmentSummaryView);

const baseProps = (overrides: Partial<HistoryTableProps> = {}): HistoryTableProps => ({
  rows,
  isLoading: false,
  isBeyondLast: false,
  selectedAdjustmentId: null,
  countLookup: countSource(),
  onFirstPage: vi.fn(),
  onToggleSelect: vi.fn(),
  ...overrides,
});

const renderTable = (overrides: Partial<HistoryTableProps> = {}) => {
  const props = baseProps(overrides);
  const result = render(<HistoryTable {...props} />);

  return { ...props, ...result, user: userEvent.setup() };
};

const bodyRows = (): HTMLElement[] =>
  within(screen.getByRole('table')).getAllByRole('row').slice(1);

const cellsOf = (rowIndex: number): string[] =>
  within(bodyRows()[rowIndex] ?? document.createElement('tr'))
    .getAllByRole('cell')
    .map((cell) => cell.textContent ?? '');

describe('buildHistoryColumns — 열 폭 예산', () => {
  const columns = buildHistoryColumns({
    selectedAdjustmentId: null,
    countLookup: countSource(),
    onToggleSelect: vi.fn(),
  });

  it('흡수 열이 정확히 하나다', () => {
    expect(columns.filter((column) => column.width === undefined)).toHaveLength(1);
  });

  /** **선언과 산출물 두 자리를 잰다**(사본 체크리스트 8번) — 여기는 선언 쪽이다. */
  it('지정 폭 합과 흡수 예산이 표 하한 안에 든다', () => {
    const fixed = columns.reduce(
      (sum, column) => sum + Number.parseInt(column.width ?? '0px', 10),
      0,
    );

    expect(fixed).toBe(680);
    expect(HISTORY_TABLE_MIN_WIDTH_PX - fixed).toBe(248);
    expect(HISTORY_TABLE_MIN_WIDTH_PX - fixed).toBeGreaterThanOrEqual(
      HISTORY_ABSORBING_COLUMN_BUDGET_PX,
    );
  });

  it('열이 여섯이고 차례가 읽는 차례다', () => {
    expect(columns.map((column) => column.key)).toEqual([
      'inventoryAdjustmentNo',
      'countRef',
      'reasonCode',
      'statusCode',
      'adjustedAt',
      'select',
    ]);
  });
});

describe('HistoryTable — 산출물의 열 폭', () => {
  /** 선언만 재면 그 값이 실제 표에 닿았는지 알 수 없다 — 산출물 쪽을 함께 잰다. */
  it('선언한 폭이 실제 열 정의에 그대로 실린다', () => {
    const { container } = renderTable();
    const widths = [...container.querySelectorAll('col')].map(
      (col) => (col as HTMLTableColElement).style.width,
    );

    expect(widths).toEqual(['168px', '', '128px', '128px', '168px', '88px']);
  });
});

describe('HistoryTable — 행 표기', () => {
  it('전표번호와 상태·사유를 서버가 준 글자 그대로 낸다', () => {
    renderTable();

    expect(cellsOf(0)[0]).toBe('SAMPLE-IA-9301');
    expect(cellsOf(0)[2]).toBe('SAMPLE_AR_A');
    expect(cellsOf(0)[3]).toBe('SAMPLE_IA_STATUS_A');
  });

  /**
   * ⭐ 조심 ⑤ · C43의 자리. **실사 참조가 비어 있는 것이 정상이다** — 원천이 셋이고 둘은
   * 실사를 거치지 않는다. 양성 앵커(참조가 있는 줄이 이름으로 풀린다)를 먼저 재고 그 뒤에
   * 「경고가 없다」를 잰다.
   */
  it('실사 참조가 없는 줄은 「—」이고 경고 표식이 붙지 않는다', () => {
    renderTable();

    expect(cellsOf(1)[1]).toBe(COUNT_LABEL);
    expect(cellsOf(0)[1]).toBe(t.values.empty);
    expect(cellsOf(0)[1]).not.toBe(t.values.unknown);
    expect(
      within(bodyRows()[0] ?? document.createElement('tr')).queryAllByRole('alert'),
    ).toHaveLength(0);
    expect(
      within(bodyRows()[0] ?? document.createElement('tr')).queryAllByRole('status'),
    ).toHaveLength(0);
  });

  /** 없는 것과 못 푼 것을 가른다 — 참조가 있는데 목록에 없으면 그때만 「알 수 없음」이다. */
  it('참조가 있는데 목록에 없으면 알 수 없음으로 낸다', () => {
    renderTable({ countLookup: countSource({ entries: [] }) });

    expect(cellsOf(1)[1]).toBe(t.values.unknown);
    expect(cellsOf(0)[1]).toBe(t.values.empty);
  });

  it('참조가 아직 오지 않았거나 실패한 갈래를 글자로 가른다', () => {
    const { rerender } = renderTable({
      countLookup: countSource({ entries: [], isLoading: true }),
    });

    expect(cellsOf(1)[1]).toBe(t.values.referenceLoading);

    rerender(
      <HistoryTable {...baseProps({ countLookup: countSource({ entries: [], isError: true }) })} />,
    );

    expect(cellsOf(1)[1]).toBe(t.values.referenceFailed);
  });

  /**
   * **전기 여부의 판정 근거가 전기 시각의 유무 하나다**(C35 · D-13). 상태 코드를 읽지 않는다 —
   * 두 줄의 상태 코드가 같아도 전기 시각이 갈리면 표기가 갈려야 한다.
   */
  it('전기 시각이 없는 줄은 「전기 전」이고 있는 줄은 그 시각을 낸다', () => {
    renderTable();

    expect(cellsOf(0)[4]).toBe(t.historyTable.notPosted);
    expect(cellsOf(1)[4]).toBe('2026-08-18 14:05');
    expect(cellsOf(2)[4]).toBe('2026-08-17 09:30');
  });

  it('상태가 같아도 전기 시각이 갈리면 표기가 갈린다 — 상태 코드로 판정하지 않는다', () => {
    renderTable();

    expect(cellsOf(1)[3]).toBe(cellsOf(2)[3]);
    expect(cellsOf(0)[4]).not.toBe(cellsOf(2)[4]);
  });

  /**
   * 이름은 보이고 번호는 없다 — 짝 방향 단언(`omf-mes#44`).
   *
   * **문자열 포함으로 재지 않는다.** 이 슬라이스의 합성 업무 번호는 내부 번호를 이름 안에
   * 담고 있어(`SAMPLE-IA-9301`) 포함 검사는 늘 실패한다 — **칸 전체가 숫자뿐인가**로 잰다.
   * 참조를 이름으로 풀지 못해 번호를 그대로 그리면 그 칸이 곧 숫자만 남는다.
   */
  it('내부 번호를 어느 칸에도 그리지 않는다', () => {
    renderTable();

    expect(screen.getAllByText(COUNT_LABEL).length).toBeGreaterThan(0);

    for (const row of bodyRows()) {
      for (const cell of within(row).getAllByRole('cell')) {
        expect(cell.textContent ?? '').not.toMatch(/^\s*\d+\s*$/);
      }
    }
  });

  /**
   * ⛔ C42의 자리. **승인·반려 조작이 없다** — 양성 앵커(선택 버튼이 실제로 있다)를 먼저 재고
   * 그 뒤에 「그 밖의 버튼이 없다」를 잰다.
   */
  it('행의 조작이 고르기 하나뿐이다 — 승인·반려 버튼이 없다', () => {
    renderTable();

    const buttons = within(screen.getByRole('table')).getAllByRole('button');

    expect(buttons).toHaveLength(rows.length);
    expect(
      buttons.map((button) => button.getAttribute('aria-label') ?? button.textContent ?? ''),
    ).toEqual(rows.map((row) => t.actions.selectAdjustmentRow(row.inventoryAdjustmentNo)));
  });
});

describe('HistoryTable — 고르기', () => {
  it('고르면 그 전표 번호를 넘긴다', async () => {
    const { onToggleSelect, user } = renderTable();

    await user.click(
      screen.getByRole('button', { name: t.actions.selectAdjustmentRow('SAMPLE-IA-9302') }),
    );

    expect(onToggleSelect).toHaveBeenCalledWith(9302);
  });

  it('고른 줄은 해제 이름으로 바뀐다 — 접근 이름이 전표번호를 담는다', () => {
    renderTable({ selectedAdjustmentId: 9302 });

    expect(
      screen.getByRole('button', { name: t.actions.deselectAdjustmentRow('SAMPLE-IA-9302') }),
    ).toBeInTheDocument();
  });

  it('잠기면 고르기가 막힌다', () => {
    renderTable({ isLocked: true });

    for (const button of within(screen.getByRole('table')).getAllByRole('button')) {
      expect(button).toBeDisabled();
    }
  });
});

describe('HistoryTable — 빈 상태와 조회 중', () => {
  it('조회 중에는 살아 있는 영역으로 그 사실을 알린다', () => {
    renderTable({ isLoading: true });

    expect(screen.getByRole('status', { name: t.loading.adjustments })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  /** 빈 상태가 두 갈래다 — 사용자가 할 조치가 서로 다르다. */
  it('결과가 없으면 조건을 넓히라고 말한다', () => {
    renderTable({ rows: [] });

    expect(screen.getByText(t.empty.historyNoResultTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.historyBeyondLastTitle)).not.toBeInTheDocument();
  });

  it('쪽 밖이면 첫 쪽으로 가는 길을 함께 낸다', async () => {
    const { onFirstPage, user } = renderTable({ rows: [], isBeyondLast: true });

    expect(screen.getByText(t.empty.historyBeyondLastTitle)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.actions.goFirstPage }));

    expect(onFirstPage).toHaveBeenCalledTimes(1);
  });
});
