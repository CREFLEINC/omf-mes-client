import { ToastProvider } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';

import {
  WorkOrderAssignmentEditor,
  WorkOrderAssignmentEditorSession,
} from './work-order-assignment-editor';
import type { WorkOrderFact } from './queries';

const mocks = vi.hoisted(() => ({
  detail: vi.fn(),
  validation: vi.fn(),
  update: vi.fn(),
  lines: vi.fn(),
  equipments: vi.fn(),
  workers: vi.fn(),
  molds: vi.fn(),
  shifts: vi.fn(),
  write: vi.fn(),
}));
vi.mock('./queries', () => ({
  useWorkOrderDetail: mocks.detail,
  useWorkOrderValidation: mocks.validation,
}));
vi.mock('./mutations', () => ({ useUpdateWorkOrder: mocks.update }));
vi.mock('./resource-queries', () => ({
  useWorkOrderProductionLines: mocks.lines,
  useWorkOrderEquipments: mocks.equipments,
  useWorkOrderShifts: mocks.shifts,
}));
vi.mock('./people-tool-queries', () => ({
  useWorkOrderWorkers: mocks.workers,
  useWorkOrderMolds: mocks.molds,
}));

const t = messages.workOrder;
const workOrder = {
  workOrderId: 701,
  workOrderNo: 'SYN-WO-701',
  priorityNo: 2,
  productionLineId: 101,
  responsibleWorkerId: 201,
  plannedStartAt: null,
  plannedEndAt: null,
  plannedEquipmentId: 301,
  plannedMoldId: 401,
  plannedShiftId: 501,
} as WorkOrderFact;
const query = (data: unknown, overrides: Record<string, unknown> = {}) => ({
  data,
  dataUpdatedAt: 1,
  isPending: false,
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
  ...overrides,
});
const resources = (items: unknown[], truncated = false) =>
  query({ items: items.map((item) => ({ plantId: 501, ...(item as object) })), truncated });
const updateState = (overrides: Record<string, unknown> = {}) => ({
  write: mocks.write,
  reset: vi.fn(),
  isSaving: false,
  error: null,
  fieldErrors: { plannedStartAt: 'SYN-SERVER-START' },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.detail.mockReturnValue(query(workOrder));
  mocks.validation.mockReturnValue(query({ passed: true, findings: [] }));
  mocks.lines.mockReturnValue(
    resources([
      { productionLineId: 101, lineCode: 'L-1', lineName: '1호선', isActive: true },
      { productionLineId: 102, lineCode: 'L-2', lineName: '2호선', isActive: true },
    ]),
  );
  mocks.equipments.mockReturnValue(resources([]));
  mocks.workers.mockReturnValue(
    resources([{ workerId: 201, workerNo: 'W-1', workerName: '홍길동', isActive: true }]),
  );
  mocks.molds.mockReturnValue(
    resources([{ moldId: 401, moldCode: 'M-1', moldName: 'A금형', isActive: true }]),
  );
  mocks.shifts.mockReturnValue(
    resources([
      {
        shiftId: 501,
        shiftCode: 'D',
        shiftName: '주간',
        startTime: '08:00:00',
        endTime: '20:00:00',
        isActive: true,
      },
    ]),
  );
  mocks.update.mockReturnValue(updateState());
});

const Harness = ({ blockedReason = null }: { blockedReason?: string | null }) => {
  const [priority, setPriority] = useState('2');
  return (
    <ToastProvider>
      <WorkOrderAssignmentEditorSession
        workOrder={workOrder}
        plantId={501}
        priorityText={priority}
        blockedReason={blockedReason}
        onPriorityChange={setPriority}
        onReload={vi.fn()}
      />
    </ToastProvider>
  );
};

const OuterHarness = () => {
  const [priority, setPriority] = useState('2');
  return (
    <ToastProvider>
      <WorkOrderAssignmentEditor
        workOrderId={701}
        plantId={501}
        priorityText={priority}
        onPriorityChange={setPriority}
      />
    </ToastProvider>
  );
};

it('joins resource lookups, clears line-bound equipment, and saves exact owned fields', async () => {
  const user = userEvent.setup();
  render(<Harness />);
  expect(
    screen.getByLabelText(t.planFieldsPane.fields.plannedStartAtLocal),
  ).toHaveAccessibleDescription('SYN-SERVER-START');
  expect(screen.getByRole('combobox', { name: t.resourcePane.fields.equipment })).toHaveTextContent(
    messages.common.reference.unknown,
  );
  await user.click(screen.getByRole('combobox', { name: t.resourcePane.fields.productionLine }));
  await user.click(screen.getByRole('option', { name: 'L-1 · 1호선' }));
  expect(screen.getByRole('combobox', { name: t.resourcePane.fields.equipment })).toHaveTextContent(
    messages.common.reference.unknown,
  );
  await user.click(screen.getByRole('combobox', { name: t.resourcePane.fields.productionLine }));
  await user.click(screen.getByRole('option', { name: 'L-2 · 2호선' }));
  expect(screen.getByRole('combobox', { name: t.resourcePane.fields.equipment })).toHaveTextContent(
    t.resourcePane.clearOption,
  );
  await user.click(screen.getByRole('button', { name: t.assignmentActions.actions.save }));
  expect(mocks.write).toHaveBeenCalledWith(
    expect.objectContaining({
      productionLineId: 102,
      plannedEquipmentId: null,
      responsibleWorkerId: 201,
      plannedMoldId: 401,
      plannedShiftId: 501,
      priorityNo: 2,
    }),
  );
});

