import type { components } from '@omf-mes/api-client';

export type DefectCode = components['schemas']['DefectCode'];

/** 불량 코드는 대분류 → 상세 두 단이다. 상세가 있는 대분류는 상세까지 골라야 한다(IQC 불합격 사유와 같은 규칙). */
export interface DefectCodeDraft {
  majorId: string;
  minorId: string;
}

export const EMPTY_DEFECT_CODE: DefectCodeDraft = { majorId: '', minorId: '' };

export const majorsOf = (codes: readonly DefectCode[]): DefectCode[] =>
  codes.filter((code) => code.parentDefectCodeId == null && code.isActive !== false);

/* ⚠ 대분류를 고르기 전(`''`)에는 상세가 없다 — 부모 없는 코드(대분류)가 `''` 과 같아져 상세로 잡히지 않게. */
export const minorsOf = (codes: readonly DefectCode[], majorId: string): DefectCode[] =>
  majorId === ''
    ? []
    : codes.filter(
        (code) => String(code.parentDefectCodeId ?? '') === majorId && code.isActive !== false,
      );

export const optionOf = (code: DefectCode): { value: string; label: string } => ({
  value: String(code.defectCodeId),
  label: `${code.defectCode} · ${code.defectName}`,
});

/** 보낼 불량 코드. 다 고르지 않았으면 `null` 이다. */
export const resolveDefectCodeId = (
  codes: readonly DefectCode[],
  draft: DefectCodeDraft,
): number | null => {
  if (draft.majorId === '') return null;
  if (minorsOf(codes, draft.majorId).length > 0 && draft.minorId === '') return null;
  return Number(draft.minorId === '' ? draft.majorId : draft.minorId);
};
