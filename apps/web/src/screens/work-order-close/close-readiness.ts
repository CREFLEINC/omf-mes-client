export type WorkOrderCloseQuantityClassification = 'SHORTFALL' | 'EXACT' | 'OVERAGE';

export interface WorkOrderCloseInputRequirements {
  requiresRemainderDisposition: boolean;
  requiresVarianceReason: boolean;
}

export type WorkOrderCloseBlocker =
  'OPEN_SESSION' | 'REMAINDER_DISPOSITION_REQUIRED' | 'VARIANCE_REASON_REQUIRED';

export interface WorkOrderCloseReadinessInput {
  classification: WorkOrderCloseQuantityClassification;
  hasOpenSession: boolean;
  hasRemainderDisposition: boolean;
  hasVarianceReason: boolean;
}

export const classifyWorkOrderCloseQuantity = (
  orderQty: number,
  goodQty: number,
): WorkOrderCloseQuantityClassification =>
  goodQty < orderQty ? 'SHORTFALL' : goodQty === orderQty ? 'EXACT' : 'OVERAGE';

export const workOrderCloseInputRequirements = (
  classification: WorkOrderCloseQuantityClassification,
): WorkOrderCloseInputRequirements => {
  switch (classification) {
    case 'SHORTFALL':
      return { requiresRemainderDisposition: true, requiresVarianceReason: true };
    case 'OVERAGE':
      return { requiresRemainderDisposition: false, requiresVarianceReason: true };
    case 'EXACT':
      return { requiresRemainderDisposition: false, requiresVarianceReason: false };
  }
};

export const workOrderCloseBlockers = (
  input: WorkOrderCloseReadinessInput,
): WorkOrderCloseBlocker[] => {
  const requirements = workOrderCloseInputRequirements(input.classification);
  const blockers: WorkOrderCloseBlocker[] = [];

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