it('rejects a successful write response owned by another work order', () => {
  render(<Harness />);

  act(() => {
    mocks.update.mock.calls.at(-1)![0].onSuccess({ ...workOrder, workOrderId: 999, priorityNo: 9 });
  });

  expect(screen.getByText(t.editor.writeOwnerMismatch)).toBeVisible();
  expect(screen.getByLabelText(t.planFieldsPane.fields.priorityNo)).toHaveValue('2');
  act(() => mocks.update.mock.calls.at(-1)![0].onSuccess(workOrder));
  expect(screen.queryByText(t.editor.writeOwnerMismatch)).toBeNull();
});

it.each([
  [true, null],
  [false, 'SYN-STALE'],
] as const)('locks every control for saving=%s or caller block', (isSaving, blockedReason) => {
  mocks.update.mockReturnValue(updateState({ isSaving }));
  render(<Harness blockedReason={blockedReason} />);
  expect(document.querySelectorAll('button:not(:disabled), input:not(:disabled)')).toHaveLength(0);
});

it('locks edits on validation failure while keeping its retry available', async () => {
  const user = userEvent.setup();
  const refetch = vi.fn();
  mocks.validation.mockReturnValue(query(undefined, { isError: true, refetch }));
  render(<Harness />);

  expect(screen.getByText(t.editor.validationFailed)).toBeVisible();
  expect(screen.getAllByText(t.editor.validationBlocked).length).toBeGreaterThan(0);
  expect(document.querySelectorAll('button:not(:disabled), input:not(:disabled)')).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: messages.common.retry }));
  expect(refetch).toHaveBeenCalledTimes(1);
});

it('forwards a screen-level stale lock into an exact loaded editor', () => {
  render(
    <ToastProvider>
      <WorkOrderAssignmentEditor
        workOrderId={701}
        plantId={501}
        priorityText="2"
        blockedReason="SYN-SCREEN-STALE"
        onPriorityChange={vi.fn()}
      />
    </ToastProvider>,
  );

  expect(screen.getAllByText('SYN-SCREEN-STALE').length).toBeGreaterThan(0);
  expect(document.querySelectorAll('button:not(:disabled), input:not(:disabled)')).toHaveLength(0);
});

it('blocks an initial detail owned by another work order', () => {
  mocks.detail.mockReturnValue(query({ ...workOrder, workOrderId: 999 }));
  render(<OuterHarness />);
  expect(screen.getByText(t.editor.ownerMismatch)).toBeVisible();
  expect(screen.queryByRole('region', { name: t.resourcePane.pane })).toBeNull();
});

it('keeps a dirty session mounted and locked when a background detail refresh fails', async () => {
  const user = userEvent.setup();
  const view = render(<OuterHarness />);
  const priority = screen.getByLabelText(t.planFieldsPane.fields.priorityNo);
  await user.clear(priority);
  await user.type(priority, '9');

  mocks.detail.mockReturnValue(query(workOrder, { isError: true }));
  view.rerender(<OuterHarness />);

  expect(screen.getByText(t.editor.staleDescription)).toBeVisible();
  expect(screen.getByLabelText(t.planFieldsPane.fields.priorityNo)).toHaveValue('9');
  expect(document.querySelectorAll('button:not(:disabled), input:not(:disabled)')).toHaveLength(1);
  expect(screen.getByRole('button', { name: messages.common.retry })).toBeEnabled();
});

it('keeps a dirty session locked until a newer exact detail is explicitly applied', async () => {
  const user = userEvent.setup();
  const view = render(<OuterHarness />);
  const priority = screen.getByLabelText(t.planFieldsPane.fields.priorityNo);
  await user.clear(priority);
  await user.type(priority, '9');

  mocks.detail.mockReturnValue(query({ ...workOrder, priorityNo: 4 }));
  view.rerender(<OuterHarness />);

  expect(screen.getByText(t.editor.changedDescription)).toBeVisible();
  expect(screen.getByLabelText(t.planFieldsPane.fields.priorityNo)).toHaveValue('9');
  await user.click(screen.getByRole('button', { name: messages.conflict.reloadAction }));
  expect(screen.getByLabelText(t.planFieldsPane.fields.priorityNo)).toHaveValue('4');
});

