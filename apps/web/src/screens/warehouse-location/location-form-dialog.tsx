import { Button, Checkbox, Dialog, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { useId } from 'react';

import type { LocationFormValues } from './types';
import { SelectField } from './warehouse-form-pane';

export interface LocationFormDialogProps {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  /** 어느 창고의 Location인지 — 「창고코드 · 창고명」 */
  warehouseLabel: string;
  parentOptions: { value: string; label: string }[];
  values: LocationFormValues;
  onChange: (patch: Partial<LocationFormValues>) => void;
  fieldErrors: Record<string, string>;
  banner: ReactNode;
  /** null이면 위치코드 편집 가능. 잠긴 코드를 고치게 두면 저장 시점에야 거부된다 */
  codeLockReason: string | null;
  uomOptions: { value: string; label: string }[];
  locationTypeOptions: { value: string; label: string }[];
  qualityZoneOptions: { value: string; label: string }[];
  storageConditionOptions: { value: string; label: string }[];
  isActive: boolean;
  /** 편집 상세 조회가 끝나 ETag와 현재 상태를 확보했을 때만 쓰기를 허용한다. */
  isReady: boolean;
  onToggleActive: () => void;
  isSaving: boolean;
  onSave: () => void;
}

const t = messages.warehouseLocation;

export const LocationFormDialog = ({
  open,
  onClose,
  mode,
  warehouseLabel,
  parentOptions,
  values,
  onChange,
  fieldErrors,
  banner,
  codeLockReason,
  uomOptions,
  locationTypeOptions,
  qualityZoneOptions,
  storageConditionOptions,
  isActive,
  isReady,
  onToggleActive,
  isSaving,
  onSave,
}: LocationFormDialogProps) => {
  const warehouseLabelId = useId();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={mode === 'create' ? t.dialog.createTitle : t.dialog.editTitle}
      footer={
        <>
          {mode === 'edit' && (
            <Button variant="outlined" disabled={!isReady} onClick={onToggleActive}>
              {isActive ? messages.common.deactivate : t.actions.activate}
            </Button>
          )}
          <Button variant="outlined" onClick={onClose}>
            {messages.common.cancel}
          </Button>
          <Button loading={isSaving} disabled={!isReady || isSaving} onClick={onSave}>
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

        <SelectField
          label={t.fields.parentLocation}
          options={[{ value: '', label: t.values.noParent }, ...parentOptions]}
          value={values.parentLocationId}
          onChange={(value) => onChange({ parentLocationId: value })}
          disabled={!isReady}
          error={fieldErrors.parentLocationId}
        />

        <TextField
          label={t.fields.locationCode}
          value={values.locationCode}
          onChange={(event) => onChange({ locationCode: event.target.value })}
          disabled={!isReady || codeLockReason !== null}
          disabledReason={codeLockReason}
          error={fieldErrors.locationCode}
        />

        <TextField
          label={t.fields.locationName}
          value={values.locationName}
          onChange={(event) => onChange({ locationName: event.target.value })}
          disabled={!isReady}
          error={fieldErrors.locationName}
        />

        <SelectField
          label={t.fields.locationType}
          options={locationTypeOptions}
          value={values.locationTypeCode}
          onChange={(value) => onChange({ locationTypeCode: value })}
          disabled={!isReady}
          error={fieldErrors.locationTypeCode}
        />

        <SelectField
          label={t.fields.qualityZone}
          options={qualityZoneOptions}
          value={values.qualityZoneCode}
          onChange={(value) => onChange({ qualityZoneCode: value })}
          disabled={!isReady}
        />

        <SelectField
          label={t.fields.storageCondition}
          options={storageConditionOptions}
          value={values.storageConditionCode}
          onChange={(value) => onChange({ storageConditionCode: value })}
          disabled={!isReady}
        />

        {/* 간격이 없으면 두 문구가 붙어 「…허용LOT 혼적…」처럼 한 줄로 읽힌다. */}
        <div className="check-group">
          <Checkbox
            checked={values.allowMixedItem}
            onChange={(event) => onChange({ allowMixedItem: event.target.checked })}
            disabled={!isReady}
          >
            {t.fields.allowMixedItem}
          </Checkbox>
          <Checkbox
            checked={values.allowMixedLot}
            onChange={(event) => onChange({ allowMixedLot: event.target.checked })}
            disabled={!isReady}
          >
            {t.fields.allowMixedLot}
          </Checkbox>
        </div>

        <TextField
          label={t.fields.capacityQty}
          inputMode="decimal"
          value={values.capacityQty}
          onChange={(event) => onChange({ capacityQty: event.target.value })}
          disabled={!isReady}
          error={fieldErrors.capacityQty}
        />

        <SelectField
          label={t.fields.capacityUom}
          options={uomOptions}
          value={values.capacityUomId}
          onChange={(value) => onChange({ capacityUomId: value })}
          disabled={!isReady}
          error={fieldErrors.capacityUomId}
        />
      </div>
    </Dialog>
  );
};
