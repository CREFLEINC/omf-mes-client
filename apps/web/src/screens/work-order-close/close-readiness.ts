import type { components } from '@omf-mes/api-client';

export type WorkOrderCloseCompletionJudgment =
  components['schemas']['WorkOrderProgress']['completionJudgmentCode'];

export interface WorkOrderCloseInputRequirements {
  requiresRemainderDisposition: boolean;
  requiresVarianceReason: boolean;
}

export type WorkOrderCloseBlocker =
  | 'STATUS_NOT_CLOSABLE'
  | 'OPEN_SESSION'
  | 'REMAINDER_DISPOSITION_REQUIRED'
  | 'VARIANCE_REASON_REQUIRED';

/** 서버의 마감 전이가 받는 출발 상태. 다른 상태는 400 STATE_LOCKED 로 거부된다. */
export const CLOSABLE_WORK_ORDER_STATUSES: readonly string[] = ['IN_PROGRESS', 'COMPLETED'];

export interface WorkOrderCloseReadinessInput {
  completionJudgment: WorkOrderCloseCompletionJudgment;
  isClosableStatus: boolean;
  hasOpenSession: boolean;
  hasRemainderDisposition: boolean;
  hasVarianceReason: boolean;
}

export const workOrderCloseInputRequirements = (
  completionJudgment: WorkOrderCloseCompletionJudgment,
): WorkOrderCloseInputRequirements => {
  switch (completionJudgment) {
    case 'UNDER':
      return { requiresRemainderDisposition: true, requiresVarianceReason: true };
    case 'OVER':
      return { requiresRemainderDisposition: false, requiresVarianceReason: true };
    case 'NORMAL':
      return { requiresRemainderDisposition: false, requiresVarianceReason: false };
  }
};

export const workOrderCloseBlockers = (
  input: WorkOrderCloseReadinessInput,
): WorkOrderCloseBlocker[] => {
  const requirements = workOrderCloseInputRequirements(input.completionJudgment);
  const blockers: WorkOrderCloseBlocker[] = [];

  if (!input.isClosableStatus) blockers.push('STATUS_NOT_CLOSABLE');
  if (input.hasOpenSession) blockers.push('OPEN_SESSION');
  if (requirements.requiresRemainderDisposition && !input.hasRemainderDisposition) {
    blockers.push('REMAINDER_DISPOSITION_REQUIRED');
  }
  if (requirements.requiresVarianceReason && !input.hasVarianceReason) {
    blockers.push('VARIANCE_REASON_REQUIRED');
  }

  return blockers;
};

export const isWorkOrderCloseReady = (input: WorkOrderCloseReadinessInput): boolean =>
  workOrderCloseBlockers(input).length === 0;
