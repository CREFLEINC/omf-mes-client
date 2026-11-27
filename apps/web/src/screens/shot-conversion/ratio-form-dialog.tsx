import { AlertBanner, Button, DatePicker, Dialog, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { InfoTip } from '../../patterns/info-tip';
import { FieldLabel } from './field-label';
import type { CodeOption } from './options';
import { ratioWarning } from './ratio-validation';
import { SelectField } from './select-field';
import { SCOPE_AXES, type RatioFormValues, type ScopeAxis } from './types';

const t = messages.shotConversion;

/** 축마다 다른 선택지 목록. 축이 넷이라 하나로 묶을 수 없다. 품목은 칸이 직접 서버에 검색해 받아 여기 없다. */
export type ScopeOptions = Record<Exclude<ScopeAxis, 'itemId'>, CodeOption[]>;

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
 * 뜻하는데, 범위는 이 창이 영영 정하지 않는다.
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

export interface RatioFormDialogProps {
  mode: 'create' | 'edit';
  values: RatioFormValues;
  onChange: (patch: Partial<RatioFormValues>) => void;
  onChangeScope: (axis: ScopeAxis, value: string) => void;
  fieldErrors: Record<string, string>;
  banner: ReactNode;
  scopeOptions: ScopeOptions;
  /** 수정에서 보이는 범위 문구 — 바꿀 수 없으므로 값 표기로 낸다 */
  scopeText: string;
  /** 선택 목록의 한계(잘림·실패) 안내. 있으면 「적용 범위」 ⓘ 뒤에 붙인다 */
  optionsNote?: string;
  isSaving: boolean;
  onClose: () => void;
  onSave: () => void;
}

/**
 * 비율 정책 등록·수정 창.
 *
 * ⛔ **「정책 코드」 입력란이 없다**(스펙 §5-1) — 이 화면이 쓰는 코드는 하나로 고정이고
 * 화면이 붙인다. 기계가 정할 수 있는 것을 사람에게 묻지 않는다.
 *
 * ⛔ **수정에서 범위를 바꿀 수 없다** — 계약의 수정 본문에 축이 없다. 「바꾸면 다른 정책이
 * 된다」가 그 이유이며, 잠긴 선택칸이 아니라 **값 표기 + 사유**로 낸다.
 *
 * ⭐ **스크림 클릭으로 닫히지 않게 한다** — 사용자가 친 값을 지킨다.
 */
export const RatioFormDialog = ({
  mode,
  values,
  onChange,
  onChangeScope,
  fieldErrors,
  banner,
  scopeOptions,
  scopeText,
  optionsNote,
  isSaving,
  onClose,
  onSave,
}: RatioFormDialogProps) => {
  const isCreate = mode === 'create';
  const warning = ratioWarning(values);
  const ratioId = useId();
  const effectiveFromId = useId();
  const effectiveToId = useId();
  const effectiveFromErrorId = `${effectiveFromId}-error`;
  const effectiveToErrorId = `${effectiveToId}-error`;
  /* 필수 칸(비율·유효 시작일)이 다 찼을 때만 저장을 연다. 적용 범위는 비워도 「전체」라 값이다. */
  const isFilled = values.ratio.trim() !== '' && values.effectiveFrom !== '';
  /* 선택 목록이 잘렸거나 못 받았을 때만 그 안내를 범위 설명 뒤에 붙인다 — 칸마다 되풀이하지 않는다. */
  const scopeInfo =
    optionsNote === undefined ? t.form.scopeNote : `${t.form.scopeNote} ${optionsNote}`;

  return (
    <Dialog
      open
      onClose={onClose}
      closeOnBackdropClick={false}
      size="lg"
      title={isCreate ? t.form.createTitle : t.form.editTitle}
      footer={
        <>
          <Button variant="outlined" onClick={onClose} disabled={isSaving}>
            {messages.common.cancel}
          </Button>
          <Button onClick={onSave} loading={isSaving} disabled={!isFilled}>
            {messages.common.save}
          </Button>
        </>
      }
    >
      <div className="form-grid dialog-scroll">
        {banner !== null && banner !== undefined && <div className="form-grid-full">{banner}</div>}

        {isCreate ? (
          <div className="form-grid-full">
            {/*
             * ⭐ 비운 축이 「전체」다 — 고르지 않은 것이 아니라 값이다. 묶음 넷 전체의 설명이라
             * 묶음 이름 옆 ⓘ 로 둔다(관리웹 정리 시안 A). ⓘ 의 문장이 묶음 이름에 섞이지 않게
             * 이름은 `aria-label` 로 준다.
             */}
            <fieldset
              className="picker-group shot-conversion-scope"
              aria-label={t.form.scopeLegend}
            >
              <legend className="field-label">
                <span className="info-label">
                  {t.form.scopeLegend}
                  <InfoTip text={scopeInfo} />
                </span>
              </legend>

              <div className="form-grid">
                {SCOPE_AXES.map((axis) => (
                  <SelectField
                    key={axis}
                    label={t.scope[axis]}
                    options={[
                      { value: '', label: t.form.scopeAll },
                      ...(axis === 'itemId' ? [] : scopeOptions[axis]),
                    ]}
                    searchItems={axis === 'itemId'}
                    value={values.scope[axis]}
                    onChange={(value) => onChangeScope(axis, value)}
                    error={fieldErrors[axis]}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        ) : (
          <ReadOnlyField label={t.form.scopeLegend} value={scopeText} info={t.form.scopeFixed} />
        )}

        {/* 비율의 뜻(곱해 타발수를 낸다)은 라벨 옆 ⓘ 로(관리웹 정리 시안 A). */}
        <div className="field-cell">
          <FieldLabel htmlFor={ratioId} label={t.fields.ratio} required info={t.form.ratioNote} />
          <TextField
            id={ratioId}
            required
            value={values.ratio}
            onChange={(event) => onChange({ ratio: event.target.value })}
            placeholder={t.form.ratioPlaceholder}
            error={fieldErrors.valueNumeric}
          />
        </div>

        {/*
         * ⚠ **막지 않고 말한다** — 한 번에 여러 번 타발하는 공정이 있을 수 있다.
         * 다만 잘못 친 0 하나로 그렇게 되는 일이 훨씬 흔해 알리기는 한다.
         */}
        {warning !== null && (
          <div className="form-grid-full">
            <div className="banner-slot">
              <AlertBanner variant="warning">{warning}</AlertBanner>
            </div>
          </div>
        )}

        {/* 공용 날짜 칸 — 값은 그대로 `YYYY-MM-DD` 로 오간다. */}
        <div className="field-cell">
          <FieldLabel htmlFor={effectiveFromId} label={t.form.effectiveFrom} required />
          <DatePicker
            id={effectiveFromId}
            mode="single"
            placeholder={messages.common.selectDate}
            value={values.effectiveFrom === '' ? null : values.effectiveFrom}
            invalid={fieldErrors.effectiveFrom !== undefined}
            aria-describedby={
              fieldErrors.effectiveFrom === undefined ? undefined : effectiveFromErrorId
            }
            onChange={(value) => onChange({ effectiveFrom: value })}
          />
          {fieldErrors.effectiveFrom !== undefined && (
            <span id={effectiveFromErrorId} className="field-error">
              {fieldErrors.effectiveFrom}
            </span>
          )}
        </div>

        {/* 비우면 끝이 없다는 뜻은 라벨 옆 ⓘ 로(관리웹 정리 시안 A). */}
        <div className="field-cell">
          <FieldLabel
            htmlFor={effectiveToId}
            label={t.form.effectiveTo}
            info={t.form.effectiveToNote}
          />
          {/* 비울 수 있는 칸이라 지우기를 둔다 — 지우면 빈 값(끝 없음)으로 돌아간다. */}
          <DatePicker
            id={effectiveToId}
            mode="single"
            clearable
            placeholder={messages.common.selectDate}
            value={values.effectiveTo === '' ? null : values.effectiveTo}
            invalid={fieldErrors.effectiveTo !== undefined}
            aria-describedby={
              fieldErrors.effectiveTo === undefined ? undefined : effectiveToErrorId
            }
            onChange={(value) => onChange({ effectiveTo: value ?? '' })}
          />
          {fieldErrors.effectiveTo !== undefined && (
            <span id={effectiveToErrorId} className="field-error">
              {fieldErrors.effectiveTo}
            </span>
          )}
        </div>
      </div>
    </Dialog>
  );
};
