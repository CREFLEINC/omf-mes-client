import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { formatBaseQty } from '../../patterns/package-qty';
import { serverReasonOf } from '../../patterns/server-reason';

/**
 * P-01-03 반납 입고의 거절 문구 — 서버 오류 코드로 단말 언어 문구를 꺼낸다(실제 앱 확인 F-03).
 *
 * ⭐ 서버 문구는 한국어 하나라 베트남어 단말에 그대로 쓰지 않는다 — PDA 적치(`putaway/direct` `verdictTextOf`) ·
 *    출하 완료(`lookupFailureOf`)처럼 아는 코드는 문구 묶음에서 꺼낸다. 모르는 코드만 서버 문구 그대로 둔다
 *    (`serverReasonOf`).
 */

interface ErrorLine {
  code: string;
  field: string | undefined;
  message: string;
}

const linesOf = (error: ApiError): ErrorLine[] =>
  error.kind === 'validation' || error.kind === 'stateLocked'
    ? error.errors.map((item) => ({ code: item.code, field: item.field, message: item.message }))
    : error.kind === 'network' || error.code === undefined
      ? []
      : [{ code: error.code, field: undefined, message: error.message ?? '' }];

/** 서버 넘음 문구 「… (반납 가능 100)」에서 그때의 반납 가능 양을 꺼낸다 — 단위는 화면이 붙인다. */
const RETURNABLE_IN_MESSAGE = /\(\D*?([\d.,]+)\s*\)\s*$/u;

/** 줄 칸(`lines[2].returnQty`)의 줄 차례. */
const lineIndexOf = (field: string | undefined): number | null => {
  const matched = field === undefined ? null : /^lines\[(\d+)\]/u.exec(field);

  return matched === null ? null : Number(matched[1]);
};

const reasonOfLine = (line: ErrorLine, uomOf: (index: number | null) => string): string | null => {
  const r = messages.materialReturn.reason;

  switch (line.code) {
    case 'NOT_RETURNABLE':
    case 'NOTHING_TO_RETURN':
    case 'WORK_ORDER_MISMATCH':
      return r[line.code];
    case 'INVALID':
      return line.field?.endsWith('.lotId') === true ? r.lotMissing : null;
    case 'RANGE': {
      const found = RETURNABLE_IN_MESSAGE.exec(line.message)?.[1];
      if (line.field?.endsWith('.returnQty') !== true || found === undefined) return null;
      const qty = Number(found.replace(/,/g, ''));

      return r.overReturnable(
        Number.isFinite(qty) ? formatBaseQty(qty, uomOf(lineIndexOf(line.field))) : found,
      );
    }
    default:
      return null;
  }
};

/**
 * 거절 문구 — 아는 코드는 단말 언어 문구, 모르면 서버 문구(`serverReasonOf`), 둘 다 없으면 null.
 * `uomOf` 는 넘음 문구에 붙일 그 줄의 단위(줄 차례 → 단위).
 */
export const returnReasonOf = (
  error: ApiError,
  uomOf: (index: number | null) => string = () => '',
): string | null => {
  const known = linesOf(error)
    .map((line) => reasonOfLine(line, uomOf))
    .filter((text): text is string => text !== null);

  return known.length > 0 ? [...new Set(known)].join(' ') : serverReasonOf(error);
};
