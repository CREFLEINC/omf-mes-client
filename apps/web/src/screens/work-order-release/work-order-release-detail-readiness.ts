import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import type { WorkOrderValidationReport } from '../work-order/queries';
import {
  deriveWorkOrderReleasePreconditions,
  type WorkOrderReleasePreconditions,
} from './release-preconditions';
import type { WorkOrderReleaseFact } from './queries';

type WorkOrderRelease = components['schemas']['WorkOrderRelease'];

const t = messages.workOrderRelease;

export type WorkOrderReleaseDetailState =
  | { kind: 'NOT_SELECTED' }
  | { kind: 'CHECKING' }
  | { kind: 'UNAVAILABLE' }
  | { kind: 'READY'; detail: WorkOrderReleaseFact };

export interface WorkOrderReleaseDetailSnapshot {
  selectedWorkOrderId: number | null;
  isFetching: boolean;
  isError: boolean;
  detail: WorkOrderReleaseFact | undefined;
}

export interface WorkOrderReleaseValidationSnapshot {
  isFetching: boolean;
  isError: boolean;
  report: WorkOrderValidationReport | undefined;
}

export interface WorkOrderReleaseReadiness {
  detail: WorkOrderReleaseFact | null;
  preconditions: WorkOrderReleasePreconditions;
  inputLockedReason: string | null;
  releaseDisabledReason: string | null;
  releaseBody: WorkOrderRelease | null;
}

export const toWorkOrderReleaseDetailState = ({
  selectedWorkOrderId,
  isFetching,
  isError,
  detail,
}: WorkOrderReleaseDetailSnapshot): WorkOrderReleaseDetailState => {
  if (selectedWorkOrderId === null) return { kind: 'NOT_SELECTED' };
  if (isFetching) return { kind: 'CHECKING' };
  if (isError || detail === undefined || detail.workOrderId !== selectedWorkOrderId) {
    return { kind: 'UNAVAILABLE' };
  }
  return { kind: 'READY', detail };
};

const preconditionReason = (preconditions: WorkOrderReleasePreconditions): string | null => {
  switch (preconditions.blockReason) {
    case 'alreadyReleased':
      return t.status.alreadyReleased;
    case 'validationBlocked':
      return t.status.validationBlocked;
    case 'validationUnavailable':
      return t.status.validationUnavailable;
    default:
      return preconditions.passesStaticGate ? null : t.status.validationUnavailable;
  }
};

export const toWorkOrderReleaseReadiness = (
  detailState: WorkOrderReleaseDetailState,
  validation: WorkOrderReleaseValidationSnapshot,
  body: WorkOrderRelease | null,
): WorkOrderReleaseReadiness => {
  if (detailState.kind !== 'READY') {
    const reason =
      detailState.kind === 'CHECKING'
        ? t.readiness.detailLoading
        : detailState.kind === 'UNAVAILABLE'
          ? t.readiness.detailUnavailable
          : null;
    return {
      detail: null,
      preconditions: deriveWorkOrderReleasePreconditions(null, undefined),
      inputLockedReason: reason,
      releaseDisabledReason: reason,
      releaseBody: null,
    };
  }

  const report = validation.isFetching || validation.isError ? undefined : validation.report;
  const preconditions = deriveWorkOrderReleasePreconditions(detailState.detail, report);
  const staticReason = preconditionReason(preconditions);
  const releaseDisabledReason = staticReason ?? (body === null ? t.readiness.inputRequired : null);

  return {
    detail: detailState.detail,
    preconditions,
    inputLockedReason: staticReason,
    releaseDisabledReason,
    releaseBody: releaseDisabledReason === null ? body : null,
  };
};
