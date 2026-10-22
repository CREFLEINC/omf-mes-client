import { TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { ErrorText, FieldLabel } from './field-label';
import {
  hasQuantityError,
  toSendableNumber,
  validateQuantities,
  type QuantityDraft,
} from './quantity-draft';
import type { SamplingRule } from './sample-qty';

const t = messages.iqcInspection.result.judgmentChange;

/** 검사기준 버전에서 이 화면이 읽는 규칙 — 샘플링(#102)과 합격판정개수(#125). */
export interface PlanVersionRule extends SamplingRule {
  /** 합격판정개수. 비면 자동 판정이 없다(종전처럼 사람이 고른다). */
  acceptanceNumber: number | null;
}

/** 종합 판정 3값(`INSPECTION_RESULT_OVERALL_JUDGMENT`). */
export type ExpectedJudgment = 'ACCEPTED' | 'REJECTED' | 'HELD';

/** 변경 사유 길이 상한 — 서버 계약 `judgmentChangeReason` maxLength(장부 P-70). */
export const JUDGMENT_CHANGE_REASON_MAX = 500;

/**
 * 합격판정개수 기준 자동 판정(omf-all-around#125 · QI-02) — 서버 `expectedJudgment` 와 같은 규칙이다.
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

/** 고른 판정이 자동 판정과 다른가 — 다르면 변경 사유가 있어야 확정할 수 있다. */
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
 * 최종 판정과 다르게 고르면 필수 「판정 변경 사유」 칸(omf-all-around#125). 자동 판정 기준 글은 최종 판정 라벨 옆에 선다(#133).
 * 사유는 확정 요청에만 실린다(서버가 검사 비고 맨 앞에 남긴다 · P-70).
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
            placeholder={t.reasonPlaceholder}
            value={reason}
            maxLength={JUDGMENT_CHANGE_REASON_MAX}
            disabled={disabled}
            error={missing ? <ErrorText>{t.reasonMissing}</ErrorText> : undefined}
            onChange={(event) => {
              onReasonChange(event.target.value);
            }}
          />
        </div>
      )}
    </>
  );
};
