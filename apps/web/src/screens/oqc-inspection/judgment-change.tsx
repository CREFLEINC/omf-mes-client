import { TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { FieldLabel } from './field-label';
import {
  hasQuantityError,
  toSendableNumber,
  validateQuantities,
  type QuantityDraft,
} from './quantity-draft';

const t = messages.oqcInspection.result.judgmentChange;

/** 종합 판정 3값(`INSPECTION_RESULT_OVERALL_JUDGMENT`). */
export type ExpectedJudgment = 'ACCEPTED' | 'REJECTED' | 'HELD';

/** 변경 사유 길이 상한 — 서버 계약 `judgmentChangeReason` maxLength(장부 P-70). */
export const JUDGMENT_CHANGE_REASON_MAX = 500;

/**
 * 합격판정개수 기준 자동 판정(omf-all-around#126 · OQ-03) — 서버 `expectedJudgment` 와 같은 규칙이다(IQC #125 와 같다).
 * 불합격 > 합격판정개수 → 불합격 · 아니면 보류 > 0 → 보류 · 아니면 합격.
 * 합격판정개수가 없거나 수량이 아닌 값이 남아 있으면 `null` 이다(셀 수 없으면 판정하지 않는다).
 */
export const expectedJudgmentOf = (
  draft: QuantityDraft,
  acceptanceNumber: number | null,
): ExpectedJudgment | null => {
  if (acceptanceNumber === null || hasQuantityError(validateQuantities(draft))) return null;
  if (toSendableNumber(draft.rejected) > acceptanceNumber) return 'REJECTED';
  if (toSendableNumber(draft.held) > 0) return 'HELD';
  return 'ACCEPTED';
};

/** 고른 판정이 자동 판정과 다른가 — 다르면 변경 사유가 있어야 저장할 수 있다. */
export const needsJudgmentChangeReason = (
  judgment: string,
  expected: ExpectedJudgment | null,
): boolean => expected !== null && judgment !== '' && judgment !== expected;

export interface JudgmentChangeProps {
  needsReason: boolean;
  reason: string;
  onReasonChange: (reason: string) => void;
  disabled: boolean;
}

/**
 * 종합 판정 아래 — 다르게 고르면 필수 「판정 변경 사유」 칸(omf-all-around#126). 자동 판정의 기준 한 줄은
 * 종합 판정 라벨 옆으로 옮겼다(IQC #133 과 같다 · omf-all-around#136).
 * 사유는 확정 저장에만 실린다(서버가 검사 비고 맨 앞에 남긴다 · P-70).
 */
export const JudgmentChange = ({
  needsReason,
  reason,
  onReasonChange,
  disabled,
}: JudgmentChangeProps) => {
  const reasonId = useId();
  const missing = reason.trim() === '';

  return (
    <>
      {needsReason && (
        <div className="field-cell">
          <FieldLabel htmlFor={reasonId} label={t.reason} required />
          <TextField
            id={reasonId}
            fullWidth
            /* 칸에는 빨간 테두리만 — 누락 안내 글은 접근 이름으로만 남긴다(IQC #133 과 같다 · #136). */
            containerClassName="oqc-inspection-border-only"
            placeholder={t.reasonPlaceholder}
            value={reason}
            maxLength={JUDGMENT_CHANGE_REASON_MAX}
            disabled={disabled}
            error={missing ? t.reasonMissing : undefined}
            onChange={(event) => {
              onReasonChange(event.target.value);
            }}
          />
        </div>
      )}
    </>
  );
};
