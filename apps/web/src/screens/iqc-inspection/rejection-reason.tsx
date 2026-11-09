import { Button, Dialog, TextField } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState, type ReactNode } from 'react';

import { FieldLabel } from './field-label';
import { toMicro, toSendableNumber } from './quantity-draft';
import { SearchableSelect } from './searchable-select';

const t = messages.iqcInspection.result.rejection;

type DefectCode = components['schemas']['DefectCode'];

/** 불합격 사유 초안 — 대분류·상세는 `defectCodeId` 문자열, 사유는 글 그대로다. 추정 원인은 없앴다(omf-all-around#239). */
export interface RejectionDraft {
  majorId: string;
  minorId: string;
  description: string;
}

export const EMPTY_REJECTION: RejectionDraft = {
  majorId: '',
  minorId: '',
  description: '',
};

/**
 * 임시 저장된 불량 기록 → 사유 초안(omf-all-around#122). 상세 코드면 그 부모가 대분류다. 코드 마스터에 없는 코드
 * (비활성·삭제)는 고를 수 없으니 사유 글만 되살린다.
 */
export const rejectionDraftOf = (
  codes: readonly DefectCode[],
  record: {
    defectCodeId: number;
    defectDescription?: string | null;
  },
): RejectionDraft => {
  const code = codes.find((candidate) => candidate.defectCodeId === record.defectCodeId);
  const description = record.defectDescription ?? '';
  if (code === undefined) return { ...EMPTY_REJECTION, description };
  return code.parentDefectCodeId == null
    ? { majorId: String(code.defectCodeId), minorId: '', description }
    : {
        majorId: String(code.parentDefectCodeId),
        minorId: String(code.defectCodeId),
        description,
      };
};

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

/** 불량 내역 한 줄(#197) — 불량 코드 · 추정 원인 · 사유에 그 유형의 수량을 더했다. 수량은 친 글 그대로다. */
export interface DefectDraft extends RejectionDraft {
  qty: string;
  /**
   * 화면에서 이 줄을 세운 검사 항목(#247 · 사용자 지시 2026-11-09). ⛔ 서버에 보내지 않고 저장되지 않는다 — 불량 기록에 항목 칸이
   * 없다. 다시 열면 비어 있고, 그때는 첫 불합격 항목 아래에 선다.
   */
  specId?: number;
}

export const EMPTY_DEFECT: DefectDraft = { ...EMPTY_REJECTION, qty: '' };

/** 임시 저장된 불량 기록 → 불량 내역 한 줄. */
export const defectDraftOf = (
  codes: readonly DefectCode[],
  record: Parameters<typeof rejectionDraftOf>[1] & { defectQty?: number | null },
): DefectDraft => ({
  ...rejectionDraftOf(codes, record),
  qty: record.defectQty == null ? '' : String(record.defectQty),
});

export interface DefectRecordInput {
  defectCodeId: number;
  defectQty: number;
  defectDescription: string | null;
}

/**
 * 불량 내역 → 요청에 실을 불량 기록(#197). 줄마다 코드를 다 골랐고 수량이 0 보다 커야 하며, 불합격 수량이 있으면 그 합계가
 * 불합격 수량과 같아야 한다. 안 되면 막힌 사유 하나를 낸다.
 */
export const resolveDefects = (
  codes: readonly DefectCode[],
  drafts: readonly DefectDraft[],
  rejectedQty: number,
): { rows: DefectRecordInput[] } | { blocked: string } => {
  if (drafts.length === 0) return { blocked: t.required };
  const rows: DefectRecordInput[] = [];
  for (const draft of drafts) {
    const code = resolveDefectCode(codes, draft);
    if ('blocked' in code) return code;
    /* 수량 칸과 같은 규칙(0 이상 · 소수 여섯 자리)으로 읽는다 — `Number` 는 「1e3」 · 「0x10」도 받는다. */
    const micro = toMicro(draft.qty);
    if (micro === null || micro <= 0n) return { blocked: t.defectQtyRequired };
    const qty = toSendableNumber(draft.qty);
    rows.push({
      defectCodeId: code.defectCodeId,
      defectQty: qty,
      defectDescription: draft.description.trim() === '' ? null : draft.description.trim(),
    });
  }
  const sum = rows.reduce((total, row) => total + row.defectQty, 0);
  if (rejectedQty > 0 && Math.abs(sum - rejectedQty) > 1e-9)
    return { blocked: t.defectSumMismatch };
  return { rows };
};

export interface RejectionReasonProps {
  codes: readonly DefectCode[];
  draft: RejectionDraft;
  onChange: (draft: RejectionDraft) => void;
  disabled: boolean;
  /** 불량 코드 칸 다음에 더 세울 칸 — 불량 내역 줄의 수량(#197). */
  extraFields?: ReactNode;
}

/**
 * 불합격 사유 칸(omf-all-around#106) — 종합 판정이 불합격일 때만 선다. 불량 코드는 사업부 공용 마스터
 * (W-06-03)를 쓴다(2026-10-16 결정). 임시 저장(서버 P-48)·확정(P-47)이 그 회차의 불량 기록으로 남긴다.
 *
 * 배치(3단계 검증 · 담당자 지시): 테두리 상자 대신 옅은 면 하나, 1행 대분류·상세 같은 폭 2열(좁으면 1열), 2행 사유
 * 전체 폭. 라벨은 모두 입력 위, 필수 누락은 그 칸 아래. 상세 칸은 대분류에 상세가 있을 때만 선다(#185).
 */
