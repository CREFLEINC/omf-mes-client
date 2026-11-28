import { isTransientStatus, type ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import type { OutboxDraft } from '../../patterns/outbox';
import { plantToday } from '../../patterns/plant-time';
import {
  RETURN_PATH,
  type MaterialReturn,
  type MaterialReturnLotLookup,
  type MaterialReturnReceive,
} from './queries';

/**
 * M-01-15 반납 입고의 판정 — 화면에서 떼어 시험한다(피처 019 · 시안 ⑤).
 *
 * ⭐ LOT 하나씩 바로 보낸다(시안 확정 「PDA 는 LOT 하나씩」) — 위치가 LOT 마다 다르다.
 * ⭐ 사람이 주는 것은 LOT · 수량 · 위치(건너뛸 수 있음)뿐이다. 귀속 W/O 는 그리지 않는다(FR-013) — 「W/O 로 찾기」로
 *    고른 LOT 만 고른 W/O 를 싣는다(FR-016).
 */

/** 반납할 LOT 한 건 — 스캔 조회 또는 「W/O 로 찾기」에서 고른 LOT. */
export interface ReturnLot {
  lotId: number;
  lotNo: string;
  itemCode: string;
  itemName: string;
  uomCode: string;
  returnableQty: number;
  /** 위치 없이 받으면 들어갈 출고 생산창고(그 창고 적치 대기). */
  issueWarehouseName: string;
  /** 「W/O 로 찾기」로 고른 W/O. LOT 스캔이면 null(서버가 자동 귀속). */
  pickedWorkOrderId: number | null;
}

export const lotOf = (
  lookup: MaterialReturnLotLookup,
  pickedWorkOrderId: number | null = null,
): ReturnLot => ({
  lotId: lookup.lotId,
  lotNo: lookup.lotNo,
  itemCode: lookup.item.itemCode,
  itemName: lookup.item.itemName,
  uomCode: lookup.uom.uomCode,
  returnableQty: lookup.returnableQty,
  issueWarehouseName: lookup.issueWarehouse.warehouseName,
  pickedWorkOrderId,
});

/** 「20 EA」 — 정수면 정수로, 소수면 받은 그대로. */
export const qtyText = (qty: number, uomCode: string): string =>
  `${qty.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${uomCode}`.trim();

export const parseQty = (text: string): number | null => {
  const trimmed = text.replace(/,/g, '').trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);

  return Number.isFinite(parsed) ? parsed : null;
};

export type QtyProblem = 'range' | 'integer';

/** 0 < 수량 ≤ 반납 가능, EA 는 정수만. 비었으면 판정하지 않는다(다음 단추만 꺼진다). 서버가 다시 본다(400 RANGE). */
export const qtyProblemOf = (text: string, lot: ReturnLot): QtyProblem | null => {
  const qty = parseQty(text);
  if (qty === null) return null;
  if (lot.uomCode === 'EA' && !Number.isInteger(qty)) return 'integer';
  if (!(qty > 0) || qty > lot.returnableQty) return 'range';

  return null;
};

export const qtyReady = (text: string, lot: ReturnLot): boolean =>
  parseQty(text) !== null && qtyProblemOf(text, lot) === null;

/** 보낼 위치 — 스캔한 위치(미지정이면 사람이 확인했는가) 또는 null(적치 대기로 받기). */
export interface ReturnTarget {
  locationId: number;
  locationCode: string;
  confirmUndesignated: boolean;
}

/** 본문 — 줄 하나. 업무일 · 발생 시각은 단말 값(공유계약 C-8). */
export const toReceiveBody = (
  lot: ReturnLot,
  qty: number,
  target: ReturnTarget | null,
  now: Date,
): MaterialReturnReceive => ({
  businessDate: plantToday(now),
  occurredAt: now.toISOString(),
  lines: [
    {
      lotId: lot.lotId,
      returnQty: qty,
      ...(lot.pickedWorkOrderId === null ? {} : { workOrderId: lot.pickedWorkOrderId }),
      ...(target === null
        ? {}
        : {
            destinationLocationId: target.locationId,
            ...(target.confirmUndesignated ? { confirmUndesignated: true } : {}),
          }),
    },
  ],
});

/** 연결이 끊겨 대기열에 담을 건 — 보내려던 키 · 본문 그대로(서버가 받았을 수 있다). */
export const toReturnDraft = (
  lot: ReturnLot,
  body: MaterialReturnReceive,
  idempotencyKey: string,
  workerNo: string,
): OutboxDraft => ({
  label: messages.materialReturn.pda.title,
  summary: `${lot.lotNo} ${qtyText(body.lines[0]?.returnQty ?? 0, lot.uomCode)}`,
  workerNo,
  idempotencyKey,
  method: 'POST',
  path: RETURN_PATH,
  body,
  occurredAt: body.occurredAt,
  confirmation: 'pending',
});

/** 미지정 위치인데 확인 표시가 없다 — 서버 409(적치 009 와 같은 코드). */
export const UNDESIGNATED_NEEDS_CONFIRM = 'UNDESIGNATED_NEEDS_CONFIRM';

export type SendFailure =
  /** 연결 · 기다리면 풀리는 실패 — 대기열에 담는다. */
  | { kind: 'queue' }
  /** 미지정 위치 — 확인 카드. */
  | { kind: 'confirm' }
  /** 서버가 거절했다 — 서버 문구 그대로(없으면 null). */
  | { kind: 'rejected'; message: string | null };

const codesOf = (error: ApiError): string[] =>
  error.kind === 'validation' || error.kind === 'stateLocked'
    ? error.errors.map((item) => item.code)
    : error.kind === 'network' || error.code === undefined
      ? []
      : [error.code];

const messageOf = (error: ApiError): string | null => {
  const text =
    error.kind === 'validation' || error.kind === 'stateLocked'
      ? error.errors
          .map((item) => item.message.trim())
          .filter((line) => line !== '')
          .join(' ')
      : error.kind === 'network'
        ? ''
        : (error.message ?? '').trim();

  return text === '' ? null : text;
};

/** 보내기 실패를 가른다 — 기다리면 풀리는 것만 대기열, 미지정은 확인, 나머지는 서버 문구. */
export const sendFailureOf = (error: ApiError): SendFailure => {
  if (error.kind === 'network') return { kind: 'queue' };
  if (error.kind === 'http' && isTransientStatus(error.status)) return { kind: 'queue' };
  if (codesOf(error).includes(UNDESIGNATED_NEEDS_CONFIRM)) return { kind: 'confirm' };

  return { kind: 'rejected', message: messageOf(error) };
};

/** 조회 실패 문구 — 서버 문구 그대로(반납 대상 아님 · 남은 양 없음), 없으면 null. */
export const lookupMessageOf = (error: ApiError): string | null =>
  error.kind === 'network' ? null : messageOf(error);

export type Done =
  | { kind: 'located'; lot: ReturnLot; qty: number; locationCode: string }
  | { kind: 'staged'; lot: ReturnLot; qty: number }
  | { kind: 'queued'; lot: ReturnLot; qty: number };

/** 응답으로 본 끝 — 위치를 주고 받았으면 그 위치, 아니면 출고 생산창고 적치 대기(적치 지시가 생긴다). */
export const doneOf = (
  lot: ReturnLot,
  qty: number,
  target: ReturnTarget | null,
  response: MaterialReturn | null,
): Done => {
  if (target === null) return { kind: 'staged', lot, qty };
  const code = response?.lines?.[0]?.destinationLocationCode ?? target.locationCode;

  return { kind: 'located', lot, qty, locationCode: code };
};
