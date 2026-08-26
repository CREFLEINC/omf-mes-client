import { AlertBanner, Button, SkeletonText, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { selectableLookupOptions, type LookupSource } from '../../patterns/lookup-display';
import { SaveErrorBanner } from '../../patterns/master';
import {
  toWorkOrderAssignmentUpdate,
  validateWorkOrderAssignmentDraft,
  workOrderAssignmentDraftFrom,
  type WorkOrderAssignmentDraft,
} from './assignment-model';
import {
  canApplyWorkOrderReload,
  isExactWorkOrderDetail,
  mergeWorkOrderAssignmentFieldErrors,
  toOwnedResourceLookup,
} from './editor-support';
import { useUpdateWorkOrder } from './mutations';
import { useWorkOrderMolds, useWorkOrderWorkers } from './people-tool-queries';
import { useWorkOrderDetail, useWorkOrderValidation, type WorkOrderFact } from './queries';
import {
  useWorkOrderEquipments,
  useWorkOrderProductionLines,
  useWorkOrderShifts,
} from './resource-queries';
import { workOrderDraftEquals, workOrderFieldErrorMessage } from './screen-model';
import { WorkOrderAssignmentActions } from './work-order-assignment-actions';
import { WorkOrderPlanFieldsPane } from './work-order-plan-fields-pane';
import { WorkOrderResourcePane, type WorkOrderResourceOption } from './work-order-resource-pane';
import { WorkOrderValidationPane } from './work-order-validation-pane';

const t = messages.workOrder.editor;
const idOrNull = (value: string): number | null =>
  /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
const options = (lookup: LookupSource, current: string): WorkOrderResourceOption[] =>
  selectableLookupOptions(lookup, current);
const entry = (value: number, code: string, name: string, isActive: boolean) => ({
  value: String(value),
  label: `${code} · ${name}`,
  isActive,
});
const workOrderFactEquals = (left: WorkOrderFact, right: WorkOrderFact): boolean =>
  Object.entries(left).every(([field, value]) => right[field as keyof WorkOrderFact] === value);
export interface WorkOrderAssignmentEditorSessionProps {
  workOrder: WorkOrderFact;
  plantId: number | null;
  priorityText: string;
  blockedReason?: string | null;
  onPriorityChange: (value: string) => void;
  onReload: () => void;
  onSaved?: (saved: WorkOrderFact) => boolean;
}
export const WorkOrderAssignmentEditorSession = ({
  workOrder,
  plantId,
  priorityText,
  blockedReason = null,
  onPriorityChange,
  onReload,
  onSaved,
}: WorkOrderAssignmentEditorSessionProps) => {
  const toast = useToast();
  const seeded = workOrderAssignmentDraftFrom(workOrder);
  const [baseline, setBaseline] = useState(seeded);
  const [draft, setDraft] = useState(seeded);
  const [writeOwnerMismatch, setWriteOwnerMismatch] = useState(false);
  const effectiveDraft = { ...draft, priorityNo: priorityText };
  const validation = validateWorkOrderAssignmentDraft(effectiveDraft);
  const lineId = idOrNull(effectiveDraft.productionLineId);
  const lines = useWorkOrderProductionLines(plantId, 1);
  const equipments = useWorkOrderEquipments(plantId, lineId, 1);
  const workers = useWorkOrderWorkers(plantId, 1);
  const molds = useWorkOrderMolds(plantId, 1);
  const shifts = useWorkOrderShifts(plantId, 1);
  const validationQuery = useWorkOrderValidation(workOrder.workOrderId);
  const update = useUpdateWorkOrder({
    workOrderId: workOrder.workOrderId,
    onSuccess: (saved) => {
      if (!isExactWorkOrderDetail(workOrder.workOrderId, saved)) {
        setWriteOwnerMismatch(true);
        return;
      }
      if (onSaved?.(saved) === false) return;
      setWriteOwnerMismatch(false);
      const next = workOrderAssignmentDraftFrom(saved);
      setBaseline(next);
      setDraft(next);
      onPriorityChange(next.priorityNo);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });
  const patch = (next: Partial<WorkOrderAssignmentDraft>): void => {
    if (next.priorityNo !== undefined) onPriorityChange(next.priorityNo);
    setDraft((current) => ({
      ...current,
      ...next,
      ...(next.productionLineId === undefined || next.productionLineId === current.productionLineId
        ? {}
        : { plannedEquipmentId: '' }),
    }));
    setWriteOwnerMismatch(false);
    update.reset();
  };
  const lookupNote = (lookup: LookupSource, truncated: boolean | undefined): string | undefined =>
    plantId === null
      ? t.lookup.noPlant
      : lookup.isError
        ? t.lookup.failed
        : lookup.isLoading
          ? t.lookup.loading
          : truncated
            ? t.lookup.truncated
            : undefined;
  const lineSource = toOwnedResourceLookup(
    { items: lines.data?.items ?? [], plantId, isPending: lines.isPending, isError: lines.isError },
    (item) => entry(item.productionLineId, item.lineCode, item.lineName, item.isActive),
  );
  const equipmentSource = toOwnedResourceLookup(
    {
      items: equipments.data?.items ?? [],
      plantId,
      isPending: equipments.isPending,
      isError: equipments.isError,
    },
    (item) => entry(item.equipmentId, item.equipmentCode, item.equipmentName, item.isActive),
  );
  const workerSource = toOwnedResourceLookup(
    {
      items: workers.data?.items ?? [],
      plantId,
      isPending: workers.isPending,
      isError: workers.isError,
    },
    (item) => entry(item.workerId, item.workerNo, item.workerName, item.isActive),
  );
  const moldSource = toOwnedResourceLookup(
    { items: molds.data?.items ?? [], plantId, isPending: molds.isPending, isError: molds.isError },
    (item) => entry(item.moldId, item.moldCode, item.moldName, item.isActive),
  );
  const shiftSource = toOwnedResourceLookup(
    {
      items: shifts.data?.items ?? [],
      plantId,
      isPending: shifts.isPending,
      isError: shifts.isError,
    },
    (item) =>
      entry(
        item.shiftId,
        item.shiftCode,
        `${item.shiftName} (${item.startTime}–${item.endTime})`,
        item.isActive,
      ),
  );
  const fieldErrors = mergeWorkOrderAssignmentFieldErrors(
    Object.fromEntries(
      Object.entries(validation.fieldErrors).map(([field, error]) => [
        field,
        workOrderFieldErrorMessage(error),
      ]),
    ),
    update.fieldErrors,
  );
  const lockReason = update.isSaving
    ? messages.workOrder.assignmentActions.reasons.saving
    : blockedReason;
  const validationError: ReactNode = validationQuery.isError ? (
    <AlertBanner variant="error">{t.validationFailed}</AlertBanner>
  ) : null;

  return (
    <>
      <SaveErrorBanner error={update.error} onReload={onReload} />
      {writeOwnerMismatch && <AlertBanner variant="error">{t.writeOwnerMismatch}</AlertBanner>}
      <WorkOrderResourcePane
        selectedWorkOrderNo={workOrder.workOrderNo}
        draft={effectiveDraft}
        productionLineOptions={options(lineSource, effectiveDraft.productionLineId)}
        plannedEquipmentOptions={options(equipmentSource, effectiveDraft.plannedEquipmentId)}
        responsibleWorkerOptions={options(workerSource, effectiveDraft.responsibleWorkerId)}
        plannedMoldOptions={options(moldSource, effectiveDraft.plannedMoldId)}
        plannedShiftOptions={options(shiftSource, effectiveDraft.plannedShiftId)}
        fieldErrors={fieldErrors}
        fieldNotes={{
          productionLineId: lookupNote(lineSource, lines.data?.truncated),
          plannedEquipmentId: lookupNote(equipmentSource, equipments.data?.truncated),
          responsibleWorkerId: lookupNote(workerSource, workers.data?.truncated),
          plannedMoldId: lookupNote(moldSource, molds.data?.truncated),
          plannedShiftId: lookupNote(shiftSource, shifts.data?.truncated),
        }}
        disabled={lockReason !== null}
        disabledReason={lockReason ?? undefined}
        onChange={patch}
      />
      <WorkOrderPlanFieldsPane
        selectedWorkOrderNo={workOrder.workOrderNo}
        draft={effectiveDraft}
        fieldErrors={fieldErrors}
        disabled={lockReason !== null}
        disabledReason={lockReason ?? undefined}
        onChange={patch}
      />
      <WorkOrderValidationPane
        selectedWorkOrderNo={workOrder.workOrderNo}
        report={validationQuery.data}
        isInitialLoading={validationQuery.isPending && validationQuery.data === undefined}
        isRefreshing={validationQuery.isFetching && validationQuery.data !== undefined}
        loadError={validationError}
      />
      <WorkOrderAssignmentActions
        draft={effectiveDraft}
        isDirty={!workOrderDraftEquals(baseline, effectiveDraft)}
        isSaving={update.isSaving}
        blockedReason={blockedReason}
        onValidate={() => void validationQuery.refetch()}
        onReset={() => {
          setDraft(baseline);
          onPriorityChange(baseline.priorityNo);
          setWriteOwnerMismatch(false);
          update.reset();
        }}
        onSave={() => {
          const body = toWorkOrderAssignmentUpdate(effectiveDraft, new Date());
          if (body !== null) update.write(body);
        }}
      />
    </>
  );
};

export interface WorkOrderAssignmentEditorProps {
  workOrderId: number;
  plantId: number | null;
  priorityText: string;
  onPriorityChange: (value: string) => void;
}

const WorkOrderAssignmentEditorOwner = (props: WorkOrderAssignmentEditorProps) => {
  const detail = useWorkOrderDetail(props.workOrderId);
  const [reloadKey, setReloadKey] = useState(0);
  const acceptedDetailRef = useRef<WorkOrderFact | undefined>(undefined);
  const supersededDetailRef = useRef<{ detail: WorkOrderFact; dataUpdatedAt: number } | undefined>(
    undefined,
  );
  const activeRef = useRef(true);
  const exactDetail = isExactWorkOrderDetail(props.workOrderId, detail.data)
    ? detail.data
    : undefined;
  if (acceptedDetailRef.current === undefined && exactDetail !== undefined) {
    acceptedDetailRef.current = exactDetail;
  }
  let acceptedDetail = acceptedDetailRef.current;
  if (
    acceptedDetail !== undefined &&
    exactDetail !== undefined &&
    exactDetail !== acceptedDetail &&
    workOrderFactEquals(acceptedDetail, exactDetail)
  ) {
    acceptedDetailRef.current = exactDetail;
    supersededDetailRef.current = undefined;
    acceptedDetail = exactDetail;
  }
  const ownerMismatch = detail.data !== undefined && exactDetail === undefined;
  const isSupersededSnapshot =
    exactDetail !== undefined &&
    exactDetail === supersededDetailRef.current?.detail &&
    detail.dataUpdatedAt === supersededDetailRef.current.dataUpdatedAt;
  const hasNewerDetail =
    exactDetail !== undefined && exactDetail !== acceptedDetail && !isSupersededSnapshot;
  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);
  const applyDetail = (next: WorkOrderFact): void => {
    supersededDetailRef.current = undefined;
    acceptedDetailRef.current = next;
    props.onPriorityChange(String(next.priorityNo));
    setReloadKey((value) => value + 1);
  };
  const retry = (
    <Button size="sm" variant="outlined" onClick={() => void detail.refetch()}>
      {messages.common.retry}
    </Button>
  );

  if (detail.isPending && acceptedDetail === undefined) {
    return (
      <div role="status" aria-label={t.loading}>
        <SkeletonText lines={5} />
      </div>
    );
  }
  if (acceptedDetail === undefined) {
    return (
      <AlertBanner
        variant="error"
        title={ownerMismatch ? t.ownerMismatch : t.failed}
        action={retry}
      />
    );
  }
  const refreshIssue = ownerMismatch
    ? { title: t.ownerMismatch, description: t.staleDescription, action: retry }
    : detail.isError
      ? { title: t.staleTitle, description: t.staleDescription, action: retry }
      : hasNewerDetail
        ? {
            title: t.changedTitle,
            description: t.changedDescription,
            action: (
              <Button
                size="sm"
                variant="outlined"
                onClick={() => {
                  if (exactDetail !== undefined) applyDetail(exactDetail);
                }}
              >
                {messages.conflict.reloadAction}
              </Button>
            ),
          }
        : null;

  return (
    <>
      {refreshIssue !== null && (
        <AlertBanner variant="error" title={refreshIssue.title} action={refreshIssue.action}>
          {refreshIssue.description}
        </AlertBanner>
      )}
      <WorkOrderAssignmentEditorSession
        key={`${String(props.workOrderId)}:${String(reloadKey)}`}
        {...props}
        workOrder={acceptedDetail}
        blockedReason={
          refreshIssue === null ? null : hasNewerDetail ? t.changedBlocked : t.staleBlocked
        }
        onSaved={(saved) => {
          if (!activeRef.current) return false;
          const supersededDetail = exactDetail ?? acceptedDetailRef.current;
          supersededDetailRef.current =
            supersededDetail === undefined
              ? undefined
              : { detail: supersededDetail, dataUpdatedAt: detail.dataUpdatedAt };
          acceptedDetailRef.current = saved;
          return true;
        }}
        onReload={() =>
          void detail.refetch().then((result) => {
            if (
              activeRef.current &&
              canApplyWorkOrderReload(props.workOrderId, result) &&
              result.data !== undefined
            ) {
              applyDetail(result.data);
            }
          })
        }
      />
    </>
  );
};

export const WorkOrderAssignmentEditor = (props: WorkOrderAssignmentEditorProps) => (
  <WorkOrderAssignmentEditorOwner key={String(props.workOrderId)} {...props} />
);
