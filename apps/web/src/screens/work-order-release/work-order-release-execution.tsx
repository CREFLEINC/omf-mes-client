import { AlertBanner, Button, useToast } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import {
  describeReference,
  resolveReference,
  useUomReferenceLookup,
} from '../production-order/reference-lookups';
import { useWorkOrderValidation } from '../work-order/queries';
import { WorkOrderValidationPane } from '../work-order/work-order-validation-pane';
import { SaveErrorBanner } from '../../patterns/master';
import { useReleaseWorkOrder } from './mutations';
import { useWorkOrderReleaseDetail } from './queries';
import { useWorkOrderReleaseSummary } from './use-work-order-release-summary';
import { WorkOrderReleaseActions } from './work-order-release-actions';
import {
  toWorkOrderReleaseDetailState,
  toWorkOrderReleaseReadiness,
} from './work-order-release-detail-readiness';
import { WorkOrderReleaseInputPane } from './work-order-release-input-pane';
import { WorkOrderReleaseStatusPane } from './work-order-release-status-pane';
import { WorkOrderReleaseSummaryPane } from './work-order-release-summary-pane';

type WorkOrderRelease = components['schemas']['WorkOrderRelease'];

const t = messages.workOrderRelease;

const retryBanner = (label: string, onRetry: () => void): ReactNode => (
  <AlertBanner
    variant="error"
    title={messages.httpError.loadTitle}
    action={
      <Button size="sm" variant="outlined" onClick={onRetry}>
        {label}
      </Button>
    }
  >
    {messages.httpError.description}
  </AlertBanner>
);

interface SelectedWorkOrderReleaseExecutionProps {
  workOrderId: number;
  onClearSelection: () => void;
}

const SelectedWorkOrderReleaseExecution = ({
  workOrderId,
  onClearSelection,
}: SelectedWorkOrderReleaseExecutionProps) => {
  const toast = useToast();
  const [body, setBody] = useState<WorkOrderRelease | null>(null);
  const [writeOwnerMismatch, setWriteOwnerMismatch] = useState(false);
  const submitting = useRef(false);
  const detail = useWorkOrderReleaseDetail(workOrderId);
  const validation = useWorkOrderValidation(workOrderId);
  const detailState = toWorkOrderReleaseDetailState({
    selectedWorkOrderId: workOrderId,
    isFetching: detail.isFetching,
    isError: detail.isError,
    detail: detail.data,
  });
  const readiness = toWorkOrderReleaseReadiness(
    detailState,
    {
      isFetching: validation.isFetching,
      isError: validation.isError,
      report: validation.data,
    },
    body,
  );
  const ownedDetail = detail.data?.workOrderId === workOrderId ? detail.data : readiness.detail;
  const summary = useWorkOrderReleaseSummary(readiness.detail);
  const uoms = useUomReferenceLookup();
  const uomLabel =
    ownedDetail === null ? null : describeReference(resolveReference(uoms, ownedDetail.uomId));
  const release = useReleaseWorkOrder({
    workOrderId,
    onSuccess: (saved) => {
      submitting.current = false;
      if (saved.workOrderId !== workOrderId) {
        setWriteOwnerMismatch(true);
        return;
      }
      toast.show({ variant: 'success', description: t.execution.released });
    },
  });
  useEffect(() => {
    if (!release.isSaving) submitting.current = false;
  }, [release.error, release.fieldErrors, release.isSaving]);
  const reload = async (): Promise<void> => {
    release.reset();
    const refreshed = await detail.refetch();
    if (refreshed.isSuccess && refreshed.data.workOrderId === workOrderId) {
      setWriteOwnerMismatch(false);
    }
    void validation.refetch();
  };
  const validationError = validation.isError
    ? retryBanner(t.execution.retryValidation, () => void validation.refetch())
    : null;
  const mismatchReason = writeOwnerMismatch ? t.execution.writeOwnerMismatch : null;
  const lockedReason = release.isSaving
    ? t.actions.reasons.submitting(t.input.heading)
    : (mismatchReason ?? readiness.inputLockedReason);

  return (
    <>
      {detailState.kind === 'UNAVAILABLE' && (
        <div className="banner-slot">
          {retryBanner(t.execution.retryDetail, () => void detail.refetch())}
        </div>
      )}
      <WorkOrderReleaseSummaryPane view={summary} />
      <WorkOrderReleaseStatusPane
        selectedWorkOrderNo={ownedDetail?.workOrderNo ?? null}
        preconditions={readiness.preconditions}
      />
      <WorkOrderValidationPane
        selectedWorkOrderNo={ownedDetail?.workOrderNo ?? null}
        report={validation.data}
        isInitialLoading={validation.isPending && validation.data === undefined}
        isRefreshing={validation.isFetching && validation.data !== undefined}
        loadError={validationError}
      />
      <WorkOrderReleaseInputPane
        ownerKey={ownedDetail?.workOrderId ?? null}
        orderQty={ownedDetail?.orderQty ?? null}
        uomLabel={uomLabel}
        lockedReason={lockedReason}
        fieldErrors={release.fieldErrors}
        onClearFieldError={release.clearFieldError}
        onBodyChange={setBody}
      />
      <SaveErrorBanner error={release.error} onReload={() => void reload()} />
      {writeOwnerMismatch && (
        <AlertBanner
          variant="error"
          action={
            <Button size="sm" variant="outlined" onClick={() => void reload()}>
              {t.execution.reloadDetail}
            </Button>
          }
        >
          {t.execution.writeOwnerMismatch}
        </AlertBanner>
      )}
      <WorkOrderReleaseActions
        hasSelection
        isSubmitting={release.isSaving}
        releaseDisabledReason={mismatchReason ?? readiness.releaseDisabledReason}
        onCancel={onClearSelection}
        onRelease={() => {
          if (readiness.releaseBody === null || release.isSaving || submitting.current) return;
          submitting.current = true;
          release.write(readiness.releaseBody);
        }}
      />
    </>
  );
};

export interface WorkOrderReleaseExecutionProps {
  selectedWorkOrderId: number | null;
  onClearSelection: () => void;
}

export const WorkOrderReleaseExecution = ({
  selectedWorkOrderId,
  onClearSelection,
}: WorkOrderReleaseExecutionProps) =>
  selectedWorkOrderId === null ? null : (
    <SelectedWorkOrderReleaseExecution
      key={selectedWorkOrderId}
      workOrderId={selectedWorkOrderId}
      onClearSelection={onClearSelection}
    />
  );
