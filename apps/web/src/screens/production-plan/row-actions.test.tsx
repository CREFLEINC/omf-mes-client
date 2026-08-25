import { render, screen, waitFor } from '@testing-library/react';
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
const expectWritesLocked = () => {
  for (const name of ['저장', '삭제']) expect(screen.getByRole('button', { name })).toBeDisabled();
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
    currentWrite = { ...currentWrite, isSaving: true };
    view.rerender(<ProductionPlanRowActions {...props} />);
    await waitFor(() => expect(handlers.onPending).toHaveBeenLastCalledWith('new-1', true));
    currentWrite = { ...currentWrite, isSaving: false };
    view.rerender(<ProductionPlanRowActions {...props} />);
    await waitFor(() => expect(handlers.onPending).toHaveBeenLastCalledWith('new-1', false));
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
    expect(remove.reset).toHaveBeenCalled();
    expect(update.reset).toHaveBeenCalled();
  });
  it('확정·pending 행은 custom 저장과 삭제를 모두 잠근다', () => {
    for (const target of [
      { ...row(101), confirmed: true },
      { ...row(101), isPending: true },
      { ...row(null), isPending: true },
    ]) {
      const view = renderActions(target);
      expectWritesLocked();
      view.unmount();
    }
  });
  it('서버 필드 오류를 입력에 전달하고 충돌과 ETag 조회 실패를 숨기지 않는다', async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    reload
      .mockResolvedValueOnce({ data: fact(999), isSuccess: false })
      .mockResolvedValueOnce({ data: fact(101), isSuccess: true });
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
    expectWritesLocked();
    await user.click(screen.getByRole('button', { name: '최신 불러오기' }));
    expect(handlers.onSettle).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '최신 불러오기' }));
    expect(handlers.onSettle).toHaveBeenCalledWith('plan-101', fact(101));
    expect(mocks.update.mock.results[0]?.value.reset).toHaveBeenCalled();
    expect(mocks.remove.mock.results[0]?.value.reset).toHaveBeenCalled();
  });
});
