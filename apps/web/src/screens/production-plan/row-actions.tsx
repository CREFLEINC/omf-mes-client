import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState } from 'react';
import { SaveErrorBanner, type MasterWriteResult } from '../../patterns/master';
import { ProductionPlanConfirmDialog } from './confirm-dialog';
import type {
  ProductionPlanCreateContext,
  ProductionPlanDraftErrors,
  ProductionPlanDraftField,
} from './editor-model';
import { prepareProductionPlanRow, type ProductionPlanEditorStateRow } from './editor-state';
import {
  useCreateProductionPlan,
  useDeleteProductionPlan,
  useConfirmProductionPlan,
  useUpdateProductionPlan,
} from './mutations';
import { useProductionPlanDetail } from './queries';
import { ProductionPlanRowErrorSlot } from './row-error-slot';
import type { ProductionPlanFact } from './types';

const t = messages.productionPlan.rowActions;

type WriteFeedback = Pick<MasterWriteResult<unknown>, 'isSaving' | 'fieldErrors' | 'error'>;
interface ProductionPlanRowActionsProps {
  row: ProductionPlanEditorStateRow;
  context: ProductionPlanCreateContext;
  onPending: (key: string, pending: boolean) => void;
  onErrors: (key: string, errors: ProductionPlanDraftErrors) => void;
  onSettle: (key: string, plan: ProductionPlanFact) => void;
  onRemove: (key: string) => void;
  onShowResults?: (productionPlanId: number) => void;
}
const draftFields: readonly ProductionPlanDraftField[] = [
  'planDate',
  'plannedQty',
  'bomId',
  'routingId',
  'plannedLineId',
  'remarks',
];
const serverDraftErrors = (fieldErrors: Record<string, string>): ProductionPlanDraftErrors =>
  Object.fromEntries(
    draftFields.flatMap((field) =>
      fieldErrors[field] === undefined ? [] : [[field, { message: fieldErrors[field] }]],
    ),
  );
