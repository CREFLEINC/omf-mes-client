import { Button, Dialog, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { InfoTip } from '../../patterns/info-tip';
import { validateChannel } from './channel-validation';
import { ItemPicker, type PickerSlot } from './item-picker';
import type { CodeOption } from './options';
import { asScopeId } from './scope';
import { ItemSelectField, SelectField } from './select-field';
import type {
  ChannelFormValues,
  InspectionItemSpec,
  InspectionPlan,
  InspectionPlanVersion,
} from './types';

const t = messages.collectionChannel;

const ANY_ITEM: CodeOption[] = [{ value: '', label: t.scope.anyOption }];

interface ReadOnlyFieldProps {
  label: string;
  value: string;
  /** 왜 여기서 못 바꾸는지 — 라벨 옆 ⓘ 로 둔다(관리웹 정리 시안 A). */
  info: string;
}

/**
 * 값을 보여 주기만 하는 칸.
 *
 * **폼 컨트롤을 잠그지 않고 값 표기로 낸다** — 잠긴 입력칸은 「언젠가 여기서 고칠 수 있다」를
 * 뜻하는데, 이 값들은 이 창이 영영 정하지 않는다. 사유는 라벨 옆 ⓘ 로 낸다.
 */
const ReadOnlyField = ({ label, value, info }: ReadOnlyFieldProps) => {
  const labelId = useId();

  return (
    <div className="field-cell">
      <span className="info-label">
        <span className="field-label" id={labelId}>
          {label}
        </span>
        <InfoTip text={info} />
      </span>
      <p aria-labelledby={labelId}>{value}</p>
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
  /** 조건 축의 선택지. 비운 값이 「전체」다. 품목은 칸이 서버에서 쪽으로 받는다 */
  processOptions: CodeOption[];
  /**
   * 선택 목록의 한계(잘림·실패) 안내. 없으면 붙이지 않는다.
   *
   * ⛔ **칸마다 제 출처를 받는다.** 하나로 묶어 여러 칸에 같이 붙이면 ① 같은 문구가 여럿 서고
   * ② **틀린 말을 한다** — 공장 목록이 잘렸다고 품목 칸이 말하게 된다.
   */
  unitOptionsNote?: string;
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
  processOptions,
  unitOptionsNote,
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
  /*
   * ⭐ **필수 칸이 다 차야 [저장] 이 켜진다**(팝업 시안 1장 · #360). 기준은 보내기 전 검증(`validateChannel`) 그대로 —
   * 지금 필수는 채널명 하나다. 검사 기준 · 버전 · 항목은 좁히는 길일 뿐이라 비워도 저장된다(미지정).
   */
  const canSave = Object.keys(validateChannel(values)).length === 0;

  return (
    <Dialog
      className={isCreate ? 'dialog-icon-add' : 'dialog-icon-edit'}
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
          <Button onClick={onSave} loading={isSaving} disabled={!canSave}>
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
          info={t.actionReasons.equipmentFixed}
        />

        {isCreate ? (
          <TextField
            label={t.fields.channelKey}
            placeholder={t.form.channelKeyPlaceholder}
            required
            value={values.channelKey}
            onChange={(event) => onChange({ channelKey: event.target.value })}
            error={fieldErrors.channelKey}
          />
        ) : (
          <ReadOnlyField
            label={t.fields.channelKey}
            value={values.channelKey}
            info={t.actionReasons.channelKeyFixed}
          />
        )}

        <TextField
          label={t.fields.signalName}
          placeholder={t.form.signalNamePlaceholder}
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
          {/*
           * ⭐ 비운 것이 「전체」다 — 고르지 않은 것이 아니라 값이다. 그 뜻은 묶음 이름 옆 ⓘ 로 둔다
           * (관리웹 정리 시안 A). ⓘ 의 문장이 묶음 이름에 섞이지 않게 이름은 `aria-label` 로 준다.
           */}
          <fieldset className="picker-group" aria-label={t.scope.columnHeader}>
            <legend className="field-label">
              <span className="info-label">
                {t.scope.columnHeader}
                <InfoTip text={t.scope.note} />
              </span>
            </legend>

            <div className="form-grid">
              <ItemSelectField
                label={t.scope.itemLabel}
                leadingOptions={ANY_ITEM}
                value={values.itemId === null ? '' : String(values.itemId)}
                onChange={(value) => onChange({ itemId: asScopeId(value) })}
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
