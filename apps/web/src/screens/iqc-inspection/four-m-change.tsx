import { Checkbox, TextField } from '@crefle/web-ui';
import type { FourMChangeForward } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { ErrorText, FieldLabel } from './field-label';

const t = messages.iqcInspection.result.fourMChange;

/** 변경 내용 길이 상한 — 서버 계약 `fourMChange.remarks` maxLength(장부 P-86). */
export const FOUR_M_REMARKS_MAX = 500;

/**
 * 화면이 쥐는 4M 변경품 초안(omf-all-around#63). 체크를 풀면 변경 내용을 보내지 않는다.
 * 변경 종류는 받지 않는다(omf-all-around#133) — 비고(변경 내용)만 적는다.
 */
export interface FourMChangeDraft {
  checked: boolean;
  remarks: string;
}

export const EMPTY_FOUR_M_CHANGE: FourMChangeDraft = {
  checked: false,
  remarks: '',
};

/** 서버에 남은 기록 → 초안. 기록이 없으면 변경품이 아니다. */
export const fourMDraftOf = (stored: FourMChangeForward | null): FourMChangeDraft =>
  stored === null ? EMPTY_FOUR_M_CHANGE : { checked: true, remarks: stored.remarks ?? '' };

/** 초안 → 쓰기 본문. 체크를 풀었으면 `null`(그 LOT 의 기록을 지운다). */
export const fourMBodyOf = (draft: FourMChangeDraft): FourMChangeForward | null => {
  if (!draft.checked) return null;
  return { remarks: draft.remarks.trim() };
};

/** 체크했는데 변경 내용이 비었으면 저장·확정을 막는다(서버도 400). */
export const isFourMIncomplete = (draft: FourMChangeDraft): boolean =>
  draft.checked && draft.remarks.trim() === '';

export const isSameFourM = (a: FourMChangeDraft, b: FourMChangeDraft): boolean =>
  a.checked === b.checked && (!a.checked || a.remarks.trim() === b.remarks.trim());

export interface FourMChangeProps {
  draft: FourMChangeDraft;
  /** 내용이 비어 저장을 막는 중이다 — 오류 문구를 보인다 */
  missing: boolean;
  onChange: (next: FourMChangeDraft) => void;
  disabled: boolean;
}

/**
 * 종합 판정 아래 — 4M 변경품 체크와, 체크하면 변경 내용(필수)(omf-all-around#63 · #133).
 * 판정과 함께 임시 저장·확정에 실린다. 투입을 막지 않고 POP 투입 때 알리기만 한다.
 */
export const FourMChange = ({ draft, missing, onChange, disabled }: FourMChangeProps) => {
  const remarksId = useId();

  return (
    <div className="iqc-inspection-four-m" role="group" aria-label={t.label}>
      <Checkbox
        checked={draft.checked}
        disabled={disabled}
        onChange={(event) => {
          onChange({ ...draft, checked: event.target.checked });
        }}
      >
        <span className="iqc-inspection-four-m-label">{t.label}</span>
      </Checkbox>
      <p className="field-note">{t.hint}</p>
      {draft.checked && (
        <div className="field-cell">
          <FieldLabel htmlFor={remarksId} label={t.remarks} required />
          <TextField
            id={remarksId}
            fullWidth
            value={draft.remarks}
            maxLength={FOUR_M_REMARKS_MAX}
            error={missing ? <ErrorText>{t.remarksMissing}</ErrorText> : undefined}
            disabled={disabled}
            onChange={(event) => {
              onChange({ ...draft, remarks: event.target.value });
            }}
          />
        </div>
      )}
    </div>
  );
};
