import type { components } from '@omf-mes/api-client';

import type { LotDraft } from './line-draft';
import type { SplitLineView } from './split-calc';
import type { HeaderDraft, PoView, SplitMode } from './types';

/**
 * 요청 조립 — **화면의 초안을 계약의 본문으로 옮기는 유일한 자리.**
 *
 * 정량·초과는 `split-calc.ts`가 가른 결과를 그대로 받는다. 여기서 다시 계산하면 표가 보여 준 값과
 * 보내는 값이 갈린다.
 */

type SplitRequest = components['schemas']['InboundReceiptSplitRequest'];
type SplitPart = components['schemas']['InboundReceiptSplitPart'];
/**
 * `supplierLotLabelAttached` 는 서버 계약(contracts/)에는 있으나 **이 저장소의 생성 타입에는 아직 없다**
 * — 사본이 `gen:api` 로 실리기 전. 서버는 「생략하면 `supplierLotMissing` 의 반대」로 호환 처리한다.
 */
type LineUpsert = components['schemas']['InboundReceiptLineUpsert'] & {
  supplierLotLabelAttached?: boolean;
};

export interface SplitInput {
  purchaseOrder: PoView;
  rows: readonly SplitLineView[];
  header: HeaderDraft;
  /** 발생 시각의 기준. **제출 순간**을 인자로 받아 순수 함수로 둔다. */
  now: Date;
}

export interface SplitParts {
  normal: LineUpsert[];
  excess: LineUpsert[];
}

const pad = (value: number, length: number): string => String(value).padStart(length, '0');

const offsetText = (at: Date): string => {
  const minutes = -at.getTimezoneOffset();
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);

  return `${sign}${pad(Math.floor(absolute / 60), 2)}:${pad(absolute % 60, 2)}`;
};

const localText = (at: Date): string =>
  `${pad(at.getFullYear(), 4)}-${pad(at.getMonth() + 1, 2)}-${pad(at.getDate(), 2)}T` +
  `${pad(at.getHours(), 2)}:${pad(at.getMinutes(), 2)}:${pad(at.getSeconds(), 2)}`;

/** `datetime-local` 값(분까지)에 초와 offset 을 붙인다 — 계약이 offset 있는 시각을 요구한다. */
export const toOffsetDateTime = (local: string, at: Date): string => {
  const withSeconds = local.length === 16 ? `${local}:00` : local;

  return `${withSeconds}${offsetText(at)}`;
};

export const toOccurredAt = (at: Date): string => `${localText(at)}${offsetText(at)}`;

/** 영업일은 입하 일시의 날짜다 — 입력칸을 따로 두지 않는다(안내 문구가 밝힌다). */
export const toBusinessDate = (receiptDatetimeLocal: string): string =>
  receiptDatetimeLocal.slice(0, 10);

/**
 * LOT 입력 → 계약의 세 칸. 표는 `lot-format.ts` `lotDraftError` 의 표와 같다.
 *
 * 「라벨 없음」인데 번호가 있으면 **번호는 싣고 부착만 거짓**으로 — 번호를 버리면 추적이 끊긴다.
 */
const lotFields = (lot: LotDraft): Partial<LineUpsert> & { supplierLotMissing: boolean } => {
  const lotNo = lot.lotNo.trim();

  if (lotNo === '') {
    return { supplierLotMissing: true, substituteLotReasonCode: lot.reasonCode };
  }

  return lot.labelMissing
    ? { supplierLotNo: lotNo, supplierLotMissing: false, supplierLotLabelAttached: false }
    : { supplierLotNo: lotNo, supplierLotMissing: false };
};

/**
 * 가른 결과를 두 갈래의 라인으로 나눈다. **세는 자리와 보내는 자리가 같다** — 버튼의 활성 조건이
 * 이 결과의 길이를 쓴다.
 */
export const toSplitParts = (rows: readonly SplitLineView[]): SplitParts => {
  const normal: LineUpsert[] = [];
  const excess: LineUpsert[] = [];

  for (const row of rows) {
    if (row.split === null) continue;

    if (row.split.normalQty > 0) {
      normal.push({
        /* **정량분이 원 발주의 어느 줄을 채우는지 밝히는 것**이 정량분의 정의다. */
        purchaseOrderLineId: row.line.purchaseOrderLineId,
        itemId: row.line.itemId,
        receivedQty: row.split.normalQty,
        uomId: row.line.uomId,
        ...lotFields(row.lot),
      });
    }

    if (row.split.excessQty > 0) {
      excess.push({
        /*
         * 초과분에는 발주 라인을 **붙이지 않는다**(이슈 §6). 붙이면 초과분이 원 발주에 더해져
         * 「발주보다 많이 받았다」는 사실 자체가 사라진다.
         */
        itemId: row.line.itemId,
        receivedQty: row.split.excessQty,
        uomId: row.line.uomId,
        ...lotFields(row.excessLot),
      });
    }
  }

  return { normal, excess };
};

const optionalText = <TKey extends string>(
  key: TKey,
  raw: string,
): Partial<Record<TKey, string>> => {
  const text = raw.trim();

  return text === '' ? {} : ({ [key]: text } as Record<TKey, string>);
};

const toSharedPart = (input: SplitInput, lines: LineUpsert[]): SplitPart => ({
  supplierId: input.purchaseOrder.supplierId,
  plantId: input.purchaseOrder.plantId,
  receiptDatetime: toOffsetDateTime(input.header.receiptDatetime, input.now),
  ...optionalText('deliveryNoteNo', input.header.deliveryNoteNo),
  ...optionalText('remarks', input.header.remarks),
  lines,
});

/** 예외 유형·초과 사유는 **초과분 전표에만** 실린다(계약 설명). */
const toExcessPart = (input: SplitInput, lines: LineUpsert[]): SplitPart => ({
  ...toSharedPart(input, lines),
  ...optionalText('exceptionTypeCode', input.header.exceptionTypeCode),
  ...optionalText('exceptionReason', input.header.exceptionReason),
});

export const includesExcess = (mode: SplitMode): boolean => mode !== 'NORMAL_ONLY';

export const toSplitRequest = (mode: SplitMode, input: SplitInput): SplitRequest => {
  const parts = toSplitParts(input.rows);
  const shared = {
    /* 계약이 「영업일과 발생 시각은 바깥에서 한 번만 받는다」고 적었다 — part에 넣지 않는다. */
    businessDate: toBusinessDate(input.header.receiptDatetime),
    occurredAt: toOccurredAt(input.now),
  };

  if (mode === 'BOTH') {
    return {
      ...shared,
      mode,
      normal: toSharedPart(input, parts.normal),
      excess: toExcessPart(input, parts.excess),
    };
  }

  if (mode === 'NORMAL_ONLY') {
    return { ...shared, mode, normal: toSharedPart(input, parts.normal) };
  }

  return { ...shared, mode, excess: toExcessPart(input, parts.excess) };
};
