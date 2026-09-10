import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { createIdempotencyKey, type OutboxDraft } from '../../patterns/outbox';

export type StockTransfer = components['schemas']['StockTransfer'];
export type StockTransferCreate = components['schemas']['StockTransferCreate'];
export type StockTransferLine = components['schemas']['StockTransferLine'];
export type StockTransferLineUpsert = components['schemas']['StockTransferLineUpsert'];
export type StockTransferArrive = components['schemas']['StockTransferArrive'];

/**
 * 담는 경로의 이름.
 *
 * 담는 쪽과 세는 쪽이 이 상수를 함께 쓴다. 문자열을 양쪽에 적으면 한쪽만 고쳐졌을 때 셈이
 * 조용히 0 이 되고, 오프라인에서 같은 이동을 두 번 반출하는 것을 막지 못한다.
 */
export const SHIP_LABEL = messages.stockTransfer.record.shipped;
export const ARRIVE_LABEL = messages.stockTransfer.record.arrived;

/** 계약이 여는 두 유형. 불량 반출도 이동이고 도착지가 불량창고일 뿐이다. */
export const NORMAL = 'NORMAL';
export const DEFECT_RETURN = 'DEFECT_RETURN';

export type TransferType = typeof NORMAL | typeof DEFECT_RETURN;

/** 반출에 담을 한 줄. 화면이 수량을 글자로 받으므로 수로 바꾸는 자리를 여기 둔다. */
export interface DraftLine {
  lotId: number;
  lotNo: string;
  itemId: number;
  uomId: number;
  fromLocationId: number;
  /** 이 LOT 이 있는 창고. 이동 헤더가 창고 간만 받아 출발 창고를 여기서 얻는다. */
  warehouseId: number;
  /**
   * 그 창고가 속한 사업장.
   *
   * 도착 쪽 값을 빌려 쓰지 않는다 - 두 창고가 다른 사업장이면 출발 사업장이 틀린 채로
   * 기록되고, 되돌릴 수 없는 재고 이동이라 뒤에 고칠 수 없다.
   */
  businessUnitId: number;
  onHandQty: number;
  held: boolean;
  qty: string;
}

/** 이동의 한쪽 끝. 사업장 식별자를 창고가 갖고 있어 창고째로 든다. */
export interface TransferEnd {
  warehouseId: number;
  businessUnitId: number;
}

/** 잔고 줄에서 반출에 필요한 것만 본다. 계약이 사업장과 위치를 선택 항목으로 둔다. */
export interface BalanceRow {
  onHandQty: number;
  locationId?: number | null;
  warehouseId?: number | null;
  businessUnitId?: number | null;
}

/**
 * 반출에 쓸 잔고 줄을 고른 결과. 재고가 없는 것과 사업장을 모르는 것은 다른 일이다.
 *
 * 정해진 값을 함께 낸다 - 부르는 쪽이 다시 꺼내면 선택 항목이라 형 단언을 쓰게 되고,
 * 그러면 여기서 거른 뜻이 사라진다.
 */
export type SourcePick<T extends BalanceRow> =
  | { kind: 'row'; row: T; locationId: number; warehouseId: number; businessUnitId: number }
  | { kind: 'noStock' }
  | { kind: 'unknownBusinessUnit' };

/**
 * 반출 라인을 세울 잔고 줄과 그 사업장.
 *
 * 사업장은 계약에서 선택 항목이라 잔고 줄에 없이 올 수 있다. 없다고 재고가 없는 것이
 * 아닌데 그렇게 읽으면 재고가 멀쩡한 자리에서 반출이 통째로 막힌다.
 *
 * 없으면 출발 창고에서 가져온다. 도착 쪽에서 빌리지 않는다 - 두 창고가 다른 사업장이면
 * 출발이 틀리게 적힌다. 출발 창고는 물건이 실제로 있는 자리라 그 사업장이 맞다.
 *
 * 위치와 창고는 그대로 요구한다. 창고 수준으로만 관리하는 자리는 위치가 비는데, 그 줄로
 * 반출 라인을 만들면 어디서 뺀 것인지가 남지 않는다.
 */
export const sourcePickOf = <T extends BalanceRow>(
  rows: T[],
  warehouses: TransferEnd[],
): SourcePick<T> => {
  for (const row of rows) {
    const { onHandQty, locationId, warehouseId } = row;

    if (
      onHandQty <= 0 ||
      locationId === undefined ||
      locationId === null ||
      warehouseId === undefined ||
      warehouseId === null
    ) {
      continue;
    }

    const businessUnitId =
      row.businessUnitId ??
      warehouses.find((each) => each.warehouseId === warehouseId)?.businessUnitId ??
      null;

    if (businessUnitId === null) {
      return { kind: 'unknownBusinessUnit' };
    }

    return { kind: 'row', row, locationId, warehouseId, businessUnitId };
  }

  return { kind: 'noStock' };
};

export type QtyProblem = 'notNumber' | 'notPositive' | 'overStock';

/**
 * 반출 수량 하나를 본다.
 *
 * 재고보다 많이 내보낼 수 없다. 화면이 통과시키면 반출이 서버에서 되돌아오는데, 그때 작업자는
 * 물건을 이미 옮긴 뒤다.
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

  if (value <= 0) {
    return 'notPositive';
  }

  return value > line.onHandQty ? 'overStock' : null;
};

const filled = (lines: DraftLine[]): DraftLine[] => lines.filter((line) => line.qty.trim() !== '');

/**
 * 보류 중인 LOT.
 *
 * 막지 않는다 - 결정 14 가 경고 뒤 진행으로 두었다. 막으면 현장이 물건을 못 옮긴다. 다만
 * 어느 LOT 이 보류인지 말하지 않으면 작업자는 그 사실을 모른 채 옮긴다.
 */
