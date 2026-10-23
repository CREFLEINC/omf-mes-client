import { messages } from '@omf-mes/i18n';

import type { SplitLineView } from './split-calc';
import type { HeaderDraft } from './types';

/**
 * 보내기 전의 세 겹 — ① 실릴 줄이 있는가 ② 머리 입력 ③ 고치지 않은 줄(수량·LOT).
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
];

/** 전표에 실릴 줄 수와 그중 초과 몫을 가진 줄 수. 전표는 늘 한 건이다(서버 장부 P-100). */
export interface SplitCounts {
  lines: number;
  excessLines: number;
}

/** 「입하 등록」이 잠긴 사유 — 실릴 줄이 하나도 없을 때뿐이다. 나머지 검증은 누른 뒤에 칸을 짚는다. */
export const registerBlockReason = (counts: SplitCounts): string | null =>
  counts.lines === 0 ? t.actionReasons.noQty : null;

export const validateHeader = (header: HeaderDraft): Record<string, string> => {
  const errors: Record<string, string> = {};

  /* 계약 필수인데 입력칸이 있는 유일한 값이다. 비면 `receiptDatetime`을 만들 수 없다. */
  if (header.receiptDatetime === '') {
    errors.receiptDatetime = t.errors.receiptDatetimeRequired;
  }

  if (header.deliveryNoteNo.trim().length > DELIVERY_NOTE_NO_MAX) {
    errors.deliveryNoteNo = t.errors.deliveryNoteNoTooLong(DELIVERY_NOTE_NO_MAX);
  }

  return errors;
};

/**
 * 사유가 붙은 줄(수량·LOT)을 그대로 두고 등록하면 그 줄만 빠진 전표가 만들어진다 — 막고, **어느 줄인지** 짚는다.
 */
export const lineErrorReason = (rows: readonly SplitLineView[]): string | null => {
  const lineNos = rows
    .filter((row) => row.qtyError !== null || row.lotError !== null)
    .map((row) => String(row.line.lineNo));

  return lineNos.length === 0 ? null : t.errors.lineInvalidBlocked(lineNos.join('·'));
};
