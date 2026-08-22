import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import type { WorkOrderPageView } from './pagination';

const t = messages.workOrder.pageNav;

export interface PageNavProps {
  view: WorkOrderPageView;
  onChange: (page: number) => void;
}

export const PageNav = ({ view, onChange }: PageNavProps) => {
  const firstReasonId = useId();
  const previousReasonId = useId();
  const nextReasonId = useId();
  const firstReason = view.canFirst ? null : t.disabled.first;
  const previousReason = view.canPrev ? null : t.disabled.previous;
  const nextReason = view.canNext ? null : t.disabled.next;

  return (
    <nav className="form-actions" aria-label={t.label}>
      <p className="field-note form-actions-secondary">{view.rangeLabel}</p>
      <div className="field-cell">
        <Button
          variant="outlined"
          size="sm"
          disabled={firstReason !== null}
          aria-describedby={firstReason === null ? undefined : firstReasonId}
          onClick={() => {
            onChange(1);
          }}
        >
          {t.first}
        </Button>
        {firstReason !== null && (
          <p id={firstReasonId} className="field-note">
            {firstReason}
          </p>
        )}
      </div>
      <div className="field-cell">
        <Button
          variant="outlined"
          size="sm"
          disabled={previousReason !== null}
          aria-describedby={previousReason === null ? undefined : previousReasonId}
          onClick={() => {
            onChange(view.page - 1);
          }}
        >
          {t.previous}
        </Button>
        {previousReason !== null && (
          <p id={previousReasonId} className="field-note">
            {previousReason}
          </p>
        )}
      </div>
      <div className="field-cell">
        <Button
          variant="outlined"
          size="sm"
          disabled={nextReason !== null}
          aria-describedby={nextReason === null ? undefined : nextReasonId}
          onClick={() => {
            onChange(view.page + 1);
          }}
        >
          {t.next}
        </Button>
        {nextReason !== null && (
          <p id={nextReasonId} className="field-note">
            {nextReason}
          </p>
        )}
      </div>
    </nav>
  );
};
