import type { components } from '@omf-mes/api-client';

import type {
  WorkOrderCloseQuantityClassification,
  WorkOrderCloseReadinessInput,
} from './close-readiness';

export type WorkOrderCloseRemainderDisposition =
  components['schemas']['WorkOrderClose']['remainderDispositionCode'];

export interface WorkOrderCloseInputDraft {
  remainderDisposition: WorkOrderCloseRemainderDisposition | null;
  varianceReasonCode: string;
}

export const EMPTY_WORK_ORDER_CLOSE_INPUT_DRAFT: WorkOrderCloseInputDraft = {
  remainderDisposition: null,
  varianceReasonCode: '',
};

export const setWorkOrderCloseRemainderDisposition = (
  draft: WorkOrderCloseInputDraft,
  value: WorkOrderCloseRemainderDisposition | null,
): WorkOrderCloseInputDraft => ({ ...draft, remainderDisposition: value });

export const setWorkOrderCloseVarianceReasonCode = (
  draft: WorkOrderCloseInputDraft,
  value: string,
): WorkOrderCloseInputDraft => ({ ...draft, varianceReasonCode: value });

export const workOrderCloseReadinessInputFrom = (
  draft: WorkOrderCloseInputDraft,
  classification: WorkOrderCloseQuantityClassification,
  hasOpenSession: boolean,
): WorkOrderCloseReadinessInput => ({
  classification,
  hasOpenSession,
  hasRemainderDisposition: draft.remainderDisposition !== null,
  hasVarianceReason: draft.varianceReasonCode.trim() !== '',
});
