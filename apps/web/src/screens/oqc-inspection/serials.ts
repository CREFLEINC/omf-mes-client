import type { OqcSerialJudgmentInput, OqcSerialScan, OqcSerialStep } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { toSendableNumber } from './quantity-draft';

/**
 * 시리얼 OQC(omf-all-around#68 · 서버 선행 P-89) — 「검사한 시리얼」 표의 줄과 그 규칙.
 *
 * 서버가 같은 규칙으로 다시 막는다(400 `serials`). 화면은 스캔하는 순간 알려 주려고 먼저 막을 뿐이다.
 */

const t = messages.oqcInspection.serials;

export type SerialJudgment = OqcSerialJudgmentInput['judgmentCode'];

export interface SerialRow {
  serialNumberId: number;
  serialNo: string;
  lotNo: string;
  judgment: SerialJudgment;
  /** 이미 남아 있는 출하검사 줄 — 재검이면 1차는 그대로이고 최종만 바뀐다. */
  previous?: OqcSerialStep;
}

/** 스캔한 시리얼을 이 의뢰의 줄로 받을 수 있는가. 못 받으면 그 이유 문구. */
export const checkScannedSerial = (
  scan: OqcSerialScan,
  target: { inspectionRequestId: number; itemId: number; rows: readonly SerialRow[] },
): string | null => {
  if (target.rows.some((row) => row.serialNumberId === scan.serialNumberId))
    return t.duplicate(scan.serialNo);
  if (scan.itemId !== target.itemId) return t.otherItem(scan.serialNo);
  if (
    !scan.pickedRequests.some(
      (request) => request.inspectionRequestId === target.inspectionRequestId,
    )
  ) {
    return t.notPicked(scan.serialNo);
  }
  if (!scan.sheetStandardReady) return t.noStandard;
  if (scan.shipmentStep !== undefined && scan.shipmentStep.sourceCode !== 'OQC')
    return t.sheetOwned(scan.serialNo);
  return null;
};

/** 1차가 OK 로 남은 시리얼은 NG 로 바꿀 수 없다(서버 · 검사표 규칙). */
export const isNgLocked = (row: SerialRow): boolean => row.previous?.firstJudgmentCode === 'OK';

/** 새 줄은 OK 로 시작한다 — 대부분이 OK 이고, NG 는 골라서 바꾼다. */
export const toSerialRow = (scan: OqcSerialScan): SerialRow => ({
  serialNumberId: scan.serialNumberId,
  serialNo: scan.serialNo,
  lotNo: scan.lotNo,
  judgment: 'OK',
  ...(scan.shipmentStep === undefined ? {} : { previous: scan.shipmentStep }),
});

/** 수량과 모순되면 저장을 막는다(담당자 결정 Q3) — 시리얼 수 ≤ 검사 수량, NG 수 ≤ 불합격 수량. */
export const serialBlockedReason = (
  rows: readonly SerialRow[],
  inspectedQty: number,
  rejectedDraft: string,
): string | null => {
  if (rows.length > inspectedQty) return t.tooMany;
  const rejected = toSendableNumber(rejectedDraft);
  if (rows.filter((row) => row.judgment === 'NG').length > rejected) return t.tooManyNg;
  return null;
};

export const toSerialInputs = (rows: readonly SerialRow[]): OqcSerialJudgmentInput[] =>
  rows.map((row) => ({ serialNumberId: row.serialNumberId, judgmentCode: row.judgment }));
