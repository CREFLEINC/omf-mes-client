import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { ProductionOrderItemName } from './item-lookups';
import {
  ProductionOrderBasicPane,
  type ProductionOrderBasicPaneProps,
} from './production-order-basic-pane';
import type { ReferenceSource } from './reference-lookups';
import type { ProductionOrderFact } from './types';

const t = messages.productionOrder;
const detail = (overrides: Partial<ProductionOrderFact> = {}): ProductionOrderFact => ({
  productionOrderId: 701,
  productionOrderNo: 'SYN-PO-701',
  erpOrderNo: 'SYN-ERP-701',
  parentProductionOrderId: null,
  bomLevel: 0,
  businessUnitId: 2101,
  plantId: 3101,
  itemId: 7101,
  orderQty: 12.5,
  uomId: 8101,
  dueDate: '2026-08-31',
  statusCode: 'SYN-RELEASED',
  expandedWorkOrderCount: 3,
  plannedWorkOrderCount: 5,
  remarks: 'Synthetic note',
  ...overrides,
});
const reference = (value: string, label: string, overrides: Partial<ReferenceSource> = {}) => ({
  entries: [{ value, label }],
  isLoading: false,
  isError: false,
  truncated: false,
  ...overrides,
});
const item: ProductionOrderItemName = {
  itemId: 7101,
  status: 'named',
  label: 'SYN-ITEM-01 · Synthetic item',
};
const baseProps = (): ProductionOrderBasicPaneProps => ({
  isSelected: true,
  detailState: { kind: 'DATA', data: detail() },
  itemName: item,
  businessUnits: reference('2101', 'SYN-BU-01 · Synthetic unit'),
  plants: reference('3101', 'SYN-PLANT-01 · Synthetic plant'),
  uoms: reference('8101', 'SYN-EA · Synthetic each'),
  statusNameOf: (code) => (code === 'SYN-RELEASED' ? '합성 상태' : code),
});
const valueFor = (label: string): HTMLElement => {
  const value = screen.getByText(label, { selector: 'dt' }).parentElement?.querySelector('dd');
  if (!(value instanceof HTMLElement)) throw new Error(`${label} 값 없음`);
  return value;
};

