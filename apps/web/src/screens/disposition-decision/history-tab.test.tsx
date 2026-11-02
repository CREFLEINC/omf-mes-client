import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { pickDate } from '../../test/date-picker';
import {
  HistoryFilterBar,
  type HistoryFilterBarProps,
  HistoryList,
  type HistoryListProps,
} from './history-tab';
import type { DispositionLookup } from './lookups';
import type { HistoryRow } from './types';

/* 품목 검색 창 자체는 검사 조회·판정 시험이 맡는다 — 여기서는 고른 값이 조건에 실리는지만 본다. */
vi.mock('../iqc-inspection/item-filter-field', () => ({
  ItemFilterField: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <button
      type="button"
      aria-label="품목 검색"
      data-value={value}
      onClick={() => onChange('5001')}
    >
      {value}
    </button>
  ),
}));

const t = messages.dispositionDecision;
const CODE = 'REWORK';

const uoms = (): DispositionLookup => ({
  entries: [{ value: '7001', label: 'EA', isActive: true }],
  truncated: false,
  isError: false,
  isLoading: false,
});

const rows: HistoryRow[] = [
  {
    dispositionDecisionId: 3001,
    nonconformanceId: 41,
    nonconformanceNo: 'NC-TEST-0041',
    dispositionTypeCode: CODE,
    decisionQtyText: '200',
    uomId: 7001,
    reason: '표면만 손상돼 재작업으로 회복된다',
    decidedAtText: '2026-08-12 14:20',
    decidedBy: 4001,
  },
];

const listProps = (): HistoryListProps => ({
  rows,
  uoms: uoms(),
  meta: { page: 1, size: 20, total: rows.length },
  page: {
    page: 1,
    canPrev: false,
    canNext: false,
    isBeyondLast: false,
    rangeLabel: t.page.range(1, 1, 1),
  },
  isLoading: false,
  error: null,
  selectedId: null,
  onSelect: vi.fn(),
  onChangePage: vi.fn(),
  onChangeSize: vi.fn(),
});

const renderList = (overrides: Partial<HistoryListProps> = {}) => {
  const props = { ...listProps(), ...overrides };
  return { ...render(<HistoryList {...props} />), props, user: userEvent.setup() };
};

const barProps = (): HistoryFilterBarProps => ({
  applied: { from: '2026-07-14', to: '2026-08-12', itemId: '', dispositionTypeCode: '' },
  onApply: vi.fn(),
  onReset: vi.fn(),
});

const renderBar = (overrides: Partial<HistoryFilterBarProps> = {}) => {
  const props = { ...barProps(), ...overrides };
  return { ...render(<HistoryFilterBar {...props} />), props, user: userEvent.setup() };
};

describe('HistoryList', () => {
  it('판정 한 건을 부적합 번호 · 수량과 단위와 함께 보인다', () => {
    renderList();

    expect(screen.getByText('NC-TEST-0041')).toBeInTheDocument();
    expect(screen.getByText('200 EA')).toBeInTheDocument();
    expect(screen.getByText('표면만 손상돼 재작업으로 회복된다')).toBeInTheDocument();
  });

  it('줄 아무 곳이나 누르면 그 판정을 고른다(#223)', async () => {
    const { props, user } = renderList();

    await user.click(screen.getByText('2026-08-12 14:20'));

    expect(props.onSelect).toHaveBeenCalledWith(rows[0]);
  });

  it('고른 줄에 표시가 붙는다', () => {
    renderList({ selectedId: 3001 });

    expect(screen.getByText('NC-TEST-0041')).toHaveAttribute('data-selected', 'true');
  });

  it('결과가 없으면 기간을 넓히라고 안내한다', () => {
    renderList({ rows: [] });

    expect(screen.getByText(t.empty.historyTitle)).toBeInTheDocument();
  });

  it('불러오는 중에는 상태를 알린다', () => {
    renderList({ isLoading: true });

    expect(screen.getByRole('status', { name: t.historyLoading })).toBeInTheDocument();
  });
});

describe('HistoryFilterBar', () => {
  it('판정 시작일 · 종료일 · 품목을 바꿔 조회하면 그 값을 알린다(#223)', async () => {
    const { props, user } = renderBar();

    await pickDate(user, screen.getByLabelText(t.fields.decidedFrom), '2026-08-01');
    await pickDate(user, screen.getByLabelText(t.fields.decidedTo), '2026-08-05');
    await user.click(screen.getByRole('button', { name: '품목 검색' }));
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(props.onApply).toHaveBeenCalledWith({
      from: '2026-08-01',
      to: '2026-08-05',
      itemId: '5001',
      dispositionTypeCode: '',
    });
  });

  it('초기화를 누르면 알린다', async () => {
    const { props, user } = renderBar();

    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    expect(props.onReset).toHaveBeenCalled();
  });
});