export const heldLines = (lines: DraftLine[]): DraftLine[] =>
  filled(lines).filter((line) => line.held);

/**
 * 적은 줄들이 서로 다른 창고에 있는가.
 *
 * 이동 헤더는 출발 창고를 하나만 받는다. 섞어 담으면 헤더가 첫 줄의 창고를 말하는데
 * 나머지 줄의 재고는 다른 창고에 있어, 있지도 않은 자리에서 빼는 것이 된다.
 */
export const mixedSourceWarehouses = (lines: DraftLine[]): boolean =>
  new Set(filled(lines).map((line) => line.warehouseId)).size > 1;

/** 출발 쪽 창고와 사업장. 적은 줄이 없으면 아직 정해지지 않았다. */
export const sourceEndOf = (lines: DraftLine[]): TransferEnd | null => {
  const first = filled(lines)[0];

  return first === undefined
    ? null
    : { warehouseId: first.warehouseId, businessUnitId: first.businessUnitId };
};

export const canShip = (lines: DraftLine[], hasWorker: boolean, queuedShips: number): boolean => {
  if (!hasWorker || queuedShips > 0 || mixedSourceWarehouses(lines)) {
    return false;
  }

  const entered = filled(lines);

  return entered.length > 0 && entered.every((line) => qtyProblemOf(line) === null);
};

/**
 * 이 이동을 이 단말이 이미 반출해 큐에 담아 두었는가.
 *
 * 서버 응답에는 아직 안 간 건이 없다. 오프라인에서 같은 LOT 을 두 번 반출하면 둘 다 통과해
 * 재고가 두 번 빠진다.
 */
export const queuedShipsFor = (entries: { body?: unknown }[], lotIds: number[]): number =>
  entries.filter((entry) => {
    const body = entry.body as { lines?: { lotId?: number }[] } | undefined;

    return (body?.lines ?? []).some((line) => lotIds.includes(line.lotId ?? -1));
  }).length;

/**
 * 도착까지 마칠 수 있는가.
 *
 * 반출이 먼저 서버에 닿아야 도착이 그 이동을 가리킬 수 있다. 순서가 뒤집히면 도착이 없는
 * 이동을 가리켜 되돌아온다.
 */
export const canArrive = (
  transfer: StockTransfer | null,
  toLocationId: number | null,
  hasWorker: boolean,
): boolean => transfer !== null && toLocationId !== null && hasWorker;

/**
 * 같은 창고 안의 이동인가.
 *
 * 이동 헤더가 창고 간만 받는다. 같은 창고 안은 수불에 직접 적어야 하는데 계약에 그 쓰기
 * 경로가 없어, 이 슬라이스는 받지 않고 그 사실을 말한다.
 */
export const isSameWarehouse = (fromWarehouseId: number, toWarehouseId: number): boolean =>
  fromWarehouseId === toWarehouseId;

/**
 * 반출을 만든다.
 *
 * 도착 위치를 반출 시점에 싣는다 - 계약이 라인마다 그것을 필수로 요구한다. 실제로 어디에
 * 놓았는지가 계획과 다르면 도착에서 고쳐 적는다.
 */
export const toShipDraft = (
  type: TransferType,
  from: TransferEnd,
  to: TransferEnd,
  toLocationId: number,
  lines: DraftLine[],
  now: Date,
  workerNo: string,
): OutboxDraft => {
  const body: StockTransferCreate = {
    transferTypeCode: type,
    fromBusinessUnitId: from.businessUnitId,
    toBusinessUnitId: to.businessUnitId,
    fromWarehouseId: from.warehouseId,
    toWarehouseId: to.warehouseId,
    requestedAt: now.toISOString(),
    /* 오프라인에서 늦게 닿아도 언제 한 일인지가 남아야 수불이 그날로 선다. */
    businessDate: now.toISOString().slice(0, 10),
    occurredAt: now.toISOString(),
    lines: filled(lines).map((line): StockTransferLineUpsert => ({
      itemId: line.itemId,
      lotId: line.lotId,
      requestedQty: Number(line.qty.trim()),
      uomId: line.uomId,
      fromLocationId: line.fromLocationId,
      toLocationId,
    })),
  };

  return {
    label: SHIP_LABEL,
    workerNo,
    idempotencyKey: createIdempotencyKey(),
    method: 'POST',
    path: '/logistics/stock-transfers',
    body,
    occurredAt: now.toISOString(),
    confirmation: 'pending',
  };
};

export const toArriveDraft = (
  transfer: StockTransfer,
  lines: StockTransferLine[],
  toLocationId: number,
  now: Date,
  workerNo: string,
): OutboxDraft => {
  const body: StockTransferArrive = {
    businessDate: now.toISOString().slice(0, 10),
    occurredAt: now.toISOString(),
    /*
     * 반출한 만큼 도착한 것으로 적는다. 이동 중 분실·손상은 도착 수량이 적은 것으로 표현되지만
     * 그 사유를 담을 자리가 계약에 없어, 화면이 수량을 줄이게 두면 왜 줄었는지가 사라진다.
     */
    lines: lines.map((line) => ({
      stockTransferLineId: line.stockTransferLineId,
      receivedQty: line.shippedQty ?? line.requestedQty,
      toLocationId,
    })),
  };

  return {
    label: ARRIVE_LABEL,
    workerNo,
    idempotencyKey: createIdempotencyKey(),
    method: 'POST',
    path: `/logistics/stock-transfers/${String(transfer.stockTransferId)}:arrive`,
    body,
    occurredAt: now.toISOString(),
    confirmation: 'pending',
  };
};
