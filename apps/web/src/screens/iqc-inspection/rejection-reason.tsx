import { Select, TextField } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { FieldLabel } from './field-label';

const t = messages.iqcInspection.result.rejection;

type DefectCode = components['schemas']['DefectCode'];

/** 불합격 사유 초안 — 대분류·상세는 `defectCodeId` 문자열, 사유는 글 그대로다. */
export interface RejectionDraft {
  majorId: string;
  minorId: string;
  description: string;
}

export const EMPTY_REJECTION: RejectionDraft = { majorId: '', minorId: '', description: '' };

/** 사용 중인 대분류(부모가 없는 코드)와 그 상세. W-06-03 이 두 단계로 관리한다. */
const majorsOf = (codes: readonly DefectCode[]) =>
  codes.filter((code) => code.parentDefectCodeId == null && code.isActive !== false);
/* ⚠ 대분류를 고르기 전(`''`)에는 상세가 없다 — 부모 없는 코드(대분류)가 `''` 과 같아져 상세로 잡히지 않게. */
const minorsOf = (codes: readonly DefectCode[], majorId: string) =>
  majorId === ''
    ? []
    : codes.filter(
        (code) => String(code.parentDefectCodeId ?? '') === majorId && code.isActive !== false,
      );

const optionOf = (code: DefectCode) => ({
  value: String(code.defectCodeId),
  label: `${code.defectCode} · ${code.defectName}`,
});

/**
 * 기록할 불량 코드 — 상세가 있으면 상세, 없으면 대분류다. 확정할 수 없으면 `null` 과 막힌 사유를 낸다.
 * ⭐ 상세가 있는 대분류를 그대로 기록하면 분포(W-03-05)의 상세 축이 비어 사유를 가를 수 없다.
 */
export const resolveDefectCode = (
  codes: readonly DefectCode[],
  draft: RejectionDraft,
): { defectCodeId: number } | { blocked: string } => {
  if (draft.majorId === '') return { blocked: t.required };
  const minors = minorsOf(codes, draft.majorId);
  if (minors.length > 0 && draft.minorId === '') return { blocked: t.minorRequired };
  return { defectCodeId: Number(draft.minorId === '' ? draft.majorId : draft.minorId) };
};

export interface RejectionReasonProps {
  codes: readonly DefectCode[];
  draft: RejectionDraft;
  onChange: (draft: RejectionDraft) => void;
  disabled: boolean;
}

/**
 * 불합격 사유 칸(omf-all-around#106) — 종합 판정이 불합격일 때만 선다. 불량 코드는 사업부 공용 마스터
 * (W-06-03)를 쓴다(2026-10-16 결정). 저장은 확정 직전 불량 기록(서버 선행 P-39)으로 나간다.
 *
 * 배치(3단계 검증 · 담당자 지시): 테두리 상자 대신 옅은 면 하나, 1행 대분류·상세 같은 폭 2열(좁으면 1열), 2행 사유
 * 전체 폭. 라벨은 모두 입력 위, 필수 누락은 그 칸 아래. 상세는 대분류에 상세가 있을 때만 고를 수 있다(없으면 비활성).
 */
export const RejectionReason = ({ codes, draft, onChange, disabled }: RejectionReasonProps) => {
  const majorId = useId();
  const minorId = useId();
  const descriptionId = useId();
  const majors = majorsOf(codes);
  const minors = minorsOf(codes, draft.majorId);
  const hasMinors = minors.length > 0;
  const majorMissing = draft.majorId === '';
  const minorMissing = hasMinors && draft.minorId === '';

  return (
    <div className="iqc-inspection-rejection" role="group" aria-labelledby={`${majorId}-heading`}>
      <h4 id={`${majorId}-heading`} className="iqc-inspection-rejection-title">
        {t.heading}
      </h4>
      {majors.length === 0 && <p className="field-note">{t.noCodes}</p>}
      <div className="form-grid iqc-inspection-rejection-codes">
        <div className="field-cell">
          <FieldLabel htmlFor={majorId} label={t.major} required />
          <Select
            id={majorId}
            options={majors.map(optionOf)}
            value={draft.majorId}
            placeholder={t.selectPlaceholder}
            invalid={majorMissing}
            aria-describedby={majorMissing ? `${majorId}-error` : undefined}
            disabled={disabled || majors.length === 0}
            onChange={(value) => {
              onChange({ ...draft, majorId: value, minorId: '' });
            }}
          />
          {majorMissing && (
            <span id={`${majorId}-error`} className="field-error">
              {t.majorMissing}
            </span>
          )}
        </div>
        <div className="field-cell">
          <FieldLabel htmlFor={minorId} label={t.minor} required={hasMinors} />
          <Select
            id={minorId}
            options={minors.map(optionOf)}
            value={draft.minorId}
            placeholder={t.selectPlaceholder}
            invalid={minorMissing}
            aria-describedby={minorMissing ? `${minorId}-error` : undefined}
            disabled={disabled || !hasMinors}
            onChange={(value) => {
              onChange({ ...draft, minorId: value });
            }}
          />
          {minorMissing && (
            <span id={`${minorId}-error`} className="field-error">
              {t.minorMissing}
            </span>
          )}
        </div>
      </div>
      <div className="field-cell iqc-inspection-rejection-description">
        <FieldLabel htmlFor={descriptionId} label={t.description} />
        <TextField
          id={descriptionId}
          fullWidth
          placeholder={t.descriptionPlaceholder}
          value={draft.description}
          disabled={disabled}
          onChange={(event) => {
            onChange({ ...draft, description: event.target.value });
          }}
        />
      </div>
    </div>
  );
};
