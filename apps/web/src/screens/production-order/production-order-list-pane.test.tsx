import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { toPageView } from './pagination';
import {
  ProductionOrderListPane,
  type ProductionOrderListPaneProps,
} from './production-order-list-pane';
import type { ProductionOrderRow } from './types';

const t = messages.productionOrder;
const rows: ProductionOrderRow[] = [
  {
    productionOrderId: 91,
    productionOrderNo: 'SYNTH-PO-B',
    erpProductionOrderNo: 'ERP-B',
    itemLabel: '품목 B',
    orderedQtyLabel: '20 EA',
    dueDateLabel: '2026-08-31',
    statusCode: 'SYNTH-UNKNOWN',
    depth: 2,
    hasChildren: true,
    isExpanded: false,
    expandedWorkOrderCount: 3,
    plannedWorkOrderCount: 5,
  },
  {
    productionOrderId: 17,
    productionOrderNo: 'SYNTH-PO-A',
    erpProductionOrderNo: null,
    itemLabel: ' ',
    orderedQtyLabel: '5 KG',
    dueDateLabel: null,
    statusCode: 'SYNTH-RAW',
    depth: 2,
    hasChildren: false,
    isExpanded: false,
    expandedWorkOrderCount: 0,
    plannedWorkOrderCount: 0,
  },
];

const baseProps = (): ProductionOrderListPaneProps => ({
  rows,
  isLoading: false,
  page: toPageView({ page: 3, size: 20, total: 100 }, 20),
  selectedProductionOrderId: 17,
  onSelect: vi.fn(),
  onToggleExpanded: vi.fn(),
  onChangePage: vi.fn(),
});

const renderPane = (overrides: Partial<ProductionOrderListPaneProps> = {}) => {
  const props = { ...baseProps(), ...overrides };
  const result = render(<ProductionOrderListPane {...props} />);
  return { ...result, ...props, user: userEvent.setup() };
};

const dataRow = (orderNo: string): HTMLTableRowElement => {
  const row = screen.getByRole('button', { name: t.actions.select(orderNo) }).closest('tr');
  if (!(row instanceof HTMLTableRowElement)) throw new Error(`${orderNo} 행 없음`);
  return row;
};

