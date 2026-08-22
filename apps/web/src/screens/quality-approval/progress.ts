import type { StepStatus } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { formatDateTime, type ApprovalRequestDetail, type ApprovalStep } from './types';

export const REJECTION_DECISION_CODES: readonly string[] = [];

export interface ApprovalStepView {
  stepNo: number;
  status: StepStatus;
  approverName: string;
  decisionCode: string | null;
  decisionAtText: string | null;
  decisionComment: string | null;
  isCurrent: boolean;
  isMine: boolean;
}

export interface ApprovalProgressView {
  currentStepNo: number | null;
  totalStepNo: number;
  isMyTurn: boolean;
  steps: ApprovalStepView[];
}

const filled = (value: string | null | undefined): string | null =>
  value === undefined || value === null || value === '' ? null : value;

const stepStatus = (step: ApprovalStep, rejectionCodes: readonly string[]): StepStatus => {
  const decisionCode = filled(step.decisionCode);
  if (decisionCode === null) return step.isCurrent ? 'current' : 'pending';

  return rejectionCodes.includes(decisionCode) ? 'rejected' : 'complete';
};

const toStepView = (step: ApprovalStep, rejectionCodes: readonly string[]): ApprovalStepView => {
  const decisionAt = filled(step.decisionAt);

  return {
    stepNo: step.stepNo,
    status: stepStatus(step, rejectionCodes),
    approverName:
      step.approverName.trim() === ''
        ? messages.qualityApproval.values.unknownApprover
        : step.approverName,
    decisionCode: filled(step.decisionCode),
    decisionAtText: decisionAt === null ? null : formatDateTime(decisionAt),
    decisionComment: filled(step.decisionComment),
    isCurrent: step.isCurrent,
    isMine: step.isMine,
  };
};

export const toApprovalProgressView = (
  detail: ApprovalRequestDetail,
  rejectionCodes: readonly string[] = REJECTION_DECISION_CODES,
): ApprovalProgressView => ({
  currentStepNo: detail.request.currentStepNo,
  totalStepNo: detail.request.totalStepNo,
  isMyTurn: detail.request.isMyTurn,
  steps: detail.steps.map((step) => toStepView(step, rejectionCodes)),
});
