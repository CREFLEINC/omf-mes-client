import { Button, Dialog, Switch, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { useId } from 'react';

import { CodeLockTextField } from '../../patterns/master';
import type { CodeOption } from './code-options';
import { FieldLabel } from './field-label';
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
 * ⭐ **세 칸은 「측정값」일 때만 보인다**(사용자 지시 · omf-all-around#360) — 셋을 한 줄로 묶어
 * 나타나고 사라지게 한다. 감춘 칸에 남은 값은 저장에 섞이지 않는다 — 검사는 「측정값」일 때만
 * 세 칸을 보고(`validateInspectionItem`), 본문은 그 밖이면 셋을 `null` 로 보낸다(`toInspectionItem*`).
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
  const requiredFlagId = useId();
  const isActiveId = useId();

  return (
    <Dialog
      className={mode === 'create' ? 'dialog-icon-add' : 'dialog-icon-edit'}
      open
      onClose={onClose}
      title={mode === 'create' ? t.createTitle : t.editTitle}
      size="lg"
      /* [취소] 가 닫기라 제목 줄 X 는 두지 않는다 — Esc 는 그대로 닫는다(팝업 디자인 시안 · #360). */
      showCloseButton={false}
      /* 단추 줄은 회색 띠에 오른쪽 정렬(팝업 디자인 시안 · #360). */
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            {messages.common.cancel}
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {messages.common.save}
          </Button>
        </>
      }
    >
      {banner}

      <div className="form-grid equipment-inspection-item-form">
        {/* 2열 배치(사용자 지시 · #360): 1행 필수 여부 | 공장, 2행 항목코드 | 항목명, 3행 점검 유형 | 판정 방식,
            4행 표시 순서 | 점검 부위. 필수 여부는 이름 위 · 토글 아래. */}
        {/* 1행은 필수 여부(토글 폭만큼) 바로 오른쪽에 공장이 남는 폭을 다 쓴다(사용자 지시 · #360 — 빈 공간이 컸다). */}
        <div className="form-grid-full equipment-inspection-item-head">
          <div className="equipment-inspection-item-flags">
            <div className="field-cell">
              <FieldLabel htmlFor={requiredFlagId} label={t.fields.requiredFlag} />
              <Switch
                id={requiredFlagId}
                checked={values.requiredFlag}
                onChange={(event) => onChange({ requiredFlag: event.target.checked })}
              />
            </div>

            {/* ⛔ 물리 삭제가 없다(B-4) — 끄는 것이 지우는 것을 대신하는 뜻은 이름 옆 ⓘ 로(관리웹 정리 시안 A). */}
            {mode === 'edit' && (
              <div className="field-cell">
                <FieldLabel htmlFor={isActiveId} label={t.fields.isActive} info={t.inactiveNote} />
                <Switch
                  id={isActiveId}
                  checked={values.isActive}
                  onChange={(event) => onChange({ isActive: event.target.checked })}
                />
              </div>
            )}
          </div>
          {/* ⭐ 항목은 공장에 매인다 — 등록할 때 정하고 수정 본문은 받지 않는다(계약). */}
          <SelectField
            label={t.fields.plant}
            required
            options={plantOptions}
            value={values.plantId}
            onChange={(value) => onChange({ plantId: value })}
            error={fieldErrors.plantId}
            placeholder={t.placeholders.plant}
            /* 수정에서는 잠그기만 한다 — 잠긴 까닭 문장은 걷었다(사용자 지시 · #360). */
            disabled={mode === 'edit'}
          />
        </div>
        <CodeLockTextField
          lockReason={codeLockReason}
          label={t.fields.itemCode}
          placeholder={t.placeholders.itemCode}
          required
          value={values.itemCode}
          onChange={(event) => onChange({ itemCode: event.target.value })}
          error={fieldErrors.itemCode}
        />
        <TextField
          label={t.fields.itemName}
          placeholder={t.placeholders.itemName}
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
          /* ⛔ 왜 세 칸이 갑자기 필수가 되는지 말한다 — 라벨 옆 ⓘ 로(관리웹 정리 시안 A). */
          info={t.measurementNote}
        />
        <TextField
          label={t.fields.sequenceNo}
          placeholder={t.placeholders.sequenceNo}
          required
          value={values.sequenceNo}
          onChange={(event) => onChange({ sequenceNo: event.target.value })}
          error={fieldErrors.sequenceNo}
        />
        <TextField
          label={t.fields.inspectionPoint}
          placeholder={t.placeholders.inspectionPoint}
          value={values.inspectionPoint}
          onChange={(event) => onChange({ inspectionPoint: event.target.value })}
          error={fieldErrors.inspectionPoint}
        />

        {/* 「측정값」일 때만 — 단위 · 하한 · 상한을 한 줄에(사용자 지시 · #360). */}
        {measurement && (
          <div className="form-grid-full equipment-inspection-item-measure">
            <SelectField
              label={t.fields.uom}
              required
              options={uomOptions}
              value={values.uomId}
              onChange={(value) => onChange({ uomId: value })}
              error={fieldErrors.uomId}
              placeholder={t.placeholders.uom}
            />
            <TextField
              label={t.fields.lowerLimit}
              placeholder={t.placeholders.lowerLimit}
              required
              value={values.lowerLimit}
              onChange={(event) => onChange({ lowerLimit: event.target.value })}
              error={fieldErrors.lowerLimit}
            />
            <TextField
              label={t.fields.upperLimit}
              placeholder={t.placeholders.upperLimit}
              required
              value={values.upperLimit}
              onChange={(event) => onChange({ upperLimit: event.target.value })}
              error={fieldErrors.upperLimit}
            />
          </div>
        )}

        {/* ⭐ 무엇에 걸려 있는지 — 코드를 못 고치는 사유와 같은 사실의 다른 면이다. */}
        {assignmentCount !== null && (
          <div className="form-grid-full">
            <p className="dialog-lead">{t.assignmentCount(assignmentCount)}</p>
          </div>
        )}
      </div>
    </Dialog>
  );
};