describe('ProductionOrderListPane 목록', () => {
  it('W/O 전개/계획을 포함한 열과 받은 형제 순서를 그대로 표시한다', () => {
    renderPane();

    const pane = screen.getByLabelText(t.panes.list);
    const table = screen.getByRole('table', { name: t.panes.list });
    expect(pane).toHaveClass('production-order-pane');
    expect(screen.getByRole('heading', { name: t.panes.list })).toBeInTheDocument();
    expect(table.closest('.production-order-table')).not.toBeNull();
    expect(within(table).getByText(t.panes.list)).toHaveClass('production-order-table-caption');
    expect(screen.getAllByRole('columnheader').map((node) => node.textContent)).toEqual([
      t.fields.productionOrderNo,
      t.fields.erpProductionOrderNo,
      t.fields.item,
      t.fields.orderedQty,
      t.fields.dueDate,
      t.fields.workOrderProgress,
      t.fields.statusCode,
    ]);
    expect(
      screen.getAllByRole('button', { name: /SYNTH-PO-[AB] 선택/ }).map((node) => node.textContent),
    ).toEqual(['SYNTH-PO-B', 'SYNTH-PO-A']);
    expect(within(dataRow('SYNTH-PO-B')).getByText('3 / 5')).toBeInTheDocument();
  });

  it('안정 ID로 선택하지만 내부 ID를 표시하지 않는다', async () => {
    const { onSelect, user } = renderPane();
    const selected = screen.getByRole('button', { name: t.actions.select('SYNTH-PO-A') });
    expect(selected).toHaveAttribute('aria-current', 'true');
    expect(screen.queryByText('91')).not.toBeInTheDocument();
    expect(screen.queryByText('17')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.actions.select('SYNTH-PO-B') }));
    expect(onSelect).toHaveBeenCalledWith(91);
  });

  it('자식이 있는 행만 depth와 펼침 상태를 전달한다', async () => {
    const { onToggleExpanded, rerender, user } = renderPane();
    const parentToggle = screen.getByRole('button', { name: t.actions.expand('SYNTH-PO-B') });
    const parent = parentToggle.parentElement;
    const leaf = screen.getByRole('button', { name: t.actions.select('SYNTH-PO-A') }).parentElement;
    expect(parentToggle).toHaveAttribute('aria-expanded', 'false');
    expect(parent).toHaveAttribute('data-depth', '2');
    expect(leaf).toHaveAttribute('data-depth', '2');
    expect(parent).toHaveStyle({ paddingInlineStart: '2rem' });
    expect(leaf).toHaveStyle({ paddingInlineStart: '2rem' });
    expect(leaf?.querySelector('span[aria-hidden="true"]')).toHaveStyle({ width: '32px' });
    expect(within(dataRow('SYNTH-PO-A')).queryByRole('button', { name: /하위 P\/O/ })).toBeNull();
    await user.click(parentToggle);
    expect(onToggleExpanded).toHaveBeenCalledWith(91);
    const expandedRows = [{ ...rows[0]!, isExpanded: true }, rows[1]!];
    rerender(<ProductionOrderListPane {...baseProps()} rows={expandedRows} />);
    const collapseToggle = screen.getByRole('button', { name: t.actions.collapse('SYNTH-PO-B') });
    expect(collapseToggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('알 수 없는 원시 상태는 의미를 추정하지 않는 idle Chip으로 표시한다', () => {
    renderPane();
    const chip = screen.getByText('SYNTH-UNKNOWN').parentElement;
    expect(chip?.className).toContain('status-idle');
  });

  it('ERP·품목 표시명·납기 결측을 각각 명시한다', () => {
    renderPane();
    const missingRow = dataRow('SYNTH-PO-A');

    expect(missingRow).toHaveTextContent(t.values.missingErpOrderNo);
    expect(missingRow).toHaveTextContent(t.values.missingItemLabel);
    expect(missingRow).toHaveTextContent(t.values.missingDueDate);
  });
});

describe('ProductionOrderListPane 쪽과 상태', () => {
  it('첫·이전·다음은 정확한 쪽 번호만 callback한다', async () => {
    const onChangePage = vi.fn();
    const { user } = renderPane({ onChangePage });

    await user.click(screen.getByRole('button', { name: t.actions.firstPage }));
    await user.click(screen.getByRole('button', { name: t.actions.prevPage }));
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));
    expect(onChangePage.mock.calls).toEqual([[1], [2], [4]]);
  });

  it('로딩은 표와 빈 상태를 대체한다', () => {
    renderPane({ rows: [], isLoading: true });

    expect(screen.getByRole('status', { name: t.loading })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.title)).not.toBeInTheDocument();
  });

  it('정상 빈 상태와 범위 밖 복구를 구분한다', async () => {
    const props = baseProps();
    const onChangePage = vi.fn();
    const { rerender } = render(
      <ProductionOrderListPane
        {...props}
        rows={[]}
        page={toPageView({ page: 7, size: 0, total: 0 }, 0)}
        onChangePage={onChangePage}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(t.empty.title);
    await userEvent.click(screen.getByRole('button', { name: t.actions.firstPage }));
    await userEvent.click(screen.getByRole('button', { name: t.actions.prevPage }));
    expect(onChangePage.mock.calls).toEqual([[1], [6]]);

    rerender(
      <ProductionOrderListPane
        {...props}
        rows={[]}
        page={toPageView({ page: 4, size: 20, total: 45 }, 0)}
        onChangePage={onChangePage}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(t.empty.beyondTitle);
    await userEvent.click(screen.getByRole('button', { name: t.actions.firstPage }));
    expect(onChangePage).toHaveBeenCalledWith(1);
  });
});
