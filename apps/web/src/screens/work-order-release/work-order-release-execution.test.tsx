import { ToastProvider } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkOrderReleaseFact } from './queries';
import { WorkOrderReleaseExecution } from './work-order-release-execution';

const mocks = vi.hoisted(() => ({
  detail: vi.fn(),
  validation: vi.fn(),
  summary: vi.fn(),
  uoms: vi.fn(),
  release: vi.fn(),
  write: vi.fn(),
  reset: vi.fn(),
  clearFieldError: vi.fn(),
  detailRefetch: vi.fn(),
  validationRefetch: vi.fn(),
}));

vi.mock('./queries', async (load) => ({
  ...(await load()),
  useWorkOrderReleaseDetail: mocks.detail,
}));
vi.mock('../work-order/queries', () => ({ useWorkOrderValidation: mocks.validation }));
vi.mock('./use-work-order-release-summary', () => ({
  useWorkOrderReleaseSummary: mocks.summary,
}));
vi.mock('../production-order/reference-lookups', () => ({
  useUomReferenceLookup: mocks.uoms,
  resolveReference: () => ({ label: 'EA · Each' }),
  describeReference: (reference: { label: string }) => reference.label,
}));
vi.mock('./mutations', () => ({ useReleaseWorkOrder: mocks.release }));

const fact = (overrides: Partial<WorkOrderReleaseFact> = {}): WorkOrderReleaseFact => ({
  workOrderId: 704,
  workOrderNo: 'SYN-WO-704',
  productionPlanId: 501,
  routingOperationId: 601,
  itemId: 910001,
  orderQty: 12,
  uomId: 920001,
  workOrderTypeCode: 'SYN-NORMAL',
  priorityNo: 2,
  statusCode: 'SYN-READY',
  productionLineId: 301,
  responsibleWorkerId: null,
  plannedStartAt: null,
  plannedEndAt: null,
  plannedEquipmentId: null,
  plannedMoldId: null,
  plannedShiftId: null,
  remarks: null,
  defaultWipLocationId: 1,
  defaultFgLocationId: 2,
  defaultScrapLocationId: 3,
  operationSettingsSnapshot: null,
  releasedAt: null,
  ...overrides,
});
const execution = (selectedWorkOrderId: number | null = 704) => (
  <ToastProvider>
    <WorkOrderReleaseExecution
      selectedWorkOrderId={selectedWorkOrderId}
      onClearSelection={vi.fn()}
    />
  </ToastProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.detail.mockReturnValue({
    data: fact(),
    isFetching: false,
    isError: false,
    isPending: false,
    refetch: mocks.detailRefetch,
  });
  mocks.detailRefetch.mockResolvedValue({ data: fact(), isError: false, isSuccess: true });
  mocks.validation.mockReturnValue({
    data: { passed: true, findings: [] },
    isFetching: false,
    isError: false,
    isPending: false,
    refetch: mocks.validationRefetch,
  });
  mocks.summary.mockReturnValue(null);
  mocks.uoms.mockReturnValue({ entries: [], isLoading: false, isError: false, truncated: false });
  mocks.release.mockReturnValue({
    write: mocks.write,
    isSaving: false,
    fieldErrors: {},
    error: null,
    reset: mocks.reset,
    clearFieldError: mocks.clearFieldError,
  });
});

