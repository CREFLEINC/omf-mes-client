import { Button, Dialog, Switch, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { CodeOption } from './code-options';
import { isMeasurement } from './inspection-item-validation';
import { SelectField } from './select-field';
import type { InspectionItemFormValues } from './types';

const t = messages.equipmentMaster.inspectionItem;

export interface InspectionItemDialogProps {
  mode: 'create' | 'edit';
  values: InspectionItemFormValues;
  onChange: (patch: Partial<InspectionItemFormValues>) => void;
  fieldErrors: Record<string, string>;
  banner: ReactNode;
  /** null 이면 항목코드 편집 가능. 값이 있으면 잠그고 그 사유를 보인다 */
  codeLockReason: string | null;
  /** 이 항목이 부여된 곳의 수. 아직 모르면 null — 등록 중에는 없다 */
  assignmentCount: number | null;
  plantOptions: CodeOption[];
  typeOptions: CodeOption[];
  methodOptions: CodeOption[];
  uomOptions: CodeOption[];
  isSaving: boolean;
  onSave: () => void;
  onClose: () => void;
}

/**
 * 점검 항목 등록·수정 창.
 *
 * ⛔ **짝 제약을 창이 건다**(계약 · 설계 회신 `omf-mes#186`) — 판정 방식이 「측정값」이면
 * 단위·상하한이 **함께** 필요하다. 걸지 않으면 등록·수정이 **반드시 실패하는 경로**가 된다.
 *
 * ⭐ **세 칸을 감추지 않고 잠근다**(G-2) — 감추면 판정 방식을 바꿨을 때 칸이 튀어나와
 * 창이 흔들리고, 무엇이 더 필요해졌는지도 알기 어렵다.
 */
export const InspectionItemDialog = ({
  mode,
  values,
  onChange,
  fieldErrors,
  banner,
  codeLockReason,
  assignmentCount,
  plantOptions,
  typeOptions,
  methodOptions,
  uomOptions,
  isSaving,
  onSave,
  onClose,
}: InspectionItemDialogProps) => {
  const measurement = isMeasurement(values);

  return (
    <Dialog
      open
      onClose={onClose}
      title={mode === 'create' ? t.createTitle : t.editTitle}
      size="lg"
    >
      {banner}

      <div className="form-grid">
        {/* ⭐ 항목은 공장에 매인다 — 등록할 때 정하고 수정 본문은 받지 않는다(계약). */}
        <SelectField
          label={t.fields.plant}
          required
          options={plantOptions}
          value={values.plantId}
          onChange={(value) => onChange({ plantId: value })}
          error={fieldErrors.plantId}
          placeholder={t.placeholders.plant}
          disabled={mode === 'edit'}
          disabledReason={mode === 'edit' ? t.plantFixed : undefined}
        />
        <TextField
          label={t.fields.itemCode}
          required
          value={values.itemCode}
          onChange={(event) => onChange({ itemCode: event.target.value })}
          error={fieldErrors.itemCode}
          disabled={codeLockReason !== null}
          helperText={codeLockReason ?? undefined}
        />
        <TextField
          label={t.fields.itemName}
          required
          value={values.itemName}
          onChange={(event) => onChange({ itemName: event.target.value })}
          error={fieldErrors.itemName}
        />
        <SelectField
          label={t.fields.inspectionType}
          required
          options={typeOptions}
          value={values.inspectionTypeCode}
          onChange={(value) => onChange({ inspectionTypeCode: value })}
          error={fieldErrors.inspectionTypeCode}
          placeholder={t.placeholders.inspectionType}
        />
        <SelectField
          label={t.fields.judgmentMethod}
          required
          options={methodOptions}
          value={values.judgmentMethodCode}
          onChange={(value) => onChange({ judgmentMethodCode: value })}
          error={fieldErrors.judgmentMethodCode}
          placeholder={t.placeholders.judgmentMethod}
          /* ⛔ 왜 세 칸이 갑자기 필수가 되는지 말한다 — 말하지 않으면 사용자가 헤맨다. */
          note={t.measurementNote}
        />

        {/*
         * ⭐ **감추지 않고 잠근다**(G-2). 감추면 판정 방식을 바꿀 때 칸이 튀어나와 창이
         * 흔들리고, 「무엇이 더 필요해졌는지」가 눈에 남지 않는다.
         */}
        <SelectField
          label={t.fields.uom}
          required={measurement}
          options={uomOptions}
          value={values.uomId}
          onChange={(value) => onChange({ uomId: value })}
          error={fieldErrors.uomId}
          placeholder={t.placeholders.uom}
          disabled={!measurement}
          disabledReason={t.measurementNote}
        />
        <TextField
          label={t.fields.lowerLimit}
          required={measurement}
          value={values.lowerLimit}
          onChange={(event) => onChange({ lowerLimit: event.target.value })}
          error={fieldErrors.lowerLimit}
          disabled={!measurement}
        />
        <TextField
          label={t.fields.upperLimit}
          required={measurement}
          value={values.upperLimit}
          onChange={(event) => onChange({ upperLimit: event.target.value })}
          error={fieldErrors.upperLimit}
          disabled={!measurement}
        />

        <TextField
          label={t.fields.inspectionPoint}
          value={values.inspectionPoint}
          onChange={(event) => onChange({ inspectionPoint: event.target.value })}
          error={fieldErrors.inspectionPoint}
        />
        <TextField
          label={t.fields.sequenceNo}
          required
          value={values.sequenceNo}
          onChange={(event) => onChange({ sequenceNo: event.target.value })}
          error={fieldErrors.sequenceNo}
        />

        <div className="field-cell">
          <Switch
            label={t.fields.requiredFlag}
            checked={values.requiredFlag}
            onChange={(event) => onChange({ requiredFlag: event.target.checked })}
          />
        </div>

        {/* ⛔ 물리 삭제가 없다(B-4) — 끄는 것이 지우는 것을 대신하므로 그 뜻을 적는다. */}
        {mode === 'edit' && (
          <div className="field-cell">
            <Switch
              label={t.fields.isActive}
              checked={values.isActive}
              onChange={(event) => onChange({ isActive: event.target.checked })}
            />
            <span className="field-note">{t.inactiveNote}</span>
          </div>
        )}

        {/* ⭐ 무엇에 걸려 있는지 — 코드를 못 고치는 사유와 같은 사실의 다른 면이다. */}
        {assignmentCount !== null && (
          <div className="form-grid-full">
            <p className="dialog-lead">{t.assignmentCount(assignmentCount)}</p>
          </div>
        )}
      </div>

      <footer className="dialog-actions">
        <Button variant="outlined" onClick={onClose}>
          {messages.common.cancel}
        </Button>
        <Button onClick={onSave} disabled={isSaving}>
          {messages.common.save}
        </Button>
      </footer>
    </Dialog>
  );
};
