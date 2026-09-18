import { AlertBanner, Card, EmptyState, Select, TextField, type SelectItems } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import type { WorkOrderAssignmentDraft } from './assignment-model';

const t = messages.workOrder.resourcePane;

const RESOURCE_FIELDS = [
  'productionLineId',
  'plannedEquipmentId',
  'responsibleWorkerId',
  'plannedMoldId',
  'plannedShiftId',
  'defaultWipLocationId',
  'defaultFgLocationId',
  'defaultScrapLocationId',
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
  plannedShiftOptions: WorkOrderResourceOption[];
  defaultWipLocationOptions: WorkOrderResourceOption[];
  defaultFgLocationOptions: WorkOrderResourceOption[];
  defaultScrapLocationOptions: WorkOrderResourceOption[];
  fieldErrors: Partial<Record<ResourceField, string>>;
  fieldNotes: Partial<Record<ResourceField, string>>;
  /** 작업자는 한 쪽에 다 오지 않아 검색칸으로 좁힌다. 없으면 검색칸을 두지 않는다. */
  responsibleWorkerSearch?: string;
  onResponsibleWorkerSearch?: (term: string) => void;
  disabled?: boolean;
  disabledReason?: string;
  onChange: (patch: Partial<Pick<WorkOrderAssignmentDraft, ResourceField>>) => void;
}

interface ResourceSearch {
  value: string;
  onChange: (term: string) => void;
}

interface ResourceSelectProps {
  field: ResourceField;
  label: string;
  value: string;
  options: WorkOrderResourceOption[];
  error: string | undefined;
  note: string | undefined;
  disabled: boolean;
  disabledReason: string | undefined;
  search?: ResourceSearch;
  onChange: (patch: Partial<Pick<WorkOrderAssignmentDraft, ResourceField>>) => void;
}

const ResourceSelect = ({
  field,
  label,
  value,
  options,
  error,
  note,
  disabled,
  disabledReason,
  search,
  onChange,
}: ResourceSelectProps) => {
  const id = useId();
  const description = error ?? (disabled ? disabledReason : note);
  const descriptionId = `${id}-description`;
  const availableOptions: SelectItems = [
    { value: '', label: t.clearOption },
    ...options.filter((option) => option.value.trim() !== ''),
  ];

  return (
    <div className="field-cell">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {/* 검색칸은 선택칸 위에 둔다 — 좁히는 것이 고르는 것보다 먼저다. */}
      {search !== undefined && (
        <TextField
          fullWidth
          value={search.value}
          placeholder={t.workerSearch.placeholder}
          disabled={disabled}
          aria-label={t.workerSearch.label}
          onChange={(event) => {
            search.onChange(event.target.value);
          }}
        />
      )}
      <Select
        id={id}
        options={availableOptions}
        value={value}
        placeholder={t.placeholder}
        invalid={error !== undefined}
        disabled={disabled}
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
  plannedShiftOptions,
  defaultWipLocationOptions,
  defaultFgLocationOptions,
  defaultScrapLocationOptions,
  fieldErrors,
  fieldNotes,
  responsibleWorkerSearch,
  onResponsibleWorkerSearch,
  disabled = false,
  disabledReason,
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

  const select = (
    field: ResourceField,
    label: string,
    options: WorkOrderResourceOption[],
    search?: ResourceSearch,
  ) => (
    <ResourceSelect
      field={field}
      label={label}
      value={draft[field]}
      options={options}
      error={fieldErrors[field]}
      note={fieldNotes[field]}
      disabled={disabled}
      disabledReason={disabledReason}
      search={search}
      onChange={onChange}
    />
  );
  const workerSearch =
    responsibleWorkerSearch === undefined || onResponsibleWorkerSearch === undefined
      ? undefined
      : { value: responsibleWorkerSearch, onChange: onResponsibleWorkerSearch };

  return (
    <section className="pane work-order-resource-pane" aria-label={t.pane}>
      <h2 className="pane-title">{t.heading(selectedWorkOrderNo)}</h2>
      <AlertBanner variant="warning">{t.warning}</AlertBanner>
      <div className="work-order-resource-grid">
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
            {select('responsibleWorkerId', t.fields.worker, responsibleWorkerOptions, workerSearch)}
            {select('plannedShiftId', t.fields.shift, plannedShiftOptions)}
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
            {select('defaultWipLocationId', t.fields.defaultWipLocation, defaultWipLocationOptions)}
            {select('defaultFgLocationId', t.fields.defaultFgLocation, defaultFgLocationOptions)}
            {select('defaultScrapLocationId', t.fields.defaultScrapLocation, defaultScrapLocationOptions)}
          </Card.Body>
        </Card>
      </div>
    </section>
  );
};