describe('WorkOrderReleaseExecution', () => {
  it('keeps selected-owner hooks idle without a selection', () => {
    render(execution(null));

    expect(mocks.detail).not.toHaveBeenCalled();
    expect(mocks.release).not.toHaveBeenCalled();
  });

  it('wires exact detail, validation, input body, and release action', async () => {
    const user = userEvent.setup();
    const view = render(execution());

    expect(mocks.detail).toHaveBeenCalledWith(704);
    expect(mocks.validation).toHaveBeenCalledWith(704);
    await user.type(
      screen.getByRole('textbox', { name: messages.workOrderRelease.input.fields.lotSize }),
      '4',
    );
    await user.type(
      screen.getByRole('textbox', { name: messages.workOrderRelease.input.fields.handoverNote }),
      ' 교대 ',
    );
    const exactQuery = mocks.detail.mock.results[0]?.value;
    mocks.detail.mockReturnValue({ ...exactQuery, isFetching: true });
    view.rerender(execution());
    const lotSize = screen.getByRole('textbox', {
      name: messages.workOrderRelease.input.fields.lotSize,
    });
    expect(lotSize).toHaveValue('4');
    expect(lotSize).toBeDisabled();
    mocks.detail.mockReturnValue({ ...exactQuery, isFetching: false });
    view.rerender(execution());
    const release = screen.getByRole('button', { name: messages.workOrderRelease.actions.release });
    await waitFor(() => expect(release).toBeEnabled());
    fireEvent.click(release);
    fireEvent.click(release);
    expect(mocks.write).toHaveBeenCalledWith({ lotSize: 4, handoverNote: '교대' });
    expect(mocks.write).toHaveBeenCalledTimes(1);
    mocks.release.mockReturnValue({ ...mocks.release(), error: { kind: 'network' } });
    view.rerender(execution());
    fireEvent.click(release);
    expect(mocks.write).toHaveBeenCalledTimes(2);
    mocks.release.mockReturnValue({ ...mocks.release(), isSaving: true, error: null });
    view.rerender(execution());
    expect(lotSize).toBeDisabled();
    expect(release).toBeDisabled();
  });

  it('locks a foreign success response until an exact detail reload succeeds', async () => {
    const user = userEvent.setup();
    const view = render(execution());
    const onSuccess = mocks.release.mock.calls[0]?.[0].onSuccess as (
      saved: WorkOrderReleaseFact,
    ) => void;

    act(() => onSuccess(fact({ workOrderId: 999 })));
    expect(screen.getByText(messages.workOrderRelease.execution.writeOwnerMismatch)).toBeVisible();
    expect(screen.getAllByRole('textbox')[0]).toBeDisabled();
    expect(
      screen.getByRole('button', { name: messages.workOrderRelease.actions.release }),
    ).toBeDisabled();
    mocks.detailRefetch.mockResolvedValueOnce({ data: fact(), isError: false, isSuccess: false });
    await user.click(
      screen.getByRole('button', { name: messages.workOrderRelease.execution.reloadDetail }),
    );
    expect(screen.getByText(messages.workOrderRelease.execution.writeOwnerMismatch)).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: messages.workOrderRelease.execution.reloadDetail }),
    );
    await waitFor(() =>
      expect(screen.queryByText(messages.workOrderRelease.execution.writeOwnerMismatch)).toBeNull(),
    );
    const conflict = { kind: 'conflict' as const, cause: 'user' as const, message: '' };
    mocks.release.mockReturnValue({ ...mocks.release(), error: conflict });
    view.rerender(execution());
    await user.click(screen.getByRole('button', { name: messages.conflict.reloadAction }));
    expect(mocks.detailRefetch).toHaveBeenCalledTimes(3);
    expect(mocks.validationRefetch).toHaveBeenCalledTimes(3);
    expect(mocks.reset).toHaveBeenCalledTimes(3);
  });

  it('distinguishes retries and recovers a settled foreign detail', async () => {
    const failedDetail = {
      data: fact(),
      isFetching: false,
      isError: true,
      isPending: false,
      refetch: mocks.detailRefetch,
    };
    mocks.detail.mockReturnValue(failedDetail);
    mocks.validation.mockReturnValue({ ...mocks.validation(), isError: true });
    const user = userEvent.setup();
    const view = render(execution());

    expect(
      screen.getByRole('button', { name: messages.workOrderRelease.actions.release }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: messages.workOrderRelease.execution.retryValidation }),
    ).toBeVisible();
    mocks.detail.mockReturnValue({
      ...failedDetail,
      data: fact({ workOrderId: 999 }),
      isError: false,
    });
    view.rerender(execution());
    await user.click(
      screen.getByRole('button', { name: messages.workOrderRelease.execution.retryDetail }),
    );
    expect(mocks.detailRefetch).toHaveBeenCalledTimes(1);
  });
});
