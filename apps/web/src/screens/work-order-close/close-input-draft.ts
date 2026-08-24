import type { components } from '@omf-mes/api-client';

import type {
  WorkOrderCloseCompletionJudgment,
  WorkOrderCloseReadinessInput,
} from './close-readiness';

export type WorkOrderCloseRemainderDisposition = NonNullable<
  components['schemas']['WorkOrderClose']['remainderDispositionCode']
>;

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
  completionJudgment: WorkOrderCloseCompletionJudgment,
  hasOpenSession: boolean,
): WorkOrderCloseReadinessInput => ({
  completionJudgment,
  hasOpenSession,
  hasRemainderDisposition: draft.remainderDisposition !== null,
  hasVarianceReason: draft.varianceReasonCode.trim() !== '',
});
