import { messages } from '@omf-mes/i18n';

import { hasLineError, type SplitLineView } from './split-calc';
import type { HeaderDraft, SplitMode } from './types';

/**
 * 보내기 전의 세 겹 — ① 갈래별 활성 조건 ② 머리 입력 ③ 고치지 않은 줄(수량·LOT).
 *
 * 되돌릴 수 없는 쓰기라 「보내 보고 서버가 막아 주기」를 기대할 수 없다 — 서버 오류는 줄을
 * 가리키지 못하고 배너로만 온다.
 */

const t = messages.overReceiptSplit;

export const DELIVERY_NOTE_NO_MAX = 100;

/** 서버 오류를 인라인으로 받을 머리 입력칸. 라인 오류는 자리가 없어 배너로 간다. */
export const RECEIPT_FORM_FIELDS: readonly string[] = [
  'receiptDatetime',
  'deliveryNoteNo',
  'remarks',
  'exceptionTypeCode',
  'exceptionReason',
];

export interface SplitCounts {
  normalLines: number;
  excessLines: number;
}

/** 계약의 조건부 필수 — 갈래가 요구하는 part 에 라인이 1행 이상 있어야 한다. */
export const canSubmit = (mode: SplitMode, counts: SplitCounts): boolean => {
  switch (mode) {
    case 'BOTH':
      return counts.normalLines > 0 && counts.excessLines > 0;
    case 'NORMAL_ONLY':
      return counts.normalLines > 0;
    case 'EXCESS_ONLY':
      return counts.excessLines > 0;
  }
};

export const modeBlockReason = (mode: SplitMode, counts: SplitCounts): string | null => {
  if (canSubmit(mode, counts)) return null;

  if (counts.normalLines === 0 && counts.excessLines === 0) return t.actionReasons.noQty;

  switch (mode) {
    case 'BOTH':
      /* 나눌 수 없는 이유가 둘이고 **사용자가 할 조치가 다르다** — 각기 다른 버튼을 가리킨다. */
      return counts.excessLines === 0
        ? t.actionReasons.bothNeedsExcess
        : t.actionReasons.bothNeedsNormal;
    case 'NORMAL_ONLY':
      return t.actionReasons.normalOnlyNeedsNormal;
    case 'EXCESS_ONLY':
      return t.actionReasons.excessOnlyNeedsExcess;
  }
};

export interface HeaderRules {
  /** 초과분이 실리는 갈래인가. 초과분 줄은 발주에 묶이지 않아 서버가 예외 유형을 요구한다. */
  needsExceptionType: boolean;
}

export const validateHeader = (
  header: HeaderDraft,
  rules: HeaderRules = { needsExceptionType: false },
): Record<string, string> => {
  const errors: Record<string, string> = {};

  /* 계약 필수인데 입력칸이 있는 유일한 값이다. 비면 두 part의 `receiptDatetime`을 만들 수 없다. */
  if (header.receiptDatetime === '') {
    errors.receiptDatetime = t.errors.receiptDatetimeRequired;
  }

  if (header.deliveryNoteNo.trim().length > DELIVERY_NOTE_NO_MAX) {
    errors.deliveryNoteNo = t.errors.deliveryNoteNoTooLong(DELIVERY_NOTE_NO_MAX);
  }

  if (rules.needsExceptionType && header.exceptionTypeCode === '') {
    errors.exceptionTypeCode = t.errors.exceptionTypeRequired;
  }

  /* 계약 — 「exceptionTypeCode 가 있으면 필수」. */
  if (header.exceptionTypeCode !== '' && header.exceptionReason.trim() === '') {
    errors.exceptionReason = t.errors.exceptionReasonRequired;
  }

  return errors;
};

/** 사유가 붙은 줄(수량·LOT)을 그대로 두고 등록하면 그 줄만 빠진 전표가 만들어진다 — 막는다. */
export const lineErrorReason = (rows: readonly SplitLineView[]): string | null =>
  hasLineError(rows) ? t.errors.lineInvalidBlocked : null;
