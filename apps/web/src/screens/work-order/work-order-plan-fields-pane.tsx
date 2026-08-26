import { AlertBanner, Card, EmptyState, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { WorkOrderAssignmentDraft } from './assignment-model';

const t = messages.workOrder.planFieldsPane;

const PLAN_FIELDS = ['plannedStartAtLocal', 'plannedEndAtLocal', 'priorityNo'] as const;

type PlanField = (typeof PLAN_FIELDS)[number];

export interface WorkOrderPlanFieldsPaneProps {
  selectedWorkOrderNo: string | null;
  draft: WorkOrderAssignmentDraft;
  fieldErrors: Partial<Record<PlanField, string>>;
  disabled?: boolean;
  disabledReason?: string;
  onChange: (patch: Partial<Pick<WorkOrderAssignmentDraft, PlanField>>) => void;
}

interface PlanFieldInputProps {
  field: PlanField;
  label: string;
  type: 'datetime-local' | 'text';
  value: string;
  error: string | undefined;
  inputMode?: 'numeric';
  disabled: boolean;
  disabledReason: string | undefined;
  onChange: WorkOrderPlanFieldsPaneProps['onChange'];
}

const PlanFieldInput = ({
  field,
  label,
  type,
  value,
  error,
  inputMode,
  disabled,
  disabledReason,
  onChange,
}: PlanFieldInputProps) => (
  <TextField
    label={label}
    type={type}
    value={value}
    inputMode={inputMode}
    error={error}
    disabled={disabled}
    disabledReason={disabledReason}
    fullWidth
    onChange={(event) => {
      onChange({ [field]: event.target.value });
    }}
  />
);

export const WorkOrderPlanFieldsPane = ({
  selectedWorkOrderNo,
  draft,
  fieldErrors,
  disabled = false,
  disabledReason,
  onChange,
}: WorkOrderPlanFieldsPaneProps) => {
  if (selectedWorkOrderNo === null) {
    return (
      <EmptyState
        size="sm"
        title={t.empty.notSelectedTitle}
        description={t.empty.notSelectedDescription}
      />
    );
  }

  return (
    <section className="pane" aria-label={t.pane}>
      <h2>{t.heading(selectedWorkOrderNo)}</h2>
      <AlertBanner variant="warning">{t.warning}</AlertBanner>
      <Card bordered>
        <Card.Header>
          <h3>{t.card}</h3>
        </Card.Header>
        <Card.Body>
          <PlanFieldInput
            field="plannedStartAtLocal"
            label={t.fields.plannedStartAtLocal}
            type="datetime-local"
            value={draft.plannedStartAtLocal}
            error={fieldErrors.plannedStartAtLocal}
            disabled={disabled}
            disabledReason={disabledReason}
            onChange={onChange}
          />
          <PlanFieldInput
            field="plannedEndAtLocal"
            label={t.fields.plannedEndAtLocal}
            type="datetime-local"
            value={draft.plannedEndAtLocal}
            error={fieldErrors.plannedEndAtLocal}
            disabled={disabled}
            disabledReason={disabledReason}
            onChange={onChange}
          />
          <PlanFieldInput
            field="priorityNo"
            label={t.fields.priorityNo}
            type="text"
            inputMode="numeric"
            value={draft.priorityNo}
            error={fieldErrors.priorityNo}
            disabled={disabled}
            disabledReason={disabledReason}
            onChange={onChange}
          />
        </Card.Body>
      </Card>
    </section>
  );
};