it('accepts an invalidation result that matches the local exact save', async () => {
  const user = userEvent.setup();
  const view = render(<OuterHarness />);
  const priority = screen.getByLabelText(t.planFieldsPane.fields.priorityNo);
  await user.clear(priority);
  await user.type(priority, '9');
  const saved = { ...workOrder, priorityNo: 9 };

  act(() => mocks.update.mock.calls.at(-1)![0].onSuccess(saved));
  view.rerender(<OuterHarness />);

  expect(screen.queryByText(t.editor.changedDescription)).toBeNull();
  expect(screen.getByLabelText(t.planFieldsPane.fields.priorityNo)).toHaveValue('9');
  expect(screen.queryByRole('button', { name: messages.conflict.reloadAction })).toBeNull();

  mocks.detail.mockReturnValue(query({ ...saved }));
  view.rerender(<OuterHarness />);

  expect(screen.queryByText(t.editor.changedDescription)).toBeNull();
  expect(screen.getByLabelText(t.planFieldsPane.fields.priorityNo)).toHaveValue('9');
});

it('locks when a completed refetch revision reuses the superseded value', async () => {
  const user = userEvent.setup();
  const view = render(<OuterHarness />);
  const priority = screen.getByLabelText(t.planFieldsPane.fields.priorityNo);
  await user.clear(priority);
  await user.type(priority, '9');

  act(() => mocks.update.mock.calls.at(-1)![0].onSuccess({ ...workOrder, priorityNo: 9 }));
  view.rerender(<OuterHarness />);
  expect(screen.queryByText(t.editor.changedDescription)).toBeNull();

  mocks.detail.mockReturnValue(query(workOrder, { isError: true }));
  view.rerender(<OuterHarness />);
  expect(screen.getByText(t.editor.staleDescription)).toBeVisible();

  mocks.detail.mockReturnValue(query(workOrder, { dataUpdatedAt: 2 }));
  view.rerender(<OuterHarness />);
  expect(screen.getByText(t.editor.changedDescription)).toBeVisible();
  expect(screen.getByLabelText(t.planFieldsPane.fields.priorityNo)).toHaveValue('9');
});

it('discards a dirty session only after a successful exact conflict reload', async () => {
  const user = userEvent.setup();
  const refetch = vi
    .fn()
    .mockResolvedValueOnce({ isSuccess: false, data: workOrder })
    .mockResolvedValueOnce({ isSuccess: true, data: workOrder });
  mocks.detail.mockReturnValue(query(workOrder, { refetch }));
  mocks.update.mockReturnValue(
    updateState({ error: { kind: 'conflict', cause: 'user', message: 'SYN-CONFLICT' } }),
  );
  render(<OuterHarness />);
  const priority = screen.getByLabelText(t.planFieldsPane.fields.priorityNo);
  await user.clear(priority);
  await user.type(priority, '9');

  await user.click(screen.getByRole('button', { name: messages.conflict.reloadAction }));
  expect(screen.getByLabelText(t.planFieldsPane.fields.priorityNo)).toHaveValue('9');
  await user.click(screen.getByRole('button', { name: messages.conflict.reloadAction }));

  await waitFor(() =>
    expect(screen.getByLabelText(t.planFieldsPane.fields.priorityNo)).toHaveValue('2'),
  );
  expect(refetch).toHaveBeenCalledTimes(2);
});

it('ignores a conflict reload that completes after its owner was replaced', async () => {
  const user = userEvent.setup();
  let finishReload!: (value: { isSuccess: boolean; data: WorkOrderFact }) => void;
  const refetch = vi.fn(
    () =>
      new Promise<{ isSuccess: boolean; data: WorkOrderFact }>(
        (resolve) => (finishReload = resolve),
      ),
  );
  const onPriorityChange = vi.fn();
  mocks.detail.mockReturnValue(query(workOrder, { refetch }));
  mocks.update.mockReturnValue(
    updateState({ error: { kind: 'conflict', cause: 'user', message: 'SYN-CONFLICT' } }),
  );
  const view = render(
    <ToastProvider>
      <WorkOrderAssignmentEditor
        workOrderId={701}
        plantId={501}
        priorityText="2"
        onPriorityChange={onPriorityChange}
      />
    </ToastProvider>,
  );
  const finishSave = mocks.update.mock.calls.at(-1)![0].onSuccess;
  await user.click(screen.getByRole('button', { name: messages.conflict.reloadAction }));

  mocks.detail.mockReturnValue(query({ ...workOrder, workOrderId: 702 }));
  view.rerender(
    <ToastProvider>
      <WorkOrderAssignmentEditor
        workOrderId={702}
        plantId={501}
        priorityText="2"
        onPriorityChange={onPriorityChange}
      />
    </ToastProvider>,
  );
  await act(async () => {
    finishReload({ isSuccess: true, data: { ...workOrder, priorityNo: 9 } });
    await Promise.resolve();
  });
  act(() => finishSave({ ...workOrder, priorityNo: 8 }));

  expect(refetch).toHaveBeenCalledTimes(1);
  expect(onPriorityChange).not.toHaveBeenCalled();
});
