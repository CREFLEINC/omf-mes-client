import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
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
/** 이동 결과를 읽는다 — 단추가 부른 주소를 화면에 적어 둔다. */
const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};
const renderPane = () =>
  render(
    <MemoryRouter>
      <WorkOrderResultPane productionPlanId={101} uomLabel="EA" />
      <LocationProbe />
    </MemoryRouter>,
  );
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
  renderPane();
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
  renderPane();
  expect(screen.queryByText('OTHER-WO')).not.toBeInTheDocument();
});

it('다른 Routing 소유 공정을 결과 표에 노출하지 않는다', () => {
  mocks.operations.mockReturnValue(query({ items: [{ routingId: 999 }] }));
  renderPane();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

it('moves a trusted result to the exact 4M assignment workspace', async () => {
  /* 링크 대신 보조 동작 단추다(사용자 지시 2026-09-20) — 주소는 종전과 같다. */
  renderPane();

  await userEvent.click(screen.getByRole('button', { name: '4M 자원배정·유효성 점검으로 이동' }));

  expect(screen.getByTestId('location')).toHaveTextContent(
    '/production/work-order-assignments?productionPlanId=101',
  );
});
