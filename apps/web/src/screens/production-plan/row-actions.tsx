import { AlertBanner, Button } from '@crefle/web-ui';
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
import type { ProductionPlanFact } from './types';
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
      <div className="inline-actions">
        <Button size="sm" disabled={row.isPending || feedback.isSaving} onClick={save}>
          저장
        </Button>
        <Button
          size="sm"
          variant="text"
          disabled={row.isPending || feedback.isSaving}
          onClick={() => props.onRemove(row.key)}
        >
          삭제
        </Button>
      </div>
      <SaveErrorBanner error={feedback.error} />
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
      <div className="inline-actions">
        <Button size="sm" disabled={locked || !row.isDirty} onClick={save}>
          저장
        </Button>
        <Button size="sm" variant="text" disabled={locked} onClick={erase}>
          삭제
        </Button>
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
            전개 확정
          </Button>
        )}
        {row.confirmed && props.onShowResults !== undefined && (
          <Button
            size="sm"
            variant="outlined"
            onClick={() => props.onShowResults?.(productionPlanId)}
          >
            전개 결과
          </Button>
        )}
      </div>
      {detail.isError && (
        <AlertBanner
          variant="error"
          title="저장 잠금 정보를 불러오지 못했습니다."
          action={
            <Button size="sm" variant="outlined" onClick={() => void detail.refetch()}>
              다시 시도
            </Button>
          }
        />
      )}
      <SaveErrorBanner error={feedback.error} onReload={reload} />
      {confirmOpen && (
        <ProductionPlanConfirmDialog
          planNo={row.planNo ?? `계획 ${String(productionPlanId)}`}
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
