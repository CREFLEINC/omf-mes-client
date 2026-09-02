import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { WorkOrderPageView } from '../work-order/pagination';
import {
  WorkOrderCloseCandidateListPane,
  type WorkOrderCloseCandidateListPaneProps,
  type WorkOrderCloseCandidateRow,
} from './candidate-list-pane';

const t = messages.workOrderClose.candidateList;
const nav = messages.workOrder.pageNav;

const page = (overrides: Partial<WorkOrderPageView> = {}): WorkOrderPageView => ({
  page: 2,
  rangeLabel: '21–40 / 전체 45건',
  canFirst: true,
  canPrev: true,
  canNext: true,
  isBeyondLast: false,
  ...overrides,
});

const row = (overrides: Partial<WorkOrderCloseCandidateRow> = {}): WorkOrderCloseCandidateRow => ({
  workOrderId: 701,
  workOrderNo: 'SYN-WO-ALPHA',
  itemLabel: 'SYN-ITEM-ALPHA',
  quantityLabel: '12.5 SYN-EA',
  ...overrides,
});

const propsOf = (
  overrides: Partial<WorkOrderCloseCandidateListPaneProps> = {},
): WorkOrderCloseCandidateListPaneProps => ({
  rows: [row()],
  selectedWorkOrderId: null,
  isLoading: false,
  loadError: null,
  page: page(),
  onSelect: vi.fn(),
  onChangePage: vi.fn(),
  ...overrides,
});

const renderPane = (overrides: Partial<WorkOrderCloseCandidateListPaneProps> = {}) => {
  const props = propsOf(overrides);
  const result = render(<WorkOrderCloseCandidateListPane {...props} />);

  return { ...result, props, user: userEvent.setup() };
};

const bodyRows = (): HTMLElement[] =>
  within(screen.getByRole('table')).getAllByRole('row').slice(1);

