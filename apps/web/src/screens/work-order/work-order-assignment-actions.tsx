import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import {
  isWorkOrderAssignmentSaveEnabled,
  type WorkOrderAssignmentDraft,
} from './assignment-model';

const t = messages.workOrder.assignmentActions;

export interface WorkOrderAssignmentActionsProps {
  draft: WorkOrderAssignmentDraft;
  isDirty: boolean;
  isSaving: boolean;
  blockedReason?: string | null;
  onValidate: () => void;
  onReset: () => void;
  onSave: () => void;
}

interface AssignmentActionProps {
  label: string;
  variant: 'outlined' | 'filled';
  reason: string | null;
  loading?: boolean;
  onClick: () => void;
}

const AssignmentAction = ({
  label,
  variant,
  reason,
  loading = false,
  onClick,
}: AssignmentActionProps) => {
  const reasonId = useId();

  return (
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
};

export const WorkOrderAssignmentActions = ({
  draft,
  isDirty,
  isSaving,
  blockedReason = null,
  onValidate,
  onReset,
  onSave,
}: WorkOrderAssignmentActionsProps) => {
  const validateReason = isSaving ? t.reasons.saving : blockedReason;
  const resetReason = isSaving
    ? t.reasons.saving
    : (blockedReason ?? (isDirty ? null : t.reasons.noChanges));
  const saveReason = isSaving
    ? t.reasons.saving
    : (blockedReason ??
      (!isDirty
        ? t.reasons.noChanges
        : isWorkOrderAssignmentSaveEnabled(draft)
          ? null
          : t.reasons.invalidDraft));

  return (
    <div className="form-actions">
      <AssignmentAction
        label={t.actions.validate}
        variant="outlined"
        reason={validateReason}
        onClick={onValidate}
      />
      <AssignmentAction
        label={t.actions.reset}
        variant="outlined"
        reason={resetReason}
        onClick={onReset}
      />
      <AssignmentAction
        label={t.actions.save}
        variant="filled"
        reason={saveReason}
        loading={isSaving}
        onClick={onSave}
      />
    </div>
  );
};
