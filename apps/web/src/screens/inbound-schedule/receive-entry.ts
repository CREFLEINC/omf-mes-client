import type { components } from '@omf-mes/api-client';

import { roomOf } from './excess-match';
import { exactQty } from './qty';
import type { InboundScheduleLine } from './types';

/**
 * 입고 관리의 **입하 등록 규칙** — 라인 표에서 바로 받는다(사용자 지시 2026-10-24 · PDA 「라벨 미부착 일괄 입하」와 같은 길).
 *
 * - **체크해 한꺼번에**: 체크한 라인은 남은 수량 그대로 받는다. 거의 다 문제없이 들어오므로 이상 없는 품목은 한 번에 받고,
 *   문제가 있는 품목만 따로 처리한다.
 * - **행을 눌러 한 품목만**: 그 줄의 이번 입하 수량을 정해 받는다. 남은 수량보다 많으면 넘는 몫이 초과분이다.
 * - **라벨 미부착으로만 받는다**(사용자 결정 2026-10-24) — LOT 은 POP 「자재LOT 등록·라벨 발행」에서 받는다.
 *   입하 일시는 누른 순간, 거래명세서번호 · 차량번호 · 포장 수 · 날짜는 비운다(PDA 와 같다).
 * - **입하번호는 품목마다 하나**다(서버 `POST /logistics/inbound-receipts:per-line` · 장부 P-117) — 한 번에 보내도
 *   줄마다 입하 한 건이 서고, 한 줄이라도 막히면 아무것도 서지 않는다.
 */
export type InboundReceiptCreate = components['schemas']['InboundReceiptCreate'];

type ReceiptLine = InboundReceiptCreate['lines'][number] & {
  /** 서버 장부 P-100 · P-115 — `receivedQty` 중 P/O 라인에 넣지 않는 몫(초과분). 계약 사본 밖이라 생성 타입에 없다. */
  excessQty?: number;
  /** 계약에는 있으나 생성 타입에 아직 없다(입하 등록 창과 같은 넓힘). */
  supplierLotLabelAttached?: boolean;
};

export type ReceiveBody = Omit<InboundReceiptCreate, 'lines'> & { lines: ReceiptLine[] };

/** 라벨 미부착의 기본 사유 — 공통 코드 `SUBSTITUTE_LOT_REASON` 의 「라벨 없음」(PDA 와 같다). */
export const DEFAULT_SUBSTITUTE_LOT_REASON = 'NO_LABEL';

/** 받을 줄 하나 — 그 라인과 이번에 받는 수량. */
export interface ReceivePick {
  line: InboundScheduleLine;
  qty: number;
}

/** 취소된 라인은 받지 않는다. */
const isOpenLine = (line: InboundScheduleLine): boolean =>
  line.cancelledAt === null && line.receiptStatusCode !== 'CANCELLED';

/** 체크할 수 있는 줄 — 받을 것이 남은 줄. 다 받은 줄은 행을 눌러 초과분으로만 받는다. */
export const isCheckable = (line: InboundScheduleLine): boolean =>
  isOpenLine(line) && line.remainingQty > 0;

/** 행을 눌러 받을 수 있는 줄 — 취소되지 않은 줄 전부(다 받은 줄에도 초과 입하가 온다). */
export const isEditable = (line: InboundScheduleLine): boolean => isOpenLine(line);

/**
 * 일부만 받고 남은 줄 — 「모두 선택」이 빼는 줄이다(PDA 와 같다). 남은 수량을 그대로 넣으면 부분 입하가 무색해진다 —
 * 남은 것이 따로 올 수 있으니 하나씩 체크해야 넣는다.
 */
export const isPartial = (line: InboundScheduleLine): boolean =>
  isCheckable(line) && line.receivedQty > 0;

/**
 * 이번 수량 중 P/O 에 넣을 몫과 초과분. 서버 한도(`발주 + 초과 허용치 − 누적 입하`)와 같은 식이다 — 한도까지는 정량,
 * **넘는** 몫이 초과분이다. 한도가 0 이면(다 받은 줄) 전부 초과분이다(P-115 가 받는다). 셈은 서버 자릿수의 정수로 한다
 * (`exactQty`) — 소수 라인에서 부동소수 오차가 초과분으로 실리지 않게.
 */
