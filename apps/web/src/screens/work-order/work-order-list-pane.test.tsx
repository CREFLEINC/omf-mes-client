import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  WorkOrderListPane,
  type WorkOrderListPaneProps,
  type WorkOrderListRow,
} from './work-order-list-pane';
import type { WorkOrderPageView } from './pagination';

const t = messages.workOrder;

const page = (overrides: Partial<WorkOrderPageView> = {}): WorkOrderPageView => ({
  page: 2,
  rangeLabel: '21–40 / 전체 45건',
  canFirst: true,
  canPrev: true,
  canNext: true,
  isBeyondLast: false,
  ...overrides,
});

const row = (overrides: Partial<WorkOrderListRow> = {}): WorkOrderListRow => ({
  workOrderId: 901,
  workOrderNo: 'SYN-WO-ALPHA',
  operationLabel: 'SYN-OP-01 · 합성 공정',
  quantityLabel: '12.5 SYN-EA',
  priorityText: '2',
  priorityError: undefined,
  assignmentLabel: 'SYN-ASSIGNED',
  validationLabel: 'SYN-READY',
  validationTone: 'success',
  ...overrides,
});

const propsOf = (overrides: Partial<WorkOrderListPaneProps> = {}): WorkOrderListPaneProps => ({
  rows: [row()],
  selectedWorkOrderId: null,
  isLoading: false,
  loadError: null,
  priorityDisabledReason: null,
  page: page(),
  onSelect: vi.fn(),
  onPriorityChange: vi.fn(),
  onChangePage: vi.fn(),
  ...overrides,
});

const renderPane = (overrides: Partial<WorkOrderListPaneProps> = {}) => {
  const props = propsOf(overrides);
  const result = render(<WorkOrderListPane {...props} />);

  return { ...result, props, user: userEvent.setup() };
};

const headerTexts = (): string[] =>
  within(screen.getByRole('table'))
    .getAllByRole('columnheader')
    .map((header) => header.textContent ?? '');

