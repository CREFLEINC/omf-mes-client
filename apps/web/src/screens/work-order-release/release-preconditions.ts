import type { WorkOrderValidationReport } from '../work-order/queries';
import type { WorkOrderReleaseFact } from './queries';

export const WORK_ORDER_RELEASE_LOCATION_KINDS = ['wip', 'finishedGoods', 'scrap'] as const;

export type WorkOrderReleaseLocationKind = (typeof WORK_ORDER_RELEASE_LOCATION_KINDS)[number];
export type WorkOrderReleaseBlockReason =
  | 'noSelection'
  | 'validationUnavailable'
  | 'validationBlocked'
  | 'missingDefaultLocations'
  | 'alreadyReleased';

/** 이 차단은 W-02-03 에서 고친다 — 위치는 Material 칸, 검증 차단은 4M 배정이다. */
export const isFixedInAssignment = (reason: WorkOrderReleaseBlockReason | null): boolean =>
  reason === 'missingDefaultLocations' || reason === 'validationBlocked';

export interface WorkOrderReleasePreconditions {
  passesStaticGate: boolean;
  blockReason: WorkOrderReleaseBlockReason | null;
  missingDefaultLocations: WorkOrderReleaseLocationKind[];
}

const missingDefaultLocations = (
  workOrder: WorkOrderReleaseFact,
): WorkOrderReleaseLocationKind[] => {
  const missing: WorkOrderReleaseLocationKind[] = [];

  if (workOrder.defaultWipLocationId === null) missing.push('wip');
  if (workOrder.defaultFgLocationId === null) missing.push('finishedGoods');
  if (workOrder.defaultScrapLocationId === null) missing.push('scrap');

  return missing;
};

export const deriveWorkOrderReleasePreconditions = (
  selectedWorkOrder: WorkOrderReleaseFact | null,
  validationReport: WorkOrderValidationReport | undefined,
): WorkOrderReleasePreconditions => {
  if (selectedWorkOrder === null) {
    return { passesStaticGate: false, blockReason: 'noSelection', missingDefaultLocations: [] };
  }

  const missingLocations = missingDefaultLocations(selectedWorkOrder);

  if (selectedWorkOrder.releasedAt !== null) {
    return {
      passesStaticGate: false,
      blockReason: 'alreadyReleased',
      missingDefaultLocations: missingLocations,
    };
  }

  if (validationReport === undefined) {
    return {
      passesStaticGate: false,
      blockReason: 'validationUnavailable',
      missingDefaultLocations: missingLocations,
    };
  }

  if (
    !validationReport.passed ||
    validationReport.findings.some((finding) => finding.severity === 'BLOCK')
  ) {
    return {
      passesStaticGate: false,
      blockReason: 'validationBlocked',
      missingDefaultLocations: missingLocations,
    };
  }

  if (missingLocations.length > 0) {
    return {
      passesStaticGate: false,
      blockReason: 'missingDefaultLocations',
      missingDefaultLocations: missingLocations,
    };
  }

  return { passesStaticGate: true, blockReason: null, missingDefaultLocations: [] };
};
