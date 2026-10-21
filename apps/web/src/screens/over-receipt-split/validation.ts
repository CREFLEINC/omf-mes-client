import { messages } from '@omf-mes/i18n';

import type { SplitLineView } from './split-calc';
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

/** 확인 창에서 고른 「만들어지는 전표」. 수량이 있는 전표는 처음에 모두 켜져 있다. */
export interface ReceiptSelection {
  normal: boolean;
  excess: boolean;
}

export const defaultSelection = (counts: SplitCounts): ReceiptSelection => ({
  normal: counts.normalLines > 0,
  excess: counts.excessLines > 0,
});

/** 고른 전표 → 계약의 갈래. 둘 다 끄면 보낼 것이 없다(`null`). */
export const modeFor = (selection: ReceiptSelection): SplitMode | null => {
  if (selection.normal && selection.excess) return 'BOTH';
  if (selection.normal) return 'NORMAL_ONLY';
  if (selection.excess) return 'EXCESS_ONLY';

  return null;
};

/** 「입하 등록」이 잠긴 사유 — 실릴 줄이 하나도 없을 때뿐이다. 나머지 검증은 누른 뒤에 칸을 짚는다. */
export const registerBlockReason = (counts: SplitCounts): string | null =>
  counts.normalLines + counts.excessLines === 0 ? t.actionReasons.noQty : null;

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

  /*
   * 예외 유형·초과 사유는 **초과분이 실릴 때만** 본다 — 초과분 전표에만 실리는 값이라 초과분이 없으면
   * 기본값(초과입하)이 서 있어도 사유를 묻지 않는다. 계약 — 「exceptionTypeCode 가 있으면 사유 필수」.
   */
  if (rules.needsExceptionType) {
    if (header.exceptionTypeCode === '') {
      errors.exceptionTypeCode = t.errors.exceptionTypeRequired;
    } else if (header.exceptionReason.trim() === '') {
      errors.exceptionReason = t.errors.exceptionReasonRequired;
    }
  }

  return errors;
};

/**
 * 사유가 붙은 줄(수량·LOT)을 그대로 두고 등록하면 그 줄만 빠진 전표가 만들어진다 — 막고, **어느 줄인지** 짚는다.
 */
export const lineErrorReason = (rows: readonly SplitLineView[]): string | null => {
  const lineNos = rows
    .filter((row) => row.qtyError !== null || row.lotError !== null || row.excessLotError !== null)
    .map((row) => String(row.line.lineNo));

  return lineNos.length === 0 ? null : t.errors.lineInvalidBlocked(lineNos.join('·'));
};
