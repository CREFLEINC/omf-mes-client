import { Checkbox, Select, TextField } from '@crefle/web-ui';
import type { FourMChangeForward } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import type { CodeOption } from './code-options';
import { FieldLabel } from './field-label';

const t = messages.iqcInspection.result.fourMChange;

/** 변경 내용 길이 상한 — 서버 계약 `fourMChange.remarks` maxLength(장부 P-86). */
export const FOUR_M_REMARKS_MAX = 500;

/** 화면이 쥐는 4M 변경품 초안(omf-all-around#63). 체크를 풀면 변경 종류·내용을 보내지 않는다. */
export interface FourMChangeDraft {
  checked: boolean;
  changeTypeCode: string;
  remarks: string;
}

export const EMPTY_FOUR_M_CHANGE: FourMChangeDraft = {
  checked: false,
  changeTypeCode: '',
  remarks: '',
};

/** 서버에 남은 기록 → 초안. 기록이 없으면 변경품이 아니다. */
export const fourMDraftOf = (stored: FourMChangeForward | null): FourMChangeDraft =>
  stored === null
    ? EMPTY_FOUR_M_CHANGE
    : { checked: true, changeTypeCode: stored.changeTypeCode, remarks: stored.remarks ?? '' };

/** 초안 → 쓰기 본문. 체크를 풀었으면 `null`(그 LOT 의 기록을 지운다). */
export const fourMBodyOf = (draft: FourMChangeDraft): FourMChangeForward | null => {
  if (!draft.checked) return null;
  const remarks = draft.remarks.trim();
  return { changeTypeCode: draft.changeTypeCode, ...(remarks === '' ? {} : { remarks }) };
};

/** 체크했는데 변경 종류가 없으면 저장·확정을 막는다(서버도 400). */
export const isFourMIncomplete = (draft: FourMChangeDraft): boolean =>
  draft.checked && draft.changeTypeCode === '';

export const isSameFourM = (a: FourMChangeDraft, b: FourMChangeDraft): boolean =>
  a.checked === b.checked &&
  (!a.checked || (a.changeTypeCode === b.changeTypeCode && a.remarks.trim() === b.remarks.trim()));

export interface FourMChangeProps {
  draft: FourMChangeDraft;
  options: readonly CodeOption[];
  onChange: (next: FourMChangeDraft) => void;
  disabled: boolean;
}

/**
 * 종합 판정 아래 — 4M 변경품 체크와, 체크하면 변경 종류(필수)·변경 내용(omf-all-around#63).
 * 판정과 함께 임시 저장·확정에 실린다. 투입을 막지 않고 POP 투입 때 알리기만 한다.
 */
export const FourMChange = ({ draft, options, onChange, disabled }: FourMChangeProps) => {
  const typeId = useId();
  const remarksId = useId();
  const typeMissing = isFourMIncomplete(draft);

  return (
    <div className="iqc-inspection-four-m" role="group" aria-label={t.label}>
      <Checkbox
        checked={draft.checked}
        disabled={disabled}
        onChange={(event) => {
          onChange({ ...draft, checked: event.target.checked });
        }}
      >
        {t.label}
      </Checkbox>
      <p className="field-note">{t.hint}</p>
      {draft.checked && (
        <div className="form-grid iqc-inspection-four-m-fields">
          <div className="field-cell">
            <FieldLabel htmlFor={typeId} label={t.changeType} required />
            <Select
              id={typeId}
              options={[...options]}
              value={draft.changeTypeCode}
              placeholder={t.changeTypePlaceholder}
              invalid={typeMissing}
              aria-describedby={typeMissing ? `${typeId}-error` : undefined}
              disabled={disabled || options.length === 0}
              onChange={(value) => {
                onChange({ ...draft, changeTypeCode: value });
              }}
            />
            {options.length === 0 && <p className="field-note">{t.noChangeTypes}</p>}
            {typeMissing && options.length > 0 && (
              <span id={`${typeId}-error`} className="field-error">
                {t.changeTypeMissing}
              </span>
            )}
          </div>
          <div className="field-cell">
            <FieldLabel htmlFor={remarksId} label={t.remarks} />
            <TextField
              id={remarksId}
              fullWidth
              placeholder={t.remarksPlaceholder}
              value={draft.remarks}
              maxLength={FOUR_M_REMARKS_MAX}
              disabled={disabled}
              onChange={(event) => {
                onChange({ ...draft, remarks: event.target.value });
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