describe('WorkOrderCloseCandidateListPane', () => {
  it('renders only the three close-candidate headers and preserves caller order', () => {
    renderPane({
      rows: [
        row({ workOrderId: 702, workOrderNo: 'SYN-WO-BRAVO' }),
        row({ workOrderId: 701, workOrderNo: 'SYN-WO-ALPHA' }),
      ],
    });

    expect(screen.getByRole('heading', { level: 2, name: t.pane })).toBeVisible();
    expect(screen.getByRole('table', { name: t.pane })).toBeInTheDocument();
    expect(
      within(screen.getByRole('table', { name: t.pane }))
        .getAllByRole('columnheader')
        .map((header) => header.textContent ?? ''),
    ).toEqual(['W/O 번호', '품목', '지시 수량']);
    expect(bodyRows()[0]).toHaveTextContent('SYN-WO-BRAVO');
    expect(bodyRows()[1]).toHaveTextContent('SYN-WO-ALPHA');
  });

  it('selects only through the W/O button with the stable ID exactly once', async () => {
    const { props, user } = renderPane({
      rows: [row(), row({ workOrderId: 702, workOrderNo: 'SYN-WO-BRAVO' })],
      selectedWorkOrderId: 701,
    });
    const firstRow = bodyRows()[0] as HTMLElement;
    const workOrder = within(firstRow).getByRole('button', {
      name: t.actions.select('SYN-WO-ALPHA'),
    });

    expect(within(firstRow).getAllByRole('button')).toEqual([workOrder]);
    expect(workOrder).toHaveAttribute('aria-current', 'true');
    expect(
      screen.getByRole('button', { name: t.actions.select('SYN-WO-BRAVO') }),
    ).not.toHaveAttribute('aria-current');
    await user.click(workOrder);
    expect(props.onSelect).toHaveBeenCalledTimes(1);
    expect(props.onSelect).toHaveBeenCalledWith(701);
  });

  it('changes the current marker only when caller selection props change', () => {
    const rows = [row(), row({ workOrderId: 702, workOrderNo: 'SYN-WO-BRAVO' })];
    const { rerender } = renderPane({ rows, selectedWorkOrderId: 701 });
    const alpha = screen.getByRole('button', { name: t.actions.select('SYN-WO-ALPHA') });
    const bravo = screen.getByRole('button', { name: t.actions.select('SYN-WO-BRAVO') });

    expect(alpha).toHaveAttribute('aria-current', 'true');
    expect(bravo).not.toHaveAttribute('aria-current');
    rerender(<WorkOrderCloseCandidateListPane {...propsOf({ rows, selectedWorkOrderId: 702 })} />);
    expect(alpha).not.toHaveAttribute('aria-current');
    expect(bravo).toHaveAttribute('aria-current', 'true');
  });

  it('keeps the focused W/O button when an earlier caller row disappears', async () => {
    const alphaRow = row({ workOrderId: 701, workOrderNo: 'SYN-WO-ALPHA' });
    const { rerender, user } = renderPane({
      rows: [row({ workOrderId: 702, workOrderNo: 'SYN-WO-BRAVO' }), alphaRow],
    });
    const alpha = screen.getByRole('button', { name: t.actions.select('SYN-WO-ALPHA') });

    await user.click(alpha);
    expect(alpha).toHaveFocus();
    rerender(<WorkOrderCloseCandidateListPane {...propsOf({ rows: [alphaRow] })} />);
    expect(screen.getByRole('button', { name: t.actions.select('SYN-WO-ALPHA') })).toHaveFocus();
  });

  it.each([null, '', '   '])('uses the localized item fallback for a blank label', (itemLabel) => {
    renderPane({ rows: [row({ itemLabel })] });

    expect(screen.getByText(t.values.missingItem)).toBeVisible();
  });

  it('renders the prepared quantity label without changing it', () => {
    renderPane({ rows: [row({ quantityLabel: 'SYN-QUANTITY-AS-SUPPLIED' })] });

    expect(screen.getByText('SYN-QUANTITY-AS-SUPPLIED')).toBeVisible();
  });

  it('prioritizes error over loading, stale rows, and navigation', () => {
    renderPane({
      loadError: <p>SYNTHETIC LOAD ERROR</p>,
      isLoading: true,
    });

    expect(screen.getByText('SYNTHETIC LOAD ERROR')).toBeVisible();
    expect(screen.queryByRole('status', { name: t.loading })).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('navigation', { name: nav.label })).toBeNull();
  });

  it('shows localized loading without stale rows or navigation', () => {
    renderPane({ isLoading: true });

    expect(screen.getByRole('status', { name: t.loading })).toBeVisible();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('navigation', { name: nav.label })).toBeNull();
  });

  it('keeps navigation with the normal empty guidance', () => {
    renderPane({ rows: [] });

    expect(screen.getByText(t.empty.title)).toBeVisible();
    expect(screen.getByText(t.empty.description)).toBeVisible();
    expect(screen.queryByText(t.empty.beyondTitle)).toBeNull();
    expect(screen.getByRole('navigation', { name: nav.label })).toBeVisible();
  });

  it('keeps navigation with distinct beyond-last recovery guidance', () => {
    renderPane({ rows: [], page: page({ isBeyondLast: true }) });

    expect(screen.getByText(t.empty.beyondTitle)).toBeVisible();
    expect(screen.getByText(t.empty.beyondDescription)).toBeVisible();
    expect(screen.queryByText(t.empty.title)).toBeNull();
    expect(screen.getByRole('navigation', { name: nav.label })).toBeVisible();
  });

  it('passes the supplied page view through and delegates exact navigation targets', async () => {
    const { props, user } = renderPane({
      page: page({ page: 4, rangeLabel: '61–80 / 전체 100건' }),
    });

    expect(screen.getByText('61–80 / 전체 100건')).toBeVisible();
    await user.click(screen.getByRole('button', { name: nav.first }));
    await user.click(screen.getByRole('button', { name: nav.previous }));
    await user.click(screen.getByRole('button', { name: nav.next }));
    expect(props.onChangePage).toHaveBeenNthCalledWith(1, 1);
    expect(props.onChangePage).toHaveBeenNthCalledWith(2, 3);
    expect(props.onChangePage).toHaveBeenNthCalledWith(3, 5);
  });

  it('does not add filter or input controls', () => {
    renderPane();

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});
