import type { CodeValue, HandlingUnit, Lot } from './types';

/**
 * 시험용 값. **전부 지어낸 것이다** — 실 운영 값을 쓰지 않는다.
 */

export const WORK_ORDER_ID = 4401;
export const WORKER_NO = '3391';
export const TERMINAL_ID = 210;
export const PROCESS_ID = 501;

export const LOT_A_ID = 90101;
export const LOT_A_NO = 'LOT-SAMPLE-0031';
export const LOT_B_ID = 90102;
export const LOT_B_NO = 'LOT-SAMPLE-0032';

export const ITEM_ID = 2001;
export const UOM_ID = 1;
export const PLANT_ID = 10;

export const HANDLING_UNIT_ID = 5501;
export const HANDLING_UNIT_NO = 'HU-SAMPLE-0007';
export const PARENT_HANDLING_UNIT_ID = 5400;
export const PARENT_HANDLING_UNIT_NO = 'HU-SAMPLE-0001';

export const BOX_CODE = 'BOX';
export const BOX_NAME = '박스';

export const makeLot = (lotId: number, lotNo: string, overrides: Partial<Lot> = {}): Lot => ({
  lotId,
  lotNo,
  itemId: ITEM_ID,
  lotTypeCode: 'PRODUCT',
  plantId: PLANT_ID,
  initialQty: 380,
  uomId: UOM_ID,
  sourceTypeCode: 'WORK_ORDER',
  sourceId: WORK_ORDER_ID,
  statusCode: 'NORMAL',
  completedAt: '2026-09-02T09:12:00+09:00',
  ...overrides,
});

export const targetLots: Lot[] = [makeLot(LOT_A_ID, LOT_A_NO), makeLot(LOT_B_ID, LOT_B_NO)];

export const unitTypes: CodeValue[] = [
  {
    codeValueId: 8801,
    codeGroupId: 880,
    code: BOX_CODE,
    codeName: BOX_NAME,
    displayOrder: 1,
    isActive: true,
  },
];

export const parentUnit: HandlingUnit = {
  handlingUnitId: PARENT_HANDLING_UNIT_ID,
  handlingUnitNo: PARENT_HANDLING_UNIT_NO,
  handlingUnitTypeCode: 'PALLET',
  statusCode: 'NORMAL',
};

export const createdUnit: HandlingUnit = {
  handlingUnitId: HANDLING_UNIT_ID,
  handlingUnitNo: HANDLING_UNIT_NO,
  handlingUnitTypeCode: BOX_CODE,
  statusCode: 'NORMAL',
};
