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
const minorsOf = (codes: readonly DefectCode[], majorId: string) =>
  codes.filter(
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
 */
export const RejectionReason = ({ codes, draft, onChange, disabled }: RejectionReasonProps) => {
  const majorId = useId();
  const minorId = useId();
  const majors = majorsOf(codes);
  const minors = minorsOf(codes, draft.majorId);

  return (
    <fieldset className="iqc-inspection-rejection" aria-label={t.heading}>
      <legend className="field-label">{t.heading}</legend>
      {majors.length === 0 && <p className="field-note">{t.noCodes}</p>}
      <FieldLabel htmlFor={majorId} label={t.major} required />
      <Select
        id={majorId}
        options={majors.map(optionOf)}
        value={draft.majorId}
        disabled={disabled || majors.length === 0}
        onChange={(value) => {
          onChange({ ...draft, majorId: value, minorId: '' });
        }}
      />
      {minors.length > 0 && (
        <>
          <FieldLabel htmlFor={minorId} label={t.minor} required />
          <Select
            id={minorId}
            options={minors.map(optionOf)}
            value={draft.minorId}
            disabled={disabled}
            onChange={(value) => {
              onChange({ ...draft, minorId: value });
            }}
          />
        </>
      )}
      <TextField
        label={t.description}
        value={draft.description}
        disabled={disabled}
        onChange={(event) => {
          onChange({ ...draft, description: event.target.value });
        }}
      />
    </fieldset>
  );
};
