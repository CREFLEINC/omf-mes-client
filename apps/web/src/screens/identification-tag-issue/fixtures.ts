import type { DocumentIssue, Lot, Printer, SerialNumber } from './types';

/**
 * 시험용 값. **전부 지어낸 것이다** — 실 운영 값을 쓰지 않는다.
 */

export const WORK_ORDER_ID = 1001;
export const WORKER_NO = '3391';
export const TERMINAL_ID = 210;
export const PROCESS_ID = 501;
export const LOT_ID = 90101;
export const LOT_NO = 'LOT-SAMPLE-0031';

export const makeLot = (overrides: Partial<Lot> = {}): Lot => ({
  lotId: LOT_ID,
  lotNo: LOT_NO,
  itemId: 2001,
  lotTypeCode: 'PRODUCTION',
  plantId: 1,
  initialQty: 500,
  uomId: 1,
  sourceTypeCode: 'WORK_ORDER',
  sourceId: WORK_ORDER_ID,
  statusCode: 'NORMAL',
  ...overrides,
});

export const lotWithProgress = (goodQty: number | null): { lot: Lot } => ({
  lot: {
    ...makeLot(),
    ...(goodQty === null
      ? {}
      : {
          progress: {
            goodQty,
            achievementRate: 0.96,
            varianceQty: -20,
            completionJudgmentCode: 'UNDER' as const,
          },
        }),
  },
});

export const makeSerial = (index: number): SerialNumber => ({
  serialNumberId: 770000 + index,
  serialNo: `SN-SAMPLE-${String(index).padStart(4, '0')}`,
  itemId: 2001,
  lotId: LOT_ID,
  statusCode: 'CREATED',
});

export const makeIssue = (index: number): DocumentIssue => ({
  documentIssueLogId: 44000 + index,
  documentTypeCode: 'TAG',
  target: {
    targetTypeCode: 'SERIAL_NUMBER',
    targetId: 770000 + index,
    displayName: `SN-SAMPLE-${String(index).padStart(4, '0')}`,
  },
  lotId: LOT_ID,
  issueSeq: 1,
  issuedBy: 3101,
  issuedByName: '샘플 작업자',
  issuedAt: '2026-09-02T09:12:30Z',
  printOutcome: 'PENDING',
});

export const readyPrinter: Printer = {
  printerName: 'label-printer-a',
  displayName: '샘플 라벨 프린터 A',
  status: 'READY',
  isDefault: true,
};
