import type { DocumentIssue, HandlingUnit, HandlingUnitContent, Printer } from './types';

/**
 * 시험용 값. **전부 지어낸 것이다** — 실 운영 값을 쓰지 않는다(저장소 공개 경계).
 */

export const HANDLING_UNIT_ID = 6602;
export const HANDLING_UNIT_NO = 'HU-SAMPLE-0021';
export const WORKER_NO = '4417';
export const TERMINAL_ID = 311;
export const PROCESS_ID = 602;

export const LOT_A_ID = 90201;
export const LOT_A_NO = 'LOT-SAMPLE-0041';
export const LOT_B_ID = 90202;
export const LOT_B_NO = 'LOT-SAMPLE-0042';

export const ITEM_ID = 2101;
export const ITEM_CODE = 'XYZ-770';
export const UOM_ID = 1;
export const UOM_CODE = 'EA';

export const DOCUMENT_ISSUE_LOG_ID = 44201;
export const REASON_CODE = 'QUANTITY_CHANGE';
export const REASON_NAME = '재구성으로 수량 변경';

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
  handlingUnitContentId: 80000 + lotId,
  handlingUnitId: HANDLING_UNIT_ID,
  itemId: ITEM_ID,
  lotId,
  qty: 80,
  uomId: UOM_ID,
  ...overrides,
});

export const lotNoOf: Record<number, string> = {
  [LOT_A_ID]: LOT_A_NO,
  [LOT_B_ID]: LOT_B_NO,
};

export const readyPrinter: Printer = {
  printerName: 'label-printer-b',
  displayName: '샘플 라벨 프린터 B',
  status: 'READY',
  isDefault: true,
};

export const makeIssue = (overrides: Partial<DocumentIssue> = {}): DocumentIssue => ({
  documentIssueLogId: DOCUMENT_ISSUE_LOG_ID,
  documentTypeCode: 'PACKING_LABEL',
  target: {
    targetTypeCode: 'HANDLING_UNIT',
    targetId: HANDLING_UNIT_ID,
    displayName: HANDLING_UNIT_NO,
  },
  issueSeq: 1,
  issuedBy: 7001,
  issuedByName: '홍길동',
  issuedAt: '2026-09-03T01:20:00Z',
  printOutcome: 'PENDING',
  ...overrides,
});
