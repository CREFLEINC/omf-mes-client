import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { createIdempotencyKey, type OutboxDraft } from '../../patterns/outbox';
import { businessDateOf } from '../putaway/putaway';

export type HandlingUnit = components['schemas']['HandlingUnit'];
export type HandlingUnitContent = components['schemas']['HandlingUnitContent'];
export type Warehouse = components['schemas']['Warehouse'];
export type Location = components['schemas']['Location'];
export type Lot = components['schemas']['Lot'];
export type GoodsReceiptCreate = components['schemas']['GoodsReceiptCreate'];
export type GoodsReceiptLineCreate = components['schemas']['GoodsReceiptLineCreate'];
export type PutawayTaskComplete = components['schemas']['PutawayTaskComplete'];

/**
 * 담는 경로의 이름.
 *
 * 담는 쪽과 세는 쪽이 이 상수를 함께 쓴다. 문자열을 양쪽에 적으면 한쪽만 고쳐졌을 때 셈이
 * 조용히 0 이 되고, 같은 인식표를 두 번 입고하는 것을 막지 못한다.
 */
export const RECEIPT_LABEL = messages.productReceipt.record.received;
export const PUTAWAY_LABEL = messages.productReceipt.record.putaway;

/** 제품 입고다. 값 목록은 서버에서 받고 이 화면은 그중 이 값을 고른다. */
export const PRODUCT = 'PRODUCT';

/** 창고 관리 수준이 창고까지면 위치를 받지 않는다. 값 순서가 계층 깊이를 뜻한다. */
export const WAREHOUSE_LEVEL = 'WAREHOUSE';

/** 위치를 관리하지 않는 창고의 흡수용 위치. */
export const DEFAULT_LOCATION = 'DEFAULT';

/** 검사 대기 LOT 도 입고한다. 막히는 것은 하류의 피킹·출하다. */
export const INSPECTION_PENDING = 'INSPECTION_PENDING';

/** 들어오는 물건은 가용 재고로 선다. */
export const AVAILABLE = 'AVAILABLE';

/**
 * 화면이 든 한 줄.
 *
 * 수량은 실물대로 받는다 - 인식표가 말하는 수량과 달라도 막지 않는다. 다만 차이를 담을 자리가
 * 계약에 없어 사유를 지어내지 않는다.
 */
export interface DraftLine {
  handlingUnitContentId: number;
  itemId: number;
  lotId: number;
  uomId: number;
  /** 인식표가 말하는 수량. 실물과 다를 수 있다. */
  expectedQty: number;
  qty: string;
}

export type QtyProblem = 'notNumber' | 'negative' | 'zero';

/**
 * 실물 수량 하나를 본다.
 *
 * 0 을 막는다 - 계약이 입고 수량에 0 보다 큰 값을 요구한다. 아무것도 안 들어온 줄은 입고할
 * 것이 없다.
 */
export const qtyProblemOf = (line: DraftLine): QtyProblem | null => {
  const trimmed = line.qty.trim();

  if (trimmed === '') {
    return 'zero';
  }

  const value = Number(trimmed);

  if (!Number.isFinite(value)) {
    return 'notNumber';
  }

  if (value < 0) {
    return 'negative';
  }

  return value === 0 ? 'zero' : null;
};

/** 인식표가 말한 것과 실물이 다른가. 막지 않고 보이기만 한다. */
export const differsFromExpected = (line: DraftLine): boolean => {
  const trimmed = line.qty.trim();

  return trimmed !== '' && Number.isFinite(Number(trimmed)) && Number(trimmed) !== line.expectedQty;
};

/** 이 창고가 위치를 관리하는가. */
export const managesLocations = (warehouse: Warehouse | null): boolean =>
  warehouse !== null && warehouse.managementLevelCode !== WAREHOUSE_LEVEL;

/**
 * 목적지 위치를 정한다.
 *
 * 위치를 관리하는 창고면 스캔한 자리다. 관리하지 않으면 흡수용 대표 위치로 들어간다 -
 * 계약이 목적지를 필수로 요구해 비워 보낼 수 없다.
 *
 * 대표 위치가 없으면 지어내지 않는다. 아무 위치나 골라 넣으면 재고가 남의 자리에 선다.
 */
export const destinationOf = (
  warehouse: Warehouse | null,
  scanned: Location | null,
  locations: Location[],
): Location | null => {
  if (warehouse === null) {
    return null;
  }

  if (managesLocations(warehouse)) {
    return scanned;
  }

  return locations.find((each) => each.locationTypeCode === DEFAULT_LOCATION) ?? null;
};

