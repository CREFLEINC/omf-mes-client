import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductionPlanEditorStateRow } from './editor-state';
import { ProductionPlanRowActions } from './row-actions';
import type { ProductionPlanFact } from './types';
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  confirm: vi.fn(),
  detail: vi.fn(),
}));
vi.mock('./mutations', () => ({
  useCreateProductionPlan: mocks.create,
  useUpdateProductionPlan: mocks.update,
  useDeleteProductionPlan: mocks.remove,
  useConfirmProductionPlan: mocks.confirm,
}));
vi.mock('./queries', () => ({ useProductionPlanDetail: mocks.detail }));
const writeResult = (overrides: Record<string, unknown> = {}) => ({
  write: vi.fn(),
  isSaving: false,
  fieldErrors: {},
  error: null,
  reset: vi.fn(),
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
  onShowResults: vi.fn(),
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
  mocks.confirm.mockReturnValue(writeResult());
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
    expect(currentWrite.write).toHaveBeenCalledTimes(1);
    currentWrite = { ...currentWrite, isSaving: true };
    view.rerender(<ProductionPlanRowActions {...props} />);
    expectWritesLocked();
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
    renderActions(row(101));
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect([update.reset.mock.calls.length, remove.reset.mock.calls.length]).toEqual([1, 1]);
    update.reset.mockClear();
    remove.reset.mockClear();
    await user.click(screen.getByRole('button', { name: '삭제' }));
    expect([update.reset.mock.calls.length, remove.reset.mock.calls.length]).toEqual([1, 1]);
    expect(update.write).toHaveBeenCalledWith({ plannedQty: 75 });
    expect(remove.write).toHaveBeenCalledWith();
  });
  it('저장된 계획을 확인한 뒤 서버 단일 전개 확정을 실행하고 결과 대상으로 알린다', async () => {
    const user = userEvent.setup();
    const confirm = writeResult();
    let succeed: ((plan: ProductionPlanFact) => void) | undefined;
    mocks.confirm.mockImplementation((options: { onSuccess: typeof succeed }) => {
      succeed = options.onSuccess;
      return confirm;
    });
    const target = { ...row(101), isDirty: false };
    const { handlers } = renderActions(target);

    await user.click(screen.getByRole('button', { name: '전개 확정' }));
    const dialog = screen.getByRole('dialog', { name: 'PLAN-101 전개 확정' });
    expect(dialog).toHaveTextContent('Routing 공정별 W/O와 공정 의존 관계를 함께 생성합니다.');
    expect(dialog).toHaveTextContent('서버가 한 트랜잭션으로 처리');
    act(() => {
      const submit = within(dialog).getByRole('button', { name: '전개 확정' });
      submit.click();
      submit.click();
    });
    expect(confirm.write).toHaveBeenCalledTimes(1);

    const confirmed = { ...fact(101), confirmedAt: '2026-08-26T11:00:00+09:00' };
    act(() => succeed?.(confirmed));
    expect(handlers.onSettle).toHaveBeenCalledWith('plan-101', confirmed);
    expect(handlers.onShowResults).toHaveBeenCalledWith(101);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('미저장 변경은 확정을 잠그고 확정된 계획은 결과 보기를 제공한다', async () => {
    const user = userEvent.setup();
    const dirty = renderActions(row(101));
    expect(screen.getByRole('button', { name: '전개 확정' })).toBeDisabled();
    dirty.unmount();

    const handlers = callbacks();
    renderActions({ ...row(101), confirmed: true }, handlers);
    await user.click(screen.getByRole('button', { name: '전개 결과' }));
    expect(handlers.onShowResults).toHaveBeenCalledWith(101);
    expect(screen.queryByRole('button', { name: '전개 확정' })).not.toBeInTheDocument();
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