export const RejectionReason = ({
  codes,
  draft,
  onChange,
  disabled,
  extraFields = null,
}: RejectionReasonProps) => {
  const majorId = useId();
  const minorId = useId();
  const descriptionId = useId();
  const majors = majorsOf(codes);
  const minors = minorsOf(codes, draft.majorId);
  const hasMinors = minors.length > 0;
  const majorMissing = draft.majorId === '';
  const minorMissing = hasMinors && draft.minorId === '';
  /*
   * 상세가 있는 대분류를 고르면 상세를 고르는 창을 띄운다(사용자 지시 2026-10-27 · #185) — 상세는 필수라 바로 고르게 한다.
   * 고른 상세는 「불량 상세」 칸에 보이고, 그 칸에서 다시 바꿀 수 있다.
   */
  const [isPickingMinor, setIsPickingMinor] = useState(false);
  const pickedMajor = majors.find((code) => String(code.defectCodeId) === draft.majorId);

  return (
    /*
     * 최종 판정과 한 줄에 선다(사용자 지시 2026-10-26 · #185) — 「불합격 사유」 상자 · 제목 없이 칸만. 묶음 이름은 화면 읽기로만 남긴다.
     * 사유(글)는 같은 줄 끝 입력칸이다(선택 입력 · 사용자 지시 2026-10-26).
     */
    <div className="iqc-inspection-rejection" role="group" aria-label={t.heading}>
      {majors.length === 0 && <p className="field-note">{t.noCodes}</p>}
      <div className="form-grid iqc-inspection-rejection-codes">
        {/* 불량 유형 — 대분류 · 상세를 한 칸 안에 둔다. 상세가 생겨도 옆 칸이 밀리지 않는다(사용자 지시 2026-10-29 · #197). */}
        <div className="iqc-inspection-rejection-type" data-has-minor={hasMinors ? '' : undefined}>
          <div className="field-cell">
            <FieldLabel htmlFor={majorId} label={t.major} required />
            {/* 코드가 많아도 고르게 — 목록 맨 위 검색 칸으로 좁히거나 그대로 고른다(사용자 지시 2026-10-28 · #197). */}
            <SearchableSelect
              id={majorId}
              options={majors.map(optionOf)}
              value={draft.majorId}
              placeholder={t.majorPlaceholder}
              searchLabel={t.search}
              searchPlaceholder={t.searchPlaceholder}
              emptyText={t.searchEmpty}
              invalid={majorMissing}
              aria-describedby={majorMissing ? `${majorId}-error` : undefined}
              disabled={disabled || majors.length === 0}
              onChange={(value) => {
                onChange({ ...draft, majorId: value, minorId: '' });
                if (minorsOf(codes, value).length > 0) setIsPickingMinor(true);
              }}
            />
            {majorMissing && (
              <span id={`${majorId}-error`} className="iqc-inspection-visually-hidden">
                {t.majorMissing}
              </span>
            )}
          </div>
          {/* 상세는 고른 대분류에 상세 코드가 있을 때만 선다(사용자 지시 2026-10-27 · #185). */}
          {hasMinors && (
            <div className="field-cell">
              <FieldLabel htmlFor={minorId} label={t.minor} required />
              <SearchableSelect
                id={minorId}
                options={minors.map(optionOf)}
                value={draft.minorId}
                placeholder={t.minorPlaceholder}
                searchLabel={t.search}
                searchPlaceholder={t.searchPlaceholder}
                emptyText={t.searchEmpty}
                invalid={minorMissing}
                aria-describedby={minorMissing ? `${minorId}-error` : undefined}
                disabled={disabled}
                onChange={(value) => {
                  onChange({ ...draft, minorId: value });
                }}
              />
              {minorMissing && (
                <span id={`${minorId}-error`} className="iqc-inspection-visually-hidden">
                  {t.minorMissing}
                </span>
              )}
            </div>
          )}
        </div>
        {extraFields}
        <div className="field-cell iqc-inspection-rejection-description">
          <FieldLabel htmlFor={descriptionId} label={t.description} />
          <TextField
            id={descriptionId}
            fullWidth
            value={draft.description}
            placeholder={t.descriptionPlaceholder}
            disabled={disabled}
            onChange={(event) => {
              onChange({ ...draft, description: event.target.value });
            }}
          />
        </div>
      </div>
      <Dialog
        open={isPickingMinor && hasMinors}
        onClose={() => setIsPickingMinor(false)}
        size="sm"
        title={
          /* 제목 아래 고른 대분류 한 줄 · 상세는 「코드 | 이름」 줄과 오른쪽 동그라미(사용자 시안 2026-10-29). */
          <span className="iqc-inspection-minor-picker-title">
            {t.minorPickerTitle}
            {pickedMajor !== undefined && (
              <span className="iqc-inspection-minor-picker-major">
                {optionOf(pickedMajor).label}
              </span>
            )}
          </span>
        }
        showCloseButton={false}
        footer={
          <Button variant="tonal" size="md" onClick={() => setIsPickingMinor(false)}>
            {t.minorPickerClose}
          </Button>
        }
      >
        <div
          className="iqc-inspection-minor-picker"
          role="radiogroup"
          aria-label={t.minorPickerTitle}
        >
          {minors.map((code) => {
            const isPicked = String(code.defectCodeId) === draft.minorId;
            return (
              <button
                key={code.defectCodeId}
                type="button"
                role="radio"
                aria-checked={isPicked}
                className="iqc-inspection-minor-option"
                onClick={() => {
                  onChange({ ...draft, minorId: String(code.defectCodeId) });
                  setIsPickingMinor(false);
                }}
              >
                <span className="iqc-inspection-minor-option-code">{code.defectCode}</span>
                <span className="iqc-inspection-minor-option-name">{code.defectName}</span>
                <span className="iqc-inspection-minor-option-mark" aria-hidden />
              </button>
            );
          })}
        </div>
      </Dialog>
    </div>
  );
};
