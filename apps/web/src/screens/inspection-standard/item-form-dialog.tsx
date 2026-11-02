import { Button, Checkbox, Dialog, Icon, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { FieldLabel } from './field-label';
import { SelectField } from './select-field';
import type { ItemDraft, SelectOption } from './types';

const t = messages.inspectionStandard;

export interface ItemFormDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  values: ItemDraft;
  onChange: (patch: Partial<ItemDraft>) => void;
  /** 저장을 막는 오류. 이것이 있으면 확인이 눌리지 않는다 */
  fieldErrors: Record<string, string>;
  /** 저장을 막지 않는 경고. 확인은 그대로 눌린다 */
  fieldWarnings: Record<string, string>;
  /** 「사용 중인 것 + 지금 고른 값」만 온다. 목록을 고르는 규칙은 화면이 갖는다. */
  dataTypeOptions: SelectOption[];
  inspectionMethodOptions: SelectOption[];
  uomOptions: SelectOption[];
  equipmentOptions: SelectOption[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

/**
 * 검사 항목 한 행의 전체 편집.
 *
 * **표에는 요약만 두고 전체 편집을 이 창에서 한다** — 계약의 항목에는 필드가 15개라
 * 열로 펼치면 표가 짓눌린다.
 *
 * **이 창의 확인은 서버 저장이 아니다.** 순서 컬럼에 유일 제약이 있어 행 단위 저장이 성립하지 않으므로,
 * 확인은 표(로컬 초안)에만 반영하고 서버 반영은 「저장」 한 번뿐이다(공유계약 A-5).
 * 그 사실을 창 안에서 밝힌다 — 밝히지 않으면 확인을 누르고 창을 닫은 사용자가 저장된 줄 안다.
 *
 * **조건부 필수·조건부 표시를 만들지 않는다.** 계약의 `dataTypeCode` 값 목록이 [추정]이라
 * 자료형으로 표시를 가르면 지어낸 값에 화면 구조가 매달린다 — 단위·목표값·상하한은 항상 보이고 항상 선택이다.
 */
export const ItemFormDialog = ({
  open,
  mode,
  values,
  onChange,
  fieldErrors,
  fieldWarnings,
  dataTypeOptions,
  inspectionMethodOptions,
  uomOptions,
  equipmentOptions,
  isSubmitting,
  onClose,
  onSubmit,
}: ItemFormDialogProps) => {
  const codeId = useId();
  const nameId = useId();
  const measurementCountId = useId();
  const targetValueId = useId();
  const lowerLimitId = useId();
  const upperLimitId = useId();
  const ph = t.dialog.itemPlaceholders;

  /*
   * 비어 있는 필수 칸은 처음부터 테두리만 빨갛게 한다 — 「필수 입력 항목입니다」 글은 화면에 띄우지 않고
   * 화면 읽기로만 남긴다(검사 조회·판정과 같다 · 사용자 지시 #196). 다른 오류(중복 · 형식)는 글로 낸다.
   */
  const requiredMessage = t.validation.required;
  const isBlank = (value: string): boolean => value.trim() === '';
  const shownError = (key: string): string | undefined =>
    fieldErrors[key] === requiredMessage ? undefined : fieldErrors[key];
  const requiredText = (key: string, value: string) => {
    const error = shownError(key);
    if (error !== undefined) return { error };
    return isBlank(value)
      ? { error: requiredMessage, containerClassName: 'inspection-standard-border-only' }
      : {};
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      /* 닫기는 「취소」로 한다 — 머리의 ✕는 두지 않는다(사용자 지시 · #196). */
      showCloseButton={false}
      title={mode === 'create' ? t.dialog.itemCreateTitle : t.dialog.itemEditTitle}
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            {messages.common.cancel}
          </Button>
          <Button loading={isSubmitting} disabled={isSubmitting} onClick={onSubmit}>
            {messages.common.confirm}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        {/* 확인칸은 맨 위에 둔다(사용자 지시 · #196). */}
        <Checkbox
          checked={values.requiredFlag}
          onChange={(event) => onChange({ requiredFlag: event.target.checked })}
        >
          {t.dialog.requiredFlagLabel}
        </Checkbox>
        <Checkbox
          checked={values.automaticJudgment}
          onChange={(event) => onChange({ automaticJudgment: event.target.checked })}
        >
          {t.dialog.automaticJudgmentLabel}
        </Checkbox>

        <div className="field-cell">
          <FieldLabel htmlFor={codeId} label={t.fields.inspectionItemCode} required />
          <TextField
            id={codeId}
            value={values.inspectionItemCode}
            placeholder={ph.inspectionItemCode}
            onChange={(event) => onChange({ inspectionItemCode: event.target.value })}
            {...requiredText('inspectionItemCode', values.inspectionItemCode)}
            aria-required
          />
        </div>

        <div className="field-cell">
          <FieldLabel htmlFor={nameId} label={t.fields.inspectionItemName} required />
          <TextField
            id={nameId}
            value={values.inspectionItemName}
            placeholder={ph.inspectionItemName}
            onChange={(event) => onChange({ inspectionItemName: event.target.value })}
            {...requiredText('inspectionItemName', values.inspectionItemName)}
            aria-required
          />
        </div>

        <SelectField
          label={t.fields.dataType}
          required
          options={dataTypeOptions}
          value={values.dataTypeCode}
          placeholder={ph.dataType}
          onChange={(dataTypeCode) => onChange({ dataTypeCode })}
          error={shownError('dataTypeCode')}
          invalid={isBlank(values.dataTypeCode)}
        />

        <SelectField
          label={t.fields.uom}
          options={[{ value: '', label: t.values.empty }, ...uomOptions]}
          value={values.uomId}
          placeholder={ph.uom}
          onChange={(uomId) => onChange({ uomId })}
          error={fieldErrors.uomId}
        />

        {/*
         * 목표값이 범위 밖인 것은 **경고이지 차단이 아니다**(계약 A-9 ⓑ) —
         * 관리 한계와 규격 한계가 다른 경우가 업무상 정상이라 서버가 허용하기로 정했다.
         * 경고를 오류 자리에 넣으면 확인이 막힌 것처럼 보이므로 보조 문구로 낸다.
         */}
        <div className="field-cell">
          <FieldLabel htmlFor={targetValueId} label={t.fields.targetValue} />
          <TextField
            id={targetValueId}
            type="number"
            value={values.targetValue}
            placeholder={ph.targetValue}
            onChange={(event) => onChange({ targetValue: event.target.value })}
            error={fieldErrors.targetValue}
            helperText={fieldWarnings.targetValue}
          />
        </div>

        {/* 라벨은 다른 칸과 같은 `FieldLabel` 로 단다 — 내장 라벨이면 라벨 줄 모양이 갈린다(#196). */}
        <div className="field-cell">
          <FieldLabel htmlFor={lowerLimitId} label={t.fields.lowerLimit} />
          <TextField
            id={lowerLimitId}
            type="number"
            value={values.lowerLimit}
            placeholder={ph.lowerLimit}
            onChange={(event) => onChange({ lowerLimit: event.target.value })}
            error={fieldErrors.lowerLimit}
          />
        </div>

        <div className="field-cell">
          <FieldLabel htmlFor={upperLimitId} label={t.fields.upperLimit} />
          <TextField
            id={upperLimitId}
            type="number"
            value={values.upperLimit}
            placeholder={ph.upperLimit}
            onChange={(event) => onChange({ upperLimit: event.target.value })}
            error={fieldErrors.upperLimit}
          />
        </div>

        {/* 계약 CHECK > 0이고 표본 번호의 상한이라 정수여야 한다. */}
        <div className="field-cell">
          <FieldLabel htmlFor={measurementCountId} label={t.fields.measurementCount} required />
          <TextField
            id={measurementCountId}
            type="number"
            min={1}
            step={1}
            value={values.measurementCount}
            onChange={(event) => onChange({ measurementCount: event.target.value })}
            {...requiredText('measurementCount', values.measurementCount)}
            aria-required
          />
        </div>

        <SelectField
          label={t.fields.inspectionMethod}
          options={inspectionMethodOptions}
          value={values.inspectionMethodCode}
          placeholder={ph.inspectionMethod}
          onChange={(inspectionMethodCode) => onChange({ inspectionMethodCode })}
          error={fieldErrors.inspectionMethodCode}
        />

        <SelectField
          label={t.fields.defaultInspectionEquipment}
          options={[{ value: '', label: t.values.empty }, ...equipmentOptions]}
          value={values.defaultInspectionEquipmentId}
          placeholder={ph.defaultInspectionEquipment}
          onChange={(defaultInspectionEquipmentId) => onChange({ defaultInspectionEquipmentId })}
          error={fieldErrors.defaultInspectionEquipmentId}
        />
      </div>

      {/* 안내 알약 — 품질 기준 정보 탭의 안내와 같은 모양(사용자 시안 · #208). */}
      <p className="inspection-standard-notice-label inspection-standard-item-local-note">
        <Icon name="info" size={18} aria-hidden />
        {t.dialog.itemLocalNote}
      </p>
    </Dialog>
  );
};
