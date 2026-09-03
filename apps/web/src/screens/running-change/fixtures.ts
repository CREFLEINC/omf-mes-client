import type { components } from '@omf-mes/api-client';

import type { CurrentMold } from './mold';
import type { ScannedPart } from './scan';

/**
 * 시험용 값. **전부 지어낸 것이다** — 실 운영 값을 쓰지 않는다.
 */

type Lot = components['schemas']['Lot'];
type MaterialConsumption = components['schemas']['MaterialConsumption'];
type Mold = components['schemas']['Mold'];

export const WORK_ORDER_ID = 1001;
export const WORK_SESSION_ID = 7002;
export const WORKER_NO = '3391';
export const TERMINAL_ID = 210;
export const PROCESS_ID = 501;
export const MOLD_ID = 3301;

/** 이미 투입돼 있는 부품 — 교체 대상이 된다. */
export const OLD_CONSUMPTION_ID = 55001;
export const OLD_ITEM_ID = 2001;
export const OLD_LOT_ID = 90101;
export const OLD_LOT_NO = 'LOT-SAMPLE-0044';

/** 새로 읽어 담을 부품. */
export const NEW_LOT_ID = 90202;
export const NEW_LOT_NO = 'LOT-SAMPLE-0031';
export const NEW_ITEM_ID = 2002;
export const UOM_ID = 11;

export const makeConsumption = (
  overrides: Partial<MaterialConsumption> = {},
): MaterialConsumption => ({
  materialConsumptionId: OLD_CONSUMPTION_ID,
  consumptionNo: 'MC-SAMPLE-0001',
  workOrderId: WORK_ORDER_ID,
  itemId: OLD_ITEM_ID,
  lotId: OLD_LOT_ID,
  consumptionTypeCode: 'SAMPLE',
  inputQty: 180,
  uomId: UOM_ID,
  occurredAt: '2026-09-02T09:12:00+09:00',
  workerId: 4001,
  terminalId: TERMINAL_ID,
  statusCode: 'SAMPLE',
  ...overrides,
});

export const makeLot = (overrides: Partial<Lot> = {}): Lot => ({
  lotId: NEW_LOT_ID,
  lotNo: NEW_LOT_NO,
  itemId: NEW_ITEM_ID,
  lotTypeCode: 'SAMPLE',
  plantId: 1,
  initialQty: 500,
  uomId: UOM_ID,
  sourceTypeCode: 'INBOUND_RECEIPT_LINE',
  sourceId: 12345,
  statusCode: 'NORMAL',
  ...overrides,
});

export const makeMold = (overrides: Partial<Mold> = {}): Mold => ({
  moldId: MOLD_ID,
  plantId: 1,
  moldCode: 'MD-SAMPLE-11',
  moldName: '샘플 금형',
  toolTypeCode: 'SAMPLE',
  cavityCount: 4,
  currentShotCount: 128_400,
  guaranteedShotCount: 500_000,
  availableShotCount: 371_600,
  statusCode: 'SAMPLE',
  isActive: true,
  pmTriggerTypeCode: 'SAMPLE',
  ...overrides,
});

export const makePart = (overrides: Partial<ScannedPart> = {}): ScannedPart => ({
  lotId: NEW_LOT_ID,
  lotNo: NEW_LOT_NO,
  itemId: NEW_ITEM_ID,
  uomId: UOM_ID,
  statusCode: 'NORMAL',
  isHeld: false,
  ...overrides,
});

/** 화면이 다루는 금형 한 건. 계약 응답이 아니라 **화면 타입**이다. */
export const makeCurrentMold = (overrides: Partial<CurrentMold> = {}): CurrentMold => ({
  moldId: MOLD_ID,
  moldCode: 'MD-SAMPLE-11',
  moldName: '샘플 금형',
  currentShotCount: 128_400,
  availableShotCount: 371_600,
  ...overrides,
});
