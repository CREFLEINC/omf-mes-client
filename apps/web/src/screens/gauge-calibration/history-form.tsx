import { AlertBanner, Button, DatePicker, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import {
  codeNote,
  PLACEHOLDER_AGENCY_TYPES,
  PLACEHOLDER_HISTORY_TYPES,
  PLACEHOLDER_RESULT_CODES,
} from './code-options';
import { FieldLabel } from './field-label';
import {
  isCalibrationType,
  updatesMaster,
  type CalibrationDraft,
  type DraftErrors,
} from './form-draft';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.gaugeCalibration;

export interface HistoryFormProps {
  draft: CalibrationDraft;
  errors: DraftErrors;
  equipmentOptions: SelectOption[];
  equipmentNote?: string;
  isSaving: boolean;
  onChange: (draft: CalibrationDraft) => void;
  onSubmit: () => void;
  onReset: () => void;
}

/**
 * 이력 등록 폼.
 *
 * ⛔ **저장하면 끝이다.** 그 무게를 화면이 먼저 말한다 — 폼 머리에 「고칠 수 없다」와 「무엇이
 * 함께 갱신되는가」를 상시로 두고, 저장 직전에 요약으로 한 번 더 확인받는다.
 *
 * ⭐ **검교정 전용 칸을 감추지 않고 비활성 + 사유로 둔다.** 감추면 다른 유형을 골랐을 때 칸이
 * 사라진 이유를 알 수 없고, 그 칸이 있었다는 사실조차 남지 않는다.
 *
 * ⚠ **교정 기관 구분은 값 목록이 하나도 없어 잠겨 있다.** 그래서 「외부면 기관 이름 필수」라는
 * 짝 제약을 걸 수 없다 — 어느 값이 외부인지 화면이 알 수 없기 때문이다. 기관 이름은 자유 입력
 * 그대로 두고, 값이 서면 그때 짝 제약을 세운다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const HistoryForm = ({
  draft,
  errors,
  equipmentOptions,
  equipmentNote,
  isSaving,
  onChange,
  onSubmit,
  onReset,
}: HistoryFormProps) => {
  const performedOnId = useId();
  const nextDueOnId = useId();
  const certificateId = `${performedOnId}-certificate`;
  const agencyNameId = `${performedOnId}-agency`;
  const toleranceId = `${performedOnId}-tolerance`;
  const remarksId = `${performedOnId}-remarks`;

  const calibrationOnly = isCalibrationType(draft);
  const resultBlocked = PLACEHOLDER_RESULT_CODES.length === 0;

  const set = (patch: Partial<CalibrationDraft>): void => {
    onChange({ ...draft, ...patch });
  };

  return (
    <>
      {/*
       * ⛔ 이력은 불변이다. 이 안내는 저장 뒤가 아니라 **입력하는 내내** 서 있어야 한다 —
       * 저장 직후에 알려 주면 이미 늦었다.
       */}
      <div className="banner-slot">
        <AlertBanner variant="warning" title={t.form.immutableLead}>
          {t.form.masterEffect}
        </AlertBanner>
      </div>

      <div className="form-grid">
        <SelectField
          label={t.form.equipment}
          options={equipmentOptions}
          value={draft.equipment}
          note={equipmentNote}
          error={errors.equipment}
          placeholder={t.form.selectPlaceholder}
          wide
          onChange={(value) => {
            set({ equipment: value });
          }}
        />

        <SelectField
          label={t.form.historyType}
          options={[...PLACEHOLDER_HISTORY_TYPES]}
          value={draft.historyTypeCode}
          note={codeNote(PLACEHOLDER_HISTORY_TYPES, t.form.historyType)}
          error={errors.historyTypeCode}
          placeholder={t.form.selectPlaceholder}
          disabled={PLACEHOLDER_HISTORY_TYPES.length === 0}
          wide
          onChange={(value) => {
            set({ historyTypeCode: value });
          }}
        />

        <div className="field-cell">
          <FieldLabel htmlFor={performedOnId} label={t.form.performedOn} />
          <DatePicker
            id={performedOnId}
            mode="single"
            clearable
            placeholder={messages.common.selectDate}
            invalid={errors.performedOn !== undefined}
            value={draft.performedOn === '' ? null : draft.performedOn}
            onChange={(value) => {
              set({ performedOn: value ?? '' });
            }}
          />
          {errors.performedOn !== undefined && (
            <span className="field-error">{errors.performedOn}</span>
          )}
        </div>

        <SelectField
          label={t.form.result}
          options={[...PLACEHOLDER_RESULT_CODES]}
          value={draft.resultCode}
          note={
            resultBlocked
              ? t.codes.resultBlocked
              : codeNote(PLACEHOLDER_RESULT_CODES, t.form.result)
          }
          error={errors.resultCode}
          placeholder={t.form.selectPlaceholder}
          disabled={resultBlocked}
          wide
          onChange={(value) => {
            set({ resultCode: value });
          }}
        />

        {/* 여기서부터 검교정 전용이다 — 다른 유형에서는 잠그고 사유를 붙인다. */}
        <div className="field-cell">
          <FieldLabel htmlFor={certificateId} label={t.form.certificateNo} />
          <TextField
            id={certificateId}
            value={draft.certificateNo}
            disabled={!calibrationOnly}
            onChange={(event) => {
              set({ certificateNo: event.target.value });
            }}
          />
          {!calibrationOnly && <span className="field-note">{t.form.calibrationOnly}</span>}
        </div>

        <SelectField
          label={t.form.agencyType}
          options={[...PLACEHOLDER_AGENCY_TYPES]}
          value={draft.agencyTypeCode}
          note={
            calibrationOnly
              ? codeNote(PLACEHOLDER_AGENCY_TYPES, t.form.agencyType)
              : t.form.calibrationOnly
          }
          placeholder={t.form.selectPlaceholder}
          /* 값 목록이 비어 있으면 열어 둬도 나올 것이 없다 — 눌러도 아무 일이 없으면 고장으로 읽힌다. */
          disabled={!calibrationOnly || PLACEHOLDER_AGENCY_TYPES.length === 0}
          wide
          onChange={(value) => {
            set({ agencyTypeCode: value });
          }}
        />

        <div className="field-cell">
          <FieldLabel htmlFor={agencyNameId} label={t.form.agencyName} />
          <TextField
            id={agencyNameId}
            value={draft.agencyName}
            disabled={!calibrationOnly}
            onChange={(event) => {
              set({ agencyName: event.target.value });
            }}
          />
          {!calibrationOnly && <span className="field-note">{t.form.calibrationOnly}</span>}
        </div>

        <div className="field-cell">
          <FieldLabel htmlFor={nextDueOnId} label={t.form.nextDueOn} />
          <DatePicker
            id={nextDueOnId}
            mode="single"
            clearable
            placeholder={messages.common.selectDate}
            disabled={!calibrationOnly}
            invalid={errors.nextDueOn !== undefined}
            value={draft.nextDueOn === '' ? null : draft.nextDueOn}
            onChange={(value) => {
              set({ nextDueOn: value ?? '' });
            }}
          />
          {errors.nextDueOn !== undefined && (
            <span className="field-error">{errors.nextDueOn}</span>
          )}
          {/*
           * ⚠ 예정일을 화면이 계산해 제안하지 못한다 — 계측기 마스터가 검교정 주기를 **코드**로만
           * 갖고 있어 그 길이를 알 수 없다. 지어내면 성적서와 다른 날이 마스터로 넘어간다.
           */}
          <span className="field-note">
            {calibrationOnly ? t.form.nextDueManual : t.form.calibrationOnly}
          </span>
        </div>

        <div className="field-cell">
          <FieldLabel htmlFor={toleranceId} label={t.form.tolerance} />
          <TextField
            id={toleranceId}
            value={draft.toleranceNote}
            disabled={!calibrationOnly}
            onChange={(event) => {
              set({ toleranceNote: event.target.value });
            }}
          />
          {!calibrationOnly && <span className="field-note">{t.form.calibrationOnly}</span>}
        </div>

        <div className="field-cell form-grid-full">
          <FieldLabel htmlFor={remarksId} label={t.form.remarks} />
          <TextField
            id={remarksId}
            value={draft.remarks}
            onChange={(event) => {
              set({ remarks: event.target.value });
            }}
          />
        </div>
      </div>

      <div className="form-actions">
        <Button variant="outlined" onClick={onReset} disabled={isSaving}>
          {t.form.reset}
        </Button>
        <Button onClick={onSubmit} disabled={isSaving || resultBlocked}>
          {t.form.submit}
        </Button>
      </div>
      {/* 저장이 무엇을 함께 바꾸는지 액션 옆에 한 번 더 적는다. */}
      {updatesMaster(draft) && <p className="pane-lead">{t.confirm.masterEffect}</p>}
    </>
  );
};
