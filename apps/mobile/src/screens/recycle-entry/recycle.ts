import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import type { Location } from '../../patterns/locations';
import { createIdempotencyKey, type OutboxDraft } from '../../patterns/outbox';
import { businessDateOf } from '../putaway/putaway';

export type RecycleEntryCreate = components['schemas']['RecycleEntryCreate'];
export type RecycleEntry = components['schemas']['RecycleEntry'];

/** 이 화면이 품목에서 읽는 것. 구분은 품목 마스터의 값이고 화면이 정하지 않는다. */
export interface ItemRow {
  itemId: number;
  itemCode: string;
  itemName: string;
  /** 신재와 재생재를 가르는 MES 안쪽 구분. 값 목록이 확정 전이라 문자 그대로 둔다. */
  mesCategoryCode?: string;
  baseUomId?: number;
}

export const RECYCLE_PATH = '/logistics/recycle-entries';

/**
 * 재생재 구분 자리표시.
 *
 * 값 목록이 아직 확정되지 않았다(공유계약 G-2). 여기서 지어내 실으면 값이 정해지는 날 조용히
 * 어긋나므로, 화면은 이 값을 서버에 보내지 않고 어느 품목 행인지 고르는 데만 쓴다.
 */
export const RECYCLED = 'RECYCLED';

/**
 * 같은 품목코드로 온 행 중 재생재 행.
 *
 * 품목코드 하나에 행이 둘 온다 - 신재와 재생재가 같은 기간계 코드를 쓴다. 한 건으로 가정하고
 * 첫 행을 잡으면 신재로 재고가 늘어나고, 그 수량은 되돌릴 자리가 없다.
 */
export const recycledRowOf = (rows: ItemRow[]): ItemRow | null =>
  rows.find((row) => row.mesCategoryCode === RECYCLED) ?? null;

export type QtyProblem = 'empty' | 'notNumber' | 'notPositive';

/** 0 이하는 서버가 400 으로 막는다. 보내기 전에 현장이 알아야 한다. */
export const qtyProblem = (text: string): QtyProblem | null => {
  const trimmed = text.trim();

  if (trimmed === '') {
    return 'empty';
  }

  const value = Number(trimmed);

  if (!Number.isFinite(value)) {
    return 'notNumber';
  }

  return value <= 0 ? 'notPositive' : null;
};

export interface RecycleDraft {
  /** 스캔하거나 적은 품목코드. 이것으로 찾고, 고르는 것은 품목 행이다. */
  itemCode: string;
  warehouseId: number | null;
  location: Location | null;
  quantity: string;
  remarks: string;
}

export const canSubmit = (
  draft: RecycleDraft,
  item: ItemRow | null,
  hasWorker: boolean,
): boolean => {
  if (!hasWorker || item === null) {
    return false;
  }

  if (draft.warehouseId === null || draft.location === null) {
    return false;
  }

  return qtyProblem(draft.quantity) === null;
};

export const toOutboxDraft = (
  draft: RecycleDraft,
  itemId: number,
  warehouseId: number,
  locationId: number,
  now: Date,
  workerNo: string,
): OutboxDraft => {
  const occurredAt = now.toISOString();
  /*
   * 구분을 본문에 담지 않는다. 그것은 품목 마스터의 값이고, 화면은 품목코드와 구분으로
   * 어느 품목 행인가를 정한 뒤 그 품목 번호 하나만 보낸다. 단위도 보내지 않는다 - 품목의
   * 기본 단위를 서버가 쓴다.
   */
  const body: RecycleEntryCreate = {
    itemId,
    quantity: Number(draft.quantity.trim()),
    warehouseId,
    locationId,
    businessDate: businessDateOf(now),
    occurredAt,
    ...(draft.remarks.trim() === '' ? {} : { remarks: draft.remarks.trim() }),
  };

  return {
    label: messages.recycleEntry.record,
    workerNo,
    idempotencyKey: createIdempotencyKey(),
    method: 'POST',
    path: RECYCLE_PATH,
    body,
    occurredAt,
    confirmation: 'pending',
  };
};
