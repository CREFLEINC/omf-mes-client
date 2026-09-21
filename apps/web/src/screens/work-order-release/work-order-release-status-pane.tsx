import { AlertBanner, Button, EmptyState, type AlertVariant } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useNavigate } from 'react-router';

import { workOrderAssignmentPath } from '../work-order/screen-model';
import { isFixedInAssignment, type WorkOrderReleasePreconditions } from './release-preconditions';

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

export interface WorkOrderReleaseAssignmentTarget {
  productionPlanId: number;
  workOrderId: number;
}

const OpenAssignmentButton = ({ target }: { target: WorkOrderReleaseAssignmentTarget }) => {
  const navigate = useNavigate();
  return (
    <Button
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
  /* 위치 누락은 «무엇이» 빠졌는지를 제목으로 먼저 말한다 — 전부 다시 정해야 하는 것처럼 읽히지 않게 */
  const namesMissing =
    preconditions.blockReason === 'missingDefaultLocations' && missingLocations !== '';
  const fixAction =
    assignmentTarget !== null && isFixedInAssignment(preconditions.blockReason) ? (
      <OpenAssignmentButton target={assignmentTarget} />
    ) : undefined;

  return (
    <section className="pane work-order-release-status-pane" aria-label={t.pane}>
      <div className="work-order-release-status-heading">
        <h2 className="pane-title">{t.status.heading}</h2>
        <span className="work-order-release-status-hint">{t.status.headingHint}</span>
      </div>
      <AlertBanner
        className="work-order-release-status-banner"
        variant={status.variant}
        title={namesMissing ? t.locations.missingTitle(missingLocations) : undefined}
        action={fixAction}
      >
        {namesMissing ? t.locations.missingAction : status.message}
      </AlertBanner>
    </section>
  );
};
