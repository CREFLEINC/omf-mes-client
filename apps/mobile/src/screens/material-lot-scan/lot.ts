import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import {
  codeMismatchOf,
  materialLotNoProblemOf,
  parseMaterialLotNo,
  type MaterialLotCodeMismatch,
  type MaterialLotCodes,
  type MaterialLotNoProblem,
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

export type ScanProblem = MaterialLotNoProblem | 'duplicate' | MaterialLotCodeMismatch;

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
 * ⛔ 이 경로(`POST /trace/lots` 공급사 채번)는 서버가 번호의 형식도 제품코드·공급사도 보지
 *    않는다. 화면이 막지 않으면 형식이 틀리거나 남의 자재에 붙은 라벨이 그대로 LOT 이 된다.
 *
 * 큐 안의 중복만 여기서 본다 - 같은 공장에 이미 있는지는 서버만 안다.
 *
 * 코드를 아직 모르면(`null`) 코드 대조를 건너뛴다. 그동안 등록은 `canRegister` 가 막는다.
 */
export const scanProblemOf = (
  value: string,
  queuedLotNos: string[],
  codes: MaterialLotCodes | null,
): ScanProblem | null => {
  const trimmed = value.trim();
  const format = materialLotNoProblemOf(trimmed);

  if (format !== null) {
    return format;
  }

  if (queuedLotNos.includes(trimmed)) {
    return 'duplicate';
  }

  const segments = parseMaterialLotNo(trimmed);

  /* 다른 품목·공급사의 라벨이면 그 라인에 남의 LOT 이 붙는다. 입하 등록이라면 서버가 막았을 라벨이다. */
  return codes === null || segments === null ? null : codeMismatchOf(segments, codes);
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

/**
 * 등록할 수 있는가.
 *
 * 견줄 코드를 모르면 등록하지 않는다 - 서버가 이 경로를 검사하지 않아, 모르는 채 보내면
 * 대조 없이 LOT 이 선다.
 */
export const canRegister = (
  line: InboundReceiptLine | null,
  value: string,
  hasWorker: boolean,
  plantId: number | null,
  queuedLotNos: string[],
  queuedLineIds: number[],
  codes: MaterialLotCodes | null,
): boolean =>
  line !== null &&
  hasWorker &&
  plantId !== null &&
  codes !== null &&
  !queuedLineIds.includes(line.inboundReceiptLineId) &&
  scanProblemOf(value, queuedLotNos, codes) === null &&
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
