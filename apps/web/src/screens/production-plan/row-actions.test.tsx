import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProductionPlanEditorStateRow } from './editor-state';
import { ProductionPlanRowActions } from './row-actions';
import type { ProductionPlanFact } from './types';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  detail: vi.fn(),
}));

vi.mock('./mutations', () => ({
  useCreateProductionPlan: mocks.create,
  useUpdateProductionPlan: mocks.update,
  useDeleteProductionPlan: mocks.remove,
}));
vi.mock('./queries', () => ({ useProductionPlanDetail: mocks.detail }));

const writeResult = (overrides: Record<string, unknown> = {}) => ({
  write: vi.fn(),
  isSaving: false,
  fieldErrors: {},
  error: null,
  reset: vi.fn(),
  clearFieldError: vi.fn(),
  ...overrides,
});

const fact = (productionPlanId: number): ProductionPlanFact => ({
  productionPlanId,
  productionOrderId: 501,
  planNo: `PLAN-${String(productionPlanId)}`,
  planDate: '2026-08-26',
  plannedQty: 75,
  uomId: 601,
  bomId: 701,
  routingId: 801,
  plannedLineId: null,
  statusCode: 'DRAFT',
  confirmedAt: null,
  remarks: null,
});

const row = (productionPlanId: number | null): ProductionPlanEditorStateRow => ({
  key: productionPlanId === null ? 'new-1' : `plan-${String(productionPlanId)}`,
  displayNo: 1,
  productionPlanId,
  planNo: productionPlanId === null ? null : `PLAN-${String(productionPlanId)}`,
  statusCode: 'DRAFT',
  confirmed: false,
  isPending: false,
  isDirty: true,
  draft: {
    planDate: '2026-08-26',
    plannedQty: '75',
    bomId: '701',
    routingId: '801',
    plannedLineId: '',
    remarks: '',
  },
  baseline:
    productionPlanId === null
      ? null
      : {
          planDate: '2026-08-26',
          plannedQty: 100,
          bomId: 701,
          routingId: 801,
          plannedLineId: null,
          remarks: null,
        },
  errors: {},
});

const callbacks = () => ({
  onPending: vi.fn(),
  onErrors: vi.fn(),
  onSettle: vi.fn(),
  onRemove: vi.fn(),
});

const renderActions = (target: ProductionPlanEditorStateRow, handlers = callbacks()) => {
  const view = render(
    <ProductionPlanRowActions
      row={target}
      context={{ productionOrderId: 501, uomId: 601 }}
      {...handlers}
    />,
  );
  return { ...view, handlers };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockReturnValue(writeResult());
  mocks.update.mockReturnValue(writeResult());
  mocks.remove.mockReturnValue(writeResult());
  mocks.detail.mockReturnValue({ isSuccess: true, isError: false, refetch: vi.fn() });
});

describe('ProductionPlanRowActions', () => {
  it('신규 행을 검증한 뒤 생성하고 성공 사실을 같은 행에 정착시킨다', async () => {
    const user = userEvent.setup();
    let currentWrite = writeResult();
    mocks.create.mockImplementation(() => currentWrite);
    const handlers = callbacks();
    const target = row(null);
    const props = { row: target, context: { productionOrderId: 501, uomId: 601 }, ...handlers };
    const view = renderActions(target, handlers);

    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(currentWrite.write).toHaveBeenCalledWith({
      productionOrderId: 501,
      planDate: '2026-08-26',
      plannedQty: 75,
      uomId: 601,
      bomId: 701,
      routingId: 801,
    });
    act(() => mocks.create.mock.calls[0]?.[0].onSuccess(fact(901)));
    expect(handlers.onSettle).toHaveBeenCalledWith('new-1', fact(901));

    currentWrite = { ...currentWrite, isSaving: true };
    view.rerender(<ProductionPlanRowActions {...props} />);
    await waitFor(() => expect(handlers.onPending).toHaveBeenLastCalledWith('new-1', true));
  });

  it('잘못된 신규 행은 보내지 않고 삭제는 서버 요청 없이 로컬에서 끝낸다', async () => {
    const user = userEvent.setup();
    const create = writeResult();
    mocks.create.mockReturnValue(create);
    const target = { ...row(null), draft: { ...row(null).draft, plannedQty: '' } };
    const { handlers } = renderActions(target);
    await user.click(screen.getByRole('button', { name: '저장' }));
    await user.click(screen.getByRole('button', { name: '삭제' }));
    expect(create.write).not.toHaveBeenCalled();
    expect(handlers.onErrors).toHaveBeenCalledWith('new-1', { plannedQty: 'REQUIRED' });
    expect(handlers.onRemove).toHaveBeenCalledWith('new-1');
  });

  it('기존 행은 상세 ETag를 준비한 뒤 변경분 저장과 서버 삭제를 구분한다', async () => {
    const user = userEvent.setup();
    const update = writeResult();
    const remove = writeResult();
    mocks.update.mockReturnValue(update);
    mocks.remove.mockReturnValue(remove);
    const { handlers } = renderActions(row(101));
    await user.click(screen.getByRole('button', { name: '저장' }));
    await user.click(screen.getByRole('button', { name: '삭제' }));
    expect(mocks.detail).toHaveBeenCalledWith(101);
    expect(update.write).toHaveBeenCalledWith({ plannedQty: 75 });
    expect(remove.write).toHaveBeenCalledWith();
    act(() => mocks.update.mock.calls[0]?.[0].onSuccess(fact(101)));
    act(() => mocks.remove.mock.calls[0]?.[0].onSuccess());
    expect(handlers.onSettle).toHaveBeenCalledWith('plan-101', fact(101));
    expect(handlers.onRemove).toHaveBeenCalledWith('plan-101');
  });

  it('서버 필드 오류를 입력에 전달하고 충돌과 ETag 조회 실패를 숨기지 않는다', async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    reload.mockResolvedValue({ data: fact(101) });
    mocks.detail.mockReturnValue({ isSuccess: false, isError: true, refetch: reload });
    mocks.update.mockReturnValue(
      writeResult({
        fieldErrors: { plannedQty: '서버 수량 오류' },
        error: { kind: 'conflict', cause: 'user', message: '동시 수정' },
      }),
    );
    const { handlers } = renderActions(row(101));
    await waitFor(() =>
      expect(handlers.onErrors).toHaveBeenCalledWith('plan-101', {
        plannedQty: { message: '서버 수량 오류' },
      }),
    );
    expect(screen.getByText('저장 잠금 정보를 불러오지 못했습니다.')).toBeVisible();
    expect(
      screen.getByText('다른 사용자가 먼저 저장했습니다. 최신 내용을 불러온 뒤 다시 저장하세요.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '최신 불러오기' }));
    expect(handlers.onSettle).toHaveBeenCalledWith('plan-101', fact(101));
  });
});
