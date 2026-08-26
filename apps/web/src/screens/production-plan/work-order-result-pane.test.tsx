import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import { WorkOrderResultPane } from './work-order-result-pane';

const mocks = vi.hoisted(() => ({ plan: vi.fn(), workOrders: vi.fn(), operations: vi.fn() }));
vi.mock('./queries', () => ({ useProductionPlanDetail: mocks.plan }));
vi.mock('../work-order/queries', () => ({ useWorkOrderList: mocks.workOrders }));
vi.mock('../routing/queries', () => ({ useRoutingOperations: mocks.operations }));

const query = (data: unknown, overrides: Record<string, unknown> = {}) => ({
  data,
  isError: false,
  refetch: vi.fn(),
  ...overrides,
});
beforeEach(() => {
  mocks.plan.mockReturnValue(query({ productionPlanId: 101, planNo: 'PLAN-101', routingId: 701 }));
  mocks.workOrders.mockReturnValue(query({ items: [], page: { page: 1, size: 20, total: 0 } }));
  mocks.operations.mockReturnValue(
    query({
      items: [
        { routingOperationId: 301, routingId: 701, operationSeq: 9001, operationName: '절단' },
      ],
    }),
  );
});

it('다른 계획이나 Routing 소유 응답은 W/O를 노출하지 않고 실패 처리한다', () => {
  mocks.plan.mockReturnValue(
    query({ productionPlanId: 999, planNo: 'OTHER-PLAN', routingId: 9999 }),
  );
  render(<WorkOrderResultPane productionPlanId={101} uomLabel="EA" />);
  expect(screen.getByText('다른 계획의 전개 결과가 반환되었습니다.')).toBeInTheDocument();
  expect(mocks.operations).toHaveBeenCalledWith(null);
  expect(screen.queryByText(/OTHER-PLAN/)).not.toBeInTheDocument();
});

it('다른 계획 소유 W/O를 결과 표에 노출하지 않는다', () => {
  mocks.workOrders.mockReturnValue(
    query({
      items: [{ productionPlanId: 999, workOrderNo: 'OTHER-WO' }],
      page: { page: 1, size: 20, total: 1 },
    }),
  );
  render(<WorkOrderResultPane productionPlanId={101} uomLabel="EA" />);
  expect(screen.queryByText('OTHER-WO')).not.toBeInTheDocument();
});

it('다른 Routing 소유 공정을 결과 표에 노출하지 않는다', () => {
  mocks.operations.mockReturnValue(query({ items: [{ routingId: 999 }] }));
  render(<WorkOrderResultPane productionPlanId={101} uomLabel="EA" />);
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
