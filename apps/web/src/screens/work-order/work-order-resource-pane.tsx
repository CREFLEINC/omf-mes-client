import { AlertBanner, Card, EmptyState, Select, type SelectItems } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import type { WorkOrderAssignmentDraft } from './assignment-model';

const t = messages.workOrder.resourcePane;

const RESOURCE_FIELDS = [
  'productionLineId',
  'plannedEquipmentId',
  'responsibleWorkerId',
  'plannedMoldId',
] as const;

type ResourceField = (typeof RESOURCE_FIELDS)[number];

export interface WorkOrderResourceOption {
  value: string;
  label: string;
}

export interface WorkOrderResourcePaneProps {
  selectedWorkOrderNo: string | null;
  draft: WorkOrderAssignmentDraft;
  productionLineOptions: WorkOrderResourceOption[];
  plannedEquipmentOptions: WorkOrderResourceOption[];
  responsibleWorkerOptions: WorkOrderResourceOption[];
  plannedMoldOptions: WorkOrderResourceOption[];
  fieldErrors: Partial<Record<ResourceField, string>>;
  fieldNotes: Partial<Record<ResourceField, string>>;
  onChange: (patch: Partial<Pick<WorkOrderAssignmentDraft, ResourceField>>) => void;
}

interface ResourceSelectProps {
  field: ResourceField;
  label: string;
  value: string;
  options: WorkOrderResourceOption[];
  error: string | undefined;
  note: string | undefined;
  onChange: (patch: Partial<Pick<WorkOrderAssignmentDraft, ResourceField>>) => void;
}

const ResourceSelect = ({
  field,
  label,
  value,
  options,
  error,
  note,
  onChange,
}: ResourceSelectProps) => {
  const id = useId();
  const description = error ?? note;
  const descriptionId = `${id}-description`;
  const availableOptions: SelectItems = options.filter((option) => option.value.trim() !== '');

  return (
    <div className="field-cell">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <Select
        id={id}
        options={availableOptions}
        value={value === '' ? null : value}
        placeholder={t.placeholder}
        invalid={error !== undefined}
        aria-describedby={description === undefined ? undefined : descriptionId}
        onChange={(nextValue) => {
          onChange({ [field]: nextValue });
        }}
      />
      {description !== undefined && (
        <span id={descriptionId} className={error === undefined ? 'field-note' : 'field-error'}>
          {description}
        </span>
      )}
    </div>
  );
};

export const WorkOrderResourcePane = ({
  selectedWorkOrderNo,
  draft,
  productionLineOptions,
  plannedEquipmentOptions,
  responsibleWorkerOptions,
  plannedMoldOptions,
  fieldErrors,
  fieldNotes,
  onChange,
}: WorkOrderResourcePaneProps) => {
  if (selectedWorkOrderNo === null) {
    return (
      <EmptyState
        size="sm"
        title={t.empty.notSelectedTitle}
        description={t.empty.notSelectedDescription}
      />
    );
  }

  const select = (field: ResourceField, label: string, options: WorkOrderResourceOption[]) => (
    <ResourceSelect
      field={field}
      label={label}
      value={draft[field]}
      options={options}
      error={fieldErrors[field]}
      note={fieldNotes[field]}
      onChange={onChange}
    />
  );

  return (
    <section className="pane" aria-label={t.pane}>
      <h2>{t.heading(selectedWorkOrderNo)}</h2>
      <AlertBanner variant="warning">{t.warning}</AlertBanner>
      <Card bordered>
        <Card.Header>
          <h3>{t.cards.machine}</h3>
        </Card.Header>
        <Card.Body>
          {select('productionLineId', t.fields.productionLine, productionLineOptions)}
          {select('plannedEquipmentId', t.fields.equipment, plannedEquipmentOptions)}
        </Card.Body>
      </Card>
      <Card bordered>
        <Card.Header>
          <h3>{t.cards.man}</h3>
        </Card.Header>
        <Card.Body>
          {select('responsibleWorkerId', t.fields.worker, responsibleWorkerOptions)}
        </Card.Body>
      </Card>
      <Card bordered>
        <Card.Header>
          <h3>{t.cards.tool}</h3>
        </Card.Header>
        <Card.Body>{select('plannedMoldId', t.fields.mold, plannedMoldOptions)}</Card.Body>
      </Card>
      <Card bordered>
        <Card.Header>
          <h3>{t.cards.material}</h3>
        </Card.Header>
        <Card.Body>
          <AlertBanner variant="info">{t.materialInfo}</AlertBanner>
        </Card.Body>
      </Card>
    </section>
  );
};
