import { AlertBanner, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { JSX, ReactNode } from 'react';

import type { WorkOrderCloseBlocker } from './close-readiness';

export type WorkOrderCloseStatusPaneState =
  | { kind: 'CHECKING' }
  | { kind: 'UNAVAILABLE'; content: ReactNode }
  | { kind: 'RESOLVED'; blockers: readonly WorkOrderCloseBlocker[] };

export interface WorkOrderCloseStatusPaneProps {
  state: WorkOrderCloseStatusPaneState;
}

export const WorkOrderCloseStatusPane = ({ state }: WorkOrderCloseStatusPaneProps): JSX.Element => {
  const t = messages.workOrderClose.status;

  return (
    <section aria-label={t.pane} className="pane work-order-close-status-pane">
      <h2 className="pane-title">{t.heading}</h2>
      {state.kind === 'CHECKING' ? (
        <div aria-label={t.loading} role="status">
          <SkeletonText lines={3} />
        </div>
      ) : null}
      {state.kind === 'UNAVAILABLE' ? state.content : null}
      {state.kind === 'RESOLVED' && state.blockers.length === 0 ? (
        <p aria-live="polite" role="status">
          {t.complete}
        </p>
      ) : null}
      {state.kind === 'RESOLVED' && state.blockers.length > 0 ? (
        <AlertBanner variant="warning">
          <ol>
            {state.blockers.map((blocker) => (
              <li key={blocker}>{t.blockers[blocker]}</li>
            ))}
          </ol>
        </AlertBanner>
      ) : null}
    </section>
  );
};
