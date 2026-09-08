import type { components } from '@omf-mes/api-client';

import type { Item, SerialNumber } from './flow-queries';

export type DocumentIssueCreate = components['schemas']['DocumentIssueCreate'];
export type LotComplete = components['schemas']['LotComplete'];

/** 품목 마스터가 명시한 시리얼 미관리 값만 비대상이다. 품목 유형 등으로 추정하지 않는다. */
export const requiresIdentificationTag = (item: Item): boolean =>
  item.serialControlTypeCode !== 'NONE';

export const missingIdentificationCount = (actualQty: number, issuedCount: number): number =>
  Math.max(0, actualQty - issuedCount);

export const canMatchIdentificationCount = (actualQty: number, issuedCount: number): boolean =>
  actualQty > 0 && actualQty === issuedCount;

export const buildTagIssue = (
  serials: readonly SerialNumber[],
  options: { reissueReasonCode?: string; printerName?: string | null } = {},
): DocumentIssueCreate => ({
  documentTypeCode: 'IDENTIFICATION_TAG',
  targets: serials.map((serial) => ({
    targetTypeCode: 'SERIAL_NUMBER',
    targetId: serial.serialNumberId,
    lotId: serial.lotId,
  })),
  ...(options.reissueReasonCode === undefined
    ? {}
    : { reissueReasonCode: options.reissueReasonCode }),
  ...(options.printerName === undefined || options.printerName === null
    ? {}
    : { printerName: options.printerName }),
});

export const buildLotIssue = (lotId: number, printerName: string | null): DocumentIssueCreate => ({
  documentTypeCode: 'PRODUCTION_LOT_LABEL',
  targets: [{ targetTypeCode: 'LOT', targetId: lotId, lotId }],
  ...(printerName === null ? {} : { printerName }),
});

const pad = (value: number, width: number): string => String(value).padStart(width, '0');

const offsetText = (at: Date): string => {
  const minutes = -at.getTimezoneOffset();
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);

  return `${sign}${pad(Math.floor(absolute / 60), 2)}:${pad(absolute % 60, 2)}`;
};

export const buildLotComplete = (at: Date): LotComplete => ({
  businessDate: `${String(at.getFullYear())}-${pad(at.getMonth() + 1, 2)}-${pad(at.getDate(), 2)}`,
  occurredAt: `${String(at.getFullYear())}-${pad(at.getMonth() + 1, 2)}-${pad(
    at.getDate(),
    2,
  )}T${pad(at.getHours(), 2)}:${pad(at.getMinutes(), 2)}:${pad(
    at.getSeconds(),
    2,
  )}${offsetText(at)}`,
});

export type ScanVerdict = 'empty' | 'mismatch' | 'match';

export const judgeLotScan = (scanned: string, currentLotNo: string): ScanVerdict => {
  const normalized = scanned.trim();
  if (normalized === '') return 'empty';

  return normalized === currentLotNo ? 'match' : 'mismatch';
};
