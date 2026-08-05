import { Button, Checkbox, Dialog, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { useId } from 'react';

import {
  LOCATION_TYPE_OPTIONS,
  QUALITY_ZONE_OPTIONS,
  STORAGE_CONDITION_OPTIONS,
} from './code-options';
import type { LocationFormValues } from './types';
import { SelectField } from './warehouse-form-pane';

export interface LocationFormDialogProps {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  /** 어느 창고의 Location인지 — 「창고코드 · 창고명」 */
  warehouseLabel: string;
  /** 하위 추가일 때 부모 코드(고정 안내) */
  parentLabel: string | null;
  values: LocationFormValues;
  onChange: (patch: Partial<LocationFormValues>) => void;
  fieldErrors: Record<string, string>;
  banner: ReactNode;
  /** null이면 위치코드 편집 가능. 잠긴 코드를 고치게 두면 저장 시점에야 거부된다 */
  codeLockReason: string | null;
  uomOptions: { value: string; label: string }[];
  isSaving: boolean;
  onSave: () => void;
}

const t = messages.warehouseLocation;

export const LocationFormDialog = ({
  open,
  onClose,
  mode,
  warehouseLabel,
  parentLabel,
  values,
  onChange,
  fieldErrors,
  banner,
  codeLockReason,
  uomOptions,
  isSaving,
  onSave,
}: LocationFormDialogProps) => {
  const warehouseLabelId = useId();
  const parentLabelId = useId();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={mode === 'create' ? t.dialog.createTitle : t.dialog.editTitle}
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            {messages.common.cancel}
          </Button>
          <Button loading={isSaving} disabled={isSaving} onClick={onSave}>
            {messages.common.save}
          </Button>
        </>
      }
    >
      {banner}

      <div className="form-grid">
        {/* 값을 보여 주기만 하면 되는 자리는 폼 컨트롤을 잠그지 않고 값 표기로 낸다. */}
        {/* 어느 창고의 Location인지는 값으로 밝히고, 바꿀 수 없다는 사실은 보조 문구로 남긴다. */}
        <div>
          <span className="field-label" id={warehouseLabelId}>
            {t.fields.warehouse}
          </span>
          <p aria-labelledby={warehouseLabelId}>{warehouseLabel}</p>
          <span className="field-note">{t.actionReasons.warehouseFixedInLocation}</span>
        </div>

        <div>
          <span className="field-label" id={parentLabelId}>
            {t.fields.parentLocation}
          </span>
          <p aria-labelledby={parentLabelId}>{parentLabel ?? t.values.noParent}</p>
        </div>

        <TextField
          label={t.fields.locationCode}
          value={values.locationCode}
          onChange={(event) => onChange({ locationCode: event.target.value })}
          disabled={codeLockReason !== null}
          disabledReason={codeLockReason}
          error={fieldErrors.locationCode}
        />

        <TextField
          label={t.fields.locationName}
          value={values.locationName}
          onChange={(event) => onChange({ locationName: event.target.value })}
          error={fieldErrors.locationName}
        />

        <SelectField
          label={t.fields.locationType}
          options={LOCATION_TYPE_OPTIONS}
          value={values.locationTypeCode}
          onChange={(value) => onChange({ locationTypeCode: value })}
          error={fieldErrors.locationTypeCode}
          note={messages.pendingCode.note}
        />

        <SelectField
          label={t.fields.qualityZone}
          options={QUALITY_ZONE_OPTIONS}
          value={values.qualityZoneCode}
          onChange={(value) => onChange({ qualityZoneCode: value })}
          note={messages.pendingCode.note}
        />

        <SelectField
          label={t.fields.storageCondition}
          options={STORAGE_CONDITION_OPTIONS}
          value={values.storageConditionCode}
          onChange={(value) => onChange({ storageConditionCode: value })}
          note={messages.pendingCode.note}
        />

        <div>
          <Checkbox
            checked={values.allowMixedItem}
            onChange={(event) => onChange({ allowMixedItem: event.target.checked })}
          >
            {t.fields.allowMixedItem}
          </Checkbox>
          <Checkbox
            checked={values.allowMixedLot}
            onChange={(event) => onChange({ allowMixedLot: event.target.checked })}
          >
            {t.fields.allowMixedLot}
          </Checkbox>
        </div>

        <TextField
          label={t.fields.capacityQty}
          inputMode="decimal"
          value={values.capacityQty}
          onChange={(event) => onChange({ capacityQty: event.target.value })}
          error={fieldErrors.capacityQty}
        />

        <SelectField
          label={t.fields.capacityUom}
          options={uomOptions}
          value={values.capacityUomId}
          onChange={(value) => onChange({ capacityUomId: value })}
          error={fieldErrors.capacityUomId}
        />
      </div>
    </Dialog>
  );
};
