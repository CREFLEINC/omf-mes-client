import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

const t = messages.workOrderRelease.actions;

interface ReleaseActionProps {
  label: string;
  variant: 'outlined' | 'filled';
  reasonId: string;
  reason: string | null;
  loading?: boolean;
  onClick: () => void;
}

const ReleaseAction = ({
  label,
  variant,
  reasonId,
  reason,
  loading = false,
  onClick,
}: ReleaseActionProps) => (
  <div className="field-cell">
    <Button
      type="button"
      variant={variant}
      disabled={reason !== null}
      loading={loading}
      aria-describedby={reason === null ? undefined : reasonId}
      onClick={onClick}
    >
      {label}
    </Button>
    {reason !== null && (
      <span id={reasonId} className="field-note">
        {reason}
      </span>
    )}
  </div>
);

export interface WorkOrderReleaseActionsProps {
  hasSelection: boolean;
  isSubmitting: boolean;
  releaseDisabledReason: string | null;
  onCancel: () => void;
  onRelease: () => void;
}

export const WorkOrderReleaseActions = ({
  hasSelection,
  isSubmitting,
  releaseDisabledReason,
  onCancel,
  onRelease,
}: WorkOrderReleaseActionsProps) => {
  const cancelReasonId = useId();
  const releaseReasonId = useId();
  const cancelReason = !hasSelection
    ? t.reasons.noSelection(t.cancel)
    : isSubmitting
      ? t.reasons.submitting(t.cancel)
      : null;
  const releaseReason = !hasSelection
    ? t.reasons.noSelection(t.release)
    : isSubmitting
      ? t.reasons.submitting(t.release)
      : releaseDisabledReason === null
        ? null
        : t.reasons.release(releaseDisabledReason);

  return (
    <div className="form-actions" role="group" aria-label={t.label}>
      <ReleaseAction
        label={t.cancel}
        variant="outlined"
        reasonId={cancelReasonId}
        reason={cancelReason}
        onClick={onCancel}
      />
      <ReleaseAction
        label={t.release}
        variant="filled"
        reasonId={releaseReasonId}
        reason={releaseReason}
        loading={isSubmitting}
        onClick={onRelease}
      />
    </div>
  );
};
