import { isTransientStatus, type ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import type { OutboxDraft } from '../../patterns/outbox';
import { verdictTextOf } from '../putaway/direct';
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
  /**
   * 그 LOT 을 출고한 생산창고 — 위치 없이 받으면 그 창고 적치 대기로 들어간다. 스캔한 위치는 이 창고로 묶지 않는다
   * (같은 공장의 다른 생산창고 위치도 받는다 · 2026-11-28 사용자 결정).
   */
  issueWarehouseId: number;
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
  issueWarehouseId: lookup.issueWarehouse.warehouseId,
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
  /** 그 위치의 생산창고 — 출고 생산창고와 다를 수 있어 카드에 함께 보인다. */
  warehouseName: string;
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

/** 받는 위치가 생산창고 위치가 아니다 — 위치 조회 400 · 반납 줄 오류(피처 019). */
export const NOT_PRODUCTION_WAREHOUSE = 'NOT_PRODUCTION_WAREHOUSE';

/** 미지정 위치인데 확인 표시가 없다 — 서버 409(적치 009 와 같은 코드). */
export const UNDESIGNATED_NEEDS_CONFIRM = 'UNDESIGNATED_NEEDS_CONFIRM';

export type SendFailure =
  /** 연결 · 기다리면 풀리는 실패 — 대기열에 담는다. */
  | { kind: 'queue' }
  /** 미지정 위치 — 확인 카드. */
  | { kind: 'confirm' }
  /** 서버가 거절했다 — 아는 코드는 단말 언어 문구, 모르면 서버 문구(없으면 null). */
  | { kind: 'rejected'; message: string | null };

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

const codesOf = (error: ApiError): string[] => linesOf(error).map((line) => line.code);

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

/** 서버 넘음 문구 「… (반납 가능 100)」에서 그때의 반납 가능 양을 꺼낸다 — 단위는 화면이 붙인다. */
const RETURNABLE_IN_MESSAGE = /\(\D*?([\d.,]+)\s*\)\s*$/u;

/**
 * 거절 한 줄의 문구를 오류 코드로 꺼낸다(서버 문구는 한국어 하나라 베트남어 화면에 그대로 쓰지 않는다 · 적치
 * `verdictTextOf` 와 같은 방식 · 실제 앱 확인 F-03). 모르는 코드면 null.
 */
const reasonOfLine = (line: ErrorLine, uomCode: string): string | null => {
  const r = messages.materialReturn.reason;

  switch (line.code) {
    case 'NOT_RETURNABLE':
    case 'NOTHING_TO_RETURN':
    case 'WORK_ORDER_MISMATCH':
    case NOT_PRODUCTION_WAREHOUSE:
    case 'STAGING':
      return r[line.code];
    case 'INVALID':
      return line.field?.endsWith('.lotId') === true ? r.lotMissing : null;
    case 'RANGE': {
      const found = RETURNABLE_IN_MESSAGE.exec(line.message)?.[1];
      if (line.field?.endsWith('.returnQty') !== true || found === undefined) return null;
      const qty = Number(found.replace(/,/g, ''));

      return r.overReturnable(Number.isFinite(qty) ? qtyText(qty, uomCode) : found);
    }
    default:
      return verdictTextOf(line.code);
  }
};

/**
 * 거절 문구 — 아는 코드는 단말 언어 문구로, 모르는 코드만 서버 문구 그대로. 둘 다 없으면 null.
 * `uomCode` 는 넘음 문구의 단위(그 LOT 의 단위).
 */
export const reasonOf = (error: ApiError, uomCode = ''): string | null => {
  if (error.kind === 'network') return null;
  const known = linesOf(error)
    .map((line) => reasonOfLine(line, uomCode))
    .filter((text): text is string => text !== null);

  return known.length > 0 ? [...new Set(known)].join(' ') : messageOf(error);
};

/** 보내기 실패를 가른다 — 기다리면 풀리는 것만 대기열, 미지정은 확인, 나머지는 거절 문구. */
export const sendFailureOf = (error: ApiError, uomCode = ''): SendFailure => {
  if (error.kind === 'network') return { kind: 'queue' };
  if (error.kind === 'http' && isTransientStatus(error.status)) return { kind: 'queue' };
  if (codesOf(error).includes(UNDESIGNATED_NEEDS_CONFIRM)) return { kind: 'confirm' };

  return { kind: 'rejected', message: reasonOf(error, uomCode) };
};

/**
 * 조회 실패 문구 — 반납 대상 아님 · 남은 양 없음은 단말 언어 문구. 없는 LOT(404)과 연결 실패는 null — 화면이
 * 스캔한 번호를 넣은 「이 공장에 없습니다」 · 연결 문구를 쓴다.
 */
export const lookupMessageOf = (error: ApiError): string | null =>
  error.kind === 'network' || error.status === 404 ? null : reasonOf(error);

/**
 * 위치 스캔이 막힌 까닭 — 없는 위치(404 · 사용 중지 · 단말 공장 밖) · 생산창고 위치 아님(400 `NOT_PRODUCTION_WAREHOUSE`)
 * · 그 밖에 아는 판정 코드(적치 대기 자리 400 `STAGING` 은 반납 문구, 나머지는 적치 판정 문구) · 그 밖의 실패. 앞의 둘은 화면이 스캔한 코드를 넣어 문구를
 * 고르고, 그 밖의 실패는 PDA 공통 조회 실패 문구다.
 */
export type LocationLookupFailure =
  | { kind: 'notFound' }
  | { kind: 'notProduction' }
  | { kind: 'rejected'; message: string }
  | { kind: 'failed' };

export const locationLookupFailureOf = (error: ApiError): LocationLookupFailure => {
  if (error.kind === 'network') return { kind: 'failed' };
  if (codesOf(error).includes(NOT_PRODUCTION_WAREHOUSE)) return { kind: 'notProduction' };
  if (error.status === 404) return { kind: 'notFound' };
  const known = linesOf(error)
    .map((line) => reasonOfLine(line, ''))
    .filter((text): text is string => text !== null);

  return known.length > 0 ? { kind: 'rejected', message: known.join(' ') } : { kind: 'failed' };
};

export type Done =
  | {
      kind: 'located';
      lot: ReturnLot;
      qty: number;
      locationCode: string;
      warehouseName: string;
    }
  | { kind: 'staged'; lot: ReturnLot; qty: number }
  /** 위치 없이 받았는데 적치 지시가 없다 — 사람 위치 없는 생산창고(창고 전체)로 받았다. */
  | { kind: 'whole'; lot: ReturnLot; qty: number; warehouseName: string }
  | { kind: 'queued'; lot: ReturnLot; qty: number };

/**
 * 응답으로 본 끝 — 위치를 주고 받았으면 그 위치. 위치 없이 받았으면 출고 생산창고의 적치 대기(적치 지시가 생긴다)이고,
 * 응답 줄에 적치 지시(`putawayTaskId`)가 없으면 그 창고 전체로 받은 것이다(사람 위치 없는 생산창고 · 적치 안내 없음).
 */
export const doneOf = (
  lot: ReturnLot,
  qty: number,
  target: ReturnTarget | null,
  response: MaterialReturn | null,
): Done => {
  if (target === null) {
    const line = response?.lines?.[0];
    return line !== undefined && (line.putawayTaskId ?? null) === null
      ? { kind: 'whole', lot, qty, warehouseName: lot.issueWarehouseName }
      : { kind: 'staged', lot, qty };
  }
  const code = response?.lines?.[0]?.destinationLocationCode ?? target.locationCode;

  return { kind: 'located', lot, qty, locationCode: code, warehouseName: target.warehouseName };
};
