import { AlertBanner, Button, Dialog, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import type { CodeOption } from './options';
import { ratioWarning } from './ratio-validation';
import { SelectField } from './select-field';
import { SCOPE_AXES, type RatioFormValues, type ScopeAxis } from './types';

const t = messages.shotConversion;

/** 축마다 다른 선택지 목록. 축이 넷이라 하나로 묶을 수 없다. */
export type ScopeOptions = Record<ScopeAxis, CodeOption[]>;

interface ReadOnlyFieldProps {
  label: string;
  value: string;
  note?: string;
}

/**
 * 값을 보여 주기만 하는 칸.
 *
 * **폼 컨트롤을 잠그지 않고 값 표기로 낸다** — 잠긴 입력칸은 「언젠가 여기서 고칠 수 있다」를
 * 뜻하는데, 범위는 이 창이 영영 정하지 않는다.
 */
const ReadOnlyField = ({ label, value, note }: ReadOnlyFieldProps) => {
  const labelId = useId();

  return (
    <div className="field-cell">
      <span className="field-label" id={labelId}>
        {label}
      </span>
      <p aria-labelledby={labelId}>{value}</p>
      {note !== undefined && <span className="field-note">{note}</span>}
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
  /** 선택 목록의 한계(잘림·실패) 안내. 없으면 붙이지 않는다 */
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
          <Button onClick={onSave} loading={isSaving}>
            {messages.common.save}
          </Button>
        </>
      }
    >
      <div className="form-grid dialog-scroll">
        {banner !== null && banner !== undefined && <div className="form-grid-full">{banner}</div>}

        {isCreate ? (
          <div className="form-grid-full">
            <fieldset className="picker-group">
              <legend className="field-label">{t.form.scopeLegend}</legend>
              {/*
               * ⭐ 비운 축이 「전체」다 — 고르지 않은 것이 아니라 값이다.
               *
               * ⛔ **`.field-note` 를 쓰지 않는다**(규범 4의 20rem 제한). 이것은 칸 하나가
               * 아니라 **묶음 넷 전체**의 설명이라, 좁은 기둥으로 접히면 그만큼 아래의
               * 필수 칸이 스크롤 밖으로 밀린다(브라우저 확인 실측).
               */}
              <p className="dialog-lead">{t.form.scopeNote}</p>

              <div className="form-grid">
                {SCOPE_AXES.map((axis) => (
                  <SelectField
                    key={axis}
                    label={t.scope[axis]}
                    options={[{ value: '', label: t.form.scopeAll }, ...scopeOptions[axis]]}
                    value={values.scope[axis]}
                    onChange={(value) => onChangeScope(axis, value)}
                    note={optionsNote}
                    error={fieldErrors[axis]}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        ) : (
          <ReadOnlyField label={t.form.scopeLegend} value={scopeText} note={t.form.scopeFixed} />
        )}

        <TextField
          label={t.fields.ratio}
          required
          value={values.ratio}
          onChange={(event) => onChange({ ratio: event.target.value })}
          placeholder={t.form.ratioPlaceholder}
          helperText={t.form.ratioNote}
          error={fieldErrors.valueNumeric}
        />

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

        <TextField
          type="date"
          label={t.form.effectiveFrom}
          required
          value={values.effectiveFrom}
          onChange={(event) => onChange({ effectiveFrom: event.target.value })}
          error={fieldErrors.effectiveFrom}
        />

        <TextField
          type="date"
          label={t.form.effectiveTo}
          value={values.effectiveTo}
          onChange={(event) => onChange({ effectiveTo: event.target.value })}
          helperText={t.form.effectiveToNote}
          error={fieldErrors.effectiveTo}
        />
      </div>
    </Dialog>
  );
};
