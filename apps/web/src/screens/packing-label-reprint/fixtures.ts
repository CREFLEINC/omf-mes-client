import type { HandlingUnit, HandlingUnitContent, Printer } from './types';

/**
 * 시험용 값. **전부 지어낸 것이다** — 실 운영 값을 쓰지 않는다.
 */

export const HANDLING_UNIT_ID = 5501;
export const HANDLING_UNIT_NO = 'HU-SAMPLE-0007';
export const WORKER_NO = '3391';
export const TERMINAL_ID = 210;
export const PROCESS_ID = 501;

export const LOT_A_ID = 90101;
export const LOT_A_NO = 'LOT-SAMPLE-0031';
export const LOT_B_ID = 90102;
export const LOT_B_NO = 'LOT-SAMPLE-0032';

export const ITEM_ID = 2001;
export const ITEM_CODE = 'ABC-123';
export const UOM_ID = 1;
export const UOM_CODE = 'EA';

export const handlingUnit: HandlingUnit = {
  handlingUnitId: HANDLING_UNIT_ID,
  handlingUnitNo: HANDLING_UNIT_NO,
  handlingUnitTypeCode: 'BOX',
  statusCode: 'NORMAL',
};

export const makeContent = (
  lotId: number,
  overrides: Partial<HandlingUnitContent> = {},
): HandlingUnitContent => ({
  handlingUnitContentId: 70000 + lotId,
  handlingUnitId: HANDLING_UNIT_ID,
  itemId: ITEM_ID,
  lotId,
  qty: 100,
  uomId: UOM_ID,
  ...overrides,
});

export const lotNoOf: Record<number, string> = {
  [LOT_A_ID]: LOT_A_NO,
  [LOT_B_ID]: LOT_B_NO,
};

export const readyPrinter: Printer = {
  printerName: 'label-printer-a',
  displayName: '샘플 라벨 프린터 A',
  status: 'READY',
  isDefault: true,
};
