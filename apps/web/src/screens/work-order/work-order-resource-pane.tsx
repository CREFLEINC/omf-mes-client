import {
  AlertBanner,
  Card,
  EmptyState,
  SearchInput,
  Select,
  TextField,
  type SelectItems,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { ResourcePickerInput, type ResourceKind } from '../../patterns/resource-picker';
import { REQUIRED_ASSIGNMENT_FIELDS, type WorkOrderAssignmentDraft } from './assignment-model';
import { RecommendationChips } from './recommendation-chips';
import type {
  ResourceRecommendationChip,
  ResourceRecommendationChips,
} from './resource-recommendation';
import { WorkerPickerDialog } from './worker-picker-dialog';

const t = messages.workOrder.resourcePane;

const idOf = (value: string): number | null => (/^[1-9]\d*$/.test(value) ? Number(value) : null);

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

/** 필수 표시를 다는 칸 — 판정은 `assignment-model` 이 갖는다(같은 목록을 두 벌 두지 않는다). */
const REQUIRED_FIELDS: readonly string[] = REQUIRED_ASSIGNMENT_FIELDS;

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
  recommendations?: ResourceRecommendationChips;
  /** 담당 작업자 창이 쓰는 공장. 없으면 창을 열지 않는다. */
  plantId?: number | null;
  disabled?: boolean;
  disabledReason?: string;
  onChange: (patch: Partial<Pick<WorkOrderAssignmentDraft, ResourceField>>) => void;
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
  /** 배포까지 가려면 반드시 골라야 하는 칸 — 표시만 한다(판정은 종전 그대로). */
  required?: boolean;
  recommendations?: ResourceRecommendationChip[];
  /** 설비·금형 — 선택칸 대신 찾기 칸을 쓴다. 금형은 공장마다 수백 건이다 */
  picker?: { kind: ResourceKind; plantId: number | null; lineId: number | null };
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
  required = false,
  recommendations = [],
  picker,
  onChange,
}: ResourceSelectProps) => {
  const id = useId();
  /** 찾기 창에서 방금 고른 것의 이름표 — 받아 둔 선택지에 없어도 칸에 선다. */
  const [picked, setPicked] = useState<WorkOrderResourceOption | null>(null);
  /* 방금 고른 이름을 먼저 쓴다 — 받아 둔 목록에 없는 값은 이름을 풀기 전까지 「알 수 없음」으로 채워져 있다. */
  const valueLabel =
    value === ''
      ? ''
      : picked?.value === value
        ? picked.label
        : (options.find((option) => option.value === value)?.label ?? '');
  /* 필수 칸은 별표 옆에 「필수 입력」만 둔다 — 칸 아래에 같은 말을 문장으로 다시 쓰지 않는다. */
  const isMissingRequired = required && error === messages.workOrder.screen.errors.REQUIRED;
  const description = isMissingRequired ? undefined : (error ?? (disabled ? disabledReason : note));
  const descriptionId = `${id}-description`;
  /* 필수 안내는 라벨 옆에 두되 칸과 이어 둔다 — 안 그러면 막힌 이유가 보조기술에 닿지 않는다. */
  const requiredHintId = `${id}-required`;
  const describedBy =
    description !== undefined ? descriptionId : isMissingRequired ? requiredHintId : undefined;
  const availableOptions: SelectItems = [
    { value: '', label: t.clearOption },
    ...options.filter((option) => option.value.trim() !== ''),
  ];

  return (
    <div className="field-cell">
      {/* 필수 표시는 `<label>` 밖에 둔다 — 문자열에 붙이면 접근성 이름이 「이름 *」이 된다. */}
      <span className="field-label work-order-resource-label">
        <label htmlFor={id}>{label}</label>
        {required && (
          <span className="required-mark" aria-hidden="true">
            {' '}
            *
          </span>
        )}
        {/* 필수 안내는 라벨 옆에 — 칸 아래로 내려가면 줄 높이가 칸마다 들쭉날쭉해진다(사용자 지시). */}
        {required && (
          <span id={requiredHintId} className="work-order-resource-label-error">
            {t.requiredHint}
          </span>
        )}
      </span>
      {picker === undefined ? (
        <Select
          id={id}
          options={availableOptions}
          value={value}
          placeholder={t.placeholder}
          invalid={error !== undefined}
          aria-required={required || undefined}
          disabled={disabled}
          aria-describedby={describedBy}
          onChange={(nextValue) => {
            onChange({ [field]: nextValue });
          }}
        />
      ) : (
        <ResourcePickerInput
          id={id}
          kind={picker.kind}
          plantId={picker.plantId}
          lineId={picker.lineId}
          valueLabel={valueLabel}
          disabled={disabled}
          invalid={error !== undefined}
          aria-describedby={describedBy}
          onPick={(row) => {
            const next = String(row.id);
            setPicked({ value: next, label: `${row.code} · ${row.name}` });
            /* 설비 목록이 라인으로 걸러지므로, 라인이 비어 있을 때 고른 설비는 그 라인을 함께 가져온다. */
            onChange(
              row.productionLineId === null
                ? { [field]: next }
                : { productionLineId: String(row.productionLineId), [field]: next },
            );
          }}
          onClear={() => onChange({ [field]: '' })}
        />
      )}
      {description !== undefined && (
        <span id={descriptionId} className={error === undefined ? 'field-note' : 'field-error'}>
          {description}
        </span>
      )}
      <RecommendationChips
        label={label}
        chips={recommendations}
        value={value}
        disabled={disabled}
        onPick={(chip) => {
          onChange(
            chip.productionLineId === null
              ? { [field]: chip.value }
              : { productionLineId: chip.productionLineId, [field]: chip.value },
          );
        }}
      />
    </div>
  );
};

