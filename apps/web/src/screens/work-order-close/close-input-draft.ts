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
  /** 소멸을 골랐을 때의 이유 — 계약 `remarks`. 소멸이 아니면 보내지 않는다. */
  remarks: string;
}

export const EMPTY_WORK_ORDER_CLOSE_INPUT_DRAFT: WorkOrderCloseInputDraft = {
  remainderDisposition: null,
  varianceReasonCode: '',
  remarks: '',
};

export const setWorkOrderCloseRemainderDisposition = (
  draft: WorkOrderCloseInputDraft,
  value: WorkOrderCloseRemainderDisposition | null,
): WorkOrderCloseInputDraft => ({ ...draft, remainderDisposition: value });

export const setWorkOrderCloseVarianceReasonCode = (
  draft: WorkOrderCloseInputDraft,
  value: string,
): WorkOrderCloseInputDraft => ({ ...draft, varianceReasonCode: value });

export const setWorkOrderCloseRemarks = (
  draft: WorkOrderCloseInputDraft,
  value: string,
): WorkOrderCloseInputDraft => ({ ...draft, remarks: value });

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
