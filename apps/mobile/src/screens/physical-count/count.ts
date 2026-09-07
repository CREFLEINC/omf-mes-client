import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { createIdempotencyKey, type OutboxDraft } from '../../patterns/outbox';
import { businessDateOf } from '../putaway/putaway';

export type InventoryCount = components['schemas']['InventoryCount'];
export type InventoryCountLine = components['schemas']['InventoryCountLine'];
export type InventoryCountLineUpsert = components['schemas']['InventoryCountLineUpsert'];
export type InventoryCountLineReplace = components['schemas']['InventoryCountLineReplace'];

/**
 * 담는 경로의 이름.
 *
 * 담는 쪽과 세는 쪽이 이 상수를 함께 쓴다. 문자열을 양쪽에 적으면 한쪽만 고쳐졌을 때 셈이
 * 조용히 0 이 되고, 오프라인에서 같은 위치를 두 번 보내는 것을 막지 못한다.
 */
export const COUNT_LABEL = messages.physicalCount.record.counted;

/**
 * 화면이 든 한 줄.
 *
 * 수량이 빈 글자면 아직 세지 않은 것이다. 0 은 세었더니 없더라는 뜻이라 서로 다르다 -
 * 안 센 것을 0 으로 보내면 관리웹이 그것을 전량 손실로 잡는다.
 */
export interface DraftLine {
  inventoryCountLineId: number;
  locationId: number;
  itemId: number;
  lotId: number | null;
  uomId: number;
  /** 장부 수량. 블라인드 실사에서는 서버가 내려보내지 않아 없다. */
  systemQty: number | null;
  /** 서버가 이 줄을 이미 센 것으로 보는가. 화면이 countedQty 의 0 으로 판정하지 않는다. */
  counted: boolean;
  /** 이미 센 줄의 이전 값. 덮어쓸 때 무엇을 바꾸는지 보이려고 든다. */
  previousQty: number | null;
  qty: string;
}

export type QtyProblem = 'notNumber' | 'negative';

/**
 * 실물 수량 하나를 본다.
 *
 * 0 을 막지 않는다 - 세어 보니 없더라는 유효한 답이다. 빈 글자는 아직 세지 않은 것이라
 * 문제로 보지 않는다.
 */
export const qtyProblemOf = (line: DraftLine): QtyProblem | null => {
  const trimmed = line.qty.trim();

  if (trimmed === '') {
    return null;
  }

  const value = Number(trimmed);

  if (!Number.isFinite(value)) {
    return 'notNumber';
  }

  return value < 0 ? 'negative' : null;
};

/**
 * 이번에 센 줄.
 *
 * 빈 글자는 안 센 것이다. 그 줄은 보내지 않는다 - 계약이 없는 라인을 미실사로 읽는다.
 */
export const countedLines = (lines: DraftLine[]): DraftLine[] =>
  lines.filter((line) => line.qty.trim() !== '');

export const canSubmit = (
  location: { locationId: number } | null,
  lines: DraftLine[],
  hasWorker: boolean,
  queuedForLocation: number,
): boolean => {
  if (location === null || !hasWorker || queuedForLocation > 0) {
    return false;
  }

  const counted = countedLines(lines);

  return counted.length > 0 && counted.every((line) => qtyProblemOf(line) === null);
};

/** 실사 라인 치환 경로. 위치는 경로가 아니라 본문이 든다. */
export const linesPathOf = (inventoryCountId: number): string =>
  `/inventory/counts/${String(inventoryCountId)}/lines`;

/**
 * 이 위치를 이 단말이 이미 세어 큐에 담아 두었는가.
 *
 * 서버 응답에는 아직 안 간 건이 없다. 오프라인에서 같은 위치를 두 번 보내면 뒤엣것이 앞엣것을
 * 치환하는데, 그 사이에 지운 줄이 있으면 조용히 사라진다.
 *
 * 경로만 보면 같은 실사의 다른 위치까지 세어 한 위치를 센 뒤 나머지 위치가 전부 막힌다.
 */
export const queuedForLocationOf = (
  entries: { path?: string; body?: unknown }[],
  inventoryCountId: number,
  locationId: number,
): number =>
  entries.filter(
    (entry) =>
      entry.path === linesPathOf(inventoryCountId) &&
      (entry.body as { locationId?: number } | undefined)?.locationId === locationId,
  ).length;

/**
 * 이 위치의 실사 라인을 치환한다.
 *
 * 위치 단위로 끊어 치환한다 - 화면이 위치마다 끊고 계약도 그렇게 받는다. 안 센 줄은
 * 싣지 않아 서버가 미실사로 남긴다.
 */
export const toCountDraft = (
  count: InventoryCount,
  locationId: number,
  lines: DraftLine[],
  now: Date,
  workerNo: string,
): OutboxDraft => {
  const occurredAt = now.toISOString();
  const body: InventoryCountLineReplace = {
    /* 치환할 위치는 본문이 든다 - 계약이 이 경로에 조회 문자열을 두지 않는다. */
    locationId,
    businessDate: businessDateOf(now),
    occurredAt,
    lines: countedLines(lines).map((line): InventoryCountLineUpsert => ({
      inventoryCountLineId: line.inventoryCountLineId,
      locationId: line.locationId,
      itemId: line.itemId,
      lotId: line.lotId,
      countedQty: Number(line.qty.trim()),
      uomId: line.uomId,
      /* 센 시각은 이 단말의 것이다. 서버가 받은 시각이 아니다. */
      countedAt: occurredAt,
    })),
  };

  return {
    label: COUNT_LABEL,
    workerNo,
    idempotencyKey: createIdempotencyKey(),
    method: 'PUT',
    path: linesPathOf(count.inventoryCountId),
    body,
    occurredAt,
    confirmation: 'pending',
  };
};
