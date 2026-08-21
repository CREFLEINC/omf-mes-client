import { AlertBanner, Button, Dialog, Switch, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { useId } from 'react';

import { EQUIPMENT_TYPE_OPTIONS, type CodeOption, statusLabel } from './code-options';
import { FieldLabel } from './field-label';
import { groupAssignmentNote, hierarchyText, type EquipmentHierarchy } from './hierarchy-text';
import { SelectField } from './select-field';
import type { EquipmentFormValues } from './types';

export interface EquipmentFormDialogProps {
  mode: 'create' | 'edit';
  values: EquipmentFormValues;
  onChange: (patch: Partial<EquipmentFormValues>) => void;
  fieldErrors: Record<string, string>;
  banner: ReactNode;
  /** null이면 설비코드 편집 가능 */
  codeLockReason: string | null;
  groupOptions: CodeOption[];
  processOptions: CodeOption[];
  /**
   * 설비 위치. 상세 응답이 준 재료를 그대로 그린다 — 등록 중에는 아직 없다.
   */
  hierarchy: EquipmentHierarchy | null;
  /** 읽기 전용 값들. 이 화면이 정하지 않는다 */
  statusCode: string | null;
  lastCalibrationDate: string | null;
  calibrationDueDate: string | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: () => void;
}

const t = messages.equipmentMaster;

/** 값이 없는 읽기 전용 칸. 빈칸으로 두지 않고 「지정 없음」을 밝힌다(G-9). */
const readOnlyText = (value: string | null): string =>
  value === null || value.trim() === '' ? t.fields.notRecorded : value;

interface ReadOnlyFieldProps {
  label: string;
  value: string | null;
  note?: string;
}

/**
 * 값을 보여 주기만 하는 칸.
 *
 * **폼 컨트롤을 잠그지 않고 값 표기로 낸다** — 잠긴 입력칸은 「언젠가 여기서 고칠 수 있다」를
 * 뜻하는데, 이 값들은 이 화면이 영영 정하지 않는다. 사유는 함께 낸다.
 */
const ReadOnlyField = ({ label, value, note }: ReadOnlyFieldProps) => {
  const labelId = useId();

  return (
    <div className="field-cell">
      <span className="field-label" id={labelId}>
        {label}
      </span>
      <p aria-labelledby={labelId}>{readOnlyText(value)}</p>
      {note !== undefined && <span className="field-note">{note}</span>}
    </div>
  );
};

/**
 * 설비 등록·수정 창.
 *
 * **창 안에 선택칸이 있다** — 설비유형·소속그룹·소속공정 셋이 필요하고, 창 없이 이 폼을 둘
 * 자리가 우측 페인에 없다(그 자리는 그룹 폼이 쓴다).
 *
 * ⭐ **스크림 클릭으로 닫히지 않게 한다.** 확인 창과 이유가 다르다 — 저쪽은 되돌릴 수 없는
 * 조작을 지키고, 이쪽은 **사용자가 친 값**을 지킨다. 폼을 채우는 동안 창 밖을 한 번 누르면
 * 입력이 통째로 사라지는 것은 「말없는 유실」이고, 그것을 막는 것이 이 화면의 다른 자리
 * (다른 그룹으로 옮겨 갈 때의 파기 확인)와 같은 규율이다.
 *
 * ⚠ **Escape 와 X 손잡이는 남긴다.** 둘은 사용자가 **나가겠다고 말한 것**이라 파기가 곧
 * 그 뜻이며, 그것까지 막으면 나갈 길이 「취소」 하나로 좁아진다.
 */
export const EquipmentFormDialog = ({
  mode,
  values,
  onChange,
  fieldErrors,
  banner,
  codeLockReason,
  groupOptions,
  processOptions,
  hierarchy,
  statusCode,
  lastCalibrationDate,
  calibrationDueDate,
  isSaving,
  onClose,
  onSave,
}: EquipmentFormDialogProps) => {
  const hierarchyLabelId = useId();
  const calibrationNoteId = useId();

  return (
    <Dialog
      open
      onClose={onClose}
      closeOnBackdropClick={false}
      title={mode === 'create' ? t.equipmentForm.createTitle : t.equipmentForm.editTitle}
      footer={
        <>
          <Button variant="outlined" disabled={isSaving} onClick={onClose}>
            {messages.common.cancel}
          </Button>
          <Button loading={isSaving} disabled={isSaving} onClick={onSave}>
            {messages.common.save}
          </Button>
        </>
      }
    >
      {banner}

      {/*
       * ⭐ 계층 텍스트는 상세 응답의 재료를 그대로 그린다 — 화면이 그룹을 거슬러 올라가며
       * 이름을 조회하지 않는다. 소속 그룹이 없으면 빈칸이 아니라 「소속 그룹 없음」이다(G-9).
       */}
      {hierarchy !== null && (
        <div className="field-cell">
          <span className="field-label" id={hierarchyLabelId}>
            {t.fields.hierarchy}
          </span>
          <p aria-labelledby={hierarchyLabelId}>{hierarchyText(hierarchy)}</p>
          {groupAssignmentNote(hierarchy) !== null && (
            <AlertBanner variant="warning">{groupAssignmentNote(hierarchy)}</AlertBanner>
          )}
        </div>
      )}

      <div className="form-grid">
        <TextField
          label={t.fields.equipmentCode}
          required
          value={values.equipmentCode}
          onChange={(event) => onChange({ equipmentCode: event.target.value })}
          disabled={codeLockReason !== null}
          disabledReason={codeLockReason ?? undefined}
          error={fieldErrors.equipmentCode}
        />

        <TextField
          label={t.fields.equipmentName}
          required
          value={values.equipmentName}
          onChange={(event) => onChange({ equipmentName: event.target.value })}
          error={fieldErrors.equipmentName}
        />

        <SelectField
          label={t.fields.equipmentType}
          required
          options={EQUIPMENT_TYPE_OPTIONS}
          value={values.equipmentTypeCode}
          onChange={(value) => onChange({ equipmentTypeCode: value })}
          note={messages.pendingCode.note}
          error={fieldErrors.equipmentTypeCode}
        />

        <SelectField
          label={t.fields.parentGroup}
          options={groupOptions}
          value={values.productionLineId}
          onChange={(value) => onChange({ productionLineId: value })}
          error={fieldErrors.productionLineId}
        />

        <SelectField
          label={t.fields.process}
          options={processOptions}
          value={values.processId}
          onChange={(value) => onChange({ processId: value })}
          error={fieldErrors.processId}
        />

        {/*
         * ⚠ 검교정 대상을 잠근다. 계약이 「참이면 주기 두 칸이 함께 필요하다」로 짝을 묶었는데
         * 주기 단위의 값 목록이 아직 없다(설계 질의 omf-mes#185) — 열어 두면 켜는 순간
         * 반드시 저장이 실패하는 경로가 된다. 감추지 않고 사유를 밝힌다(G-2).
         */}
        <div className="field-cell">
          <FieldLabel htmlFor={calibrationNoteId} label={t.fields.calibrationRequired} />
          <Switch
            id={calibrationNoteId}
            checked={values.calibrationRequired}
            disabled
            aria-describedby={`${calibrationNoteId}-note`}
            onChange={(event) => onChange({ calibrationRequired: event.target.checked })}
          />
          <span id={`${calibrationNoteId}-note`} className="field-note">
            {t.actionReasons.calibrationCycleUnavailable}
          </span>
        </div>

        {mode === 'edit' && (
          <>
            <ReadOnlyField
              label={t.fields.status}
              value={statusCode === null ? null : statusLabel(statusCode)}
              note={t.actionReasons.statusNotEditableHere}
            />
            <ReadOnlyField
              label={t.fields.lastCalibrationDate}
              value={lastCalibrationDate}
              note={t.actionReasons.calibrationDatesReadOnly}
            />
            <ReadOnlyField label={t.fields.calibrationDueDate} value={calibrationDueDate} />
          </>
        )}
      </div>
    </Dialog>
  );
};