const useWriteFeedback = (
  key: string,
  writes: readonly WriteFeedback[],
  onPending: ProductionPlanRowActionsProps['onPending'],
  onErrors: ProductionPlanRowActionsProps['onErrors'],
) => {
  const isSaving = writes.some((write) => write.isSaving);
  const fieldErrors = Object.assign({}, ...writes.map((write) => write.fieldErrors));
  const signature = JSON.stringify(fieldErrors);
  const previousSaving = useRef(isSaving);
  const previousErrors = useRef('');
  useEffect(() => {
    if (previousSaving.current === isSaving) return;
    previousSaving.current = isSaving;
    onPending(key, isSaving);
  }, [isSaving, key, onPending]);
  useEffect(() => {
    if (signature === '{}') {
      previousErrors.current = '';
      return;
    }
    if (previousErrors.current === signature) return;
    previousErrors.current = signature;
    onErrors(key, serverDraftErrors(fieldErrors));
  }, [fieldErrors, key, onErrors, signature]);
  return { isSaving, error: writes.find((write) => write.error !== null)?.error ?? null };
};
const NewPlanActions = (props: ProductionPlanRowActionsProps) => {
  const { row } = props;
  const create = useCreateProductionPlan({
    onSuccess: (plan) => props.onSettle(row.key, plan),
  });
  const feedback = useWriteFeedback(row.key, [create], props.onPending, props.onErrors);
  const save = () => {
    const prepared = prepareProductionPlanRow(row, props.context);
    if (!prepared.ok) {
      props.onErrors(row.key, prepared.errors);
      return;
    }
    props.onErrors(row.key, {});
    if (prepared.command.kind === 'create') create.write(prepared.command.body);
  };
  return (
    <>
      <div className="inline-actions production-plan-row-actions">
        <Button
          size="sm"
          variant="tonal"
          disabled={row.isPending || feedback.isSaving}
          onClick={save}
        >
          {t.save}
        </Button>
        {/* 되돌릴 수 없는 일이라 다른 단추와 구분한다 — 색만 바꾸고 동작은 그대로다. */}
        <Button
          size="sm"
          variant="outlined"
          className="production-plan-remove-action"
          disabled={row.isPending || feedback.isSaving}
          onClick={() => props.onRemove(row.key)}
        >
          {t.remove}
        </Button>
      </div>
      <ProductionPlanRowErrorSlot>
        <SaveErrorBanner error={feedback.error} />
      </ProductionPlanRowErrorSlot>
    </>
  );
};
const ExistingPlanActions = (
  props: ProductionPlanRowActionsProps & { productionPlanId: number },
) => {
  const { row, productionPlanId } = props;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmLatch = useRef(false);
  const detail = useProductionPlanDetail(productionPlanId);
  const update = useUpdateProductionPlan({
    productionPlanId,
    onSuccess: (plan) => props.onSettle(row.key, plan),
  });
  const remove = useDeleteProductionPlan({
    productionPlanId,
    onSuccess: () => props.onRemove(row.key),
  });
  const confirm = useConfirmProductionPlan({
    productionPlanId,
    onSuccess: (plan) => {
      confirmLatch.current = false;
      props.onSettle(row.key, plan);
      setConfirmOpen(false);
      props.onShowResults?.(productionPlanId);
    },
  });
  const feedback = useWriteFeedback(row.key, [update, remove], props.onPending, props.onErrors);
  const locked =
    row.confirmed || row.isPending || feedback.isSaving || confirm.isSaving || !detail.isSuccess;
  useEffect(() => {
    if (!confirm.isSaving) confirmLatch.current = false;
  }, [confirm.error, confirm.isSaving]);
  const resetWrites = () => {
    update.reset();
    remove.reset();
    confirm.reset();
  };
  const reload = () =>
    void detail.refetch().then(({ data, isSuccess }) => {
      if (isSuccess && data !== undefined) {
        resetWrites();
        props.onSettle(row.key, data);
      }
    });
  const save = () => {
    resetWrites();
    const prepared = prepareProductionPlanRow(row, props.context);
    if (!prepared.ok) {
      props.onErrors(row.key, prepared.errors);
      return;
    }
    props.onErrors(row.key, {});
    if (prepared.command.kind === 'update') update.write(prepared.command.body);
  };
  const erase = () => {
    resetWrites();
    remove.write();
  };
  return (
    <>
      <div className="inline-actions production-plan-row-actions">
        {/* 확정된 줄은 고칠 수 없다 — 저장 단추는 내지 않는다(사용자 지시). */}
        {/* 저장할 것이 없으면 단추를 내리지 않는다 — 잠긴 단추를 남겨 두지 않는다(사용자 지시). */}
        {!row.confirmed && row.isDirty && (
          <Button size="sm" variant="tonal" disabled={locked} onClick={save}>
            {t.save}
          </Button>
        )}
        {!row.confirmed && (
          <Button
            size="sm"
            variant="outlined"
            disabled={locked || row.isDirty}
            onClick={() => {
              resetWrites();
              setConfirmOpen(true);
            }}
          >
            {t.confirm}
          </Button>
        )}
        {row.confirmed && props.onShowResults !== undefined && (
          <Button variant="outlined" onClick={() => props.onShowResults?.(productionPlanId)}>
            {t.showResults}
          </Button>
        )}
        {/*
         * 확정된 계획은 서버가 삭제를 거부한다 — 누를 수 없는 단추를 내지 않는다
         * (사용자 지시 2026-09-21). 삭제는 언제나 줄 맨 끝에 선다.
         */}
        {!row.confirmed && (
          <Button
            size="sm"
            variant="outlined"
            className="production-plan-remove-action"
            disabled={locked}
            onClick={erase}
          >
            {t.remove}
          </Button>
        )}
      </div>
      <ProductionPlanRowErrorSlot>
        {detail.isError && (
          <AlertBanner
            variant="error"
            title={t.lockLoadFailed}
            action={
              <Button size="sm" variant="outlined" onClick={() => void detail.refetch()}>
                {t.retry}
              </Button>
            }
          />
        )}
        <SaveErrorBanner error={feedback.error} onReload={reload} />
      </ProductionPlanRowErrorSlot>
      {confirmOpen && (
        <ProductionPlanConfirmDialog
          planNo={row.planNo ?? t.fallbackPlanNo(productionPlanId)}
          banner={<SaveErrorBanner error={confirm.error} onReload={reload} />}
          isSubmitting={confirm.isSaving}
          onClose={() => {
            confirm.reset();
            setConfirmOpen(false);
          }}
          onConfirm={() => {
            if (confirmLatch.current) return;
            confirmLatch.current = true;
            confirm.write();
          }}
        />
      )}
    </>
  );
};
export const ProductionPlanRowActions = (props: ProductionPlanRowActionsProps) =>
  props.row.productionPlanId === null ? (
    <NewPlanActions {...props} />
  ) : (
    <ExistingPlanActions {...props} productionPlanId={props.row.productionPlanId} />
  );