describe('ProductionOrderBasicPane', () => {
  it('미선택, 선택 loading, detail error를 data와 구분한다', () => {
    const props = baseProps();
    const { rerender } = render(<ProductionOrderBasicPane {...props} isSelected={false} />);
    /* 선택 전에는 생산계획·전개된 W/O 구획과 같은 모양 — 제목과 한 줄 안내. */
    expect(screen.getByRole('heading', { name: t.basic.heading })).toBeInTheDocument();
    expect(screen.getByText(t.detail.unselectedNote)).toBeInTheDocument();
    expect(screen.queryByText('SYN-PO-701')).not.toBeInTheDocument();

    rerender(<ProductionOrderBasicPane {...props} detailState={{ kind: 'LOADING' }} />);
    expect(screen.getByRole('status', { name: t.basic.loading })).toBeInTheDocument();
    expect(screen.queryByText('SYN-PO-701')).not.toBeInTheDocument();

    rerender(<ProductionOrderBasicPane {...props} detailState={{ kind: 'ERROR' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(t.basic.loadFailedDescription);
    expect(screen.queryByText('SYN-PO-701')).not.toBeInTheDocument();
  });

  it('semantic 기본 Card에 서버 사실과 사람이 읽는 참조명만 표시한다', async () => {
    render(<ProductionOrderBasicPane {...baseProps()} />);

    const pane = screen.getByLabelText(t.panes.basic);
    const heading = screen.getByRole('heading', { name: t.basic.heading });
    expect(pane).toHaveClass('production-order-pane', 'production-order-basic-pane');
    expect(heading.parentElement).toHaveClass('production-order-pane-heading');
    expect(pane.querySelector('.production-order-detail-fields')).not.toBeNull();
    expect(pane.querySelectorAll('.production-order-detail-field')).toHaveLength(10);
    const expected = [
      [t.fields.productionOrderNo, 'SYN-PO-701'],
      [t.fields.erpProductionOrderNo, 'SYN-ERP-701'],
      [t.fields.businessUnit, 'SYN-BU-01 · Synthetic unit'],
      [t.fields.plant, 'SYN-PLANT-01 · Synthetic plant'],
      [t.fields.item, 'SYN-ITEM-01 · Synthetic item'],
      [t.fields.orderedQty, '12.5 SYN-EA · Synthetic each'],
      [t.fields.dueDate, '2026-08-31'],
      [t.fields.statusCode, '합성 상태'],
      [t.fields.workOrderProgress, '3 / 5'],
      [t.fields.remarks, 'Synthetic note'],
    ] as const;
    for (const [label, value] of expected) expect(valueFor(label)).toHaveTextContent(value);
    /* 선택 직후 읽는 값·참조·비고를 글자 무게로만 가른다 — 5열 × 2행, 읽는 순서는 1행이 먼저다. */
    expect(
      [...pane.querySelectorAll('.production-order-detail-field dt')].map(
        (node) => node.textContent,
      ),
    ).toEqual([
      t.fields.productionOrderNo,
      t.fields.item,
      t.fields.orderedQty,
      t.fields.dueDate,
      t.fields.statusCode,
      t.fields.workOrderProgress,
      t.fields.erpProductionOrderNo,
      t.fields.businessUnit,
      t.fields.plant,
      t.fields.remarks,
    ]);
    expect(valueFor(t.fields.remarks).parentElement).toHaveAttribute('data-tier', 'note');
    /* W/O 생성/예정의 두 숫자 뜻은 도움말 단추가 말한다. */
    const help = screen.getByRole('button', { name: t.basic.workOrderProgressHelp });
    await userEvent.setup().hover(help);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      t.basic.workOrderProgressTooltip.join(''),
    );
    expect(screen.getByRole('heading', { name: t.basic.heading })).toBeInTheDocument();
    for (const rawId of ['701', '2101', '3101', '7101', '8101']) {
      expect(screen.queryByText(rawId)).not.toBeInTheDocument();
    }
  });

  it('참조 loading/failed/truncated와 품목 상태를 내부 ID 없이 구분한다', () => {
    const props = baseProps();
    const { rerender } = render(
      <ProductionOrderBasicPane
        {...props}
        businessUnits={reference('2101', 'unused', { isError: true })}
        plants={reference('3101', 'unused', { isLoading: true })}
        uoms={reference('9999', 'unused', { entries: [], truncated: true })}
      />,
    );
    expect(valueFor(t.fields.businessUnit)).toHaveTextContent(t.values.referenceFailed);
    expect(valueFor(t.fields.plant)).toHaveTextContent(t.values.referenceLoading);
    expect(valueFor(t.fields.orderedQty)).toHaveTextContent(t.values.referenceTruncated);

    const cases: readonly [ProductionOrderItemName | null, string][] = [
      [{ itemId: 7101, status: 'loading', label: null }, t.values.itemLoading],
      [{ itemId: 7101, status: 'unknown', label: null }, t.values.itemUnknown],
      [{ itemId: 7101, status: 'failed', label: null }, t.values.itemFailed],
      [{ itemId: 7202, status: 'named', label: '다른 품목' }, t.values.itemUnknown],
      [null, t.values.itemUnknown],
    ];
    for (const [itemName, expected] of cases) {
      rerender(<ProductionOrderBasicPane {...props} itemName={itemName} />);
      expect(valueFor(t.fields.item)).toHaveTextContent(expected);
      expect(screen.queryByText('7101')).not.toBeInTheDocument();
    }
  });

  it('긴 품목명·비고도 자르지 않고 그대로 보인다', () => {
    const longItem = `SYN-ITEM-LONG · ${'SYNTHETIC SUB ASSEMBLY DIVERTER SENSOR '.repeat(3).trim()}`;
    const longRemarks = 'Synthetic remark '.repeat(12).trim();
    render(
      <ProductionOrderBasicPane
        {...baseProps()}
        detailState={{ kind: 'DATA', data: detail({ remarks: longRemarks }) }}
        itemName={{ ...item, label: longItem }}
      />,
    );
    expect(valueFor(t.fields.item)).toHaveTextContent(longItem);
    expect(valueFor(t.fields.remarks)).toHaveTextContent(longRemarks);
  });

  it('W/O 집계의 zero와 null, nullable 표시값을 그대로 구분한다', () => {
    const props = baseProps();
    const { rerender } = render(
      <ProductionOrderBasicPane
        {...props}
        detailState={{
          kind: 'DATA',
          data: detail({ expandedWorkOrderCount: 0, plannedWorkOrderCount: 0 }),
        }}
      />,
    );
    expect(valueFor(t.fields.workOrderProgress)).toHaveTextContent('0 / 0');

    rerender(
      <ProductionOrderBasicPane
        {...props}
        detailState={{
          kind: 'DATA',
          data: detail({
            erpOrderNo: null,
            dueDate: null,
            remarks: null,
            expandedWorkOrderCount: null,
            plannedWorkOrderCount: null,
          }),
        }}
      />,
    );
    expect(valueFor(t.fields.workOrderProgress)).toHaveTextContent('- / -');
    expect(valueFor(t.fields.erpProductionOrderNo)).toHaveTextContent(t.values.missingErpOrderNo);
    expect(valueFor(t.fields.dueDate)).toHaveTextContent(t.values.missingDueDate);
    expect(valueFor(t.fields.remarks)).toHaveTextContent(t.values.missingRemarks);
  });
});