export const canSubmit = (
  warehouse: Warehouse | null,
  destination: Location | null,
  lines: DraftLine[],
  hasWorker: boolean,
  plantId: number | null,
  queuedForLots: number,
): boolean => {
  if (
    warehouse === null ||
    destination === null ||
    !hasWorker ||
    plantId === null ||
    queuedForLots > 0 ||
    lines.length === 0
  ) {
    return false;
  }

  return lines.every((line) => qtyProblemOf(line) === null);
};

/**
 * 이 LOT 들을 이 단말이 이미 입고해 큐에 담아 두었는가.
 *
 * 서버 응답에는 아직 안 간 건이 없다. 오프라인에서 같은 인식표를 두 번 스캔하면 둘 다
 * 통과하고, 같은 LOT 이 두 번 재고로 선다.
 *
 * 인식표가 아니라 LOT 으로 센다 - 담기는 본문에 인식표가 없고, 두 번 서면 안 되는 것도
 * 인식표가 아니라 LOT 이다. 같은 LOT 이 다른 인식표에 담겨 와도 걸린다.
 */
export const queuedForLotsOf = (entries: { body?: unknown }[], lotIds: number[]): number =>
  entries.filter((entry) => {
    const body = entry.body as { lines?: { lotId?: number }[] } | undefined;

    return (body?.lines ?? []).some(
      (line) => line.lotId !== undefined && lotIds.includes(line.lotId),
    );
  }).length;

/**
 * 입고 전표를 만든다.
 *
 * 원천 문서를 비워 보낸다 - 인식표에서 생산 실적 식별자를 얻을 길이 없고, 계약이 유형과
 * 식별자를 함께 비우는 것을 허용한다. 한쪽만 채우면 없는 행을 가리킨다.
 */
export const toReceiptDraft = (
  warehouse: Warehouse,
  destination: Location,
  lines: DraftLine[],
  plantId: number,
  now: Date,
  workerNo: string,
): OutboxDraft => {
  const body: GoodsReceiptCreate = {
    receiptTypeCode: PRODUCT,
    plantId,
    warehouseId: warehouse.warehouseId,
    /* 입고 시각은 단말 시계다. 서버가 받은 시각으로 덮지 않는다. */
    receiptDatetime: now.toISOString(),
    businessDate: businessDateOf(now),
    lines: lines.map((line): GoodsReceiptLineCreate => ({
      itemId: line.itemId,
      lotId: line.lotId,
      receiptQty: Number(line.qty.trim()),
      uomId: line.uomId,
      qualityStatusCode: INSPECTION_PENDING,
      inventoryStatusCode: AVAILABLE,
      destinationLocationId: destination.locationId,
    })),
  };

  return {
    label: RECEIPT_LABEL,
    workerNo,
    idempotencyKey: createIdempotencyKey(),
    method: 'POST',
    path: '/logistics/goods-receipts',
    body,
    occurredAt: now.toISOString(),
    confirmation: 'pending',
  };
};

/**
 * 적치 완료를 만든다.
 *
 * 적치 지시 식별자는 입고 응답에만 있다 - 입고가 담긴 채로 끝나면 아직 없어서 이 건을
 * 만들 수 없다. 계약이 그 상태를 오류가 아니라 표현 가능한 상태로 두고, 남은 지시는
 * 적치 화면이 되찾는다.
 */
export const toPutawayDraft = (
  putawayTaskId: number,
  destination: Location,
  now: Date,
  workerNo: string,
): OutboxDraft => {
  const body: PutawayTaskComplete = {
    actualLocationId: destination.locationId,
    businessDate: businessDateOf(now),
    occurredAt: now.toISOString(),
  };

  return {
    label: PUTAWAY_LABEL,
    workerNo,
    idempotencyKey: createIdempotencyKey(),
    method: 'POST',
    path: `/logistics/putaway-tasks/${String(putawayTaskId)}:complete`,
    body,
    occurredAt: now.toISOString(),
    confirmation: 'pending',
  };
};

/**
 * 입고 응답이 실어 온 적치 지시 식별자.
 *
 * 라인마다 하나씩 선다. 없는 라인은 건너뛴다 - 서버가 만들지 않았다면 화면이 지어낼 수 없다.
 */
export const putawayTaskIdsOf = (response: unknown): number[] => {
  const lines = (response as { lines?: { putawayTaskId?: number | null }[] } | undefined)?.lines;

  return (lines ?? [])
    .map((line) => line.putawayTaskId)
    .filter((id): id is number => typeof id === 'number');
};
