import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ProductionOrderCodeNames } from './code-names';
import type { ProductionOrderPlanFact, ProductionOrderWorkOrderFact } from './detail-queries';
import { ProductionOrderDetailListPane } from './production-order-detail-list-pane';
import type { ReferenceSource } from './reference-lookups';

const t = messages.productionOrder;
const uoms: ReferenceSource = {
  entries: [{ value: '8101', label: 'SYN-EA · Synthetic each' }],
  isLoading: false,
  isError: false,
  truncated: false,
};
/* 코드값 → 공통코드 표시명. 이름이 없는 코드는 그대로 보인다. */
const codeName =
  (names: Record<string, string>) =>
  (code: string): string =>
    names[code] ?? code;
const codeNames: ProductionOrderCodeNames = {
  productionOrderStatus: codeName({}),
  productionPlanStatus: codeName({ 'SYN-DRAFT': '합성 작성중' }),
  workOrderStatus: codeName({ 'SYN-RELEASED': '합성 배포' }),
  workOrderType: codeName({ 'SYN-NORMAL': '합성 일반' }),
};
const plan = (id: number, overrides: Partial<ProductionOrderPlanFact> = {}) => ({
  productionPlanId: id,
  productionOrderId: 701,
  planNo: `SYN-PLAN-${String(id)}`,
  planDate: '2026-08-25',
  plannedQty: 12.5,
  uomId: 8101,
  plannedLineId: null,
  statusCode: 'SYN-DRAFT',
  ...overrides,
});
const workOrder = (id: number, overrides: Partial<ProductionOrderWorkOrderFact> = {}) => ({
  workOrderId: id,
  workOrderNo: `SYN-WO-${String(id)}`,
  productionPlanId: 501,
  itemId: 7101,
  orderQty: 8.5,
  uomId: 8101,
  workOrderTypeCode: 'SYN-NORMAL',
  productionLineId: null,
  plannedStartAt: '2026-08-25T10:00:00+09:00',
  plannedEndAt: '2026-08-25T11:00:00+09:00',
  statusCode: 'SYN-RELEASED',
  ...overrides,
});
const rowText = (): string[] =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.textContent ?? '');

describe('ProductionOrderDetailListPane', () => {
  it('미선택이면 이전 계획 데이터를 숨기고 선택 loading/error/empty를 구분한다', () => {
    const { rerender } = render(
      <ProductionOrderDetailListPane
        kind="plans"
        isSelected={false}
        state={{ kind: 'DATA', items: [plan(501)] }}
        uoms={uoms}
        codeNames={codeNames}
      />,
    );
    /* 선택 전에는 제목과 한 줄 안내만 둔다 — 큰 안내는 기본 정보 구획 하나가 말한다. */
    expect(screen.getByRole('heading', { name: t.detail.planHeading })).toBeInTheDocument();
    expect(screen.getByText(t.detail.unselectedNote)).toBeInTheDocument();
    expect(screen.queryByText('SYN-PLAN-501')).not.toBeInTheDocument();

    rerender(
      <ProductionOrderDetailListPane
        kind="plans"
        isSelected
        state={{ kind: 'LOADING' }}
        uoms={uoms}
        codeNames={codeNames}
      />,
    );
    expect(screen.getByRole('status', { name: t.detail.planLoading })).toBeInTheDocument();

    rerender(
      <ProductionOrderDetailListPane
        kind="plans"
        isSelected
        state={{ kind: 'ERROR' }}
        uoms={uoms}
        codeNames={codeNames}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(t.detail.planLoadFailedTitle);

    rerender(
      <ProductionOrderDetailListPane
        kind="plans"
        isSelected
        state={{ kind: 'DATA', items: [] }}
        uoms={uoms}
        codeNames={codeNames}
      />,
    );
    expect(screen.getByText(t.detail.planEmptyTitle)).toBeInTheDocument();
  });

  it('계획의 서버 순서와 최소 사실을 참조명으로 표시한다', () => {
    render(
      <ProductionOrderDetailListPane
        kind="plans"
        isSelected
        state={{
          kind: 'DATA',
          items: [plan(502), plan(501, { plannedQty: 0, statusCode: 'SYN-READY' })],
        }}
        uoms={uoms}
        codeNames={codeNames}
      />,
    );

    const table = screen.getByRole('table', { name: t.detail.planHeading });
    expect(screen.getByLabelText(t.panes.plans)).toHaveClass('production-order-pane');
    expect(table.closest('.production-order-plan-table')).not.toBeNull();
    expect(within(table).getByText(t.detail.planHeading)).toHaveClass(
      'production-order-table-caption',
    );
    expect(screen.getByText('합성 작성중').closest('td')).toHaveAttribute('data-align', 'center');
    expect(rowText()).toEqual([
      expect.stringContaining('SYN-PLAN-502'),
      expect.stringContaining('SYN-PLAN-501'),
    ]);
    expect(rowText()[0]).toContain('12.5 SYN-EA · Synthetic each');
    expect(rowText()[1]).toContain('0 SYN-EA · Synthetic each');
    expect(rowText()[1]).toContain('SYN-READY');
    for (const hiddenId of ['501', '502', '701', '8101']) {
      expect(screen.queryByText(hiddenId)).not.toBeInTheDocument();
    }
  });

  it('W/O loading/error/empty와 서버 순서·nullable 일정을 구분한다', () => {
    const { rerender } = render(
      <ProductionOrderDetailListPane
        kind="workOrders"
        isSelected
        state={{ kind: 'LOADING' }}
        uoms={uoms}
        codeNames={codeNames}
      />,
    );
    expect(screen.getByRole('status', { name: t.detail.workOrderLoading })).toBeInTheDocument();

    rerender(
      <ProductionOrderDetailListPane
        kind="workOrders"
        isSelected
        state={{ kind: 'ERROR' }}
        uoms={uoms}
        codeNames={codeNames}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(t.detail.workOrderLoadFailedTitle);

    rerender(
      <ProductionOrderDetailListPane
        kind="workOrders"
        isSelected
        state={{ kind: 'DATA', items: [] }}
        uoms={uoms}
        codeNames={codeNames}
      />,
    );
    expect(screen.getByText(t.detail.workOrderEmptyTitle)).toBeInTheDocument();

    rerender(
      <ProductionOrderDetailListPane
        kind="workOrders"
        isSelected
        state={{
          kind: 'DATA',
          items: [workOrder(602), workOrder(601, { plannedStartAt: null, plannedEndAt: null })],
        }}
        uoms={uoms}
        codeNames={codeNames}
      />,
    );
    expect(rowText()[0]).toContain('SYN-WO-602');
    expect(rowText()[0]).toContain('합성 일반');
    expect(rowText()[0]).toContain('합성 배포');
    expect(rowText()[0]).not.toContain('SYN-NORMAL');
    /* 서버 원문(+09:00)을 공장 시각(Asia/Ho_Chi_Minh)으로 읽힌다. */
    expect(rowText()[0]).toContain('2026-08-25 08:00 ~ 2026-08-25 09:00');
    expect(rowText()[1]).toContain('SYN-WO-601');
    expect(rowText()[1]).toContain(t.detail.unscheduled);
    for (const hiddenId of ['501', '601', '602', '701', '7101', '8101']) {
      expect(screen.queryByText(hiddenId)).not.toBeInTheDocument();
    }
  });
});
