import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, it, vi } from 'vitest';

import { WorkOrderAssignmentScreen, WorkOrderAssignmentWorkspace } from './screen';

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  list: vi.fn(),
  validation: vi.fn(),
  operations: vi.fn(),
  uoms: vi.fn(),
}));
vi.mock('./screen-context', () => ({ useWorkOrderScreenContext: mocks.context }));
vi.mock('./queries', () => ({
  useWorkOrderList: mocks.list,
  useWorkOrderValidation: mocks.validation,
}));
vi.mock('../routing/queries', () => ({ useRoutingOperations: mocks.operations }));
vi.mock('../production-order/reference-lookups', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../production-order/reference-lookups')>()),
  useUomReferenceLookup: mocks.uoms,
}));
vi.mock('./work-order-assignment-editor', () => ({
  WorkOrderAssignmentEditor: (props: {
    workOrderId: number;
    plantId: number | null;
    priorityText: string;
    blockedReason?: string | null;
    onPriorityChange: (value: string) => void;
  }) => (
    <div data-testid="editor">
      {`${String(props.workOrderId)}:${String(props.plantId)}:${props.priorityText}:${props.blockedReason ?? 'open'}`}
      <button type="button" onClick={() => props.onPriorityChange('7')}>
        synthetic editor priority
      </button>
    </div>
  ),
}));

const query = (data: unknown, overrides: Record<string, unknown> = {}) => ({
  data,
  isError: false,
  isPending: false,
  refetch: vi.fn(),
  ...overrides,
});
const plan = {
  productionPlanId: 501,
  productionOrderId: 401,
  planNo: 'SYN-PLAN-501',
  routingId: 301,
  uomId: 801,
};
const order = { productionOrderId: 401, productionOrderNo: 'SYN-PO-401', plantId: 601 };
const workOrder = {
  workOrderId: 701,
  workOrderNo: 'SYN-WO-701',
  productionPlanId: 501,
  routingOperationId: 901,
  itemId: 1001,
  orderQty: 12.5,
  uomId: 801,
  workOrderTypeCode: 'NORMAL',
  priorityNo: 2,
  statusCode: 'DRAFT',
  productionLineId: 11,
  responsibleWorkerId: 21,
  plannedStartAt: null,
  plannedEndAt: null,
  plannedEquipmentId: 31,
  plannedMoldId: null,
  plannedShiftId: 41,
  remarks: null,
};
const listResponse = (page = 1, total = 2) => ({
  items: [{ ...workOrder, workOrderNo: `SYN-WO-70${String(page)}` }],
  page: { page, size: 1, total },
});
const renderScreen = () => render(<WorkOrderAssignmentWorkspace productionPlanId={501} />);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockReturnValue({
    productionPlanQuery: query(plan),
    productionOrderQuery: query(order),
    plantId: 601,
  });
  mocks.list.mockImplementation((_id: number, pageNo: number) => query(listResponse(pageNo)));
  mocks.validation.mockReturnValue(query({ passed: true, findings: [] }));
  mocks.operations.mockReturnValue(
    query({ items: [{ routingOperationId: 901, routingId: 301, operationName: '절단' }] }),
  );
  mocks.uoms.mockReturnValue({
    entries: [{ value: '801', label: 'EA · 개' }],
    isLoading: false,
    isError: false,
    truncated: false,
    refetch: vi.fn(),
  });
});

it.each(['', '?productionPlanId=0', '?productionPlanId=invalid'])(
  'keeps an invalid route parameter outside the workspace for %s',
  (search) => {
    render(
      <MemoryRouter initialEntries={[`/production/work-order-assignments${search}`]}>
        <WorkOrderAssignmentScreen />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: messages.workOrder.screen.view.title }),
    ).toBeVisible();
    expect(screen.getByText(messages.workOrder.screen.view.selectPlan)).toBeVisible();
    expect(
      screen.getByRole('link', { name: messages.workOrder.screen.view.selectPlanLink }),
    ).toHaveAttribute('href', '/production/production-plans');
    expect(mocks.context).not.toHaveBeenCalled();
  },
);

it('opens the exact production plan workspace from the public route parameter', () => {
  render(
    <MemoryRouter initialEntries={['/production/work-order-assignments?productionPlanId=501']}>
      <WorkOrderAssignmentScreen />
    </MemoryRouter>,
  );

  expect(mocks.context).toHaveBeenCalledWith(501);
  expect(
    screen.getByRole('region', { name: messages.workOrder.screen.view.contextPane }),
  ).toBeVisible();
});