export const splitReceiveQty = (
  line: InboundScheduleLine,
  qty: number,
): { normalQty: number; excessQty: number } => {
  const limit = Math.max(roomOf(line), 0);
  const normalQty = Math.min(qty, limit);

  return { normalQty, excessQty: exactQty((to) => to(qty) - to(normalQty)) };
};

/** 받을 줄들의 지문 — 같은 줄 · 같은 수량이면 같은 시도다(입하 일시를 붙드는 열쇠). */
export const picksKeyOf = (picks: readonly ReceivePick[]): string =>
  picks.map(({ line, qty }) => `${String(line.purchaseOrderLineId)}:${String(qty)}`).join(',');

/** 수량 입력의 판정 — 비었거나 숫자가 아니거나 0 이하면 받지 않는다. */
export type QtyCheck =
  | { kind: 'qty'; value: number }
  | { kind: 'empty' }
  | { kind: 'notNumber' }
  | { kind: 'notPositive' };

export const checkQty = (text: string): QtyCheck => {
  const trimmed = text.trim();

  if (trimmed === '') return { kind: 'empty' };

  const value = Number(trimmed);

  if (!Number.isFinite(value)) return { kind: 'notNumber' };

  return value > 0 ? { kind: 'qty', value } : { kind: 'notPositive' };
};

/** 「모두 선택」 — 체크할 수 있는 줄 중 부분 입하를 뺀 것. 뺀 수를 함께 낸다(말없이 빼면 다 고른 줄 안다). */
export const selectAllOf = (
  lines: readonly InboundScheduleLine[],
): { ids: number[]; skippedPartial: number } => {
  const checkable = lines.filter(isCheckable);

  return {
    ids: checkable.filter((line) => !isPartial(line)).map((line) => line.purchaseOrderLineId),
    skippedPartial: checkable.filter(isPartial).length,
  };
};

/**
 * 보낼 본문 — 한 발주의 줄들(같은 공급사 · 공장). 줄마다 LOT 번호 없음 · 라벨 미부착 · 대체 사유를 싣고, 초과분이 있으면
 * `excessQty` 를 싣는다. `businessDate` 는 공장 현지 오늘이다.
 */
export const toReceiveBody = (
  picks: readonly ReceivePick[],
  substituteLotReasonCode: string,
  businessDate: string,
  now: Date,
): ReceiveBody => {
  const first = picks[0];

  if (first === undefined) throw new Error('받을 줄이 없습니다.');

  const occurredAt = now.toISOString();

  return {
    supplierId: first.line.supplierId,
    plantId: first.line.plantId,
    receiptDatetime: occurredAt,
    deliveryNoteNo: null,
    vehicleNo: null,
    businessDate,
    occurredAt,
    lines: picks.map(({ line, qty }) => {
      const { excessQty } = splitReceiveQty(line, qty);

      return {
        purchaseOrderLineId: line.purchaseOrderLineId,
        itemId: line.itemId,
        receivedQty: qty,
        uomId: line.uomId,
        packageCount: null,
        supplierLotNo: null,
        supplierLotMissing: true,
        supplierLotLabelAttached: false,
        substituteLotReasonCode,
        manufacturedDate: null,
        expiryDate: null,
        ...(excessQty > 0 ? { excessQty } : {}),
      };
    }),
  };
};

/** 라벨 미부착 사유 — 「라벨 없음」이 있으면 그것, 없으면 첫 코드. 코드가 하나도 없으면 `null`(받지 않는다). */
export const defaultReasonOf = (codes: readonly { code: string }[]): string | null =>
  codes.some((each) => each.code === DEFAULT_SUBSTITUTE_LOT_REASON)
    ? DEFAULT_SUBSTITUTE_LOT_REASON
    : (codes[0]?.code ?? null);
