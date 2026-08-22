import { AlertBanner, EmptyState, type AlertVariant } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { WorkOrderReleasePreconditions } from './release-preconditions';

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
    default:
      return { variant: 'error', message: t.status.validationUnavailable };
  }
};

export interface WorkOrderReleaseStatusPaneProps {
  selectedWorkOrderNo: string | null;
  preconditions: WorkOrderReleasePreconditions;
}

export const WorkOrderReleaseStatusPane = ({
  selectedWorkOrderNo,
  preconditions,
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
  const statusBanner = <AlertBanner variant={status.variant}>{status.message}</AlertBanner>;

  return (
    <section className="pane" aria-label={t.pane}>
      <h2>{t.heading(selectedWorkOrderNo)}</h2>
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