it('joins exact context, display references, selection, and shared priority draft', async () => {
  const user = userEvent.setup();
  renderScreen();

  expect(screen.getByText('1. 절단')).toBeVisible();
  expect(screen.getByText('12.5 EA · 개')).toBeVisible();

  const priority = screen.getByRole('textbox', { name: 'SYN-WO-701 우선순위' });
  await user.clear(priority);
  await user.type(priority, '9');
  expect(screen.getByTestId('editor')).toHaveTextContent('701:601:9:open');
  await user.click(screen.getByRole('button', { name: 'synthetic editor priority' }));
  expect(screen.getByRole('textbox', { name: 'SYN-WO-701 우선순위' })).toHaveValue('7');
});

it('fails closed on mixed-owner list data and retries every source', async () => {
  const user = userEvent.setup();
  const context = mocks.context();
  mocks.context.mockReturnValue(context);
  const list = query({ ...listResponse(), items: [{ ...workOrder, productionPlanId: 999 }] });
  const operations = mocks.operations();
  const uoms = mocks.uoms();
  mocks.list.mockReturnValue(list);
  mocks.operations.mockReturnValue(operations);
  mocks.uoms.mockReturnValue(uoms);
  renderScreen();

  expect(screen.getByText(messages.workOrder.screen.view.ownerMismatch)).toBeVisible();
  expect(screen.queryByRole('table')).toBeNull();
  await user.click(screen.getByRole('button', { name: messages.workOrder.screen.view.retry }));
  expect(context.productionPlanQuery.refetch).toHaveBeenCalled();
  expect(context.productionOrderQuery.refetch).toHaveBeenCalled();
  expect(list.refetch).toHaveBeenCalled();
  expect(operations.refetch).toHaveBeenCalled();
  expect(uoms.refetch).toHaveBeenCalled();
  expect(mocks.validation().refetch).not.toHaveBeenCalled();
});

it('fails closed when the response page does not match the requested page', () => {
  mocks.list.mockReturnValue(query({ ...listResponse(), page: { page: 2, size: 1, total: 2 } }));
  renderScreen();

  expect(screen.getByText(messages.workOrder.screen.view.failed)).toBeVisible();
  expect(screen.queryByRole('table')).toBeNull();
});

it('keeps a selected draft mounted and locked across cached source or validation errors', async () => {
  const user = userEvent.setup();
  const view = renderScreen();
  const priority = screen.getByRole('textbox', { name: 'SYN-WO-701 우선순위' });
  await user.clear(priority);
  await user.type(priority, '9');

  mocks.context.mockReturnValue({
    ...mocks.context(),
    productionPlanQuery: query(plan, { isError: true }),
  });
  view.rerender(<WorkOrderAssignmentWorkspace productionPlanId={501} />);
  expect(screen.getByTestId('editor')).toHaveTextContent(
    `701:601:9:${messages.workOrder.screen.view.staleBlocked}`,
  );
  expect(screen.getByRole('textbox', { name: 'SYN-WO-701 우선순위' })).toBeDisabled();

  mocks.context.mockReturnValue({
    productionPlanQuery: query(plan),
    productionOrderQuery: query(order),
    plantId: 601,
  });
  const failedValidation = query(undefined, { isError: true });
  mocks.validation.mockReturnValue(failedValidation);
  view.rerender(<WorkOrderAssignmentWorkspace productionPlanId={501} />);
  expect(screen.getByText('검증 조회 실패')).toBeVisible();
  expect(screen.getByTestId('editor')).toHaveTextContent(
    messages.workOrder.screen.view.staleBlocked,
  );
  await user.click(screen.getByRole('button', { name: messages.workOrder.screen.view.retry }));
  expect(failedValidation.refetch).toHaveBeenCalled();
});

it('fails closed when a server page extends past the reported total', async () => {
  const user = userEvent.setup();
  mocks.list.mockImplementation((_id: number, pageNo: number) =>
    query(listResponse(pageNo, pageNo === 1 ? 2 : 1)),
  );
  const view = renderScreen();
  await user.click(screen.getByRole('button', { name: messages.workOrder.pageNav.next }));

  expect(mocks.list).toHaveBeenLastCalledWith(501, 2);
  expect(screen.getByText(messages.workOrder.screen.view.failed)).toBeVisible();
  mocks.list.mockReturnValue(query({ ...listResponse(2, 1), items: [] }));
  view.rerender(<WorkOrderAssignmentWorkspace productionPlanId={501} />);
  expect(screen.getByText(messages.workOrder.empty.beyondTitle)).toBeVisible();
});