describe('WorkOrderListPane', () => {
  it('renders the six exact headers and keeps caller row order', () => {
    renderPane({
      rows: [
        row({ workOrderId: 902, workOrderNo: 'SYN-WO-BRAVO' }),
        row({ workOrderId: 901, workOrderNo: 'SYN-WO-ALPHA' }),
      ],
    });

    expect(screen.getByRole('heading', { level: 2, name: t.panes.list })).toBeVisible();
    expect(screen.getByRole('table', { name: t.panes.list })).toBeInTheDocument();
    expect(headerTexts()).toEqual(['W/O 번호', '공정', '수량', '우선순위', '배정', '검증']);
    const bodyRows = within(screen.getByRole('table')).getAllByRole('row').slice(1);

    expect(bodyRows[0]).toHaveTextContent('SYN-WO-BRAVO');
    expect(bodyRows[1]).toHaveTextContent('SYN-WO-ALPHA');
  });

  it('renders supplied page navigation and passes its target to the caller', async () => {
    const { props, user } = renderPane({
      page: page({ page: 4, rangeLabel: '61–80 / 전체 100건' }),
    });

    expect(screen.getByRole('navigation', { name: t.pageNav.label })).toBeInTheDocument();
    expect(screen.getByText('61–80 / 전체 100건')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.pageNav.next }));
    expect(props.onChangePage).toHaveBeenCalledWith(5);
  });

  it('selects by W/O number and does not display stable internal IDs', async () => {
    const { props, user } = renderPane({ selectedWorkOrderId: 901 });
    const workOrderButton = screen.getByRole('button', { name: 'SYN-WO-ALPHA 선택' });

    expect(workOrderButton).toHaveAttribute('aria-current', 'true');
    expect(screen.queryByText('901')).toBeNull();
    await user.click(workOrderButton);
    expect(props.onSelect).toHaveBeenCalledWith(901);
  });

  it('uses an explicit operation fallback instead of a raw identifier', () => {
    renderPane({ rows: [row({ operationLabel: ' ' })] });

    expect(screen.getByText('공정 표시명 없음')).toBeInTheDocument();
    expect(screen.queryByText('604')).toBeNull();
  });

  it('keeps unlocked priority as raw text and exposes its caller error', async () => {
    const { props, user } = renderPane({
      rows: [row({ priorityText: '', priorityError: '합성 우선순위 오류' })],
    });
    const priority = screen.getByRole('textbox', { name: 'SYN-WO-ALPHA 우선순위' });

    expect(priority).toHaveAttribute('inputmode', 'numeric');
    expect(priority.closest('.work-order-priority-field')).not.toBeNull();
    expect(priority).toHaveAccessibleDescription('합성 우선순위 오류');
    await user.type(priority, '-');
    expect(props.onPriorityChange).toHaveBeenLastCalledWith(901, '-');
  });

  it('disables priority with a visible caller-provided reason', () => {
    renderPane({ priorityDisabledReason: '합성 우선순위 편집 잠금 사유' });
    const priority = screen.getByRole('textbox', { name: 'SYN-WO-ALPHA 우선순위' });

    expect(priority).toBeDisabled();
    expect(screen.getByText('합성 우선순위 편집 잠금 사유')).toBeVisible();
    expect(priority).toHaveAccessibleDescription('합성 우선순위 편집 잠금 사유');
  });

  it('renders prepared assignment and warning validation tone without deriving replacements', () => {
    renderPane({
      rows: [
        row({
          assignmentLabel: 'SYN-ASSIGNMENT-PREPARED',
          validationLabel: 'SYN-VALIDATION-PREPARED',
          validationTone: 'warning',
        }),
      ],
    });

    expect(screen.getByText('SYN-ASSIGNMENT-PREPARED')).toBeInTheDocument();
    expect(screen.getByText('SYN-VALIDATION-PREPARED').parentElement?.className).toContain(
      'status-warning',
    );
  });

  it('prioritizes error over loading and empty, then loading over empty', () => {
    const { rerender } = renderPane({
      rows: [],
      loadError: <p>합성 조회 오류</p>,
      isLoading: true,
    });
    expect(screen.getByText('합성 조회 오류')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: '작업지시 목록을 불러오는 중입니다.' })).toBeNull();
    expect(screen.queryByText('표시할 작업지시가 없습니다')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('navigation', { name: t.pageNav.label })).toBeNull();

    rerender(<WorkOrderListPane {...propsOf({ rows: [], isLoading: true })} />);
    expect(
      screen.getByRole('status', { name: '작업지시 목록을 불러오는 중입니다.' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('합성 조회 오류')).toBeNull();
    expect(screen.queryByText('표시할 작업지시가 없습니다')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('navigation', { name: t.pageNav.label })).toBeNull();

    rerender(<WorkOrderListPane {...propsOf({ rows: [] })} />);
    expect(screen.getByText('표시할 작업지시가 없습니다')).toBeInTheDocument();
    expect(screen.queryByText('합성 조회 오류')).toBeNull();
    expect(screen.queryByRole('status', { name: '작업지시 목록을 불러오는 중입니다.' })).toBeNull();
    expect(screen.getByRole('navigation', { name: t.pageNav.label })).toBeInTheDocument();
  });

  it('uses supplied beyond-last recovery copy and navigation state', async () => {
    const { props, user } = renderPane({
      rows: [],
      page: page({ page: 4, rangeLabel: '전체 45건', canNext: false, isBeyondLast: true }),
    });
    const first = screen.getByRole('button', { name: t.pageNav.first });
    const previous = screen.getByRole('button', { name: t.pageNav.previous });

    expect(screen.getByText(t.empty.beyondTitle)).toBeInTheDocument();
    expect(screen.getByText(t.empty.beyondDescription)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.title)).toBeNull();
    expect(screen.getByRole('navigation', { name: t.pageNav.label })).toBeInTheDocument();
    expect(first).toBeEnabled();
    expect(previous).toBeEnabled();
    expect(screen.getByRole('button', { name: t.pageNav.next })).toBeDisabled();
    await user.click(first);
    await user.click(previous);
    expect(props.onChangePage).toHaveBeenNthCalledWith(1, 1);
    expect(props.onChangePage).toHaveBeenNthCalledWith(2, 3);
  });
});
