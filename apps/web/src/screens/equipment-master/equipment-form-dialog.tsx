import { AlertBanner, Button, Dialog, Switch, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { useId } from 'react';

import {
  DISPOSED_STATUS_CODE,
  EQUIPMENT_TYPE_OPTIONS,
  type CodeOption,
  cycleTypeLabel,
  statusLabel,
} from './code-options';
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
  /** 검교정 주기 — 계측기 마스터가 정한다. 둘 중 하나라도 없으면 주기가 없는 것이다 */
  calibrationCycleTypeCode: string | null;
  calibrationCycleInterval: number | null;
  /** 주기 단위 이름 풀이표. 비어 있으면 코드가 그대로 보인다 */
  cycleOptions: CodeOption[];
  lastCalibrationDate: string | null;
  calibrationDueDate: string | null;
  /** 사용 중인 설비인가. 이미 중지된 것에는 중지할 대상이 없다 */
  isActive: boolean;
  /** 자산 상태 선택지. **비어 있으면 폐기를 열 수 없다** — 이미 폐기됐는지 판정할 수 없다 */
  statusOptions: CodeOption[];
  isSaving: boolean;
  onClose: () => void;
  onSave: () => void;
  onDeactivate: () => void;
  onDispose: () => void;
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
  calibrationCycleTypeCode,
  calibrationCycleInterval,
  cycleOptions,
  lastCalibrationDate,
  calibrationDueDate,
  isActive,
  statusOptions,
  isSaving,
  onClose,
  onSave,
  onDeactivate,
  onDispose,
}: EquipmentFormDialogProps) => {
  const hierarchyLabelId = useId();
  const calibrationNoteId = useId();
  const disposeNoteId = useId();

  /** 주기는 «둘 다» 있어야 성립한다 — 계약이 그렇게 짝을 묶었다. */
  const hasCalibrationCycle =
    calibrationCycleTypeCode !== null &&
    calibrationCycleTypeCode !== '' &&
    calibrationCycleInterval !== null;

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
         * ⭐ **켜는 것만 주기에 매단다.** 계약이 「참이면 주기 두 칸이 함께 필요하다」로 짝을
         * 묶었는데 주기는 이 화면이 정하지 않는다(계측기 마스터 소유 · 설계 omf-mes#188) —
         * 주기 없이 켜면 저장에서 거절당한다.
         *
         * ⛔ **끄는 것은 언제나 열어 둔다.** 이미 켜져 있는데 주기가 없는 자료가 서버에서 올 수
         * 있고, 그때 토글까지 잠그면 **사용자가 그 어긋난 상태를 풀 수단이 없다.**
         */}
        <div className="field-cell">
          <FieldLabel htmlFor={calibrationNoteId} label={t.fields.calibrationRequired} />
          <Switch
            id={calibrationNoteId}
            checked={values.calibrationRequired}
            disabled={!values.calibrationRequired && !hasCalibrationCycle}
            aria-describedby={
              !values.calibrationRequired && !hasCalibrationCycle
                ? `${calibrationNoteId}-note`
                : undefined
            }
            onChange={(event) => onChange({ calibrationRequired: event.target.checked })}
          />
          {!values.calibrationRequired && !hasCalibrationCycle && (
            <span id={`${calibrationNoteId}-note`} className="field-note">
              {t.actionReasons.calibrationNeedsCycle}
            </span>
          )}
        </div>

        {mode === 'edit' && (
          /*
           * ⭐ **계측기 마스터가 정한다 — 여기서는 본다.** `lastCalibrationDate` 와 같은 자리다
           * (공유계약 B-13 · 설계 omf-mes#188). 잠긴 입력칸이 아니라 값 표기로 내는 이유는,
           * 잠긴 입력칸이 「언젠가 여기서 고칠 수 있다」를 뜻하기 때문이다.
           */
          <ReadOnlyField
            label={t.fields.calibrationCycle}
            value={
              hasCalibrationCycle
                ? t.values.calibrationCycle(
                    calibrationCycleInterval as number,
                    cycleTypeLabel(calibrationCycleTypeCode as string, cycleOptions),
                  )
                : null
            }
            note={t.actionReasons.calibrationCycleOwnedElsewhere}
          />
        )}

        {mode === 'edit' && (
          <>
            <ReadOnlyField
              label={t.fields.status}
              value={statusCode === null ? null : statusLabel(statusCode, statusOptions)}
              note={t.actionReasons.statusNotEditableHere}
            />
            <ReadOnlyField
              label={t.fields.lastCalibrationDate}
              value={lastCalibrationDate}
              note={t.actionReasons.calibrationDatesReadOnly}
            />
            <ReadOnlyField label={t.fields.calibrationDueDate} value={calibrationDueDate} />

            {/*
             * ⭐ **수명주기 액션을 한자리에 모은다.** 사용 중지와 폐기는 같은 축의 두 단계인데
             * 서로 다른 자리에 두면 한쪽을 찾은 사용자가 다른 쪽이 없다고 읽는다.
             * 줄에 두는 것이 빠르지도 않다 — 어느 쪽이든 잠금 토큰을 받아야 눌린다.
             */}
            {isActive && (
              <div className="field-cell">
                <Button variant="outlined" disabled={isSaving} onClick={onDeactivate}>
                  {messages.common.deactivate}
                </Button>
              </div>
            )}

            {/*
             * ⭐ **이미 폐기된 자산에는 폐기할 대상이 없다.** 판정의 근거는 서버가 준
             * `statusCode` 이고, 그 값의 뜻은 설계가 확정해 알려 준 것이다(omf-mes#185).
             *
             * ⚠ **값 목록을 못 받으면 잠근다.** 시드가 아직 들어가지 않아 빌 수 있고
             * (설계 omf-mes#182), 그때 열어 두면 이미 끝난 자산에도 눌리는 컨트롤이 된다.
             * 감추지 않고 사유를 밝힌다(G-2) — 목록이 들어오면 이 잠금은 저절로 풀린다.
             */}
            {statusCode !== DISPOSED_STATUS_CODE && (
              <div className="field-cell">
                <Button
                  variant="outlined"
                  disabled={isSaving || statusOptions.length === 0}
                  aria-describedby={statusOptions.length === 0 ? disposeNoteId : undefined}
                  onClick={onDispose}
                >
                  {t.actions.disposeEquipment}
                </Button>
                {statusOptions.length === 0 && (
                  <span id={disposeNoteId} className="field-note">
                    {t.actionReasons.disposeUnavailable}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
};
