import { Button, Dialog, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { ItemPicker, type PickerSlot } from './item-picker';
import type { CodeOption } from './options';
import { asScopeId } from './scope';
import { SelectField } from './select-field';
import type {
  ChannelFormValues,
  InspectionItemSpec,
  InspectionPlan,
  InspectionPlanVersion,
} from './types';

const t = messages.collectionChannel;

interface ReadOnlyFieldProps {
  label: string;
  value: string;
  note: string;
}

/**
 * 값을 보여 주기만 하는 칸.
 *
 * **폼 컨트롤을 잠그지 않고 값 표기로 낸다** — 잠긴 입력칸은 「언젠가 여기서 고칠 수 있다」를
 * 뜻하는데, 이 값들은 이 창이 영영 정하지 않는다. 사유는 함께 낸다.
 */
const ReadOnlyField = ({ label, value, note }: ReadOnlyFieldProps) => {
  const labelId = useId();

  return (
    <div className="field-cell">
      <span className="field-label" id={labelId}>
        {label}
      </span>
      <p aria-labelledby={labelId}>{value}</p>
      <span className="field-note">{note}</span>
    </div>
  );
};

export interface ChannelFormDialogProps {
  mode: 'create' | 'edit';
  /** 이 채널이 매인 설비. 등록에서도 수정에서도 여기서 옮길 수 없다 */
  equipmentLabel: string;
  values: ChannelFormValues;
  onChange: (patch: Partial<ChannelFormValues>) => void;
  fieldErrors: Record<string, string>;
  banner: ReactNode;
  unitOptions: CodeOption[];
  /** 조건 축의 선택지. 비운 값이 「전체」다 */
  itemOptions: CodeOption[];
  processOptions: CodeOption[];
  /**
   * 선택 목록의 한계(잘림·실패) 안내. 없으면 붙이지 않는다.
   *
   * ⛔ **칸마다 제 출처를 받는다.** 하나로 묶어 세 칸에 같이 붙이면 ① 같은 문구가 셋 서고
   * ② **틀린 말을 한다** — 공장 목록이 잘렸다고 품목 칸이 말하게 된다.
   */
  unitOptionsNote?: string;
  itemOptionsNote?: string;
  processOptionsNote?: string;
  isSaving: boolean;
  /** 검사 항목을 찾아가는 세 칸 — 저장되지 않고 좁히는 데만 쓴다 */
  inspectionPlanId: number | null;
  onChangePlan: (inspectionPlanId: number | null) => void;
  inspectionPlanVersionId: number | null;
  onChangeVersion: (inspectionPlanVersionId: number | null) => void;
  plans: PickerSlot<InspectionPlan>;
  versions: PickerSlot<InspectionPlanVersion>;
  specs: PickerSlot<InspectionItemSpec>;
  /** 단위 식별자를 코드로 옮기는 표. 옮기지 못하는 값이 있다 */
  uomCodeById: ReadonlyMap<number, string>;
  onClose: () => void;
  onSave: () => void;
}

/**
 * 수집 채널 등록·수정 창.
 *
 * ⭐ **채널명은 등록에서만 정한다** — 계약의 수정 본문에 없다. 수정에서는 잠긴 입력칸이
 * 아니라 **값 표기 + 사유**로 낸다(공유계약 G-2).
 *
 * ⭐ **스크림 클릭으로 닫히지 않게 한다** — 사용자가 친 값을 지킨다. Escape 와 X 는 남긴다:
 * 둘은 나가겠다고 «말한 것»이라 파기가 곧 그 뜻이다.
 */
export const ChannelFormDialog = ({
  mode,
  equipmentLabel,
  values,
  onChange,
  fieldErrors,
  banner,
  unitOptions,
  itemOptions,
  processOptions,
  unitOptionsNote,
  itemOptionsNote,
  processOptionsNote,
  isSaving,
  inspectionPlanId,
  onChangePlan,
  inspectionPlanVersionId,
  onChangeVersion,
  plans,
  versions,
  specs,
  uomCodeById,
  onClose,
  onSave,
}: ChannelFormDialogProps) => {
  const isCreate = mode === 'create';

  return (
    <Dialog
      open
      onClose={onClose}
      closeOnBackdropClick={false}
      /*
       * ⭐ **넓게 연다.** 검사 항목에 닿으려면 선택칸이 셋 필요하고, 좁은 창에서는 값이
       * 트리거 안에서 잘려 «무엇을 고른 것인지» 읽히지 않는다(브라우저 확인 실측).
       */
      size="lg"
      title={isCreate ? t.form.createTitle : t.form.editTitle}
      footer={
        <>
          <Button variant="outlined" onClick={onClose} disabled={isSaving}>
            {messages.common.cancel}
          </Button>
          <Button onClick={onSave} loading={isSaving}>
            {messages.common.save}
          </Button>
        </>
      }
    >
      <div className="form-grid dialog-scroll">
        {banner !== null && banner !== undefined && <div className="form-grid-full">{banner}</div>}

        {/* 어느 설비에 더하는지 창이 스스로 말한다 — 좌우가 멀어지면 고른 것을 잊는다. */}
        <ReadOnlyField
          label={t.fields.equipment}
          value={equipmentLabel}
          note={t.actionReasons.equipmentFixed}
        />

        {isCreate ? (
          <TextField
            label={t.fields.channelKey}
            required
            value={values.channelKey}
            onChange={(event) => onChange({ channelKey: event.target.value })}
            error={fieldErrors.channelKey}
          />
        ) : (
          <ReadOnlyField
            label={t.fields.channelKey}
            value={values.channelKey}
            note={t.actionReasons.channelKeyFixed}
          />
        )}

        <TextField
          label={t.fields.signalName}
          value={values.signalName}
          onChange={(event) => onChange({ signalName: event.target.value })}
          error={fieldErrors.signalName}
        />

        <SelectField
          label={t.fields.unit}
          options={unitOptions}
          value={values.unitCode}
          onChange={(value) => onChange({ unitCode: value })}
          placeholder={t.form.unitPlaceholder}
          note={unitOptionsNote}
          error={fieldErrors.unitCode}
        />

        {/*
         * ⭐ **조건은 「언제 적용되는가」다** — 채널명과 달리 **수정에서도 바꿀 수 있다**
         * (계약의 수정 본문이 받는다). 같은 설비의 같은 채널을 조건만 달리해 여러 줄 둘 수
         * 있고, 그것이 이 축을 둔 이유다(설계 회신 `omf-mes#203` 질문1).
         */}
        <div className="form-grid-full">
          <fieldset className="picker-group">
            <legend className="field-label">{t.scope.columnHeader}</legend>
            {/* ⭐ 비운 것이 「전체」다 — 고르지 않은 것이 아니라 값이다. */}
            <p className="dialog-lead">{t.scope.note}</p>

            <div className="form-grid">
              <SelectField
                label={t.scope.itemLabel}
                options={[{ value: '', label: t.scope.anyOption }, ...itemOptions]}
                value={values.itemId === null ? '' : String(values.itemId)}
                onChange={(value) => onChange({ itemId: asScopeId(value) })}
                note={itemOptionsNote}
                error={fieldErrors.itemId}
              />
              <SelectField
                label={t.scope.processLabel}
                options={[{ value: '', label: t.scope.anyOption }, ...processOptions]}
                value={values.processId === null ? '' : String(values.processId)}
                onChange={(value) => onChange({ processId: asScopeId(value) })}
                note={processOptionsNote}
                error={fieldErrors.processId}
              />
            </div>
          </fieldset>
        </div>

        <ItemPicker
          inspectionItemId={values.inspectionItemId}
          onChangeItem={(inspectionItemId) => onChange({ inspectionItemId })}
          inspectionPlanId={inspectionPlanId}
          onChangePlan={onChangePlan}
          inspectionPlanVersionId={inspectionPlanVersionId}
          onChangeVersion={onChangeVersion}
          plans={plans}
          versions={versions}
          specs={specs}
          channelUnitCode={values.unitCode}
          uomCodeById={uomCodeById}
        />
      </div>
    </Dialog>
  );
};
