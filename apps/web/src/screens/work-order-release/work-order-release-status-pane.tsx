import { AlertBanner, Button, EmptyState, type AlertVariant } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useNavigate } from 'react-router';

import { workOrderAssignmentPath } from '../work-order/screen-model';
import type {
  WorkOrderReleaseBlockReason,
  WorkOrderReleasePreconditions,
} from './release-preconditions';

const t = messages.workOrderRelease;

interface StatusPresentation {
  variant: AlertVariant;
  message: string;
}

const toStatusPresentation = (preconditions: WorkOrderReleasePreconditions): StatusPresentation => {
  if (preconditions.passesStaticGate) {
    return preconditions.blockReason === null
      ? { variant: 'success', message: t.status.staticPassed }
      : { variant: 'error', message: t.status.validationUnavailable };
  }

  switch (preconditions.blockReason) {
    case 'alreadyReleased':
      return { variant: 'info', message: t.status.alreadyReleased };
    case 'validationBlocked':
      return { variant: 'error', message: t.status.validationBlocked };
    case 'validationUnavailable':
      return { variant: 'error', message: t.status.validationUnavailable };
    case 'missingDefaultLocations':
      return { variant: 'error', message: t.status.missingDefaultLocations };
    default:
      return { variant: 'error', message: t.status.validationUnavailable };
  }
};

/** 이 차단은 W-02-03 에서 고친다 — 위치는 Material 칸, 검증 차단은 4M 배정이다. */
const FIXED_IN_ASSIGNMENT: readonly WorkOrderReleaseBlockReason[] = [
  'missingDefaultLocations',
  'validationBlocked',
];

export interface WorkOrderReleaseAssignmentTarget {
  productionPlanId: number;
  workOrderId: number;
}

const OpenAssignmentButton = ({ target }: { target: WorkOrderReleaseAssignmentTarget }) => {
  const navigate = useNavigate();
  return (
    <Button
      size="sm"
      variant="outlined"
      onClick={() =>
        void navigate(workOrderAssignmentPath(target.productionPlanId, target.workOrderId))
      }
    >
      {t.status.openAssignment}
    </Button>
  );
};

export interface WorkOrderReleaseStatusPaneProps {
  selectedWorkOrderNo: string | null;
  preconditions: WorkOrderReleasePreconditions;
  /** 고칠 화면으로 보낼 W/O. 상세를 아직 못 받았으면 null — 버튼을 내지 않는다. */
  assignmentTarget?: WorkOrderReleaseAssignmentTarget | null;
}

export const WorkOrderReleaseStatusPane = ({
  selectedWorkOrderNo,
  preconditions,
  assignmentTarget = null,
}: WorkOrderReleaseStatusPaneProps) => {
  if (selectedWorkOrderNo === null || preconditions.blockReason === 'noSelection') {
    return (
      <section className="pane" aria-label={t.pane}>
        <EmptyState
          size="sm"
          title={t.empty.notSelectedTitle}
          description={t.empty.notSelectedDescription}
        />
      </section>
    );
  }

  const status = toStatusPresentation(preconditions);
  const missingLocations = preconditions.missingDefaultLocations
    .map((location) => t.locations[location])
    .join(', ');
  const fixAction =
    assignmentTarget !== null &&
    preconditions.blockReason !== null &&
    FIXED_IN_ASSIGNMENT.includes(preconditions.blockReason) ? (
      <OpenAssignmentButton target={assignmentTarget} />
    ) : undefined;
  const statusBanner = (
    <AlertBanner variant={status.variant} action={fixAction}>
      {status.message}
    </AlertBanner>
  );

  return (
    <section className="pane work-order-release-status-pane" aria-label={t.pane}>
      <h2 className="pane-title">{t.heading(selectedWorkOrderNo)}</h2>
      {missingLocations === '' ? (
        statusBanner
      ) : (
        <>
          <div className="banner-slot">{statusBanner}</div>
          <AlertBanner variant="warning" title={t.locations.missingTitle}>
            {t.locations.missingDescription} {missingLocations}
          </AlertBanner>
        </>
      )}
    </section>
  );
};
