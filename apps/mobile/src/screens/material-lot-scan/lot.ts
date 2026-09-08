import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import {
  MATERIAL_LOT_NO_LENGTH,
  isYymmdd,
  parseMaterialLotNo,
} from '../../patterns/material-lot-no';
import { createIdempotencyKey, type OutboxDraft } from '../../patterns/outbox';
import { businessDateOf } from '../putaway/putaway';

export type InboundReceipt = components['schemas']['InboundReceipt'];
export type InboundReceiptLine = components['schemas']['InboundReceiptLine'];
export type LotCreate = components['schemas']['LotCreate'];

/**
 * 담는 경로의 이름.
 *
 * 담는 쪽과 세는 쪽이 이 상수를 함께 쓴다. 문자열을 양쪽에 적으면 한쪽만 고쳐졌을 때 셈이
 * 조용히 0 이 되고, 같은 번호를 큐에 두 번 담는 것을 막지 못한다.
 */
export const LOT_LABEL = messages.materialLotScan.record.registered;

/** 공급사가 매긴 번호를 수용하는 경로다. 서버 채번은 이 화면 밖이다. */
export const SUPPLIER = 'SUPPLIER';

/** 자재 LOT 이다. 이 값 목록은 고객이 편집하지 않는다. */
export const MATERIAL = 'MATERIAL';

/** 발번 단위가 건이 아니라 라인이라 원천은 라인을 가리킨다. */
export const INBOUND_RECEIPT_LINE = 'INBOUND_RECEIPT_LINE';

export const LOT_NO_LENGTH = MATERIAL_LOT_NO_LENGTH;

export type ScanProblem = 'length' | 'notDigits' | 'badDate' | 'duplicate';

/**
 * 이 라인에 LOT 을 채울 수 있는가.
 *
 * 계약이 응답에 `lotId` 를 실어 준다. 화면이 짐작하지 않고 그 값으로 거른다.
 */
export const isFillable = (line: InboundReceiptLine): boolean =>
  line.supplierLotMissing === false && (line.lotId === null || line.lotId === undefined);

/**
 * 스캔값 하나를 본다.
 *
 * 자릿수와 숫자 전용은 저장소 제약이 아니라 화면 책임이다. 서버가 받아 주므로 화면이
 * 막지 않으면 분절이 어긋난 번호가 그대로 남는다.
 *
 * 큐 안의 중복만 여기서 본다 - 같은 공장에 이미 있는지는 서버만 안다.
 */
export const scanProblemOf = (value: string, queuedLotNos: string[]): ScanProblem | null => {
  const trimmed = value.trim();

  if (!/^\d*$/.test(trimmed)) {
    return 'notDigits';
  }

  if (trimmed.length !== LOT_NO_LENGTH) {
    return 'length';
  }

  const segments = parseMaterialLotNo(trimmed);

  if (segments === null || !isYymmdd(segments.date)) {
    return 'badDate';
  }

  return queuedLotNos.includes(trimmed) ? 'duplicate' : null;
};

/**
 * 라벨이 표기한 최초 납품 수량.
 *
 * 라인의 실제 수량과 다를 수 있다 - 부분 입고·분할·정정이 라인 쪽에만 반영된다. 계약이
 * 받는 `initialQty` 는 라벨의 스냅샷이라 여기서 읽는다.
 */
export const labelQtyOf = (value: string): number | null => {
  const segments = parseMaterialLotNo(value.trim());

  return segments === null ? null : Number(segments.qty);
};

export const canRegister = (
  line: InboundReceiptLine | null,
  value: string,
  hasWorker: boolean,
  plantId: number | null,
  queuedLotNos: string[],
  queuedLineIds: number[],
): boolean =>
  line !== null &&
  hasWorker &&
  plantId !== null &&
  !queuedLineIds.includes(line.inboundReceiptLineId) &&
  scanProblemOf(value, queuedLotNos) === null &&
  (labelQtyOf(value) ?? 0) > 0;

/**
 * 큐에 담아 둔 LOT 번호.
 *
 * 서버 응답에는 아직 안 간 건이 없다. 오프라인에서 같은 라벨을 두 번 스캔하면 둘 다
 * 통과하고, 뒤엣것이 서버에서 되돌아온다.
 */
export const queuedLotNosOf = (entries: { body?: unknown }[]): string[] =>
  entries
    .map((entry) => (entry.body as { lotNo?: string } | undefined)?.lotNo)
    .filter((lotNo): lotNo is string => typeof lotNo === 'string');

/**
 * 큐에 담아 둔 원천 라인.
 *
 * 라인 하나에 LOT 은 하나다. 서버 목록에는 아직 안 간 건이 없어, 오프라인에서 같은 라인에
 * 다른 라벨을 스캔하면 둘 다 통과하고 라인에 LOT 이 둘 생긴다.
 */
export const queuedLineIdsOf = (entries: { body?: unknown }[]): number[] =>
  entries
    .map((entry) => (entry.body as { sourceId?: number } | undefined)?.sourceId)
    .filter((sourceId): sourceId is number => typeof sourceId === 'number');

/**
 * 이 라인의 LOT 을 만든다.
 *
 * 유일성은 공장과 번호의 짝이라 공장을 지어내지 않는다 - 부르는 쪽이 없을 때 막는다.
 *
 * 라벨에서 수량을 읽지 못하면 만들지 않는다 - 라인 수량으로 바꿔 담으면 라벨과 다른 값이
 * 최초 수량으로 굳는다.
 */
export const toLotDraft = (
  line: InboundReceiptLine,
  lotNo: string,
  plantId: number,
  now: Date,
  workerNo: string,
): OutboxDraft | null => {
  const initialQty = labelQtyOf(lotNo);

  if (initialQty === null || initialQty <= 0) {
    return null;
  }

  const occurredAt = now.toISOString();
  const body: LotCreate = {
    numberSourceCode: SUPPLIER,
    lotNo: lotNo.trim(),
    itemId: line.itemId,
    lotTypeCode: MATERIAL,
    plantId,
    initialQty,
    uomId: line.uomId,
    sourceTypeCode: INBOUND_RECEIPT_LINE,
    sourceId: line.inboundReceiptLineId,
    /* 업무 기준일은 단말이 정한다. 서버가 수신 시각으로 잡으면 날짜 경계에서 어긋난다. */
    businessDate: businessDateOf(now),
    occurredAt,
  };

  return {
    label: LOT_LABEL,
    workerNo,
    idempotencyKey: createIdempotencyKey(),
    method: 'POST',
    path: '/trace/lots',
    body,
    occurredAt,
    confirmation: 'pending',
  };
};
