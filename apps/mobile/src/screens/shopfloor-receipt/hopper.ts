import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import type { Equipment } from '../../patterns/equipments';
import { createIdempotencyKey, type OutboxDraft } from '../../patterns/outbox';

export type InventoryAdjustmentCreate = components['schemas']['InventoryAdjustmentCreate'];
export type InventoryAdjustmentLineUpsert = components['schemas']['InventoryAdjustmentLineUpsert'];

/** 담는 경로의 이름. 담는 쪽과 세는 쪽이 이 상수를 함께 쓴다. */
export const HOPPER_LABEL = messages.shopfloorReceipt.record.hopper;

/**
 * 호퍼 실측의 조정 사유.
 *
 * 실사에서 나오는 값이 아니라 자재가 라인에 들어오는 이 시점에 사람이 눈으로 잰 값이다.
 * 계약이 그 사유를 따로 두었다.
 */
export const HOPPER_MEASUREMENT = 'HOPPER_MEASUREMENT';

/**
 * 이 설비의 호퍼 위치.
 *
 * 설비가 위치를 직접 가리킨다. 매핑이 없는 설비는 잴 자리가 없으므로 고를 수 없다 - 지어낸
 * 자리에 적으면 어느 호퍼의 잔량인지가 사라진다.
 */
export const hopperLocationOf = (equipment: Equipment | null): number | null =>
  equipment?.locationId ?? null;

export const hasHopper = (equipment: Equipment): boolean =>
  equipment.locationId !== null && equipment.locationId !== undefined;

/** 호퍼에 지금 들어 있다고 장부가 말하는 한 줄. */
export interface HopperStock {
  itemId: number;
  lotId?: number | null;
  onHandQty: number;
  uomId: number;
}

export type MeasureProblem = 'notNumber' | 'negative';

export const measureProblemOf = (text: string): MeasureProblem | null => {
  const trimmed = text.trim();

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
 * 장부와 실측의 차이.
 *
 * 계약이 증감량을 받으므로 화면이 빼서 싣는다. 사람이 넣는 것은 잰 값이고 뺀 값이 아니다 -
 * 차이를 사람에게 계산시키면 부호를 뒤집어 적는 순간 재고가 반대로 움직인다.
 */
export const adjustmentQtyOf = (stock: HopperStock, measured: string): number =>
  Number(measured.trim()) - stock.onHandQty;

/** 잰 값이 장부와 같으면 적을 것이 없다. 0 을 보내면 움직이지 않은 조정이 이력에 쌓인다. */
export const isMeasured = (stock: HopperStock, measured: string): boolean =>
  measured.trim() !== '' &&
  measureProblemOf(measured) === null &&
  adjustmentQtyOf(stock, measured) !== 0;

export const canRecordHopper = (
  locationId: number | null,
  stocks: HopperStock[],
  measured: Record<number, string>,
  hasWorker: boolean,
): boolean =>
  locationId !== null &&
  hasWorker &&
  stocks.some((stock) => isMeasured(stock, measured[stock.itemId] ?? ''));

export const toHopperDraft = (
  locationId: number,
  stocks: HopperStock[],
  measured: Record<number, string>,
  now: Date,
  workerNo: string,
): OutboxDraft => {
  const occurredAt = now.toISOString();
  const lines: InventoryAdjustmentLineUpsert[] = stocks
    .filter((stock) => isMeasured(stock, measured[stock.itemId] ?? ''))
    .map((stock) => ({
      locationId,
      itemId: stock.itemId,
      lotId: stock.lotId ?? null,
      adjustmentQty: adjustmentQtyOf(stock, measured[stock.itemId] ?? ''),
      uomId: stock.uomId,
      reasonCode: HOPPER_MEASUREMENT,
    }));

  const body: InventoryAdjustmentCreate = {
    reasonCode: HOPPER_MEASUREMENT,
    lines,
  };

  return {
    label: HOPPER_LABEL,
    workerNo,
    idempotencyKey: createIdempotencyKey(),
    method: 'POST',
    path: '/inventory/adjustments',
    body,
    occurredAt,
    confirmation: 'pending',
  };
};
