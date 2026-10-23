import { messages } from '@omf-mes/i18n';

import type { LotDraft } from './line-draft';

/**
 * 공급사 사전부착 LOT 라벨 — 서버 `core/lot/lot-number.ts` 의 자재 LOT 형식(통보 277 · 2026-09-14)을
 * 화면 쪽에서 되읽는다. 서버가 같은 규칙으로 400 을 내므로, 여기서 먼저 잡아 **어느 줄의 어느 칸**인지
 * 짚는다 — 서버 오류는 줄을 가리키지 못한다(배너로만 온다).
 *
 * ```
 * 040101-00022S|12.5|260731|100019|0001
 * 제품코드      |수량 |날짜  |공급사|번호
 * ```
 *
 * 수량 칸은 서버처럼 관대하게 본다(`12.50`도 통과) — 라벨에 찍힌 수량은 스냅샷이라 비교 대상이 아니다.
 */

const t = messages.overReceiptSplit;

export const MATERIAL_LOT_SEPARATOR = '|';
export const MATERIAL_LOT_MAX_LENGTH = 64;

export interface MaterialLotSegments {
  itemCode: string;
  /** 라벨에 찍힌 수량. 스캔으로 줄을 채울 때 이번 도착 수량의 기본값이 된다. */
  qty: number;
  /** `YYMMDD` */
  date: string;
  supplierCode: string;
  serial: number;
}

const PRINTABLE_ASCII = /^[\x20-\x7E]+$/;

const isSegment = (value: string): boolean =>
  value !== '' && !value.includes(MATERIAL_LOT_SEPARATOR) && PRINTABLE_ASCII.test(value);

const isRealCalendarDate = (yy: number, mm: number, dd: number): boolean => {
  const made = new Date(Date.UTC(2000 + yy, mm - 1, dd));

  return (
    made.getUTCFullYear() === 2000 + yy && made.getUTCMonth() === mm - 1 && made.getUTCDate() === dd
  );
};

/** 다섯 칸이 전부 규칙에 맞으면 칸값, 아니면 `null`. */
export const parseMaterialLotNo = (raw: string): MaterialLotSegments | null => {
  const text = raw.trim();
  if (text === '' || text.length > MATERIAL_LOT_MAX_LENGTH) return null;

  const parts = text.split(MATERIAL_LOT_SEPARATOR);
  if (parts.length !== 5) return null;

  const [itemCode = '', qtyText = '', date = '', supplierCode = '', serialText = ''] = parts;
  if (!isSegment(itemCode) || !isSegment(supplierCode)) return null;
  if (!/^\d+(\.\d+)?$/.test(qtyText)) return null;

  const dateMatch = /^(\d{2})(\d{2})(\d{2})$/.exec(date);
  if (
    dateMatch === null ||
    !isRealCalendarDate(Number(dateMatch[1]), Number(dateMatch[2]), Number(dateMatch[3]))
  ) {
    return null;
  }

  const serial = /^\d{4}$/.test(serialText) ? Number(serialText) : 0;
  if (serial < 1) return null;

  const qty = Number(qtyText);
  if (!(qty > 0)) return null;

  return { itemCode, qty, date, supplierCode, serial };
};

/**
 * 한 전표 줄의 LOT 입력이 보낼 수 있는 모양인가. `null` 이면 보낼 수 있다.
 *
 * | 번호 | 라벨 없음 | 보내는 값 | 검사 |
 * | :-: | :-: | --- | --- |
 * | 있음 | 끔 | `supplierLotNo` · 부착 | 라벨 형식 · 품목코드 일치 |
 * | 있음 | 켬 | `supplierLotNo` · `supplierLotLabelAttached=false` | 없음 |
 * | 없음 | 켬 | `supplierLotMissing=true` · 사유 | 사유 필수 |
 * | 없음 | 끔 | — | **막는다** — 서버가 번호 없는 줄을 받지 않는다 |
 */
export const lotDraftError = (lot: LotDraft, expectedItemCode: string | null): string | null => {
  const lotNo = lot.lotNo.trim();

  if (lotNo === '') {
    if (!lot.labelMissing) return t.errors.lotRequired;

    return lot.reasonCode === '' ? t.errors.lotReasonRequired : null;
  }

  if (lot.labelMissing) return null;

  const parsed = parseMaterialLotNo(lotNo);
  if (parsed === null) return t.errors.lotFormat;
  if (expectedItemCode !== null && parsed.itemCode !== expectedItemCode) {
    return t.errors.lotItemMismatch(expectedItemCode);
  }

  return null;
};