export const WorkOrderResourcePane = ({
  selectedWorkOrderNo,
  draft,
  productionLineOptions,
  plannedEquipmentOptions,
  responsibleWorkerOptions,
  plantId = null,
  plannedMoldOptions,
  plannedShiftOptions,
  defaultWipLocationOptions,
  defaultFgLocationOptions,
  defaultScrapLocationOptions,
  fieldErrors,
  fieldNotes,
  recommendations,
  disabled = false,
  disabledReason,
  onChange,
}: WorkOrderResourcePaneProps) => {
  const workerFieldId = useId();
  const [isWorkerPickerOpen, setIsWorkerPickerOpen] = useState(false);
  /** 창·추천 칩에서 방금 고른 작업자의 이름표 — 선택지 목록에 없어도 칸에 선다. */
  const [pickedWorker, setPickedWorker] = useState<WorkOrderResourceOption | null>(null);
  /* 방금 고른 이름을 먼저 쓴다 — 받아 둔 목록에 없는 값은 이름을 풀기 전까지 「알 수 없음」으로 채워져 있다. */
  const workerLabel =
    draft.responsibleWorkerId === ''
      ? ''
      : pickedWorker?.value === draft.responsibleWorkerId
        ? pickedWorker.label
        : (responsibleWorkerOptions.find((option) => option.value === draft.responsibleWorkerId)
            ?.label ?? '');

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
      disabled={disabled}
      disabledReason={disabledReason}
      required={REQUIRED_FIELDS.includes(field)}
      recommendations={
        field === 'plannedEquipmentId' || field === 'plannedMoldId' || field === 'plannedShiftId'
          ? recommendations?.[field]
          : undefined
      }
      picker={
        field === 'plannedEquipmentId'
          ? { kind: 'equipment', plantId, lineId: idOf(draft.productionLineId) }
          : field === 'plannedMoldId'
            ? { kind: 'mold', plantId, lineId: null }
            : undefined
      }
      onChange={onChange}
    />
  );

  return (
    <section className="pane work-order-resource-pane" aria-label={t.pane}>
      <h2 className="pane-title">{t.heading}</h2>
      <AlertBanner className="work-order-resource-rule" variant="warning">
        {t.warning}
      </AlertBanner>
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
            {/*
              담당 작업자 — 창에서 찾아 고른다(사용자 지시 2026-09-20). 칸은 읽기 전용이고 누르거나
              엔터를 치면 창이 열린다. 고른 값은 종전과 같은 작업자 번호로 들어간다.
            */}
            <div className="field-cell">
              <label className="field-label" htmlFor={workerFieldId}>
                {t.fields.worker}
              </label>
              <SearchInput
                id={workerFieldId}
                containerClassName="work-order-worker-field"
                value={workerLabel}
                readOnly
                title={workerLabel === '' ? undefined : workerLabel}
                placeholder={t.workerPicker.open}
                aria-haspopup="dialog"
                clearLabel={t.workerPicker.clear}
                disabled={disabled}
                onClick={() => {
                  if (!disabled) setIsWorkerPickerOpen(true);
                }}
                onSearch={() => {
                  if (!disabled) setIsWorkerPickerOpen(true);
                }}
                onChange={() => undefined}
                onClear={() => onChange({ responsibleWorkerId: '' })}
              />
              {fieldErrors.responsibleWorkerId !== undefined && (
                <p className="field-error">{fieldErrors.responsibleWorkerId}</p>
              )}
              <RecommendationChips
                label={t.fields.worker}
                chips={recommendations?.responsibleWorkerId ?? []}
                value={draft.responsibleWorkerId}
                disabled={disabled}
                onPick={(chip) => {
                  /* 찾기 창에서 고른 것과 같게 이름표를 붙든다 — 받아 둔 작업자 목록에 없을 수 있다. */
                  setPickedWorker({ value: chip.value, label: chip.label });
                  onChange({ responsibleWorkerId: chip.value });
                }}
              />
            </div>
            {isWorkerPickerOpen && (
              <WorkerPickerDialog
                plantId={plantId}
                onClose={() => setIsWorkerPickerOpen(false)}
                onConfirm={(worker) => {
                  setPickedWorker({
                    value: String(worker.workerId),
                    label: `${worker.workerNo} · ${worker.workerName}`,
                  });
                  onChange({ responsibleWorkerId: String(worker.workerId) });
                  setIsWorkerPickerOpen(false);
                }}
              />
            )}
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
            <AlertBanner className="work-order-resource-rule" variant="info">
              {t.materialInfo}
            </AlertBanner>
            {select('defaultWipLocationId', t.fields.defaultWipLocation, defaultWipLocationOptions)}
            {select('defaultFgLocationId', t.fields.defaultFgLocation, defaultFgLocationOptions)}
            {select(
              'defaultScrapLocationId',
              t.fields.defaultScrapLocation,
              defaultScrapLocationOptions,
            )}
          </Card.Body>
        </Card>
      </div>
    </section>
  );
};
