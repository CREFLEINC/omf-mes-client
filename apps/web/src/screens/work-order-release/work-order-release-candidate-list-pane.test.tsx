import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { WorkOrderPageView } from '../work-order/pagination';
import {
  WorkOrderReleaseCandidateListPane,
  type WorkOrderReleaseCandidateListPaneProps,
  type WorkOrderReleaseCandidateRow,
} from './work-order-release-candidate-list-pane';

const t = messages.workOrderRelease.candidateList;
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

const row = (
  overrides: Partial<WorkOrderReleaseCandidateRow> = {},
): WorkOrderReleaseCandidateRow => ({
  workOrderId: 901,
  workOrderNo: 'SYN-WO-ALPHA',
  itemLabel: 'SYN-ITEM-ALPHA',
  quantityLabel: '12.5 SYN-EA',
  ...overrides,
});

const propsOf = (
  overrides: Partial<WorkOrderReleaseCandidateListPaneProps> = {},
): WorkOrderReleaseCandidateListPaneProps => ({
  rows: [row()],
  selectedWorkOrderId: null,
  isLoading: false,
  loadError: null,
  page: page(),
  onSelect: vi.fn(),
  onChangePage: vi.fn(),
  ...overrides,
});

const renderPane = (overrides: Partial<WorkOrderReleaseCandidateListPaneProps> = {}) => {
  const props = propsOf(overrides);
  const result = render(<WorkOrderReleaseCandidateListPane {...props} />);

  return { ...result, props, user: userEvent.setup() };
};

const headerTexts = (): string[] =>
  within(screen.getByRole('table'))
    .getAllByRole('columnheader')
    .map((header) => header.textContent ?? '');

describe('WorkOrderReleaseCandidateListPane', () => {
  it('renders the exact three headers and preserves caller row order', () => {
    renderPane({
      rows: [
        row({ workOrderId: 902, workOrderNo: 'SYN-WO-BRAVO' }),
        row({ workOrderId: 901, workOrderNo: 'SYN-WO-ALPHA' }),
      ],
    });

    expect(headerTexts()).toEqual(['W/O 번호', '품목', '지시 수량']);
    const bodyRows = within(screen.getByRole('table')).getAllByRole('row').slice(1);

    expect(bodyRows[0]).toHaveTextContent('SYN-WO-BRAVO');
    expect(bodyRows[1]).toHaveTextContent('SYN-WO-ALPHA');
  });

  it('selects only by W/O number with the caller-owned stable ID', async () => {
    const { props, user } = renderPane({
      selectedWorkOrderId: 901,
      rows: [row(), row({ workOrderId: 902, workOrderNo: 'SYN-WO-BRAVO' })],
    });
    const workOrder = screen.getByRole('button', { name: t.actions.select('SYN-WO-ALPHA') });

    expect(workOrder).toHaveAttribute('aria-current', 'true');
    expect(
      screen.getByRole('button', { name: t.actions.select('SYN-WO-BRAVO') }),
    ).not.toHaveAttribute('aria-current');
    expect(screen.queryByText('901')).toBeNull();
    await user.click(workOrder);
    expect(props.onSelect).toHaveBeenCalledWith(901);
  });

  it.each([null, undefined, '   '])(
    'uses the localized item fallback for a prepared blank label',
    (itemLabel) => {
      renderPane({ rows: [row({ itemLabel: itemLabel as never })] });

      expect(screen.getByText(t.values.missingItem)).toBeVisible();
      expect(screen.queryByText('undefined')).toBeNull();
    },
  );

  it('renders the prepared quantity unchanged', () => {
    renderPane({ rows: [row({ quantityLabel: 'SYN-QUANTITY-AS-SUPPLIED' })] });

    expect(screen.getByText('SYN-QUANTITY-AS-SUPPLIED')).toBeVisible();
  });

  it('delegates the supplied page navigation target', async () => {
    const { props, user } = renderPane({ page: page({ page: 4 }) });

    await user.click(screen.getByRole('button', { name: nav.next }));
    expect(props.onChangePage).toHaveBeenCalledWith(5);
  });

  it('prioritizes error over loading and loading over stale rows and navigation', () => {
    const { rerender } = renderPane({
      loadError: <p>SYNTHETIC LOAD ERROR</p>,
      isLoading: true,
    });

    expect(screen.getByText('SYNTHETIC LOAD ERROR')).toBeVisible();
    expect(screen.queryByRole('status', { name: t.loading })).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('navigation', { name: nav.label })).toBeNull();

    rerender(<WorkOrderReleaseCandidateListPane {...propsOf({ isLoading: true })} />);
    expect(screen.getByRole('status', { name: t.loading })).toBeVisible();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('navigation', { name: nav.label })).toBeNull();
  });

  it('keeps page navigation for distinct normal-empty and beyond-last recovery', () => {
    const { rerender } = renderPane({ rows: [] });

    expect(screen.getByText(t.empty.title)).toBeVisible();
    expect(screen.getByText(t.empty.description)).toBeVisible();
    expect(screen.queryByText(t.empty.beyondTitle)).toBeNull();
    expect(screen.getByRole('navigation', { name: nav.label })).toBeVisible();

    rerender(
      <WorkOrderReleaseCandidateListPane
        {...propsOf({ rows: [], page: page({ isBeyondLast: true }) })}
      />,
    );
    expect(screen.getByText(t.empty.beyondTitle)).toBeVisible();
    expect(screen.getByText(t.empty.beyondDescription)).toBeVisible();
    expect(screen.queryByText(t.empty.title)).toBeNull();
    expect(screen.getByRole('navigation', { name: nav.label })).toBeVisible();
  });

  it('does not add filter or input controls', () => {
    renderPane();

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});
