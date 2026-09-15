import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { createIdempotencyKey, type OutboxDraft } from '../../patterns/outbox';
import { businessDateOf } from '../putaway/putaway';

export type InventoryCount = components['schemas']['InventoryCount'];
export type InventoryCountLine = components['schemas']['InventoryCountLine'];
export type InventoryCountLineUpsert = components['schemas']['InventoryCountLineUpsert'];
export type InventoryCountLineReplace = components['schemas']['InventoryCountLineReplace'];
export type InventoryCountSummary = components['schemas']['InventoryCountSummary'];

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
  /*
   * 화면 안에서 줄을 가르는 열쇠. 계획에 없던 재고를 더한 줄은 서버 번호가 없어, 번호로
   * 가르면 그 줄에 적은 값이 다른 줄로 간다.
   */
  key: string;
  /* 계획 라인의 번호. 계획에 없던 재고를 더한 줄은 없다 - 서버가 채번한다. */
  inventoryCountLineId: number | null;
  locationId: number;
  itemId: number;
  lotId: number | null;
  uomId: number;
  /*
   * 서버가 라인에 실어 보내는 표시용 값. 식별자를 사람이 읽는 값으로 바꾸려 마스터를 다시
   * 부르지 않는다 - 모바일은 오프라인에서 그 마스터를 갱신할 수 없어, 다시 부르면 연결이
   * 끊긴 자리에서 줄마다 이름이 통째로 사라진다.
   */
  itemCode: string;
  lotNo: string | null;
  /** 장부 수량. 블라인드 실사에서는 서버가 내려보내지 않아 없다. */
  systemQty: number | null;
  /** 서버가 이 줄을 이미 센 것으로 보는가. 화면이 countedQty 의 0 으로 판정하지 않는다. */
  counted: boolean;
  /** 이미 센 줄의 이전 값. 덮어쓸 때 무엇을 바꾸는지 보이려고 든다. */
  previousQty: number | null;
  previousCountedAt: string | null;
  previousReasonCode: string | null;
  qty: string;
  reasonCode: string;
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

/**
 * 센 값과 전산 잔량의 차이. 조정이 이 수만큼 나간다.
 *
 * 사유를 요구하면서 얼마인지 말하지 않으면 사람이 암산해 고른다. 되돌릴 수 없는 쓰기라
 * 그 암산이 틀리면 원장이 틀어진다.
 *
 * 블라인드 실사는 전산 잔량이 오지 않아 화면이 차이를 모른다 - 그때는 null 이다.
 */
export const diffOf = (line: DraftLine): number | null => {
  if (line.systemQty === null || line.qty.trim() === '' || qtyProblemOf(line) !== null) {
    return null;
  }

  const counted = Number(line.qty.trim());

  return counted === line.systemQty ? null : counted - line.systemQty;
};

/** 장부 차이를 알 수 있는 계수와 기존 블라인드 재계수만 사유를 요구한다. */
export const needsReason = (
  count: Pick<InventoryCount, 'blindCount'>,
  line: DraftLine,
): boolean => {
  if (line.qty.trim() === '' || qtyProblemOf(line) !== null) return false;
  const qty = Number(line.qty.trim());
  if (count.blindCount) return line.counted && line.previousQty !== qty;
  if (line.systemQty === null) return true;
  if (qty === line.systemQty) return false;

  /*
   * 손대지 않은 줄에 사유가 이미 붙어 있으면 다시 묻지 않는다. 다만 판정은 서버에 무엇이
   * 있었나가 아니라 지금 보낼 것이 있나로 한다 - 수량을 전산과 같게 고치면 화면이 사유를
   * 지우는데, 되돌려 차이가 다시 생겨도 서버에 있었다는 사실만 보면 고를 자리를 주지 않는다.
   * 그러면 사유 없이 나가 서버가 되돌려 보낸다.
   */
  return !line.counted || line.previousQty !== qty || line.reasonCode === '';
};

export const canSubmit = (
  location: { locationId: number } | null,
  lines: DraftLine[],
  hasWorker: boolean,
  queuedForLocation: number,
  count: Pick<InventoryCount, 'blindCount'>,
  activeReasonCodes: readonly string[],
): boolean => {
  if (location === null || !hasWorker || queuedForLocation > 0) {
    return false;
  }

  const counted = countedLines(lines);

  return (
    counted.length > 0 &&
    counted.every(
      (line) =>
        qtyProblemOf(line) === null &&
        (!needsReason(count, line) || activeReasonCodes.includes(line.reasonCode)),
    )
  );
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
      /* 번호가 없으면 신규 행이다 - 계약이 그것으로 계획에 없던 재고를 가른다. */
      ...(line.inventoryCountLineId === null
        ? {}
        : { inventoryCountLineId: line.inventoryCountLineId }),
      locationId: line.locationId,
      itemId: line.itemId,
      lotId: line.lotId,
      countedQty: Number(line.qty.trim()),
      uomId: line.uomId,
      /*
       * 기존 계수를 그대로 동봉할 때는 최초 계수 시각을 보존한다. 위치 전체를 치환하므로
       * 손대지 않은 줄도 함께 나가는데, 그 줄의 시각까지 지금으로 바꾸면 언제 셌나가 전송
       * 시각으로 덮인다.
       */
      countedAt:
        line.counted &&
        line.previousQty === Number(line.qty.trim()) &&
        line.reasonCode === (line.previousReasonCode ?? '') &&
        line.previousCountedAt !== null
          ? line.previousCountedAt
          : occurredAt,
      /*
       * 사유는 고른 것이 있으면 싣는다. 서버가 차이 있는 줄을 사유 없이 받지 않으므로,
       * 앞서 센 줄에 붙어 있던 사유를 빠뜨리면 손대지도 않은 줄 때문에 전송이 되돌아온다.
       * 블라인드의 미보완 줄은 사유 자체가 비어 있어 여기서 걸러진다.
       */
      ...(line.reasonCode === '' ? {} : { varianceReasonCode: line.reasonCode }),
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
